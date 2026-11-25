// Integration tests for department data entry (maker-checker) and measured KPIs.
// Real HTTP server + real SQLite, no mocks.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.js');

const PW = 'correct horse battery 9';
let now = Date.parse('2026-11-25T09:00:00Z');
const clock = () => now;
const TODAY = '2026-11-25';

async function req(base, p, { method = 'GET', body, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text };
}

const spinData = (o = {}) => ({ shift: 'A', machine: 'RF-01', cotton_kg: 1000, yarn_kg: 880, waste_total_kg: 120, ...o });

describe('Department records and measured KPIs (integration)', () => {
  let app, base;
  const C = {};
  const as = (who, p, opts) => req(base, p, { ...opts, cookie: C[who] });
  const submit = (who, body) => as(who, '/api/records', { method: 'POST', body });
  const review = (who, rec, decision, note, version = rec.version) => as(who, `/api/records/${rec.id}/review`, { method: 'POST', body: { decision, note, version } });

  before(async () => {
    app = createApp({ dbPath: ':memory:', clock });
    const people = [
      ['ceo', 'ceo', 'all', null], ['fsd.plant', 'plant', 'FSD', null], ['khi.plant', 'plant', 'KHI', null],
      ['spin.head', 'dept', 'FSD', 'spinning'], ['spin.op', 'operator', 'FSD', 'spinning'], ['spin.op2', 'operator', 'FSD', 'spinning'],
      ['sew.head', 'dept', 'KHI', 'sewing'], ['cfo', 'finance', 'all', null], ['fin.op', 'operator', 'GRP', 'finance'],
      ['feed', 'integration', 'all', null], ['admin', 'admin', 'all', null], ['old.dept', 'dept', 'KHI', null],
    ];
    for (const [username, role, plant, department] of people) await app.users.create({ username, displayName: username, role, plant, department, password: PW });
    base = await app.listen(0);
    for (const [u] of people) {
      const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: PW }) });
      assert.equal(r.status, 200, `login ${u}`);
      C[u] = (r.headers.get('set-cookie') || '').split(';')[0];
    }
  });
  after(() => app.close());

  describe('users', () => {
    it('operators need a department; departments must be known', async () => {
      await assert.rejects(app.users.create({ username: 'nodept', displayName: 'x', role: 'operator', plant: 'FSD', password: PW }), /department/i);
      await assert.rejects(app.users.create({ username: 'baddept', displayName: 'x', role: 'dept', plant: 'FSD', department: 'canteen', password: PW }), /department/i);
    });
    it('/api/me returns the department and the forms the user may use', async () => {
      const r = await as('spin.op', '/api/me');
      assert.equal(r.json.user.department, 'spinning');
      assert.ok(r.json.user.forms.includes('spin_shift'));
      assert.ok(!r.json.user.forms.includes('finance_month'));
    });
  });

  describe('submitting records', () => {
    it('an operator submits a valid shift record: stored as "submitted" and audited', async () => {
      const r = await submit('spin.op', { type: 'spin_shift', plant: 'FSD', date: TODAY, data: spinData() });
      assert.equal(r.status, 201, r.text);
      assert.equal(r.json.record.status, 'submitted');
      assert.equal(r.json.record.submittedBy, 'spin.op');
      const log = await as('ceo', '/api/audit');
      assert.ok(log.json.entries.some(e => e.target === `R${r.json.record.id}` && /submitted/.test(e.e) && e.u === 'spin.op'));
    });
    it('invalid values are rejected with field errors and nothing is stored', async () => {
      const before = (await as('spin.op', '/api/records?scope=mine')).json.records.length;
      const r = await submit('spin.op', { type: 'spin_shift', plant: 'FSD', date: TODAY, data: spinData({ machine: 'RF-09', yarn_kg: 990, waste_total_kg: 200 }) });
      assert.equal(r.status, 422);
      assert.ok(r.json.errors.length);
      assert.equal((await as('spin.op', '/api/records?scope=mine')).json.records.length, before);
    });
    it('a duplicate (same date, shift and machine) is refused with 409', async () => {
      const r = await submit('spin.op2', { type: 'spin_shift', plant: 'FSD', date: TODAY, data: spinData() });
      assert.equal(r.status, 409);
    });
    it('operators cannot submit other departments\' forms or for other plants', async () => {
      const sew = await submit('spin.op', { type: 'sewing_line_day', plant: 'FSD', date: TODAY, data: { line: 'L1', output_pcs: 300, sam_min: 16, operators: 20, hours: 8 } });
      assert.equal(sew.status, 403);
      const other = await submit('spin.op', { type: 'spin_shift', plant: 'KHI', date: TODAY, data: spinData({ machine: 'X' }) });
      assert.equal(other.status, 403);
    });
    it('admin cannot submit; a department head without a department cannot either', async () => {
      assert.equal((await submit('admin', { type: 'spin_shift', plant: 'FSD', date: TODAY, data: spinData({ machine: 'A1' }) })).status, 403);
      assert.equal((await submit('old.dept', { type: 'quality_day', plant: 'KHI', date: TODAY, data: { pcs_produced: 100 } })).status, 403);
    });
    it('rejects non-JSON, oversized and cross-site submissions', async () => {
      const r = await req(base, '/api/records', { method: 'POST', cookie: C['spin.op'], body: {}, headers: { origin: 'https://evil.example' } });
      assert.equal(r.status, 403);
      const big = await submit('spin.op', { type: 'spin_shift', plant: 'FSD', date: TODAY, data: { ...spinData({ machine: 'Z' }), pad: 'x'.repeat(200000) } });
      assert.ok([413, 422].includes(big.status));
    });
  });

  describe('maker-checker review', () => {
    let rec;
    before(async () => {
      rec = (await submit('spin.op', { type: 'spin_shift', plant: 'FSD', date: '2026-11-24', data: spinData({ shift: 'B' }) })).json.record;
    });
    it('operators and integration accounts cannot review', async () => {
      assert.equal((await review('spin.op2', rec, 'approve')).status, 403);
      assert.equal((await review('feed', rec, 'approve')).status, 403);
    });
    it('heads of other departments and other plants cannot review', async () => {
      assert.equal((await review('sew.head', rec, 'approve')).status, 403);
      assert.equal((await review('khi.plant', rec, 'approve')).status, 403);
    });
    it('nobody approves their own record (segregation of duties)', async () => {
      const own = (await submit('spin.head', { type: 'spin_shift', plant: 'FSD', date: '2026-11-24', data: spinData({ shift: 'C' }) })).json.record;
      const r = await review('spin.head', own, 'approve');
      assert.equal(r.status, 403);
      assert.match(r.json.error, /own/i);
    });
    it('the review queue shows only records the user may review', async () => {
      const q = (await as('spin.head', '/api/records?scope=queue')).json.records;
      assert.ok(q.some(r => r.id === rec.id));
      assert.ok(q.every(r => r.submittedBy !== 'spin.head'));
      assert.equal((await as('sew.head', '/api/records?scope=queue')).json.records.filter(r => r.id === rec.id).length, 0);
    });
    it('a stale version is refused with 409', async () => {
      assert.equal((await review('spin.head', rec, 'approve', '', rec.version + 5)).status, 409);
    });
    it('rejecting needs a reason', async () => {
      assert.equal((await review('spin.head', rec, 'reject', '')).status, 422);
    });
    it('the department head approves; it cannot be approved twice', async () => {
      const r = await review('spin.head', rec, 'approve', 'Checked against the frame log');
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.record.status, 'approved');
      assert.equal(r.json.record.reviewedBy, 'spin.head');
      assert.equal((await review('fsd.plant', r.json.record, 'approve')).status, 422);
      rec = r.json.record;
    });
    it('record values cannot be edited in the database once submitted', () => {
      assert.throws(() => app.db.prepare("UPDATE records SET data = '{}' WHERE id = ?").run(rec.id), /cannot be changed/);
    });
  });

  describe('measured KPIs', () => {
    it('only approved records count; unmeasured KPIs are null with the form that would measure them', async () => {
      const m = (await as('ceo', '/api/measured?plant=FSD&period=m')).json;
      const y = m.kpis['spinning|Yarn yield'];
      assert.equal(y.n, 1, 'one approved record; the submitted ones are not counted');
      assert.equal(y.value, 88);
      assert.equal(y.status, 'warn', '88% vs 91% target is inside the 5% warning band');
      const w = m.kpis['weaving|Loom efficiency'];
      assert.equal(w.value, null);
      assert.equal(w.formLabel, 'Weaving / knitting shift report');
      assert.ok(m.coverage.pct > 0 && m.coverage.pct < 100);
      assert.ok(m.findings.some(f => f.key === 'spinning|Yarn yield'));
    });
    it('voiding an approved record removes it from the KPIs (with an audited reason)', async () => {
      const mine = (await as('spin.head', '/api/records?scope=all&status=approved')).json.records;
      const target = mine.find(r => r.type === 'spin_shift');
      assert.equal((await review('spin.head', target, 'void', '')).status, 422);
      const v = await review('spin.head', target, 'void', 'Wrong frame number');
      assert.equal(v.status, 200);
      assert.equal(v.json.record.status, 'voided');
      const m = (await as('ceo', '/api/measured?plant=FSD')).json;
      assert.equal(m.kpis['spinning|Yarn yield'].value, null);
    });
    it('validates plant and period', async () => {
      assert.equal((await as('ceo', '/api/measured?plant=XYZ')).status, 400);
      assert.equal((await as('ceo', '/api/measured?period=decade')).status, 400);
    });
    it('operators and integration accounts cannot read group KPIs', async () => {
      assert.equal((await as('spin.op', '/api/measured')).status, 403);
      assert.equal((await as('feed', '/api/measured')).status, 403);
    });
    it('operators do not receive the group action list or audit log in /api/state', async () => {
      const s = (await as('spin.op', '/api/state')).json;
      assert.deepEqual(s.actions, []);
      assert.deepEqual(s.log, []);
    });
    it('finance records feed finance KPIs, and cost rates give a measured PKR impact', async () => {
      const f = (await submit('fin.op', { type: 'finance_month', plant: 'GRP', date: '2026-11-01', data: { sales_m: 1000, cogs_m: 820, receivables_m: 2000 } })).json.record;
      assert.equal((await review('cfo', f, 'approve')).status, 200);
      const rates = (await submit('cfo', { type: 'cost_rates', plant: 'GRP', date: '2026-11-01', data: { cotton_pkr_kg: 500 } })).json.record;
      assert.equal((await review('ceo', rates, 'approve')).status, 200);
      const s = (await submit('spin.op', { type: 'spin_shift', plant: 'FSD', date: '2026-11-23', data: spinData({ machine: 'RF-02' }) })).json.record;
      assert.equal((await review('fsd.plant', s, 'approve')).status, 200);
      const m = (await as('cfo', '/api/measured')).json;
      assert.equal(m.kpis['finance|Gross margin'].value, 18);
      const y = m.findings.find(x => x.key === 'spinning|Yarn yield');
      assert.ok(y.impactPkr > 0, 'impact from finance cost rate');
    });
    it('flags an outlier for the approver once there is history', async () => {
      for (let i = 0; i < 9; i++) {
        const r = (await submit('spin.op', { type: 'spin_shift', plant: 'FSD', date: `2026-11-${String(10 + i).padStart(2, '0')}`, data: spinData({ machine: 'RF-07', cotton_kg: 1000 + i }) })).json.record;
        assert.equal((await review('spin.head', r, 'approve')).status, 200);
      }
      const odd = await submit('spin.op', { type: 'spin_shift', plant: 'FSD', date: '2026-11-20', data: spinData({ machine: 'RF-07', cotton_kg: 9000, yarn_kg: 8000, waste_total_kg: 900 }) });
      assert.equal(odd.status, 201);
      assert.ok(odd.json.record.flags.some(f => f.field === 'cotton_kg'));
    });
  });
  describe('security review fixes', () => {
    it('only dashboard readers can read the KPI feed', async () => {
      assert.equal((await as('spin.op', '/api/kpis')).status, 403);
      assert.equal((await as('feed', '/api/kpis')).status, 403);
      assert.equal((await as('ceo', '/api/kpis')).status, 200);
    });
    it('plant-scoped readers only get the measured KPIs of their own plant', async () => {
      assert.equal((await as('fsd.plant', '/api/measured?plant=KHI')).status, 403);
      assert.equal((await as('fsd.plant', '/api/measured?plant=all')).status, 403);
      const own = await as('fsd.plant', '/api/measured');
      assert.equal(own.status, 200, own.text);
      assert.equal(own.json.plant, 'FSD');
      assert.equal((await as('ceo', '/api/measured?plant=KHI')).status, 200);
    });
    it('the same purchase order cannot be entered again on another date or with different spacing', async () => {
      const po = (d, no) => ({ type: 'procurement_po', plant: 'GRP', date: d, data: { po_no: no, supplier: 'Acme', otif: 1, qty_received: 100, qty_rejected: 0, value_pkr_m: 1, spot_buy: 0 } });
      const first = await submit('cfo', po('2026-11-20', 'PO-77'));
      assert.equal(first.status, 201, first.text);
      const again = await submit('cfo', po('2026-11-21', 'po 77'));
      assert.equal(again.status, 409, again.text);
    });
    it('the database refuses status changes that skip the workflow, review edits, and rows inserted as approved', () => {
      const v = app.db.prepare("SELECT id FROM records WHERE status = 'voided' LIMIT 1").get();
      assert.ok(v, 'a voided record exists from the earlier test');
      assert.throws(() => app.db.prepare("UPDATE records SET status = 'approved' WHERE id = ?").run(v.id), /status/i);
      assert.throws(() => app.db.prepare("UPDATE records SET review_note = 'edited' WHERE id = ?").run(v.id), /review/i);
      const u = app.db.prepare('SELECT id FROM users LIMIT 1').get();
      assert.throws(() => app.db.prepare("INSERT INTO records (type, plant, date, dkey, data, status, submitted_by, submitted_at) VALUES ('spin_shift', 'FSD', '2026-11-25', NULL, '{}', 'approved', ?, 'x')").run(u.id), /submitted/i);
    });
    it('measured results refresh as soon as a record is approved', async () => {
      const before = (await as('ceo', '/api/measured?plant=FSD')).json.kpis['spinning|Yarn yield'];
      const again = (await as('ceo', '/api/measured?plant=FSD')).json.kpis['spinning|Yarn yield'];
      assert.deepEqual(again, before, 'a repeat request returns the same result');
      const s = await submit('spin.op', { type: 'spin_shift', plant: 'FSD', date: TODAY, data: spinData({ machine: 'RF-09', yarn_kg: 900, waste_total_kg: 100 }) });
      assert.equal(s.status, 201, s.text);
      assert.equal((await review('spin.head', s.json.record, 'approve')).status, 200);
      const after = (await as('ceo', '/api/measured?plant=FSD')).json.kpis['spinning|Yarn yield'];
      assert.equal(after.n, before.n + 1, 'the new approval is counted immediately, not served from cache');
      assert.notEqual(after.value, before.value);
    });
  });
});

describe('database upgrade from version 1', () => {
  it('keeps existing users and allows the new operator role', async () => {
    const { DatabaseSync } = require('node:sqlite');
    const { MIGRATIONS, openDb } = require('../../server/db.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ta-mig-'));
    const file = path.join(dir, 'v1.db');
    const old = new DatabaseSync(file);
    old.exec(MIGRATIONS[0]);
    old.exec('CREATE TABLE schema_version (v INTEGER NOT NULL); INSERT INTO schema_version VALUES (1);');
    old.prepare("INSERT INTO users (username, display_name, role, plant, pass_hash, created_at, pw_changed_at) VALUES ('legacy','Legacy','dept','KHI','x','t','t')").run();
    old.prepare("INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES ('h', 1, 0, 9e15)").run();
    old.close();
    const db = openDb(file);
    assert.equal(db.prepare('SELECT username FROM users WHERE id = 1').get().username, 'legacy');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1, 'sessions survive the rebuild');
    db.prepare("INSERT INTO users (username, display_name, role, plant, department, pass_hash, created_at, pw_changed_at) VALUES ('op','Op','operator','KHI','sewing','x','t','t')").run();
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
