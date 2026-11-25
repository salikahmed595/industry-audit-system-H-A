'use strict';
/* Vercel function: every /api/* request is rewritten here (see vercel.json). The dashboard files themselves are
 * served by Vercel's CDN from public/ (built by scripts/build-static.js). The app is created once per instance
 * and reused; all shared state lives in the Turso database (DB_URL + DB_AUTH_TOKEN). */
const { loadConfig } = require('../server/config');
const { createApp } = require('../server/app');

let ready = null;
function getApp() {
  if (!ready) {
    ready = (async () => createApp({ ...loadConfig(process.env), serveStatic: false }))();
    ready.catch(() => { ready = null; }); // try again on the next request instead of caching the failure
  }
  return ready;
}

/** vercel.json rewrites /api/x to /api/index?__path=x. Depending on the platform the function may see either form;
 *  both resolve to the same route, and __path never stays in the query the app sees. */
function originalUrl(req) {
  const url = new URL(req.url || '/', 'http://local');
  if (url.searchParams.getAll('__path').length > 1) throw new Error('ambiguous route');
  const p = url.searchParams.get('__path');
  url.searchParams.delete('__path');
  if ((url.pathname === '/api/index' || url.pathname === '/api' || url.pathname === '/api/') && p !== null) url.pathname = `/api/${p}`;
  return url;
}

module.exports = async function handler(req, res) {
  let app;
  try {
    app = await getApp();
  } catch (e) {
    console.error('Startup failed (check the environment variables in the Vercel project settings):', e.message);
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'The server is not configured correctly yet. The administrator should check the deployment settings.' }));
    return;
  }
  let url;
  try { url = originalUrl(req); } catch {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Bad URL.' }));
    return;
  }
  await app.handle(req, res, url);
};
