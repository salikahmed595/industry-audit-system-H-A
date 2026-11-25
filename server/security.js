'use strict';
/* Password hashing (scrypt, async so the event loop is not blocked), tokens, hashing helpers. */
const crypto = require('node:crypto');
const net = require('node:net');
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

/**
 * The sign-in throttling key for a client address. IPv4: the address. IPv6: its /64, because one customer network
 * gets a whole /64 and could otherwise rotate through endless addresses. IPv4-mapped IPv6 (::ffff:a.b.c.d, as a
 * dual-stack socket reports IPv4 clients) is the IPv4 address. Anything else is passed through, at most 64 chars.
 */
function ipBucket(ip) {
  const s = String(ip === undefined || ip === null ? 'unknown' : ip).split('%')[0]; // drop an IPv6 zone id
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(s);
  if (mapped && net.isIPv4(mapped[1])) return mapped[1];
  if (!net.isIPv6(s)) return s.slice(0, 64);
  const groups = part => (part ? part.split(':').flatMap(g => (g.includes('.') ? ['0', '0'] : [g])) : []); // a dotted tail fills 2 groups
  const [head, tail] = s.split('::');
  const h = groups(head);
  const full = tail === undefined ? h : [...h, ...Array(8 - h.length - groups(tail).length).fill('0'), ...groups(tail)];
  return `${full.slice(0, 4).map(g => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

const newToken = () => crypto.randomBytes(32).toString('base64url');
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const randomPassword = () => crypto.randomBytes(18).toString('base64url');

module.exports = { hashPassword, verifyPassword, dummyVerify, passwordProblem, ipBucket, newToken, sha256, randomPassword, MAX_PW };
