'use strict';
/* Textile AI Audit — API + static server (modular monolith, Node built-ins only). */
const http = require('node:http');
const net = require('node:net');
const { openDb, tx } = require('./db');
const audit = require('./audit');
const { makeUsers, ValidationError } = require('./users');
const { makeActions } = require('./actions');
const { makeKpis } = require('./kpis');
const { HttpError } = require('./errors');
const sec = require('./security');
const { securityHeaders, sendJson, readJson, buildStaticMap, serveStatic, parseCookies } = require('./http');

const DEFAULTS = { dbPath: ':memory:', secureCookies: false, publicOrigin: null, trustProxy: false, sessionTtlHours: 12, loginMaxFailures: 5 };
const LOCK_WINDOW_MS = 15 * 60e3;
const IP_MAX_FAILURES = 50;
const MAX_TRACKED = 10000; // cap on throttle entries held in memory
const AUDIT_VIEWERS = ['ceo', 'finance', 'admin'];
const INGESTERS = ['integration', 'admin'];

function createApp(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const clock = options.clock || Date.now;
  const iso = () => new Date(clock()).toISOString();
  const db = openDb(cfg.dbPath);
  const users = makeUsers(db, clock);
  const actions = makeActions(db, clock);
  const kpis = makeKpis(db, clock);
  actions.seedIfEmpty();
  const statics = buildStaticMap();
  const cookieName = cfg.secureCookies ? '__Host-ta_sid' : 'ta_sid';
  const ttlMs = cfg.sessionTtlHours * 3600e3;

  // ---------------- login throttling (per user+IP and per IP; single-instance memory) ----------------
  const failures = new Map();
  function failureCount(key) {
    const f = failures.get(key);
    if (!f || clock() - f.first > LOCK_WINDOW_MS) { failures.delete(key); return 0; }
    return f.count;
  }
  function addFailure(key) {
    const now = clock();
    const f = failures.get(key);
    if (!f || now - f.first > LOCK_WINDOW_MS) failures.set(key, { count: 1, first: now }); else f.count++;
    if (failures.size > MAX_TRACKED) {
      for (const [k, v] of failures) if (now - v.first > LOCK_WINDOW_MS) failures.delete(k);
      for (const k of failures.keys()) { if (failures.size <= MAX_TRACKED) break; failures.delete(k); } // oldest first
    }
  }
  /** Count the attempt BEFORE the slow password check, so a parallel burst cannot all pass the limit check. */
  function reserve(keys, limits) {
    if (keys.some((k, i) => failureCount(k) >= limits[i])) return false;
    keys.forEach(addFailure);
    return true;
  }
  function release(key) {
    const f = failures.get(key);
    if (f && --f.count <= 0) failures.delete(key);
  }
  const record = entry => tx(db, () => audit.append(db, entry)); // serialised with every other writer (CLI included)

  // Only the RIGHTMOST X-Forwarded-For entry is written by our own proxy; anything left of it came from the client.
  const clientIp = req => {
    if (cfg.trustProxy) {
      const parts = String(req.headers['x-forwarded-for'] || '').split(',');
      const ip = parts[parts.length - 1].trim();
      if (net.isIP(ip)) return ip;
    }
    return String(req.socket.remoteAddress || 'unknown').slice(0, 64);
  };
  const logFor = (user, n = 200) => (AUDIT_VIEWERS.includes(user.role) ? audit.recent(db, n) : []);

  // ---------------- sessions ----------------
  function sessionUser(req) {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (!token || token.length > 100) return null;
    const row = db.prepare(`SELECT u.*, s.id_hash FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id_hash = ? AND s.expires_at > ? AND u.active = 1`).get(sec.sha256(token), clock());
    return row || null;
  }
  function startSession(res, user) {
    const token = sec.newToken();
    const now = clock();
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    db.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(sec.sha256(token), user.id, now, now + ttlMs);
    res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(ttlMs / 1000)}${cfg.secureCookies ? '; Secure' : ''}`);
  }
  const clearCookie = res => res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${cfg.secureCookies ? '; Secure' : ''}`);

  // ---------------- CSRF defence for state-changing requests ----------------
  function checkOrigin(req) {
    const origin = req.headers.origin;
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Cross-site request blocked.');
    if (!origin) return; // non-browser clients (feeds, CLI); browsers always send Origin on POST
    const expected = cfg.publicOrigin || `${cfg.secureCookies ? 'https' : 'http'}://${req.headers.host}`;
    if (origin !== expected) throw new HttpError(403, 'Cross-site request blocked.');
  }

  const requireUser = req => { const u = sessionUser(req); if (!u) throw new HttpError(401, 'Please sign in.'); return u; };
  const requireRole = (u, roles) => { if (!roles.includes(u.role)) throw new HttpError(403, 'Your role cannot do this.'); };

  // ---------------- routes ----------------
  async function api(req, res, pathname, query) {
    const m = req.method;
    if (m !== 'GET' && m !== 'HEAD') checkOrigin(req);

    if (m === 'POST' && pathname === '/api/login') {
      const body = await readJson(req);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = body.password;
      if (!username || username.length > 64 || typeof password !== 'string' || password.length > sec.MAX_PW) throw new HttpError(400, 'Enter a username and password.');
      const ip = clientIp(req);
      const userKey = `${ip}|${username.toLowerCase()}`, ipKey = `ip|${ip}`;
      if (!reserve([userKey, ipKey], [cfg.loginMaxFailures, IP_MAX_FAILURES])) {
        return sendJson(res, 429, { error: 'Too many failed sign-ins. Try again in 15 minutes.' }, { 'Retry-After': String(LOCK_WINDOW_MS / 1000) });
      }
      const row = users.byUsername(username);
      const ok = row ? await sec.verifyPassword(password, row.pass_hash) : await sec.dummyVerify(password);
      if (!ok) {
        // Unknown names are not stored: people sometimes type their password into the username box.
        const who = row ? row.username : null;
        record({ ts: iso(), user: null, action: 'auth.login_failed', target: null, detail: { username: who, ip, msg: who ? `Failed sign-in for ${who}` : 'Failed sign-in for an unknown username' } });
        throw new HttpError(401, 'Wrong username or password.');
      }
      failures.delete(userKey); release(ipKey);
      startSession(res, row);
      record({ ts: iso(), user: row, action: 'auth.login', target: null, detail: { ip, msg: `${row.username} signed in` } });
      return sendJson(res, 200, { user: users.pub(row) });
    }

    if (m === 'POST' && pathname === '/api/logout') {
      const u = sessionUser(req);
      if (u) {
        db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(u.id_hash);
        record({ ts: iso(), user: u, action: 'auth.logout', target: null, detail: { msg: `${u.username} signed out` } });
      }
      clearCookie(res);
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }

    const user = requireUser(req);

    if (m === 'GET' && pathname === '/api/me') return sendJson(res, 200, { user: users.pub(user) });

    if (m === 'POST' && pathname === '/api/me/password') {
      const body = await readJson(req);
      const pwKey = `pw|${user.id}`;
      if (!reserve([pwKey], [cfg.loginMaxFailures])) return sendJson(res, 429, { error: 'Too many wrong attempts. Try again in 15 minutes.' }, { 'Retry-After': String(LOCK_WINDOW_MS / 1000) });
      if (!(await sec.verifyPassword(body.current, user.pass_hash))) throw new HttpError(401, 'Current password is wrong.');
      failures.delete(pwKey);
      try { await users.setPassword(user.id, body.next); } catch (e) { if (e instanceof ValidationError) throw new HttpError(400, e.message); throw e; }
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash <> ?').run(user.id, user.id_hash);
      record({ ts: iso(), user, action: 'auth.password_changed', target: null, detail: { msg: `${user.username} changed their password` } });
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }

    if (m === 'GET' && pathname === '/api/state') {
      return sendJson(res, 200, { user: users.pub(user), actions: actions.all(), log: logFor(user), kpis: kpis.latest(), serverTime: iso() });
    }

    const am = pathname.match(/^\/api\/actions\/(F\d{2,3})\/(transition|reopen|d8)$/);
    if (m === 'POST' && am) {
      const body = await readJson(req);
      const [, id, op] = am;
      const action = op === 'transition' ? actions.transition(user, id, body) : op === 'reopen' ? actions.reopen(user, id, body) : actions.setD8(user, id, body);
      return sendJson(res, 200, { action, log: logFor(user) });
    }
    if (/^\/api\/actions\/[^/]+\/(transition|reopen|d8)$/.test(pathname) && m === 'POST') throw new HttpError(404, 'No such action.');

    if (m === 'GET' && pathname === '/api/audit') {
      requireRole(user, AUDIT_VIEWERS);
      const limit = Math.min(500, Math.max(1, Number.parseInt(query.get('limit') || '200', 10) || 200));
      return sendJson(res, 200, { entries: audit.recent(db, limit) });
    }
    if (m === 'GET' && pathname === '/api/audit/verify') {
      requireRole(user, AUDIT_VIEWERS);
      return sendJson(res, 200, audit.verify(db));
    }

    if (m === 'GET' && pathname === '/api/kpis') return sendJson(res, 200, { kpis: kpis.latest() });
    if (m === 'POST' && pathname === '/api/kpis/ingest') {
      requireRole(user, INGESTERS);
      return sendJson(res, 200, kpis.ingest(user, await readJson(req)));
    }

    throw new HttpError(404, 'Not found.');
  }

  async function handle(req, res) {
    securityHeaders(res, cfg);
    let url;
    try { url = new URL(req.url, 'http://local'); } catch { return sendJson(res, 400, { error: 'Bad URL.' }); }
    const pathname = url.pathname;
    if (pathname === '/healthz') {
      let ok = true;
      try { db.prepare('SELECT 1').get(); } catch { ok = false; }
      return sendJson(res, ok ? 200 : 503, { ok, db: ok });
    }
    if (pathname.startsWith('/api/')) return api(req, res, pathname, url.searchParams);
    return serveStatic(statics, req, res, pathname);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(err => {
      if (res.headersSent) { res.destroy(); return; }
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message, ...(err.extra || {}) });
      console.error(`[${iso()}] ${req.method} ${req.url} failed:`, err);
      sendJson(res, 500, { error: 'Something went wrong on the server.' });
    });
  });
  server.requestTimeout = 30e3;
  server.headersTimeout = 15e3;

  return {
    db, users, actions, kpis, server, config: cfg,
    listen(port = 0, host = '127.0.0.1') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(`http://${host}:${server.address().port}`));
      });
    },
    close() {
      return new Promise(resolve => {
        server.close(() => { try { db.close(); } catch { /* already closed */ } resolve(); });
        if (server.closeAllConnections) server.closeAllConnections();
      });
    },
  };
}

module.exports = { createApp };
