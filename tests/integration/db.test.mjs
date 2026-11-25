// Database adapter contract (libSQL): the same code path runs against a local file here and against Turso on Vercel.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { openDb, MIGRATIONS, toUrl } = require('../../server/db.js');
const { createClient } = require('@libsql/client');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ta-db-'));
const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'helpers', 'db-worker.cjs');
const worker = (...args) => new Promise((resolve, reject) => {
  execFile(process.execPath, [WORKER, ...args.map(String)], { timeout: 60e3 }, (err, stdout, stderr) => {
    if (err) reject(new Error(`worker failed: ${stderr || err.message}`)); else resolve(JSON.parse(stdout));
  });
});

describe('database adapter (libSQL)', () => {
  let dir;
  before(() => { dir = tmp(); });
  after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may hold the file a moment */ } });

  it('migrates a new database to the latest version exactly once', async () => {
    const db = await openDb(':memory:');
    const versions = (await db.all('SELECT v FROM schema_version ORDER BY v')).map(r => r.v);
    assert.deepEqual(versions, MIGRATIONS.map((_, i) => i + 1));
    for (const t of ['users', 'sessions', 'records', 'audit_log', 'login_throttle', 'meta']) {
      assert.ok(await db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [t]), `${t} exists`);
    }
    db.close();
  });

  it('commits a transaction, and rolls back everything when it throws', async () => {
    const db = await openDb(':memory:');
    await db.tx(async t => { await t.run("INSERT INTO meta (k, v) VALUES ('a', 1)"); });
    await assert.rejects(db.tx(async t => {
      await t.run("INSERT INTO meta (k, v) VALUES ('b', 1)");
      throw new Error('boom');
    }), /boom/);
    assert.deepEqual((await db.all('SELECT k FROM meta ORDER BY k')).map(r => r.k), ['a']);
    db.close();
  });

  it('a nested tx joins the open transaction instead of waiting forever', async () => {
    const db = await openDb(':memory:');
    const n = await db.tx(t => t.tx(async inner => { await inner.run("INSERT INTO meta (k, v) VALUES ('n', 7)"); return 7; }));
    assert.equal(n, 7);
    assert.equal((await db.get("SELECT v FROM meta WHERE k = 'n'")).v, 7);
    db.close();
  });

  it('queues parallel transactions in one process (no lost updates, no SQLITE_BUSY)', async () => {
    const db = await openDb(path.join(dir, 'queue.db'));
    await db.run("INSERT INTO meta (k, v) VALUES ('c', 0)");
    await Promise.all(Array.from({ length: 25 }, () => db.tx(async t => {
      const { v } = await t.get("SELECT v FROM meta WHERE k = 'c'");
      await t.run("UPDATE meta SET v = ? WHERE k = 'c'", [v + 1]);
    })));
    assert.equal((await db.get("SELECT v FROM meta WHERE k = 'c'")).v, 25);
    db.close();
  });

  // Separate processes, like two Vercel instances or the server plus the user CLI. (Two clients inside ONE
  // process cannot share a file: the native driver waits for the lock synchronously and blocks the other.)
  it('two processes on the same database serialise their writes (no lost updates)', async () => {
    const file = path.join(dir, 'shared.db');
    const db = await openDb(file);
    await db.run("INSERT INTO meta (k, v) VALUES ('s', 0)");
    db.close();
    await Promise.all([worker(file, 'bump', 15), worker(file, 'bump', 15)]);
    const check = await openDb(file);
    assert.equal((await check.get("SELECT v FROM meta WHERE k = 's'")).v, 30);
    check.close();
  });

  it('two processes starting together on a new database apply each migration once', async () => {
    const file = path.join(dir, 'race.db');
    const [a, b] = await Promise.all([worker(file, 'open'), worker(file, 'open')]);
    const all = MIGRATIONS.map((_, i) => i + 1);
    assert.deepEqual(a.versions, all);
    assert.deepEqual(b.versions, all);
  });

  it('opening an up-to-date database needs no write lock (a Vercel cold start never waits on other writers)', async () => {
    const file = path.join(dir, 'cold.db');
    (await openDb(file)).close();
    const holder = spawn(process.execPath, [WORKER, file, 'hold', '4000']);
    try {
      await new Promise((resolve, reject) => {
        holder.stdout.on('data', d => { if (String(d).includes('LOCKED')) resolve(); });
        holder.on('exit', code => reject(new Error(`holder exited early (${code})`)));
      });
      const started = Date.now();
      const db = await openDb(file);
      assert.ok((await db.get('SELECT MAX(v) AS v FROM schema_version')).v === MIGRATIONS.length);
      db.close();
      assert.ok(Date.now() - started < 1500, `open took ${Date.now() - started} ms while another process held the write lock`);
    } finally {
      holder.kill();
    }
  });

  it('rolls back and frees the queue when a transaction stalls past its deadline', async () => {
    const db = await openDb(':memory:', { txTimeoutMs: 200 });
    await assert.rejects(db.tx(async t => {
      await t.run("INSERT INTO meta (k, v) VALUES ('stalled', 1)");
      await new Promise(() => {}); // a network call that never answers
    }), e => e.code === 'TX_TIMEOUT');
    assert.equal(await db.get("SELECT v FROM meta WHERE k = 'stalled'"), undefined, 'the stalled write was rolled back');
    await db.tx(t => t.run("INSERT INTO meta (k, v) VALUES ('after', 1)"));
    assert.equal((await db.get("SELECT v FROM meta WHERE k = 'after'")).v, 1, 'the next transaction still runs');
    db.close();
  });

  it('a read while a transaction is open waits for it instead of failing (single local connection)', async () => {
    const db = await openDb(':memory:');
    let releaseTx;
    const open = db.tx(async t => { await t.run("INSERT INTO meta (k, v) VALUES ('r', 1)"); await new Promise(r => { releaseTx = r; }); });
    await new Promise(r => setTimeout(r, 20));
    const read = db.get("SELECT v FROM meta WHERE k = 'r'");
    releaseTx();
    await open;
    assert.equal((await read).v, 1);
    db.close();
  });

  it('enforces foreign keys', async () => {
    const db = await openDb(':memory:');
    await assert.rejects(db.run('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', ['h', 999, 0, 1]), /FOREIGN KEY/);
    db.close();
  });

  it('INSERT OR REPLACE cannot silently remove a record (recursive triggers are on)', async () => {
    const db = await openDb(':memory:');
    await db.run("INSERT INTO users (username, display_name, role, plant, pass_hash, created_at, pw_changed_at) VALUES ('u','U','dept','FSD','x','t','t')");
    await db.run("INSERT INTO records (type, plant, date, dkey, data, status, submitted_by, submitted_at) VALUES ('spin_shift','FSD','2026-11-25','k1','{}','submitted',1,'t')");
    await assert.rejects(db.run("INSERT OR REPLACE INTO records (id, type, plant, date, dkey, data, status, submitted_by, submitted_at) VALUES (1,'spin_shift','FSD','2026-11-25','k1','{\"x\":1}','submitted',1,'t')"), /cannot be deleted/);
    assert.equal((await db.get('SELECT data FROM records WHERE id = 1')).data, '{}');
    db.close();
  });

  it('returns plain rows, numeric ids and change counts', async () => {
    const db = await openDb(':memory:');
    const r = await db.run("INSERT INTO meta (k, v) VALUES ('x', 1)");
    assert.equal(r.changes, 1);
    assert.equal(typeof r.lastInsertRowid, 'number');
    assert.deepEqual(await db.get("SELECT k, v FROM meta WHERE k = 'x'"), { k: 'x', v: 1 });
    assert.equal(await db.get("SELECT k FROM meta WHERE k = 'none'"), undefined);
    db.close();
  });

  it('turns a file path into a file: URL and leaves Turso URLs alone', () => {
    assert.match(toUrl(path.join(dir, 'x.db')), /^file:.*x\.db$/);
    assert.equal(toUrl('libsql://audit-acme.turso.io'), 'libsql://audit-acme.turso.io');
    assert.equal(toUrl(':memory:'), ':memory:');
  });
});

describe('database upgrade from version 1', () => {
  it('keeps existing users and sessions and allows the new operator role', async () => {
    const dir = tmp();
    const file = path.join(dir, 'v1.db');
    const old = createClient({ url: toUrl(file) });
    await old.executeMultiple(MIGRATIONS[0]);
    await old.executeMultiple(`CREATE TABLE schema_version (v INTEGER NOT NULL); INSERT INTO schema_version VALUES (1);
      INSERT INTO users (username, display_name, role, plant, pass_hash, created_at, pw_changed_at) VALUES ('legacy','Legacy','dept','KHI','x','t','t');
      INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES ('h', 1, 0, 9000000000000000);`);
    old.close();
    const db = await openDb(file);
    assert.equal((await db.get('SELECT username FROM users WHERE id = 1')).username, 'legacy');
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM sessions')).n, 1, 'sessions survive the rebuild');
    await db.run("INSERT INTO users (username, display_name, role, plant, department, pass_hash, created_at, pw_changed_at) VALUES ('op','Op','operator','KHI','sewing','x','t','t')");
    assert.deepEqual(await db.all('PRAGMA foreign_key_check'), []);
    assert.equal((await db.get('PRAGMA foreign_keys')).foreign_keys, 1);
    db.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });
});
