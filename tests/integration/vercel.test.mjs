// The Vercel entry point (api/index.js) and the static build (scripts/build-static.js), exercised locally.
// This checks our side of the contract; the real Vercel platform is only exercised by a deployment.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { loadConfig } = require('../../server/config.js');
const ENV_KEYS = ['NODE_ENV', 'DB_URL', 'DB_AUTH_TOKEN', 'DB_PATH', 'VERCEL', 'PUBLIC_ORIGIN', 'TRUST_PROXY', 'SECURE_COOKIES'];

function freshEntry(env) {
  const saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  const file = require.resolve('../../api/index.js');
  delete require.cache[file];
  const handler = require(file);
  const restore = () => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } };
  return { handler, restore };
}
const serve = handler => new Promise(resolve => {
  const server = http.createServer((req, res) => handler(req, res));
  server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
});
async function req(base, p, { method = 'GET', body } = {}) {
  const r = await fetch(base + p, { method, headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, headers: r.headers };
}

describe('Vercel function entry (api/index.js)', () => {
  let s, restore;
  before(async () => {
    const e = freshEntry({ NODE_ENV: 'development', DB_PATH: ':memory:' });
    restore = e.restore;
    s = await serve(e.handler);
  });
  after(() => { s.server.close(); restore(); });

  it('answers the health check on the original path', async () => {
    const r = await req(s.base, '/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, db: true });
  });

  it('routes the rewritten form /api/index?__path=… to the real route', async () => {
    assert.equal((await req(s.base, '/api/index?__path=health')).status, 200);
    const login = await req(s.base, '/api/index?__path=login', { method: 'POST', body: { username: 'nobody', password: 'wrong wrong wrong' } });
    assert.equal(login.status, 401, 'the JSON body is still readable after the rewrite');
    assert.equal((await req(s.base, '/api/index?__path=me')).status, 401);
  });

  it('a path smuggled through __path cannot reach files, only API routes', async () => {
    assert.equal((await req(s.base, '/api/index?__path=../../package.json')).status, 404);
    assert.equal((await req(s.base, '/api/index?__path=..%2F..%2Fdata%2Fdev-credentials.txt')).status, 404);
  });

  it('rejects a request that carries __path twice (the route would be ambiguous)', async () => {
    const r = await req(s.base, '/api/index?__path=health&__path=login');
    assert.equal(r.status, 400);
  });

  it('does not serve the dashboard files itself (the CDN does), and sends security headers', async () => {
    const r = await req(s.base, '/index.html');
    assert.equal(r.status, 404);
    assert.match(r.headers.get('content-security-policy') || '', /default-src 'self'/);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
  });
});

describe('Vercel function entry when misconfigured', () => {
  it('returns 503 JSON instead of crashing when DB_URL is missing on Vercel', async () => {
    const e = freshEntry({ NODE_ENV: 'production', VERCEL: '1', PUBLIC_ORIGIN: 'https://audit.example.com', TRUST_PROXY: 'true' });
    const s = await serve(e.handler);
    const origError = console.error; console.error = () => {};
    try {
      const r = await req(s.base, '/api/health');
      assert.equal(r.status, 503);
      assert.match(r.json.error, /configur/i);
      assert.doesNotMatch(JSON.stringify(r.json), /DB_AUTH_TOKEN|libsql:/, 'no configuration details leak to the browser');
    } finally {
      console.error = origError;
      s.server.close();
      e.restore();
    }
  });
});

describe('static build for Vercel (scripts/build-static.js)', () => {
  let out;
  before(() => {
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'ta-public-'));
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-static.js'), out]);
  });
  after(() => fs.rmSync(out, { recursive: true, force: true }));

  it('publishes the dashboard files', () => {
    for (const f of ['index.html', 'css/styles.css', 'js/app.js', 'js/measure.js', 'js/data.js']) assert.ok(fs.existsSync(path.join(out, f)), f);
  });
  it('publishes nothing from the server, tests, data or config', () => {
    const all = [];
    const walk = d => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else all.push(path.relative(out, p).split(path.sep).join('/')); } };
    walk(out);
    for (const f of all) assert.match(f, /^(index\.html|css\/[\w.-]+\.css|js\/[\w.-]+\.js)$/, `unexpected public file ${f}`);
  });
  it('refuses to build into a project folder other than public/ (it empties the folder first)', () => {
    for (const dir of ['server', 'js', path.join('data', 'x')]) {
      assert.throws(() => execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-static.js'), path.join(ROOT, dir)], { stdio: 'pipe' }), /Refusing/, dir);
    }
    assert.ok(fs.existsSync(path.join(ROOT, 'server', 'app.js')), 'server/ is untouched');
  });
});

describe('DB_URL validation', () => {
  const env = { DB_AUTH_TOKEN: 'token' };
  it('accepts a bare Turso host, with or without a port', () => {
    assert.equal(loadConfig({ ...env, DB_URL: 'libsql://audit-me.turso.io' }).dbPath, 'libsql://audit-me.turso.io');
    assert.ok(loadConfig({ ...env, DB_URL: 'https://audit-me.turso.io:443/' }));
  });
  it('rejects anything with credentials, a query, a path or odd characters', () => {
    for (const bad of ['libsql://user:pw@audit.turso.io', 'libsql://audit.turso.io?authToken=x', 'libsql://audit.turso.io/db', 'libsql://audit_turso.io#x', 'http://audit.turso.io', 'file:/etc/passwd']) {
      assert.throws(() => loadConfig({ ...env, DB_URL: bad }), /DB_URL/, bad);
    }
  });
});
