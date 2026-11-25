'use strict';
/* HTTP helpers: security headers, JSON in/out with limits, and an allow-list static file server. */
const fs = require('node:fs');
const path = require('node:path');
const { HttpError } = require('./errors');

const ROOT = path.join(__dirname, '..');
const BODY_LIMIT = 256 * 1024;
const DRAIN_LIMIT = 4 * 1024 * 1024;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // style="" attributes drive animation delays; no inline scripts are allowed
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders(res, cfg) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (cfg.secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function sendJson(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}

/** Read a JSON body. 415 if not JSON, 413 if too large (body is drained so the client still gets the reply), 400 if malformed. */
/** Read and discard a rejected body so the error response can still be delivered, but never more than DRAIN_LIMIT. */
function drainCapped(req) {
  let n = 0;
  req.on('data', c => { n += c.length; if (n > DRAIN_LIMIT) req.destroy(); });
  req.resume();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const declared = Number(req.headers['content-length'] || 0);
    if (!type && !declared && req.headers['transfer-encoding'] === undefined) { resolve({}); return; }
    if (type !== 'application/json') { drainCapped(req); reject(new HttpError(415, 'Send JSON (Content-Type: application/json).')); return; }
    if (declared > DRAIN_LIMIT) { req.destroy(); reject(new HttpError(413, 'Request body too large.')); return; }
    let size = 0; const chunks = []; let tooBig = false;
    req.on('data', c => {
      size += c.length;
      if (size > DRAIN_LIMIT) { req.destroy(); reject(new HttpError(413, 'Request body too large.')); return; }
      if (size > BODY_LIMIT) { tooBig = true; return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooBig) return reject(new HttpError(413, 'Request body too large.'));
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve({});
      try {
        const v = JSON.parse(text);
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return reject(new HttpError(400, 'Body must be a JSON object.'));
        resolve(v);
      } catch { reject(new HttpError(400, 'Malformed JSON.')); }
    });
    req.on('error', () => reject(new HttpError(400, 'Request aborted.')));
  });
}

/** Exact-match allow-list of public files, built once at startup. No path is ever joined from user input,
 *  so traversal (../, %2e%2e, backslashes) cannot reach server code, tests, data or .git. */
function buildStaticMap() {
  const map = new Map();
  const add = (url, rel) => map.set(url, { file: path.join(ROOT, rel), type: TYPES[path.extname(rel)] || 'application/octet-stream' });
  add('/', 'index.html');
  add('/index.html', 'index.html');
  for (const dir of ['css', 'js']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (/^[\w.-]+$/.test(name) && TYPES[path.extname(name)] && fs.statSync(path.join(abs, name)).isFile()) add(`/${dir}/${name}`, `${dir}/${name}`);
    }
  }
  return map;
}

function serveStatic(map, req, res, pathname) {
  const hit = map.get(pathname);
  if (!hit || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Not found');
    return;
  }
  fs.readFile(hit.file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': hit.type, 'Cache-Control': 'no-cache', 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

module.exports = { securityHeaders, sendJson, readJson, buildStaticMap, serveStatic, parseCookies };
