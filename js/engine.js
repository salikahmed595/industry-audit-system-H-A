/* Textile AI Audit — pure engine (no DOM).
 * Formulas from the Key Terms Glossary, root-cause tracing, scoring,
 * the human-in-the-loop action workflow, formatting and safe helpers.
 * Works as a browser global (window.TA) and as a CommonJS module for tests. */
(function (root) {
  'use strict';

  // ---------- input guards ----------
  const toNum = v => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const div = (a, b) => (b > 0 ? a / b : null);
  const pct = (a, b) => { const r = div(a, b); return r === null ? null : r * 100; };
  const rel = (a, b) => { const r = div(a - b, b); return r === null ? null : r * 100; };
  const days = (a, b) => { const r = div(a, b); return r === null ? null : r * 365; };

  // ---------- formula registry ----------
  // inputs: [key, label, glossaryExampleValue]
  const REG = [
    // Fiber, yarn & spinning
    { id: 'yieldPct', name: 'Yield', domain: 'Spinning', unit: '%', formula: 'Good output / Input × 100', inputs: [['good', 'Good output (kg)', 950], ['input', 'Input (kg)', 1000]], fn: (g, i) => pct(g, i) },
    { id: 'wastePct', name: 'Spinning waste', domain: 'Spinning', unit: '%', formula: 'Waste kg / Input kg × 100', inputs: [['waste', 'Waste (kg)', 500], ['input', 'Input (kg)', 10000]], fn: (w, i) => pct(w, i) },
    { id: 'lossKg', name: 'Process loss (blow room / card / comber)', domain: 'Spinning', unit: 'kg', formula: 'Input kg × Loss %', inputs: [['input', 'Input (kg)', 10000], ['loss', 'Loss %', 2]], fn: (i, l) => i * l / 100 },
    { id: 'neToTex', name: 'Ne count → Tex', domain: 'Fiber & Yarn', unit: 'tex', formula: 'Tex = 590.5 / Ne', inputs: [['ne', 'English count (Ne)', 30]], fn: ne => div(590.5, ne) },
    { id: 'denierToTex', name: 'Denier → Tex', domain: 'Fiber & Yarn', unit: 'tex', formula: 'Tex = Denier / 9', inputs: [['den', 'Denier', 150]], fn: d => d / 9 },
    { id: 'texToDenier', name: 'Tex → Denier', domain: 'Fiber & Yarn', unit: 'den', formula: 'Denier = Tex × 9', inputs: [['tex', 'Tex', 30]], fn: t => t * 9 },
    { id: 'csp', name: 'Count strength product (CSP)', domain: 'Spinning', unit: 'CSP', formula: 'CSP = Count × Lea strength (lbs)', inputs: [['count', 'Yarn count (Ne)', 30], ['str', 'Lea strength (lbs)', 85]], fn: (c, s) => c * s },
    // Weaving, knitting & fabric
    { id: 'loomOutput', name: 'Loom output per day', domain: 'Weaving & Knitting', unit: 'm', formula: 'Metres per hour × Running hours', inputs: [['rate', 'Metres per hour', 100], ['hours', 'Running hours', 20]], fn: (r, h) => r * h },
    { id: 'gsm', name: 'GSM', domain: 'Weaving & Knitting', unit: 'g/m²', formula: 'Fabric weight (g) / Area (m²)', inputs: [['g', 'Sample weight (g)', 180], ['a', 'Sample area (m²)', 1]], fn: (g, a) => div(g, a) },
    { id: 'defectRate', name: 'Fabric defect rate', domain: 'Weaving & Knitting', unit: '%', formula: 'Defective length / Total length × 100', inputs: [['d', 'Defective metres', 300], ['t', 'Total metres', 10000]], fn: (d, t) => pct(d, t) },
    { id: 'shrinkage', name: 'Fabric shrinkage', domain: 'Weaving & Knitting', unit: '%', formula: '(Original − Final) / Original × 100', inputs: [['o', 'Original (cm)', 100], ['f', 'Final (cm)', 97]], fn: (o, f) => { const r = div(o - f, o); return r === null ? null : r * 100; } },
    // Dyeing & finishing
    { id: 'dyeUsed', name: 'Dye consumption', domain: 'Dyeing & Finishing', unit: 'kg', formula: 'Fabric kg × Shade depth %', inputs: [['kg', 'Fabric (kg)', 10000], ['depth', 'Shade depth %', 2]], fn: (k, d) => k * d / 100 },
    { id: 'redyeCost', name: 'Re-dyeing cost', domain: 'Dyeing & Finishing', unit: 'PKR', formula: 'Re-dyed kg × Cost per kg', inputs: [['kg', 'Re-dyed (kg)', 1000], ['rate', 'PKR per kg', 250]], fn: (k, r) => k * r },
    { id: 'chemVariance', name: 'Chemical consumption variance', domain: 'Dyeing & Finishing', unit: '%', formula: '(Actual − Standard) / Standard × 100', inputs: [['a', 'Actual (kg)', 110], ['s', 'Standard (kg)', 100]], fn: (a, s) => rel(a, s) },
    // Cutting & sewing
    { id: 'markerEfficiency', name: 'Marker efficiency', domain: 'Cutting', unit: '%', formula: 'Pattern-piece area / Marker area × 100', inputs: [['p', 'Pattern area (m²)', 8.06], ['m', 'Marker area (m²)', 9.6]], fn: (p, m) => pct(p, m) },
    { id: 'fabricUtilization', name: 'Fabric utilization', domain: 'Cutting', unit: '%', formula: 'Fabric in garments / Fabric consumed × 100', inputs: [['u', 'In garments (m)', 800], ['c', 'Consumed (m)', 1000]], fn: (u, c) => pct(u, c) },
    { id: 'endLoss', name: 'End loss', domain: 'Cutting', unit: '%', formula: 'Leftover per roll / Roll length × 100', inputs: [['l', 'Left per roll (m)', 0.5], ['r', 'Roll length (m)', 50]], fn: (l, r) => pct(l, r) },
    { id: 'consumptionPerGarment', name: 'Cutting ratio (fabric per garment)', domain: 'Cutting', unit: 'm', formula: 'Fabric consumed / Garments produced', inputs: [['f', 'Fabric consumed (m)', 1000], ['g', 'Garments', 500]], fn: (f, g) => div(f, g) },
    { id: 'sam', name: 'SAM (standard allowed minutes)', domain: 'Sewing', unit: 'min', formula: 'Basic time × (1 + Allowance %)', inputs: [['b', 'Basic time (min)', 18], ['al', 'Allowance %', 20]], fn: (b, a) => b * (1 + a / 100) },
    { id: 'lineEfficiency', name: 'Line efficiency', domain: 'Sewing', unit: '%', formula: '(Units × SAM) / (Operators × Minutes) × 100', inputs: [['u', 'Units produced', 500], ['s', 'SAM', 20], ['o', 'Operators', 20], ['m', 'Working minutes', 600]], fn: (u, s, o, m) => pct(u * s, o * m) },
    { id: 'changeoverHours', name: 'Changeover time lost', domain: 'Planning', unit: 'h', formula: 'Minutes per changeover × Count / 60', inputs: [['m', 'Minutes each', 45], ['n', 'Changeovers', 10]], fn: (m, n) => m * n / 60 },
    // Quality
    { id: 'fpy', name: 'First-pass yield (FPY)', domain: 'Quality', unit: '%', formula: 'Accepted without rework / Presented × 100', inputs: [['a', 'Accepted first time', 9500], ['t', 'Units presented', 10000]], fn: (a, t) => pct(a, t) },
    { id: 'reworkRate', name: 'Rework rate', domain: 'Quality', unit: '%', formula: 'Reworked / Total × 100', inputs: [['r', 'Reworked units', 500], ['t', 'Total units', 10000]], fn: (r, t) => pct(r, t) },
    { id: 'rejectRate', name: 'Reject rate', domain: 'Quality', unit: '%', formula: 'Rejected / Total × 100', inputs: [['r', 'Rejected units', 200], ['t', 'Total units', 10000]], fn: (r, t) => pct(r, t) },
    { id: 'dhu', name: 'DHU (defects per hundred units)', domain: 'Quality', unit: 'DHU', formula: 'Total defects / Units inspected × 100', inputs: [['d', 'Defects found', 150], ['u', 'Units inspected', 3000]], fn: (d, u) => pct(d, u) },
    { id: 'scrapRate', name: 'Scrap rate', domain: 'Quality', unit: '%', formula: 'Scrap / Total input × 100', inputs: [['s', 'Scrap (kg)', 300], ['t', 'Input (kg)', 10000]], fn: (s, t) => pct(s, t) },
    { id: 'reworkCost', name: 'Rework cost', domain: 'Quality', unit: 'PKR', formula: 'Rework hours × Labor rate + Extra material', inputs: [['h', 'Rework hours', 500], ['r', 'PKR per hour', 500], ['m', 'Extra material (PKR)', 100000]], fn: (h, r, m) => h * r + m },
    // Maintenance
    { id: 'mtbf', name: 'Mean time between failures', domain: 'Maintenance', unit: 'h', formula: 'Operating time / Failures', inputs: [['t', 'Operating hours', 1200], ['f', 'Failures', 6]], fn: (t, f) => div(t, f) },
    { id: 'mttr', name: 'Mean time to repair', domain: 'Maintenance', unit: 'h', formula: 'Total repair time / Repairs', inputs: [['t', 'Repair hours', 30], ['n', 'Repairs', 10]], fn: (t, n) => div(t, n) },
    // Planning & capacity
    { id: 'capacity', name: 'Capacity', domain: 'Planning', unit: 'units/day', formula: 'Machines × Hours × Output per machine-hour', inputs: [['m', 'Machines', 10], ['h', 'Hours per day', 16], ['r', 'Units per machine-hour', 50]], fn: (m, h, r) => m * h * r },
    { id: 'utilization', name: 'Capacity utilization', domain: 'Planning', unit: '%', formula: 'Actual output / Max possible × 100', inputs: [['a', 'Actual output', 6000], ['m', 'Max possible', 8000]], fn: (a, m) => pct(a, m) },
    { id: 'takt', name: 'Takt time', domain: 'Planning', unit: 'min/unit', formula: 'Available time / Customer demand', inputs: [['t', 'Available minutes', 480], ['d', 'Demand (units)', 240]], fn: (t, d) => div(t, d) },
    { id: 'otif', name: 'On-time-in-full (OTIF)', domain: 'Planning', unit: '%', formula: 'On-time & complete orders / Total × 100', inputs: [['o', 'On time & in full', 95], ['t', 'Total orders', 100]], fn: (o, t) => pct(o, t) },
    { id: 'adherence', name: 'Schedule adherence', domain: 'Planning', unit: '%', formula: 'Actual output per plan / Planned × 100', inputs: [['a', 'Completed as planned', 900], ['p', 'Planned', 1000]], fn: (a, p) => pct(a, p) },
    // OEE & productivity
    { id: 'availability', name: 'Availability', domain: 'OEE & Productivity', unit: '%', formula: 'Run time / Planned time × 100', inputs: [['r', 'Run minutes', 720], ['p', 'Planned minutes', 800]], fn: (r, p) => pct(r, p) },
    { id: 'performance', name: 'Performance', domain: 'OEE & Productivity', unit: '%', formula: 'Actual / Rated output in run time × 100', inputs: [['a', 'Actual units', 680], ['r', 'Rated units', 800]], fn: (a, r) => pct(a, r) },
    { id: 'quality', name: 'Quality rate', domain: 'OEE & Productivity', unit: '%', formula: 'Good units / Total units × 100', inputs: [['g', 'Good units', 9600], ['t', 'Total units', 10000]], fn: (g, t) => pct(g, t) },
    { id: 'oee', name: 'OEE', domain: 'OEE & Productivity', unit: '%', formula: 'Availability × Performance × Quality', inputs: [['a', 'Availability %', 90], ['p', 'Performance %', 85], ['q', 'Quality %', 96]], fn: (a, p, q) => a * p * q / 10000 },
    { id: 'machineUtilization', name: 'Machine utilization', domain: 'OEE & Productivity', unit: '%', formula: 'Running time / Available time × 100', inputs: [['r', 'Running hours', 600], ['a', 'Available hours', 800]], fn: (r, a) => pct(r, a) },
    { id: 'productivity', name: 'Productivity', domain: 'OEE & Productivity', unit: 'units/worker-h', formula: 'Output / Worker-hours', inputs: [['o', 'Output (units)', 10000], ['h', 'Worker-hours', 400]], fn: (o, h) => div(o, h) },
    { id: 'laborEfficiency', name: 'Labor efficiency', domain: 'OEE & Productivity', unit: '%', formula: 'Earned minutes / Attended minutes × 100', inputs: [['e', 'Earned minutes', 10000], ['a', 'Attended minutes', 12000]], fn: (e, a) => pct(e, a) },
    // Inventory & procurement
    { id: 'reorderPoint', name: 'Reorder point', domain: 'Inventory', unit: 'kg', formula: 'Daily usage × Lead time + Safety stock', inputs: [['u', 'Daily usage (kg)', 500], ['l', 'Lead time (days)', 10], ['s', 'Safety stock (kg)', 1000]], fn: (u, l, s) => u * l + s },
    { id: 'eoq', name: 'Economic order quantity', domain: 'Inventory', unit: 'kg', formula: '√(2 × Annual demand × Order cost / Holding cost)', inputs: [['d', 'Annual demand (kg)', 120000], ['s', 'Cost per order (PKR)', 50000], ['h', 'Holding cost per kg/yr (PKR)', 1000]], fn: (d, s, h) => { const r = div(2 * d * s, h); return r === null ? null : Math.sqrt(r); },
      note: 'The glossary prints EOQ = 3,465 kg with a holding cost of PKR 100/kg, but the formula gives 10,954 kg at PKR 100. The 3,465 kg result needs PKR 1,000/kg, so that value is used here.' },
    { id: 'inventoryTurnover', name: 'Inventory turnover', domain: 'Inventory', unit: '×/yr', formula: 'COGS / Average inventory', inputs: [['c', 'COGS (PKR M)', 600], ['i', 'Avg inventory (PKR M)', 100]], fn: (c, i) => div(c, i) },
    { id: 'dio', name: 'Days inventory outstanding', domain: 'Inventory', unit: 'days', formula: 'Average inventory / COGS × 365', inputs: [['i', 'Avg inventory (PKR M)', 100], ['c', 'COGS (PKR M)', 600]], fn: (i, c) => days(i, c) },
    { id: 'stockAccuracy', name: 'Stock accuracy', domain: 'Inventory', unit: '%', formula: 'Matching SKUs / SKUs counted × 100', inputs: [['m', 'Matching SKUs', 950], ['t', 'SKUs counted', 1000]], fn: (m, t) => pct(m, t) },
    { id: 'rejectionRate', name: 'Incoming rejection rate', domain: 'Procurement', unit: '%', formula: 'Rejected / Received × 100', inputs: [['r', 'Rejected (kg)', 500], ['t', 'Received (kg)', 10000]], fn: (r, t) => pct(r, t) },
    { id: 'ppv', name: 'Purchase-price variance', domain: 'Procurement', unit: 'PKR', formula: '(Actual price − Standard price) × Quantity', inputs: [['a', 'Actual PKR/kg', 520], ['s', 'Standard PKR/kg', 500], ['q', 'Quantity (kg)', 10000]], fn: (a, s, q) => (a - s) * q },
    { id: 'freightPerUnit', name: 'Freight cost per unit', domain: 'Procurement', unit: 'PKR', formula: 'Total freight / Units shipped', inputs: [['f', 'Total freight (PKR)', 1000000], ['u', 'Units shipped', 50000]], fn: (f, u) => div(f, u) },
    // Finance
    { id: 'revenue', name: 'Revenue', domain: 'Finance', unit: 'PKR', formula: 'Units sold × Price', inputs: [['u', 'Units sold', 100000], ['p', 'Price (PKR)', 2000]], fn: (u, p) => u * p },
    { id: 'grossMargin', name: 'Gross margin', domain: 'Finance', unit: '%', formula: '(Revenue − COGS) / Revenue × 100', inputs: [['r', 'Revenue (PKR M)', 200], ['c', 'COGS (PKR M)', 140]], fn: (r, c) => { const x = div(r - c, r); return x === null ? null : x * 100; } },
    { id: 'contribution', name: 'Contribution margin', domain: 'Finance', unit: 'PKR', formula: 'Price − Variable cost', inputs: [['p', 'Price (PKR)', 2000], ['v', 'Variable cost (PKR)', 1400]], fn: (p, v) => p - v },
    { id: 'costVariance', name: 'Cost variance', domain: 'Finance', unit: 'PKR', formula: 'Actual cost − Standard cost', inputs: [['a', 'Actual (PKR)', 1520], ['s', 'Standard (PKR)', 1400]], fn: (a, s) => a - s },
    { id: 'materialVariance', name: 'Material cost variance', domain: 'Finance', unit: 'PKR', formula: '(AQ × AP) − (SQ × SP)', inputs: [['aq', 'Actual qty', 10500], ['ap', 'Actual price', 100], ['sq', 'Standard qty', 10000], ['sp', 'Standard price', 100]], fn: (aq, ap, sq, sp) => aq * ap - sq * sp },
    { id: 'laborVariance', name: 'Labor cost variance', domain: 'Finance', unit: 'PKR', formula: 'Actual labor − Standard labor', inputs: [['a', 'Actual (PKR)', 2200000], ['s', 'Standard (PKR)', 2000000]], fn: (a, s) => a - s },
    { id: 'overheadPerUnit', name: 'Overhead absorption', domain: 'Finance', unit: 'PKR/unit', formula: 'Factory overhead / Units', inputs: [['o', 'Overhead (PKR)', 10000000], ['u', 'Units', 100000]], fn: (o, u) => div(o, u) },
    { id: 'workingCapital', name: 'Working capital', domain: 'Finance', unit: 'PKR M', formula: 'Current assets − Current liabilities', inputs: [['a', 'Current assets (PKR M)', 300], ['l', 'Current liabilities (PKR M)', 180]], fn: (a, l) => a - l },
    { id: 'ccc', name: 'Cash conversion cycle', domain: 'Finance', unit: 'days', formula: 'DIO + DSO − DPO', inputs: [['dio', 'DIO', 61], ['dso', 'DSO', 45], ['dpo', 'DPO', 30]], fn: (i, s, p) => i + s - p },
    { id: 'dso', name: 'Days sales outstanding', domain: 'Finance', unit: 'days', formula: 'Receivables / Revenue × 365', inputs: [['ar', 'Receivables (PKR M)', 75], ['r', 'Revenue (PKR M)', 600]], fn: (a, r) => days(a, r) },
    { id: 'dpo', name: 'Days payable outstanding', domain: 'Finance', unit: 'days', formula: 'Payables / COGS × 365', inputs: [['ap', 'Payables (PKR M)', 50], ['c', 'COGS (PKR M)', 600]], fn: (a, c) => days(a, c) },
    { id: 'discountLeakage', name: 'Discount leakage', domain: 'Finance', unit: '%', formula: 'Total discounts / Gross revenue × 100', inputs: [['d', 'Discounts (PKR M)', 10], ['r', 'Gross revenue (PKR M)', 200]], fn: (d, r) => pct(d, r) },
  ];

  const F = {};
  REG.forEach(def => {
    F[def.id] = (...args) => {
      const nums = args.map(toNum);
      if (nums.length < def.inputs.length || nums.some(n => n === null)) return null;
      const out = def.fn(...nums);
      return out === null || !Number.isFinite(out) ? null : out;
    };
  });

  // ---------- root-cause analytics ----------
  const STAGES = ['detected', 'diagnosed', 'approved', 'in_progress', 'verified'];
  const APPROVERS = ['ceo', 'plant', 'finance'];
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  const RCA = {
    /** good / warn / bad vs target; dir 'up' = higher is better. Warn band = within 5% of target. */
    status(value, target, dir = 'up', band = 0.05) {
      if (value === null || value === undefined || !Number.isFinite(+value) || !Number.isFinite(+target)) return 'unknown';
      const v = +value, t = +target;
      if (dir === 'up') return v >= t ? 'good' : v >= t * (1 - band) ? 'warn' : 'bad';
      return v <= t ? 'good' : v <= t * (1 + band) ? 'warn' : 'bad';
    },
    /** Follow the heaviest-weighted cause upstream until a root (no causes). */
    trace(graph, startId) {
      if (!graph || !graph[startId]) return [];
      const chain = [{ id: startId, share: 1, w: 1 }];
      const seen = new Set([startId]);
      let cur = startId, share = 1;
      for (;;) {
        const causes = ((graph[cur] && graph[cur].causes) || []).filter(c => graph[c.id] && !seen.has(c.id));
        if (!causes.length) break;
        const top = causes.reduce((a, b) => (b.w > a.w ? b : a));
        share *= top.w;
        chain.push({ id: top.id, share, w: top.w });
        seen.add(top.id);
        cur = top.id;
      }
      return chain;
    },
    /** Pareto: sorted desc, cumulative %, vital = items that make up the first 80%. */
    pareto(items) {
      const total = items.reduce((s, x) => s + x.v, 0);
      if (!total) return [];
      let run = 0;
      return [...items].sort((a, b) => b.v - a.v).map(x => {
        const vital = (run / total) * 100 < 80;
        run += x.v;
        return { ...x, pct: (x.v / total) * 100, cum: (run / total) * 100, vital };
      });
    },
    /** Priority score 0..100 from PKR impact, customer impact, effort, risk and confidence. */
    score(a) {
      const imp = clamp((Math.log10(Math.max(a.pkr || 1, 1)) - 4) / 4, 0, 1);
      const cust = clamp((a.customer || 1) / 5, 0, 1);
      const ease = clamp((6 - (a.effort || 3)) / 5, 0, 1);
      const safe = clamp((6 - (a.risk || 3)) / 5, 0, 1);
      const conf = clamp(a.confidence === undefined ? 0.5 : a.confidence, 0, 1);
      const raw = (0.45 * imp + 0.15 * cust + 0.15 * ease + 0.10 * safe) / 0.85;
      return Math.round(clamp(raw * (0.5 + 0.5 * conf), 0, 1) * 1000) / 10;
    },
    rank(actions) { return [...actions].sort((x, y) => RCA.score(y) - RCA.score(x)); },
    /** Share of KPIs on target (good = 1, warn = 0.5, bad = 0) as 0..100. */
    health(statuses) {
      const pts = { good: 1, warn: 0.5, bad: 0 };
      const known = statuses.filter(s => s in pts);
      if (!known.length) return null;
      return Math.round(known.reduce((s, x) => s + pts[x], 0) / known.length * 100);
    },
    STAGES,
    next(stage) { const i = STAGES.indexOf(stage); return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null; },
    /** Workflow guard: one stage at a time, approval by approver roles, verification needs evidence. */
    canMove(from, to, role, evidence) {
      if (RCA.next(from) !== to) return { ok: false, why: 'Actions move one stage at a time.' };
      if (to === 'approved' && !APPROVERS.includes(role)) return { ok: false, why: 'Only the CEO, Plant Head or Finance can approve.' };
      if (to === 'verified') {
        const after = evidence ? evidence.after : undefined;
        if (after === undefined || after === null || after === '' || !Number.isFinite(+after)) return { ok: false, why: 'Enter the measured after-value to verify the fix.' };
      }
      return { ok: true };
    },
    /** CAPA effectiveness: did the measured after-value reach the target? */
    effective(after, target, dir = 'up') { return RCA.status(after, target, dir, 0) === 'good'; },
    /** Only a verified action whose fix was not effective can be reopened (back to diagnosed). */
    canReopen(stage, wasEffective) {
      if (stage !== 'verified') return { ok: false, why: 'Only verified actions can be reopened.' };
      if (wasEffective) return { ok: false, why: 'The fix met its target; no reopen needed.' };
      return { ok: true, to: 'diagnosed' };
    },
  };

  // ---------- formatting ----------
  const fmt = {
    pkr(n) {
      if (n === null || n === undefined || !Number.isFinite(+n)) return '—';
      const v = +n, a = Math.abs(v), s = v < 0 ? '-' : '';
      if (a >= 1e9) return `${s}PKR ${(a / 1e9).toFixed(2)}B`;
      if (a >= 1e6) return `${s}PKR ${a / 1e6 >= 100 ? (a / 1e6).toFixed(0) : (a / 1e6).toFixed(1)}M`;
      if (a >= 1e3) return `${s}PKR ${(a / 1e3).toFixed(1)}K`;
      return `${s}PKR ${Math.round(a)}`;
    },
    num(n, d = 0) {
      if (n === null || n === undefined || !Number.isFinite(+n)) return '—';
      return (+n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    },
  };

  // ---------- safe helpers ----------
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const util = {
    esc: s => (s === null || s === undefined ? '' : String(s).replace(/[&<>"']/g, c => ESC[c])),
    /** All tokens must match name or body; name hits weigh double. */
    search(q, items, nameOf, bodyOf) {
      const toks = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (!toks.length) return [];
      const out = [];
      items.forEach((it, idx) => {
        const n = String(nameOf(it) || '').toLowerCase(), b = String(bodyOf(it) || '').toLowerCase();
        let sc = 0;
        for (const t of toks) {
          const inN = n.includes(t), inB = b.includes(t);
          if (!inN && !inB) return;
          sc += (inN ? 2 : 0) + (inB ? 1 : 0) + (n.startsWith(t) ? 1 : 0);
        }
        out.push({ it, sc, idx });
      });
      return out.sort((a, b) => b.sc - a.sc || a.idx - b.idx).map(x => x.it);
    },
    toNum,
  };

  const api = { F, REG, RCA, fmt, util };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TA = api;
})(typeof window !== 'undefined' ? window : globalThis);
