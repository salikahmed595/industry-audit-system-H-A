'use strict';
/* Long-running server entry point: node server/index.js (see README for environment variables).
 * On Vercel the same app runs through api/index.js instead. */
const { loadConfig } = require('./config');
const { createApp } = require('./app');

let cfg;
try { cfg = loadConfig(process.env); } catch (e) { console.error(`Config error: ${e.message}`); process.exit(1); }

(async () => {
  const app = await createApp(cfg);
  const userCount = (await app.db.get('SELECT COUNT(*) AS c FROM users WHERE active = 1')).c;
  const url = await app.listen(cfg.port, cfg.host);
  console.log(`Textile AI Audit listening on ${url} (${cfg.production ? 'production' : 'development'})`);
  console.log(`Database: ${/^(libsql|https|wss):/.test(cfg.dbPath) ? `Turso (${new URL(cfg.dbPath).host})` : cfg.dbPath}`);
  if (!userCount) console.log('No users yet. Create one with: npm run user:create -- --username <name> --role ceo --plant all');

  function shutdown(sig) {
    console.log(`${sig} received, closing…`);
    app.close().then(() => process.exit(0));
    setTimeout(() => process.exit(1), 10e3).unref();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
})().catch(e => { console.error(`Could not start: ${e.message}`); process.exit(1); });
