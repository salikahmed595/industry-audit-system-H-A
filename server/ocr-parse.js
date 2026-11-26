'use strict';
/* Turning OCR text from a photographed ledger or checklist into values for one record form.
 * Pure functions, no I/O. The result only PREFILLS the entry form: a person checks every value against the
 * paper, submits, and a second person approves (maker-checker). Nothing here writes a record.
 * Matching is by label words, so any form (any industry) works without per-form code. */

// Unit and filler words are ignored when comparing a ledger line with a field label ("Cotton fed kg" = "Cotton fed").
const IGNORE = new Set(['kg', 'kgs', 'g', 'gm', 'h', 'hr', 'hrs', 'hour', 'hours', 'min', 'mins', 'minute', 'minutes', 'm', 'mtr', 'meter', 'meters', 'metre', 'metres',
  'l', 'ltr', 'litre', 'litres', 'liter', 'liters', 'pcs', 'pc', 'piece', 'pieces', 'no', 'nos', 'qty', 'pkr', 'rs', 'pct', 'percent', 'count',
  'of', 'the', 'and', 'per', 'a', 'an', 'in', 'on', 'for', 'from', 'which', 'now']);
const MAX_LINES = 400;
const MAX_LINE = 200;
const THRESHOLD = 0.6;

const stem = w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
function words(s) {
  return String(s).toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-z]+/).filter(w => w && !IGNORE.has(w)).map(stem);
}
// OCR slips inside a number: O/o for 0, l/I/| for 1, S for 5; thousands commas dropped.
function cleanNumber(tok) {
  const t = tok.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/S/g, '5').replace(/,(?=\d{3}(\D|$))/g, '');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}
// The value on a line: the last number-like token with at least one real digit.
function lastNumber(line) {
  const toks = line.match(/-?[\dOolI|S][\dOolI|S,]*(?:\.\d+)?/g) || [];
  for (let i = toks.length - 1; i >= 0; i--) {
    if (!/\d/.test(toks[i])) continue;
    const n = cleanNumber(toks[i]);
    if (n !== null) return { n, tok: toks[i] };
  }
  return null;
}
function score(lineWords, fieldWords) {
  if (!fieldWords.length || !lineWords.length) return 0;
  const set = new Set(lineWords);
  const hit = fieldWords.filter(w => set.has(w)).length;
  return hit / Math.max(fieldWords.length, set.size);
}
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * text: OCR output. form: a form definition from js/measure.js (fields with k, label, kind, min, max, options).
 * Returns { prefill (null-prototype object: field key -> value), date, matches, rejected, unmatched }.
 */
function parseFields(text, form) {
  const prefill = Object.create(null);
  const out = { prefill, date: null, matches: [], rejected: [], unmatched: [] };
  if (typeof text !== 'string' || !text.trim() || !form || !Array.isArray(form.fields)) return out;
  const lines = text.split(/\r?\n/).map(l => l.trim().slice(0, MAX_LINE)).filter(Boolean).slice(0, MAX_LINES);
  const fields = form.fields.filter(f => ['num', 'int', 'choice', 'yesno'].includes(f.kind));
  const fw = new Map(fields.map(f => [f.k, words(f.label)]));
  const used = new Set();

  // Candidate (line, field) pairs, best first; each field is filled once and each line gives one number.
  const cands = [];
  lines.forEach((line, li) => {
    const dm = line.match(/\b20\d{2}-\d{2}-\d{2}\b/);
    if (dm && /date/i.test(line)) { if (!out.date) out.date = dm[0]; used.add(li); return; }
    const num = lastNumber(line);
    const lw = words(num ? line.slice(0, line.lastIndexOf(num.tok)) : line);
    for (const f of fields) {
      if (f.kind === 'choice') {
        for (const m of line.matchAll(new RegExp(`\\b${escRe(f.label)}\\s*[:\\-]?\\s*([A-Za-z0-9]{1,3})\\b`, 'gi'))) {
          if (f.options.includes(m[1].toUpperCase())) { cands.push({ li, f, s: 1, v: m[1].toUpperCase() }); break; }
        }
        continue;
      }
      if (!num) continue;
      const s = score(lw, fw.get(f.k));
      if (s >= THRESHOLD) cands.push({ li, f, s, v: num.n });
    }
  });
  cands.sort((a, b) => b.s - a.s || a.li - b.li);
  const doneField = new Set();
  const numLine = new Set();
  for (const c of cands) {
    const numeric = c.f.kind !== 'choice';
    if (doneField.has(c.f.k) || (numeric && numLine.has(c.li))) continue;
    doneField.add(c.f.k);
    if (numeric) numLine.add(c.li);
    used.add(c.li);
    if (numeric) {
      const v = c.v;
      const ok = Number.isFinite(v) && v >= c.f.min && v <= c.f.max && (c.f.kind !== 'int' || Number.isInteger(v)) && (c.f.kind !== 'yesno' || v === 0 || v === 1);
      if (!ok) { out.rejected.push({ field: c.f.k, label: c.f.label, value: v, line: lines[c.li], reason: `outside ${c.f.min}–${c.f.max}` }); continue; }
    }
    prefill[c.f.k] = c.v;
    out.matches.push({ field: c.f.k, label: c.f.label, value: c.v, line: lines[c.li], score: +c.s.toFixed(2) });
  }
  lines.forEach((l, i) => { if (!used.has(i)) out.unmatched.push(l); });
  return out;
}

/** The real type of an uploaded image from its first bytes; null for anything else (SVG, PDF, HTML …). */
function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

module.exports = { parseFields, sniffImage };
