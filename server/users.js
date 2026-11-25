'use strict';
/* User repository. Roles and plant scope live on the server, never in the browser. */
const D = require('../js/data.js');
const { hashPassword, passwordProblem } = require('./security');

const ROLES = ['ceo', 'plant', 'dept', 'finance', 'admin', 'integration'];
const PLANTS = D.PLANTS.map(p => p.id); // 'all', 'FSD', 'KHI', 'LHR', 'GRP'
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,47}$/i;

class ValidationError extends Error {}

const pub = r => (r ? { id: r.id, username: r.username, displayName: r.display_name, role: r.role, plant: r.plant } : null);

function makeUsers(db, clock) {
  const iso = () => new Date(clock()).toISOString();

  async function create({ username, displayName, role, plant, password }) {
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) throw new ValidationError('Username: 2-48 letters, digits, dot, dash or underscore.');
    if (!ROLES.includes(role)) throw new ValidationError(`Role must be one of: ${ROLES.join(', ')}`);
    if (!PLANTS.includes(plant)) throw new ValidationError(`Plant must be one of: ${PLANTS.join(', ')}`);
    const name = typeof displayName === 'string' && displayName.trim() ? displayName.trim().slice(0, 80) : username;
    const problem = passwordProblem(password);
    if (problem) throw new ValidationError(problem);
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new ValidationError('That username already exists.');
    const hash = await hashPassword(password);
    const now = iso();
    const r = db.prepare('INSERT INTO users (username, display_name, role, plant, pass_hash, created_at, pw_changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(username, name, role, plant, hash, now, now);
    return pub(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid));
  }

  const byUsername = username => db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username));
  const byId = id => db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(id);

  async function setPassword(id, password) {
    const problem = passwordProblem(password);
    if (problem) throw new ValidationError(problem);
    db.prepare('UPDATE users SET pass_hash = ?, pw_changed_at = ? WHERE id = ?').run(await hashPassword(password), iso(), id);
  }

  const setActive = (username, active) => db.prepare('UPDATE users SET active = ? WHERE username = ?').run(active ? 1 : 0, username).changes;
  const list = () => db.prepare('SELECT * FROM users ORDER BY username').all().map(r => ({ ...pub(r), active: !!r.active }));

  return { create, byUsername, byId, setPassword, setActive, list, pub };
}

module.exports = { makeUsers, ValidationError, ROLES, PLANTS };
