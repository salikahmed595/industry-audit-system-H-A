'use strict';
/* Usage & cost dashboard: what the system spends, stores and computes.
 * - LLM API cost: this system calls no external AI / LLM. Every finding comes from deterministic statistics and OCR
 *   runs locally, so the cost is 0. Any future AI call must be logged with kind 'llm' and its cost, and shows here.
 * - Storage: bytes held per category (data, audit files, reports, computations), measured from the database itself.
 * - Audit cycles: each full recalculation (gather approved records -> compute KPIs, findings, impact) is timed.
 * - Lead time: how long a record waits between being entered and being approved (data gathering -> counted).
 * Writing a usage event never fails the request that caused it. */

const LLM_NOTE = 'No external AI / LLM API is called. Findings come from deterministic statistics on approved records, and photos are read by Tesseract OCR running on this server. Any future AI call would be logged here with its cost.';
const CATEGORIES = [
  ['Data', 'Department records, live-feed KPI values and corrective actions', ['records', 'kpi_values', 'actions']],
  ['Audit files', 'Ledger and checklist photos with their OCR text, and the tamper-evident audit log', ['documents', 'audit_log']],
  ['Reports', 'Scheduled and on-demand report summaries', ['reports']],
  ['Computations', 'Alerts and the timing of every audit cycle, report and OCR run', ['alerts', 'usage_events']],
  ['System', 'Users, sessions, sign-in throttling and settings', ['users', 'sessions', 'login_throttle', 'meta', 'settings']],
];
const KINDS = ['audit_cycle', 'report', 'ocr', 'llm'];
const KEEP_DAYS = 400;

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const r1 = v => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

function makeUsage(db, clock) {
  const iso = () => new Date(clock()).toISOString();

  /** Record one event. Errors are logged, never thrown: usage tracking must not break the work it measures. */
  async function log(kind, { ms, gatherMs = 0, computeMs = 0, bytes = 0, costUsd = 0, detail = {} } = {}) {
    if (!KINDS.includes(kind)) throw new Error(`unknown usage kind ${kind}`);
    const ts = iso();
    try {
      await db.run('INSERT INTO usage_events (ts, day, kind, ms, gather_ms, compute_ms, bytes, cost_usd, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [ts, ts.slice(0, 10), kind, Math.max(0, Math.round(ms || 0)), Math.max(0, Math.round(gatherMs)), Math.max(0, Math.round(computeMs)), Math.max(0, Math.round(bytes)), Number(costUsd) || 0, JSON.stringify(detail).slice(0, 2000)]);
    } catch (e) {
      console.error(`[${ts}] usage event not recorded: ${e.message}`);
    }
  }

  /** Bytes of stored values per table (sum of value lengths; blobs count their real size). Table names are constants. */
  async function tableBytes(table) {
    const cols = (await db.all(`PRAGMA table_info(${table})`)).map(c => c.name);
    if (!cols.length) return { rows: 0, bytes: 0 };
    const expr = cols.map(c => `COALESCE(LENGTH(CAST("${c.replace(/"/g, '')}" AS BLOB)), 0)`).join(' + ');
    const r = await db.get(`SELECT COUNT(*) AS rows, COALESCE(SUM(${expr}), 0) AS bytes FROM ${table}`);
    return { rows: r.rows, bytes: r.bytes };
  }

  async function storage() {
    const categories = [];
    for (const [name, what, tables] of CATEGORIES) {
      const per = [];
      for (const t of tables) per.push({ table: t, ...(await tableBytes(t)) });
      categories.push({ name, what, bytes: per.reduce((s, x) => s + x.bytes, 0), rows: per.reduce((s, x) => s + x.rows, 0), tables: per });
    }
    let fileBytes = null;
    try {
      const pc = await db.get('PRAGMA page_count'), ps = await db.get('PRAGMA page_size');
      fileBytes = Object.values(pc)[0] * Object.values(ps)[0];
    } catch { /* not available on every host */ }
    return { categories, totalBytes: categories.reduce((s, c) => s + c.bytes, 0), fileBytes, note: 'Bytes of stored values per category. The database file also holds indexes and free pages (file size).' };
  }

  async function summary(days = 30) {
    const today = iso().slice(0, 10);
    const from = addDays(today, -(days - 1));
    const series = [];
    for (let d = from; d <= today; d = addDays(d, 1)) series.push(d);

    const cyc = await db.all(`SELECT day, COUNT(*) AS count, AVG(ms) AS avg_ms, MAX(ms) AS max_ms, AVG(gather_ms) AS gather_ms, AVG(compute_ms) AS compute_ms
      FROM usage_events WHERE kind IN ('audit_cycle', 'report') AND day >= ? GROUP BY day`, [from]);
    const cycBy = new Map(cyc.map(r => [r.day, r]));
    const cycleDays = series.map(day => {
      const r = cycBy.get(day);
      return { day, count: r ? r.count : 0, avgMs: r ? r1(r.avg_ms) : 0, maxMs: r ? r.max_ms : 0, gatherMs: r ? r1(r.gather_ms) : 0, computeMs: r ? r1(r.compute_ms) : 0 };
    });
    const allCyc = await db.all("SELECT ms FROM usage_events WHERE kind IN ('audit_cycle', 'report') AND day >= ?", [from]);

    const llmRows = await db.all("SELECT day, COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS cost FROM usage_events WHERE kind = 'llm' AND day >= ? GROUP BY day", [from]);
    const llmBy = new Map(llmRows.map(r => [r.day, r]));
    const llm = {
      calls: llmRows.reduce((s, r) => s + r.calls, 0), costUsd: Math.round(llmRows.reduce((s, r) => s + r.cost, 0) * 100) / 100, note: LLM_NOTE,
      days: series.map(day => ({ day, calls: llmBy.has(day) ? llmBy.get(day).calls : 0, costUsd: llmBy.has(day) ? llmBy.get(day).cost : 0 })),
    };
    const ocr = await db.get("SELECT COUNT(*) AS runs, AVG(ms) AS avg_ms, COALESCE(SUM(bytes), 0) AS bytes FROM usage_events WHERE kind = 'ocr' AND day >= ?", [from]);
    const rep = await db.get("SELECT COUNT(*) AS n, AVG(ms) AS avg_ms FROM usage_events WHERE kind = 'report' AND day >= ?", [from]);

    // Record lead time: entered (submitted_at) -> decided (reviewed_at), for decisions in the window.
    const dec = await db.all("SELECT submitted_at, reviewed_at, status FROM records WHERE reviewed_at IS NOT NULL AND reviewed_at >= ?", [`${from}T00:00:00.000Z`]);
    const hours = dec.map(r => (Date.parse(r.reviewed_at) - Date.parse(r.submitted_at)) / 36e5).filter(h => h >= 0);
    const waiting = await db.get("SELECT COUNT(*) AS n, MIN(submitted_at) AS oldest FROM records WHERE status = 'submitted'");

    return {
      period: { from, to: today, days },
      llm,
      storage: await storage(),
      cycles: {
        days: cycleDays, total: allCyc.length, avgMs: r1(allCyc.length ? allCyc.reduce((s, r) => s + r.ms, 0) / allCyc.length : 0), p95Ms: pct(allCyc.map(r => r.ms), 0.95),
        what: 'One audit cycle gathers the approved records and computes every KPI, finding and quantified impact (dashboard recalculation, alert sweep or report).',
      },
      ocr: { runs: ocr.runs, avgMs: r1(ocr.avg_ms) || 0, bytes: ocr.bytes },
      reports: { generated: rep.n, avgMs: r1(rep.avg_ms) || 0 },
      records: { decided: dec.length, leadTime: { medianHours: r1(median(hours)), p90Hours: r1(pct(hours, 0.9)), what: 'Hours from a record being entered to its approval or rejection.' }, waiting: waiting.n, oldestWaiting: waiting.oldest },
    };
  }

  /** Daily housekeeping: usage events older than KEEP_DAYS are summarised away. */
  async function prune() {
    const cutoff = addDays(iso().slice(0, 10), -KEEP_DAYS);
    return (await db.run('DELETE FROM usage_events WHERE day < ?', [cutoff])).changes;
  }

  return { log, summary, storage, prune };
}

module.exports = { makeUsage, LLM_NOTE };
