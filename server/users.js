'use strict';
/* User repository. Roles and plant scope live on the server, never in the browser. */
const D = require('../js/data.js');
const { hashPassword, passwordProblem } = require('./security');

const ROLES = ['ceo', 'plant', 'dept', 'finance', 'admin', 'integration', 'operator'];
const DEPARTMENTS = Object.keys(D.SECTIONS); // spinning, weaving, ... finance
const NEEDS_DEPT = ['dept', 'operator'];
const PLANTS = D.PLANTS.map(p => p.id); // 'all', 'FSD', 'KHI', 'LHR', 'GRP'
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,47}$/i;

class ValidationError extends Error {}

const pub = r => (r ? { id: r.id, username: r.username, displayName: r.display_name, role: r.role, plant: r.plant, department: r.department || null } : null);

function makeUsers(db, clock) {
  const iso = () => new Date(clock()).toISOString();

  async function create({ username, displayName, role, plant, department = null, password }) {
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) throw new ValidationError('Username: 2-48 letters, digits, dot, dash or underscore.');
    if (!ROLES.includes(role)) throw new ValidationError(`Role must be one of: ${ROLES.join(', ')}`);
    if (!PLANTS.includes(plant)) throw new ValidationError(`Plant must be one of: ${PLANTS.join(', ')}`);
    if (department !== null && department !== undefined && !DEPARTMENTS.includes(department)) throw new ValidationError(`Department must be one of: ${DEPARTMENTS.join(', ')}`);
    if (role === 'operator' && !department) throw new ValidationError('An operator needs a department (--department).');
    const dept = NEEDS_DEPT.includes(role) ? department || null : null;
    const name = typeof displayName === 'string' && displayName.trim() ? displayName.trim().slice(0, 80) : username;
    const problem = passwordProblem(password);
    if (problem) throw new ValidationError(problem);
    if (await db.get('SELECT 1 FROM users WHERE username = ?', [username])) throw new ValidationError('That username already exists.');
    const hash = await hashPassword(password);
    const now = iso();
    let r;
    try {
      r = await db.run('INSERT INTO users (username, display_name, role, plant, department, pass_hash, created_at, pw_changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [username, name, role, plant, dept, hash, now, now]);
    } catch (e) {
      if (/UNIQUE constraint failed/.test(String(e.message))) throw new ValidationError('That username already exists.'); // created meanwhile
      throw e;
    }
    return pub(await db.get('SELECT * FROM users WHERE id = ?', [r.lastInsertRowid]));
  }

  const byUsername = username => db.get('SELECT * FROM users WHERE username = ? AND active = 1', [String(username)]);
  const byId = id => db.get('SELECT * FROM users WHERE id = ? AND active = 1', [id]);

  /** Validates and hashes a new password (slow: do it before opening a transaction). */
  async function hashNewPassword(password) {
    const problem = passwordProblem(password);
    if (problem) throw new ValidationError(problem);
    return hashPassword(password);
  }
  /** Stores a prepared hash; q is the database or an open transaction. */
  const storePasswordHash = (q, id, hash) => q.run('UPDATE users SET pass_hash = ?, pw_changed_at = ? WHERE id = ?', [hash, iso(), id]);
  async function setPassword(id, password) {
    await storePasswordHash(db, id, await hashNewPassword(password));
  }

  const setActive = async (username, active) => (await db.run('UPDATE users SET active = ? WHERE username = ?', [active ? 1 : 0, username])).changes;
  const list = async () => (await db.all('SELECT * FROM users ORDER BY username')).map(r => ({ ...pub(r), active: !!r.active }));

  return { create, byUsername, byId, setPassword, hashNewPassword, storePasswordHash, setActive, list, pub };
}

module.exports = { makeUsers, ValidationError, ROLES, PLANTS, DEPARTMENTS };
