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
  const production = env.NODE_ENV === 'production';
  const cfg = {
    production,
    host: env.HOST || '127.0.0.1',
    port: int('PORT', env.PORT, 8080, 0, 65535),
    // DB_URL: a Turso database (libsql://…), used on Vercel. Otherwise DB_PATH: a local SQLite file.
    dbPath: env.DB_URL || env.DB_PATH || path.join(__dirname, '..', 'data', 'textile-audit.db'),
    dbAuthToken: env.DB_AUTH_TOKEN || null,
    publicOrigin: env.PUBLIC_ORIGIN || null,
    secureCookies: bool(env.SECURE_COOKIES, production),
    trustProxy: bool(env.TRUST_PROXY, false),
    sessionTtlHours: int('SESSION_TTL_HOURS', env.SESSION_TTL_HOURS, 12, 1, 168),
    loginMaxFailures: int('LOGIN_MAX_FAILURES', env.LOGIN_MAX_FAILURES, 5, 3, 50),
  };
  if (cfg.publicOrigin && !/^https?:\/\/[^/\s]+$/.test(cfg.publicOrigin)) throw new Error('PUBLIC_ORIGIN must look like https://audit.example.com (no path, no trailing slash)');
  // A bare host only: no user:password@, query (?authToken=…), path or fragment, so the token can only come from DB_AUTH_TOKEN.
  if (env.DB_URL && !/^(libsql|https|wss):\/\/[A-Za-z0-9.-]+(:\d{1,5})?\/?$/.test(env.DB_URL)) throw new Error('DB_URL must look like libsql://your-db-your-org.turso.io');
  if (env.DB_URL && !cfg.dbAuthToken) throw new Error('DB_AUTH_TOKEN is required with DB_URL (create one with: turso db tokens create <db>)');
  // Vercel's file system is read-only and wiped between requests: a local SQLite file would lose every record.
  if (env.VERCEL && !env.DB_URL) throw new Error('DB_URL and DB_AUTH_TOKEN must be set on Vercel (a hosted Turso database)');
  if (production) {
    if (!cfg.publicOrigin) throw new Error('PUBLIC_ORIGIN is required when NODE_ENV=production');
    if (!cfg.publicOrigin.startsWith('https://')) throw new Error('PUBLIC_ORIGIN must use https:// in production');
    if (!cfg.secureCookies) throw new Error('SECURE_COOKIES cannot be turned off in production');
    // Behind a proxy without TRUST_PROXY every user shares one IP (lockout DoS); with it on a direct port, IPs are spoofable.
    if (env.TRUST_PROXY === undefined || env.TRUST_PROXY === '') throw new Error('TRUST_PROXY must be set explicitly in production (true behind a reverse proxy that overwrites X-Forwarded-For, else false)');
  }
  return cfg;
}

module.exports = { loadConfig };
