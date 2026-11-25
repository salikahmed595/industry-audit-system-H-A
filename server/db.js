'use strict';
/* Database access through libSQL (@libsql/client): a local SQLite file in development and tests, or a hosted
 * Turso database (libsql://…) on Vercel. Same SQL engine either way, so the schema, triggers and indexes are shared.
 *
 * Every call is async. Writes that must be atomic go through db.tx(fn): fn receives a scope with the same
 * get/all/run/exec methods, bound to one BEGIN IMMEDIATE transaction. Transactions inside one process are queued
 * (a local SQLite file allows one writer at a time); across processes or Vercel instances SQLite itself
 * serialises them (Turso queues write transactions, a local file is retried while busy). */
const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     username TEXT NOT NULL UNIQUE COLLATE NOCASE,
     display_name TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('ceo','plant','dept','finance','admin','integration')),
     plant TEXT NOT NULL,
     pass_hash TEXT NOT NULL,
     active INTEGER NOT NULL DEFAULT 1,
     created_at TEXT NOT NULL,
     pw_changed_at TEXT NOT NULL
   );
   CREATE TABLE sessions (
     id_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE actions (
     id TEXT PRIMARY KEY,
     stage TEXT NOT NULL CHECK (stage IN ('detected','diagnosed','approved','in_progress','verified')),
     due TEXT NOT NULL,
     d8 TEXT NOT NULL,
     after REAL,
     version INTEGER NOT NULL DEFAULT 1,
     updated_at TEXT NOT NULL,
     updated_by INTEGER REFERENCES users(id)
   );
   CREATE TABLE audit_log (
     id INTEGER PRIMARY KEY,
     ts TEXT NOT NULL,
     user_id INTEGER,
     username TEXT,
     role TEXT,
     action TEXT NOT NULL,
     target TEXT,
     detail TEXT NOT NULL,
     prev_hash TEXT NOT NULL,
     hash TEXT NOT NULL
   );
   CREATE INDEX audit_target ON audit_log(target);
   CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
   CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
   CREATE TABLE kpi_values (
     id INTEGER PRIMARY KEY,
     section TEXT NOT NULL,
     kpi TEXT NOT NULL,
     value REAL NOT NULL,
     as_of TEXT NOT NULL,
     source TEXT NOT NULL,
     ingested_at TEXT NOT NULL,
     ingested_by INTEGER NOT NULL REFERENCES users(id)
   );
   CREATE INDEX kpi_latest ON kpi_values(section, kpi, as_of);`,

  // 2: operator role + department on users (table rebuild: SQLite cannot alter a CHECK constraint),
  //    and department records with maker-checker review. Record values are immutable once written.
  { fkOff: true, sql: `CREATE TABLE users_new (
     id INTEGER PRIMARY KEY,
     username TEXT NOT NULL UNIQUE COLLATE NOCASE,
     display_name TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('ceo','plant','dept','finance','admin','integration','operator')),
     plant TEXT NOT NULL,
     department TEXT,
     pass_hash TEXT NOT NULL,
     active INTEGER NOT NULL DEFAULT 1,
     created_at TEXT NOT NULL,
     pw_changed_at TEXT NOT NULL
   );
   INSERT INTO users_new (id, username, display_name, role, plant, department, pass_hash, active, created_at, pw_changed_at)
     SELECT id, username, display_name, role, plant, NULL, pass_hash, active, created_at, pw_changed_at FROM users;
   DROP TABLE users;
   ALTER TABLE users_new RENAME TO users;
   CREATE TABLE records (
     id INTEGER PRIMARY KEY,
     type TEXT NOT NULL,
     plant TEXT NOT NULL,
     date TEXT NOT NULL,
     dkey TEXT,
     data TEXT NOT NULL,
     flags TEXT NOT NULL DEFAULT '[]',
     status TEXT NOT NULL CHECK (status IN ('submitted','approved','rejected','voided')),
     submitted_by INTEGER NOT NULL REFERENCES users(id),
     submitted_at TEXT NOT NULL,
     reviewed_by INTEGER REFERENCES users(id),
     reviewed_at TEXT,
     review_note TEXT,
     version INTEGER NOT NULL DEFAULT 1
   );
   CREATE INDEX records_measure ON records(status, date, type, plant);
   CREATE INDEX records_submitter ON records(submitted_by, id);
   CREATE UNIQUE INDEX records_no_duplicates ON records(type, plant, dkey) WHERE dkey IS NOT NULL AND status IN ('submitted','approved');
   CREATE TRIGGER records_immutable BEFORE UPDATE OF type, plant, date, dkey, data, flags, submitted_by, submitted_at ON records
     BEGIN SELECT RAISE(ABORT, 'record values cannot be changed; void the record and enter it again'); END;
   CREATE TRIGGER records_no_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT, 'records cannot be deleted; void them instead'); END;` },
  // 3: the workflow itself is enforced by the database too: new rows start as submitted, status only moves
  //    submitted -> approved|rejected or approved -> voided, ids never change, and a decision cannot be rewritten.
  `CREATE TRIGGER records_insert_submitted BEFORE INSERT ON records WHEN NEW.status <> 'submitted' OR NEW.reviewed_by IS NOT NULL
     BEGIN SELECT RAISE(ABORT, 'new records must start as submitted'); END;
   CREATE TRIGGER records_status_flow BEFORE UPDATE OF status ON records
     WHEN NEW.status <> OLD.status AND NOT ((OLD.status = 'submitted' AND NEW.status IN ('approved', 'rejected')) OR (OLD.status = 'approved' AND NEW.status = 'voided'))
     BEGIN SELECT RAISE(ABORT, 'record status can only move submitted -> approved/rejected or approved -> voided'); END;
   CREATE TRIGGER records_review_frozen BEFORE UPDATE OF reviewed_by, reviewed_at, review_note ON records WHEN NEW.status = OLD.status
     BEGIN SELECT RAISE(ABORT, 'a review decision cannot be rewritten; void the record instead'); END;
   CREATE TRIGGER records_id_fixed BEFORE UPDATE OF id ON records BEGIN SELECT RAISE(ABORT, 'record ids cannot change'); END;`,
  // 4: state that several server instances (Vercel) must share instead of keeping in memory:
  //    sign-in throttling counters, and a counter that changes whenever the approved record set changes.
  `CREATE TABLE login_throttle (
     key TEXT PRIMARY KEY,
     count INTEGER NOT NULL,
     first INTEGER NOT NULL
   );
   CREATE INDEX login_throttle_first ON login_throttle(first);
   CREATE TABLE meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);`,
];

// A local file shared with another process (the user CLI, a second dev server) waits up to 5 s for its lock
// inside SQLite. Retrying a failed BEGIN from JavaScript is not safe: the client keeps the failed statement open.
const BUSY_TIMEOUT = 'PRAGMA busy_timeout = 5000';

/** First-in, first-out lock so that one process never opens two write transactions at once. */
function makeQueue() {
  let tail = Promise.resolve();
  return () => {
    let release;
    const next = new Promise(r => { release = r; });
    const ready = tail.then(() => release);
    tail = tail.then(() => next);
    return ready;
  };
}

const toRows = rs => rs.rows.map(r => {
  const o = {};
  rs.columns.forEach((c, i) => { o[c] = r[i]; });
  return o;
});
const stmt = (sql, args) => ({ sql, args: args || [] });
const runResult = rs => ({ changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid === undefined ? undefined : Number(rs.lastInsertRowid) });

/** Query methods over anything with execute/executeMultiple (the client or an open transaction). */
function queries(target) {
  return {
    get: async (sql, args) => toRows(await target.execute(stmt(sql, args)))[0],
    all: async (sql, args) => toRows(await target.execute(stmt(sql, args))),
    run: async (sql, args) => runResult(await target.execute(stmt(sql, args))),
    exec: async sql => { await target.executeMultiple(sql); },
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Rejects if p has not settled within ms. p keeps running; its late result or error is dropped. */
function withDeadline(p, ms) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`Database transaction took longer than ${ms} ms and was rolled back`), { code: 'TX_TIMEOUT' })), ms);
  });
  p.catch(() => {}); // a late failure after the deadline must not become an unhandled rejection
  return Promise.race([p, deadline]).finally(() => clearTimeout(timer));
}

/**
 * local: a file or :memory: on ONE connection (the client's pool would otherwise run a connection setting such as
 * foreign_keys on one connection and the transaction on another). Every call, reads included, then goes through the
 * in-process queue, exactly as the earlier synchronous SQLite code did. Remote (Turso): reads go straight out, write
 * transactions still queue per instance, and Turso serialises them across instances.
 */
function makeDb(client, { local, txTimeoutMs }) {
  const acquire = makeQueue();
  const direct = queries(client);

  async function begin() {
    if (local) return client.transaction('write');
    // A remote BEGIN can fail on a dropped connection; nothing has run yet, so trying again is safe.
    for (let attempt = 1; ; attempt++) {
      try { return await client.transaction('write'); } catch (e) {
        if (attempt >= 3) throw e;
        await sleep(50 * attempt + Math.random() * 100);
      }
    }
  }

  /** beforeBegin / afterEnd: connection settings around one transaction (local only, see migrate). */
  async function tx(fn, { beforeBegin, afterEnd } = {}) {
    const release = await acquire();
    let t = null;
    try {
      if (local) {
        await client.execute(BUSY_TIMEOUT);
        if (beforeBegin) await client.execute(beforeBegin);
      }
      t = await begin();
      // Per-connection setting: an INSERT OR REPLACE then fires the no-delete triggers instead of silently removing
      // a row. Skipped on Turso, where it would cost a network round trip on every write (the app never uses REPLACE).
      if (local) await t.execute('PRAGMA recursive_triggers = ON');
      const scope = { ...queries(t), inTx: true };
      scope.tx = f => f(scope); // nested call joins the open transaction instead of deadlocking on the queue
      const out = await withDeadline(Promise.resolve().then(() => fn(scope)), txTimeoutMs);
      await t.commit();
      return out;
    } catch (e) {
      if (t && !t.closed) { try { await t.rollback(); } catch { /* connection already gone */ } }
      throw e;
    } finally {
      if (t) t.close();
      if (local && afterEnd) { try { await client.execute(afterEnd); } catch { /* reported by the next call */ } }
      release();
    }
  }

  /** One call on the single local connection, after any open transaction. */
  async function queued(call) {
    const release = await acquire();
    try { return await call(); } finally { release(); }
  }

  return {
    local,
    inTx: false,
    get: (sql, args) => (local ? queued(() => direct.get(sql, args)) : direct.get(sql, args)),
    all: (sql, args) => (local ? queued(() => direct.all(sql, args)) : direct.all(sql, args)),
    run: (sql, args) => (local ? tx(t => t.run(sql, args)) : direct.run(sql, args)),
    exec: sql => (local ? tx(t => t.exec(sql)) : direct.exec(sql)),
    tx,
    close: () => client.close(),
  };
}

/** ':memory:', a file path, or a libsql:// / https:// URL (Turso). */
function toUrl(target) {
  const t = String(target || ':memory:');
  if (t === ':memory:' || /^(libsql|https?|wss?):\/\//i.test(t) || t.startsWith('file:')) return t;
  const abs = path.resolve(t);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return `file:${abs.split(path.sep).join('/')}`;
}

async function currentVersion(db) {
  try {
    const row = await db.get('SELECT MAX(v) AS v FROM schema_version');
    return row && row.v !== null ? row.v : 0;
  } catch (e) {
    if (/no such table/i.test(e.message)) return 0;
    throw e;
  }
}

async function migrate(db) {
  // Every Vercel cold start runs this: one read, and no write transaction at all once the schema is current.
  if (await currentVersion(db) >= MIGRATIONS.length) return;
  await db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const m = typeof MIGRATIONS[i] === 'string' ? { sql: MIGRATIONS[i] } : MIGRATIONS[i];
    // Table rebuilds need foreign keys off. The pragma is ignored inside a transaction, so it is set on the
    // connection just before BEGIN. (On a remote Turso database this only ever runs on a new, empty database.)
    await db.tx(async t => {
      const row = await t.get('SELECT MAX(v) AS v FROM schema_version');
      if (row && row.v !== null && row.v >= i + 1) return; // another instance already applied it
      await t.exec(m.sql);
      if (m.fkOff && (await t.all('PRAGMA foreign_key_check')).length) throw new Error(`Migration ${i + 1} broke a foreign key`);
      await t.run('INSERT INTO schema_version (v) VALUES (?)', [i + 1]);
    }, m.fkOff ? { beforeBegin: 'PRAGMA foreign_keys = OFF', afterEnd: 'PRAGMA foreign_keys = ON' } : {});
  }
}

/** Open (and migrate) a database. authToken is only used for a remote Turso URL. txTimeoutMs bounds how long one
 *  transaction may hold the write lock (a stalled network call would otherwise block every other writer). */
async function openDb(target, { authToken, txTimeoutMs = 10000 } = {}) {
  const { createClient } = require('@libsql/client');
  const url = toUrl(target);
  const local = url === ':memory:' || url.startsWith('file:');
  const client = createClient({ url, authToken: local ? undefined : authToken, intMode: 'number', ...(local ? { concurrency: 1 } : {}) });
  try {
    const db = makeDb(client, { local, txTimeoutMs });
    if (url.startsWith('file:')) {
      await client.execute(BUSY_TIMEOUT);
      await client.execute('PRAGMA journal_mode = WAL'); // other processes (the user CLI) can read while this one writes
    }
    await migrate(db);
    return db;
  } catch (e) {
    client.close();
    throw e;
  }
}

module.exports = { openDb, MIGRATIONS, toUrl };
