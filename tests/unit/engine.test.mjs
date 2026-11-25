// Unit tests for the pure audit engine. Golden values are the worked
// examples printed in "TEXTILES AUDIT SYSTEM KEY TERMS GLOSSARY.pdf".
// Run: node --test tests/unit
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { F, RCA, fmt, util } = require('../../js/engine.js');

const near = (actual, expected, tol = 0.05) =>
  assert.ok(actual !== null && Math.abs(actual - expected) <= tol, `expected ~${expected}, got ${actual}`);

describe('glossary formulas: fiber, yarn, spinning', () => {
  test('yield 950 kg yarn from 1,000 kg fiber = 95%', () => near(F.yieldPct(950, 1000), 95));
  test('spinning waste 500 kg of 10,000 kg = 5%', () => near(F.wastePct(500, 10000), 5));
  test('blow room 2% loss on 10,000 kg = 200 kg', () => near(F.lossKg(10000, 2), 200));
  test('card waste 4% on 10,000 kg = 400 kg', () => near(F.lossKg(10000, 4), 400));
  test('Ne 30 converts to ~19.7 tex', () => near(F.neToTex(30), 19.68, 0.01));
  test('150 denier = 16.67 tex and back', () => {
    near(F.denierToTex(150), 16.67, 0.01);
    near(F.texToDenier(F.denierToTex(150)), 150, 1e-9);
  });
  test('CSP = count x strength', () => near(F.csp(30, 85), 2550));
});

describe('glossary formulas: weaving, fabric, dyeing', () => {
  test('loom 100 m/h for 20 h = 2,000 m/day', () => near(F.loomOutput(100, 20), 2000));
  test('GSM: 180 g over 1 m2 = 180', () => near(F.gsm(180, 1), 180));
  test('defect rate 300 m of 10,000 m = 3%', () => near(F.defectRate(300, 10000), 3));
  test('shrinkage 100 cm to 97 cm = 3%', () => near(F.shrinkage(100, 97), 3));
  test('dye 2% on 10,000 kg = 200 kg', () => near(F.dyeUsed(10000, 2), 200));
  test('re-dye 1,000 kg at PKR 250 = PKR 250,000', () => near(F.redyeCost(1000, 250), 250000));
  test('chemical variance 110 vs 100 = +10%', () => near(F.chemVariance(110, 100), 10));
});

describe('glossary formulas: cutting and sewing', () => {
  test('marker efficiency 8.06 / 9.60 m2 = 83.9%', () => near(F.markerEfficiency(8.06, 9.6), 83.96, 0.1));
  test('fabric utilization 800 / 1,000 m = 80%', () => near(F.fabricUtilization(800, 1000), 80));
  test('end loss 0.5 m per 50 m roll = 1%', () => near(F.endLoss(0.5, 50), 1));
  test('cutting ratio 1,000 m / 500 shirts = 2 m', () => near(F.consumptionPerGarment(1000, 500), 2));
  test('SAM 18 min + 20% allowance = 21.6', () => near(F.sam(18, 20), 21.6));
  test('line efficiency 500 x 20 / (20 x 600) = 83.3%', () => near(F.lineEfficiency(500, 20, 20, 600), 83.33));
  test('changeover 45 min x 10 = 7.5 h', () => near(F.changeoverHours(45, 10), 7.5));
});

describe('glossary formulas: quality and maintenance', () => {
  test('FPY 9,500 / 10,000 = 95%', () => near(F.fpy(9500, 10000), 95));
  test('rework rate 500 / 10,000 = 5%', () => near(F.reworkRate(500, 10000), 5));
  test('reject rate 200 / 10,000 = 2%', () => near(F.rejectRate(200, 10000), 2));
  test('DHU 150 defects / 3,000 units = 5', () => near(F.dhu(150, 3000), 5));
  test('MTBF 1,200 h / 6 failures = 200 h', () => near(F.mtbf(1200, 6), 200));
  test('MTTR 30 h / 10 repairs = 3 h', () => near(F.mttr(30, 10), 3));
  test('scrap rate 300 / 10,000 = 3%', () => near(F.scrapRate(300, 10000), 3));
  test('rework cost 500 h x 500 + 100,000 = 350,000', () => near(F.reworkCost(500, 500, 100000), 350000));
});

describe('glossary formulas: planning and OEE', () => {
  test('capacity 10 x 16 x 50 = 8,000/day', () => near(F.capacity(10, 16, 50), 8000));
  test('utilization 6,000 / 8,000 = 75%', () => near(F.utilization(6000, 8000), 75));
  test('takt 480 min / 240 units = 2 min', () => near(F.takt(480, 240), 2));
  test('OTIF 95 / 100 = 95%', () => near(F.otif(95, 100), 95));
  test('schedule adherence 900 / 1,000 = 90%', () => near(F.adherence(900, 1000), 90));
  test('availability 720 / 800 = 90%', () => near(F.availability(720, 800), 90));
  test('performance 680 / 800 = 85%', () => near(F.performance(680, 800), 85));
  test('quality 9,600 / 10,000 = 96%', () => near(F.quality(9600, 10000), 96));
  test('OEE 90 x 85 x 96 = 73.4%', () => near(F.oee(90, 85, 96), 73.44, 0.01));
  test('machine utilization 600 / 800 = 75%', () => near(F.machineUtilization(600, 800), 75));
  test('productivity 10,000 shirts / (50 x 8) = 25', () => near(F.productivity(10000, 400), 25));
  test('labor efficiency 10,000 / 12,000 = 83.3%', () => near(F.laborEfficiency(10000, 12000), 83.33));
});

describe('glossary formulas: inventory and procurement', () => {
  test('reorder point 500 x 10 + 1,000 = 6,000 kg', () => near(F.reorderPoint(500, 10, 1000), 6000));
  test('EOQ uses sqrt(2DS/H)', () => near(F.eoq(120000, 50000, 1000), 3464.1, 0.1));
  test('inventory turnover 600 / 100 = 6x', () => near(F.inventoryTurnover(600, 100), 6));
  test('DIO 100 / 600 x 365 = ~61 days', () => near(F.dio(100, 600), 60.83, 0.01));
  test('stock accuracy 950 / 1,000 = 95%', () => near(F.stockAccuracy(950, 1000), 95));
  test('incoming rejection 500 / 10,000 = 5%', () => near(F.rejectionRate(500, 10000), 5));
  test('PPV (520 - 500) x 10,000 = 200,000', () => near(F.ppv(520, 500, 10000), 200000));
  test('freight 1,000,000 / 50,000 = PKR 20', () => near(F.freightPerUnit(1e6, 5e4), 20));
});

describe('glossary formulas: finance', () => {
  test('revenue 100,000 x 2,000 = 200M', () => near(F.revenue(100000, 2000), 200e6));
  test('gross margin (200 - 140) / 200 = 30%', () => near(F.grossMargin(200, 140), 30));
  test('contribution 2,000 - 1,400 = 600', () => near(F.contribution(2000, 1400), 600));
  test('cost variance 1,520 - 1,400 = 120', () => near(F.costVariance(1520, 1400), 120));
  test('material variance 1,050,000 - 1,000,000 = 50,000', () => near(F.materialVariance(10500, 100, 10000, 100), 50000));
  test('labor variance 2.2M - 2.0M = 0.2M', () => near(F.laborVariance(2.2e6, 2.0e6), 0.2e6));
  test('overhead 10M / 100,000 = PKR 100 per shirt', () => near(F.overheadPerUnit(10e6, 1e5), 100));
  test('working capital 300 - 180 = 120', () => near(F.workingCapital(300, 180), 120));
  test('CCC 61 + 45 - 30 = 76 days', () => near(F.ccc(61, 45, 30), 76));
  test('DSO 75 / 600 x 365 = ~46 days', () => near(F.dso(75, 600), 45.63, 0.01));
  test('DPO 50 / 600 x 365 = ~30 days', () => near(F.dpo(50, 600), 30.42, 0.01));
  test('discount leakage 10 / 200 = 5%', () => near(F.discountLeakage(10, 200), 5));
});

describe('formula guards', () => {
  test('division by zero returns null, not Infinity', () => {
    assert.equal(F.yieldPct(10, 0), null);
    assert.equal(F.dhu(5, 0), null);
    assert.equal(F.takt(480, 0), null);
  });
  test('non-numeric or negative inputs return null', () => {
    assert.equal(F.yieldPct('abc', 100), null);
    assert.equal(F.gsm(-5, 1), null);
    assert.equal(F.eoq(100, 10, 0), null);
    assert.equal(F.oee(NaN, 90, 90), null);
  });
  test('variance formulas allow negative results (favourable)', () => {
    near(F.chemVariance(90, 100), -10);
    near(F.ppv(480, 500, 100), -2000);
  });
  test('numeric strings from form inputs are accepted', () => near(F.yieldPct('950', '1000'), 95));
});

describe('RCA.status: target banding', () => {
  test('higher-is-better at or above target is good', () => assert.equal(RCA.status(95, 92, 'up'), 'good'));
  test('higher-is-better within 5% below target is warn', () => assert.equal(RCA.status(88, 92, 'up'), 'warn'));
  test('higher-is-better far below target is bad', () => assert.equal(RCA.status(61, 75, 'up'), 'bad'));
  test('lower-is-better at or below target is good', () => assert.equal(RCA.status(2, 2.5, 'down'), 'good'));
  test('lower-is-better slightly above is warn', () => assert.equal(RCA.status(2.6, 2.5, 'down'), 'warn'));
  test('lower-is-better far above is bad', () => assert.equal(RCA.status(71, 55, 'down'), 'bad'));
  test('missing value is unknown', () => assert.equal(RCA.status(null, 10, 'up'), 'unknown'));
});

describe('RCA.trace: walks causes to the root', () => {
  const g = {
    otif: { causes: [{ id: 'dyeCap', w: 0.6 }, { id: 'finish', w: 0.4 }] },
    dyeCap: { causes: [{ id: 'redye', w: 0.7 }, { id: 'breakdown', w: 0.3 }] },
    redye: { causes: [{ id: 'labdip', w: 0.8 }] },
    labdip: { causes: [] },
    breakdown: { causes: [] },
    finish: { causes: [] },
  };
  test('follows the heaviest edge until a node with no causes', () => {
    assert.deepEqual(RCA.trace(g, 'otif').map(s => s.id), ['otif', 'dyeCap', 'redye', 'labdip']);
  });
  test('compounds contribution share along the path', () => {
    const chain = RCA.trace(g, 'otif');
    near(chain[3].share, 0.6 * 0.7 * 0.8, 1e-9);
  });
  test('survives cycles without looping forever', () => {
    const cyc = { a: { causes: [{ id: 'b', w: 1 }] }, b: { causes: [{ id: 'a', w: 1 }] } };
    assert.deepEqual(RCA.trace(cyc, 'a').map(s => s.id), ['a', 'b']);
  });
  test('unknown symptom returns empty chain', () => assert.deepEqual(RCA.trace(g, 'nope'), []));
});

describe('RCA.pareto', () => {
  test('sorts descending with cumulative % and vital-few flag', () => {
    const p = RCA.pareto([{ k: 'a', v: 10 }, { k: 'b', v: 60 }, { k: 'c', v: 30 }]);
    assert.deepEqual(p.map(x => x.k), ['b', 'c', 'a']);
    near(p[1].cum, 90);
    assert.deepEqual(p.map(x => x.vital), [true, true, false]);
  });
  test('empty input returns empty', () => assert.deepEqual(RCA.pareto([]), []));
});

describe('RCA.score and rank actions', () => {
  const a = { id: 'a', pkr: 6.4e6, customer: 2, effort: 2, risk: 1, confidence: 0.9 };
  const b = { id: 'b', pkr: 1.9e6, customer: 1, effort: 4, risk: 3, confidence: 0.6 };
  const c = { id: 'c', pkr: 5.8e6, customer: 5, effort: 3, risk: 2, confidence: 0.8 };
  test('higher impact with lower effort scores higher', () => assert.ok(RCA.score(a) > RCA.score(b)));
  test('rank returns sorted copy without mutating input', () => {
    const input = [b, a, c];
    const r = RCA.rank(input);
    assert.equal(r[r.length - 1].id, 'b');
    assert.deepEqual(input.map(x => x.id), ['b', 'a', 'c']);
  });
  test('score is bounded 0..100', () => {
    const s = RCA.score({ pkr: 1e12, customer: 5, effort: 1, risk: 1, confidence: 1 });
    assert.ok(s <= 100 && s >= 0);
  });
});

describe('RCA.health', () => {
  test('all good = 100, all bad = 0, mixed in between', () => {
    assert.equal(RCA.health(['good', 'good']), 100);
    assert.equal(RCA.health(['bad', 'bad']), 0);
    assert.equal(RCA.health(['good', 'warn', 'bad']), 50);
  });
  test('ignores unknown and handles empty', () => {
    assert.equal(RCA.health(['good', 'unknown']), 100);
    assert.equal(RCA.health([]), null);
  });
});

describe('RCA action workflow (human-in-the-loop)', () => {
  test('stages advance in order', () => {
    assert.equal(RCA.next('detected'), 'diagnosed');
    assert.equal(RCA.next('in_progress'), 'verified');
    assert.equal(RCA.next('verified'), null);
  });
  test('only approver roles can approve', () => {
    assert.equal(RCA.canMove('diagnosed', 'approved', 'ceo').ok, true);
    assert.equal(RCA.canMove('diagnosed', 'approved', 'plant').ok, true);
    assert.equal(RCA.canMove('diagnosed', 'approved', 'dept').ok, false);
  });
  test('stage skipping is rejected', () => {
    assert.equal(RCA.canMove('detected', 'verified', 'ceo').ok, false);
  });
  test('effectiveness check: verified fix that missed target can be reopened', () => {
    assert.equal(RCA.effective(86, 86, 'up'), true);
    assert.equal(RCA.effective(80, 86, 'up'), false);
    assert.equal(RCA.effective(3, 2.5, 'down'), false);
    assert.equal(RCA.canReopen('verified', false).ok, true);
    assert.equal(RCA.canReopen('verified', true).ok, false);
    assert.equal(RCA.canReopen('approved', false).ok, false);
  });
  test('verify requires measured after-value evidence', () => {
    assert.equal(RCA.canMove('in_progress', 'verified', 'plant', {}).ok, false);
    assert.equal(RCA.canMove('in_progress', 'verified', 'plant', { after: 86 }).ok, true);
  });
});

describe('fmt', () => {
  test('PKR compact units', () => {
    assert.equal(fmt.pkr(38500), 'PKR 38.5K');
    assert.equal(fmt.pkr(41e6), 'PKR 41.0M');
    assert.equal(fmt.pkr(310e6), 'PKR 310M');
    assert.equal(fmt.pkr(1.24e9), 'PKR 1.24B');
    assert.equal(fmt.pkr(null), '—');
  });
  test('number with fixed decimals and thousands separators', () => {
    assert.equal(fmt.num(3464.1016, 1), '3,464.1');
    assert.equal(fmt.num(null), '—');
  });
});

describe('util security and search', () => {
  test('esc neutralises HTML injection', () => {
    assert.equal(util.esc('<img src=x onerror=alert(1)>"&\''), '&lt;img src=x onerror=alert(1)&gt;&quot;&amp;&#39;');
    assert.equal(util.esc(null), '');
  });
  test('search ranks name matches above body matches, all tokens required', () => {
    const items = [
      { name: 'Days sales outstanding', body: 'collect payment' },
      { name: 'Shade matching', body: 'compare dyed sample' },
      { name: 'Lab dip', body: 'small sample dyed to test shade' },
    ];
    const r = util.search('shade', items, x => x.name, x => x.body);
    assert.deepEqual(r.map(x => x.name), ['Shade matching', 'Lab dip']);
    assert.equal(util.search('shade payment', items, x => x.name, x => x.body).length, 0);
    assert.equal(util.search('   ', items, x => x.name, x => x.body).length, 0);
  });
});
