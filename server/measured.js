'use strict';
/* Ground-truth KPIs: computed from APPROVED department records only (js/measure.js).
 * A KPI with no approved records is returned as value null ("Not measured"), never as a demo number.
 * Plant-scoped users get their own plant only. Results are cached per plant/period/day and dropped
 * the moment an approval or void changes the approved set. */
const M = require('../js/measure.js');
const { HttpError } = require('./errors');

const PLANTS = ['all', ...M.PLANT_IDS];
const CACHE_MAX = 64;

function makeMeasured(records, clock) {
  const cache = new Map();
  async function get(query, user) {
    const own = user && user.plant !== 'all' ? user.plant : null;
    const plant = query.get('plant') || own || 'all';
    const period = query.get('period') || 'm';
    if (!PLANTS.includes(plant)) throw new HttpError(400, `plant must be one of ${PLANTS.join(', ')}.`);
    if (!Object.prototype.hasOwnProperty.call(M.PERIODS, period)) throw new HttpError(400, `period must be one of ${Object.keys(M.PERIODS).join(', ')}.`);
    if (own && plant !== own) throw new HttpError(403, `You can only see measured KPIs for plant ${own}.`);
    const today = new Date(clock()).toISOString().slice(0, 10);
    const key = `${plant}|${period}|${today}|${await records.generation()}`;
    if (cache.has(key)) return cache.get(key);
    const win = M.windowFor(period, today);
    const out = M.measureAll(await records.approvedSince(win.from), { plant, period, today });
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, out);
    return out;
  }
  return { get };
}

module.exports = { makeMeasured };
