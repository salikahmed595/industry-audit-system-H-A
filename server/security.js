'use strict';
/* Password hashing (scrypt, async so the event loop is not blocked), tokens, hashing helpers. */
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEYLEN = 64;
const MAX_PW = 256;

function passwordProblem(pw) {
  if (typeof pw !== 'string' || !pw) return 'Password is required.';
  if (pw.length < 12) return 'Use at least 12 characters.';
  if (pw.length > MAX_PW) return 'Password is too long.';
  return null;
}

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const dk = await scrypt(String(pw).normalize('NFKC'), salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

async function verifyPassword(pw, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt' || typeof pw !== 'string' || pw.length > MAX_PW) return false;
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const dk = await scrypt(pw.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p, maxmem: PARAMS.maxmem });
  return dk.length === expected.length && crypto.timingSafeEqual(dk, expected);
}

/** Pre-computed hash used for unknown usernames so response time does not reveal which users exist. */
let dummyHash = null;
async function dummyVerify(pw) {
  if (!dummyHash) dummyHash = await hashPassword('timing-equaliser-not-a-real-password');
  await verifyPassword(typeof pw === 'string' ? pw.slice(0, MAX_PW) : '', dummyHash);
  return false;
}

const newToken = () => crypto.randomBytes(32).toString('base64url');
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const randomPassword = () => crypto.randomBytes(18).toString('base64url');

module.exports = { hashPassword, verifyPassword, dummyVerify, passwordProblem, newToken, sha256, randomPassword, MAX_PW };
