'use strict';
/* OCR of photographed ledgers and checklists, on this server (Tesseract via tesseract.js, English model bundled
 * from npm: no outside service, no data leaves the server).
 * - Who: anyone who may fill in the chosen form, for their own plant.
 * - Input: one PNG, JPEG or WebP photo (checked by its bytes, not its name), at most 2.5 MB.
 * - Output: the text, a confidence score, and values matched to the form's fields. The values only PREFILL the
 *   entry form; the person checks them, submits, and a second person approves. OCR never creates a record.
 * - The photo and its text are kept as audit evidence (immutable), visible to the uploader, the people who review
 *   that form in that plant, and the CEO, finance and admin. */
const crypto = require('node:crypto');
const M = require('../js/measure.js');
const audit = require('./audit');
const { HttpError } = require('./errors');
const { parseFields, sniffImage } = require('./ocr-parse');

const MAX_IMAGE = Math.floor(2.5 * 1024 * 1024);
const MAX_B64 = Math.ceil(MAX_IMAGE / 3) * 4;
const OCR_TIMEOUT_MS = 45e3;
const AUDITORS = ['ceo', 'finance', 'admin'];
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function makeOcr(db, clock, { usage }) {
  const iso = () => new Date(clock()).toISOString();
  let workerP = null; // one Tesseract worker per app, started on first use

  function worker() {
    if (!workerP) {
      workerP = (async () => {
        const { createWorker } = require('tesseract.js');
        const eng = require('@tesseract.js-data/eng');
        return createWorker('eng', 1, { langPath: eng.langPath, gzip: eng.gzip, cacheMethod: 'none', logger: () => {}, errorHandler: () => {} });
      })();
      workerP.catch(() => { workerP = null; });
    }
    return workerP;
  }
  async function recognize(buf) {
    const w = await worker();
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('OCR timed out')), OCR_TIMEOUT_MS); });
    try {
      const r = await Promise.race([w.recognize(buf), timeout]);
      return { text: String(r.data.text || ''), confidence: Number.isFinite(r.data.confidence) ? r.data.confidence : null };
    } finally { clearTimeout(timer); }
  }

  async function read(user, body) {
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Send the photo and the form it belongs to.');
    const formId = body.form;
    if (typeof formId !== 'string' || !Object.prototype.hasOwnProperty.call(M.FORMS, formId)) throw new HttpError(400, 'Choose the form the photo belongs to.');
    if (!M.formsFor(user).includes(formId)) throw new HttpError(403, 'This form belongs to another department.');
    const plant = body.plant === undefined ? (user.plant === 'all' ? 'GRP' : user.plant) : body.plant;
    if (!M.PLANT_IDS.includes(plant)) throw new HttpError(400, 'Unknown plant.');
    if (user.plant !== 'all' && plant !== user.plant) throw new HttpError(403, `You can only upload for plant ${user.plant}.`);
    const b64 = typeof body.image === 'string' ? body.image.replace(/^data:image\/[a-z]+;base64,/i, '') : '';
    if (!b64 || !B64_RE.test(b64)) throw new HttpError(400, 'Send the photo as base64 (PNG, JPEG or WebP).');
    if (b64.length > MAX_B64) throw new HttpError(413, 'The photo is larger than 2.5 MB. Take it at a lower resolution or crop it to the page.');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > MAX_IMAGE) throw new HttpError(413, 'The photo is larger than 2.5 MB.');
    const mime = sniffImage(buf);
    if (!mime) throw new HttpError(415, 'Only PNG, JPEG or WebP photos can be read.');

    const t0 = performance.now();
    let r;
    try { r = await recognize(buf); } catch (e) {
      console.error(`[${iso()}] OCR failed: ${e.message}`);
      throw new HttpError(422, 'The photo could not be read. Try a sharper, well-lit photo taken straight on.');
    }
    const ms = Math.round(performance.now() - t0);
    const parsed = parseFields(r.text, M.FORMS[formId]);
    const text = r.text.slice(0, 20000);
    const id = await db.tx(async t => {
      const now = iso();
      const ins = await t.run(`INSERT INTO documents (uploaded_by, uploaded_at, plant, form, mime, bytes, sha256, ocr_text, confidence, ms, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.id, now, plant, formId, mime, buf.length, crypto.createHash('sha256').update(buf).digest('hex'), text, r.confidence, ms, buf]);
      await audit.append(t, { ts: now, user, action: 'document.ocr', target: `document:${ins.lastInsertRowid}`, detail: { form: formId, plant, bytes: buf.length, matched: parsed.matches.length, msg: `${user.username} read a ${M.FORMS[formId].label.toLowerCase()} photo (${parsed.matches.length} values found)` } });
      return ins.lastInsertRowid;
    });
    await usage.log('ocr', { ms, bytes: buf.length, detail: { form: formId, confidence: r.confidence, matched: parsed.matches.length } });
    return {
      document: { id, form: formId, plant, mime, bytes: buf.length },
      text, confidence: r.confidence, ms,
      prefill: { ...parsed.prefill }, date: parsed.date, matches: parsed.matches, rejected: parsed.rejected, unmatched: parsed.unmatched.slice(0, 50),
    };
  }

  /** The stored photo, for people allowed to see it; 404 for everyone else (no hint that it exists). */
  async function image(user, id) {
    const d = await db.get('SELECT id, uploaded_by, plant, form, mime, image FROM documents WHERE id = ?', [id]);
    const inPlant = d && (user.plant === 'all' || user.plant === d.plant);
    const ok = d && (d.uploaded_by === user.id || (inPlant && (AUDITORS.includes(user.role) || M.reviewableForms(user).includes(d.form))));
    if (!ok) throw new HttpError(404, 'No such document.');
    return { mime: d.mime, buf: Buffer.from(d.image) };
  }

  async function close() {
    const p = workerP;
    workerP = null;
    if (!p) return;
    try { await (await p).terminate(); } catch { /* never started */ }
  }

  return { read, image, close, MAX_B64 };
}

module.exports = { makeOcr, MAX_IMAGE };
