'use strict';
/* User administration from the server console (no admin web UI by design: smaller attack surface).
 *   npm run user:create -- --username ayesha --name "Ayesha Khan" --role plant --plant KHI
 *   npm run user:reset  -- --username ayesha
 *   npm run user:disable -- --username ayesha
 *   npm run user:list
 * A strong one-time password is generated and printed once, unless TA_PASSWORD is set. */
const { loadConfig } = require('../config');
const { openDb } = require('../db');
const { makeUsers, ValidationError, ROLES, PLANTS, DEPARTMENTS } = require('../users');
const audit = require('../audit');
const { randomPassword } = require('../security');

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return out;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = args(rest);
  const cfg = loadConfig(process.env);
  const db = openDb(cfg.dbPath);
  const users = makeUsers(db, Date.now);
  const log = (action, msg, detail = {}) => audit.append(db, { ts: new Date().toISOString(), user: null, action, target: null, detail: { ...detail, msg, via: 'cli' } });
  try {
    if (cmd === 'create') {
      const password = process.env.TA_PASSWORD || randomPassword();
      const u = await users.create({ username: a.username, displayName: a.name, role: a.role, plant: a.plant || 'all', department: a.department || null, password });
      log('admin.user_created', `User ${u.username} created (${u.role}, ${u.plant}${u.department ? `, ${u.department}` : ''})`, { username: u.username, role: u.role, plant: u.plant, department: u.department });
      console.log(`Created ${u.username} (${u.role}, plant ${u.plant}${u.department ? `, department ${u.department}` : ''}).`);
      if (!process.env.TA_PASSWORD) console.log(`One-time password: ${password}\nGive it to the user privately; they should change it after first sign-in.`);
    } else if (cmd === 'reset') {
      const row = users.byUsername(a.username);
      if (!row) throw new ValidationError('No active user with that username.');
      const password = process.env.TA_PASSWORD || randomPassword();
      await users.setPassword(row.id, password);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
      log('admin.password_reset', `Password reset for ${row.username}`, { username: row.username });
      console.log(`Password reset for ${row.username}. All their sessions were signed out.`);
      if (!process.env.TA_PASSWORD) console.log(`One-time password: ${password}`);
    } else if (cmd === 'disable' || cmd === 'enable') {
      const n = users.setActive(a.username, cmd === 'enable');
      if (!n) throw new ValidationError('No user with that username.');
      if (cmd === 'disable') db.prepare('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = ?)').run(a.username);
      log(`admin.user_${cmd}d`, `User ${a.username} ${cmd}d`, { username: a.username });
      console.log(`User ${a.username} ${cmd}d.`);
    } else if (cmd === 'list') {
      console.table(users.list());
    } else {
      console.log(`Usage: users.js <create|reset|disable|enable|list> [--username u] [--name "Full Name"] [--role ${ROLES.join('|')}] [--plant ${PLANTS.join('|')}] [--department ${DEPARTMENTS.join('|')}]`);
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(e instanceof ValidationError ? `Error: ${e.message}` : e);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
