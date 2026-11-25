'use strict';
// Child process used by db.test.mjs to act as a second server instance on the same database file.
//   node db-worker.cjs <file> open          -> open (and migrate) the database, print the schema versions
//   node db-worker.cjs <file> bump <n>      -> n read-modify-write transactions on meta 's'
//   node db-worker.cjs <file> hold <ms>     -> hold the write lock for ms, printing LOCKED once it has it
const { openDb } = require('../../../server/db.js');

(async () => {
  const [file, mode, n] = process.argv.slice(2);
  const db = await openDb(file);
  if (mode === 'hold') {
    await db.tx(async t => {
      await t.run("INSERT INTO meta (k, v) VALUES ('held', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1");
      process.stdout.write('LOCKED\n');
      await new Promise(r => setTimeout(r, Number(n)));
    });
    db.close();
    return;
  }
  if (mode === 'bump') {
    for (let i = 0; i < Number(n); i++) {
      await db.tx(async t => {
        const { v } = await t.get("SELECT v FROM meta WHERE k = 's'");
        await new Promise(r => setTimeout(r, 2));
        await t.run("UPDATE meta SET v = ? WHERE k = 's'", [v + 1]);
      });
    }
  }
  const versions = (await db.all('SELECT v FROM schema_version ORDER BY v')).map(r => r.v);
  db.close();
  process.stdout.write(JSON.stringify({ versions }));
})().catch(e => { process.stderr.write(String(e && e.stack || e)); process.exit(1); });
