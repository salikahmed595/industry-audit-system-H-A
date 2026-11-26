// Disposable server for browser (E2E) checks: in-memory database, synthetic users and records, real HTTP + real app.
// Nothing touches data/. Usage: node tests/e2e/demo-server.mjs [port]
// Every account uses the synthetic test password in E2E_PASSWORD (default: the integration-test password).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.js');

const PW = process.env.E2E_PASSWORD || 'correct horse battery 9';
const port = Number(process.argv[2] || 5175);
const app = await createApp({ dbPath: ':memory:' });
const people = [
  ['ceo', 'ceo', 'all', null], ['admin', 'admin', 'all', null], ['cfo', 'finance', 'all', null], ['fin.op', 'operator', 'GRP', 'finance'],
  ['spin.head', 'dept', 'FSD', 'spinning'], ['spin.op', 'operator', 'FSD', 'spinning'],
  ['mnt.head', 'dept', 'KHI', 'maintenance'], ['mnt.op', 'operator', 'KHI', 'maintenance'], ['khi.plant', 'plant', 'KHI', null],
];
for (const [username, role, plant, department] of people) await app.users.create({ username, displayName: username, role, plant, department, password: PW });
const base = await app.listen(port, '127.0.0.1');
const C = {};
for (const [u] of people) {
  const r = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: PW }) });
  C[u] = (r.headers.get('set-cookie') || '').split(';')[0];
}
async function call(who, p, body) {
  const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie: C[who], origin: base }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status >= 300) throw new Error(`${p} as ${who}: ${r.status} ${JSON.stringify(j)}`);
  return j;
}
async function enter(maker, checker, rec) {
  const { record } = await call(maker, '/api/records', rec);
  await call(checker, `/api/records/${record.id}/review`, { decision: 'approve', note: '', version: record.version });
}
const today = new Date().toISOString().slice(0, 10);
const day = i => new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
for (let i = 0; i < 20; i++) {
  await enter('spin.op', 'spin.head', { type: 'spin_shift', plant: 'FSD', date: day(i), data: { shift: i % 2 ? 'B' : 'A', machine: 'RF-0' + (i % 3 + 1), cotton_kg: 1500, yarn_kg: 1290 + (i % 4) * 5, waste_total_kg: 190 - (i % 4) * 5 } });
  await enter('mnt.op', 'mnt.head', { type: 'maintenance_day', plant: 'KHI', date: day(i), data: { unplanned_downtime_h: 9 + (i % 3), breakdowns: 3, repair_h: 7 } });
}
await enter('fin.op', 'cfo', { type: 'cost_rates', plant: 'GRP', date: today.slice(0, 8) + '01', data: { cotton_pkr_kg: 520, constraint_pkr_h: 38500, machine_pkr_h: 2200, output_kg_h: 450 } });
await enter('fin.op', 'cfo', { type: 'finance_month', plant: 'GRP', date: today.slice(0, 8) + '01', data: { sales_m: 900, cogs_m: 720, receivables_m: 2400, payables_m: 500, purchases_m: 600 } });
console.log(`E2E demo server on ${base} with users: ${people.map(p => p[0]).join(', ')}`);
