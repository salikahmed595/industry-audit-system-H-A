// Integration tests: real HTTP server + real SQLite (in-memory), no mocks.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.js');

const PW = 'correct horse battery 9';
let now = Date.parse('2026-11-25T09:00:00Z');
const clock = () => now;

async function req(base, path, { method = 'GET', body, raw, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined && !h['content-type']) h['content-type'] = 'application/json';
  const r = await fetch(base + path, { method, headers: h, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, headers: r.headers, json, text };
}
const cookieOf = res => (res.headers.get('set-cookie') || '').split(';')[0];

describe('API (integration)', () => {
  let app, base;
  const login = async (username, password = PW) => {
    const r = await req(base, '/api/login', { method: 'POST', body: { username, password } });
    assert.equal(r.status, 200, `login ${username}: ${r.text}`);
    return cookieOf(r);
  };
  const state = async c => (await req(base, '/api/state', { cookie: c })).json;

  before(async () => {
    app = createApp({ dbPath: ':memory:', clock, loginMaxFailures: 5 });
    for (const [username, role, plant] of [['ceo', 'ceo', 'all'], ['khi.plant', 'plant', 'KHI'], ['khi.dept', 'dept', 'KHI'], ['cfo', 'finance', 'all'], ['feed', 'integration', 'all'], ['admin', 'admin', 'all'], ['lockme', 'dept', 'KHI'], ['pwuser', 'dept', 'KHI'], ['expire', 'ceo', 'all']]) {
      await app.users.create({ username, displayName: username, role, plant, password: PW });
    }
    base = await app.listen(0);
  });
  after(() => app.close());

  describe('transport & static files', () => {
    it('health check reports the database is up', async () => {
      const r = await req(base, '/healthz');
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { ok: true, db: true });
    });
    it('sends security headers on every response', async () => {
      const r = await req(base, '/');
      const csp = r.headers.get('content-security-policy');
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /script-src 'self'(;|$)/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(r.headers.get('x-frame-options'), 'DENY');
    });
    it('serves the app shell and its assets', async () => {
      assert.equal((await req(base, '/')).status, 200);
      const js = await req(base, '/js/engine.js');
      assert.equal(js.status, 200);
      assert.match(js.headers.get('content-type'), /javascript/);
    });
    it('never serves server code, tests, data, git or traversal paths', async () => {
      for (const p of ['/server/app.js', '/tests/integration/api.test.mjs', '/package.json', '/data/textile-audit.db', '/.git/config', '/js/../server/app.js', '/%2e%2e/package.json', '/js/%2e%2e/server/app.js', '/js/..%5cserver%5capp.js', '/.claude/launch.json']) {
        const r = await req(base, p);
        assert.equal(r.status, 404, p);
      }
    });
  });

  describe('authentication', () => {
    it('rejects API calls without a session', async () => {
      for (const p of ['/api/me', '/api/state', '/api/kpis', '/api/audit']) assert.equal((await req(base, p)).status, 401, p);
    });
    it('gives the same generic error for a wrong password and an unknown user', async () => {
      const a = await req(base, '/api/login', { method: 'POST', body: { username: 'ceo', password: 'wrong password 123' } });
      const b = await req(base, '/api/login', { method: 'POST', body: { username: 'nobody', password: 'wrong password 123' } });
      assert.equal(a.status, 401); assert.equal(b.status, 401);
      assert.equal(a.json.error, b.json.error);
    });
    it('sets a hardened session cookie and returns the server-side role', async () => {
      const r = await req(base, '/api/login', { method: 'POST', body: { username: 'KHI.Dept', password: PW } });
      assert.equal(r.status, 200);
      const sc = r.headers.get('set-cookie');
      assert.match(sc, /HttpOnly/i); assert.match(sc, /SameSite=Strict/i); assert.match(sc, /Path=\//);
      assert.equal(r.json.user.role, 'dept');
      assert.equal(r.json.user.plant, 'KHI');
      assert.equal(r.json.user.passHash, undefined);
    });
    it('locks login after repeated failures, even with the right password', async () => {
      for (let i = 0; i < 5; i++) await req(base, '/api/login', { method: 'POST', body: { username: 'lockme', password: 'bad password ' + i } });
      const r = await req(base, '/api/login', { method: 'POST', body: { username: 'lockme', password: PW } });
      assert.equal(r.status, 429);
    });
    it('logout invalidates the session server-side', async () => {
      const c = await login('ceo');
      assert.equal((await req(base, '/api/me', { cookie: c })).status, 200);
      assert.equal((await req(base, '/api/logout', { method: 'POST', cookie: c })).status, 204);
      assert.equal((await req(base, '/api/me', { cookie: c })).status, 401);
    });
    it('expires sessions after the configured lifetime', async () => {
      const c = await login('expire');
      now += 13 * 3600e3;
      assert.equal((await req(base, '/api/me', { cookie: c })).status, 401);
    });
    it('changes a password only with the current one and a strong new one', async () => {
      const c = await login('pwuser');
      assert.equal((await req(base, '/api/me/password', { method: 'POST', cookie: c, body: { current: 'nope nope nope', next: 'a brand new passphrase' } })).status, 401);
      assert.equal((await req(base, '/api/me/password', { method: 'POST', cookie: c, body: { current: PW, next: 'short' } })).status, 400);
      assert.equal((await req(base, '/api/me/password', { method: 'POST', cookie: c, body: { current: PW, next: 'a brand new passphrase' } })).status, 204);
      assert.equal((await req(base, '/api/login', { method: 'POST', body: { username: 'pwuser', password: PW } })).status, 401);
      await login('pwuser', 'a brand new passphrase');
    });
  });

  describe('request hardening', () => {
    it('blocks cross-site state changes (Origin check)', async () => {
      const c = await login('ceo');
      const r = await req(base, '/api/actions/F07/d8', { method: 'POST', cookie: c, headers: { origin: 'https://evil.example' }, body: { index: 0, checked: true, version: 1 } });
      assert.equal(r.status, 403);
    });
    it('requires JSON bodies', async () => {
      const r = await req(base, '/api/login', { method: 'POST', raw: 'username=ceo', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
      assert.equal(r.status, 415);
    });
    it('rejects malformed JSON and oversized bodies', async () => {
      assert.equal((await req(base, '/api/login', { method: 'POST', raw: '{bad', headers: { 'content-type': 'application/json' } })).status, 400);
      const big = JSON.stringify({ username: 'x'.repeat(300000), password: 'y' });
      assert.equal((await req(base, '/api/login', { method: 'POST', raw: big, headers: { 'content-type': 'application/json' } })).status, 413);
    });
    it('returns 404 for unknown API routes and actions', async () => {
      const c = await login('ceo');
      assert.equal((await req(base, '/api/nope', { cookie: c })).status, 404);
      assert.equal((await req(base, '/api/actions/F999/transition', { method: 'POST', cookie: c, body: { to: 'diagnosed', version: 1 } })).status, 404);
    });
  });

  describe('corrective-action workflow (server-enforced)', () => {
    let ceo, dept, khiPlant;
    before(async () => { ceo = await login('ceo'); dept = await login('khi.dept'); khiPlant = await login('khi.plant'); });
    const move = (c, id, to, version, extra = {}) => req(base, `/api/actions/${id}/transition`, { method: 'POST', cookie: c, body: { to, version, ...extra } });

    it('starts every finding at Detected with an empty-history version 1', async () => {
      const s = await state(ceo);
      assert.equal(Object.keys(s.actions).length, 33);
      assert.ok(Object.values(s.actions).every(a => a.stage === 'detected' && a.version === 1 && a.d8.length === 8));
      assert.equal(s.user.role, 'ceo');
    });
    it('lets a department head diagnose in their own plant', async () => {
      const r = await move(dept, 'F07', 'diagnosed', 1);
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.action.stage, 'diagnosed');
      assert.equal(r.json.action.version, 2);
    });
    it('refuses approval by a department head (role checked on the server)', async () => {
      const r = await move(dept, 'F07', 'approved', 2);
      assert.equal(r.status, 403);
      assert.equal((await state(ceo)).actions.F07.stage, 'diagnosed');
    });
    it('rejects a stale version (two people editing at once)', async () => {
      assert.equal((await move(ceo, 'F07', 'approved', 1)).status, 409);
    });
    it('refuses to skip a stage', async () => {
      assert.equal((await move(ceo, 'F07', 'in_progress', 2)).status, 422);
    });
    it('lets the CEO approve and records who did it', async () => {
      const r = await move(ceo, 'F07', 'approved', 2);
      assert.equal(r.status, 200);
      const s = await state(ceo);
      assert.equal(s.actions.F07.stage, 'approved');
      assert.match(s.log[0].e, /F07/); assert.equal(s.log[0].r, 'ceo'); assert.equal(s.log[0].u, 'ceo');
      assert.ok(s.actions.F07.hist.some(h => /Approved/.test(h.e)));
    });
    it('keeps plant heads inside their plant', async () => {
      const fsd = (await state(ceo)).actions.F01; // F01 is a Faisalabad finding
      assert.equal((await move(khiPlant, 'F01', 'diagnosed', fsd.version)).status, 403);
    });
    it('needs a measured value to verify, then judges effectiveness', async () => {
      assert.equal((await move(dept, 'F07', 'in_progress', 3)).status, 200);
      assert.equal((await move(dept, 'F07', 'verified', 4)).status, 422);
      assert.equal((await move(dept, 'F07', 'verified', 4, { after: -3 })).status, 422);
      const r = await move(dept, 'F07', 'verified', 4, { after: 80 }); // target is 95 (up)
      assert.equal(r.status, 200);
      assert.equal(r.json.action.after, 80);
      assert.equal(r.json.action.effective, false);
    });
    it('reopens an ineffective fix back to Diagnosed, but never an effective one', async () => {
      const r = await req(base, '/api/actions/F07/reopen', { method: 'POST', cookie: dept, body: { version: 5 } });
      assert.equal(r.status, 200);
      assert.equal(r.json.action.stage, 'diagnosed');
      assert.equal(r.json.action.after, null);
      // drive F12 (KHI cutting, target 86 up) to an effective verification
      let v = 1;
      for (const [c, to] of [[dept, 'diagnosed'], [ceo, 'approved'], [dept, 'in_progress']]) { assert.equal((await move(c, 'F12', to, v)).status, 200); v++; }
      const ok = await move(dept, 'F12', 'verified', v, { after: 86 });
      assert.equal(ok.json.action.effective, true);
      assert.equal((await req(base, '/api/actions/F12/reopen', { method: 'POST', cookie: dept, body: { version: v + 1 } })).status, 422);
    });
    it('stores 8D checklist ticks and validates the index', async () => {
      const v = (await state(ceo)).actions.F09.version;
      const r = await req(base, '/api/actions/F09/d8', { method: 'POST', cookie: dept, body: { index: 2, checked: true, version: v } });
      assert.equal(r.status, 200);
      assert.equal(r.json.action.d8[2], true);
      assert.equal((await req(base, '/api/actions/F09/d8', { method: 'POST', cookie: dept, body: { index: 9, checked: true, version: v + 1 } })).status, 400);
    });
    it('does not let integration or admin accounts move actions', async () => {
      const feed = await login('feed'); const admin = await login('admin');
      const v = (await state(ceo)).actions.F02.version;
      assert.equal((await move(feed, 'F02', 'diagnosed', v)).status, 403);
      assert.equal((await move(admin, 'F02', 'diagnosed', v)).status, 403);
    });
  });

  describe('tamper-evident audit log', () => {
    it('verifies the hash chain for authorised roles only', async () => {
      const ceo = await login('ceo'); const dept = await login('khi.dept');
      const r = await req(base, '/api/audit/verify', { cookie: ceo });
      assert.equal(r.status, 200);
      assert.equal(r.json.ok, true);
      assert.ok(r.json.count > 5);
      assert.equal((await req(base, '/api/audit/verify', { cookie: dept })).status, 403);
    });
    it('refuses UPDATE and DELETE on the audit table at the database level', () => {
      assert.throws(() => app.db.exec("UPDATE audit_log SET action = 'x' WHERE id = 1"), /append-only/);
      assert.throws(() => app.db.exec('DELETE FROM audit_log WHERE id = 1'), /append-only/);
    });
    it('detects a row edited behind the triggers', async () => {
      app.db.exec('DROP TRIGGER audit_no_update');
      app.db.exec("UPDATE audit_log SET detail = '{\"forged\":true}' WHERE id = 2");
      const ceo = await login('ceo');
      const r = await req(base, '/api/audit/verify', { cookie: ceo });
      assert.equal(r.json.ok, false);
      assert.equal(r.json.brokenAt, 2);
    });
  });

  describe('KPI ingestion (real data in)', () => {
    const rec = (o = {}) => ({ section: 'dyeing', kpi: 'Right-first-time dyeing', value: 81.5, asOf: '2026-11-24T18:00:00Z', ...o });
    it('accepts a valid batch from an integration account and serves the latest value', async () => {
      const feed = await login('feed');
      const r = await req(base, '/api/kpis/ingest', { method: 'POST', cookie: feed, body: { source: 'MES-KHI', records: [rec(), rec({ value: 79, asOf: '2026-11-23T18:00:00Z' })] } });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.accepted, 2);
      const ceo = await login('ceo');
      const k = (await req(base, '/api/kpis', { cookie: ceo })).json.kpis;
      const rft = k.find(x => x.section === 'dyeing' && x.kpi === 'Right-first-time dyeing');
      assert.equal(rft.value, 81.5);
      assert.equal(rft.source, 'MES-KHI');
    });
    it('rejects the whole batch if any record is invalid', async () => {
      const feed = await login('feed');
      for (const bad of [rec({ section: 'nope' }), rec({ kpi: 'Made-up KPI' }), rec({ value: 'abc' }), rec({ value: -1 }), rec({ asOf: '2030-01-01T00:00:00Z' }), rec({ asOf: 'yesterday' })]) {
        const r = await req(base, '/api/kpis/ingest', { method: 'POST', cookie: feed, body: { source: 'MES-KHI', records: [rec({ value: 90 }), bad] } });
        assert.equal(r.status, 422, JSON.stringify(bad));
        assert.ok(Array.isArray(r.json.errors) && r.json.errors.length === 1);
      }
      const ceo = await login('ceo');
      const k = (await req(base, '/api/kpis', { cookie: ceo })).json.kpis;
      assert.equal(k.find(x => x.kpi === 'Right-first-time dyeing').value, 81.5, 'nothing from rejected batches stored');
    });
    it('rejects a bad source name, empty or huge batches', async () => {
      const feed = await login('feed');
      assert.equal((await req(base, '/api/kpis/ingest', { method: 'POST', cookie: feed, body: { source: '<script>', records: [rec()] } })).status, 422);
      assert.equal((await req(base, '/api/kpis/ingest', { method: 'POST', cookie: feed, body: { source: 'MES', records: [] } })).status, 422);
      assert.equal((await req(base, '/api/kpis/ingest', { method: 'POST', cookie: feed, body: { source: 'MES', records: Array(501).fill(rec()) } })).status, 422);
    });
    it('only integration and admin accounts can ingest', async () => {
      const ceo = await login('ceo');
      assert.equal((await req(base, '/api/kpis/ingest', { method: 'POST', cookie: ceo, body: { source: 'MES', records: [rec()] } })).status, 403);
    });
  });
});
