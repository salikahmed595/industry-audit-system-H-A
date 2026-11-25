'use strict';
/* Production entry point: node server/index.js (see README for environment variables). */
const { loadConfig } = require('./config');
const { createApp } = require('./app');

let cfg;
try { cfg = loadConfig(process.env); } catch (e) { console.error(`Config error: ${e.message}`); process.exit(1); }

const app = createApp(cfg);
const userCount = app.db.prepare('SELECT COUNT(*) AS c FROM users WHERE active = 1').get().c;

app.listen(cfg.port, cfg.host).then(url => {
  console.log(`Textile AI Audit listening on ${url} (${cfg.production ? 'production' : 'development'})`);
  console.log(`Database: ${cfg.dbPath}`);
  if (!userCount) console.log('No users yet. Create one with: npm run user:create -- --username <name> --role ceo --plant all');
}).catch(e => { console.error(`Could not start: ${e.message}`); process.exit(1); });

function shutdown(sig) {
  console.log(`${sig} received, closing…`);
  app.close().then(() => process.exit(0));
  setTimeout(() => process.exit(1), 10e3).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
