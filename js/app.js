/* Textile AI Audit — UI layer (router, pages, drawer, palette, workflow). */
(function () {
  'use strict';
  const { F, REG, RCA, fmt, util } = window.TA;
  const D = window.TD;
  const M = window.TM; // measurement catalogue shared with the server (js/measure.js)
  const esc = util.esc;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- icons
  const I = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    tree: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v10M12 12H5v5M12 12h7v5"/>',
    clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    factory: '<path d="M3 21V10l6 4V10l6 4V6l6 3v12z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>',
    check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h8"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>',
    spin: '<circle cx="12" cy="12" r="8"/><path d="M5.5 8.5c4 1.5 9 1.5 13 0M5.5 15.5c4-1.5 9-1.5 13 0M9 4.6c2 4.5 2 10.3 0 14.8"/>',
    loom: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 14h16M10 4v16M14 4v16"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    roll: '<circle cx="7" cy="12" r="4"/><circle cx="7" cy="12" r="1"/><path d="M7 8h13v8H7"/>',
    cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>',
    needle: '<path d="M20 4L8 16"/><path d="M18 3l3 3"/><path d="M8 16l-3 5 5-3"/><path d="M4 12c2-3 5-2 6 0"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.01"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    fiber: '<path d="M4 20c4-8 8-12 16-16M4 14c3-4 6-6 10-7M10 20c3-4 6-6 10-7"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    flow: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    logo: '<path d="M4 17c4-9 11-9 16-10M4 11c4-4 9-5 16-4M4 20h16"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  };
  const ic = (n, cls) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${I[n] || ''}</svg>`;
  const STAGE_IC = { fiber: 'fiber', spinning: 'spin', weaving: 'loom', knitting: 'loom', dyeing: 'drop', finishing: 'roll', cutting: 'cut', sewing: 'needle', packing: 'box', cash: 'cash' };
  const SEC_IC = { spin: 'spin', loom: 'loom', drop: 'drop', cut: 'cut', needle: 'needle', shield: 'shield', wrench: 'wrench', calendar: 'calendar', box: 'box', truck: 'truck', cash: 'cash', clock: 'clock' };

  // ---------------------------------------------------------------- navigation model
  const NAV = [
    { g: 'Start', items: [['command', 'Command Center', 'home'], ['entry', 'Data Entry', 'pen']] },
    { g: 'Diagnose', items: [['rca', 'Root-Cause Explorer', 'tree'], ['audits', 'Audit Programs', 'clip']] },
    { g: 'Operations', items: [['ops', 'Production Floor', 'factory'], ['planning', 'Planning & Capacity', 'calendar']] },
    { g: 'Supply & Cash', items: [['supply', 'Inventory & Procurement', 'box'], ['finance', 'Finance & Cash', 'cash']] },
    { g: 'Act', items: [['actions', 'Action Center', 'check'], ['alerts', 'Alerts', 'bell']] },
    { g: 'Admin', items: [['reports', 'CEO Reports', 'clip'], ['usage', 'Usage & Costs', 'chart']] },
    { g: 'Learn & Setup', items: [['lab', 'Formula Lab', 'calc'], ['glossary', 'Glossary', 'book'], ['bench', 'Benchmarks', 'target'], ['data', 'Data & Governance', 'db']] },
  ];
  const PAGE_META = {};
  NAV.forEach(g => g.items.forEach(([id, name, icon]) => { PAGE_META[id] = { name, icon, group: g.g }; }));

  const PERIODS = [
    { id: 'm', name: 'Last 30 days', k: 1, per: 'per month' },
    { id: 'q', name: 'Last 3 months', k: 3, per: 'over 3 months' },
    { id: 'y', name: 'Last 12 months', k: 12, per: 'over 12 months' },
  ];
  // Pages for accounts that enter records but do not read dashboards (department staff, data feeds).
  const NAV_ENTRY_ONLY = [
    { g: 'Start', items: [['entry', 'Data Entry', 'pen']] },
    { g: 'Learn', items: [['lab', 'Formula Lab', 'calc'], ['glossary', 'Glossary', 'book']] },
  ];
  const PERIOD_WORD = { shift: 'Each shift', day: 'Daily', event: 'Each event', week: 'Weekly', month: 'Monthly' };
  const REC_ST = { submitted: ['Waiting approval', 'warn'], approved: ['Approved', 'good'], rejected: ['Rejected', 'bad'], voided: ['Voided', ''] };
  const EV_NAME = { measure: 'Measured', control: 'Control chart', trend: 'Trend', stratify: 'Stratified', pareto: 'Pareto', impact: 'Cost', formula: 'Formula' };
  const ROLE_EXTRA = { operator: 'Department staff', admin: 'Administrator', integration: 'Data feed' };
  const STREAM_KPI = { fiber: 'spinning|Contamination', spinning: 'spinning|Spinning waste', weaving: 'weaving|Loom efficiency', knitting: 'weaving|Knitting machine efficiency', dyeing: 'dyeing|Right-first-time dyeing', finishing: 'dyeing|Shrinkage after compacting', cutting: 'cutting|Marker efficiency', sewing: 'sewing|Line efficiency', packing: 'quality|Final AQL failure', cash: 'finance|Cash conversion cycle' };
  const BENCH_KPI = { 'OEE': 'planning|OEE (plant)', 'Air-jet loom efficiency': 'weaving|Loom efficiency', 'Spinning waste (cotton)': 'spinning|Spinning waste', 'Right-first-time dyeing': 'dyeing|Right-first-time dyeing', 'Sewing line efficiency': 'sewing|Line efficiency', 'DHU (sewing)': 'sewing|Inline DHU', 'Marker efficiency': 'cutting|Marker efficiency', 'OTIF': 'planning|OTIF delivery', 'Cost of poor quality': 'quality|Cost of poor quality', 'Lab-dip approval cycle': 'dyeing|Lab-dip approval cycle', 'Water use (dyed fabric)': 'dyeing|Water use', 'Absenteeism': 'sewing|Absenteeism', 'LC discrepancies (1st presentation)': 'finance|LC discrepancy rate' };
  const STAGE_NAME = { detected: 'Detected', diagnosed: 'Diagnosed', approved: 'Approved', in_progress: 'In progress', verified: 'Verified' };
  const STAGE_DESC = { detected: 'AI flagged, needs a cause', diagnosed: 'Root cause found, awaiting approval', approved: 'Approved, ready to start', in_progress: 'Fix being implemented', verified: 'Result measured' };
  const ADV_LABEL = { detected: 'Mark diagnosed', diagnosed: 'Approve', approved: 'Start work', in_progress: 'Verify result' };
  const D8 = ['D1 Team formed', 'D2 Problem defined', 'D3 Containment in place', 'D4 Root cause verified', 'D5 Corrective action chosen', 'D6 Action implemented', 'D7 Recurrence prevented', 'D8 Closed & recognised'];
  const D8_BY_STAGE = { detected: 1, diagnosed: 4, approved: 5, in_progress: 6, verified: 8 };
  const ST_WORD = { good: 'On target', warn: 'Near target', bad: 'Off target', unknown: 'Not measured' };

  // ---------------------------------------------------------------- state: view prefs local, business data from the server
  const PREF_KEY = 'ta.prefs.v1';
  const VIEW_ROLES = ['ceo', 'plant', 'dept', 'finance'];
  const APPROVER_ROLES = ['ceo', 'plant', 'finance'];
  function loadPrefs() {
    const p = { plant: 'all', period: 'm' };
    try {
      const raw = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
      if (raw && D.PLANTS.some(x => x.id === raw.plant)) p.plant = raw.plant;
      if (raw && PERIODS.some(x => x.id === raw.period)) p.period = raw.period;
    } catch (e) { /* ignore bad prefs */ }
    return p;
  }
  const S = { ...loadPrefs(), role: 'ceo', user: null, actions: {}, log: [], m: null, alertCounts: { high: 0, medium: 0 } };
  const LIVE = {}; // 'section|kpi' -> { value, asOf, source } from the KPI feed
  const ui = { gQ: '', gDom: 'All', gLetter: '', lQ: '', lDom: 'All', aFilter: 'all', lastPage: null, pIdx: 0, pItems: [], drawerFor: null, lastFocus: null, busy: false, recTab: 'mine', recs: {}, recOpen: null, lastForm: null, alertTab: 'open', report: null, usageDays: 30 };
  function save() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ plant: S.plant, period: S.period })); } catch (e) { /* storage blocked: keep prefs in memory */ } }
  try { localStorage.removeItem('ta.state.v1'); } catch (e) { /* old client-side store is no longer trusted */ }
  const userCanApprove = () => !!S.user && APPROVER_ROLES.includes(S.user.role);
  const canAct = f => !!S.user && VIEW_ROLES.includes(S.user.role) && (S.user.plant === 'all' || S.user.plant === f.plant);
  const canAudit = () => !!S.user && ['ceo', 'finance', 'admin'].includes(S.user.role); // mirrors server AUDIT_VIEWERS
  const whyCannot = f => (!S.user || !VIEW_ROLES.includes(S.user.role) ? 'Your account type cannot change actions' : 'This action belongs to another plant');

  // ---------------------------------------------------------------- API client
  async function api(path, opts = {}) {
    const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    let res;
    try { res = await fetch(path, init); } catch (e) { const err = new Error('Cannot reach the server. Check your connection and try again.'); err.status = 0; throw err; }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status; err.data = data;
      if (res.status === 401 && !opts.quiet401) showLogin('Your session has ended. Please sign in again.');
      throw err;
    }
    return data;
  }
  function applyKpis(list) {
    (Array.isArray(list) ? list : []).forEach(k => {
      const s = D.SECTIONS[k.section];
      const row = s && s.kpis.find(x => x[0] === k.kpi);
      if (row && Number.isFinite(k.value)) LIVE[`${k.section}|${k.kpi}`] = k;
    });
  }
  function applyState(st) {
    S.user = st.user;
    S.role = VIEW_ROLES.includes(st.user.role) ? st.user.role : 'ceo';
    S.actions = st.actions || {};
    S.log = Array.isArray(st.log) ? st.log : [];
    S.alertCounts = st.alerts || { high: 0, medium: 0 };
    applyKpis(st.kpis);
  }
  function applyAction(res) {
    if (res && res.action) S.actions[res.action.id] = res.action;
    if (res && Array.isArray(res.log)) S.log = res.log;
  }

  // ---------------------------------------------------------------- derived data
  const per = () => PERIODS.find(p => p.id === S.period);
  const money = n => fmt.pkr(n * per().k);
  const roleName = id => (D.ROLES.find(r => r.id === id) || {}).name || ROLE_EXTRA[id] || id;
  const plantShort = id => (D.PLANTS.find(p => p.id === id) || {}).short || id;
  const findingsFor = () => (S.plant === 'all' ? D.FINDINGS : D.FINDINGS.filter(f => f.plant === S.plant));
  const effPkr = f => f.pkr + (f.cash || 0) * D.FINANCING_RATE / 12;
  const scoreOf = f => RCA.score({ pkr: effPkr(f), customer: f.customer, effort: f.effort, risk: f.risk, confidence: f.conf });
  const ranked = list => list.map(f => ({ f, s: scoreOf(f) })).sort((a, b) => b.s - a.s).map(x => x.f);
  const findingById = id => D.FINDINGS.find(f => f.id === id);

  // ---------------------------------------------------------------- measured values: approved department records only, never demo numbers
  const canRead = () => !!S.user && !!S.user.canReadDashboards;
  const myForms = () => (S.user && Array.isArray(S.user.forms) ? S.user.forms : []);
  const navFor = () => (canRead() ? NAV : NAV_ENTRY_ONLY).map(g => ({ ...g, items: g.items.filter(([id]) => (id !== 'entry' || myForms().length) && (!ADMIN_PAGES.includes(id) || canAudit())) })).filter(g => g.items.length);
  const ADMIN_PAGES = ['reports', 'usage']; // mirrors the server's REPORT_READERS (CEO, finance, admin)
  const todayUtc = () => new Date().toISOString().slice(0, 10);
  const todayLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const uOf = u => (u === '%' ? '%' : u ? ` ${u}` : '');
  /** Coverage as shown: KPIs measured from approved records, plus any filled only by the live KPI feed (counted separately as `feed`). */
  function cov() {
    if (!S.m) return { measured: 0, applicable: 0, pct: 0, bySection: {}, records: 0, feed: 0 };
    const c = S.m.coverage;
    const bySection = {};
    Object.entries(c.bySection).forEach(([k, v]) => { bySection[k] = { ...v }; });
    let feed = 0;
    Object.values(S.m.kpis).forEach(x => { if (x.applicable && x.value === null && LIVE[x.key] && bySection[x.sec]) { feed++; bySection[x.sec].measured++; } });
    const measured = c.measured + feed;
    return { ...c, bySection, measured, feed, pct: c.applicable ? Math.round(measured / c.applicable * 1000) / 10 : 0 };
  }
  const measuredFindings = () => (S.m ? S.m.findings : []);
  /** One KPI as shown: measured from approved records, else the live KPI feed, else not measured (value null). */
  function kv(sid, name) {
    const key = `${sid}|${name}`;
    const m = S.m && S.m.kpis[key];
    const meta = M.META[key] || {};
    const form = M.formForKpi(key);
    const base = { key, sec: sid, name, unit: meta.unit, target: meta.target, dir: meta.dir, form: form ? form.id : null,
      formLabel: m ? m.formLabel : form ? form.label : '', formula: m ? m.formula : M.KPIS[key] ? M.describe(M.KPIS[key]) : '' };
    if (m && m.value !== null) return { ...base, ...m, source: 'measured' };
    const live = LIVE[key];
    if (live) return { ...base, value: live.value, status: RCA.status(live.value, meta.target, meta.dir), n: 0, first: null, last: String(live.asOf).slice(0, 10), stale: false, series: [], source: 'feed', feed: live };
    return { ...base, value: null, status: 'unknown', n: 0, first: null, last: null, stale: false, series: [], source: null };
  }
  const kvKey = key => { const i = key.indexOf('|'); return kv(key.slice(0, i), key.slice(i + 1)); };
  const kStatus = (sid, k) => kv(sid, k[0]).status;
  const kpiRef = key => { const r = kvKey(key); const s = D.SECTIONS[r.sec]; const i = s ? s.kpis.findIndex(k => k[0] === r.name) : -1; return i < 0 ? '' : `${r.sec}:${i}`; };
  const valTxt = r => (r.value === null ? 'Not measured' : `${fmtVal(r.value)}${uOf(r.unit)}`);
  const isEffective = (f, a) => a.after !== null && RCA.effective(a.after, f.kpi.target, f.kpi.dir);
  const sectionsForPlant = group => Object.entries(D.SECTIONS).filter(([, s]) => (!group || s.group === group) && (S.plant === 'all' || s.plants.includes(S.plant)));
  function secRoute(id) {
    const s = D.SECTIONS[id];
    if (!s) return '#/command';
    if (s.group === 'production') return `#/ops/${id}`;
    if (id === 'planning') return '#/planning';
    if (s.group === 'supply') return `#/supply/${id}`;
    return '#/finance';
  }
  function healthScore() {
    const st = [];
    sectionsForPlant().forEach(([sid, s]) => s.kpis.forEach(k => { const x = kStatus(sid, k); if (x !== 'unknown') st.push(x); }));
    return st.length ? RCA.health(st) : null; // null: nothing measured, so no health score
  }
  const fmtVal = v => {
    if (!Number.isFinite(v)) return '—';
    const dec = Number.isInteger(v) ? 0 : (String(v).split('.')[1] || '').length >= 2 && Math.abs(v) < 10 ? 2 : 1;
    return fmt.num(v, dec);
  };
  const withUnit = (v, u) => `${fmtVal(v)}${u ? (u === '%' ? '<small>%</small>' : `<small>${esc(u)}</small>`) : ''}`;

  // ---------------------------------------------------------------- graph helpers
  const G = D.GRAPH;
  function pathFrom(start, target) {
    if (!G[start]) return null;
    const q = [[start]]; const seen = new Set([start]);
    while (q.length) {
      const p = q.shift(); const last = p[p.length - 1];
      if (last === target) return p;
      for (const c of G[last].causes) if (!seen.has(c.id) && G[c.id]) { seen.add(c.id); q.push([...p, c.id]); }
    }
    return null;
  }
  const pathShare = p => p.slice(1).reduce((s, id, i) => s * (G[p[i]].causes.find(c => c.id === id) || { w: 0 }).w, 1);
  function bestPathTo(node) {
    let best = null;
    D.SYMPTOMS.forEach(s => { const p = pathFrom(s, node); if (p && (!best || pathShare(p) > pathShare(best))) best = p; });
    return best;
  }
  function rootsUnder(start) {
    const out = new Set(); const seen = new Set();
    (function walk(id) { if (seen.has(id) || !G[id]) return; seen.add(id); if (!G[id].causes.length) out.add(id); G[id].causes.forEach(c => walk(c.id)); })(start);
    return [...out];
  }

  // ---------------------------------------------------------------- small components
  const tag = (t, cls) => `<span class="tag ${cls || ''}">${t}</span>`;
  const stTag = st => tag(ST_WORD[st] || st, st);
  const stageTag = st => tag(STAGE_NAME[st], st === 'verified' ? 'good' : st === 'detected' ? 'bad' : st === 'diagnosed' ? 'warn' : 'acc');
  const pageHead = (title, sub, acts) => `<div class="phead"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${acts ? `<div class="acts">${acts}</div>` : ''}</div>`;
  const hint = html => `<div class="hint">${ic('spark')}<div>${html}</div></div>`;
  const secT = t => `<div class="sec-t">${t}</div>`;
  const countPkr = n => `<span class="num" data-count="${n}" data-f="pkr">${fmt.pkr(0)}</span>`;
  const countNum = (n, d = 0, suf = '') => `<span class="num" data-count="${n}" data-f="num" data-d="${d}" data-s="${esc(suf)}">0${esc(suf)}</span>`;

  function kpiTile(k, i, secId, idx) {
    const [name, , u, t, dir, bm] = k;
    const r = kv(secId, name);
    const tu = u === '%' ? '%' : '';
    if (r.value === null) {
      return `<button class="card kpi lift rise nm" style="--i:${i}" data-kpi="${secId}:${idx}" aria-label="${esc(name)}: not measured, target ${esc(fmtVal(t))} ${esc(u)}. Needs ${esc(r.formLabel)}. Open details">
      <span class="k-name">${esc(name)}${tag('Not measured')}</span>
      <span class="k-val">—</span>
      <span class="k-sub"><span>Target ${esc(fmtVal(t))}${tu}</span><span>No approved records</span></span>
      <span class="meter"><i style="--w:0%"></i></span>
      <span class="k-bm"><span class="need">Needs: ${esc(r.formLabel || 'a data source')}</span> · ${esc(bm)}</span></button>`;
    }
    const v = r.value, st = r.status;
    const prog = dir === 'up' ? Math.min(100, t ? v / t * 100 : 100) : Math.min(100, v > 0 ? t / v * 100 : 100);
    const gap = dir === 'up' ? t - v : v - t;
    return `<button class="card kpi lift rise ${st}" style="--i:${i}" data-kpi="${secId}:${idx}" aria-label="${esc(name)}: ${esc(fmtVal(v))} ${esc(u)}, target ${esc(fmtVal(t))}. Open details">
      <span class="k-name">${esc(name)}${stTag(st)}</span>
      <span class="k-val">${withUnit(v, u)}</span>
      <span class="k-sub"><span>Target ${esc(fmtVal(t))}${tu}</span><span>${st === 'good' ? 'On target' : `Gap ${esc(fmtVal(Math.abs(gap)))}`}</span></span>
      <span class="meter ${st}"><i style="--w:${Math.max(0, prog).toFixed(1)}%"></i></span>
      <span class="k-bm">${srcNote(r)}${esc(bm)}</span></button>`;
  }
  function srcNote(r) {
    if (r.source === 'feed') return `<span class="live">● Live feed from ${esc(r.feed.source)} · ${esc(r.last)}</span> · `;
    return `<span class="live">● Measured from ${r.n} approved record${r.n === 1 ? '' : 's'}${r.last ? ` · last ${esc(r.last)}` : ''}</span>${r.stale ? ' <span class="stale">· no new records lately</span>' : ''} · `;
  }
  const evList = list => `<ul class="evid">${list.map(e => `<li class="${e.signal || e.worsening ? 'sig' : ''}"><b>${esc(EV_NAME[e.kind] || e.kind)}:</b> ${esc(e.text)}</li>`).join('')}</ul>`;
  /** Every number on a finding card comes with the calculation behind it. */
  const howCalc = steps => (steps && steps.length ? `<details class="how"><summary>How this was calculated</summary><ol>${steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol></details>` : '');
  const qChip = (k, v) => `<span class="qc"><span>${esc(k)}</span><b>${esc(v)}</b></span>`;
  const numTxt = v => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : String(+v.toFixed(1)));
  /** PKR at risk, cash tied up, hours, kg / lb and the quantity lost, per 30 days, from a measured finding's quant. */
  function quantChips(f) {
    const q = f.quant || {};
    const c = [];
    if (q.pkr) c.push(qChip(q.cash ? 'Financing cost' : 'PKR at risk', `${fmt.pkr(q.pkr)} / 30 days`));
    if (q.cash) c.push(qChip('Cash tied up', fmt.pkr(q.cash)));
    if (q.hours) c.push(qChip('Hours lost', `${numTxt(q.hours)} h`));
    if (q.kg) c.push(qChip(q.qty && q.qty.unit === 'kg' ? 'Material lost' : 'Production lost', `${numTxt(q.kg)} kg · ${numTxt(q.lb)} lb`));
    if (q.qty && !['kg', 'h', 'min'].includes(q.qty.unit)) c.push(qChip('Lost', `${numTxt(q.qty.value)} ${q.qty.unit}`));
    const gu = q.gapUnit === 'points' ? ' pts' : q.gapUnit ? ` ${q.gapUnit}` : '';
    c.push(qChip('Gap to target', q.gap !== undefined ? `${numTxt(q.gap)}${gu} (${fmtVal(f.gapPct)}%)` : `${fmtVal(f.gapPct)}%`));
    return `<div class="qchips">${c.join('')}</div>`;
  }
  /** Baseline (audit playbook) estimate, written out: monthly estimate, period, recoverable share, confidence, and savings once verified. */
  function baselineSteps(f, a) {
    const k = f.kpi, u = uOf(k.unit), p = per();
    const steps = [`Audit estimate from the diagnostic: ${fmt.pkr(f.pkr)} a month of P&L leakage. It is an estimate from the audit playbook, not a measurement from your records.`];
    if (p.k !== 1) steps.push(`${fmt.pkr(f.pkr)} × ${p.k} months = ${money(f.pkr)} ${p.per}.`);
    if (f.cash) steps.push(`Cash that can be released once: ${fmt.pkr(f.cash)}. Financing it at ${Math.round(D.FINANCING_RATE * 100)}% a year is worth ${fmt.pkr(f.cash * D.FINANCING_RATE / 12)} a month, which counts toward its priority.`);
    steps.push(`About ${Math.round(f.rec * 100)}% is recoverable with the proposed fix: ${money(f.pkr * f.rec)} ${p.per}.`);
    steps.push(`${k.name} is ${fmtVal(k.base)}${u} at the start against a target of ${fmtVal(k.target)}${u}. Confidence in the estimate: ${Math.round(f.conf * 100)}%.`);
    const sv = savedOf(f, a);
    if (sv) steps.push(`After the fix ${k.name} is ${fmtVal(a.after)}${u}: ${Math.round(sv.progress * 100)}% of the way to target, so about ${fmt.pkr(sv.pkr)} a month is saved (${fmt.pkr(f.pkr)} × ${Math.round(f.rec * 100)}% recoverable × ${Math.round(sv.progress * 100)}%). Estimate.`);
    return steps;
  }
  /** Estimated PKR a month saved by a verified fix: the share of the gap it closed × recoverable leakage. */
  function savedOf(f, a) {
    if (!a || a.stage !== 'verified' || a.after === null || a.after === undefined) return null;
    const k = f.kpi, span = k.base - k.target;
    if (!span) return null;
    const progress = Math.max(0, Math.min(1, (k.base - a.after) / span));
    return { progress, pkr: Math.round(f.pkr * f.rec * progress) };
  }
  /** A KPI that misses its target according to approved records, with its statistical evidence. */
  function mFindingCard(f, i) {
    const u = uOf(f.unit);
    const ev = f.evidence.filter(e => e.kind !== 'measure' && e.kind !== 'impact').slice(0, 3);
    return `<article class="card fd rise" style="--i:${i}">
      <div class="fd-top"><div>
        <div class="chips" style="margin-bottom:6px">${tag(esc(D.SECTIONS[f.sec].name))}${stTag(f.status)}${tag('Measured', 'good')}</div>
        <h4>${esc(f.name)} is ${esc(fmtVal(f.value))}${esc(u)} against a target of ${esc(fmtVal(f.target))}${esc(u)}</h4>
        <div class="where">${esc(f.evidence[0].text)}</div></div>
        <div class="money">${f.impactPkr ? `<b>${fmt.pkr(f.impactPkr)}</b><span>${esc(f.quant.cash ? 'financing / 30 days' : 'at risk / 30 days')}</span>` : f.quant && f.quant.kg ? `<b>${esc(numTxt(f.quant.kg))} kg</b><span>lost / 30 days</span>` : `<b>${esc(fmtVal(f.gapPct))}%</b><span>off target</span>`}</div></div>
      ${quantChips(f)}
      ${ev.length ? evList(ev) : ''}
      ${howCalc(f.quant && f.quant.steps)}
      <div class="fd-foot"><span class="score">From <b>${f.n}</b> approved record${f.n === 1 ? '' : 's'}</span><span class="sp"></span>
        ${f.hypotheses.length && S.actions[f.hypotheses[0].id] ? `<button class="btn sm" data-open="${esc(f.hypotheses[0].id)}">${ic('tree')} Likely cause</button>` : ''}
        <button class="btn sm primary" data-kpi="${kpiRef(f.key)}">Evidence ${ic('arrow')}</button></div>
    </article>`;
  }
  const seriesChart = (r, title) => chart({ type: 'trend', title: title || `${r.name} · measured`, values: r.series.map(p => p[1]), labels: r.series.map(p => p[0].slice(5)), target: r.target, dir: r.dir, unit: r.unit === '%' ? '%' : '' });

  function findingCard(f, i) {
    const a = S.actions[f.id];
    const amt = f.cash ? `<b>${fmt.pkr(f.cash)}</b><span>cash to release</span>` : `<b>${money(f.pkr)}</b><span>${per().per}</span>`;
    return `<article class="card fd rise" style="--i:${i}">
      <div class="fd-top"><div>
        <div class="chips" style="margin-bottom:6px">${tag(esc(plantShort(f.plant)))}${tag(esc(D.SECTIONS[f.sec].name))}${tag(esc(f.m6), 'acc')}${stageTag(a.stage)}</div>
        <h4>${esc(f.title)}</h4><div class="where">${esc(f.where)}</div></div>
        <div class="money">${amt}</div></div>
      <div class="wsd"><div><b>Why</b>${esc(f.why)}</div><div><b>So what</b>${esc(f.sowhat)}</div><div class="do"><b>Do what</b>${esc(f.dowhat)}</div></div>
      <div class="qchips">${qChip('Leakage', `${money(f.pkr)} ${per().per}`)}${qChip('Recoverable', `${money(f.pkr * f.rec)}`)}${f.cash ? qChip('Cash to release', fmt.pkr(f.cash)) : ''}${savedOf(f, a) ? qChip('Saved (est.)', `${fmt.pkr(savedOf(f, a).pkr)} / month`) : ''}${qChip('Estimate', 'audit playbook')}</div>
      ${howCalc(baselineSteps(f, a))}
      <div class="fd-foot"><span class="score">${ic('user')} <b>${esc(f.who)}</b></span><span class="sp"></span>
        <span class="score">Priority <b>${scoreOf(f)}</b></span><span class="score">Confidence <b>${Math.round(f.conf * 100)}%</b></span>
        <button class="btn sm" data-go="#/rca/node/${f.node}">${ic('tree')} Root cause</button>
        <button class="btn sm primary" data-open="${f.id}">Act ${ic('arrow')}</button></div>
    </article>`;
  }

  // ---------------------------------------------------------------- charts
  let gid = 0;
  function chartBars(c) {
    const vals = c.items.map(x => x[1]);
    const max = Math.max(...vals, c.over || 0) * 1.08 || 1;
    const rows = c.items.map(([l, v], i) => {
      const red = c.over !== undefined && (c.under ? v < c.over : v > c.over);
      return `<div class="row"><span title="${esc(l)}">${esc(l)}</span><div class="bar"><i class="${red ? 'r' : ''}" style="--w:${(v / max * 100).toFixed(1)}%;--i:${i}"></i>${c.over !== undefined ? `<span class="mark" style="left:${(c.over / max * 100).toFixed(1)}%"></span>` : ''}</div><em>${esc(fmtVal(v))}</em></div>`;
    }).join('');
    return `<div class="rows">${rows}</div><div class="legend"><span><i></i>Within limit</span><span><i class="r"></i>${c.under ? 'Below' : 'Above'} limit</span>${c.over !== undefined ? `<span><i class="t"></i>Limit ${esc(fmtVal(c.over))}</span>` : ''}</div>`;
  }
  function chartPareto(c) {
    const p = RCA.pareto(c.items.map(([k, v]) => ({ k, v })));
    if (!p.length) return '<div class="empty">No data</div>';
    const max = p[0].v;
    const rows = p.map((x, i) => `<div class="row"><span title="${esc(x.k)}">${esc(x.k)}</span><div class="bar"><i class="${x.vital ? (i === 0 ? 'r' : '') : 'm'}" style="--w:${(x.v / max * 100).toFixed(1)}%;--i:${i}"></i></div><em>${esc(fmtVal(x.v))} <small>${Math.round(x.pct)}%</small></em></div>`).join('');
    const vital = p.filter(x => x.vital);
    return `<div class="rows">${rows}</div><div class="vital">${ic('target', '')} <b>Vital few:</b> ${vital.map(x => esc(x.k)).join(', ')} explain <b>${Math.round(vital[vital.length - 1].cum)}%</b> of the total. Fix these first.</div>`;
  }
  function chartTrend(c) {
    const W = 320, H = 140, L = 30, R = 34, T = 12, B = 22;
    const all = [...c.values, c.target];
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.18 || 1; lo -= pad; hi += pad;
    const x = i => L + i * (W - L - R) / (c.values.length - 1);
    const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const pts = c.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const id = `lg${++gid}`;
    const last = c.values[c.values.length - 1];
    const st = RCA.status(last, c.target, c.dir);
    const every = Math.max(1, Math.ceil(c.values.length / 5));
    const months = c.labels
      ? c.labels.map((m, i) => (i % every === 0 || i === c.values.length - 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle">${esc(m)}</text>` : '')).join('')
      : D.MONTHS.map((m, i) => (i % 2 === 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle">${m}</text>` : '')).join('');
    const ticks = [hi - pad, (hi + lo) / 2, lo + pad].map(v => `<text x="${L - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end">${esc(fmtVal(Math.round(v * 10) / 10))}</text>`).join('');
    return `<div class="trend"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title)}. Latest ${esc(fmtVal(last))}${esc(c.unit || '')}, target ${esc(fmtVal(c.target))}${esc(c.unit || '')}.">
      <defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#8b9bff"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient>
      <linearGradient id="${id}a" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8b9bff" stop-opacity=".35"/><stop offset="1" stop-color="#8b9bff" stop-opacity="0"/></linearGradient></defs>
      ${ticks}
      <line class="tgt" x1="${L}" x2="${W - R}" y1="${y(c.target).toFixed(1)}" y2="${y(c.target).toFixed(1)}"/>
      <text x="${W - R + 4}" y="${(y(c.target) + 3).toFixed(1)}" style="fill:var(--good)">Target</text>
      <path class="area" fill="url(#${id}a)" d="M${pts[0]} L${pts.join(' L')} L${x(c.values.length - 1).toFixed(1)},${H - B} L${L},${H - B} Z"/>
      <path class="line" pathLength="1" stroke="url(#${id})" d="M${pts.join(' L')}"/>
      <circle class="pt" r="4" cx="${x(c.values.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}"/>
      <text x="${(x(c.values.length - 1) + 6).toFixed(1)}" y="${(y(last) - 8).toFixed(1)}" style="fill:var(--text);font-weight:700;font-size:11px">${esc(fmtVal(last))}${esc(c.unit || '')}</text>
      ${months}</svg>
      <div class="legend"><span><i></i>Actual</span><span><i class="g"></i>Target ${esc(fmtVal(c.target))}${esc(c.unit || '')}</span><span>${stTag(st)}</span></div></div>`;
  }
  function chartBridge(c) {
    const max = c.start[1];
    let run = c.start[1];
    const rows = [`<div class="row"><span>${esc(c.start[0])}</span><div class="bar"><i style="--l:0%;--w:100%"></i></div><em>${fmtVal(c.start[1])}</em></div>`];
    c.steps.forEach(([l, d], i) => {
      const after = run + d;
      rows.push(`<div class="row"><span title="${esc(l)}">${esc(l)}</span><div class="bar"><i class="r" style="--l:${(Math.min(run, after) / max * 100).toFixed(2)}%;--w:${(Math.abs(d) / max * 100).toFixed(2)}%;--i:${i + 1}"></i></div><em style="color:var(--bad)">${d > 0 ? '+' : ''}${fmtVal(d)}</em></div>`);
      run = after;
    });
    rows.push(`<div class="row"><span><b style="color:var(--text)">${esc(c.end)}</b></span><div class="bar"><i style="--l:0%;--w:${(run / max * 100).toFixed(2)}%;--i:${c.steps.length + 1}"></i></div><em>${fmtVal(Math.round(run * 10) / 10)}</em></div>`);
    return `<div class="rows wf">${rows.join('')}</div><div class="vital"><b>Biggest gap:</b> ${esc(c.steps.slice().sort((a, b) => a[1] - b[1])[0][0])}. Every bar traces back to a finding on the shop floor.</div>`;
  }
  function chart(c) {
    const body = c.type === 'pareto' ? chartPareto(c) : c.type === 'trend' ? chartTrend(c) : c.type === 'bridge' ? chartBridge(c) : chartBars(c);
    return `<div class="card rise"><h3>${ic(c.type === 'trend' ? 'flow' : 'target')}${esc(c.title)}</h3>${body}</div>`;
  }
  function ring(v, label) {
    const r = 54, C = 2 * Math.PI * r;
    if (v === null || !Number.isFinite(v)) {
      return `<div class="ring" role="img" aria-label="${esc(label)}: not measured"><svg viewBox="0 0 132 132"><circle class="trk" cx="66" cy="66" r="${r}" fill="none" stroke-width="11"/></svg>
      <div class="lbl"><div><b>—</b><span>${esc(label)}</span></div></div></div>`;
    }
    const col = v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--warn)' : 'var(--bad)';
    return `<div class="ring" role="img" aria-label="${esc(label)} ${v} out of 100"><svg viewBox="0 0 132 132"><circle class="trk" cx="66" cy="66" r="${r}" fill="none" stroke-width="11"/>
      <circle class="val" cx="66" cy="66" r="${r}" fill="none" stroke="${col}" stroke-width="11" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C * (1 - v / 100)).toFixed(1)}"/></svg>
      <div class="lbl"><div><b>${countNum(v)}</b><span>${esc(label)}</span></div></div></div>`;
  }

  // ---------------------------------------------------------------- page: Command Center
  function statVal(r) {
    return r.value === null ? '<span class="k-val nm">Not measured</span>' : `<span class="k-val">${withUnit(r.value, r.unit)}</span>`;
  }
  function pageCommand() {
    const list = findingsFor();
    const c = cov();
    const mf = measuredFindings();
    const health = healthScore();
    const acts = list.map(f => S.actions[f.id]).filter(Boolean);
    const waitingApproval = list.filter(f => (S.actions[f.id] || {}).stage === 'diagnosed');
    const canApprove = userCanApprove();
    const role = D.ROLES.find(r => r.id === S.role) || D.ROLES[0];
    const where = S.plant === 'all' ? 'the group' : plantShort(S.plant);
    const tot = S.m && S.m.totals ? S.m.totals : { pkr: 0, hours: 0, kg: 0, cash: 0 };
    const gapCost = tot.pkr; // each loss counted once, even when several KPIs measure it
    const load = kvKey('dyeing|Dye-house load');
    const constraint = load.value !== null && load.value > 90;
    const oee = kvKey('planning|OEE (plant)'), otif = kvKey('planning|OTIF delivery');
    const byStage = RCA.STAGES.map(st => acts.filter(a => a.stage === st).length);
    const pending = S.user.pendingReviews || 0;
    const heroLine = !c.measured
      ? `Nothing in ${esc(where)} is measured yet. <em>Every number here will come from your departments' approved records.</em>`
      : `<em>${esc(fmtVal(c.pct))}% of KPIs</em> are measured from ${c.records} approved record${c.records === 1 ? '' : 's'}${c.feed ? ` and ${c.feed} live-feed value${c.feed === 1 ? '' : 's'}` : ''}. <em>${mf.length}</em> miss their target${gapCost ? `, costing <em>${fmt.pkr(gapCost)}</em> per 30 days` : ''}${tot.hours ? `, <em>${esc(numTxt(tot.hours))} h</em> lost` : ''}${tot.kg ? `, <em>${esc(numTxt(tot.kg))} kg</em> (${esc(numTxt(tot.lb))} lb) of material or output` : ''}${tot.cash ? ` and <em>${fmt.pkr(tot.cash)}</em> of cash tied up` : ''}.`;

    const stream = D.STREAM.map((s, i) => {
      const r = kvKey(STREAM_KPI[s.id]);
      const isC = s.id === 'dyeing' && constraint;
      const nextC = i < D.STREAM.length - 1 && D.STREAM[i + 1].id === 'dyeing' && constraint;
      const dim = S.plant !== 'all' && s.plant !== S.plant;
      const link = i < D.STREAM.length - 1 ? `<span class="st-link ${isC || nextC ? 'slow' : ''}" aria-hidden="true"></span>` : '';
      const meter = s.id === 'dyeing' && load.value !== null
        ? `<span class="ld"><span>Load</span><span>${esc(fmtVal(load.value))}%</span></span><span class="meter ${load.value > 100 ? 'bad' : load.value > 88 ? 'warn' : 'good'}"><i style="--w:${Math.min(100, load.value)}%"></i></span>`
        : `<span class="meter ${r.value === null ? '' : r.status}"><i style="--w:${r.value === null ? 0 : 100}%"></i></span>`;
      return `<button class="st-node ${r.value === null ? 'nm' : r.status} ${isC ? 'constraint' : ''} ${dim ? 'dim' : ''}" data-go="${secRoute(s.section)}" aria-label="${esc(s.name)}: ${esc(r.name)} ${esc(valTxt(r))}${isC ? ', constraint' : ''}">
        ${isC ? '<span class="flag">CONSTRAINT</span>' : ''}
        <span class="ic">${ic(STAGE_IC[s.id])}</span><b>${esc(s.name)}</b><span class="k">${esc(r.name)}</span>
        <span class="ld"><span>${r.value === null ? 'Not measured' : 'Measured'}</span><span>${r.value === null ? '—' : esc(fmtVal(r.value)) + esc(uOf(r.unit))}</span></span>
        ${meter}
      </button>${link}`;
    }).join('');
    const canDyeForm = myForms().includes('dyehouse_day');
    const callout = constraint
      ? `<b>Dyeing is the constraint: load measured at ${esc(fmtVal(load.value))}% from ${load.n} approved records.</b> The plant can only ship what the dye house finishes. Raising output anywhere else only builds more WIP.`
      : load.value !== null
        ? `<b>Dye-house load is ${esc(fmtVal(load.value))}%</b>, below the 90% constraint line. Check Planning's bottleneck load to find the stage that limits output.`
        : '<b>Constraint not measured.</b> Enter Dye-house capacity (daily) records to see whether dyeing limits what the plant can ship.';

    const bySec = {};
    const once = new Map(); // one figure per overlap group, as in the totals
    mf.forEach(f => { if (!f.impactPkr) return; const g = `${f.sec}|${(f.quant && f.quant.overlap) || f.key}`; once.set(g, Math.max(once.get(g) || 0, f.impactPkr)); });
    once.forEach((v, g) => { const sec = g.split('|')[0]; bySec[sec] = (bySec[sec] || 0) + v; });
    const secItems = Object.entries(bySec).map(([k, v]) => [D.SECTIONS[k].name, Math.round(v / 1e4) / 100]);
    const bench = [['Right-first-time dyeing', 'dyeing|Right-first-time dyeing', '95–98%', '65–80%'], ['Sewing line efficiency', 'sewing|Line efficiency', '70–80%', '45–60%'], ['OEE', 'planning|OEE (plant)', '85%', '55–70%']];

    return `
    <section class="card hero rise glass" style="--i:0">
      <div>
        <div class="eyebrow"><span class="pulse"></span>Signed in as ${esc(S.user.displayName)} · ${esc(roleName(S.user.role))}${S.user.plant !== 'all' ? ' · ' + esc(plantShort(S.user.plant)) : ''}</div>
        <h2>${heroLine}</h2>
        <p>${esc(role.focus)} Department staff enter shift, daily and month-end records, and a different person approves each one. Only approved records count. A KPI with no records shows <b>Not measured</b>, never an estimate.</p>
        <div class="cta">
          ${myForms().length ? `<button class="btn primary" data-go="#/entry">${ic('pen')} Enter data</button>` : ''}
          ${pending ? `<button class="btn" data-go="#/entry/queue">${ic('check')} ${pending} record${pending === 1 ? '' : 's'} waiting for your approval</button>` : ''}
          ${mf[0] ? `<button class="btn" data-kpi="${kpiRef(mf[0].key)}">${ic('bolt')} Biggest measured gap: ${esc(mf[0].name)}</button>` : ''}
          ${canApprove && waitingApproval.length ? `<button class="btn" data-go="#/actions/approve">${ic('check')} ${waitingApproval.length} action${waitingApproval.length === 1 ? '' : 's'} to approve</button>` : ''}
        </div>
      </div>
      <div class="rings">${ring(Math.round(c.pct), 'Measured')}${ring(health, 'Health')}</div>
    </section>

    <div class="grid g6 mt">
      <div class="card stat rise" style="--i:1"><span class="big-ic">${ic('db')}</span><span class="k-name">KPIs measured</span><span class="k-val">${countNum(c.measured)}<small>/ ${c.applicable}</small></span><span class="k-sub">${c.records} approved records</span></div>
      <div class="card stat rise ${mf.length ? 'bad' : ''}" style="--i:2"><span class="big-ic">${ic('alert')}</span><span class="k-name">Measured off target</span><span class="k-val">${countNum(mf.length)}</span><span class="k-sub">${mf.filter(f => f.status === 'bad').length} far off</span></div>
      <div class="card stat rise" style="--i:3"><span class="big-ic">${ic('cash')}</span><span class="k-name">Measured cost of gaps</span>${gapCost ? `<span class="k-val">${countPkr(gapCost)}</span><span class="k-sub">per 30 days, at finance cost rates</span>` : '<span class="k-val nm">Not measured</span><span class="k-sub">needs cost rates from finance</span>'}</div>
      <div class="card stat rise ${oee.value === null ? '' : oee.status}" style="--i:4"><span class="big-ic">${ic('factory')}</span><span class="k-name">OEE (plant)</span>${statVal(oee)}<span class="k-sub">target ${esc(fmtVal(oee.target))}% · world-class 85%</span></div>
      <div class="card stat rise ${otif.value === null ? '' : otif.status}" style="--i:5"><span class="big-ic">${ic('truck')}</span><span class="k-name">OTIF delivery</span>${statVal(otif)}<span class="k-sub">target ${esc(fmtVal(otif.target))}%</span></div>
      <div class="card stat rise" style="--i:6"><span class="big-ic">${ic('check')}</span><span class="k-name">Fixes verified</span><span class="k-val">${countNum(byStage[4])}<small>/ ${list.length}</small></span><span class="k-sub">${byStage[3]} in progress</span></div>
    </div>

    <div class="card mt rise" style="--i:7">
      <h3>${ic('flow')}Value stream: fiber to cash <span class="sub">Measured headline KPI per stage · click to drill down</span></h3>
      <div class="stream">${stream}</div>
      <div class="callout">${ic(constraint ? 'alert' : 'info')}<div>${callout}</div>${!constraint && load.value === null && canDyeForm ? `<button class="btn sm" data-go="#/entry/dyehouse_day">${ic('pen')} Enter dye-house capacity</button>` : `<button class="btn sm" data-go="#/rca/otif">See the causal chain ${ic('arrow')}</button>`}</div>
    </div>

    <div class="grid g-wide mt">
      <div class="card rise" style="--i:8"><h3>${ic('bolt')}Do these next <span class="sub">Measured gaps, biggest cost first</span></h3>
        ${mf.length ? `<div class="rows">${mf.slice(0, 6).map((f, i) => `<button class="next" data-kpi="${kpiRef(f.key)}"><span class="rk">${i + 1}</span><span><span class="t">${esc(f.name)}: ${esc(fmtVal(f.value))}${esc(uOf(f.unit))} vs target ${esc(fmtVal(f.target))}${esc(uOf(f.unit))}</span><span class="s">${esc(D.SECTIONS[f.sec].name)} · ${f.n} approved records · ${esc(ST_WORD[f.status])}</span></span><span class="r"><b>${f.impactPkr ? fmt.pkr(f.impactPkr) : esc(fmtVal(f.gapPct)) + '%'}</b><span>${f.impactPkr ? 'per 30 days' : 'gap'}</span></span></button>`).join('')}</div>`
          : `<div class="empty">${c.measured ? 'Every measured KPI is on target.' : 'No measured findings yet. They appear as soon as approved records show a KPI missing its target.'}</div>`}
        <div class="mt"><button class="btn sm" data-go="#/actions">Open Action Center ${ic('arrow')}</button></div>
      </div>
      <div class="card rise" style="--i:9"><h3>${ic('target')}Where measured money leaks <span class="sub">PKR M per 30 days</span></h3>
        ${secItems.length ? chartPareto({ items: secItems }) : '<div class="empty">No measured PKR impact yet. It needs approved records for an off-target KPI plus finance\'s cost rates.</div>'}
      </div>
    </div>

    <div class="card mt rise" style="--i:10"><h3>${ic('check')}The audit loop: detect → diagnose → approve → execute → verify <span class="sub">Human approval at every gate</span></h3>
      <div class="loop">${RCA.STAGES.map((st, i) => `<button class="loop-st" data-go="#/actions"><span class="n">${i + 1}</span><b>${byStage[i]}</b><span>${STAGE_NAME[st]}</span></button>`).join('')}</div>
    </div>

    <div class="grid g3 mt">
      ${bench.map((b, i) => { const r = kvKey(b[1]); return `
      <div class="card lift rise" style="--i:${11 + i}"><h3>${ic('target')}${esc(b[0])}</h3>
        <div class="k-val">${r.value === null ? '<span class="nm">Not measured</span>' : `${esc(fmtVal(r.value))}<small>% ours</small>`}</div>
        <div class="k-sub mt"><span>World-class <b>${esc(b[2])}</b></span><span>Typical South Asia <b>${esc(b[3])}</b></span></div>
        <div class="mt"><button class="btn sm ghost" data-go="#/bench">All benchmarks ${ic('arrow')}</button></div></div>`; }).join('')}
    </div>
    <p class="note-foot">Every value on this page is calculated from approved department records for ${esc(where)} over the ${esc(per().name.toLowerCase())}. "Not measured" means there is no approved record yet. Audit-playbook findings in the Action Center are baseline estimates until their KPI is measured.</p>`;
  }

  // ---------------------------------------------------------------- page: Root-Cause Explorer
  function pageRca(params) {
    let path;
    if (params[0] === 'node' && G[params[1]]) {
      const p = bestPathTo(params[1]) || [D.SYMPTOMS[0]];
      const tail = RCA.trace(G, p[p.length - 1]).slice(1).map(s => s.id);
      path = [...p, ...tail];
    } else {
      const sym = D.SYMPTOMS.includes(params[0]) ? params[0] : 'otif';
      path = [sym];
      for (const id of params.slice(1)) {
        const last = path[path.length - 1];
        if (G[last].causes.some(c => c.id === id) && !path.includes(id)) path.push(id); else break;
      }
      const seenSet = new Set(path);
      RCA.trace(G, path[path.length - 1]).slice(1).forEach(s => { if (!seenSet.has(s.id)) { path.push(s.id); seenSet.add(s.id); } });
    }
    const sym = path[0];
    const rootId = path[path.length - 1];
    const root = G[rootId];
    const f = findingById(root.finding);
    const share = pathShare(path);

    const symBtns = D.SYMPTOMS.map(s => `<button class="${s === sym ? 'on' : ''}" data-go="#/rca/${s}" aria-pressed="${s === sym}"><b>${esc(G[s].label)}</b><span>${esc(G[s].metric)}</span></button>`).join('');
    const nodes = path.map((id, i) => {
      const n = G[id];
      const isRoot = i === path.length - 1;
      const w = i ? (G[path[i - 1]].causes.find(c => c.id === id) || { w: 0 }).w : 1;
      const alts = !isRoot ? n.causes.filter(c => c.id !== path[i + 1]).sort((a, b) => b.w - a.w) : [];
      const altHtml = alts.length ? `<div class="alts"><span>Other causes</span>${alts.slice(0, 4).map(c => `<button data-go="#/rca/${sym}/${[...path.slice(1, i + 1), c.id].join('/')}"><span>${esc(G[c.id].label)}</span><span>${Math.round(c.w * 100)}%</span></button>`).join('')}</div>` : '';
      return `${i ? `<span class="c-link" style="--i:${i}" aria-hidden="true"></span>` : ''}<div class="cn ${isRoot ? 'root' : i === 0 ? 'sy' : ''}" style="--i:${i}">
        <div class="lv">${isRoot ? ic('target') + 'Root cause' : i === 0 ? 'Symptom' : `Why ${i}`} · ${esc(n.stage)}</div>
        <b>${esc(n.label)}</b><div class="m">${esc(n.metric)}</div>
        ${i ? `<div class="sh">Explains ${Math.round(w * 100)}% of the step before</div>` : ''}${altHtml}</div>`;
    }).join('');
    const whys = path.slice(1).map((id, i) => `<li><span>Why ${i === 0 ? esc(G[sym].label.toLowerCase()) : esc(G[path[i]].label.toLowerCase())}? <b>${esc(G[id].label)}</b> — ${esc(G[id].metric)}.</span></li>`).join('');

    const roots = rootsUnder(sym);
    const bones = D.SIX_M.map(m => {
      const items = roots.filter(r => (findingById(G[r].finding) || {}).m6 === m);
      return `<div class="bone"><h6>${esc(m)}</h6>${items.length ? `<ul>${items.map(r => { const p = pathFrom(sym, r); return `<li class="${r === rootId ? 'hit' : ''}"><button data-go="#/rca/${sym}/${p.slice(1).join('/')}">${esc(G[r].label)}</button></li>`; }).join('')}</ul>` : '<span class="none">No cause found</span>'}</div>`;
    });
    const a = S.actions[f.id];
    return `${pageHead('Root-Cause Explorer', 'Pick a business symptom. The system follows the biggest contributing cause upstream, step by step, until it reaches a root cause with an owner and a fix. Click any "other cause" to explore a different branch.')}
      ${hint(`<b>How to read this:</b> each box answers "why?" for the box before it, and the percentage shows how much of that step this cause explains. Fixing the <b>root</b> removes the cause; fixing a symptom only hides it.`)}
      <div class="sym">${symBtns}</div>
      <div class="card mt rise"><h3>${ic('tree')}Causal chain <span class="sub">This root explains ~${Math.max(1, Math.round(share * 100))}% of "${esc(G[sym].label.toLowerCase())}"</span></h3><div class="chain">${nodes}</div></div>
      <div class="grid g-wide mt">
        <div class="card rise" style="--i:2"><h3>${ic('bolt')}Fix the root cause <span class="sub">${esc(f.id)}</span></h3>
          <div class="fd">
            <div class="fd-top"><div><div class="chips" style="margin-bottom:6px">${tag(esc(plantShort(f.plant)))}${tag(esc(f.m6), 'acc')}${stageTag(a.stage)}</div><h4>${esc(f.title)}</h4><div class="where">${esc(f.where)}</div></div>
              <div class="money">${f.cash ? `<b>${fmt.pkr(f.cash)}</b><span>cash</span>` : `<b>${money(f.pkr)}</b><span>${per().per}</span>`}</div></div>
            <div class="wsd"><div><b>Evidence</b>${esc(f.why)}</div><div><b>So what</b>${esc(f.sowhat)}</div><div class="do"><b>Do what</b>${esc(f.dowhat)}</div></div>
            <div class="kv"><div><span>${esc(f.kpi.name)} now</span><b>${esc(fmtVal(f.kpi.base))}${esc(f.kpi.unit === '%' ? '%' : ' ' + f.kpi.unit)}</b></div><div><span>Target</span><b>${esc(fmtVal(f.kpi.target))}${esc(f.kpi.unit === '%' ? '%' : ' ' + f.kpi.unit)}</b></div><div><span>Owner</span><b style="font-size:13px">${esc(f.who)}</b></div></div>
            <div class="fd-foot"><span class="score">Confidence <b>${Math.round(f.conf * 100)}%</b></span><span class="score">Recoverable <b>${Math.round(f.rec * 100)}%</b></span><span class="sp"></span>
              ${a.stage === 'detected' ? `<button class="btn sm primary" data-adv="${f.id}">${ic('check')} Confirm root cause</button>` : ''}
              <button class="btn sm ${a.stage === 'detected' ? '' : 'primary'}" data-open="${f.id}">Open action ${ic('arrow')}</button></div>
          </div></div>
        <div class="card why rise" style="--i:3"><h3>${ic('info')}5 Whys</h3><ol>${whys}</ol></div>
      </div>
      <div class="card mt rise" style="--i:4"><h3>${ic('target')}Fishbone (6M): every root cause behind "${esc(G[sym].label.toLowerCase())}" <span class="sub">Highlighted = traced root · click to explore</span></h3>
        <div class="fish">${bones.slice(0, 3).join('')}<div class="spine" aria-hidden="true"></div>${bones.slice(3).join('')}<div class="head">${esc(G[sym].label)}<br><span class="muted small">${esc(G[sym].metric)}</span></div></div>
      </div>`;
  }

  // ---------------------------------------------------------------- page: Audit programmes (ported)
  function pageAudits(params) {
    const A = D.AUDITS;
    const a = A.find(x => x.id === params[0]) || A[0];
    const view = params[1] === 'dash' ? 'dash' : 'flow';
    const tabs = A.map(x => `<a class="tab ${x.id === a.id ? 'on' : ''}" href="#/audits/${x.id}/${view}">${ic(SEC_IC[x.icon] || 'clip')}<span>${esc(x.t)}<small>${esc(x.sub)}</small></span></a>`).join('');
    const seg = `<div class="chips"><a class="chip ${view === 'flow' ? 'on' : ''}" href="#/audits/${a.id}/flow">Audit workflow</a><a class="chip ${view === 'dash' ? 'on' : ''}" href="#/audits/${a.id}/dash">Dashboard</a></div>`;
    const dl = (l, d, o = 0, c = '') => `<div class="dl ${c}">${l.map((x, i) => `<div><b>${esc(x)}</b><span>${esc(d[o + i] || '')}</span></div>`).join('')}</div>`;
    const st = (n, t, body, i) => `<div class="card step rise" style="--i:${i}"><div class="h"><span class="no">${n}</span><h4>${esc(t)}</h4></div>${body}</div>`;
    const arr = '<div class="arr" aria-hidden="true"></div>';
    let body;
    if (view === 'flow') {
      let o = 0;
      const chk = a.chk.map(g => { const h = `<div class="gl">${esc(g.g)}</div>${dl(g.i, a.dc, o)}`; o += g.i.length; return h; }).join('');
      body = `<div class="flow">
        ${st(1, 'Data gathering', `<p>Read-only connectors pull from these sources:</p>${dl(a.src, a.ds)}`, 0)}${arr}
        ${st(2, 'Ingest, clean and reconcile', `<p>${esc(a.ing)}</p>`, 1)}${arr}
        ${st(3, 'Audit modules run in parallel', chk, 2)}${arr}
        ${st(4, 'Compute tracked metrics', dl(a.met, a.dm, 0, 'm'), 3)}${arr}
        <div class="card step dec rise" style="--i:4"><div class="h"><span class="no">5</span><h4>Decision: ${esc(a.dec)}</h4></div>
          <div class="br"><div class="card step y"><div class="tagl" style="color:var(--bad)">YES: investigate</div><p>${esc(a.rc)}</p><button class="btn sm" data-go="#/rca">${ic('tree')} Open Root-Cause Explorer</button></div>
          <div class="card step n"><div class="tagl" style="color:var(--good)">NO: log and keep monitoring</div><p>Record in the baseline, check again at next scan.</p></div></div></div>${arr}
        ${st(6, 'Quantify and prioritize', `<p>${esc(a.qz)}</p><p>Scored on financial impact, customer impact, effort, risk and confidence.</p>`, 5)}${arr}
        ${st(7, 'Recommend and implement', `<p>Approved actions become SOPs, workflow configs and agent tasks:</p><div class="chips">${a.act.map(x => tag(esc(x), 'acc')).join('')}</div><div class="mt"><button class="btn sm" data-go="#/actions">${ic('check')} Track in Action Center</button></div>`, 6)}${arr}
        ${st(8, 'Audit report', `<p>${esc(a.rep)}</p><p>Delivered as an executive brief plus an audit-trail record of finding, approval, change and outcome.</p>`, 7)}
        <div class="loopnote">↺ Monthly re-scan: compare before/after, flag regressions, and feed new findings back into Step 1</div></div>`;
    } else {
      const kpis = a.kpi.map((k, i) => `<div class="card kpi rise ${k[3]}" style="--i:${i}"><span class="k-name">${esc(k[0])}${stTag(k[3])}</span><span class="k-val">${esc(k[1])}</span><span class="k-bm">${esc(k[2])}</span></div>`).join('');
      const charts = a.ch.map(c => { const m = Math.max(...c.b.map(x => x[1])); return `<div class="card rise"><h3>${ic('target')}${esc(c.t)}</h3><div class="rows">${c.b.map((x, i) => `<div class="row"><span>${esc(x[0])}</span><div class="bar"><i class="${c.r.includes(i) ? 'r' : ''}" style="--w:${(x[1] / m * 100).toFixed(1)}%;--i:${i}"></i></div><em>${esc(fmtVal(x[1]))}</em></div>`).join('')}</div></div>`; }).join('');
      const tb = `<div class="card tw rise"><table><thead><tr>${a.tb.h.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${a.tb.r.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td><span class="pill ${r[3]}">${{ h: 'High', m: 'Medium', l: 'Low' }[r[3]]}</span></td></tr>`).join('')}</tbody></table></div>`;
      body = `<div class="grid g-auto">${kpis}</div><div class="grid g2 mt">${charts}</div>${secT('Top findings')}${tb}<p class="note-foot">Red bars and cards mark values outside target. This is an illustrative example of the audit method, not your measured data; measured values are on the area pages.</p>`;
    }
    return `${pageHead('Audit Programs', esc(a.lead), seg)}<div class="tabs">${tabs}</div>${body}`;
  }

  // ---------------------------------------------------------------- section pages
  function renderSection(id, i0 = 0) {
    const s = D.SECTIONS[id];
    const rs = s.kpis.map(k => kv(id, k[0]));
    const measured = rs.filter(r => r.value !== null);
    const bad = measured.filter(r => r.status === 'bad').length;
    const fs = ranked(findingsFor().filter(f => f.sec === id));
    const mf = measuredFindings().filter(f => f.sec === id);
    const kp = s.kpis.map((k, i) => kpiTile(k, i + i0, id, i)).join('');
    const trends = measured.filter(r => r.series && r.series.length >= 2).sort((a, b) => (a.status === 'bad' ? 0 : 1) - (b.status === 'bad' ? 0 : 1)).slice(0, 4);
    const mk = S.m ? Object.values(S.m.kpis) : [];
    const srcRows = Object.values(M.FORMS).filter(f => f.depts.includes(id)).map(f => {
      const ks = mk.filter(x => x.form === f.id);
      const n = ks.reduce((m, x) => Math.max(m, x.n), 0);
      const last = ks.map(x => x.last).filter(Boolean).sort().pop();
      return `<tr><td><span class="dot ${n ? 'good' : ''}" title="${n ? 'Has approved records' : 'No approved records'}"></span></td><td><b>${esc(f.label)}</b></td><td>${esc(PERIOD_WORD[f.period])}</td><td>${(n2 => (n2 ? `${n2} KPI${n2 === 1 ? '' : 's'}` : 'Cause analysis (Pareto)'))(Object.values(M.KPIS).filter(k => k.form === f.id).length)}</td><td>${n ? `${n} records used` : 'No approved records'}</td><td>${last ? esc(last) : '—'}</td><td>${myForms().includes(f.id) ? `<a class="btn sm" href="#/entry/${f.id}">${ic('pen')} Enter</a>` : ''}</td></tr>`;
    }).join('');
    return `${pageHead(esc(s.name), esc(s.intro), s.plants.map(p => tag(esc(plantShort(p)))).join(''))}
      ${hint(`<b>${measured.length} of ${s.kpis.length} KPIs are measured</b> from approved records${measured.length ? `, and ${bad} ${bad === 1 ? 'is' : 'are'} off target` : ''}. Tiles marked "Not measured" have no approved record yet. Click any tile for its formula, the records behind it and the form that feeds it.`)}
      <div class="grid g-auto">${kp}</div>
      ${secT('Measured trends')}
      ${trends.length ? `<div class="grid g2">${trends.map(r => seriesChart(r)).join('')}</div>` : '<div class="card empty">No measured trend yet. Once approved records cover two or more dates, each KPI gets a run chart against its target here.</div>'}
      ${secT(`Measured findings · ${mf.length}`)}
      ${mf.length ? `<div class="grid g2">${mf.map((f, i) => mFindingCard(f, i)).join('')}</div>` : `<div class="card empty">${measured.length ? 'Every measured KPI in this area is on target.' : 'Nothing is measured in this area yet, so there are no measured findings.'}</div>`}
      ${secT(`Audit playbook · ${fs.length} baseline estimates, not measured`)}
      ${fs.length ? `<div class="grid g2">${fs.map((f, i) => findingCard(f, i)).join('')}</div>` : `<div class="card empty">No playbook findings for ${esc(plantShort(S.plant))} in this area. Switch the plant filter to "Whole group" to see all.</div>`}
      ${secT('Data sources for this area')}
      <div class="card tw rise"><table><thead><tr><th></th><th>Form</th><th>How often</th><th>Feeds</th><th>Records</th><th>Latest</th><th></th></tr></thead><tbody>${srcRows}</tbody></table></div>
      ${secT('Key terms used here')}
      <div class="chips">${s.terms.map(t => `<button class="chip" data-term="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  }
  function worstStatus(id) {
    const st = D.SECTIONS[id].kpis.map(k => kStatus(id, k));
    return st.includes('bad') ? 'bad' : st.includes('warn') ? 'warn' : st.includes('good') ? 'good' : 'unknown';
  }
  function tabsFor(ids, active, base) {
    return `<div class="tabs" role="tablist">${ids.map(id => `<a class="tab ${id === active ? 'on' : ''}" role="tab" aria-selected="${id === active}" href="${base}${id}">${ic(SEC_IC[D.SECTIONS[id].icon] || 'factory')}${esc(D.SECTIONS[id].name)}<span class="dot ${worstStatus(id)}"></span></a>`).join('')}</div>`;
  }
  function pageOps(params) {
    let ids = sectionsForPlant('production').map(([id]) => id);
    if (!ids.length) ids = Object.entries(D.SECTIONS).filter(([, s]) => s.group === 'production').map(([id]) => id);
    const id = ids.includes(params[0]) ? params[0] : ids[0];
    return tabsFor(ids, id, '#/ops/') + renderSection(id);
  }
  const pagePlanning = () => renderSection('planning');
  function pageSupply(params) {
    const ids = ['inventory', 'procurement'];
    const id = ids.includes(params[0]) ? params[0] : ids[0];
    return tabsFor(ids, id, '#/supply/') + renderSection(id);
  }
  const pageFinance = () => renderSection('finance');

  // ---------------------------------------------------------------- page: Action Center
  function pageActions(params) {
    const filter = ['all', 'approve', 'progress', 'verified', 'ineffective'].includes(params[0]) ? params[0] : 'all';
    const list = ranked(findingsFor());
    const pass = f => {
      const a = S.actions[f.id];
      if (filter === 'approve') return a.stage === 'diagnosed';
      if (filter === 'progress') return a.stage === 'approved' || a.stage === 'in_progress';
      if (filter === 'verified') return a.stage === 'verified';
      if (filter === 'ineffective') return a.stage === 'verified' && !isEffective(f, a);
      return true;
    };
    const shown = list.filter(pass);
    const canApprove = userCanApprove();
    const cnt = k => list.filter(f => { const a = S.actions[f.id]; return k === 'approve' ? a.stage === 'diagnosed' : k === 'progress' ? ['approved', 'in_progress'].includes(a.stage) : k === 'verified' ? a.stage === 'verified' : k === 'ineffective' ? a.stage === 'verified' && !isEffective(f, a) : true; }).length;
    const chips = [['all', 'All'], ['approve', 'Needs approval'], ['progress', 'In execution'], ['verified', 'Verified'], ['ineffective', 'Not effective']]
      .map(([k, l]) => `<a class="chip ${filter === k ? 'on' : ''}" href="#/actions/${k}">${l} <span class="n">${cnt(k)}</span></a>`).join('');
    const execVal = list.filter(f => ['approved', 'in_progress'].includes(S.actions[f.id].stage)).reduce((s, f) => s + f.pkr, 0);
    const verVal = list.filter(f => S.actions[f.id].stage === 'verified' && isEffective(f, S.actions[f.id])).reduce((s, f) => s + f.pkr * f.rec, 0);
    const cols = RCA.STAGES.map((st, ci) => {
      const items = shown.filter(f => S.actions[f.id].stage === st);
      return `<section class="col" aria-label="${STAGE_NAME[st]}"><div class="col-h"><span class="i">${ci + 1}</span>${STAGE_NAME[st]}<span class="c">${items.length}</span></div><div class="col-d">${STAGE_DESC[st]}</div>
        ${items.map((f, i) => {
          const a = S.actions[f.id];
          const eff = st === 'verified' ? isEffective(f, a) : null;
          const next = RCA.next(st);
          const blockWhy = !canAct(f) ? whyCannot(f) : next === 'approved' && !canApprove ? 'Only CEO, Plant Head or Finance can approve' : '';
          return `<div class="ac ${eff === false ? 'ineff' : ''}" style="--i:${i}"><h5><button data-open="${f.id}">${esc(f.title)}</button></h5>
            <div class="meta">${tag(esc(plantShort(f.plant)))}<span>${f.cash ? fmt.pkr(f.cash) + ' cash' : money(f.pkr)}</span><span>· score ${scoreOf(f)}</span>${eff === true ? tag('Effective', 'good') : eff === false ? tag('Not effective', 'bad') : ''}</div>
            <div class="meta who">${ic('user')}<span>${esc(f.who)}</span></div>
            <div class="meta"><span>Due ${esc(a.due)}</span></div>
            <div class="row2"><span class="sp"></span>
              ${next ? `<button class="btn sm ${next === 'approved' ? 'primary' : ''}" data-adv="${f.id}" ${blockWhy ? `disabled title="${esc(blockWhy)}"` : ''}>${ADV_LABEL[st]} ${ic('arrow')}</button>` : ''}
              ${eff === false ? `<button class="btn sm" data-reopen="${f.id}" ${canAct(f) ? '' : `disabled title="${esc(whyCannot(f))}"`}>${ic('reset')} Reopen</button>` : ''}
            </div></div>`;
        }).join('') || '<div class="muted small" style="padding:8px 4px">Nothing here.</div>'}</section>`;
    }).join('');
    const logRows = S.log.slice(0, 40).map(l => `<tr><td>${esc(new Date(l.t).toLocaleString())}</td><td>${esc(l.u)} · ${esc(roleName(l.r))}</td><td class="wrap">${esc(l.e)}</td></tr>`).join('');
    return `${pageHead('Action Center', 'Every finding becomes a tracked corrective action (8D / CAPA). Actions move one gate at a time. Only approver roles can approve, and an action closes only when its measured result is entered and checked against the target.',
      `<button class="btn sm" id="exportCsv">${ic('download')} Export CSV</button>${canAudit() ? `<button class="btn sm ghost" id="verifyChain">${ic('shield')} Check audit integrity</button>` : ''}`)}
      ${hint(canApprove ? `<b>You can approve.</b> Start with "Needs approval": approving moves the fix to the owner's queue.` : `<b>Signed in as ${esc(roleName(S.user.role))}.</b> You can diagnose, start and verify work${S.user.plant !== 'all' ? ` for ${esc(plantShort(S.user.plant))}` : ''}. Approval needs the CEO, Plant Head or Finance.`)}
      <div class="grid g4">
        <div class="card stat rise"><span class="k-name">Open actions</span><span class="k-val">${countNum(list.length - cnt('verified'))}</span><span class="k-sub">of ${list.length}</span></div>
        <div class="card stat rise" style="--i:1"><span class="k-name">Waiting for approval</span><span class="k-val">${countNum(cnt('approve'))}</span><span class="k-sub">approver roles only</span></div>
        <div class="card stat rise" style="--i:2"><span class="k-name">Value in execution</span><span class="k-val">${countPkr(execVal * per().k)}</span><span class="k-sub">${per().per}</span></div>
        <div class="card stat rise good" style="--i:3"><span class="k-name">Verified savings</span><span class="k-val">${countPkr(verVal * per().k)}</span><span class="k-sub">effective fixes only</span></div>
      </div>
      <div class="toolbar mt"><div class="chips">${chips}</div></div>
      <div class="kanban">${cols}</div>
      ${secT('Audit trail')}
      <div class="card tw">${logRows ? `<table><thead><tr><th>When</th><th>Who</th><th>Event</th></tr></thead><tbody>${logRows}</tbody></table>` : canAudit() ? '<div class="empty">No changes yet. Approvals, starts, verifications and reopenings will be recorded here with role and time.</div>' : '<div class="empty">The full audit trail is visible to the CEO, Finance and administrators. Each action\'s own history is in its detail panel.</div>'}</div>`;
  }

  /** Send one workflow change to the server; the server is the only authority on whether it is allowed. */
  async function mutate(id, op, body, onOk) {
    if (ui.busy) return;
    ui.busy = true;
    document.body.classList.add('busy');
    try {
      const res = await api(`/api/actions/${encodeURIComponent(id)}/${op}`, { method: 'POST', body: { ...body, version: S.actions[id].version } });
      applyAction(res);
      onOk(res.action);
    } catch (e) {
      if (e.status === 409 && e.data && e.data.action) { S.actions[id] = e.data.action; toast('Someone else changed this action just now. It has been refreshed; please check and try again.', 'bad'); }
      else if (e.status !== 401) toast(e.message, 'bad');
      if (e.status === 422 && op === 'transition' && body.to === 'verified') { const inp = $('#afterIn'); if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); } return; }
    } finally {
      ui.busy = false;
      document.body.classList.remove('busy');
    }
    if (ui.drawerFor === id) openFinding(id);
    rerender();
  }
  function advance(id) {
    const f = findingById(id), a = S.actions[id];
    if (!f || !a) return;
    const to = RCA.next(a.stage);
    if (!to) return;
    if (to === 'verified') { openFinding(id, true); return; }
    mutate(id, 'transition', { to }, () => toast(`${STAGE_NAME[to]}: ${f.title}`));
  }
  function verify(id, raw) {
    const f = findingById(id);
    const v = util.toNum(raw);
    if (v === null) { toast('Enter the measured after-value (a number of 0 or more) to verify the fix.', 'bad'); const inp = $('#afterIn'); if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); } return; }
    mutate(id, 'transition', { to: 'verified', after: v }, a => {
      toast(a.effective ? `Fix verified as effective: ${f.kpi.name} reached ${v}.` : `Target missed (${v} vs ${f.kpi.target}). Reopen the action and look for another cause.`, a.effective ? '' : 'bad');
    });
  }
  function reopen(id) {
    const f = findingById(id);
    mutate(id, 'reopen', {}, () => toast(`Reopened: ${f.title}`));
  }
  function setD8(id, index, checked) {
    mutate(id, 'd8', { index, checked }, () => {});
  }
  async function verifyChain() {
    try {
      const r = await api('/api/audit/verify');
      toast(r.ok ? `Audit trail intact: ${r.count} entries, hash chain verified.` : `Audit trail BROKEN at entry #${r.brokenAt}. Investigate immediately.`, r.ok ? '' : 'bad');
    } catch (e) { if (e.status !== 401) toast(e.status === 403 ? 'Only the CEO, Finance or an administrator can run the integrity check.' : e.message, 'bad'); }
  }
  function csvCell(v) {
    let s = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  }
  function exportCsv() {
    const head = ['id', 'title', 'plant', 'area', 'stage', 'owner', 'pkr_per_month', 'cash_pkr', 'priority_score', 'due', 'kpi', 'baseline', 'target', 'after'];
    const rows = D.FINDINGS.map(f => { const a = S.actions[f.id]; return [f.id, f.title, f.plant, D.SECTIONS[f.sec].name, STAGE_NAME[a.stage], f.who, f.pkr, f.cash || 0, scoreOf(f), a.due, f.kpi.name, f.kpi.base, f.kpi.target, a.after]; });
    const csv = [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'textile-audit-actions.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Exported textile-audit-actions.csv');
  }

  // ---------------------------------------------------------------- page: Data Entry (maker-checker records)
  const recTag = st => tag(...(REC_ST[st] || [st, '']));
  function entryForm(form) {
    const plants = S.user.plant === 'all' ? M.PLANT_IDS : [S.user.plant];
    const defPlant = plants.includes(S.plant) ? S.plant : plants[0];
    const fields = [...form.fields.filter(f => f.dim), ...form.fields.filter(f => !f.dim)];
    const err = id => `<small class="ferr" id="${id}-err" hidden></small>`;
    const fld = f => {
      const id = `ef-${f.k}`;
      const lab = `${esc(f.label)}${f.unit && f.unit !== 'count' ? ` <small>(${esc(f.unit)})</small>` : ''}${f.req ? ' <span class="req" aria-hidden="true">*</span>' : ''}`;
      const at = `id="${id}" data-k="${f.k}" aria-describedby="${id}-err"${f.req ? ' required aria-required="true"' : ''}`;
      let ctl;
      if (f.kind === 'choice') ctl = `<select ${at}><option value="">Choose…</option>${f.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
      else if (f.kind === 'yesno') ctl = `<select ${at}><option value="">—</option><option value="1">Yes</option><option value="0">No</option></select>`;
      else if (f.kind === 'text') ctl = `<input type="text" ${at} maxlength="40" autocomplete="off" spellcheck="false">`;
      else ctl = `<input type="number" ${at} inputmode="decimal" step="${f.kind === 'int' ? 1 : 'any'}" min="${f.min}" max="${f.max}">`;
      return `<div class="ef-f"><label class="f" for="${id}">${lab}</label>${ctl}${f.help ? `<small class="help">${esc(f.help)}</small>` : ''}${err(id)}</div>`;
    };
    const dateLabel = form.period === 'month' ? 'Month (any day in it)' : form.period === 'week' ? 'Week (any day in it)' : 'Date';
    const once = form.key ? `one record per ${form.period === 'month' ? 'month' : form.period === 'week' ? 'week' : 'date'}${form.key.length ? ` and ${form.key.map(k => form.fields.find(x => x.k === k).label.toLowerCase()).join(' + ')}` : ''}` : 'one record per event';
    return `<form class="card rise mt entry" id="entryForm" data-type="${esc(form.id)}" novalidate aria-labelledby="efTitle">
      <h3 id="efTitle">${ic('pen')}${esc(form.label)} <span class="sub">${esc(PERIOD_WORD[form.period])} · ${esc(once)}</span></h3>
      <div class="chips ef-photo"><button class="btn sm" type="button" id="ocrBtn">${ic('camera')} Read from photo</button><input type="file" id="ocrFile" accept="image/png,image/jpeg,image/webp" hidden><span class="small muted">Photograph the ledger or checklist page. The values found are filled in for you to check.</span></div>
      <div class="ef-ocr" role="status" hidden></div>
      <div class="ef-grid">
        <div class="ef-f"><label class="f" for="ef-plant">Plant <span class="req" aria-hidden="true">*</span></label><select id="ef-plant" aria-describedby="ef-plant-err" required>${plants.map(p => `<option value="${esc(p)}" ${p === defPlant ? 'selected' : ''}>${esc(plantShort(p))}</option>`).join('')}</select>${err('ef-plant')}</div>
        <div class="ef-f"><label class="f" for="ef-date">${dateLabel} <span class="req" aria-hidden="true">*</span></label><input type="date" id="ef-date" value="${todayLocal()}" max="${todayLocal()}" aria-describedby="ef-date-err" required>${err('ef-date')}</div>
        ${fields.map(fld).join('')}
      </div>
      <div class="ef-msg" role="alert" tabindex="-1" hidden></div>
      <div class="chips mt"><button class="btn primary" type="submit">${ic('check')} Submit for approval</button><span class="small muted">* required. A different person must approve this before it counts.</span></div>
    </form>`;
  }
  function recTable(scope) {
    const recs = ui.recs[scope];
    if (!recs || recs === 'loading') return '<div class="empty">Loading records…</div>';
    if (recs.error) return `<div class="empty">${esc(recs.error)}</div>`;
    if (!recs.length) return `<div class="empty">${{ mine: 'You have not entered any records yet.', queue: 'Nothing is waiting for your approval.', all: 'No records yet.' }[scope]}</div>`;
    return `<table><thead><tr><th>Record</th><th>Form</th><th>Plant</th><th>Date</th><th>Status</th><th>Entered by</th><th>Checks</th><th></th></tr></thead><tbody>${recs.map(r => `<tr><td>R${Number(r.id)}</td><td>${esc(r.formLabel)}</td><td>${esc(plantShort(r.plant))}</td><td>${esc(r.date)}</td><td>${recTag(r.status)}</td><td>${esc(r.submittedByName || r.submittedBy)}</td><td>${r.flags.length ? tag(`${r.flags.length} unusual`, 'warn') : '—'}</td><td><button class="btn sm ${r.canReview ? 'primary' : ''}" data-rec="${Number(r.id)}">${r.canReview ? 'Review' : 'Open'}</button></td></tr>`).join('')}</tbody></table>`;
  }
  async function loadRecords(scope, force) {
    if (!force && ui.recs[scope] !== undefined) return;
    ui.recs[scope] = 'loading';
    let out;
    try { out = (await api(`/api/records?scope=${encodeURIComponent(scope)}&limit=100`)).records; } catch (e) { out = { error: e.message }; }
    ui.recs[scope] = out;
    const box = $('#recBox');
    if (box && ui.recTab === scope) box.innerHTML = recTable(scope);
  }
  function pageEntry(params) {
    const forms = myForms();
    const reviewer = (S.user.reviewForms || []).length > 0;
    if (['mine', 'queue', 'all'].includes(params[0])) { ui.recTab = params[0]; params = params.slice(1); }
    if (ui.recTab === 'queue' && !reviewer) ui.recTab = 'mine';
    if (ui.recTab === 'all' && S.user.role === 'operator') ui.recTab = 'mine';
    const fid = forms.includes(params[0]) ? params[0] : forms.includes(ui.lastForm) ? ui.lastForm : forms[0];
    ui.lastForm = fid || null;
    loadRecords(ui.recTab);
    const pending = S.user.pendingReviews || 0;
    const tabs = [['mine', 'My submissions']];
    if (reviewer) tabs.push(['queue', `Approval queue${pending ? ` <span class="n">${pending}</span>` : ''}`]);
    if (S.user.role !== 'operator') tabs.push(['all', 'All records']);
    const dept = S.user.department && D.SECTIONS[S.user.department] ? D.SECTIONS[S.user.department].name : null;
    return `${pageHead('Data Entry', `Enter what happened on the floor${dept ? ` in ${esc(dept)}` : ''}. Every KPI on the dashboard is calculated from these records once a different person approves them. Nothing is estimated.`)}
      ${hint(`<b>How it works:</b> pick a form, fill in the numbers from the shift sheet or register, and submit. The same checks run here and on the server, values far from this plant's history are flagged for the approver, and a duplicate entry is refused. ${reviewer ? 'You can also approve or reject other people\'s records in the approval queue.' : 'Your department head approves or rejects it.'}`)}
      ${forms.length
        ? `<div class="chips" aria-label="Forms">${forms.map(id => `<a class="chip ${id === fid ? 'on' : ''}" href="#/entry/${esc(id)}" ${id === fid ? 'aria-current="true"' : ''}>${esc(M.FORMS[id].label)}</a>`).join('')}</div>${entryForm(M.FORMS[fid])}`
        : `<div class="card empty">Your account does not enter records${['dept', 'operator'].includes(S.user.role) ? '. Ask an administrator to set your department' : ''}.</div>`}
      ${secT('Records')}
      <div class="chips" role="tablist" aria-label="Record lists">${tabs.map(([k, l]) => `<button class="chip ${ui.recTab === k ? 'on' : ''}" role="tab" aria-selected="${ui.recTab === k}" data-rtab="${k}">${l}</button>`).join('')}</div>
      <div class="card tw mt" id="recBox">${recTable(ui.recTab)}</div>`;
  }
  function clearEntryErrors(el) {
    $$('[aria-invalid="true"]', el).forEach(x => x.removeAttribute('aria-invalid'));
    $$('.ferr', el).forEach(x => { x.hidden = true; x.textContent = ''; });
    const box = $('.ef-msg', el); box.hidden = true; box.textContent = '';
  }
  function showEntryErrors(el, errors) {
    const general = [];
    errors.forEach(er => {
      const c = er.field ? $(`#ef-${CSS.escape(String(er.field))}`, el) : null;
      if (!c) { general.push(er.error); return; }
      c.setAttribute('aria-invalid', 'true');
      const m = $(`#ef-${CSS.escape(String(er.field))}-err`, el);
      if (m) { m.textContent = er.error; m.hidden = false; }
    });
    const box = $('.ef-msg', el);
    box.innerHTML = `<b>Nothing was saved.</b> ${general.length ? general.map(esc).join(' ') : 'Correct the highlighted fields.'}`;
    box.hidden = false;
    const first = $('[aria-invalid="true"]', el);
    (first || box).focus();
  }
  async function submitEntry(el) {
    if (ui.busy) return;
    const type = el.dataset.type, def = M.FORMS[type];
    if (!def) return;
    const data = {};
    def.fields.forEach(f => {
      const c = $(`#ef-${CSS.escape(f.k)}`, el);
      const v = c ? c.value.trim() : '';
      if (v === '') return;
      data[f.k] = f.kind === 'text' || f.kind === 'choice' ? v : Number(v);
    });
    const body = { type, plant: $('#ef-plant', el).value, date: $('#ef-date', el).value, data };
    clearEntryErrors(el);
    const pre = M.validateRecord(body, todayUtc());
    if (pre.errors.length) { showEntryErrors(el, pre.errors); return; }
    const btn = $('button[type="submit"]', el);
    ui.busy = true; btn.disabled = true;
    try {
      const { record: r } = await api('/api/records', { method: 'POST', body });
      toast(`Saved as R${r.id}${r.flags.length ? `, with ${r.flags.length} unusual value${r.flags.length > 1 ? 's' : ''} flagged for the approver` : ''}. It counts once it is approved.`);
      def.fields.filter(f => !f.dim).forEach(f => { const c = $(`#ef-${CSS.escape(f.k)}`, el); if (c) c.value = ''; });
      ui.recs = {};
      loadRecords(ui.recTab, true);
    } catch (e) {
      if (e.status === 422 && e.data && Array.isArray(e.data.errors)) showEntryErrors(el, e.data.errors);
      else if (e.status !== 401) showEntryErrors(el, [{ field: null, error: e.message }]);
    } finally { ui.busy = false; btn.disabled = false; }
  }
  function findRec(id) {
    if (ui.recOpen && ui.recOpen.id === id) return ui.recOpen;
    for (const v of Object.values(ui.recs)) if (Array.isArray(v)) { const r = v.find(x => x.id === id); if (r) return r; }
    return null;
  }
  function openRecord(id, fresh) {
    const r = fresh || findRec(id);
    if (!r) return;
    ui.recOpen = r;
    const def = M.FORMS[r.type];
    const shown = v => (typeof v === 'number' ? String(v) : v);
    const rows = def ? def.fields.filter(f => r.data[f.k] !== undefined).map(f => `<div><span>${esc(f.label)}${f.unit && f.unit !== 'count' ? ` (${esc(f.unit)})` : ''}</span><b>${f.kind === 'yesno' ? (r.data[f.k] ? 'Yes' : 'No') : esc(shown(r.data[f.k]))}</b></div>`).join('') : '';
    const flags = r.flags.length ? `<div class="blk"><div class="callout">${ic('alert')}<div><b>Check these values before approving.</b><ul style="margin:6px 0 0;padding-left:18px">${r.flags.map(f => `<li>${esc(f.msg)}</li>`).join('')}</ul></div></div></div>` : '';
    const note = label => `<label class="f" for="recNote">${label}</label><textarea id="recNote" maxlength="500" rows="2"></textarea>`;
    const decide = r.canReview
      ? `<div class="blk"><b>Your decision</b>${note('Note (required to reject)')}<div class="chips mt"><button class="btn primary" data-review="${Number(r.id)}:approve">${ic('check')} Approve</button><button class="btn" data-review="${Number(r.id)}:reject">${ic('x')} Reject</button></div><p class="small muted">Approving makes these values count toward the KPIs. Nobody can approve a record they entered.</p></div>`
      : r.canVoid
        ? `<div class="blk"><b>Void this approved record</b>${note('Reason (required)')}<div class="chips mt"><button class="btn" data-review="${Number(r.id)}:void">${ic('reset')} Void</button></div><p class="small muted">Approved records are never edited. Void a wrong one with a reason, then enter it again.</p></div>`
        : r.status === 'submitted' ? '<div class="blk"><p class="small muted">Waiting for an approver. Someone other than the person who entered it must check it.</p></div>' : '';
    const verb = { approved: 'Approved', rejected: 'Rejected', voided: 'Voided' }[r.status];
    openDrawer(`<div class="chips">${tag(`R${Number(r.id)}`)}${tag(esc(plantShort(r.plant)))}${recTag(r.status)}</div>
      <h3 id="drawerTitle">${esc(r.formLabel)}</h3><p class="lede">${esc(r.date)} · entered by ${esc(r.submittedByName || r.submittedBy)} · ${esc(new Date(r.submittedAt).toLocaleString())}</p>
      ${flags}
      <div class="blk"><b>Values</b><div class="kv rec">${rows}</div></div>
      ${verb && r.reviewedBy ? `<div class="blk"><b>${verb} by ${esc(r.reviewedBy)}</b><p class="small">${esc(new Date(r.reviewedAt).toLocaleString())}${r.reviewNote ? ` · “${esc(r.reviewNote)}”` : ''}</p></div>` : ''}
      ${decide}`, `rec:${r.id}`);
  }
  async function refreshMe() {
    try { const { user } = await api('/api/me'); S.user = user; } catch (e) { /* keep the current profile */ }
  }
  async function loadMeasured() {
    if (!canRead()) { S.m = null; return; }
    try {
      S.m = await api(`/api/measured?plant=${encodeURIComponent(S.plant)}&period=${encodeURIComponent(S.period)}`);
      PALETTE = null; // KPI values in search results changed
    } catch (e) {
      S.m = null;
      if (e.status !== 401) toast(`Could not load measured KPIs: ${e.message}`, 'bad');
    }
  }
  async function reviewRecord(id, decision) {
    if (ui.busy) return;
    const r = findRec(id);
    if (!r) return;
    const box = $('#recNote');
    const note = box ? box.value.trim() : '';
    if (decision !== 'approve' && note.length < 3) { toast('Give a reason (at least 3 characters).', 'bad'); if (box) { box.setAttribute('aria-invalid', 'true'); box.focus(); } return; }
    ui.busy = true; document.body.classList.add('busy');
    let fresh = null;
    try {
      fresh = (await api(`/api/records/${Number(id)}/review`, { method: 'POST', body: { decision, version: r.version, note: note || undefined } })).record;
      toast(`R${id} ${fresh.status}.${decision === 'approve' ? ' Its values now count toward the KPIs.' : ''}`);
    } catch (e) {
      if (e.status === 409 && e.data && e.data.record) { fresh = e.data.record; toast(e.message, 'bad'); }
      else if (e.status !== 401) toast(e.message, 'bad');
    } finally { ui.busy = false; document.body.classList.remove('busy'); }
    if (!fresh) return;
    ui.recs = {}; ui.reports = undefined; ui.usage = undefined;
    await Promise.all([refreshMe(), loadMeasured(), canRead() ? loadAlerts(true) : null]);
    if (ui.drawerFor === `rec:${id}`) openRecord(id, fresh);
    rerender();
  }

  // ---------------------------------------------------------------- page: Formula Lab
  function calcCard(r, i) {
    return `<div class="card calc rise" style="--i:${i % 12}" id="calc-${r.id}" data-calc="${r.id}">
      <div class="chips">${tag(esc(r.domain), 'acc')}</div>
      <h3 style="margin:0">${esc(r.name)}</h3>
      <div class="fx">${esc(r.formula)}</div>
      <div class="ins">${r.inputs.map(([k, l, v]) => `<div><label class="f" for="in-${r.id}-${k}">${esc(l)}</label><input type="number" inputmode="decimal" min="0" step="any" id="in-${r.id}-${k}" value="${v}" data-def="${v}"></div>`).join('')}</div>
      <div class="out" aria-live="polite">${calcOut(r, r.inputs.map(x => x[2]), true)}</div>
      <div class="err"></div>
      ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}
    </div>`;
  }
  function calcOut(r, vals, isDefault) {
    const out = F[r.id](...vals);
    if (out === null) return `<b>—</b><span>${esc(r.unit)}</span>`;
    const d = Math.abs(out) >= 10000 ? 0 : Math.abs(out) >= 100 ? 1 : 2;
    return `<b>${esc(r.unit === 'PKR' ? fmt.num(out, 0) : fmt.num(out, d))}</b><span>${esc(r.unit)}</span>${isDefault ? tag('Glossary example', 'good') : tag('Your inputs', 'acc')}`;
  }
  function updateCalc(card) {
    const r = REG.find(x => x.id === card.dataset.calc);
    const ins = $$('input', card);
    const vals = ins.map(x => x.value);
    const isDefault = ins.every(x => x.value === x.dataset.def);
    const out = F[r.id](...vals);
    ins.forEach(x => x.setAttribute('aria-invalid', util.toNum(x.value) === null ? 'true' : 'false'));
    $('.out', card).innerHTML = calcOut(r, vals, isDefault);
    $('.err', card).textContent = out === null ? 'Enter positive numbers. A value you divide by cannot be zero.' : '';
  }
  function pageLab(params) {
    const doms = ['All', ...new Set(REG.map(r => r.domain))];
    return `${pageHead('Formula Lab', `All ${REG.length} formulas from the glossary as live calculators. Each one opens with the glossary’s worked example; change any input to test your own numbers.`)}
      ${hint('<b>Tip:</b> the numbers on the dashboard come from these same formulas. Use the lab to check a figure, or to test a "what if", for example how much end loss falls if rolls are 100 m instead of 50 m.')}
      <div class="toolbar"><div class="srch">${ic('search')}<input type="search" id="lq" placeholder="Search formulas…" value="${esc(ui.lQ)}" aria-label="Search formulas"></div>
        <div class="chips">${doms.map(d => `<button class="chip ${ui.lDom === d ? 'on' : ''}" data-ldom="${esc(d)}">${esc(d)}</button>`).join('')}</div></div>
      <div class="grid g-auto-l" id="llist">${labList()}</div>`;
  }
  function labList() {
    let list = REG.filter(r => ui.lDom === 'All' || r.domain === ui.lDom);
    if (ui.lQ.trim()) list = util.search(ui.lQ, list, r => r.name, r => r.formula + ' ' + r.domain);
    return list.length ? list.map(calcCard).join('') : '<div class="card empty">No formula matches. Try another word.</div>';
  }

  // ---------------------------------------------------------------- page: Glossary
  function pageGlossary() {
    const doms = ['All', ...new Set(D.GLOSSARY.map(g => g.domain))];
    return `${pageHead('Glossary', `All ${D.GLOSSARY.length} key terms from the Textiles Audit System glossary: a simple definition, why it matters, and the formula or example. Each term links to the calculator and to the page where it is tracked live.`)}
      <div class="toolbar"><div class="srch">${ic('search')}<input type="search" id="gq" placeholder="Search terms, e.g. shade, OTIF, marker…" value="${esc(ui.gQ)}" aria-label="Search glossary"></div></div>
      <div class="chips">${doms.map(d => `<button class="chip ${ui.gDom === d ? 'on' : ''}" data-gdom="${esc(d)}">${esc(d)} <span class="n">${d === 'All' ? D.GLOSSARY.length : D.GLOSSARY.filter(g => g.domain === d).length}</span></button>`).join('')}</div>
      <div class="az" id="az"></div>
      <div class="grid g-auto-l mt" id="glist"></div>`;
  }
  function glossaryList() {
    let list = D.GLOSSARY.filter(g => ui.gDom === 'All' || g.domain === ui.gDom);
    if (ui.gQ.trim()) list = util.search(ui.gQ, list, g => g.term, g => `${g.def} ${g.why} ${g.ex}`);
    const letters = new Set(list.map(g => g.term[0].toUpperCase()));
    if (ui.gLetter && !letters.has(ui.gLetter)) ui.gLetter = '';
    const shown = ui.gLetter ? list.filter(g => g.term[0].toUpperCase() === ui.gLetter) : list;
    $('#az').innerHTML = `<button class="${ui.gLetter ? '' : 'on'}" data-letter="">All</button>` + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => `<button data-letter="${l}" class="${ui.gLetter === l ? 'on' : ''}" ${letters.has(l) ? '' : 'disabled'}>${l}</button>`).join('');
    $('#glist').innerHTML = shown.length ? shown.map((g, i) => `<article class="card term lift rise" style="--i:${i % 12}">
      <h4>${esc(g.term)} ${tag(esc(g.domain), 'acc')}</h4><div class="def">${esc(g.def)}</div><div class="why2"><b>Why it matters:</b> ${esc(g.why)}</div><div class="ex">${esc(g.ex)}</div>
      <div class="acts">${g.f ? `<button class="btn sm" data-go="#/lab/${g.f}">${ic('calc')} Calculate</button>` : ''}<button class="btn sm" data-go="${secRoute(g.sec)}">${ic('arrow')} Where it's tracked</button><button class="btn sm ghost" data-term="${esc(g.term)}">Details</button></div></article>`).join('')
      : '<div class="card empty">No term matches your search.</div>';
  }

  // ---------------------------------------------------------------- page: Benchmarks
  function pageBench() {
    const conf = { verified: ['Verified source', 'good'], vendor: ['Vendor-reported', 'warn'], norm: ['Practitioner norm', 'acc'] };
    const ours = b => { const r = BENCH_KPI[b[0]] ? kvKey(BENCH_KPI[b[0]]) : null; return r && r.value !== null ? tag(`${esc(fmtVal(r.value))}${esc(uOf(r.unit))}`, r.status) : tag('Not measured'); };
    const rows = D.BENCHMARKS.map(b => `<tr><td><b>${esc(b[0])}</b></td><td>${ours(b)}</td><td>${esc(b[3])}</td><td>${esc(b[4])}</td><td>${tag(conf[b[5]][0], conf[b[5]][1])}</td><td class="wrap">${esc(b[6])}</td></tr>`).join('');
    const fixes = [
      ['Right-first-time dyeing programme', 'Evince Textiles, Bangladesh (IFC PaCT)', 'RFT from 80% to 95.5% for USD 216K. Daily scale calibration, testing against the standard rather than the running lot, auxiliary chemical QC, auto-dispensing, pass/fail limits. Yearly savings of 87.7K m³ water, 764K m³ gas, 2.1 GWh and 117 t chemicals.', 'verified', 'F07'],
      ['Digital lab-dip approval', 'Brand and mill case studies (Datacolor, X-Rite)', 'Approval cycles cut from 40–50 days to about 10, and 10–15 days taken off time to market, using calibrated spectro and digital standards.', 'vendor', 'F08'],
      ['Time study and line balancing', 'Pakistani and Bangladeshi garment case studies', 'Line efficiency moved from 54% to 60% and from 55% to 77% by balancing the bottleneck operation and using multi-skilled operators.', 'verified', 'F15'],
      ['Contamination-free cotton', 'Pakistan pilot districts', 'Contamination fell from 20 g to 5 g per bale through picking practice, cotton bags and grading ginners.', 'verified', 'F01'],
      ['Document checking before LC presentation', 'Trade-finance studies (UCP 600 / ISBP 745)', 'Hybrid OCR plus human review catches discrepancies before the bank does. 60–70% of LCs are discrepant on first presentation industry-wide.', 'verified', 'F25'],
      ['Attendance and skill-matrix programmes', 'Bangladesh factory programmes', 'Absenteeism down from 7–9% to 4–5%, and turnover from 12–24% to 3–5% a year.', 'verified', 'F17'],
    ];
    return `${pageHead('Benchmarks', 'Where the group stands against world-class and typical South Asian mills. Each benchmark is labelled with its source confidence so decisions are not built on marketing numbers.')}
      ${hint('<b>Read the confidence label.</b> "Verified source" is a primary or peer-reviewed source. "Vendor-reported" figures are probably optimistic. "Practitioner norm" is common industry practice with no single source. Calibrate targets with your own data.')}
      <div class="card tw rise"><table><thead><tr><th>Metric</th><th>Ours (measured)</th><th>World-class</th><th>Typical South Asia</th><th>Confidence</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${secT('Proven fixes behind the recommendations')}
      <div class="grid g-auto-l">${fixes.map((x, i) => `<div class="card lift rise" style="--i:${i}"><h3>${ic('spark')}${esc(x[0])}</h3><div class="chips" style="margin-bottom:8px">${tag(conf[x[3]][0], conf[x[3]][1])}${tag(esc(x[1]))}</div><p class="muted small" style="margin:0 0 12px">${esc(x[2])}</p><button class="btn sm" data-open="${x[4]}">See the matching finding ${ic('arrow')}</button></div>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- page: Data & Governance
  // ---------------------------------------------------------------- page: Alerts (in-app, high and medium findings)
  const SEV_TAG = { high: ['High', 'bad'], medium: ['Medium', 'warn'] };
  const AL_ST = { open: ['Open', 'bad'], acknowledged: ['Acknowledged', 'acc'], resolved: ['Resolved', 'good'] };
  const when = t => (t ? new Date(t).toLocaleString() : '');
  function alertCard(a, i) {
    const d = a.detail || {};
    const c = [];
    if (d.pkr) c.push(qChip(d.cash ? 'Financing cost' : 'PKR at risk', `${fmt.pkr(d.pkr)} / 30 days`));
    if (d.cash) c.push(qChip('Cash tied up', fmt.pkr(d.cash)));
    if (d.hours) c.push(qChip('Hours lost', `${numTxt(d.hours)} h`));
    if (d.kg) c.push(qChip('Production lost', `${numTxt(d.kg)} kg · ${numTxt(d.lb)} lb`));
    const sec = D.SECTIONS[a.sec];
    return `<article class="card fd rise alert-${esc(a.severity)}" style="--i:${i % 12}" id="alert-${Number(a.id)}">
      <div class="chips" style="margin-bottom:6px">${tag(...SEV_TAG[a.severity])}${tag(...AL_ST[a.status])}${tag(esc(plantShort(a.plant)))}${sec ? tag(esc(sec.name)) : ''}</div>
      <h4>${esc(a.title)}</h4>
      <p class="small muted" style="margin:4px 0 8px">${esc(d.why || '')}</p>
      ${c.length ? `<div class="qchips">${c.join('')}</div>` : ''}
      ${howCalc(d.steps)}
      <p class="small muted">Raised ${esc(when(a.createdAt))}${a.updatedAt !== a.createdAt ? ` · updated ${esc(when(a.updatedAt))}` : ''}${a.ackBy ? ` · acknowledged by ${esc(a.ackBy)} ${esc(when(a.ackAt))}` : ''}${a.resolvedAt ? ` · resolved ${esc(when(a.resolvedAt))}` : ''}</p>
      <div class="chips">${a.status === 'open' ? `<button class="btn sm primary" data-ack="${Number(a.id)}">${ic('check')} Acknowledge</button>` : ''}${sec ? `<button class="btn sm" data-go="${secRoute(a.sec)}">Open ${esc(sec.name)} ${ic('arrow')}</button>` : ''}</div>
    </article>`;
  }
  function alertList() {
    const x = ui.alerts;
    if (!x || x === 'loading') return '<div class="card empty">Loading alerts…</div>';
    if (x.error) return `<div class="card empty">${esc(x.error)}</div>`;
    if (!x.alerts.length) return `<div class="card empty">${ui.alertTab === 'all' ? 'No alerts yet.' : 'No open alerts. Every measured KPI you look after is on target or near it.'}</div>`;
    return `<div class="grid g2">${x.alerts.map(alertCard).join('')}</div>`;
  }
  async function loadAlerts(force) {
    if (!force && ui.alerts !== undefined && ui.alerts !== 'loading') return;
    ui.alerts = 'loading';
    try {
      const r = await api(`/api/alerts?status=${ui.alertTab === 'all' ? 'all' : 'open'}`);
      ui.alerts = r; S.alertCounts = r.counts;
    } catch (e) { ui.alerts = { error: e.message }; }
    if (parse().page === 'alerts') rerender(); else renderNav(parse().page);
  }
  function pageAlerts() {
    if (ui.alerts === undefined) loadAlerts();
    const c = S.alertCounts || { high: 0, medium: 0 };
    const tabs = [['open', 'Open & acknowledged'], ['all', 'All, including resolved']];
    const u = S.user;
    const who = ['ceo', 'finance', 'admin'].includes(u.role) || (u.role === 'plant' && u.plant === 'all') ? 'every plant and department'
      : u.role === 'dept' ? `${esc((D.SECTIONS[u.department] || {}).name || 'your department')}${u.plant === 'all' ? '' : ` in ${esc(plantShort(u.plant))}`}` : esc(plantShort(u.plant));
    return `${pageHead('Alerts', `High and medium priority findings for ${who}, raised automatically from approved records. Nothing is sent outside this system.`)}
      ${hint('<b>How alerts work:</b> each KPI in the red zone raises a <b>high</b> alert and each in the amber zone a <b>medium</b> one, for the plant head and the department manager who own it (the CEO, finance and admin see all). An alert updates when new records change the numbers, reopens if it gets worse, and resolves itself once the KPI is back on target. Acknowledging it records in the audit log that you have seen it.')}
      <div class="grid g4 mt">
        <div class="card stat rise ${c.high ? 'bad' : ''}" style="--i:1"><span class="big-ic">${ic('bell')}</span><span class="k-name">High, open</span><span class="k-val">${countNum(c.high)}</span><span class="k-sub">red zone</span></div>
        <div class="card stat rise" style="--i:2"><span class="big-ic">${ic('alert')}</span><span class="k-name">Medium, open</span><span class="k-val">${countNum(c.medium)}</span><span class="k-sub">amber zone</span></div>
      </div>
      <div class="chips mt" role="tablist" aria-label="Alert lists">${tabs.map(([k, l]) => `<button class="chip ${ui.alertTab === k ? 'on' : ''}" role="tab" aria-selected="${ui.alertTab === k}" data-atab="${k}">${l}</button>`).join('')}</div>
      <div class="mt" id="alertBox">${alertList()}</div>`;
  }
  async function ackAlert(id) {
    if (ui.busy) return;
    ui.busy = true;
    try {
      await api(`/api/alerts/${Number(id)}/ack`, { method: 'POST' });
      toast('Acknowledged. It stays listed until the KPI is back on target.');
    } catch (e) { if (e.status !== 401) toast(e.message, 'bad'); } finally { ui.busy = false; }
    await loadAlerts(true);
  }

  // ---------------------------------------------------------------- page: CEO Reports (scheduled summaries, admin panel)
  const SCHED_NAME = { weekly: 'Every week', biweekly: 'Every two weeks', off: 'Off' };
  async function loadReports(force) {
    if (!force && ui.reports !== undefined && ui.reports !== 'loading') return;
    ui.reports = 'loading';
    try {
      const x = await api('/api/reports');
      const first = x.reports[0];
      if (first && (!ui.report || !x.reports.some(r => r.id === ui.report.id))) await openReport(first.id, true);
      ui.reports = x;
    } catch (e) { ui.reports = { error: e.message }; }
    if (parse().page === 'reports') rerender();
  }
  async function openReport(id, quiet) {
    try { ui.report = (await api(`/api/reports/${Number(id)}`)).report; } catch (e) { if (!quiet && e.status !== 401) toast(e.message, 'bad'); return; }
    if (!quiet) { rerender(); const b = $('#reportView'); if (b) b.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }
  }
  function reportView(r) {
    const s = r.summary, t = s.totals || {};
    const tile = (i, icon, name, val, sub, cls) => `<div class="card stat rise ${cls || ''}" style="--i:${i}"><span class="big-ic">${ic(icon)}</span><span class="k-name">${name}</span><span class="k-val">${val}</span><span class="k-sub">${sub}</span></div>`;
    const ch = s.change;
    const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '±');
    const top = s.topFindings.map(f => `<tr><td>${esc(f.name)}<div class="small muted">${esc((D.SECTIONS[f.sec] || {}).name || f.sec)}</div>${howCalc(f.quant && f.quant.steps)}</td><td>${stTag(f.status)}</td><td>${esc(fmtVal(f.value))}${esc(uOf(f.unit))}</td><td>${esc(fmtVal(f.target))}${esc(uOf(f.unit))}</td><td>${f.quant && f.quant.pkr ? fmt.pkr(f.quant.pkr) : '—'}</td><td>${f.quant && f.quant.hours ? `${esc(numTxt(f.quant.hours))} h` : '—'}</td><td>${f.quant && f.quant.kg ? `${esc(numTxt(f.quant.kg))} kg` : '—'}</td></tr>`).join('');
    const secs = Object.values(s.bySection).sort((a, b) => b.pkr - a.pkr).map(x => `<tr><td>${esc(x.name)}</td><td>${x.findings}</td><td>${x.high}</td><td>${x.pkr ? fmt.pkr(x.pkr) : '—'}</td></tr>`).join('');
    const st = s.actions.byStage;
    const al = s.alerts || {};
    return `<section class="card mt rise report" id="reportView" aria-labelledby="repTitle">
      <div class="chips">${tag(r.kind === 'scheduled' ? `Scheduled · ${esc(SCHED_NAME[r.schedule] || r.schedule)}` : 'On demand', 'acc')}${tag(`${esc(s.period.from)} to ${esc(s.period.to)}`)}${tag(`by ${esc(r.createdBy)}`)}</div>
      <h3 id="repTitle" style="margin-top:8px">Summary for the CEO</h3>
      <p class="lede">${esc(r.headline)}</p>
      <div class="grid g4 mt">
        ${tile(1, 'db', 'KPIs measured', `${esc(fmtVal(s.coverage.pct))}%`, `${s.coverage.measured} of ${s.coverage.applicable} · last 30 days, ${s.coverage.records} records`)}
        ${tile(2, 'cash', 'PKR at risk', t.pkr ? fmt.pkr(t.pkr) : '—', 'per 30 days, at finance cost rates', t.pkr ? 'bad' : '')}
        ${tile(3, 'clock', 'Hours lost', t.hours ? `${esc(numTxt(t.hours))} h` : '—', 'machine and line time, per 30 days')}
        ${tile(4, 'box', 'Production lost', t.kg ? `${esc(numTxt(t.kg))} kg` : '—', t.kg ? `${esc(numTxt(t.lb))} lb, per 30 days` : 'per 30 days')}
        ${tile(5, 'alert', 'Off target', String(s.findingsCount), `${s.high} high · ${s.medium} medium`, s.high ? 'bad' : '')}
        ${tile(6, 'bell', 'Alerts open', String((al.openHigh || 0) + (al.openMedium || 0)), `${al.openHigh || 0} high · ${al.raised || 0} raised, ${al.resolved || 0} resolved this period`)}
        ${tile(7, 'check', 'Fixes verified', String(s.actions.verified.length), `${s.actions.overdue} overdue · ${st.in_progress || 0} in progress`)}
        ${tile(8, 'pen', 'Records approved', String(s.records.approved), `${s.records.rejected} rejected · ${s.records.waiting} waiting`)}
      </div>
      ${t.cash ? `<p class="small">Cash tied up beyond target: <b>${fmt.pkr(t.cash)}</b>. Its financing cost is part of the PKR at risk.</p>` : ''}
      ${ch ? `<p class="small">Since the report of ${esc(ch.since)}: PKR at risk ${sign(ch.pkr)}${fmt.pkr(Math.abs(ch.pkr))}, coverage ${sign(ch.coveragePct)}${esc(fmtVal(Math.abs(ch.coveragePct)))} points, findings ${sign(ch.findings)}${Math.abs(ch.findings)}.</p>` : '<p class="small muted">This is the first report, so there is no change to compare with yet.</p>'}
      ${secT('Top findings')}
      ${top ? `<div class="tw"><table><thead><tr><th>KPI</th><th>Status</th><th>Measured</th><th>Target</th><th>PKR / 30 days</th><th>Hours</th><th>kg</th></tr></thead><tbody>${top}</tbody></table></div>` : '<div class="empty">Every measured KPI is on target.</div>'}
      ${secs ? `${secT('By area')}<div class="tw"><table><thead><tr><th>Area</th><th>Findings</th><th>High</th><th>PKR / 30 days</th></tr></thead><tbody>${secs}</tbody></table></div>` : ''}
      ${secT('Corrective actions')}
      <div class="chips">${Object.entries(st).map(([k, n]) => tag(`${esc(STAGE_NAME[k] || k)}: ${n}`)).join('')}</div>
      <p class="small muted mt">Totals count overlapping KPIs once (for example spinning waste and yield measure the same lost fibre). Every figure comes from approved records; open "How this was calculated" on a finding for the arithmetic.</p>
      <div class="chips mt"><button class="btn sm" id="printReport">${ic('download')} Print or save as PDF</button></div>
    </section>`;
  }
  function pageReports() {
    if (ui.reports === undefined) loadReports();
    const x = ui.reports;
    if (!x || x === 'loading') return `${pageHead('CEO Reports', 'Loading…')}<div class="card empty">Loading reports…</div>`;
    if (x.error) return `${pageHead('CEO Reports', '')}<div class="card empty">${esc(x.error)}</div>`;
    const ctl = x.canManage
      ? `<label class="f inline" for="schedSel">Schedule</label><select id="schedSel">${Object.entries(SCHED_NAME).map(([k, l]) => `<option value="${k}" ${k === x.schedule ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn primary" id="genReport">${ic('spark')} Generate now</button>`
      : '';
    const rows = x.reports.map(r => `<tr ${ui.report && ui.report.id === r.id ? 'aria-current="true"' : ''}><td>${esc(r.from)} to ${esc(r.to)}</td><td>${r.kind === 'scheduled' ? tag('Scheduled', 'acc') : tag('On demand')}</td><td class="small">${esc(r.headline)}</td><td>${esc(r.createdBy)}</td><td><button class="btn sm" data-report="${Number(r.id)}">Open</button></td></tr>`).join('');
    return `${pageHead('CEO Reports', `A summary of the audit for the CEO, written ${x.schedule === 'off' ? 'only on demand (the schedule is off)' : `${SCHED_NAME[x.schedule].toLowerCase()} by the daily job`} and kept here in the admin panel. Next due: ${x.nextDue ? esc(x.nextDue) : '—'}.`, ctl)}
      ${hint('<b>What is in it:</b> how much is measured, what is off target and what it costs in PKR, hours and kg, open alerts, corrective actions and record activity, each compared with the previous report. If the daily job is missed, the report is written the next time someone opens this page.')}
      <div class="card tw mt">${rows ? `<table><thead><tr><th>Period</th><th>Type</th><th>Headline</th><th>By</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No reports yet.</div>'}</div>
      ${ui.report ? reportView(ui.report) : ''}`;
  }
  async function generateReport() {
    if (ui.busy) return;
    ui.busy = true; document.body.classList.add('busy');
    try {
      const { report } = await api('/api/reports', { method: 'POST' });
      ui.report = report;
      toast('Report written.');
    } catch (e) { if (e.status !== 401) toast(e.message, 'bad'); } finally { ui.busy = false; document.body.classList.remove('busy'); }
    await loadReports(true);
  }
  async function setSchedule(value) {
    try {
      await api('/api/reports/schedule', { method: 'POST', body: { schedule: value } });
      toast(`CEO report schedule: ${SCHED_NAME[value].toLowerCase()}.`);
    } catch (e) { if (e.status !== 401) toast(e.message, 'bad'); }
    await loadReports(true);
  }

  // ---------------------------------------------------------------- page: Usage & Costs (LLM spend, storage, audit cycles)
  const bytesTxt = b => (b >= 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);
  const msTxt = ms => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
  /** One series of daily bars on a recessive grid; every day has a hover tooltip, and a table view sits below. */
  function dayBars(title, points, valueOf, label) {
    // The SVG stretches to the card (preserveAspectRatio none); labels are HTML so they stay readable at any width.
    const W = 600, H = 120, n = points.length, step = W / n;
    const max = Math.max(...points.map(valueOf));
    const top = max > 0 ? max : 1;
    const bw = Math.max(1, step * 0.8);
    const bars = points.map((p, i) => {
      const v = valueOf(p), h = v ? Math.max(2, (H - 1) * v / top) : 0;
      const x = i * step;
      return `<g><title>${esc(p.day)}: ${esc(label(p))}</title><rect class="hit" x="${x.toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}"/>${h ? `<rect class="dbar" x="${(x + (step - bw) / 2).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"/>` : ''}</g>`;
    }).join('');
    const busiest = points.reduce((a, b) => (valueOf(b) > valueOf(a) ? b : a), points[0]);
    const rows = points.filter(p => valueOf(p)).map(p => `<tr><td>${esc(p.day)}</td><td>${esc(label(p))}</td></tr>`).join('');
    return `<figure class="card rise daybars"><figcaption><b>${esc(title)}</b><span class="small muted">${max > 0 ? `peak ${esc(label(busiest))} on ${esc(busiest.day)}` : 'nothing recorded'}</span></figcaption>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(title)} over ${n} days. ${max > 0 ? `Highest on ${esc(busiest.day)}: ${esc(label(busiest))}.` : 'Nothing recorded.'}">
        <line class="grid" x1="0" x2="${W}" y1="0.5" y2="0.5" vector-effect="non-scaling-stroke"/><line class="base" x1="0" x2="${W}" y1="${H}" y2="${H}" vector-effect="non-scaling-stroke"/>${bars}
      </svg>
      <div class="ax-row small muted"><span>${esc(points[0].day)}</span><span>scale 0 to ${esc(max > 0 ? numTxt(max) : '0')}</span><span>${esc(points[n - 1].day)}</span></div>
      <details class="how"><summary>Show as table</summary><div class="tw"><table><thead><tr><th>Day</th><th>${esc(title)}</th></tr></thead><tbody>${rows || '<tr><td colspan="2">Nothing in this period.</td></tr>'}</tbody></table></div></details>
    </figure>`;
  }
  async function loadUsage(force) {
    if (!force && ui.usage !== undefined && ui.usage !== 'loading') return;
    ui.usage = 'loading';
    try { ui.usage = await api(`/api/usage?days=${ui.usageDays}`); } catch (e) { ui.usage = { error: e.message }; }
    if (parse().page === 'usage') rerender();
  }
  function pageUsage() {
    if (ui.usage === undefined) loadUsage();
    const u = ui.usage;
    const ranges = [[7, '7 days'], [30, '30 days'], [90, '90 days']];
    const ctl = `<div class="chips" role="group" aria-label="Period">${ranges.map(([d, l]) => `<button class="chip ${ui.usageDays === d ? 'on' : ''}" data-udays="${d}" aria-pressed="${ui.usageDays === d}">${l}</button>`).join('')}</div>`;
    if (!u || u === 'loading') return `${pageHead('Usage & Costs', 'Loading…', ctl)}<div class="card empty">Loading usage…</div>`;
    if (u.error) return `${pageHead('Usage & Costs', '', ctl)}<div class="card empty">${esc(u.error)}</div>`;
    const st = u.storage, c = u.cycles, lt = u.records.leadTime;
    const todayCyc = c.days[c.days.length - 1];
    const maxCat = Math.max(1, ...st.categories.map(x => x.bytes));
    const cats = st.categories.map(x => `<div class="ucat"><div class="k-sub"><span><b>${esc(x.name)}</b> · ${esc(x.what)}</span><span><b>${esc(bytesTxt(x.bytes))}</b> · ${x.rows.toLocaleString('en-US')} rows</span></div><div class="meter"><i style="--w:${(x.bytes / maxCat * 100).toFixed(1)}%"></i></div></div>`).join('');
    const hrs = h => (h === null || h === undefined ? '—' : `${numTxt(h)} h`);
    return `${pageHead('Usage & Costs', `What the audit system itself costs to run, ${esc(u.period.from)} to ${esc(u.period.to)}, measured on this server.`, ctl)}
      <div class="grid g4 mt">
        <div class="card stat rise" style="--i:1"><span class="big-ic">${ic('cash')}</span><span class="k-name">LLM API cost</span><span class="k-val">$${u.llm.costUsd.toFixed(2)}</span><span class="k-sub">${u.llm.calls} call${u.llm.calls === 1 ? '' : 's'} in ${u.period.days} days</span></div>
        <div class="card stat rise" style="--i:2"><span class="big-ic">${ic('db')}</span><span class="k-name">Storage used</span><span class="k-val">${esc(bytesTxt(st.totalBytes))}</span><span class="k-sub">${st.fileBytes ? `database file ${esc(bytesTxt(st.fileBytes))}` : 'stored values'}</span></div>
        <div class="card stat rise" style="--i:3"><span class="big-ic">${ic('reset')}</span><span class="k-name">Audit cycles</span><span class="k-val">${countNum(c.total)}</span><span class="k-sub">${todayCyc ? `${todayCyc.count} today · ` : ''}${(c.total / u.period.days).toFixed(1)} a day</span></div>
        <div class="card stat rise" style="--i:4"><span class="big-ic">${ic('clock')}</span><span class="k-name">Time per cycle</span><span class="k-val">${esc(msTxt(c.avgMs))}</span><span class="k-sub">average · 95% under ${esc(msTxt(c.p95Ms))}</span></div>
      </div>
      <p class="small muted mt">${esc(u.llm.note)}</p>
      ${secT('Audit cycles per day')}
      <p class="small muted">${esc(c.what)}</p>
      <div class="grid g2">${dayBars('Cycles per day', c.days, p => p.count, p => `${p.count} cycle${p.count === 1 ? '' : 's'}`)}${dayBars('Average time per cycle (ms)', c.days, p => p.avgMs, p => (p.count ? `${msTxt(p.avgMs)} (gathering ${msTxt(p.gatherMs)}, computing ${msTxt(p.computeMs)})` : 'no cycles'))}</div>
      ${secT('From data gathering to final computation')}
      <div class="grid g4">
        <div class="card stat rise"><span class="k-name">Record entered → decided</span><span class="k-val">${esc(hrs(lt.medianHours))}</span><span class="k-sub">median of ${u.records.decided} · 90% within ${esc(hrs(lt.p90Hours))}</span></div>
        <div class="card stat rise"><span class="k-name">Waiting for approval</span><span class="k-val">${u.records.waiting}</span><span class="k-sub">${u.records.oldestWaiting ? `oldest since ${esc(when(u.records.oldestWaiting))}` : 'none waiting'}</span></div>
        <div class="card stat rise"><span class="k-name">Reports written</span><span class="k-val">${u.reports.generated}</span><span class="k-sub">${u.reports.generated ? `${esc(msTxt(u.reports.avgMs))} each` : 'none in this period'}</span></div>
        <div class="card stat rise"><span class="k-name">Photos read (OCR)</span><span class="k-val">${u.ocr.runs}</span><span class="k-sub">${u.ocr.runs ? `${esc(msTxt(u.ocr.avgMs))} each · ${esc(bytesTxt(u.ocr.bytes))} · ` : ''}on this server, no fee</span></div>
      </div>
      <p class="small muted">${esc(lt.what)} The cycle time above is the computation that follows.</p>
      ${secT('Storage by kind')}
      <div class="card rise">${cats}<p class="small muted mt">${esc(st.note)}</p></div>
      ${secT('LLM API cost per day')}
      ${dayBars('LLM API cost per day (USD)', u.llm.days, p => p.costUsd, p => `$${p.costUsd.toFixed(2)} · ${p.calls} call${p.calls === 1 ? '' : 's'}`)}`;
  }

  // ---------------------------------------------------------------- OCR: read a photographed ledger or checklist into the entry form
  const OCR_MAX = 2.5 * 1024 * 1024;
  const readAsDataUrl = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('The photo could not be opened.')); r.readAsDataURL(file); });
  /** Phone photos are often over the 2.5 MB limit: shrink those to at most 2000 px on the long side (plenty for OCR). */
  async function photoForOcr(file) {
    const url = await readAsDataUrl(file);
    if (file.size <= OCR_MAX * 0.95) return url;
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('The photo could not be opened.')); i.src = url; });
    const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.85);
  }
  async function readPhoto(input) {
    const file = input.files && input.files[0];
    const el = $('#entryForm');
    if (!file || !el || ui.busy) { input.value = ''; return; }
    const box = $('.ef-ocr', el);
    const btn = $('#ocrBtn', el);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { input.value = ''; box.innerHTML = '<b>Only PNG, JPEG or WebP photos can be read.</b>'; box.hidden = false; return; }
    ui.busy = true; btn.disabled = true;
    box.innerHTML = `${ic('clock')} Reading the photo on the server. This takes a few seconds.`; box.hidden = false;
    try {
      const image = await photoForOcr(file);
      const r = await api('/api/ocr', { method: 'POST', body: { form: el.dataset.type, plant: $('#ef-plant', el).value, image } });
      $$('.ocr-filled', el).forEach(x => x.classList.remove('ocr-filled'));
      let n = 0;
      for (const [k, v] of Object.entries(r.prefill)) {
        const c = $(`#ef-${CSS.escape(k)}`, el);
        if (!c) continue;
        c.value = String(v);
        if (c.value === String(v)) { c.classList.add('ocr-filled'); c.removeAttribute('aria-invalid'); n++; }
      }
      if (r.date && r.date <= todayLocal()) { $('#ef-date', el).value = r.date; $('#ef-date', el).classList.add('ocr-filled'); }
      const conf = Number.isFinite(r.confidence) ? ` (text confidence ${Math.round(r.confidence)}%)` : '';
      const rej = r.rejected.length ? `<li>Not filled, outside the allowed range: ${r.rejected.map(x => `${esc(x.label)} “${esc(String(x.value))}” (${esc(x.reason)})`).join(', ')}.</li>` : '';
      box.innerHTML = `<b>${n ? `Filled ${n} value${n === 1 ? '' : 's'} from the photo${conf}.` : `No values on this form were recognised${conf}.`}</b> Check every highlighted value against the sheet before you submit. A second person still approves the record.
        <ul>${rej}${r.date ? `<li>Date read from the photo: ${esc(r.date)}.</li>` : ''}<li><a href="/api/documents/${Number(r.document.id)}/image" target="_blank" rel="noopener">Open the stored photo</a> (kept as audit evidence).</li></ul>
        <details class="how"><summary>Text read from the photo</summary><pre class="ocr-text">${esc(r.text)}</pre></details>`;
      toast(n ? `Filled ${n} value${n === 1 ? '' : 's'} from the photo. Check them before submitting.` : 'No values recognised. Enter them by hand.', n ? '' : 'bad');
    } catch (e) {
      if (e.status !== 401) box.innerHTML = `<b>${esc(e.message)}</b>`;
    } finally { ui.busy = false; btn.disabled = false; input.value = ''; }
  }

  function pageData() {
    const c = cov();
    const steps = [['Enter', 'Staff fill department forms'], ['Validate', 'Same rules in browser and server'], ['Flag', 'Outliers vs plant history'], ['Approve', 'A different person checks'], ['Measure', 'Formulas on approved records'], ['Test', 'Control chart, trend, Welch t'], ['Quantify', 'PKR at finance cost rates'], ['Act', 'Findings become 8D actions']];
    const secCards = Object.entries(c.bySection).map(([sid, b], i) => {
      const pct = b.applicable ? Math.round(b.measured / b.applicable * 100) : 0;
      const forms = Object.values(M.FORMS).filter(f => f.depts.includes(sid));
      return `<div class="card lift rise" style="--i:${i % 12}">
        <h3>${ic(SEC_IC[D.SECTIONS[sid].icon] || 'db')}${esc(D.SECTIONS[sid].name)}<span class="sub">${b.measured} of ${b.applicable} KPIs</span></h3>
        <div class="k-sub"><span>Measured</span><span><b>${pct}%</b></span></div>
        <div class="meter ${pct >= 85 ? 'good' : pct >= 40 ? 'warn' : 'bad'}"><i style="--w:${pct}%"></i></div>
        <div class="fieldchips mt">${forms.map(f => `<span>${esc(f.label)} · ${esc(PERIOD_WORD[f.period].toLowerCase())}</span>`).join('')}</div>
        <div class="mt"><button class="btn sm" data-go="${secRoute(sid)}">Open ${esc(D.SECTIONS[sid].name)} ${ic('arrow')}</button></div></div>`;
    }).join('');
    return `${pageHead('Data & Governance', 'Where every number comes from. KPIs are calculated only from records that department staff entered and a different person approved. Nothing is estimated or filled in.')}
      <div class="grid g-wide">
        <div class="card hero glass rise" style="grid-template-columns:auto 1fr">${ring(Math.round(c.pct), 'Measured')}<div>
          <div class="eyebrow">Measurement coverage · ${esc(per().name)}</div><h2 style="font-size:21px"><em>${esc(fmtVal(c.pct))}%</em> of KPIs are measured (${c.measured} of ${c.applicable}).</h2>
          <p>A KPI counts as measured when approved records for it exist in the selected period and plant. The rest show "Not measured" with the form that would fill them. Raise coverage by entering the forms below.</p>
          <div class="chips mt">${tag(`${c.records} approved records`, 'good')}${tag(`${c.applicable - c.measured} KPIs not measured`, c.applicable - c.measured ? 'warn' : 'good')}</div></div></div>
        <div class="card rise" style="--i:1"><h3>${ic('shield')}How the numbers are kept honest</h3><ul class="gov" style="margin:0;padding-left:18px">
          <li><b>Maker-checker:</b> staff enter, a head approves. Nobody approves their own record.</li>
          <li><b>Never edited:</b> approved records are voided with a reason and entered again; the database refuses changes.</li>
          <li><b>Checked twice:</b> the same rules run in the form and on the server, and duplicates are refused.</li>
          <li><b>Outlier flags:</b> values far from the plant's own history are shown to the approver.</li>
          <li><b>Statistics, not guesses:</b> control charts, trend tests and Welch t-tests explain each gap.</li>
          <li><b>Audit trail:</b> every entry, approval, rejection and void is in the hash-chained log.</li></ul></div>
      </div>
      ${secT('How a number gets onto the dashboard')}
      <div class="pipe">${steps.map((s, i) => `<div style="--i:${i}"><span class="no">${i + 1}</span><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join('')}</div>
      ${secT('Coverage by area')}
      <div class="grid g-auto-l">${secCards || '<div class="card empty">No KPIs apply to this plant.</div>'}</div>`;
  }

  // ---------------------------------------------------------------- drawer
  function openDrawer(html, key) {
    ui.lastFocus = document.activeElement;
    ui.drawerFor = key || null;
    const d = $('#drawer');
    d.innerHTML = `<button class="btn icon ghost x" data-close aria-label="Close">${ic('x')}</button>${html}`;
    d.classList.add('on'); $('#scrim').classList.add('on');
    d.scrollTop = 0;
    requestAnimationFrame(() => { d.classList.add('ready'); animateCounts(d); const af = $('[autofocus]', d) || $('.x', d); af.focus(); });
  }
  function closeOverlays() {
    $('#drawer').classList.remove('on', 'ready'); $('#scrim').classList.remove('on');
    $('#palette').classList.remove('on'); $('#modal').classList.remove('on');
    $('#side').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
    ui.drawerFor = null;
    if (ui.lastFocus && document.body.contains(ui.lastFocus)) ui.lastFocus.focus();
  }
  function openFinding(id, focusVerify) {
    const f = findingById(id);
    if (!f) return;
    const a = S.actions[id];
    const idx = RCA.STAGES.indexOf(a.stage);
    const next = RCA.next(a.stage);
    const eff = a.stage === 'verified' ? isEffective(f, a) : null;
    const canApprove = userCanApprove();
    const u = f.kpi.unit === '%' ? '%' : f.kpi.unit ? ' ' + f.kpi.unit : '';
    const mKey = M.FINDING_KPI[f.id] || `${f.sec}|${f.kpi.name}`;
    const now = M.META[mKey] ? kvKey(mKey) : null;
    const hist = a.hist.slice().reverse().map(h => `<div><span>${esc(new Date(h.t).toLocaleString())}</span><b>${esc(h.e)}</b></div>`).join('');
    const may = canAct(f);
    const why = may ? '' : whyCannot(f);
    const dis = why ? `disabled title="${esc(why)}"` : '';
    const advWhy = why || (next === 'approved' && !canApprove ? 'Only CEO, Plant Head or Finance can approve' : '');
    const ctl = a.stage === 'in_progress' ? `<div class="blk"><b>Verify the result</b><div class="verify"><div><label class="f" for="afterIn">Measured ${esc(f.kpi.name)} after the fix (${esc(f.kpi.unit || 'value')}) · target ${esc(fmtVal(f.kpi.target))}${esc(u)}</label><input type="number" min="0" step="any" id="afterIn" ${dis} ${focusVerify && may ? 'autofocus' : ''} placeholder="e.g. ${esc(String(f.kpi.target))}"></div><button class="btn primary" data-verify="${f.id}" ${dis}>${ic('check')} Verify</button></div><p class="small muted" style="margin:6px 0 0">${why ? esc(why) + '.' : 'The server compares this with the target and records it in the audit trail. A missed target can be reopened.'}</p></div>`
      : next ? `<div class="blk"><button class="btn primary" data-adv="${f.id}" ${advWhy ? `disabled title="${esc(advWhy)}"` : ''}>${ADV_LABEL[a.stage]} ${ic('arrow')}</button>${advWhy ? `<p class="small muted">${esc(advWhy)}.</p>` : ''}</div>`
        : eff === false ? `<div class="blk"><div class="callout">${ic('alert')}<div><b>Not effective.</b> ${esc(f.kpi.name)} is ${esc(fmtVal(a.after))}${esc(u)} against a target of ${esc(fmtVal(f.kpi.target))}${esc(u)}. Reopen it and trace the next cause.</div><button class="btn sm" data-reopen="${f.id}" ${dis}>${ic('reset')} Reopen</button></div></div>` : `<div class="blk"><div class="hint" style="border-color:rgba(52,211,153,.4)">${ic('check')}<div><b>Verified effective.</b> ${esc(f.kpi.name)} reached ${esc(fmtVal(a.after))}${esc(u)} (target ${esc(fmtVal(f.kpi.target))}${esc(u)}). Next monthly scan re-checks it for regression.</div></div></div>`;
    openDrawer(`<div class="chips">${tag(esc(f.id))}${tag(esc(plantShort(f.plant)))}${tag(esc(D.SECTIONS[f.sec].name))}${tag(esc(f.m6) + ' (6M)', 'acc')}${stageTag(a.stage)}</div>
      <h3 id="drawerTitle">${esc(f.title)}</h3><p class="lede">${esc(f.where)}</p>
      <div class="kv"><div><span>${f.cash ? 'Cash to release' : 'Leakage ' + esc(per().per)}</span><b>${f.cash ? fmt.pkr(f.cash) : money(f.pkr)}</b></div><div><span>Recoverable</span><b>${Math.round(f.rec * 100)}%</b></div><div><span>Priority score</span><b>${scoreOf(f)}</b></div></div>
      <div class="blk"><b>Progress</b><div class="stages">${RCA.STAGES.map((s, i) => `<span class="${i <= idx ? 'on' : ''}" title="${STAGE_NAME[s]}"></span>`).join('')}</div><div class="k-sub mt"><span>${STAGE_NAME[a.stage]}: ${STAGE_DESC[a.stage]}</span><span>Due ${esc(a.due)}</span></div></div>
      <div class="blk"><b>Measure of success</b><div class="kv"><div><span>Baseline (estimate)</span><b>${esc(fmtVal(f.kpi.base))}${esc(u)}</b></div><div><span>Target</span><b>${esc(fmtVal(f.kpi.target))}${esc(u)}</b></div><div><span>After fix</span><b>${a.after === null ? '—' : esc(fmtVal(a.after)) + esc(u)}</b></div></div>
        ${now ? `<div class="k-sub mt"><span>Measured now from approved records: <b>${esc(valTxt(now))}</b>${now.value !== null ? ` (${now.n} records)` : ''}</span><button class="btn sm ghost" data-kpi="${kpiRef(mKey)}">KPI evidence ${ic('arrow')}</button></div>` : ''}</div>
      <div class="blk"><div class="wsd"><div><b>Why (evidence)</b>${esc(f.why)}</div><div><b>So what</b>${esc(f.sowhat)}</div><div class="do"><b>Do what</b>${esc(f.dowhat)}</div><div><b>Who owns it</b>${esc(f.who)}</div><div><b>Confidence</b>${Math.round(f.conf * 100)}% (audit-playbook estimate). The money and baseline are estimates until the KPI above is measured from approved records.</div></div></div>
      ${ctl}
      <div class="blk"><b>8D checklist</b><div class="d8">${D8.map((l, k) => `<label><input type="checkbox" data-d8="${f.id}:${k}" ${a.d8[k] ? 'checked' : ''} ${may ? '' : 'disabled'}> ${esc(l)}</label>`).join('')}</div></div>
      <div class="blk"><div class="chips"><button class="btn sm" data-go="#/rca/node/${f.node}">${ic('tree')} Trace root cause</button><button class="btn sm" data-go="${secRoute(f.sec)}">${ic('factory')} Open ${esc(D.SECTIONS[f.sec].name)}</button></div></div>
      <div class="blk"><b>History</b><div class="timeline">${hist}</div></div>`, id);
  }
  function termCalc(fid) {
    const r = REG.find(x => x.id === fid);
    return r ? `<div class="blk"><b>Calculator</b>${calcCard(r, 0)}</div>` : '';
  }
  function openTerm(name) {
    const g = D.GLOSSARY.find(x => x.term === name);
    if (!g) return;
    const kpis = [];
    Object.entries(D.SECTIONS).forEach(([sid, s]) => s.kpis.forEach((k, i) => { if (k[6] === name) kpis.push([sid, i, k]); }));
    openDrawer(`<div class="chips">${tag(esc(g.domain), 'acc')}${tag('Glossary')}</div><h3 id="drawerTitle">${esc(g.term)}</h3><p class="lede">${esc(g.def)}</p>
      <div class="wsd"><div><b>Why it matters</b>${esc(g.why)}</div><div><b>Formula / example</b>${esc(g.ex)}</div></div>
      ${termCalc(g.f)}
      ${kpis.length ? `<div class="blk"><b>Tracked as</b><div class="rows">${kpis.map(([sid, i, k]) => { const r = kv(sid, k[0]); return `<button class="next" data-kpi="${sid}:${i}"><span class="rk">${ic('target')}</span><span><span class="t">${esc(k[0])}</span><span class="s">${esc(D.SECTIONS[sid].name)} · target ${esc(fmtVal(k[3]))}</span></span><span class="r"><b style="color:var(--${r.value === null ? 'faint' : r.status})">${esc(valTxt(r))}</b></span></button>`; }).join('')}</div></div>` : ''}
      <div class="blk"><button class="btn sm" data-go="${secRoute(g.sec)}">${ic('arrow')} Where it's tracked: ${esc(D.SECTIONS[g.sec].name)}</button></div>`, 'term');
  }
  function openKpi(key) {
    const [sid, idx] = key.split(':');
    const s = D.SECTIONS[sid]; const k = s && s.kpis[+idx];
    if (!k) return;
    const r = kv(sid, k[0]);
    const u = uOf(k[2]);
    const g = D.GLOSSARY.find(x => x.term === k[6]);
    const fs = ranked(D.FINDINGS.filter(f => f.sec === sid)).slice(0, 3);
    const mf = measuredFindings().find(f => f.key === r.key);
    const canForm = !!r.form && myForms().includes(r.form);
    const where = S.plant === 'all' ? 'the group' : plantShort(S.plant);
    const enter = label => (canForm ? `<button class="btn sm primary" data-go="#/entry/${esc(r.form)}">${ic('pen')} ${label}</button>` : '');
    const src = r.value === null
      ? `<div class="blk"><div class="callout">${ic('info')}<div><b>Not measured.</b> There are no approved ${esc(r.formLabel || 'records')} for ${esc(where)} in the ${esc(per().name.toLowerCase())}. ${canForm ? 'You can enter one now; a different person approves it before it counts.' : 'The department enters it and a head approves it before it counts.'}</div>${enter(`Enter ${esc(r.formLabel)}`)}</div></div>`
      : r.source === 'feed'
        ? `<div class="blk"><b>Source</b><p class="small">Live data feed (${esc(r.feed.source)}), as of ${esc(r.last)}. No approved department records yet.</p></div>`
        : `<div class="blk"><b>Source</b><p class="small">${r.n} approved ${esc(r.formLabel)} record${r.n === 1 ? '' : 's'}${r.first ? ` from ${esc(r.first)} to ${esc(r.last)}` : ''}, ${esc(where)}.${r.stale ? ' <b>No new records lately, so this value may be out of date.</b>' : ''}</p>${enter('Enter more')}</div>`;
    const pareto = mf && mf.evidence.find(e => e.kind === 'pareto');
    openDrawer(`<div class="chips">${tag(esc(s.name), 'acc')}${stTag(r.status)}${r.value !== null ? tag(r.source === 'feed' ? 'Live feed' : 'Measured', 'good') : ''}</div><h3 id="drawerTitle">${esc(k[0])}</h3>
      <div class="kv"><div><span>${r.value === null ? 'Measured' : r.source === 'feed' ? 'Feed value' : 'Measured'}</span><b>${r.value === null ? '—' : esc(fmtVal(r.value)) + esc(u)}</b></div><div><span>Target</span><b>${esc(fmtVal(k[3]))}${esc(u)}</b></div><div><span>Direction</span><b>${k[4] === 'up' ? 'Higher is better' : 'Lower is better'}</b></div></div>
      ${src}
      ${r.formula ? `<div class="blk"><b>How it is calculated</b><p class="small mono" style="margin:0">${esc(r.formula)}</p></div>` : ''}
      ${r.series && r.series.length >= 2 ? `<div class="blk">${seriesChart(r, 'Measured by date')}</div>` : ''}
      ${mf ? `<div class="blk"><b>Evidence</b>${evList(mf.evidence.filter(e => e.kind !== 'pareto' && e.kind !== 'measure'))}${pareto ? `<div class="mt">${chartPareto({ items: pareto.items.map(x => [x.label, x.value]) })}</div>` : ''}</div>` : ''}
      ${mf && mf.hypotheses.length ? `<div class="blk"><b>Likely causes to check (audit playbook)</b><div class="rows">${mf.hypotheses.map(h => `<button class="next" data-open="${esc(h.id)}"><span class="rk">${ic('tree')}</span><span><span class="t">${esc(h.title)}</span><span class="s">Baseline hypothesis, confirm with the evidence above</span></span></button>`).join('')}</div></div>` : ''}
      <div class="blk"><b>Benchmark</b><p class="muted" style="margin:0">${esc(k[5])}</p></div>
      ${g ? `<div class="blk"><b>What it means · ${esc(g.term)}</b><div class="wsd"><div><b>Definition</b>${esc(g.def)}</div><div><b>Why it matters</b>${esc(g.why)}</div></div></div>` : ''}
      ${termCalc(k[7])}
      ${fs.length && canRead() ? `<div class="blk"><b>Audit playbook for this area (baseline estimates)</b><div class="rows">${fs.map((f, i) => `<button class="next" data-open="${f.id}"><span class="rk">${i + 1}</span><span><span class="t">${esc(f.title)}</span><span class="s">${esc(f.who)}</span></span><span class="r"><b>${f.cash ? fmt.pkr(f.cash) : money(f.pkr)}</b><span>estimate</span></span></button>`).join('')}</div></div>` : ''}`, 'kpi');
  }

  // ---------------------------------------------------------------- command palette
  function paletteItems() {
    const items = [];
    navFor().forEach(g => g.items.forEach(([id, name, icon]) => items.push({ label: name, sub: g.g, kind: 'Page', icon, go: `#/${id}` })));
    myForms().forEach(id => items.push({ label: M.FORMS[id].label, sub: `Data entry form · ${PERIOD_WORD[M.FORMS[id].period]}`, kind: 'Form', icon: 'pen', go: `#/entry/${id}` }));
    if (canRead()) {
      Object.entries(D.SECTIONS).forEach(([id, s]) => items.push({ label: s.name, sub: s.intro, kind: 'Area', icon: SEC_IC[s.icon] || 'factory', go: secRoute(id) }));
      D.SYMPTOMS.forEach(s => items.push({ label: `Why: ${G[s].label}`, sub: G[s].metric, kind: 'Root cause', icon: 'tree', go: `#/rca/${s}` }));
      D.FINDINGS.forEach(f => items.push({ label: f.title, sub: `Playbook estimate · ${f.who} · ${f.where}`, kind: 'Finding', icon: 'alert', open: f.id }));
      Object.entries(D.SECTIONS).forEach(([sid, s]) => s.kpis.forEach((k, i) => items.push({ label: k[0], sub: `${s.name} KPI · ${valTxt(kv(sid, k[0]))}`, kind: 'KPI', icon: 'target', kpi: `${sid}:${i}` })));
    }
    REG.forEach(r => items.push({ label: r.name, sub: r.formula, kind: 'Calculator', icon: 'calc', go: `#/lab/${r.id}` }));
    D.GLOSSARY.forEach(g => items.push({ label: g.term, sub: g.def, kind: 'Term', icon: 'book', term: g.term }));
    return items;
  }
  let PALETTE = null;
  function openPalette() {
    PALETTE = PALETTE || paletteItems();
    ui.lastFocus = document.activeElement;
    $('#palette').classList.add('on'); $('#scrim').classList.add('on');
    const inp = $('#pIn'); inp.value = ''; renderPalette(''); setTimeout(() => inp.focus(), 30);
  }
  function renderPalette(q) {
    const res = q.trim() ? util.search(q, PALETTE, x => x.label, x => `${x.sub} ${x.kind}`).slice(0, 14) : PALETTE.filter(x => ['Page', 'Root cause', 'Form'].includes(x.kind)).slice(0, 14);
    ui.pItems = res; ui.pIdx = 0;
    $('#pList').innerHTML = res.length ? res.map((x, i) => `<div class="p-item ${i === 0 ? 'on' : ''}" role="option" aria-selected="${i === 0}" data-pi="${i}">${ic(x.icon)}<span>${esc(x.label)}<br><small>${esc(String(x.sub).slice(0, 90))}</small></span>${tag(esc(x.kind))}</div>`).join('') : '<div class="empty">Nothing found.</div>';
  }
  function pickPalette(i) {
    const x = ui.pItems[i];
    if (!x) return;
    $('#palette').classList.remove('on'); $('#scrim').classList.remove('on');
    if (x.go) go(x.go);
    else if (x.open) openFinding(x.open);
    else if (x.term) openTerm(x.term);
    else if (x.kpi) openKpi(x.kpi);
  }

  // ---------------------------------------------------------------- refresh measurements (recalculate from approved records)
  async function runScan() {
    const b = $('#scanBtn');
    if (b.disabled) return;
    b.disabled = true;
    await loadMeasured();
    b.disabled = false;
    rerender();
    if (S.m) { const c = cov(); toast(`Recalculated from ${c.records} approved record${c.records === 1 ? '' : 's'}: ${fmtVal(c.pct)}% of KPIs measured, ${S.m.findings.length} off target.`); }
  }

  // ---------------------------------------------------------------- toasts & animation helpers
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = `toast glass ${kind || ''}`;
    el.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
    el.innerHTML = `${ic(kind === 'bad' ? 'alert' : 'check')}<div>${esc(msg)}</div>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4200);
  }
  function animateCounts(root) {
    $$('[data-count]', root).forEach(el => {
      const end = +el.dataset.count; const f = el.dataset.f; const d = +(el.dataset.d || 0); const suf = el.dataset.s || '';
      const show = v => { el.textContent = f === 'pkr' ? fmt.pkr(v) : fmt.num(v, d) + suf; };
      if (reduced) { show(end); return; }
      const t0 = performance.now(), dur = 1100;
      let done = false;
      (function step(t) { if (done) return; const p = Math.min(1, (t - t0) / dur); show(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); else done = true; })(t0);
      // Background tabs pause requestAnimationFrame: always land on the true value.
      setTimeout(() => { if (!done) { done = true; show(end); } }, dur + 150);
    });
    $$('.ring .val', root).forEach(c => { c.style.strokeDashoffset = c.dataset.off; });
  }

  // ---------------------------------------------------------------- router
  const ROUTES = { command: pageCommand, entry: pageEntry, rca: pageRca, audits: pageAudits, ops: pageOps, planning: pagePlanning, supply: pageSupply, finance: pageFinance, actions: pageActions, lab: pageLab, glossary: pageGlossary, bench: pageBench, data: pageData, alerts: pageAlerts, reports: pageReports, usage: pageUsage };
  function parse() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return ''; } });
    const allowed = new Set(navFor().flatMap(g => g.items.map(([id]) => id)));
    const fallback = allowed.has('command') ? 'command' : 'entry';
    const page = ROUTES[parts[0]] && allowed.has(parts[0]) ? parts[0] : fallback;
    return { page, params: page === parts[0] ? parts.slice(1) : [] };
  }
  function go(h) { if (location.hash === h) rerender(); else location.hash = h; }
  function renderNav(page) {
    const canApprove = userCanApprove();
    const badge = canRead() ? findingsFor().filter(f => { const a = S.actions[f.id]; return a && (canApprove ? a.stage === 'diagnosed' : ['approved', 'in_progress'].includes(a.stage)); }).length : 0;
    const pending = (S.user && S.user.pendingReviews) || 0;
    const badgeFor = id => { const n = id === 'actions' ? badge : id === 'entry' ? pending : id === 'alerts' ? S.alertCounts.high + S.alertCounts.medium : 0; return n ? `<span class="badge" aria-label="${n} need attention">${n}</span>` : ''; };
    $('#nav').innerHTML = navFor().map(g => `<div class="nav-g">${esc(g.g)}</div>${g.items.map(([id, name, icon]) => `<a href="#/${id}" ${id === page ? 'aria-current="page"' : ''} title="${esc(name)}">${ic(icon)}<span>${esc(name)}</span>${badgeFor(id)}</a>`).join('')}`).join('');
  }
  function rerender(scroll) {
    const { page, params } = parse();
    if (!location.hash.replace(/^#\/?/, '').startsWith(page)) history.replaceState(null, '', `#/${page}`); // show where we really are
    const meta = PAGE_META[page];
    renderNav(page);
    $('#title').textContent = meta.name;
    $('#crumb').textContent = `${meta.group} · ${(D.PLANTS.find(p => p.id === S.plant) || {}).short}`;
    document.title = `${meta.name} — Textile AI Audit`;
    const main = $('#main');
    const changed = ui.lastPage !== `${page}/${params.join('/')}`;
    main.innerHTML = `<div class="page">${ROUTES[page](params)}</div>`;
    if (page === 'glossary') glossaryList();
    if (page === 'lab' && params[0]) {
      const card = $(`#calc-${CSS.escape(params[0])}`);
      if (card) { ui.lDom = 'All'; setTimeout(() => { card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); card.classList.add('flash'); $('input', card).focus({ preventScroll: true }); }, 120); }
    }
    if (changed || scroll) { window.scrollTo({ top: 0, behavior: 'auto' }); if (changed && ui.lastPage !== null) main.focus({ preventScroll: true }); }
    ui.lastPage = `${page}/${params.join('/')}`;
    requestAnimationFrame(() => requestAnimationFrame(() => { $('.page', main).classList.add('ready'); animateCounts(main); }));
  }

  // ---------------------------------------------------------------- controls & events
  function initControls() {
    $('#logo').innerHTML = ic('logo');
    $$('[data-ic]').forEach(el => { el.outerHTML = ic(el.dataset.ic); });
    $('#menuBtn').innerHTML = ic('menu');
    $('#searchBtn').innerHTML = `${ic('search')}<span class="lbl">Search everything</span><span class="kbd">Ctrl K</span>`;
    $('#scanBtn').innerHTML = `${ic('reset')}<span>Refresh measurements</span>`;
    $('#scanBtn').title = 'Recalculate every KPI from approved records';
    const setThemeIcon = () => { $('#themeBtn').innerHTML = ic(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun'); };
    setThemeIcon();
    $('#plantSel').innerHTML = D.PLANTS.map(p => `<option value="${p.id}" ${p.id === S.plant ? 'selected' : ''}>${esc(p.short)}</option>`).join('');
    $('#periodSel').innerHTML = PERIODS.map(p => `<option value="${p.id}" ${p.id === S.period ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    $('#plantSel').addEventListener('change', async e => { S.plant = e.target.value; save(); await loadMeasured(); rerender(); toast(`Showing ${(D.PLANTS.find(p => p.id === S.plant) || {}).name}`); });
    $('#periodSel').addEventListener('change', async e => { S.period = e.target.value; save(); await loadMeasured(); rerender(); });
    $('#userBtn').addEventListener('click', openAccount);
    $('#themeBtn').addEventListener('click', () => {
      const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem('ta.theme', t); } catch (e) { /* ignore */ }
      setThemeIcon();
    });
    $('#searchBtn').addEventListener('click', openPalette);
    $('#scanBtn').addEventListener('click', runScan);
    $('#menuBtn').addEventListener('click', e => { e.stopPropagation(); const o = $('#side').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', String(o)); });
    $('#scrim').addEventListener('click', closeOverlays);
    $('#pIn').addEventListener('input', e => renderPalette(e.target.value));
    $('#pIn').addEventListener('keydown', e => {
      const n = ui.pItems.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!n) return;
        ui.pIdx = (ui.pIdx + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        $$('.p-item').forEach((el, i) => { el.classList.toggle('on', i === ui.pIdx); el.setAttribute('aria-selected', String(i === ui.pIdx)); if (i === ui.pIdx) el.scrollIntoView({ block: 'nearest' }); });
      } else if (e.key === 'Enter') { e.preventDefault(); pickPalette(ui.pIdx); }
    });
    $('#pList').addEventListener('click', e => { const it = e.target.closest('[data-pi]'); if (it) pickPalette(+it.dataset.pi); });

    document.addEventListener('click', e => {
      const t = e.target.closest('[data-go],[data-open],[data-term],[data-kpi],[data-adv],[data-reopen],[data-verify],[data-close],[data-gdom],[data-letter],[data-ldom],[data-rec],[data-review],[data-rtab],[data-ack],[data-atab],[data-report],[data-udays],#genReport,#printReport,#ocrBtn,#exportCsv,#verifyChain,#signOut,.nav a');
      if ($('#side').classList.contains('open') && !e.target.closest('#side')) { $('#side').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); if (!t) return; }
      if (!t || t.disabled) return;
      if (t.matches('.nav a')) { $('#side').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); return; }
      if (t.dataset.go !== undefined) { e.preventDefault(); const inDrawer = t.closest('#drawer'); if (inDrawer) closeOverlays(); go(t.dataset.go); return; }
      if (t.dataset.open) { openFinding(t.dataset.open); return; }
      if (t.dataset.rec) { openRecord(Number(t.dataset.rec)); return; }
      if (t.dataset.review) { const [rid, dec] = t.dataset.review.split(':'); reviewRecord(Number(rid), dec); return; }
      if (t.dataset.rtab) {
        ui.recTab = t.dataset.rtab;
        $$('[data-rtab]').forEach(c => { const on = c.dataset.rtab === ui.recTab; c.classList.toggle('on', on); c.setAttribute('aria-selected', String(on)); });
        const box = $('#recBox'); if (box) box.innerHTML = recTable(ui.recTab);
        loadRecords(ui.recTab);
        return;
      }
      if (t.dataset.ack) { ackAlert(Number(t.dataset.ack)); return; }
      if (t.dataset.atab) { ui.alertTab = t.dataset.atab; ui.alerts = undefined; rerender(); return; }
      if (t.dataset.report) { openReport(Number(t.dataset.report)); return; }
      if (t.dataset.udays) { ui.usageDays = Number(t.dataset.udays); ui.usage = undefined; rerender(); return; }
      if (t.id === 'genReport') { generateReport(); return; }
      if (t.id === 'printReport') { window.print(); return; }
      if (t.id === 'ocrBtn') { const f = $('#ocrFile'); if (f) f.click(); return; }
      if (t.dataset.term) { openTerm(t.dataset.term); return; }
      if (t.dataset.kpi) { openKpi(t.dataset.kpi); return; }
      if (t.dataset.adv) { advance(t.dataset.adv); return; }
      if (t.dataset.reopen) { reopen(t.dataset.reopen); return; }
      if (t.dataset.verify) { verify(t.dataset.verify, ($('#afterIn') || {}).value); return; }
      if (t.dataset.close !== undefined) { closeOverlays(); return; }
      if (t.dataset.gdom !== undefined) { ui.gDom = t.dataset.gdom; ui.gLetter = ''; $$('[data-gdom]').forEach(c => c.classList.toggle('on', c.dataset.gdom === ui.gDom)); glossaryList(); return; }
      if (t.dataset.letter !== undefined) { ui.gLetter = t.dataset.letter; glossaryList(); return; }
      if (t.dataset.ldom !== undefined) { ui.lDom = t.dataset.ldom; $$('[data-ldom]').forEach(c => c.classList.toggle('on', c.dataset.ldom === ui.lDom)); $('#llist').innerHTML = labList(); return; }
      if (t.id === 'exportCsv') { exportCsv(); return; }
      if (t.id === 'verifyChain') { verifyChain(); return; }
      if (t.id === 'signOut') { signOut(); return; }
    });
    document.addEventListener('input', e => {
      if (e.target.id === 'gq') { ui.gQ = e.target.value; glossaryList(); return; }
      if (e.target.id === 'lq') { ui.lQ = e.target.value; $('#llist').innerHTML = labList(); return; }
      const card = e.target.closest('[data-calc]');
      if (card) updateCalc(card);
      if (e.target.id === 'afterIn' || e.target.id === 'recNote') e.target.removeAttribute('aria-invalid');
      if (e.target.closest && e.target.closest('#entryForm')) { e.target.removeAttribute('aria-invalid'); const m = document.getElementById(`${e.target.id}-err`); if (m) m.hidden = true; }
    });
    document.addEventListener('change', e => {
      if (e.target.id === 'schedSel') { setSchedule(e.target.value); return; }
      if (e.target.id === 'ocrFile') { readPhoto(e.target); return; }
      const d = e.target.dataset && e.target.dataset.d8;
      if (!d) return;
      const [id, k] = d.split(':');
      if (!S.actions[id] || ui.busy) { e.target.checked = !e.target.checked; return; }
      setD8(id, +k, e.target.checked);
    });
    document.addEventListener('submit', e => {
      if (e.target.id === 'pwForm') { e.preventDefault(); submitPassword(e.target); }
      if (e.target.id === 'entryForm') { e.preventDefault(); submitEntry(e.target); }
    });
    document.addEventListener('keydown', e => {
      if (!S.user) return; // signed out: only the login form is active
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); return; }
      if (e.key === 'Escape') { closeOverlays(); return; }
      if (e.key === 'Enter' && e.target.id === 'afterIn') { const b = $('[data-verify]'); if (b) b.click(); return; }
      if (e.key === 'Tab' && $('#drawer').classList.contains('on')) {
        const f = $$('#drawer button:not([disabled]), #drawer input:not([disabled]), #drawer select, #drawer textarea, #drawer a[href]');
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    document.addEventListener('pointermove', e => {
      const c = e.target.closest && e.target.closest('.card');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
    window.addEventListener('hashchange', () => rerender());
  }

  // ---------------------------------------------------------------- sign-in, account and boot
  let controlsReady = false;
  function showLogin(msg) {
    closeOverlays();
    S.user = null;
    $('#userBtn').hidden = true;
    const el = $('#login');
    el.innerHTML = `<form class="login-card glass" id="loginForm" method="post" action="/" novalidate aria-labelledby="loginTitle">
      <div class="brand"><span class="logo">${ic('logo')}</span><div><b>Textile AI Audit</b><small>Root-cause control tower</small></div></div>
      <h2 id="loginTitle">Sign in</h2>
      <p class="muted small">Use the account your administrator created for you. Every change you make is recorded in a tamper-evident audit trail.</p>
      <div class="login-msg" role="alert" ${msg ? '' : 'hidden'}>${esc(msg || '')}</div>
      <label class="f" for="lgUser">Username</label><input id="lgUser" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="64">
      <label class="f" for="lgPass">Password</label><input id="lgPass" name="password" type="password" autocomplete="current-password" required maxlength="256">
      <button class="btn primary" type="submit" id="lgBtn">Sign in ${ic('arrow')}</button>
    </form>`;
    // Bound here, not in initControls: the form exists before the app's global listeners do.
    $('#loginForm').addEventListener('submit', e => { e.preventDefault(); submitLogin(e.currentTarget); });
    el.hidden = false;
    document.body.classList.add('locked');
    setTimeout(() => { const u = $('#lgUser'); if (u) u.focus(); }, 30);
  }
  function loginError(text) {
    const m = $('#loginForm .login-msg');
    m.textContent = text; m.hidden = false;
  }
  async function submitLogin(form) {
    const username = form.username.value.trim(), password = form.password.value;
    if (!username || !password) { loginError('Enter your username and password.'); return; }
    const btn = $('#lgBtn'); btn.disabled = true;
    try {
      await api('/api/login', { method: 'POST', body: { username, password }, quiet401: true });
      form.password.value = '';
      await loadState();
    } catch (e) {
      loginError(e.status === 401 ? 'Wrong username or password.' : e.message);
      form.password.value = ''; form.password.focus();
    } finally { btn.disabled = false; }
  }
  async function loadState() {
    const st = await api('/api/state', { quiet401: true });
    applyState(st);
    // Plant-scoped users see only their own plant (the server refuses other plants' measured data).
    if (S.user.plant !== 'all' && S.plant !== S.user.plant) { S.plant = S.user.plant; save(); }
    ui.recs = {}; ui.recOpen = null; PALETTE = null; // a different user may have signed in
    ui.alerts = undefined; ui.reports = undefined; ui.report = null; ui.usage = undefined;
    await loadMeasured();
    $('#login').hidden = true; $('#login').innerHTML = '';
    document.body.classList.remove('locked');
    if (!controlsReady) { initControls(); controlsReady = true; }
    $('#plantSel').innerHTML = D.PLANTS.filter(p => S.user.plant === 'all' || p.id === S.user.plant).map(p => `<option value="${esc(p.id)}">${esc(p.short)}</option>`).join('');
    $('#plantSel').disabled = S.user.plant !== 'all';
    $('#plantSel').value = S.plant;
    $('#scanBtn').hidden = !canRead();
    $('#plantSel').closest('label').hidden = !canRead();
    $('#periodSel').closest('label').hidden = !canRead();
    renderUserBtn();
    rerender(true);
    const hc = S.alertCounts.high;
    if (canRead() && hc) toast(`${hc} high-priority alert${hc === 1 ? ' is' : 's are'} open. See Alerts.`, 'bad');
  }
  function renderUserBtn() {
    const b = $('#userBtn');
    b.innerHTML = `${ic('user')}<span class="lbl"><b>${esc(S.user.displayName)}</b><small>${esc(roleName(S.user.role))} · ${esc(S.user.plant === 'all' ? 'All plants' : plantShort(S.user.plant))}</small></span>`;
    b.setAttribute('aria-label', `Account: ${S.user.displayName}`);
    b.hidden = false;
  }
  function openAccount() {
    if (!S.user) return;
    const u = S.user;
    const scope = u.plant === 'all' ? 'in every plant' : `in ${esc(plantShort(u.plant))} only`;
    const dept = u.department && D.SECTIONS[u.department] ? D.SECTIONS[u.department].name : null;
    const nf = (u.forms || []).length, nr = (u.reviewForms || []).length;
    const lines = [];
    if (nf) lines.push(`Enter records on ${nf} form${nf === 1 ? '' : 's'}${dept ? ` for ${esc(dept)}` : ''} ${scope}.`);
    if (nr) lines.push(`Approve or reject other people's records on those forms ${scope}.`);
    if (VIEW_ROLES.includes(u.role)) lines.push(`Move corrective actions ${scope}${userCanApprove() ? ', including approvals' : ' (approval needs the CEO, Plant Head or Finance)'}.`);
    else if (u.canReadDashboards) lines.push('View dashboards. This account type cannot change corrective actions.');
    const can = lines.join(' ') || 'This account cannot enter records or read dashboards.';
    openDrawer(`<h3 id="drawerTitle">${esc(u.displayName)}</h3><p class="lede">${esc(u.username)} · ${esc(roleName(u.role))}${dept ? ` · ${esc(dept)}` : ''} · ${esc(u.plant === 'all' ? 'All plants' : plantShort(u.plant))}</p>
      <div class="blk"><b>What you can do</b><p class="small">${can}</p></div>
      <form class="blk" id="pwForm" novalidate><b>Change password</b>
        <label class="f" for="pwOld">Current password</label><input id="pwOld" name="current" type="password" autocomplete="current-password" required maxlength="256">
        <label class="f" for="pwNew">New password (at least 12 characters)</label><input id="pwNew" name="next" type="password" autocomplete="new-password" required minlength="12" maxlength="256">
        <div class="chips mt"><button class="btn primary" type="submit">Update password</button></div>
        <p class="small muted">Changing it signs you out on every other device.</p>
      </form>
      <div class="blk"><button class="btn" id="signOut">${ic('arrow')} Sign out</button></div>`, null);
  }
  async function submitPassword(form) {
    const current = form.current.value, next = form.next.value;
    if (next.length < 12) { toast('The new password needs at least 12 characters.', 'bad'); form.next.focus(); return; }
    try {
      await api('/api/me/password', { method: 'POST', body: { current, next }, quiet401: true });
      form.reset(); toast('Password updated. Other sessions were signed out.');
    } catch (e) { toast(e.message, 'bad'); }
  }
  async function signOut() {
    try { await api('/api/logout', { method: 'POST', quiet401: true }); } catch (e) { /* already signed out */ }
    showLogin('You have signed out.');
  }
  // The app never uses query strings; drop any (e.g. from an old native form submit) so nothing sensitive stays in history.
  if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  (async function boot() {
    try { await loadState(); } catch (e) { showLogin(e.status === 401 ? '' : e.message); }
  })();
  window.__TA_APP__ = { state: S, go, rerender }; // exposed for E2E checks only
})();
