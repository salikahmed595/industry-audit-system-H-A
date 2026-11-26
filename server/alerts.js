'use strict';
/* In-app alerts for high and medium priority findings, shown in the admin panel (no e-mail, no outside service).
 * - Source: measured findings from APPROVED records (js/measure.js), per plant. Red status = HIGH, amber = MEDIUM.
 * - Routing: the CEO, finance and admin see every alert; a plant head sees their plant; a department manager sees
 *   their department in their plant. Operators and data feeds do not read dashboards.
 * - One live alert per KPI and plant (database-enforced). It updates when the numbers change, escalates from
 *   medium to high (and reopens if it had been acknowledged), and resolves itself when the KPI is back on target.
 * - A sweep runs whenever the approved record set or the day has changed (lazily on dashboard load) and daily from
 *   the cron entry point. Raised/resolved counts and every acknowledgement go into the audit log. */
const M = require('../js/measure.js');
const D = require('../js/data.js');
const audit = require('./audit');
const { HttpError } = require('./errors');

const SEVERITY = { bad: 'high', warn: 'medium' };
const SEE_ALL = ['ceo', 'finance', 'admin'];
const STAMP_KEY = 'alerts_stamp';
const LIST_MAX = 300;

const num = v => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : String(+v.toFixed(Math.abs(v) >= 10 ? 1 : 2)));
const unitOf = u => (!u ? '' : u.startsWith('%') ? u : ` ${u}`);
const plantName = p => (D.PLANTS.find(x => x.id === p) || {}).short || p;

/** SQL condition (and args) for the alerts a user may see. */
function scope(user) {
  if (SEE_ALL.includes(user.role) || user.role === 'plant') return user.plant === 'all' ? ['1 = 1', []] : ['a.plant = ?', [user.plant]];
  if (user.role === 'dept' && user.department) return user.plant === 'all' ? ['a.sec = ?', [user.department]] : ['a.sec = ? AND a.plant = ?', [user.department, user.plant]];
  return ['0 = 1', []];
}

function makeAlerts(db, clock, { records, usage }) {
  const iso = () => new Date(clock()).toISOString();

  function wanted(recs, day) {
    const want = new Map();
    for (const plant of M.PLANT_IDS) {
      const out = M.measureAll(recs, { plant, period: 'm', today: day });
      for (const f of out.findings) {
        const severity = SEVERITY[f.status];
        if (!severity) continue;
        const u = unitOf(f.unit), q = f.quant || {};
        want.set(`${f.key}|${plant}`, {
          kpi: f.key, sec: f.sec, plant, severity,
          title: `${f.name} in ${plantName(plant)}: ${num(f.value)}${u} against a target of ${num(f.target)}${u}`,
          detail: {
            value: f.value, target: f.target, unit: f.unit, dir: f.dir, status: f.status, n: f.n,
            pkr: q.pkr ?? null, pkrWhat: q.pkrWhat ?? null, cash: q.cash ?? null, hours: q.hours ?? null, kg: q.kg ?? null, lb: q.lb ?? null,
            why: `${f.name} measured ${num(f.value)}${u} from ${f.n} approved record${f.n === 1 ? '' : 's'} in the last 30 days, against a target of ${num(f.target)}${u}: ${severity === 'high' ? 'red zone, so HIGH priority' : 'amber zone, so MEDIUM priority'}.`,
            steps: (q.steps || []).slice(0, 8),
          },
        });
      }
    }
    return want;
  }

  /** Bring the alert table in line with the current measured findings. Cheap no-op if nothing changed since the last sweep. */
  async function sweep({ force = false } = {}) {
    const day = iso().slice(0, 10);
    const stamp = `${await records.generation()}|${day}`;
    if (!force) {
      const s = await db.get('SELECT v FROM settings WHERE k = ?', [STAMP_KEY]);
      if (s && s.v === stamp) return { swept: false, opened: 0, resolved: 0, updated: 0 };
    }
    const t0 = performance.now();
    const recs = await records.approvedSince(M.windowFor('m', day).from);
    const t1 = performance.now();
    const want = wanted(recs, day);
    const t2 = performance.now();
    const res = await db.tx(async t => {
      if (!force) {
        const s = await t.get('SELECT v FROM settings WHERE k = ?', [STAMP_KEY]);
        if (s && s.v === stamp) return null; // another instance swept first
      }
      const now = iso();
      const live = await t.all("SELECT * FROM alerts WHERE status IN ('open', 'acknowledged')");
      const byKey = new Map(live.map(a => [a.dedupe, a]));
      let opened = 0, resolved = 0, updated = 0;
      for (const [key, w] of want) {
        const a = byKey.get(key);
        const detail = JSON.stringify(w.detail);
        if (!a) {
          await t.run(`INSERT INTO alerts (dedupe, kpi, sec, plant, severity, status, title, detail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
            [key, w.kpi, w.sec, w.plant, w.severity, w.title, detail, now, now]);
          opened++;
          continue;
        }
        if (a.severity === w.severity && a.detail === detail && a.title === w.title) continue;
        const escalated = a.severity === 'medium' && w.severity === 'high';
        await t.run(`UPDATE alerts SET severity = ?, title = ?, detail = ?, updated_at = ?, version = version + 1,
          status = CASE WHEN ? THEN 'open' ELSE status END, ack_by = CASE WHEN ? THEN NULL ELSE ack_by END, ack_at = CASE WHEN ? THEN NULL ELSE ack_at END WHERE id = ?`,
        [w.severity, w.title, detail, now, escalated ? 1 : 0, escalated ? 1 : 0, escalated ? 1 : 0, a.id]);
        updated++;
      }
      for (const a of live) {
        if (want.has(a.dedupe)) continue;
        await t.run("UPDATE alerts SET status = 'resolved', resolved_at = ?, updated_at = ?, version = version + 1 WHERE id = ?", [now, now, a.id]);
        resolved++;
      }
      await t.run('INSERT INTO settings (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at', [STAMP_KEY, stamp, now]);
      if (opened || resolved) {
        await audit.append(t, { ts: now, user: null, action: 'alert.sweep', target: null, detail: { opened, resolved, msg: `Alerts: ${opened} raised, ${resolved} resolved (KPIs back on target)` } });
      }
      return { swept: true, opened, resolved, updated };
    });
    await usage.log('audit_cycle', { ms: performance.now() - t0, gatherMs: t1 - t0, computeMs: t2 - t1, detail: { trigger: 'alerts', records: recs.length } });
    return res || { swept: false, opened: 0, resolved: 0, updated: 0 };
  }

  const SELECT = 'SELECT a.*, u.username AS ack_user FROM alerts a LEFT JOIN users u ON u.id = a.ack_by';
  const pub = a => ({
    id: a.id, kpi: a.kpi, name: a.kpi.split('|')[1], sec: a.sec, plant: a.plant, severity: a.severity, status: a.status, title: a.title,
    detail: JSON.parse(a.detail), createdAt: a.created_at, updatedAt: a.updated_at, ackBy: a.ack_user || null, ackAt: a.ack_at, resolvedAt: a.resolved_at, version: a.version,
  });

  async function list(user, { status = 'open' } = {}) {
    const [cond, args] = scope(user);
    const live = status !== 'all';
    const rows = await db.all(`${SELECT} WHERE ${cond}${live ? " AND a.status IN ('open', 'acknowledged')" : ''}
      ORDER BY CASE a.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END, CASE a.severity WHEN 'high' THEN 0 ELSE 1 END, a.id DESC LIMIT ${LIST_MAX}`, args);
    return rows.map(pub);
  }
  async function counts(user) {
    const [cond, args] = scope(user);
    const rows = await db.all(`SELECT a.severity, COUNT(*) AS n FROM alerts a WHERE ${cond} AND a.status = 'open' GROUP BY a.severity`, args);
    const c = { high: 0, medium: 0 };
    for (const r of rows) c[r.severity] = r.n;
    return c;
  }
  async function acknowledge(user, id) {
    const [cond, args] = scope(user);
    return db.tx(async t => {
      const a = await t.get(`${SELECT} WHERE a.id = ? AND ${cond}`, [id, ...args]);
      if (!a) throw new HttpError(404, 'No such alert.');
      if (a.status === 'resolved') throw new HttpError(409, 'This alert has already resolved itself: the KPI is back on target.', { alert: pub(a) });
      if (a.status === 'open') {
        const now = iso();
        await t.run("UPDATE alerts SET status = 'acknowledged', ack_by = ?, ack_at = ?, updated_at = ?, version = version + 1 WHERE id = ?", [user.id, now, now, id]);
        await audit.append(t, { ts: now, user, action: 'alert.acknowledged', target: `alert:${id}`, detail: { msg: `${user.username} acknowledged: ${a.title}` } });
      }
      return pub(await t.get(`${SELECT} WHERE a.id = ?`, [id]));
    });
  }
  /** Counts for a report period. */
  async function periodStats(fromIso) {
    const open = await db.all("SELECT severity, COUNT(*) AS n FROM alerts WHERE status IN ('open', 'acknowledged') GROUP BY severity");
    const o = { high: 0, medium: 0 };
    for (const r of open) o[r.severity] = r.n;
    const raised = (await db.get('SELECT COUNT(*) AS n FROM alerts WHERE created_at >= ?', [fromIso])).n;
    const resolved = (await db.get('SELECT COUNT(*) AS n FROM alerts WHERE resolved_at >= ?', [fromIso])).n;
    return { openHigh: o.high, openMedium: o.medium, raised, resolved };
  }

  return { sweep, list, counts, acknowledge, periodStats };
}

module.exports = { makeAlerts };
