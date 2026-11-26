// Integration tests for the automation features: in-app alerts, scheduled CEO report summaries, the daily cron
// entry point, the usage & cost dashboard and OCR of ledger photos. Real HTTP server + real SQLite + real local
// Tesseract, no mocks. Every time-dependent step uses the injected clock.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PW = 'correct horse battery 9';
const SECRET = 'cron-secret-for-tests-0123456789';
let now = Date.parse('2026-11-25T09:00:00Z');
const clock = () => now;
const DAY = 864e5;
const isoDay = t => new Date(t).toISOString().slice(0, 10);

async function req(base, p, { method = 'GET', body, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null; try { json = JSON.parse(buf.toString('utf8')); } catch { /* not json */ }
  return { status: r.status, json, buf, headers: r.headers };
}

describe('Automation: alerts, reports, cron, usage, OCR (integration)', () => {
  let app, base;
  const C = {};
  const as = (who, p, opts) => req(base, p, { ...opts, cookie: C[who] });
  async function enter(maker, checker, rec) {
    const s = await as(maker, '/api/records', { method: 'POST', body: rec });
    assert.equal(s.status, 201, JSON.stringify(s.json));
    const r = await as(checker, `/api/records/${s.json.record.id}/review`, { method: 'POST', body: { decision: 'approve', note: '', version: s.json.record.version } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    return r.json.record;
  }
  let names = [];
  async function signInAll() {
    for (const u of names) {
      const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: PW }) });
      assert.equal(r.status, 200, `login ${u}`);
      C[u] = (r.headers.get('set-cookie') || '').split(';')[0];
    }
  }
  /** Move the clock forward; sessions last 12 hours, so everyone signs in again. */
  async function advance(days) { now += days * DAY; await signInAll(); }
  const spin = (date, yarn, o = {}) => ({ type: 'spin_shift', plant: 'FSD', date, data: { shift: 'A', machine: `RF-${date.slice(8)}`, cotton_kg: 1000, yarn_kg: yarn, waste_total_kg: 1000 - yarn - 10, ...o } });

  before(async () => {
    app = await createApp({ dbPath: ':memory:', clock, cronSecret: SECRET });
    const people = [
      ['ceo', 'ceo', 'all', null], ['admin', 'admin', 'all', null], ['cfo', 'finance', 'all', null], ['fin.op', 'operator', 'GRP', 'finance'],
      ['fsd.plant', 'plant', 'FSD', null], ['khi.plant', 'plant', 'KHI', null],
      ['spin.head', 'dept', 'FSD', 'spinning'], ['spin.op', 'operator', 'FSD', 'spinning'], ['sew.head', 'dept', 'KHI', 'sewing'],
    ];
    for (const [username, role, plant, department] of people) await app.users.create({ username, displayName: username, role, plant, department, password: PW });
    base = await app.listen(0);
    names = people.map(p => p[0]);
    await signInAll();
    // Yarn yield 80% against a 91% target: more than 5% short, so red (HIGH), at finance's cotton rate.
    for (let i = 0; i < 3; i++) await enter('spin.op', 'spin.head', spin(isoDay(now - i * DAY), 800));
    await enter('fin.op', 'cfo', { type: 'cost_rates', plant: 'GRP', date: '2026-11-01', data: { cotton_pkr_kg: 500 } });
  });
  after(() => app.close());

  describe('alerts for high and medium findings', () => {
    let alert;
    it('raises a HIGH alert for a red measured finding, with the money and the reason', async () => {
      const r = await as('ceo', '/api/alerts');
      assert.equal(r.status, 200);
      alert = r.json.alerts.find(a => a.kpi === 'spinning|Yarn yield' && a.plant === 'FSD');
      assert.ok(alert, JSON.stringify(r.json.alerts.map(a => a.kpi)));
      assert.equal(alert.severity, 'high');
      assert.equal(alert.status, 'open');
      assert.ok(alert.detail.pkr > 0, 'PKR at risk from the cost rate');
      assert.match(alert.detail.why, /80%/);
      assert.ok(r.json.counts.high >= 1);
    });
    it('routes to the department manager and plant head, not to other departments or plants', async () => {
      const has = async who => (await as(who, '/api/alerts')).json.alerts.some(a => a.id === alert.id);
      assert.equal(await has('spin.head'), true);
      assert.equal(await has('fsd.plant'), true);
      assert.equal(await has('cfo'), true);
      assert.equal(await has('sew.head'), false);
      assert.equal(await has('khi.plant'), false);
      assert.equal((await as('spin.op', '/api/alerts')).status, 403, 'operators enter data; they do not read dashboards');
    });
    it('never duplicates an alert that is still open', async () => {
      const a = (await as('ceo', '/api/alerts')).json.alerts.filter(x => x.kpi === alert.kpi && x.plant === 'FSD');
      const b = (await as('ceo', '/api/alerts')).json.alerts.filter(x => x.kpi === alert.kpi && x.plant === 'FSD');
      assert.equal(a.length, 1);
      assert.deepEqual(a.map(x => x.id), b.map(x => x.id));
    });
    it('the owner acknowledges it; someone who cannot see it cannot', async () => {
      assert.equal((await as('sew.head', `/api/alerts/${alert.id}/ack`, { method: 'POST', body: {} })).status, 404);
      const r = await as('spin.head', `/api/alerts/${alert.id}/ack`, { method: 'POST', body: {} });
      assert.equal(r.status, 200);
      assert.equal(r.json.alert.status, 'acknowledged');
      assert.equal(r.json.alert.ackBy, 'spin.head');
      const log = (await as('ceo', '/api/audit')).json.entries;
      assert.ok(log.some(e => e.target === `alert:${alert.id}` && /acknowledged/.test(e.e) && e.u === 'spin.head'));
    });
    it('resolves itself once approved records put the KPI back on target', async () => {
      for (let i = 3; i < 33; i++) await enter('spin.op', 'spin.head', spin(isoDay(now - (i % 29) * DAY), 960, { machine: `RF-G${i}` }));
      const r = await as('ceo', '/api/alerts?status=all');
      const a = r.json.alerts.find(x => x.id === alert.id);
      assert.equal(a.status, 'resolved');
      assert.ok(a.resolvedAt);
      assert.ok(!(await as('ceo', '/api/alerts')).json.alerts.some(x => x.id === alert.id), 'resolved alerts leave the open list');
    });
  });

  describe('scheduled report summary in the admin panel', () => {
    let first;
    it('is weekly by default and catches up by itself when one is due', async () => {
      const r = await as('ceo', '/api/reports');
      assert.equal(r.status, 200);
      assert.equal(r.json.schedule, 'weekly');
      assert.equal(r.json.reports.length, 1);
      first = r.json.reports[0];
      assert.equal(first.kind, 'scheduled');
      assert.equal(first.to, '2026-11-25');
      assert.equal(first.from, '2026-11-19');
      assert.ok(first.headline.length > 10);
      assert.equal((await as('ceo', '/api/reports')).json.reports.length, 1, 'no duplicate on the same day');
    });
    it('carries the quantified findings, alerts, actions and coverage', async () => {
      const r = await as('cfo', `/api/reports/${first.id}`);
      assert.equal(r.status, 200);
      const s = r.json.report.summary;
      assert.ok(s.coverage && typeof s.coverage.pct === 'number');
      assert.ok(s.totals && 'pkr' in s.totals);
      assert.ok(Array.isArray(s.topFindings));
      for (const f of s.topFindings) assert.ok(f.quant && f.quant.steps.length >= 1, 'every number explains itself');
      assert.ok(s.alerts && 'openHigh' in s.alerts && 'resolved' in s.alerts);
      assert.ok(s.actions && s.actions.byStage);
      assert.ok(s.records && s.records.approved >= 30);
    });
    it('measures the same rolling 30 days as the dashboard and the alerts, so monthly and older records still count in a weekly report', async () => {
      const s = (await as('ceo', `/api/reports/${first.id}`)).json.report.summary;
      const dash = (await as('ceo', '/api/measured?plant=all&period=m')).json;
      assert.equal(s.coverage.records, dash.coverage.records, 'same approved records as the 30-day dashboard');
      assert.equal(s.coverage.pct, dash.coverage.pct);
      assert.equal(s.findingsCount, dash.findings.length);
      assert.equal(s.period.days, 7, 'activity (records approved, alerts, fixes) still covers the report period');
    });
    it('is only for the CEO, finance and the admin panel', async () => {
      assert.equal((await as('spin.head', '/api/reports')).status, 403);
      assert.equal((await as('fsd.plant', `/api/reports/${first.id}`)).status, 403);
    });
    it('the next weekly report is due 7 days later, not before', async () => {
      await advance(6);
      assert.equal((await as('ceo', '/api/reports')).json.reports.length, 1);
      await advance(1);
      const r = await as('ceo', '/api/reports');
      assert.equal(r.json.reports.length, 2);
      assert.equal(r.json.reports[0].to, isoDay(now));
    });
    it('the CEO or admin can switch to every two weeks or off; others cannot; bad values are refused', async () => {
      assert.equal((await as('cfo', '/api/reports/schedule', { method: 'POST', body: { schedule: 'biweekly' } })).status, 403);
      assert.equal((await as('ceo', '/api/reports/schedule', { method: 'POST', body: { schedule: 'hourly' } })).status, 400);
      const r = await as('ceo', '/api/reports/schedule', { method: 'POST', body: { schedule: 'biweekly' } });
      assert.equal(r.status, 200);
      assert.equal(r.json.schedule, 'biweekly');
      await advance(7);
      assert.equal((await as('ceo', '/api/reports')).json.reports.length, 2, 'biweekly: not due after 7 days');
      await advance(7);
      const two = (await as('ceo', '/api/reports')).json.reports;
      assert.equal(two.length, 3);
      assert.equal(two[0].from, isoDay(now - 13 * DAY), 'a two-week report covers 14 days');
      assert.ok((await as('ceo', '/api/audit')).json.entries.some(e => /set the CEO report to biweekly/.test(e.e) && e.u === 'ceo'));
    });
    it('"Generate now" makes an extra report on demand', async () => {
      assert.equal((await as('spin.head', '/api/reports', { method: 'POST', body: {} })).status, 403);
      const r = await as('admin', '/api/reports', { method: 'POST', body: {} });
      assert.equal(r.status, 201);
      assert.equal(r.json.report.kind, 'manual');
    });
  });

  describe('daily cron entry point (Vercel Cron or npm run cron)', () => {
    it('refuses calls without the shared secret', async () => {
      assert.equal((await req(base, '/api/cron/daily')).status, 401);
      assert.equal((await req(base, '/api/cron/daily', { headers: { authorization: 'Bearer wrong-secret-wrong-secret-0000' } })).status, 401);
    });
    it('runs the alert sweep and any due report with the right secret', async () => {
      await as('ceo', '/api/reports/schedule', { method: 'POST', body: { schedule: 'weekly' } });
      await advance(7);
      const r = await req(base, '/api/cron/daily', { headers: { authorization: `Bearer ${SECRET}` } });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.ok(r.json.alerts);
      assert.ok(r.json.report && r.json.report.id, 'a weekly report was due');
      const again = await req(base, '/api/cron/daily', { headers: { authorization: `Bearer ${SECRET}` } });
      assert.equal(again.json.report, null, 'running twice on the same day does nothing more');
    });
    it('is switched off (503) when no CRON_SECRET is configured', async () => {
      const other = await createApp({ dbPath: ':memory:', clock });
      const b = await other.listen(0);
      try { assert.equal((await req(b, '/api/cron/daily', { headers: { authorization: 'Bearer anything-anything-anything' } })).status, 503); } finally { await other.close(); }
    });
  });

  describe('OCR of ledger and checklist photos (local Tesseract)', () => {
    const png = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'ledger-spin.png'));
    let doc;
    it('reads a photographed ledger and prefills the form for a person to check', async () => {
      const r = await as('spin.op', '/api/ocr', { method: 'POST', body: { form: 'spin_shift', image: png.toString('base64') } });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      assert.match(r.json.text, /Cotton fed/);
      assert.equal(r.json.prefill.cotton_kg, 1500);
      assert.equal(r.json.prefill.yarn_kg, 1290);
      assert.equal(r.json.prefill.waste_total_kg, 190);
      assert.ok(r.json.confidence > 50);
      assert.ok(r.json.document.id > 0);
      doc = r.json.document;
    });
    it('nothing is saved as a record: the person still submits, and a second person approves', async () => {
      const mine = (await as('spin.op', '/api/records?scope=mine&limit=100')).json.records;
      assert.ok(!mine.some(x => x.status === 'submitted'), 'OCR never submits a record by itself');
    });
    it('keeps the photo as evidence for the uploader and auditors only', async () => {
      const own = await as('spin.op', `/api/documents/${doc.id}/image`);
      assert.equal(own.status, 200);
      assert.equal(own.headers.get('content-type'), 'image/png');
      assert.ok(own.buf.equals(png));
      assert.equal((await as('ceo', `/api/documents/${doc.id}/image`)).status, 200);
      assert.equal((await as('sew.head', `/api/documents/${doc.id}/image`)).status, 404);
    });
    it('refuses anything that is not a PNG, JPEG or WebP image, whatever it claims to be', async () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      assert.equal((await as('spin.op', '/api/ocr', { method: 'POST', body: { form: 'spin_shift', image: svg.toString('base64') } })).status, 415);
      assert.equal((await as('spin.op', '/api/ocr', { method: 'POST', body: { form: 'spin_shift', image: 'not base64 !!!' } })).status, 400);
    });
    it('refuses images over the size limit', async () => {
      const big = Buffer.concat([png.subarray(0, 8), Buffer.alloc(2.6 * 1024 * 1024)]);
      const r = await as('spin.op', '/api/ocr', { method: 'POST', body: { form: 'spin_shift', image: big.toString('base64') } });
      assert.equal(r.status, 413);
    });
    it('only for forms the person may fill in', async () => {
      assert.equal((await as('spin.op', '/api/ocr', { method: 'POST', body: { form: 'finance_month', image: png.toString('base64') } })).status, 403);
    });
  });

  describe('usage & costs dashboard', () => {
    it('shows LLM cost, storage by category, audit cycles and OCR runs', async () => {
      await as('ceo', '/api/measured?plant=all&period=m');
      const r = await as('admin', '/api/usage?days=60');
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const u = r.json;
      assert.equal(u.llm.costUsd, 0);
      assert.match(u.llm.note, /no (external )?(AI|LLM)/i);
      const names = u.storage.categories.map(c => c.name);
      for (const n of ['Data', 'Audit files', 'Reports', 'Computations']) assert.ok(names.includes(n), n);
      assert.ok(u.storage.categories.find(c => c.name === 'Data').bytes > 0);
      assert.ok(u.storage.categories.find(c => c.name === 'Audit files').bytes >= 12000, 'the stored ledger photo counts');
      assert.ok(u.storage.categories.find(c => c.name === 'Reports').bytes > 0);
      assert.ok(u.cycles.days.some(d => d.count >= 1 && d.avgMs >= 0), 'audit cycles per day with time per cycle');
      assert.ok(u.cycles.days.every(d => d.day && 'gatherMs' in d && 'computeMs' in d));
      assert.ok(u.ocr.runs >= 1);
      assert.ok(u.records.leadTime && 'medianHours' in u.records.leadTime, 'time from data entry to approval');
    });
    it('is for the CEO, finance and admin only', async () => {
      assert.equal((await as('spin.head', '/api/usage')).status, 403);
    });
  });
});

describe('Daily job script (npm run cron)', () => {
  it('runs the alert sweep and the due report on the configured database, prints JSON, and is safe to run twice', async () => {
    const { execFileSync } = await import('node:child_process');
    const os = await import('node:os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ta-cron-'));
    const dbFile = path.join(dir, 'cron.db');
    const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DB_PATH: dbFile };
    try {
      const run = () => JSON.parse(execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ROOT, 'server', 'cli', 'cron.js')], { env, encoding: 'utf8' }));
      const first = run();
      assert.equal(first.ok, true);
      assert.ok(first.report && first.report.id, 'the first run writes the weekly report');
      const second = run();
      assert.equal(second.ok, true);
      assert.equal(second.report, null, 'the same day it does not write a second scheduled report');
      const { openDb } = require('../../server/db.js');
      const db = await openDb(dbFile);
      try {
        assert.equal((await db.get("SELECT COUNT(*) AS n FROM reports WHERE kind = 'scheduled'")).n, 1);
      } finally { await db.close(); }
    } finally {
      // Windows can hold the SQLite file for a moment after close; a leftover temp folder is harmless.
      try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* temp dir */ }
    }
  });
});
