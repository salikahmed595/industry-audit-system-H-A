'use strict';
/* Append-only, hash-chained audit log. Each row stores the hash of the previous row, so any edit,
 * deletion or re-ordering breaks the chain and is reported by verify(). DB triggers block UPDATE/DELETE.
 * append() must run inside a write transaction: reading the last hash and inserting the next row is then
 * atomic, even with several server instances writing to the same database. */
const { sha256 } = require('./security');

const GENESIS = '0'.repeat(64);
const SEP = '\u001f';
const PAGE = 1000;

function rowHash(prev, r) {
  return sha256([prev, r.ts, r.user_id === null || r.user_id === undefined ? '' : r.user_id, r.username || '', r.role || '', r.action, r.target || '', r.detail].join(SEP));
}

async function append(t, { ts, user, action, target, detail }) {
  if (!t || !t.inTx) throw new Error('audit.append must run inside db.tx()');
  const last = await t.get('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1');
  const row = { ts, user_id: user ? user.id : null, username: user ? user.username : null, role: user ? user.role : null, action, target: target || null, detail: JSON.stringify(detail || {}) };
  const prev = last ? last.hash : GENESIS;
  const hash = rowHash(prev, row);
  await t.run('INSERT INTO audit_log (ts, user_id, username, role, action, target, detail, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [row.ts, row.user_id, row.username, row.role, row.action, row.target, row.detail, prev, hash]);
  return hash;
}

/** Walk the whole chain in pages so a long log is never loaded into memory at once. */
async function verify(db) {
  let prev = GENESIS, count = 0, after = 0;
  for (;;) {
    const rows = await db.all('SELECT * FROM audit_log WHERE id > ? ORDER BY id LIMIT ?', [after, PAGE]);
    for (const r of rows) {
      if (r.prev_hash !== prev || rowHash(prev, r) !== r.hash) return { ok: false, count, brokenAt: r.id };
      prev = r.hash; count++;
    }
    if (rows.length < PAGE) return { ok: true, count, head: prev };
    after = rows[rows.length - 1].id;
  }
}

function message(r) {
  try { const d = JSON.parse(r.detail); return typeof d.msg === 'string' ? d.msg : r.action; } catch { return r.action; }
}
const present = r => ({ t: r.ts, r: r.role || 'system', u: r.username || 'system', e: message(r), target: r.target });

async function recent(db, limit = 200) {
  return (await db.all('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', [limit])).map(present);
}

/** History of the given targets (finding ids), oldest first. Only those targets are read, through the target
 *  index: department records add an audit row each (target R<id>) and must not slow down every dashboard load. */
async function historyByTarget(db, targets) {
  const out = {};
  if (!targets.length) return out;
  for (const r of await db.all(`SELECT ts, action, target, detail FROM audit_log WHERE target IN (${targets.map(() => '?').join(', ')}) ORDER BY id`, targets)) {
    (out[r.target] = out[r.target] || []).push({ t: r.ts, e: message(r) });
  }
  return out;
}

module.exports = { append, verify, recent, historyByTarget, GENESIS };
