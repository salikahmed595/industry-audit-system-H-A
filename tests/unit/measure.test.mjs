// Unit tests for the measurement layer: forms, validation, KPI formulas, coverage, statistics, evidence.
// Run: node --test tests/unit
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../../js/measure.js');
const D = require('../../js/data.js');

const TODAY = '2026-11-25';
const near = (a, e, tol = 0.01) => assert.ok(a !== null && Math.abs(a - e) <= tol, `expected ~${e}, got ${a}`);
const win = M.windowFor('m', TODAY);
let id = 0;
const rec = (type, data, o = {}) => ({ id: ++id, type, plant: o.plant || 'FSD', date: o.date || TODAY, data });
const spin = (cotton, yarn, extra = {}, o = {}) => rec('spin_shift', { shift: 'A', machine: 'RF-01', cotton_kg: cotton, yarn_kg: yarn, waste_total_kg: cotton - yarn, ...extra }, o);

describe('catalogue', () => {
  test('every dashboard KPI (all sections) has a measurement formula', () => {
    const all = Object.entries(D.SECTIONS).flatMap(([s, x]) => x.kpis.map(k => `${s}|${k[0]}`));
    assert.equal(all.length, 86);
    for (const k of all) assert.ok(M.KPIS[k], `no formula for ${k}`);
  });
  test('every formula field exists on its form (or is derived)', () => {
    for (const [k, d] of Object.entries(M.KPIS)) {
      if (d.t === 'combo') { d.parts.forEach(([p]) => assert.ok(M.KPIS[p], `${k} part ${p}`)); continue; }
      const f = M.FORMS[d.form];
      assert.ok(f, `${k}: form ${d.form}`);
      for (const x of [d.num, d.den, d.v, d.w].filter(Boolean)) assert.ok(x === '#' || f.fields.some(z => z.k === x) || f.derive[x], `${k}: field ${x}`);
    }
  });
  test('every form belongs to known departments and has unique field keys', () => {
    for (const f of Object.values(M.FORMS)) {
      f.depts.forEach(d => assert.ok(M.DEPARTMENTS.includes(d), `${f.id}: ${d}`));
      assert.equal(new Set(f.fields.map(x => x.k)).size, f.fields.length, f.id);
    }
  });
});

describe('validateRecord', () => {
  const good = { type: 'spin_shift', plant: 'FSD', date: TODAY, data: { shift: 'B', machine: 'RF-12', cotton_kg: 1000, yarn_kg: 890, waste_total_kg: 110, cv_pct: 12.4 } };
  test('accepts a complete record and builds the duplicate key', () => {
    const r = M.validateRecord(good, TODAY);
    assert.deepEqual(r.errors, []);
    assert.equal(r.record.dkey, `${TODAY}|b|rf12`);
    assert.equal(r.record.data.cv_pct, 12.4);
  });
  test('duplicate keys ignore case, spacing, punctuation and full-width letters', () => {
    const k = m => M.validateRecord({ ...good, data: { ...good.data, machine: m } }, TODAY).record.dkey;
    for (const m of ['rf 12', 'RF12', 'Rf.12', 'rf  -12', 'ＲＦ-12']) assert.equal(k(m), k('RF-12'), m);
  });
  test('event forms with their own number (lot, PO, lay) are unique by that number, whatever the date', () => {
    const lot = d => M.validateRecord({ type: 'dye_lot', plant: 'KHI', date: d, data: { lot_no: 'L-1', machine: 'J1', lot_kg: 500, rft: 1, redyed: 0 } }, TODAY).record.dkey;
    assert.equal(lot('2026-11-20'), lot('2026-11-24'));
    assert.ok(!lot('2026-11-20').includes('2026'), 'the date is not part of the key');
  });
  test('rejects unknown form types, including prototype keys', () => {
    for (const type of ['nope', '__proto__', 'constructor', 'toString']) assert.equal(M.validateRecord({ ...good, type }, TODAY).errors[0].field, 'type');
  });
  test('requires mandatory fields and real numbers', () => {
    const r = M.validateRecord({ ...good, data: { shift: 'B', machine: 'RF-1', cotton_kg: '1000', yarn_kg: 900 } }, TODAY);
    const fields = r.errors.map(e => e.field);
    assert.ok(fields.includes('cotton_kg') && fields.includes('waste_total_kg'));
  });
  test('enforces min/max, whole numbers and yes/no', () => {
    assert.ok(M.validateRecord({ ...good, data: { ...good.data, cv_pct: 99 } }, TODAY).errors.some(e => e.field === 'cv_pct'));
    assert.ok(M.validateRecord({ ...good, data: { ...good.data, bales_checked: 2.5 } }, TODAY).errors.some(e => e.field === 'bales_checked'));
    const lot = { type: 'dye_lot', plant: 'KHI', date: TODAY, data: { lot_no: 'L1', machine: 'J1', lot_kg: 500, rft: 2, redyed: 0 } };
    assert.ok(M.validateRecord(lot, TODAY).errors.some(e => e.field === 'rft'));
    const ok = M.validateRecord({ ...lot, data: { ...lot.data, rft: true, redyed: false } }, TODAY);
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.record.data.rft, 1);
  });
  test('rejects unknown fields, bad plants, script-like text and non-finite numbers', () => {
    assert.ok(M.validateRecord({ ...good, data: { ...good.data, hack: 1 } }, TODAY).errors.some(e => e.field === 'hack'));
    assert.ok(M.validateRecord({ ...good, plant: 'all' }, TODAY).errors.some(e => e.field === 'plant'));
    assert.ok(M.validateRecord({ ...good, data: { ...good.data, machine: '<script>alert(1)</script>' } }, TODAY).errors.some(e => e.field === 'machine'));
    assert.ok(M.validateRecord({ ...good, data: { ...good.data, cotton_kg: Infinity } }, TODAY).errors.some(e => e.field === 'cotton_kg'));
    assert.ok(M.validateRecord({ ...good, data: [1, 2] }, TODAY).errors.length);
  });
  test('accepts Urdu text in labels', () => {
    assert.deepEqual(M.validateRecord({ ...good, data: { ...good.data, supplier_lot: 'کپاس لاٹ 7' } }, TODAY).errors, []);
  });
  test('rejects future dates (one day of time-zone slack) and very old dates', () => {
    assert.deepEqual(M.validateRecord({ ...good, date: '2026-11-26' }, TODAY).errors, []);
    assert.equal(M.validateRecord({ ...good, date: '2026-11-28' }, TODAY).errors[0].field, 'date');
    assert.equal(M.validateRecord({ ...good, date: '2026-08-01' }, TODAY).errors[0].field, 'date');
    assert.equal(M.validateRecord({ ...good, date: '2026-02-30' }, TODAY).errors[0].field, 'date');
  });
  test('cross-field rules catch impossible numbers', () => {
    const r = M.validateRecord({ ...good, data: { ...good.data, yarn_kg: 950, waste_total_kg: 200 } }, TODAY);
    assert.match(r.errors[0].error, /cannot be more than the cotton fed/);
    const s = M.validateRecord({ type: 'sewing_line_day', plant: 'KHI', date: TODAY, data: { line: 'L1', output_pcs: 9000, sam_min: 20, operators: 10, hours: 8 } }, TODAY);
    assert.match(s.errors[0].error, /150%/);
  });
  test('needs at least one measured value', () => {
    const r = M.validateRecord({ type: 'downtime_event', plant: 'KHI', date: TODAY, data: { area: 'sewing', machine: 'M1', reason: 'Other' } }, TODAY);
    assert.ok(r.errors.length);
  });
  test('monthly records snap to the 1st, weekly records to Monday', () => {
    const m = M.validateRecord({ type: 'finance_month', plant: 'GRP', date: '2026-10-31', data: { sales_m: 900, cogs_m: 700 } }, TODAY);
    assert.equal(m.record.date, '2026-10-01');
    const w = M.validateRecord({ type: 'planning_week', plant: 'KHI', date: '2026-11-20', data: { orders_shipped: 10, orders_otif: 8 } }, TODAY); // Friday
    assert.equal(w.record.date, '2026-11-16');
  });
});

describe('KPI formulas', () => {
  test('ratio KPIs pool totals (Σyarn ÷ Σcotton), not the average of ratios', () => {
    const c = M.compute(M.KPIS['spinning|Yarn yield'], [spin(1000, 950), spin(100, 50)], win);
    near(c.value, 1000 / 1100 * 100);
    assert.equal(c.n, 2);
  });
  test('optional fields only count records that have them', () => {
    const c = M.compute(M.KPIS['spinning|Blow room loss'], [spin(1000, 900, { waste_blowroom_kg: 20 }), spin(5000, 4500)], win);
    near(c.value, 2);
    assert.equal(c.n, 1);
  });
  test('line efficiency = output × SAM ÷ (operators × hours × 60)', () => {
    const r = rec('sewing_line_day', { line: 'L1', output_pcs: 300, sam_min: 16, operators: 20, hours: 8 });
    near(M.compute(M.KPIS['sewing|Line efficiency'], [r], win).value, 50);
    near(M.compute(M.KPIS['sewing|Output per worker-hour'], [r], win).value, 300 / 160);
  });
  test('weighted average (CV% weighted by yarn kg)', () => {
    const c = M.compute(M.KPIS['spinning|Yarn evenness CV%'], [spin(1000, 900, { cv_pct: 12 }), spin(400, 300, { cv_pct: 16 })], win);
    near(c.value, (12 * 900 + 16 * 300) / 1200);
  });
  test('yes/no share (right-first-time = lots approved first time ÷ lots)', () => {
    const lots = [1, 1, 1, 0].map((rft, i) => rec('dye_lot', { lot_no: `L${i}`, machine: 'J1', lot_kg: 500, rft, redyed: rft ? 0 : 1 }));
    near(M.compute(M.KPIS['dyeing|Right-first-time dyeing'], lots, win).value, 75);
    near(M.compute(M.KPIS['dyeing|Re-dye / strip'], lots, win).value, 25);
  });
  test('sums are normalised to their period (downtime per 30 days)', () => {
    const recs = Array.from({ length: 10 }, (_, i) => rec('maintenance_day', { unplanned_downtime_h: 5 }, { date: M.dates.addDays(TODAY, -i) }));
    near(M.compute(M.KPIS['maintenance|Unplanned downtime'], recs, win).value, 50 * 30 / 10);
  });
  test('snapshots use the latest record per machine and add them up', () => {
    const recs = [spin(100, 90, { spindles_flagged: 9 }, { date: '2026-11-20' }), spin(100, 90, { spindles_flagged: 4 }, { date: '2026-11-24' }),
      rec('spin_shift', { shift: 'A', machine: 'RF-02', cotton_kg: 100, yarn_kg: 90, waste_total_kg: 10, spindles_flagged: 3 })];
    near(M.compute(M.KPIS['spinning|Flagged spindles'], recs, win).value, 7);
  });
  test('distinct share (styles with verified SAM counts each style once, latest answer)', () => {
    const s = (style, v, date) => rec('sewing_line_day', { line: 'L1', style, output_pcs: 100, sam_min: 10, operators: 10, hours: 8, sam_verified: v }, { date });
    near(M.compute(M.KPIS['sewing|Styles with verified SAM'], [s('P1', 0, '2026-11-01'), s('P1', 1, '2026-11-20'), s('P2', 0, '2026-11-20')], win).value, 50);
  });
  test('cash conversion cycle = DIO + DSO − DPO from two different forms', () => {
    const out = M.measureAll([
      rec('inventory_month', { inventory_value_m: 600, cogs_month_m: 300 }, { plant: 'GRP', date: '2026-11-01' }),
      rec('finance_month', { sales_m: 1000, cogs_m: 760, receivables_m: 1500, payables_m: 400, purchases_m: 300 }, { plant: 'GRP', date: '2026-11-01' }),
    ], { today: TODAY });
    const k = out.kpis;
    near(k['inventory|Days inventory (DIO)'].value, 60.88);
    near(k['finance|DSO'].value, 45.66);
    near(k['finance|Cash conversion cycle'].value, k['inventory|Days inventory (DIO)'].value + k['finance|DSO'].value - k['finance|DPO'].value);
    near(k['finance|Gross margin'].value, 24);
  });
  test('a zero denominator is "not measured", never infinity', () => {
    const r = rec('maintenance_day', { jet_run_h: 300, jet_failures: 0 });
    assert.equal(M.compute(M.KPIS['maintenance|MTBF — dye jets'], [r], win).value, null);
  });
});

describe('measureAll: ground truth, coverage, findings', () => {
  test('no records: every KPI is not measured, coverage 0%, no findings', () => {
    const out = M.measureAll([], { today: TODAY });
    assert.equal(out.coverage.pct, 0);
    assert.equal(out.coverage.applicable, 86);
    assert.ok(Object.values(out.kpis).every(k => k.value === null && k.status === 'unknown'));
    assert.deepEqual(out.findings, []);
  });
  test('coverage counts only KPIs that apply to the selected plant', () => {
    const khi = M.measureAll([], { plant: 'KHI', today: TODAY });
    assert.equal(khi.coverage.applicable, Object.values(D.SECTIONS).filter(s => s.plants.includes('KHI')).reduce((a, s) => a + s.kpis.length, 0));
    assert.equal(khi.kpis['spinning|Yarn yield'].applicable, false);
  });
  test('records outside the period or another plant are ignored', () => {
    const out = M.measureAll([spin(1000, 900, {}, { date: '2026-09-01' }), spin(1000, 800, {}, { plant: 'LHR' })], { plant: 'FSD', today: TODAY });
    assert.equal(out.kpis['spinning|Yarn yield'].value, null);
  });
  test('a measured off-target KPI becomes a finding; on-target KPIs do not', () => {
    const out = M.measureAll([spin(1000, 880), rec('quality_day', { pcs_produced: 1000, rejected_pcs: 5 }, { plant: 'KHI' })], { today: TODAY });
    const keys = out.findings.map(f => f.key);
    assert.ok(keys.includes('spinning|Yarn yield'));
    assert.ok(!keys.includes('quality|Reject rate'));
    assert.equal(out.kpis['quality|Reject rate'].status, 'good');
  });
  test('measured PKR impact uses finance cost rates: gap × volume × rate', () => {
    const days = Array.from({ length: 30 }, (_, i) => spin(1000, 880, {}, { date: M.dates.addDays(TODAY, -i) }));
    const out = M.measureAll([...days, rec('cost_rates', { cotton_pkr_kg: 500 }, { plant: 'GRP', date: '2026-11-01' })], { today: TODAY });
    const f = out.findings.find(x => x.key === 'spinning|Yarn yield');
    assert.equal(f.impactPkr, Math.round(0.03 * 30000 * 500)); // 3 points short × 30,000 kg × PKR 500
    assert.equal(out.findings[0].key, 'spinning|Yarn yield', 'largest measured loss ranks first');
  });
  test('stratification finds the shift that drives the gap (Welch t-test)', () => {
    const recs = [];
    for (let i = 0; i < 12; i++) {
      const date = M.dates.addDays(TODAY, -i);
      recs.push(rec('spin_shift', { shift: 'A', machine: 'RF-01', cotton_kg: 1000, yarn_kg: 905 + (i % 3), waste_total_kg: 90 }, { date }));
      recs.push(rec('spin_shift', { shift: 'B', machine: 'RF-01', cotton_kg: 1000, yarn_kg: 903 + (i % 4), waste_total_kg: 90 }, { date }));
      recs.push(rec('spin_shift', { shift: 'C', machine: 'RF-01', cotton_kg: 1000, yarn_kg: 840 + (i % 5), waste_total_kg: 150 }, { date }));
    }
    const f = M.measureAll(recs, { today: TODAY }).findings.find(x => x.key === 'spinning|Yarn yield');
    const st = f.evidence.find(e => e.kind === 'stratify');
    assert.ok(st, 'expected a stratification finding');
    assert.equal(st.dim, 'shift');
    assert.equal(st.level, 'C');
    assert.ok(st.p < 0.001);
  });
  test('Pareto evidence ranks downtime reasons by minutes', () => {
    const ev = [['Power / gas outage', 300], ['Power / gas outage', 200], ['Mechanical breakdown', 120], ['Changeover', 30]]
      .map(([reason, minutes]) => rec('downtime_event', { area: 'dyeing', machine: 'J4', reason, minutes }, { plant: 'KHI' }));
    const out = M.measureAll([...ev, rec('maintenance_day', { unplanned_downtime_h: 30 }, { plant: 'KHI' })], { plant: 'KHI', today: TODAY });
    const f = out.findings.find(x => x.key === 'maintenance|Unplanned downtime');
    const p = f.evidence.find(e => e.kind === 'pareto');
    assert.equal(p.items[0].label, 'Power / gas outage');
    near(p.items[0].share, 500 / 650 * 100, 0.1);
  });
  test('playbook findings are attached as hypotheses, not as measurements', () => {
    const out = M.measureAll([spin(1000, 880, { bales_checked: 10, contamination_g: 150 })], { today: TODAY });
    const f = out.findings.find(x => x.key === 'spinning|Contamination');
    assert.ok(f.hypotheses.some(h => h.id === 'F01'));
  });
  test('stale data is marked', () => {
    const out = M.measureAll([spin(1000, 900, {}, { date: '2026-11-10' })], { today: TODAY });
    assert.equal(out.kpis['spinning|Yarn yield'].stale, true);
  });
});

describe('statistics', () => {
  test('Student t p-value: t = 2.228 with 10 df is p = 0.05', () => near(M.stats.tPValue(2.228, 10), 0.05, 0.001));
  test('Welch t-test on two clearly different groups is significant; identical groups are not', () => {
    near(M.stats.welch([10, 11, 12, 11, 10], [20, 21, 19, 20, 22]).p, 0, 0.001);
    assert.equal(M.stats.welch([5, 5, 5], [5, 5, 5]).p, 1);
  });
  test('Welch t matches the textbook example (t ≈ -2.46, p ≈ 0.021)', () => {
    const a = [27.5, 21.0, 19.0, 23.6, 17.0, 17.9, 16.9, 20.1, 21.9, 22.6, 23.1, 19.6, 19.0, 21.7, 21.4];
    const b = [27.1, 22.0, 20.8, 23.4, 23.4, 23.5, 25.8, 22.0, 24.8, 20.2, 21.9, 22.1, 22.9, 20.5, 24.4];
    const w = M.stats.welch(a, b);
    near(w.t, -2.46, 0.01);
    near(w.p, 0.021, 0.002);
  });
  test('control chart flags a point beyond 3 sigma and a run of 8', () => {
    const cc = M.stats.controlChart([10, 10.2, 9.9, 10.1, 9.8, 10, 10.1, 9.9, 14]);
    assert.deepEqual(cc.beyond, [8]);
    const run = M.stats.controlChart([10, 10, 10, 10, 12, 12.1, 12.2, 12.1, 12.3, 12.2, 12.1, 12.4]);
    assert.equal(run.run.side, 'above');
    assert.equal(M.stats.controlChart([1, 2, 3]), null, 'needs at least 8 points');
  });
  test('trend: slope and t statistic', () => {
    const t = M.stats.trend([[0, 1], [1, 3], [2, 5.1], [3, 6.9], [4, 9], [5, 11]]);
    near(t.slope, 2, 0.05);
    assert.ok(t.t > 10);
  });
  test('pareto sorts and accumulates', () => {
    const p = M.stats.pareto([{ label: 'a', value: 10 }, { label: 'b', value: 70 }, { label: 'c', value: 20 }]);
    assert.deepEqual(p.map(x => x.label), ['b', 'c', 'a']);
    near(p[1].cum, 90);
  });
  test('outlier flags compare with the robust spread of recent history', () => {
    const hist = Array.from({ length: 10 }, (_, i) => ({ cotton_kg: 1000 + i * 5 }));
    assert.equal(M.outlierFlags('spin_shift', { cotton_kg: 10000 }, hist).length, 1);
    assert.equal(M.outlierFlags('spin_shift', { cotton_kg: 1010 }, hist).length, 0);
    assert.equal(M.outlierFlags('spin_shift', { cotton_kg: 10000 }, hist.slice(0, 3)).length, 0, 'not enough history');
  });
});

describe('who may use which form', () => {
  test('operators and department heads get their department forms only', () => {
    const f = M.formsFor({ role: 'operator', department: 'spinning' });
    assert.ok(f.includes('spin_shift') && !f.includes('finance_month') && !f.includes('sewing_line_day'));
    assert.ok(M.formsFor({ role: 'dept', department: 'sewing' }).includes('defect_log'));
  });
  test('no department means no forms; admin has none; operators review nothing', () => {
    assert.deepEqual(M.formsFor({ role: 'dept', department: null }), []);
    assert.deepEqual(M.formsFor({ role: 'admin' }), []);
    assert.deepEqual(M.reviewableForms({ role: 'operator', department: 'spinning' }), []);
    assert.deepEqual(M.reviewableForms({ role: 'integration' }), []);
  });
  test('finance covers finance, inventory and procurement forms', () => {
    const f = M.formsFor({ role: 'finance' });
    assert.ok(f.includes('finance_month') && f.includes('inventory_month') && f.includes('procurement_po') && f.includes('cost_rates'));
    assert.ok(!f.includes('spin_shift'));
  });
});
