'use strict';
/* Textile AI Audit — API + static server (modular monolith).
 * createApp() returns a plain (req, res) handler, so the same code runs as a long-lived Node server
 * (npm start / npm run dev) and as a Vercel function (api/index.js). Nothing that several instances must agree on
 * lives in memory: sessions, sign-in throttling and the measured-cache version are all in the database. */
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const { openDb } = require('./db');
const audit = require('./audit');
const { makeUsers, ValidationError } = require('./users');
const { makeActions } = require('./actions');
const { makeKpis } = require('./kpis');
const { makeRecords } = require('./records');
const { makeMeasured } = require('./measured');
const { makeUsage } = require('./usage');
const { makeAlerts } = require('./alerts');
const { makeReports } = require('./reports');
const { makeOcr } = require('./ocr');
const M = require('../js/measure.js');
const { HttpError } = require('./errors');
const sec = require('./security');
const { securityHeaders, sendJson, readJson, buildStaticMap, serveStatic, parseCookies } = require('./http');

const DEFAULTS = { dbPath: ':memory:', dbAuthToken: null, cronSecret: null, secureCookies: false, publicOrigin: null, trustProxy: false, sessionTtlHours: 12, loginMaxFailures: 5, serveStatic: true };
const LOCK_WINDOW_MS = 15 * 60e3;
const IP_MAX_FAILURES = 50;
const THROTTLE_PURGE_CHANCE = 0.05; // about one sign-in attempt in 20 also deletes expired throttle rows
const AUDIT_VIEWERS = ['ceo', 'finance', 'admin'];
const INGESTERS = ['integration', 'admin'];
const DASHBOARD_READERS = ['ceo', 'plant', 'dept', 'finance', 'admin']; // operators and feeds only enter data
const REPORT_READERS = AUDIT_VIEWERS; // the CEO report summary and the usage & cost dashboard
const REPORT_ADMINS = ['ceo', 'admin']; // may change the report schedule or generate one now

async function createApp(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const clock = options.clock || Date.now;
  const iso = () => new Date(clock()).toISOString();
  const db = await openDb(cfg.dbPath, { authToken: cfg.dbAuthToken });
  const users = makeUsers(db, clock);
  const actions = makeActions(db, clock);
  const kpis = makeKpis(db, clock);
  const records = makeRecords(db, clock);
  const usage = makeUsage(db, clock);
  const measured = makeMeasured(records, clock, {
    onCycle: c => usage.log('audit_cycle', { ms: c.ms, gatherMs: c.gatherMs, computeMs: c.computeMs, detail: { trigger: 'dashboard', plant: c.plant, period: c.period, records: c.records } }),
  });
  const alerts = makeAlerts(db, clock, { records, usage });
  const reports = makeReports(db, clock, { records, actions, alerts, usage });
  const ocr = makeOcr(db, clock, { usage });

  /** The daily job (Vercel Cron, npm run cron, or any scheduler): alert sweep, the report if one is due, housekeeping. */
  async function runDaily() {
    const sweep = await alerts.sweep({ force: true });
    const report = await reports.runDue();
    const pruned = await usage.prune();
    return { ok: true, alerts: sweep, report: report ? { id: report.id, from: report.from, to: report.to, headline: report.headline } : null, pruned };
  }
  /** Work that is due anyway, done when someone opens the dashboard: a missed cron run never loses an alert or report. */
  async function catchUp(user) {
    try {
      await alerts.sweep();
      if (REPORT_READERS.includes(user.role)) await reports.runDue();
    } catch (e) { console.error(`[${iso()}] catch-up failed:`, e); }
  }
  const cronOk = req => {
    const m = /^Bearer (.{1,512})$/.exec(String(req.headers.authorization || ''));
    // Both sides hashed to the same length, then compared in constant time.
    return !!m && crypto.timingSafeEqual(Buffer.from(sec.sha256(m[1])), Buffer.from(sec.sha256(cfg.cronSecret)));
  };
  await actions.seedIfEmpty();
  const statics = cfg.serveStatic ? buildStaticMap() : new Map();
  const cookieName = cfg.secureCookies ? '__Host-ta_sid' : 'ta_sid';
  const ttlMs = cfg.sessionTtlHours * 3600e3;

  // ---------------- sign-in throttling (per user+IP and per IP), shared by every instance through the database ----------------
  // A counter whose window has passed counts as zero, so expired rows need no cleanup before a check; they are
  // purged now and then (not on every attempt, which would cost a DELETE per sign-in).
  /** True if any key has used up its limit in the current window. q: the database or an open transaction. */
  async function overLimit(q, keys, limits, since) {
    const rows = await q.all(`SELECT key, count FROM login_throttle WHERE key IN (${keys.map(() => '?').join(', ')}) AND first > ?`, [...keys, since]);
    return rows.some(r => r.count >= limits[keys.indexOf(r.key)]);
  }
  /** Count the attempt BEFORE the slow password check, so a parallel burst cannot all pass the limit check. */
  async function reserve(keys, limits) {
    const now = clock(), since = now - LOCK_WINDOW_MS;
    if (await overLimit(db, keys, limits, since)) return false; // already locked out: one read, no write lock taken
    return db.tx(async t => {
      if (await overLimit(t, keys, limits, since)) return false; // checked again under the lock
      if (Math.random() < THROTTLE_PURGE_CHANCE) await t.run('DELETE FROM login_throttle WHERE first <= ?', [since]);
      await t.run(`INSERT INTO login_throttle (key, count, first) VALUES ${keys.map(() => '(?, 1, ?)').join(', ')}
        ON CONFLICT(key) DO UPDATE SET count = CASE WHEN first <= ? THEN 1 ELSE count + 1 END, first = CASE WHEN first <= ? THEN ? ELSE first END`,
      [...keys.flatMap(k => [k, now]), since, since, now]);
      return true;
    });
  }
  /** Give back one reserved attempt per key inside transaction t (that attempt was not a failure). Only the
   *  attempt itself: earlier failures from the same address keep counting, even after someone else's success. */
  async function release(t, keys) {
    const ph = keys.map(() => '?').join(', ');
    await t.run(`UPDATE login_throttle SET count = count - 1 WHERE key IN (${ph})`, keys);
    await t.run(`DELETE FROM login_throttle WHERE key IN (${ph}) AND count <= 0`, keys);
  }
  const record = entry => db.tx(t => audit.append(t, entry)); // serialised with every other writer (CLI included)

  // Only the RIGHTMOST X-Forwarded-For entry is written by our own proxy; anything left of it came from the client.
  const clientIp = req => {
    if (cfg.trustProxy) {
      const parts = String(req.headers['x-forwarded-for'] || '').split(',');
      const ip = parts[parts.length - 1].trim();
      if (net.isIP(ip)) return ip;
    }
    return String((req.socket && req.socket.remoteAddress) || 'unknown').slice(0, 64);
  };
  const logFor = async (user, n = 200) => (AUDIT_VIEWERS.includes(user.role) ? audit.recent(db, n) : []);

  // ---------------- sessions ----------------
  async function sessionUser(req) {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (!token || token.length > 100) return null;
    const row = await db.get(`SELECT u.*, s.id_hash FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id_hash = ? AND s.expires_at > ? AND u.active = 1`, [sec.sha256(token), clock()]);
    return row || null;
  }
  /** Stores a new session inside transaction t and returns the cookie to send once it has committed. */
  async function startSession(t, user) {
    const token = sec.newToken();
    const now = clock();
    await t.run('DELETE FROM sessions WHERE expires_at <= ?', [now]);
    await t.run('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [sec.sha256(token), user.id, now, now + ttlMs]);
    return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(ttlMs / 1000)}${cfg.secureCookies ? '; Secure' : ''}`;
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

  const requireUser = async req => { const u = await sessionUser(req); if (!u) throw new HttpError(401, 'Please sign in.'); return u; };
  const requireRole = (u, roles) => { if (!roles.includes(u.role)) throw new HttpError(403, 'Your role cannot do this.'); };

  // ---------------- routes ----------------
  async function api(req, res, pathname, query) {
    const m = req.method;
    if (m !== 'GET' && m !== 'HEAD') checkOrigin(req);

    if (m === 'GET' && pathname === '/api/health') {
      let ok = true;
      try { await db.get('SELECT 1 AS one'); } catch { ok = false; }
      return sendJson(res, ok ? 200 : 503, { ok, db: ok });
    }

    if (m === 'POST' && pathname === '/api/login') {
      const body = await readJson(req);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = body.password;
      if (!username || username.length > 64 || typeof password !== 'string' || password.length > sec.MAX_PW) throw new HttpError(400, 'Enter a username and password.');
      const ip = clientIp(req), bucket = sec.ipBucket(ip);
      const userKey = `${bucket}|${username.toLowerCase()}`, ipKey = `ip|${bucket}`;
      if (!(await reserve([userKey, ipKey], [cfg.loginMaxFailures, IP_MAX_FAILURES]))) {
        return sendJson(res, 429, { error: 'Too many failed sign-ins. Try again in 15 minutes.' }, { 'Retry-After': String(LOCK_WINDOW_MS / 1000) });
      }
      const row = await users.byUsername(username);
      const ok = row ? await sec.verifyPassword(password, row.pass_hash) : await sec.dummyVerify(password);
      if (!ok) {
        // Unknown names are not stored: people sometimes type their password into the username box.
        const who = row ? row.username : null;
        await record({ ts: iso(), user: null, action: 'auth.login_failed', target: null, detail: { username: who, ip, msg: who ? `Failed sign-in for ${who}` : 'Failed sign-in for an unknown username' } });
        throw new HttpError(401, 'Wrong username or password.');
      }
      const cookie = await db.tx(async t => {
        await release(t, [userKey, ipKey]);
        const c = await startSession(t, row);
        await audit.append(t, { ts: iso(), user: row, action: 'auth.login', target: null, detail: { ip, msg: `${row.username} signed in` } });
        return c;
      });
      res.setHeader('Set-Cookie', cookie);
      return sendJson(res, 200, { user: users.pub(row) });
    }

    if (pathname === '/api/cron/daily' && (m === 'GET' || m === 'POST')) {
      if (!cfg.cronSecret) throw new HttpError(503, 'Scheduled jobs are not configured on this server (set CRON_SECRET).');
      if (!cronOk(req)) throw new HttpError(401, 'Wrong or missing cron secret.');
      return sendJson(res, 200, await runDaily());
    }

    if (m === 'POST' && pathname === '/api/logout') {
      const u = await sessionUser(req);
      if (u) {
        await db.tx(async t => {
          await t.run('DELETE FROM sessions WHERE id_hash = ?', [u.id_hash]);
          await audit.append(t, { ts: iso(), user: u, action: 'auth.logout', target: null, detail: { msg: `${u.username} signed out` } });
        });
      }
      clearCookie(res);
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }

    const user = await requireUser(req);

    const me = async () => ({ ...users.pub(user), forms: M.formsFor(user), reviewForms: M.reviewableForms(user), pendingReviews: await records.pendingFor(user), canReadDashboards: DASHBOARD_READERS.includes(user.role) });
    if (m === 'GET' && pathname === '/api/me') return sendJson(res, 200, { user: await me() });

    if (m === 'POST' && pathname === '/api/me/password') {
      const body = await readJson(req);
      const pwKey = `pw|${user.id}`;
      if (!(await reserve([pwKey], [cfg.loginMaxFailures]))) return sendJson(res, 429, { error: 'Too many wrong attempts. Try again in 15 minutes.' }, { 'Retry-After': String(LOCK_WINDOW_MS / 1000) });
      if (!(await sec.verifyPassword(body.current, user.pass_hash))) throw new HttpError(401, 'Current password is wrong.');
      let hash;
      try { hash = await users.hashNewPassword(body.next); } catch (e) {
        if (!(e instanceof ValidationError)) throw e;
        await db.tx(t => release(t, [pwKey])); // the current password was right: this attempt is not a failure
        throw new HttpError(400, e.message);
      }
      // One transaction: the new password, signing out every other session, and the audit entry land together or not at all.
      await db.tx(async t => {
        await release(t, [pwKey]);
        await users.storePasswordHash(t, user.id, hash);
        await t.run('DELETE FROM sessions WHERE user_id = ? AND id_hash <> ?', [user.id, user.id_hash]);
        await audit.append(t, { ts: iso(), user, action: 'auth.password_changed', target: null, detail: { msg: `${user.username} changed their password` } });
      });
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }

    if (m === 'GET' && pathname === '/api/state') {
      const reader = DASHBOARD_READERS.includes(user.role);
      if (reader) await catchUp(user);
      const [meOut, acts, log, kpiList, alertCounts] = await Promise.all([me(), reader ? actions.all() : {}, logFor(user), reader ? kpis.latest() : [], reader ? alerts.counts(user) : null]);
      return sendJson(res, 200, { user: meOut, actions: reader ? acts : [], log, kpis: kpiList, alerts: alertCounts, serverTime: iso() });
    }

    const am = pathname.match(/^\/api\/actions\/(F\d{2,3})\/(transition|reopen|d8)$/);
    if (m === 'POST' && am) {
      const body = await readJson(req);
      const [, id, op] = am;
      const action = op === 'transition' ? await actions.transition(user, id, body) : op === 'reopen' ? await actions.reopen(user, id, body) : await actions.setD8(user, id, body);
      return sendJson(res, 200, { action, log: await logFor(user) });
    }
    if (/^\/api\/actions\/[^/]+\/(transition|reopen|d8)$/.test(pathname) && m === 'POST') throw new HttpError(404, 'No such action.');

    if (m === 'GET' && pathname === '/api/audit') {
      requireRole(user, AUDIT_VIEWERS);
      const limit = Math.min(500, Math.max(1, Number.parseInt(query.get('limit') || '200', 10) || 200));
      return sendJson(res, 200, { entries: await audit.recent(db, limit) });
    }
    if (m === 'GET' && pathname === '/api/audit/verify') {
      requireRole(user, AUDIT_VIEWERS);
      return sendJson(res, 200, await audit.verify(db));
    }

    // ---- department records (maker-checker) and measured KPIs ----
    if (m === 'POST' && pathname === '/api/records') return sendJson(res, 201, { record: await records.submit(user, await readJson(req)) });
    if (m === 'GET' && pathname === '/api/records') return sendJson(res, 200, { records: await records.list(user, query) });
    const rm = pathname.match(/^\/api\/records\/(\d{1,12})\/review$/);
    if (m === 'POST' && rm) return sendJson(res, 200, { record: await records.review(user, Number(rm[1]), await readJson(req)) });
    if (m === 'GET' && pathname === '/api/measured') {
      requireRole(user, DASHBOARD_READERS);
      return sendJson(res, 200, await measured.get(query, user));
    }

    // ---- alerts (in-app), CEO report summaries, usage & costs, OCR ----
    if (m === 'GET' && pathname === '/api/alerts') {
      requireRole(user, DASHBOARD_READERS);
      await alerts.sweep();
      const status = query.get('status') === 'all' ? 'all' : 'open';
      return sendJson(res, 200, { alerts: await alerts.list(user, { status }), counts: await alerts.counts(user) });
    }
    const alm = pathname.match(/^\/api\/alerts\/(\d{1,12})\/ack$/);
    if (m === 'POST' && alm) {
      requireRole(user, DASHBOARD_READERS);
      return sendJson(res, 200, { alert: await alerts.acknowledge(user, Number(alm[1])) });
    }
    if (m === 'GET' && pathname === '/api/reports') {
      requireRole(user, REPORT_READERS);
      await reports.runDue();
      return sendJson(res, 200, { reports: await reports.list(), schedule: await reports.schedule(), nextDue: await reports.nextDue(), canManage: REPORT_ADMINS.includes(user.role) });
    }
    if (m === 'POST' && pathname === '/api/reports') {
      requireRole(user, REPORT_ADMINS);
      return sendJson(res, 201, { report: await reports.generateNow(user) });
    }
    if (m === 'POST' && pathname === '/api/reports/schedule') {
      requireRole(user, REPORT_ADMINS);
      return sendJson(res, 200, await reports.setSchedule(user, (await readJson(req)).schedule));
    }
    const rpm = pathname.match(/^\/api\/reports\/(\d{1,12})$/);
    if (m === 'GET' && rpm) {
      requireRole(user, REPORT_READERS);
      return sendJson(res, 200, { report: await reports.one(Number(rpm[1])) });
    }
    if (m === 'GET' && pathname === '/api/usage') {
      requireRole(user, REPORT_READERS);
      const days = Math.min(365, Math.max(1, Number.parseInt(query.get('days') || '30', 10) || 30));
      return sendJson(res, 200, await usage.summary(days));
    }
    if (m === 'POST' && pathname === '/api/ocr') {
      return sendJson(res, 200, await ocr.read(user, await readJson(req, ocr.MAX_B64 + 4096)));
    }
    const dim = pathname.match(/^\/api\/documents\/(\d{1,12})\/image$/);
    if (m === 'GET' && dim) {
      const doc = await ocr.image(user, Number(dim[1]));
      res.writeHead(200, { 'Content-Type': doc.mime, 'Content-Length': doc.buf.length, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' });
      return res.end(doc.buf);
    }

    if (m === 'GET' && pathname === '/api/kpis') { requireRole(user, DASHBOARD_READERS); return sendJson(res, 200, { kpis: await kpis.latest() }); }
    if (m === 'POST' && pathname === '/api/kpis/ingest') {
      requireRole(user, INGESTERS);
      return sendJson(res, 200, await kpis.ingest(user, await readJson(req)));
    }

    throw new HttpError(404, 'Not found.');
  }

  async function route(req, res, url) {
    securityHeaders(res, cfg);
    const pathname = url.pathname;
    if (pathname === '/healthz') return api(req, res, '/api/health', url.searchParams);
    if (pathname.startsWith('/api/')) return api(req, res, pathname, url.searchParams);
    return serveStatic(statics, req, res, pathname);
  }

  /** The request handler: never throws; maps errors to JSON responses. url overrides req.url (Vercel rewrites). */
  async function handle(req, res, url) {
    try {
      if (!url) {
        try { url = new URL(req.url, 'http://local'); } catch { return sendJson(res, 400, { error: 'Bad URL.' }); }
      }
      await route(req, res, url);
    } catch (err) {
      if (res.headersSent) { res.destroy(); return; }
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message, ...(err.extra || {}) });
      console.error(`[${iso()}] ${req.method} ${req.url} failed:`, err);
      sendJson(res, 500, { error: 'Something went wrong on the server.' });
    }
  }

  let server = null;
  return {
    db, users, actions, kpis, records, alerts, reports, usage, config: cfg, handle, runDaily,
    listen(port = 0, host = '127.0.0.1') {
      server = http.createServer((req, res) => { handle(req, res); });
      server.requestTimeout = 30e3;
      server.headersTimeout = 15e3;
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(`http://${host}:${server.address().port}`));
      });
    },
    close() {
      const closeDb = () => { try { db.close(); } catch { /* already closed */ } };
      if (!server) return ocr.close().then(closeDb);
      return new Promise(resolve => {
        server.close(() => { ocr.close().then(() => { closeDb(); resolve(); }); });
        if (server.closeAllConnections) server.closeAllConnections();
      });
    },
  };
}

module.exports = { createApp };
