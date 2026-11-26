'use strict';
/* Twelve-factor config: everything comes from the environment, validated at startup (fail fast). */
const path = require('node:path');

function bool(v, d) { return v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v); }
function int(name, v, d, min, max) {
  if (v === undefined || v === '') return d;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return n;
}

function loadConfig(env = process.env) {
  // On Vercel the platform's own variables fill in what would otherwise have to be typed into the project settings.
  // Anything set explicitly still wins.
  const onVercel = !!env.VERCEL;
  const production = env.NODE_ENV === 'production' || (onVercel && env.VERCEL_ENV === 'production');
  // DB_URL / DB_AUTH_TOKEN, or the names Vercel's Turso integration sets (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN).
  const dbUrlName = env.DB_URL ? 'DB_URL' : env.TURSO_DATABASE_URL ? 'TURSO_DATABASE_URL' : null;
  const dbUrl = dbUrlName ? env[dbUrlName] : null;
  const vercelOrigin = onVercel && env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : null;
  const cfg = {
    production,
    host: env.HOST || '127.0.0.1',
    port: int('PORT', env.PORT, 8080, 0, 65535),
    // A Turso database (libsql://…), used on Vercel. Otherwise DB_PATH: a local SQLite file.
    dbPath: dbUrl || env.DB_PATH || path.join(__dirname, '..', 'data', 'textile-audit.db'),
    dbAuthToken: env.DB_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || null,
    publicOrigin: env.PUBLIC_ORIGIN || vercelOrigin,
    secureCookies: bool(env.SECURE_COOKIES, production),
    // Vercel always overwrites X-Forwarded-For with the real client address, so it is trusted there by default.
    trustProxy: bool(env.TRUST_PROXY, onVercel),
    sessionTtlHours: int('SESSION_TTL_HOURS', env.SESSION_TTL_HOURS, 12, 1, 168),
    loginMaxFailures: int('LOGIN_MAX_FAILURES', env.LOGIN_MAX_FAILURES, 5, 3, 50),
    // Shared secret for the daily job (/api/cron/daily). Vercel Cron sends it as "Authorization: Bearer <CRON_SECRET>".
    // Unset: the cron route answers 503 and reports/alerts still catch up when someone opens the dashboard.
    cronSecret: env.CRON_SECRET || null,
  };
  if (cfg.publicOrigin && !/^https?:\/\/[^/\s]+$/.test(cfg.publicOrigin)) throw new Error('PUBLIC_ORIGIN must look like https://audit.example.com (no path, no trailing slash)');
  // A bare host only: no user:password@, query (?authToken=…), path or fragment, so the token can only come from its own variable.
  if (dbUrl && !/^(libsql|https|wss):\/\/[A-Za-z0-9.-]+(:\d{1,5})?\/?$/.test(dbUrl)) throw new Error(`${dbUrlName} must look like libsql://your-db-your-org.turso.io`);
  if (cfg.cronSecret && cfg.cronSecret.length < 16) throw new Error('CRON_SECRET must be at least 16 characters (use a long random string)');
  if (dbUrl && !cfg.dbAuthToken) throw new Error(`DB_AUTH_TOKEN (or TURSO_AUTH_TOKEN) is required with ${dbUrlName}`);
  // Vercel's file system is read-only and wiped between requests: a local SQLite file would lose every record.
  if (onVercel && !dbUrl) throw new Error('A Turso database must be connected on Vercel (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN from the Turso integration, or DB_URL + DB_AUTH_TOKEN)');
  if (production) {
    if (!cfg.publicOrigin) throw new Error('PUBLIC_ORIGIN is required when NODE_ENV=production');
    if (!cfg.publicOrigin.startsWith('https://')) throw new Error('PUBLIC_ORIGIN must use https:// in production');
    if (!cfg.secureCookies) throw new Error('SECURE_COOKIES cannot be turned off in production');
    // Behind a proxy without TRUST_PROXY every user shares one IP (lockout DoS); with it on a direct port, IPs are spoofable.
    if (!onVercel && (env.TRUST_PROXY === undefined || env.TRUST_PROXY === '')) throw new Error('TRUST_PROXY must be set explicitly in production (true behind a reverse proxy that overwrites X-Forwarded-For, else false)');
  }
  return cfg;
}

module.exports = { loadConfig };
