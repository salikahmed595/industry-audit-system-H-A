'use strict';
/* KPI ingestion from ERP / MES / QC feeds. Whole batch is validated first; any bad record rejects
 * the batch (nothing half-written). Values are append-only; the dashboard reads the latest per KPI. */
const D = require('../js/data.js');
const { HttpError } = require('./errors');
const audit = require('./audit');

const SOURCE_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/;
const MAX_RECORDS = 500;
const INSERT_CHUNK = 100; // 7 values per row: 700 bound values per statement, far under SQLite's limit
const MAX_AGE_MS = 400 * 864e5;
const FUTURE_SKEW_MS = 5 * 60e3;
const KPI_NAMES = new Map(Object.entries(D.SECTIONS).map(([id, s]) => [id, new Set(s.kpis.map(k => k[0]))]));

function validate(body, nowMs) {
  if (!body || typeof body.source !== 'string' || !SOURCE_RE.test(body.source)) {
    throw new HttpError(422, 'Invalid batch.', { errors: [{ index: null, error: 'source must be 1-64 letters, digits, space, dot, dash or underscore' }] });
  }
  const recs = body.records;
  if (!Array.isArray(recs) || recs.length === 0 || recs.length > MAX_RECORDS) {
    throw new HttpError(422, 'Invalid batch.', { errors: [{ index: null, error: `records must be an array of 1-${MAX_RECORDS} items` }] });
  }
  const errors = [], clean = [];
  recs.forEach((r, index) => {
    const err = e => errors.push({ index, error: e });
    if (!r || typeof r !== 'object') return err('record must be an object');
    if (!KPI_NAMES.has(r.section)) return err('unknown section');
    if (typeof r.kpi !== 'string' || !KPI_NAMES.get(r.section).has(r.kpi)) return err('unknown KPI for this section');
    if (typeof r.value !== 'number' || !Number.isFinite(r.value) || r.value < 0 || r.value >= 1e12) return err('value must be a number from 0 to 1e12');
    if (typeof r.asOf !== 'string' || !ISO_RE.test(r.asOf) || Number.isNaN(Date.parse(r.asOf))) return err('asOf must be an ISO 8601 date/time');
    const t = Date.parse(r.asOf);
    if (t > nowMs + FUTURE_SKEW_MS) return err('asOf is in the future');
    if (t < nowMs - MAX_AGE_MS) return err('asOf is more than 400 days old');
    clean.push({ section: r.section, kpi: r.kpi, value: r.value, asOf: new Date(t).toISOString() });
  });
  if (errors.length) throw new HttpError(422, 'Batch rejected; nothing was stored.', { errors });
  return { source: body.source, records: clean };
}

function makeKpis(db, clock) {
  async function ingest(user, body) {
    const { source, records } = validate(body, clock());
    const now = new Date(clock()).toISOString();
    return db.tx(async t => {
      // Multi-row INSERTs: on Turso every statement is a network round trip inside an open write transaction,
      // so 500 single-row INSERTs would hold the database's write lock for seconds.
      for (let i = 0; i < records.length; i += INSERT_CHUNK) {
        const chunk = records.slice(i, i + INSERT_CHUNK);
        await t.run(`INSERT INTO kpi_values (section, kpi, value, as_of, source, ingested_at, ingested_by) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          chunk.flatMap(r => [r.section, r.kpi, r.value, r.asOf, source, now, user.id]));
      }
      await audit.append(t, { ts: now, user, action: 'kpi.ingest', target: null, detail: { source, count: records.length, msg: `${records.length} KPI value(s) ingested from ${source}` } });
      return { accepted: records.length };
    });
  }

  async function latest() {
    return (await db.all(`SELECT section, kpi, value, as_of AS asOf, source, ingested_at AS ingestedAt FROM kpi_values k
      WHERE id = (SELECT id FROM kpi_values WHERE section = k.section AND kpi = k.kpi ORDER BY as_of DESC, id DESC LIMIT 1)
      ORDER BY section, kpi`)).map(r => ({ ...r }));
  }

  return { ingest, latest };
}

module.exports = { makeKpis, validate };
