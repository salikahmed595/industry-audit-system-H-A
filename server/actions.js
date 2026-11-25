'use strict';
/* Corrective-action (8D / CAPA) service. Reuses the same workflow rules as the browser (js/engine.js),
 * but here they are authoritative: role, plant scope, stage order, evidence and optimistic locking. */
const { RCA, util } = require('../js/engine.js');
const D = require('../js/data.js');
const { HttpError } = require('./errors');
const { tx } = require('./db');
const audit = require('./audit');

const FINDINGS = new Map(D.FINDINGS.map(f => [f.id, f]));
const WORKFLOW_ROLES = ['ceo', 'plant', 'dept', 'finance'];
const APPROVERS = ['ceo', 'plant', 'finance'];
const STAGE_NAME = { detected: 'Detected', diagnosed: 'Diagnosed', approved: 'Approved', in_progress: 'In progress', verified: 'Verified' };
const D8 = ['D1 Team formed', 'D2 Problem defined', 'D3 Containment in place', 'D4 Root cause verified', 'D5 Corrective action chosen', 'D6 Action implemented', 'D7 Recurrence prevented', 'D8 Closed & recognised'];
const D8_BY_STAGE = { detected: 0, diagnosed: 4, approved: 5, in_progress: 6, verified: 8 };

const inScope = (user, f) => user.plant === 'all' || user.plant === f.plant;

function makeActions(db, clock) {
  const iso = () => new Date(clock()).toISOString();

  /** First run: one action per AI finding, all at Detected. */
  function seedIfEmpty() {
    if (db.prepare('SELECT COUNT(*) AS c FROM actions').get().c > 0) return false;
    tx(db, () => {
      const ins = db.prepare('INSERT INTO actions (id, stage, due, d8, after, version, updated_at) VALUES (?, ?, ?, ?, NULL, 1, ?)');
      const now = clock();
      D.FINDINGS.forEach((f, i) => {
        const due = new Date(now + (14 + (i * 5) % 45) * 864e5).toISOString().slice(0, 10);
        ins.run(f.id, 'detected', due, JSON.stringify(D8.map(() => false)), iso());
      });
      audit.append(db, { ts: iso(), user: null, action: 'system.seed', target: null, detail: { count: D.FINDINGS.length, msg: `${D.FINDINGS.length} findings loaded from the audit baseline` } });
    });
    return true;
  }

  function present(row, hist) {
    const f = FINDINGS.get(row.id);
    const after = row.after === null ? null : row.after;
    return {
      id: row.id, stage: row.stage, due: row.due, d8: JSON.parse(row.d8), after, version: row.version,
      effective: row.stage === 'verified' && after !== null ? RCA.effective(after, f.kpi.target, f.kpi.dir) : null,
      hist: hist || [],
    };
  }

  function all() {
    const hist = audit.historyByTarget(db);
    const out = {};
    for (const r of db.prepare('SELECT * FROM actions ORDER BY id').all()) out[r.id] = present(r, hist[r.id]);
    return out;
  }

  function one(id) {
    const r = db.prepare('SELECT * FROM actions WHERE id = ?').get(id);
    const hist = db.prepare('SELECT ts, detail, action FROM audit_log WHERE target = ? ORDER BY id').all(id)
      .map(h => { let e = h.action; try { e = JSON.parse(h.detail).msg || e; } catch { /* keep action */ } return { t: h.ts, e }; });
    return present(r, hist);
  }

  /** Shared guard: finding exists, caller may act on it, version matches. Returns {f, row}. */
  function guard(user, id, version) {
    const f = FINDINGS.get(id);
    if (!f) throw new HttpError(404, 'No such action.');
    if (!WORKFLOW_ROLES.includes(user.role)) throw new HttpError(403, 'This account type cannot change corrective actions.');
    if (!inScope(user, f)) throw new HttpError(403, 'This action belongs to another plant.');
    if (!Number.isInteger(version) || version < 1) throw new HttpError(400, 'A numeric version is required.');
    const row = db.prepare('SELECT * FROM actions WHERE id = ?').get(id);
    if (!row) throw new HttpError(404, 'No such action.');
    if (row.version !== version) throw new HttpError(409, 'Someone else changed this action. Reload and try again.', { action: one(id) });
    return { f, row };
  }

  function save(user, row, patch, event) {
    db.prepare('UPDATE actions SET stage = ?, d8 = ?, after = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?')
      .run(patch.stage, JSON.stringify(patch.d8), patch.after, iso(), user.id, row.id, row.version);
    audit.append(db, { ts: iso(), user, action: event.action, target: row.id, detail: event.detail });
  }

  function transition(user, id, body) {
    const to = body && body.to;
    if (!RCA.STAGES.includes(to)) throw new HttpError(400, 'Unknown target stage.');
    return tx(db, () => {
      const { f, row } = guard(user, id, body.version);
      if (RCA.next(row.stage) !== to) throw new HttpError(422, 'Actions move one stage at a time.');
      if (to === 'approved' && !APPROVERS.includes(user.role)) throw new HttpError(403, 'Only the CEO, Plant Head or Finance can approve.');
      let after = row.after;
      let msg = `${f.id} "${f.title}" → ${STAGE_NAME[to]}`;
      const detail = { from: row.stage, to };
      if (to === 'verified') {
        after = util.toNum(body.after);
        const chk = RCA.canMove(row.stage, to, user.role, { after });
        if (!chk.ok || after === null) throw new HttpError(422, 'Enter the measured after-value (a number of 0 or more) to verify the fix.');
        const eff = RCA.effective(after, f.kpi.target, f.kpi.dir);
        Object.assign(detail, { after, target: f.kpi.target, effective: eff });
        msg = `${f.id} verified: ${f.kpi.name} ${after} vs target ${f.kpi.target} — ${eff ? 'effective' : 'NOT effective'}`;
      } else {
        const chk = RCA.canMove(row.stage, to, user.role);
        if (!chk.ok) throw new HttpError(422, chk.why);
      }
      const d8 = JSON.parse(row.d8).map((v, k) => (to === 'verified' ? true : v || k < D8_BY_STAGE[to]));
      save(user, row, { stage: to, d8, after }, { action: 'action.transition', detail: { ...detail, msg } });
      return one(id);
    });
  }

  function reopen(user, id, body) {
    return tx(db, () => {
      const { f, row } = guard(user, id, body && body.version);
      const eff = row.after !== null && RCA.effective(row.after, f.kpi.target, f.kpi.dir);
      const chk = RCA.canReopen(row.stage, eff);
      if (!chk.ok) throw new HttpError(422, chk.why);
      const d8 = D8.map((_, k) => k < D8_BY_STAGE[chk.to]);
      save(user, row, { stage: chk.to, d8, after: null }, { action: 'action.reopen', detail: { from: row.stage, to: chk.to, msg: `${f.id} reopened (fix did not reach target)` } });
      return one(id);
    });
  }

  function setD8(user, id, body) {
    const index = body && body.index;
    if (!Number.isInteger(index) || index < 0 || index > 7) throw new HttpError(400, 'Checklist index must be 0-7.');
    if (typeof body.checked !== 'boolean') throw new HttpError(400, 'checked must be true or false.');
    return tx(db, () => {
      const { f, row } = guard(user, id, body.version);
      if (row.stage === 'verified') throw new HttpError(422, 'This action is verified, so its 8D checklist is closed. Reopen it to make changes.');
      const d8 = JSON.parse(row.d8);
      d8[index] = body.checked;
      save(user, row, { stage: row.stage, d8, after: row.after }, { action: 'action.d8', detail: { index, checked: body.checked, msg: `${f.id}: ${D8[index]} ${body.checked ? 'ticked' : 'unticked'}` } });
      return one(id);
    });
  }

  return { seedIfEmpty, all, one, transition, reopen, setD8 };
}

module.exports = { makeActions, WORKFLOW_ROLES };
