// Unit tests: turning OCR text from a photographed ledger or checklist into form values (server/ocr-parse.js).
// Pure functions only; the OCR engine itself is exercised by tests/integration/automation.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseFields, sniffImage } = require('../../server/ocr-parse.js');
const M = require('../../js/measure.js');

const LEDGER = 'SPINNING SHIFT LOG Shift A RF-02\nCotton fed kg: 1500\n\nYarn produced kg: 1290\n\nTotal waste kg: 190\n\nDate: 2026-11-20\n';

test('matches ledger lines to form fields by their labels, not by position', () => {
  const r = parseFields(LEDGER, M.FORMS.spin_shift);
  assert.equal(r.prefill.cotton_kg, 1500);
  assert.equal(r.prefill.yarn_kg, 1290);
  assert.equal(r.prefill.waste_total_kg, 190);
  assert.equal(r.prefill.shift, 'A');
  assert.equal(r.date, '2026-11-20');
  assert.equal(r.prefill.waste_card_kg, undefined, '"Total waste" must not also fill "Card waste"');
});
test('reads thousands separators and common OCR digit slips (O for 0, l for 1)', () => {
  const r = parseFields('Cotton fed: 1,5O0 kg\nGood yarn produced  l290', M.FORMS.spin_shift);
  assert.equal(r.prefill.cotton_kg, 1500);
  assert.equal(r.prefill.yarn_kg, 1290);
});
test('a value outside the field limits is reported, never prefilled', () => {
  const r = parseFields('Cotton fed kg: 99999999', M.FORMS.spin_shift);
  assert.equal(r.prefill.cotton_kg, undefined);
  assert.ok(r.rejected.some(x => x.field === 'cotton_kg'));
});
test('lines it cannot place are returned for the person to read', () => {
  const r = parseFields('Supervisor signature: illegible\nCotton fed 1500', M.FORMS.spin_shift);
  assert.ok(r.unmatched.some(l => /Supervisor/.test(l)));
});
test('works for any form, so other industries only add forms', () => {
  const r = parseFields('Unplanned downtime hours: 6.5\nBreakdowns: 2', M.FORMS.maintenance_day);
  assert.equal(r.prefill.unplanned_downtime_h, 6.5);
  assert.equal(r.prefill.breakdowns, 2);
});
test('empty or hostile text yields nothing', () => {
  assert.deepEqual(Object.keys(parseFields('', M.FORMS.spin_shift).prefill), []);
  const r = parseFields('<script>alert(1)</script> 5\n__proto__: 7\nconstructor 9', M.FORMS.spin_shift);
  assert.deepEqual(Object.keys(r.prefill), []);
  assert.equal(Object.getPrototypeOf(r.prefill), null);
});
test('recognises PNG, JPEG and WebP by their bytes, whatever the file claims', () => {
  assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), 'image/png');
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
  assert.equal(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'image/webp');
  assert.equal(sniffImage(Buffer.from('%PDF-1.7')), null);
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
});
