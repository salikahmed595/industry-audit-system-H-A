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
];

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (v INTEGER NOT NULL)');
  const row = db.prepare('SELECT MAX(v) AS v FROM schema_version').get();
  const current = row && row.v !== null ? row.v : 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    tx(db, () => {
      db.exec(MIGRATIONS[i]);
      db.prepare('INSERT INTO schema_version (v) VALUES (?)').run(i + 1);
    });
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
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  migrate(db);
  return db;
}

module.exports = { openDb, tx };
