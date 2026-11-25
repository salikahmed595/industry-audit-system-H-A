'use strict';
/* SQLite storage (node:sqlite, no native dependencies). All SQL lives in server/*.js repositories,
 * so moving to PostgreSQL later only touches this layer. */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

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
];

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
  const row = db.prepare('SELECT MAX(v) AS v FROM schema_version').get();
  const current = row && row.v !== null ? row.v : 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    const m = typeof MIGRATIONS[i] === 'string' ? { sql: MIGRATIONS[i] } : MIGRATIONS[i];
    // Table rebuilds need foreign keys off; the pragma is ignored inside a transaction, so set it outside.
    if (m.fkOff) db.exec('PRAGMA foreign_keys = OFF');
    try {
      tx(db, () => {
        db.exec(m.sql);
        if (m.fkOff && db.prepare('PRAGMA foreign_key_check').all().length) throw new Error(`Migration ${i + 1} broke a foreign key`);
        db.prepare('INSERT INTO schema_version (v) VALUES (?)').run(i + 1);
      });
    } finally {
      if (m.fkOff) db.exec('PRAGMA foreign_keys = ON');
    }
  }
}

/** Run fn inside a write transaction (BEGIN IMMEDIATE takes the write lock up front). */
function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  // recursive_triggers: an INSERT OR REPLACE then fires the no-delete triggers instead of silently removing a row.
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA recursive_triggers = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  migrate(db);
  return db;
}

module.exports = { openDb, tx, MIGRATIONS };
