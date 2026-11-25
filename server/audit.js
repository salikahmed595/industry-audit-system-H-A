'use strict';
/* Append-only, hash-chained audit log. Each row stores the hash of the previous row, so any edit,
 * deletion or re-ordering breaks the chain and is reported by verify(). DB triggers block UPDATE/DELETE. */
const { sha256 } = require('./security');

const GENESIS = '0'.repeat(64);
const SEP = '\u001f';

function rowHash(prev, r) {
  return sha256([prev, r.ts, r.user_id === null || r.user_id === undefined ? '' : r.user_id, r.username || '', r.role || '', r.action, r.target || '', r.detail].join(SEP));
}

function append(db, { ts, user, action, target, detail }) {
  const last = db.prepare('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1').get();
  const row = { ts, user_id: user ? user.id : null, username: user ? user.username : null, role: user ? user.role : null, action, target: target || null, detail: JSON.stringify(detail || {}) };
  const prev = last ? last.hash : GENESIS;
  const hash = rowHash(prev, row);
  db.prepare('INSERT INTO audit_log (ts, user_id, username, role, action, target, detail, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(row.ts, row.user_id, row.username, row.role, row.action, row.target, row.detail, prev, hash);
  return hash;
}

function verify(db) {
  let prev = GENESIS, count = 0;
  for (const r of db.prepare('SELECT * FROM audit_log ORDER BY id').iterate()) {
    if (r.prev_hash !== prev || rowHash(prev, r) !== r.hash) return { ok: false, count, brokenAt: r.id };
    prev = r.hash; count++;
  }
  return { ok: true, count, head: prev };
}

function message(r) {
  try { const d = JSON.parse(r.detail); return typeof d.msg === 'string' ? d.msg : r.action; } catch { return r.action; }
}
const present = r => ({ t: r.ts, r: r.role || 'system', u: r.username || 'system', e: message(r), target: r.target });

function recent(db, limit = 200) {
  return db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit).map(present);
}

/** History per target (finding id), oldest first. */
function historyByTarget(db) {
  const out = {};
  for (const r of db.prepare("SELECT * FROM audit_log WHERE target IS NOT NULL ORDER BY id").iterate()) {
    (out[r.target] = out[r.target] || []).push({ t: r.ts, e: message(r) });
  }
  return out;
}

module.exports = { append, verify, recent, historyByTarget, GENESIS };
