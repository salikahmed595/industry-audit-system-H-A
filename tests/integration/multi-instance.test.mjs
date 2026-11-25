// Two real server processes on ONE database, the way Vercel runs several instances of the API at once.
// Anything an instance kept only in memory would break here: sign-in lockout, measured-KPI cache, first-run seeding.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { openDb } = require('../../server/db.js');
const { makeUsers } = require('../../server/users.js');
const D = require('../../js/data.js');

const PW = 'correct horse battery 9';
const TODAY = new Date().toISOString().slice(0, 10);

const spawned = []; // every child, so cleanup also stops one whose sibling failed to start
function startServer(dbFile) {
  const env = { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '0', DB_PATH: dbFile };
  for (const k of ['DB_URL', 'DB_AUTH_TOKEN', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'VERCEL', 'VERCEL_ENV', 'PUBLIC_ORIGIN', 'TRUST_PROXY', 'SECURE_COOKIES']) delete env[k];
  const proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(ROOT, 'server', 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  spawned.push(proc);
  return new Promise((resolve, reject) => {
    let out = '', err = '';
    const timer = setTimeout(() => { proc.kill(); reject(new Error(`server did not start: ${err || out}`)); }, 20e3);
    proc.stdout.on('data', c => {
      out += c;
      const m = out.match(/listening on (http:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve({ base: m[1], proc }); }
    });
    proc.stderr.on('data', c => { err += c; });
    proc.on('exit', code => { clearTimeout(timer); reject(new Error(`server exited (${code}): ${err || out}`)); });
  });
}

async function req(base, p, { method = 'GET', body, cookie } = {}) {
  const h = {};
  if (cookie) h.cookie = cookie;
  if (body !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const login = async (base, username, password = PW) => req(base, '/api/login', { method: 'POST', body: { username, password } });

describe('several server instances on one database (as on Vercel)', () => {
  let dir, file, A, B;
  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ta-multi-'));
    file = path.join(dir, 'shared.db');
    const db = await openDb(file);
    const users = makeUsers(db, Date.now);
    for (const [username, role, plant, department] of [['ceo', 'ceo', 'all'], ['spin.op', 'operator', 'FSD', 'spinning'], ['spin.head', 'dept', 'FSD', 'spinning'], ['lockme', 'dept', 'KHI']]) {
      await users.create({ username, displayName: username, role, plant, department, password: PW });
    }
    db.close();
    [A, B] = await Promise.all([startServer(file), startServer(file)]); // both find an empty actions table at the same moment
  });
  after(async () => {
    for (const p of spawned) { p.removeAllListeners('exit'); p.kill(); }
    await new Promise(r => setTimeout(r, 200));
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may still hold the file */ }
  });

  it('seeds the corrective actions once, even when both instances start together', async () => {
    const db = await openDb(file);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM actions')).n, D.FINDINGS.length);
    assert.equal((await db.get("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'system.seed'")).n, 1);
    db.close();
  });

  it('a sign-in lockout reached on one instance also applies on the other', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await login(A.base, 'lockme', 'wrong password ' + i)).status, 401);
    const onB = await login(B.base, 'lockme');
    assert.equal(onB.status, 429, 'the other instance must not grant fresh attempts');
  });

  it('an approval on one instance is counted at once by the other (no stale measured cache)', async () => {
    const ceoA = (await login(A.base, 'ceo')).cookie;
    const opB = (await login(B.base, 'spin.op')).cookie;
    const headB = (await login(B.base, 'spin.head')).cookie;
    const before = (await req(A.base, '/api/measured?plant=FSD', { cookie: ceoA })).json.kpis['spinning|Yarn yield'];
    const s = await req(B.base, '/api/records', { method: 'POST', cookie: opB, body: { type: 'spin_shift', plant: 'FSD', date: TODAY, data: { shift: 'A', machine: 'RF-01', cotton_kg: 1000, yarn_kg: 880, waste_total_kg: 120 } } });
    assert.equal(s.status, 201, s.text);
    const r = await req(B.base, `/api/records/${s.json.record.id}/review`, { method: 'POST', cookie: headB, body: { decision: 'approve', version: s.json.record.version } });
    assert.equal(r.status, 200, r.text);
    const after = (await req(A.base, '/api/measured?plant=FSD', { cookie: ceoA })).json.kpis['spinning|Yarn yield'];
    assert.equal(after.n, before.n + 1);
  });

  it('both instances answer the health check', async () => {
    for (const s of [A, B]) {
      const r = await req(s.base, '/api/health');
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { ok: true, db: true });
    }
  });
});
