'use strict';
/* The daily job, run by a script on this server (no outside automation service):
 *   npm run cron          on the database in the environment (DB_PATH, or DB_URL / TURSO_DATABASE_URL + token)
 *   npm run cron:remote   on the hosted Turso database (.env.turso)
 * It sweeps the findings into alerts (opens new ones, escalates, resolves), writes the CEO report if one is due
 * (weekly or every two weeks, as set in the admin panel), and prunes usage events older than 400 days.
 * Safe to run more than once a day: a second run the same day writes no second report.
 * Schedule it with the operating system (cron on Linux, Task Scheduler on Windows), e.g. daily at 03:00:
 *   0 3 * * *  cd /srv/textile-audit && npm run cron >> data/cron.log 2>&1
 * On Vercel the same job runs through the cron entry in vercel.json, which calls /api/cron/daily with CRON_SECRET.
 * Prints one line of JSON; exits 1 on failure. */
const { loadConfig } = require('../config');
const { createApp } = require('../app');

async function main() {
  const cfg = loadConfig(process.env);
  const app = await createApp({ ...cfg, serveStatic: false });
  try {
    const result = await app.runDaily();
    console.log(JSON.stringify({ at: new Date().toISOString(), ...result }));
  } finally {
    await app.close();
  }
}

main().catch(e => {
  console.error(`Daily job failed: ${e.message}`);
  process.exit(1);
});
