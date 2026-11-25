'use strict';
/* Department records with maker-checker review.
 * - Staff submit records for their own department and plant (validated by js/measure.js, the same rules the form shows).
 * - A different person (department head, plant head, CEO or finance for finance forms) approves or rejects.
 * - Only APPROVED records count toward KPIs. Approved records can be voided with a reason; nothing is ever edited or deleted.
 * - Every step is written to the hash-chained audit log in the same transaction. */
const M = require('../js/measure.js');
const { HttpError } = require('./errors');
const { tx } = require('./db');
const audit = require('./audit');

const STATUSES = ['submitted', 'approved', 'rejected', 'voided'];
const DECISIONS = { approve: { from: 'submitted', to: 'approved' }, reject: { from: 'submitted', to: 'rejected' }, void: { from: 'approved', to: 'voided' } };
const MAX_NOTE = 500;

function makeRecords(db, clock) {
  let generation = 0; // bumps whenever the set of approved records changes (approve / void); keys the measured cache
  const iso = () => new Date(clock()).toISOString();
  const today = () => iso().slice(0, 10);
  const inPlant = (user, plant) => user.plant === 'all' || user.plant === plant;
  const canReview = (user, row) => M.reviewableForms(user).includes(row.type) && inPlant(user, row.plant) && row.submitted_by !== user.id;

  const SELECT = `SELECT r.*, s.username AS s_user, s.display_name AS s_name, v.username AS v_user
    FROM records r JOIN users s ON s.id = r.submitted_by LEFT JOIN users v ON v.id = r.reviewed_by`;
  const pub = (row, user) => ({
    id: row.id, type: row.type, formLabel: M.FORMS[row.type] ? M.FORMS[row.type].label : row.type, plant: row.plant, date: row.date,
    data: JSON.parse(row.data), flags: JSON.parse(row.flags), status: row.status,
    submittedBy: row.s_user, submittedByName: row.s_name, submittedAt: row.submitted_at,
    reviewedBy: row.v_user || null, reviewedAt: row.reviewed_at, reviewNote: row.review_note, version: row.version,
    canReview: !!user && row.status === 'submitted' && canReview(user, row),
    canVoid: !!user && row.status === 'approved' && canReview(user, row),
  });
  const byId = id => db.prepare(`${SELECT} WHERE r.id = ?`).get(id);

  function submit(user, body) {
    const allowed = M.formsFor(user);
    if (!allowed.length) throw new HttpError(403, 'Your account cannot enter records. Ask an administrator to set your department.');
    const { errors, record } = M.validateRecord(body, today());
    if (errors.length) throw new HttpError(422, 'Please correct the highlighted values; nothing was saved.', { errors });
    if (!allowed.includes(record.type)) throw new HttpError(403, 'This form belongs to another department.');
    if (!inPlant(user, record.plant)) throw new HttpError(403, `You can only enter records for plant ${user.plant}.`);

    const history = db.prepare("SELECT data FROM records WHERE type = ? AND plant = ? AND status = 'approved' ORDER BY date DESC, id DESC LIMIT 30")
      .all(record.type, record.plant).map(r => JSON.parse(r.data));
    const flags = M.outlierFlags(record.type, record.data, history);
    const now = iso();
    try {
      const id = tx(db, () => {
        const r = db.prepare('INSERT INTO records (type, plant, date, dkey, data, flags, status, submitted_by, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(record.type, record.plant, record.date, record.dkey, JSON.stringify(record.data), JSON.stringify(flags), 'submitted', user.id, now);
        const newId = Number(r.lastInsertRowid);
        audit.append(db, { ts: now, user, action: 'record.submit', target: `R${newId}`, detail: { type: record.type, plant: record.plant, date: record.date, flags: flags.length, msg: `${M.FORMS[record.type].label} for ${record.plant} on ${record.date} submitted` } });
        return newId;
      });
      return pub(byId(id), user);
    } catch (e) {
      if (/UNIQUE constraint failed/.test(String(e.message))) {
        const dup = db.prepare("SELECT id FROM records WHERE type = ? AND plant = ? AND dkey = ? AND status IN ('submitted','approved')").get(record.type, record.plant, record.dkey);
        throw new HttpError(409, `This was already entered (record R${dup ? dup.id : '?'}). If that one is wrong, ask your head to void it, then enter it again.`);
      }
      throw e;
    }
  }

  function review(user, id, body) {
    const row = byId(id);
    if (!row) throw new HttpError(404, 'No such record.');
    if (!M.reviewableForms(user).includes(row.type) || !inPlant(user, row.plant)) throw new HttpError(403, 'You cannot review this department\'s records.');
    if (row.submitted_by === user.id) throw new HttpError(403, 'You cannot review your own record. Another approver must check it.');
    const d = body && Object.prototype.hasOwnProperty.call(DECISIONS, body.decision) ? DECISIONS[body.decision] : null;
    if (!d) throw new HttpError(422, 'Decision must be approve, reject or void.');
    if (!Number.isInteger(body.version) || body.version !== row.version) throw new HttpError(409, 'Someone else changed this record. Here is the latest copy.', { record: pub(row, user) });
    if (row.status !== d.from) throw new HttpError(422, `Only ${d.from} records can be ${d.to}.`);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
    if (body.decision !== 'approve' && note.length < 3) throw new HttpError(422, 'Give a reason (at least 3 characters).');
    const now = iso();
    tx(db, () => {
      const r = db.prepare('UPDATE records SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ?, version = version + 1 WHERE id = ? AND version = ?')
        .run(d.to, user.id, now, note || null, id, row.version);
      if (r.changes !== 1) throw new HttpError(409, 'Someone else changed this record. Reload and try again.');
      audit.append(db, { ts: now, user, action: `record.${body.decision}`, target: `R${id}`, detail: { type: row.type, plant: row.plant, date: row.date, note: note || undefined, msg: `${M.FORMS[row.type] ? M.FORMS[row.type].label : row.type} R${id} ${d.to}${note ? `: ${note}` : ''}` } });
    });
    if (body.decision !== 'reject') generation++;
    return pub(byId(id), user);
  }

  function list(user, query) {
    const scope = query.get('scope') || 'mine';
    const status = query.get('status');
    const type = query.get('type');
    const limit = Math.min(200, Math.max(1, Number.parseInt(query.get('limit') || '100', 10) || 100));
    if (!['mine', 'queue', 'all'].includes(scope)) throw new HttpError(400, 'scope must be mine, queue or all.');
    if (status && !STATUSES.includes(status)) throw new HttpError(400, `status must be one of ${STATUSES.join(', ')}.`);
    if (type && !Object.prototype.hasOwnProperty.call(M.FORMS, type)) throw new HttpError(400, 'Unknown form type.');
    const where = [], args = [];
    if (scope === 'mine' || (scope === 'all' && user.role === 'operator')) { where.push('r.submitted_by = ?'); args.push(user.id); } else {
      const forms = scope === 'queue' ? M.reviewableForms(user) : [...new Set([...M.formsFor(user), ...M.reviewableForms(user)])];
      if (!forms.length) return [];
      where.push(`r.type IN (${forms.map(() => '?').join(',')})`); args.push(...forms);
      if (user.plant !== 'all') { where.push('r.plant = ?'); args.push(user.plant); }
      if (scope === 'queue') { where.push("r.status = 'submitted'", 'r.submitted_by <> ?'); args.push(user.id); }
    }
    if (status) { where.push('r.status = ?'); args.push(status); }
    if (type) { where.push('r.type = ?'); args.push(type); }
    return db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY r.date DESC, r.id DESC LIMIT ?`).all(...args, limit).map(r => pub(r, user));
  }

  /** Approved records for KPI computation: the period window plus all cost rates (standing figures). */
  function approvedSince(from) {
    return db.prepare("SELECT id, type, plant, date, data FROM records WHERE status = 'approved' AND (date >= ? OR type = 'cost_rates')").all(from)
      .map(r => ({ id: r.id, type: r.type, plant: r.plant, date: r.date, data: JSON.parse(r.data) }));
  }

  function pendingFor(user) {
    const forms = M.reviewableForms(user);
    if (!forms.length) return 0;
    const args = [...forms, user.id];
    let sql = `SELECT COUNT(*) AS n FROM records WHERE status = 'submitted' AND type IN (${forms.map(() => '?').join(',')}) AND submitted_by <> ?`;
    if (user.plant !== 'all') { sql += ' AND plant = ?'; args.push(user.plant); }
    return db.prepare(sql).get(...args).n;
  }

  return { submit, review, list, approvedSince, pendingFor, generation: () => generation };
}

module.exports = { makeRecords };
