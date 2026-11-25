// Security regression tests for the findings of the independent review (real HTTP + in-memory SQLite).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.js');
const { loadConfig } = require('../../server/config.js');

const PW = 'correct horse battery 9';

async function req(base, path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, headers: r.headers, json };
}
const cookieOf = res => (res.headers.get('set-cookie') || '').split(';')[0];

async function boot(opts = {}) {
  const app = createApp({ dbPath: ':memory:', loginMaxFailures: 5, ...opts });
  for (const [username, role, plant] of [['ceo', 'ceo', 'all'], ['khi.dept', 'dept', 'KHI'], ['victim', 'dept', 'KHI'], ['racer', 'dept', 'KHI'], ['pwguess', 'dept', 'KHI']]) {
    await app.users.create({ username, displayName: username, role, plant, password: PW });
  }
  const base = await app.listen(0);
  const login = async u => { const r = await req(base, '/api/login', { method: 'POST', body: { username: u, password: PW } }); assert.equal(r.status, 200); return cookieOf(r); };
  return { app, base, login };
}

describe('security hardening (review findings)', () => {
  describe('behind a trusted proxy', () => {
    let t;
    before(async () => { t = await boot({ trustProxy: true }); });
    after(() => t.app.close());

    it('ignores client-supplied X-Forwarded-For entries, so spoofing cannot reset the lockout', async () => {
      let last;
      for (let i = 0; i < 7; i++) {
        // A real proxy appends the true client address on the right; everything left of it is attacker-controlled.
        last = await req(t.base, '/api/login', { method: 'POST', body: { username: 'victim', password: 'wrong wrong wrong' }, headers: { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.7` } });
      }
      assert.equal(last.status, 429);
    });
    it('records a bounded, valid IP in the audit log, never the raw header', async () => {
      await req(t.base, '/api/login', { method: 'POST', body: { username: 'ceo', password: 'nope nope nope' }, headers: { 'x-forwarded-for': `${'x'.repeat(5000)}, not-an-ip` } });
      const rows = t.app.db.prepare("SELECT detail FROM audit_log WHERE action = 'auth.login_failed'").all();
      for (const r of rows) assert.ok(r.detail.length < 400, 'audit detail must stay small');
    });
  });

  describe('default app', () => {
    let t;
    before(async () => { t = await boot(); });
    after(() => t.app.close());

    it('does not let a parallel burst of guesses slip past the lockout', async () => {
      const burst = await Promise.all(Array.from({ length: 12 }, () => req(t.base, '/api/login', { method: 'POST', body: { username: 'racer', password: 'wrong wrong wrong' } })));
      const wrong = burst.filter(r => r.status === 401).length;
      assert.ok(wrong <= 5, `only 5 guesses may be evaluated, got ${wrong}`);
      assert.equal(burst.filter(r => r.status === 429).length, 12 - wrong);
    });
    it('never writes the typed text of an unknown username into the audit log', async () => {
      await req(t.base, '/api/login', { method: 'POST', body: { username: 'MySecretPass123', password: 'whatever whatever' } });
      const all = t.app.db.prepare('SELECT detail FROM audit_log').all().map(r => r.detail).join('\n');
      assert.doesNotMatch(all, /MySecretPass123/);
    });
    it('shows the audit log only to audit roles (state, action responses and /api/audit)', async () => {
      const dept = await t.login('khi.dept');
      const ceo = await t.login('ceo');
      const st = (await req(t.base, '/api/state', { cookie: dept })).json;
      assert.deepEqual(st.log, []);
      assert.ok(Array.isArray(st.actions.F07.hist), 'per-action history stays visible');
      const moved = await req(t.base, '/api/actions/F07/transition', { method: 'POST', cookie: dept, body: { to: 'diagnosed', version: st.actions.F07.version } });
      assert.equal(moved.status, 200);
      assert.deepEqual(moved.json.log, []);
      assert.equal((await req(t.base, '/api/audit', { cookie: dept })).status, 403);
      assert.ok((await req(t.base, '/api/state', { cookie: ceo })).json.log.length > 0);
      assert.equal((await req(t.base, '/api/audit', { cookie: ceo })).status, 200);
    });
    it('freezes the 8D checklist once an action is verified', async () => {
      const ceo = await t.login('ceo');
      let v = (await req(t.base, '/api/state', { cookie: ceo })).json.actions.F01.version;
      for (const [to, extra] of [['diagnosed'], ['approved'], ['in_progress'], ['verified', { after: 1 }]]) {
        const r = await req(t.base, '/api/actions/F01/transition', { method: 'POST', cookie: ceo, body: { to, version: v, ...(extra || {}) } });
        assert.equal(r.status, 200, to);
        v = r.json.action.version;
      }
      const r = await req(t.base, '/api/actions/F01/d8', { method: 'POST', cookie: ceo, body: { index: 7, checked: false, version: v } });
      assert.equal(r.status, 422);
    });
    it('limits guesses of the current password on a hijacked session', async () => {
      const c = await t.login('pwguess');
      for (let i = 0; i < 5; i++) await req(t.base, '/api/me/password', { method: 'POST', cookie: c, body: { current: 'guess guess guess', next: 'another long passphrase' } });
      const r = await req(t.base, '/api/me/password', { method: 'POST', cookie: c, body: { current: PW, next: 'another long passphrase' } });
      assert.equal(r.status, 429);
    });
  });

  describe('production config', () => {
    const base = { NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://audit.example.com' };
    it('refuses to start unless TRUST_PROXY is set explicitly', () => {
      assert.throws(() => loadConfig(base), /TRUST_PROXY/);
      assert.equal(loadConfig({ ...base, TRUST_PROXY: 'false' }).trustProxy, false);
      assert.equal(loadConfig({ ...base, TRUST_PROXY: 'true' }).trustProxy, true);
    });
  });
});
