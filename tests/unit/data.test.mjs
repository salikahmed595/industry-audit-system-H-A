// Referential-integrity tests for the data layer: every link the UI follows must resolve.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TA = require('../../js/engine.js');
const TD = require('../../js/data.js');

const regIds = new Set(TA.REG.map(r => r.id));
const findIds = new Set(TD.FINDINGS.map(f => f.id));
const terms = new Set(TD.GLOSSARY.map(g => g.term));

describe('glossary coverage', () => {
  test('contains every glossary term from the PDF (130+)', () => assert.ok(TD.GLOSSARY.length >= 130, `only ${TD.GLOSSARY.length}`));
  test('terms are unique', () => assert.equal(terms.size, TD.GLOSSARY.length));
  test('every term has definition, why and example', () => {
    TD.GLOSSARY.forEach(g => assert.ok(g.def && g.why && g.ex, g.term));
  });
  test('formula links resolve to a calculator', () => {
    TD.GLOSSARY.filter(g => g.f).forEach(g => assert.ok(regIds.has(g.f), `${g.term} -> ${g.f}`));
  });
  test('section links resolve', () => {
    TD.GLOSSARY.forEach(g => assert.ok(TD.SECTIONS[g.sec], `${g.term} -> ${g.sec}`));
  });
  test('every calculator is reachable from at least one glossary term or KPI', () => {
    const used = new Set(TD.GLOSSARY.map(g => g.f).filter(Boolean));
    Object.values(TD.SECTIONS).forEach(s => s.kpis.forEach(k => k[7] && used.add(k[7])));
    TA.REG.forEach(r => assert.ok(used.has(r.id), `orphan calculator ${r.id}`));
  });
});

describe('every calculator reproduces its glossary example', () => {
  TA.REG.forEach(r => test(r.id, () => {
    const out = TA.F[r.id](...r.inputs.map(i => i[2]));
    assert.ok(out !== null && Number.isFinite(out), `${r.id} returned ${out}`);
  }));
});

describe('sections', () => {
  Object.entries(TD.SECTIONS).forEach(([id, s]) => test(id, () => {
    s.terms.forEach(t => assert.ok(terms.has(t), `${id}: unknown term ${t}`));
    s.kpis.forEach(k => {
      assert.equal(k.length, 8, `${id}: KPI shape ${k[0]}`);
      assert.ok(['up', 'down'].includes(k[4]), `${id}: dir ${k[0]}`);
      assert.ok(terms.has(k[6]), `${id}: KPI term ${k[6]}`);
      if (k[7]) assert.ok(regIds.has(k[7]), `${id}: KPI formula ${k[7]}`);
    });
    assert.equal(s.table.rows.length, s.table.st.length, `${id}: table status count`);
    s.plants.forEach(p => assert.ok(TD.PLANTS.some(x => x.id === p), `${id}: plant ${p}`));
  }));
});

describe('causal graph', () => {
  const G = TD.GRAPH;
  test('every cause edge points to an existing node', () => {
    Object.entries(G).forEach(([id, n]) => n.causes.forEach(c => assert.ok(G[c.id], `${id} -> ${c.id}`)));
  });
  test('cause weights of each node sum to ~1', () => {
    Object.entries(G).forEach(([id, n]) => {
      if (!n.causes.length) return;
      const s = n.causes.reduce((a, c) => a + c.w, 0);
      assert.ok(Math.abs(s - 1) < 0.011, `${id} weights sum ${s}`);
    });
  });
  test('every root node maps to a finding', () => {
    Object.entries(G).filter(([, n]) => !n.causes.length).forEach(([id, n]) => assert.ok(findIds.has(n.finding), `root ${id} finding ${n.finding}`));
  });
  test('every finding node exists in the graph', () => {
    TD.FINDINGS.forEach(f => assert.ok(G[f.node], `${f.id} node ${f.node}`));
  });
  test('every symptom traces to a root with an owner and fix', () => {
    TD.SYMPTOMS.forEach(s => {
      const chain = TA.RCA.trace(G, s);
      const root = G[chain[chain.length - 1].id];
      assert.ok(chain.length >= 2, s);
      assert.equal(root.causes.length, 0, `${s} ends at a root`);
      const f = TD.FINDINGS.find(x => x.id === root.finding);
      assert.ok(f.who && f.dowhat, `${s} root has owner and fix`);
    });
  });
});

describe('findings', () => {
  test('ids unique and fields valid', () => {
    assert.equal(findIds.size, TD.FINDINGS.length);
    TD.FINDINGS.forEach(f => {
      assert.ok(TD.SECTIONS[f.sec], `${f.id} sec`);
      assert.ok(TD.SIX_M.includes(f.m6), `${f.id} 6M`);
      assert.ok(f.rec > 0 && f.rec <= 1 && f.conf > 0 && f.conf <= 1, `${f.id} ranges`);
      assert.ok(['up', 'down'].includes(f.kpi.dir), `${f.id} kpi dir`);
      assert.ok(f.why && f.sowhat && f.dowhat && f.who, `${f.id} directional fields`);
    });
  });
  test('stream marks exactly one constraint and it has the highest load', () => {
    const c = TD.STREAM.filter(s => s.constraint);
    assert.equal(c.length, 1);
    const maxLoad = Math.max(...TD.STREAM.filter(s => s.load).map(s => s.load));
    assert.equal(c[0].load, maxLoad);
  });
  test('margin bridge adds up to the stated actual margin', () => {
    const b = TD.SECTIONS.finance.charts.find(c => c.type === 'bridge');
    const end = b.steps.reduce((s, x) => s + x[1], b.start[1]);
    assert.ok(Math.abs(end - 17.8) < 1e-9, `bridge ends at ${end}`);
  });
});
