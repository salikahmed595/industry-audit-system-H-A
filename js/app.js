/* Textile AI Audit — UI layer (router, pages, drawer, palette, workflow). */
(function () {
  'use strict';
  const { F, REG, RCA, fmt, util } = window.TA;
  const D = window.TD;
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
  };
  const ic = (n, cls) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${I[n] || ''}</svg>`;
  const STAGE_IC = { fiber: 'fiber', spinning: 'spin', weaving: 'loom', knitting: 'loom', dyeing: 'drop', finishing: 'roll', cutting: 'cut', sewing: 'needle', packing: 'box', cash: 'cash' };
  const SEC_IC = { spin: 'spin', loom: 'loom', drop: 'drop', cut: 'cut', needle: 'needle', shield: 'shield', wrench: 'wrench', calendar: 'calendar', box: 'box', truck: 'truck', cash: 'cash', clock: 'clock' };

  // ---------------------------------------------------------------- navigation model
  const NAV = [
    { g: 'Start', items: [['command', 'Command Center', 'home']] },
    { g: 'Diagnose', items: [['rca', 'Root-Cause Explorer', 'tree'], ['audits', 'Audit Programs', 'clip']] },
    { g: 'Operations', items: [['ops', 'Production Floor', 'factory'], ['planning', 'Planning & Capacity', 'calendar']] },
    { g: 'Supply & Cash', items: [['supply', 'Inventory & Procurement', 'box'], ['finance', 'Finance & Cash', 'cash']] },
    { g: 'Act', items: [['actions', 'Action Center', 'check']] },
    { g: 'Learn & Setup', items: [['lab', 'Formula Lab', 'calc'], ['glossary', 'Glossary', 'book'], ['bench', 'Benchmarks', 'target'], ['data', 'Data & Governance', 'db']] },
  ];
  const PAGE_META = {};
  NAV.forEach(g => g.items.forEach(([id, name, icon]) => { PAGE_META[id] = { name, icon, group: g.g }; }));

  const PERIODS = [
    { id: 'm', name: 'This month (Nov 2026)', k: 1, per: 'per month' },
    { id: 'q', name: 'Last 3 months', k: 3, per: 'over 3 months' },
    { id: 'y', name: 'Year to date', k: 11, per: 'year to date' },
  ];
  const STAGE_NAME = { detected: 'Detected', diagnosed: 'Diagnosed', approved: 'Approved', in_progress: 'In progress', verified: 'Verified' };
  const STAGE_DESC = { detected: 'AI flagged, needs a cause', diagnosed: 'Root cause found, awaiting approval', approved: 'Approved, ready to start', in_progress: 'Fix being implemented', verified: 'Result measured' };
  const ADV_LABEL = { detected: 'Mark diagnosed', diagnosed: 'Approve', approved: 'Start work', in_progress: 'Verify result' };
  const D8 = ['D1 Team formed', 'D2 Problem defined', 'D3 Containment in place', 'D4 Root cause verified', 'D5 Corrective action chosen', 'D6 Action implemented', 'D7 Recurrence prevented', 'D8 Closed & recognised'];
  const D8_BY_STAGE = { detected: 1, diagnosed: 4, approved: 5, in_progress: 6, verified: 8 };
  const ST_WORD = { good: 'On target', warn: 'Near target', bad: 'Off target', unknown: 'No data' };

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
  const S = { ...loadPrefs(), role: 'ceo', user: null, actions: {}, log: [], lastScan: null };
  const LIVE = {}; // 'section|kpi' -> { value, asOf, source } from the KPI feed
  const ui = { gQ: '', gDom: 'All', gLetter: '', lQ: '', lDom: 'All', aFilter: 'all', lastPage: null, pIdx: 0, pItems: [], drawerFor: null, lastFocus: null, busy: false };
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
      if (row && Number.isFinite(k.value)) { row[1] = k.value; LIVE[`${k.section}|${k.kpi}`] = k; }
    });
  }
  function applyState(st) {
    S.user = st.user;
    S.role = VIEW_ROLES.includes(st.user.role) ? st.user.role : 'ceo';
    S.actions = st.actions || {};
    S.log = Array.isArray(st.log) ? st.log : [];
    applyKpis(st.kpis);
  }
  function applyAction(res) {
    if (res && res.action) S.actions[res.action.id] = res.action;
    if (res && Array.isArray(res.log)) S.log = res.log;
  }

  // ---------------------------------------------------------------- derived data
  const per = () => PERIODS.find(p => p.id === S.period);
  const money = n => fmt.pkr(n * per().k);
  const roleName = id => (D.ROLES.find(r => r.id === id) || {}).name || id;
  const plantShort = id => (D.PLANTS.find(p => p.id === id) || {}).short || id;
  const findingsFor = () => (S.plant === 'all' ? D.FINDINGS : D.FINDINGS.filter(f => f.plant === S.plant));
  const effPkr = f => f.pkr + (f.cash || 0) * D.FINANCING_RATE / 12;
  const scoreOf = f => RCA.score({ pkr: effPkr(f), customer: f.customer, effort: f.effort, risk: f.risk, confidence: f.conf });
  const ranked = list => list.map(f => ({ f, s: scoreOf(f) })).sort((a, b) => b.s - a.s).map(x => x.f);
  const totals = list => list.reduce((t, f) => ({ leak: t.leak + f.pkr, rec: t.rec + f.pkr * f.rec, cash: t.cash + (f.cash || 0) }), { leak: 0, rec: 0, cash: 0 });
  const findingById = id => D.FINDINGS.find(f => f.id === id);
  const kStatus = k => RCA.status(k[1], k[3], k[4]);
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
    sectionsForPlant().forEach(([, s]) => s.kpis.forEach(k => st.push(kStatus(k))));
    return RCA.health(st);
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
    const st = kStatus(k);
    const [name, v, u, t, dir, bm] = k;
    const prog = dir === 'up' ? Math.min(100, v / t * 100) : Math.min(100, v > 0 ? t / v * 100 : 100);
    const gap = dir === 'up' ? t - v : v - t;
    return `<button class="card kpi lift rise ${st}" style="--i:${i}" data-kpi="${secId}:${idx}" aria-label="${esc(name)}: ${esc(fmtVal(v))} ${esc(u)}, target ${esc(fmtVal(t))}. Open details">
      <span class="k-name">${esc(name)}${stTag(st)}</span>
      <span class="k-val">${withUnit(v, u)}</span>
      <span class="k-sub"><span>Target ${esc(fmtVal(t))}${u === '%' ? '%' : ''}</span><span>${st === 'good' ? 'On target' : `Gap ${esc(fmtVal(Math.abs(gap)))}`}</span></span>
      <span class="meter ${st}"><i style="--w:${prog.toFixed(1)}%"></i></span>
      <span class="k-bm">${liveNote(secId, name)}${esc(bm)}</span></button>`;
  }
  function liveNote(secId, name) {
    const live = LIVE[`${secId}|${name}`];
    return live ? `<span class="live">● Live from ${esc(live.source)} · ${esc(new Date(live.asOf).toLocaleDateString())}</span>` : '<span class="demo">Demo value · </span>';
  }

  function findingCard(f, i) {
    const a = S.actions[f.id];
    const amt = f.cash ? `<b>${fmt.pkr(f.cash)}</b><span>cash to release</span>` : `<b>${money(f.pkr)}</b><span>${per().per}</span>`;
    return `<article class="card fd rise" style="--i:${i}">
      <div class="fd-top"><div>
        <div class="chips" style="margin-bottom:6px">${tag(esc(plantShort(f.plant)))}${tag(esc(D.SECTIONS[f.sec].name))}${tag(esc(f.m6), 'acc')}${stageTag(a.stage)}</div>
        <h4>${esc(f.title)}</h4><div class="where">${esc(f.where)}</div></div>
        <div class="money">${amt}</div></div>
      <div class="wsd"><div><b>Why</b>${esc(f.why)}</div><div><b>So what</b>${esc(f.sowhat)}</div><div class="do"><b>Do what</b>${esc(f.dowhat)}</div></div>
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
    const months = D.MONTHS.map((m, i) => (i % 2 === 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle">${m}</text>` : '')).join('');
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
    const col = v >= 70 ? 'var(--good)' : v >= 45 ? 'var(--warn)' : 'var(--bad)';
    return `<div class="ring" role="img" aria-label="${esc(label)} ${v} out of 100"><svg viewBox="0 0 132 132"><circle class="trk" cx="66" cy="66" r="${r}" fill="none" stroke-width="11"/>
      <circle class="val" cx="66" cy="66" r="${r}" fill="none" stroke="${col}" stroke-width="11" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C * (1 - v / 100)).toFixed(1)}"/></svg>
      <div class="lbl"><div><b>${countNum(v)}</b><span>${esc(label)}</span></div></div></div>`;
  }

  // ---------------------------------------------------------------- page: Command Center
  function pageCommand() {
    const list = findingsFor();
    const t = totals(list);
    const top = ranked(list);
    const health = healthScore();
    const acts = list.map(f => S.actions[f.id]);
    const waitingApproval = list.filter(f => S.actions[f.id].stage === 'diagnosed');
    const execution = list.filter(f => ['approved', 'in_progress'].includes(S.actions[f.id].stage));
    const canApprove = userCanApprove();
    const constraint = D.STREAM.find(s => s.constraint);
    const role = D.ROLES.find(r => r.id === S.role);
    const heroLine = {
      ceo: `<em>${money(t.leak)}</em> is leaking ${per().per}, and <em>${fmt.pkr(t.cash)}</em> of cash is locked up. One stage limits the whole group: the <em>dye house</em>.`,
      plant: `The dye house is loaded to <em>${constraint.load}%</em> of capacity. Every hour lost there costs <em>${fmt.pkr(D.CONSTRAINT_COST_PER_HOUR)}</em> for the whole plant. Fix the constraint first.`,
      dept: `<em>${execution.length} actions</em> are approved and waiting for your team, worth <em>${money(execution.reduce((s, f) => s + f.pkr, 0))}</em> ${per().per}.`,
      finance: `Cost of poor quality is <em>9.8% of sales</em>, the cash cycle is <em>118 days</em>, and <em>${fmt.pkr(t.cash)}</em> of cash can be released.`,
    }[S.role];
    const byStage = RCA.STAGES.map(st => acts.filter(a => a.stage === st).length);

    const stream = D.STREAM.map((s, i) => {
      const dim = S.plant !== 'all' && s.plant !== S.plant;
      const link = i < D.STREAM.length - 1 ? `<span class="st-link ${D.STREAM[i + 1].constraint || s.constraint ? 'slow' : ''}" aria-hidden="true"></span>` : '';
      return `<button class="st-node ${s.st} ${s.constraint ? 'constraint' : ''} ${dim ? 'dim' : ''}" data-go="${secRoute(s.section)}" aria-label="${esc(s.name)}: ${esc(s.kpi)}${s.load ? `, load ${s.load}%` : ''}${s.constraint ? ', constraint' : ''}">
        ${s.constraint ? '<span class="flag">CONSTRAINT</span>' : ''}
        <span class="ic">${ic(STAGE_IC[s.id])}</span><b>${esc(s.name)}</b><span class="k">${esc(s.kpi)}</span>
        ${s.load ? `<span class="ld"><span>Load</span><span>${s.load}%</span></span><span class="meter ${s.load > 100 ? 'bad' : s.load > 88 ? 'warn' : 'good'}"><i style="--w:${Math.min(100, s.load)}%"></i></span>` : `<span class="ld"><span>Cash cycle</span><span>118 d</span></span><span class="meter bad"><i style="--w:100%"></i></span>`}
      </button>${link}`;
    }).join('');

    const bySec = {};
    list.forEach(f => { bySec[f.sec] = (bySec[f.sec] || 0) + f.pkr; });
    const secItems = Object.entries(bySec).sort((a, b) => b[1] - a[1]).map(([k, v]) => [D.SECTIONS[k].name, Math.round(v / 1e5) / 10 * per().k]);
    const by6m = {};
    list.forEach(f => { by6m[f.m6] = (by6m[f.m6] || 0) + f.pkr; });

    return `
    <section class="card hero rise glass" style="--i:0">
      <div>
        <div class="eyebrow"><span class="pulse"></span>Signed in as ${esc(S.user.displayName)} · ${esc(roleName(S.user.role))}${S.user.plant !== 'all' ? ' · ' + esc(plantShort(S.user.plant)) : ''}</div>
        <h2>${heroLine}</h2>
        <p>${esc(role.focus)} The scan found <b>${list.length} finding${list.length === 1 ? '' : 's'}</b> across ${esc(S.plant === 'all' ? 'the group' : plantShort(S.plant))}. They are ranked by money, customer impact, effort, risk and confidence, and each has a root cause, an owner and a fix.</p>
        <div class="cta">
          ${top[0] ? `<button class="btn primary" data-open="${top[0].id}">${ic('bolt')} Start with #1: ${esc(top[0].title.length > 52 ? top[0].title.slice(0, 50) + '…' : top[0].title)}</button>` : ''}
          <button class="btn" data-go="#/rca/otif">${ic('tree')} Trace why orders are late</button>
          ${canApprove && waitingApproval.length ? `<button class="btn" data-go="#/actions/approve">${ic('check')} ${waitingApproval.length} waiting for your approval</button>` : ''}
          ${S.role === 'dept' ? `<button class="btn" data-go="#/actions/progress">${ic('check')} Open my work queue</button>` : ''}
        </div>
      </div>
      ${ring(health, 'Plant health')}
    </section>

    <div class="grid g6 mt">
      <div class="card stat rise bad" style="--i:1"><span class="big-ic">${ic('alert')}</span><span class="k-name">Margin leakage</span><span class="k-val">${countPkr(t.leak * per().k)}</span><span class="k-sub">${per().per}</span></div>
      <div class="card stat rise good" style="--i:2"><span class="big-ic">${ic('spark')}</span><span class="k-name">Recoverable</span><span class="k-val">${countPkr(t.rec * per().k)}</span><span class="k-sub">${t.leak ? Math.round(t.rec / t.leak * 100) : 0}% of leakage</span></div>
      <div class="card stat rise" style="--i:3"><span class="big-ic">${ic('cash')}</span><span class="k-name">Cash to release</span><span class="k-val">${countPkr(t.cash)}</span><span class="k-sub">refunds, stock, receivables</span></div>
      <div class="card stat rise" style="--i:4"><span class="big-ic">${ic('factory')}</span><span class="k-name">OEE (plant)</span><span class="k-val">${countNum(61, 0, '%')}</span><span class="k-sub">target 75% · world-class 85%</span></div>
      <div class="card stat rise" style="--i:5"><span class="big-ic">${ic('truck')}</span><span class="k-name">OTIF delivery</span><span class="k-val">${countNum(78, 0, '%')}</span><span class="k-sub">target 92%</span></div>
      <div class="card stat rise" style="--i:6"><span class="big-ic">${ic('check')}</span><span class="k-name">Fixes verified</span><span class="k-val">${countNum(byStage[4])}<small>/ ${list.length}</small></span><span class="k-sub">${byStage[3]} in progress</span></div>
    </div>

    <div class="card mt rise" style="--i:7">
      <h3>${ic('flow')}Value stream: fiber to cash <span class="sub">Click any stage to drill down</span></h3>
      <div class="stream">${stream}</div>
      <div class="callout">${ic('alert')}<div><b>Dyeing is the constraint (${constraint.load}% load).</b> The plant can only ship what the dye house finishes. Re-dyes, jet breakdowns and long colour changeovers take ${'151'} hours a month from this stage. Raising output anywhere else only builds more WIP.</div><button class="btn sm" data-go="#/rca/otif">See the causal chain ${ic('arrow')}</button></div>
    </div>

    <div class="grid g-wide mt">
      <div class="card rise" style="--i:8"><h3>${ic('bolt')}Do these next <span class="sub">Ranked by priority score</span></h3>
        <div class="rows">${top.slice(0, 6).map((f, i) => `<button class="next" data-open="${f.id}"><span class="rk">${i + 1}</span><span><span class="t">${esc(f.title)}</span><span class="s">${esc(f.who)} · ${esc(plantShort(f.plant))} · ${STAGE_NAME[S.actions[f.id].stage]}</span></span><span class="r"><b>${f.cash ? fmt.pkr(f.cash) : money(f.pkr)}</b><span>${f.cash ? 'cash' : per().per} · score ${scoreOf(f)}</span></span></button>`).join('')}</div>
        <div class="mt"><button class="btn sm" data-go="#/actions">Open Action Center ${ic('arrow')}</button></div>
      </div>
      <div class="card rise" style="--i:9"><h3>${ic('target')}Where the money leaks <span class="sub">PKR M ${esc(per().per)}</span></h3>
        ${chartPareto({ items: secItems })}
        <div class="sec-t" style="margin:16px 0 8px">By root-cause type (6M)</div>
        <div class="chips">${Object.entries(by6m).sort((a, b) => b[1] - a[1]).map(([k, v]) => tag(`${esc(k)} · ${money(v)}`, 'acc')).join('')}</div>
      </div>
    </div>

    <div class="card mt rise" style="--i:10"><h3>${ic('check')}The audit loop: detect → diagnose → approve → execute → verify <span class="sub">Human approval at every gate</span></h3>
      <div class="loop">${RCA.STAGES.map((st, i) => `<button class="loop-st" data-go="#/actions"><span class="n">${i + 1}</span><b>${byStage[i]}</b><span>${STAGE_NAME[st]}</span></button>`).join('')}</div>
    </div>

    <div class="grid g3 mt">
      ${[['Right-first-time dyeing', '76%', '95–98%', '65–80%'], ['Sewing line efficiency', '52%', '70–80%', '45–60%'], ['OEE', '61%', '85%', '55–70%']].map((b, i) => `
      <div class="card lift rise" style="--i:${11 + i}"><h3>${ic('target')}${esc(b[0])}</h3>
        <div class="k-val">${esc(b[1])}<small>ours</small></div>
        <div class="k-sub mt"><span>World-class <b>${esc(b[2])}</b></span><span>Typical South Asia <b>${esc(b[3])}</b></span></div>
        <div class="mt"><button class="btn sm ghost" data-go="#/bench">All benchmarks ${ic('arrow')}</button></div></div>`).join('')}
    </div>
    <p class="note-foot">All plant figures are dummy data for the prototype. Benchmarks and "proven fix" results come from public research and are labelled by confidence on the Benchmarks page.</p>`;
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
      body = `<div class="grid g-auto">${kpis}</div><div class="grid g2 mt">${charts}</div>${secT('Top findings')}${tb}<p class="note-foot">Red bars and cards mark values outside target. Dummy data for the prototype.</p>`;
    }
    return `${pageHead('Audit Programs', esc(a.lead), seg)}<div class="tabs">${tabs}</div>${body}`;
  }

  // ---------------------------------------------------------------- section pages
  function renderSection(id, i0 = 0) {
    const s = D.SECTIONS[id];
    const bad = s.kpis.filter(k => kStatus(k) === 'bad').length;
    const fs = ranked(findingsFor().filter(f => f.sec === id));
    const kp = s.kpis.map((k, i) => kpiTile(k, i + i0, id, i)).join('');
    const tbl = `<div class="card tw rise"><h3>${ic('factory')}${esc(s.table.title)}</h3><table><thead><tr><th></th>${s.table.h.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((r, i) => `<tr><td><span class="dot ${s.table.st[i]}" title="${ST_WORD[s.table.st[i]]}"></span></td>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return `${pageHead(esc(s.name), esc(s.intro), s.plants.map(p => tag(esc(plantShort(p)))).join(''))}
      ${hint(`<b>${bad} of ${s.kpis.length} KPIs are off target.</b> Start with the red tiles; click any tile to see its formula, benchmark and the findings behind it. The findings below give the cause, the money, the owner and the fix, ranked by priority.`)}
      <div class="grid g-auto">${kp}</div>
      <div class="grid g2 mt">${s.charts.map(chart).join('')}</div>
      ${secT(`AI findings · ${fs.length}`)}
      ${fs.length ? `<div class="grid g2">${fs.map((f, i) => findingCard(f, i)).join('')}</div>` : `<div class="card empty">No findings for ${esc(plantShort(S.plant))} in this area. Switch the plant filter to "Whole group" to see all.</div>`}
      ${secT('Detail')}${tbl}
      ${secT('Key terms used here')}
      <div class="chips">${s.terms.map(t => `<button class="chip" data-term="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  }
  function worstStatus(id) {
    const st = D.SECTIONS[id].kpis.map(kStatus);
    return st.includes('bad') ? 'bad' : st.includes('warn') ? 'warn' : 'good';
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
    const rows = D.BENCHMARKS.map(b => `<tr><td><b>${esc(b[0])}</b></td><td>${tag(`${esc(fmtVal(b[1]))} ${esc(b[2])}`, 'bad')}</td><td>${esc(b[3])}</td><td>${esc(b[4])}</td><td>${tag(conf[b[5]][0], conf[b[5]][1])}</td><td class="wrap">${esc(b[6])}</td></tr>`).join('');
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
      <div class="card tw rise"><table><thead><tr><th>Metric</th><th>Ours (dummy)</th><th>World-class</th><th>Typical South Asia</th><th>Confidence</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${secT('Proven fixes behind the recommendations')}
      <div class="grid g-auto-l">${fixes.map((x, i) => `<div class="card lift rise" style="--i:${i}"><h3>${ic('spark')}${esc(x[0])}</h3><div class="chips" style="margin-bottom:8px">${tag(conf[x[3]][0], conf[x[3]][1])}${tag(esc(x[1]))}</div><p class="muted small" style="margin:0 0 12px">${esc(x[2])}</p><button class="btn sm" data-open="${x[4]}">See the matching finding ${ic('arrow')}</button></div>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- page: Data & Governance
  function pageData() {
    const avg = Math.round(D.DATA_GROUPS.reduce((s, g) => s + g.complete, 0) / D.DATA_GROUPS.length);
    const cnt = st => D.DATA_GROUPS.filter(g => g.status === st).length;
    const steps = [['Gather', 'Read-only connectors'], ['Reconcile', 'Link order, lot, batch'], ['Audit', 'Modules in parallel'], ['Measure', 'Glossary formulas'], ['Decide', 'Threshold & SPC rules'], ['Quantify', 'PKR & priority score'], ['Recommend', 'Root cause + owner'], ['Report', 'Brief + audit trail']];
    return `${pageHead('Data & Governance', 'The AI audit is only as good as its data. These are the data fields the glossary says to prioritise first, where each comes from, and how complete it is today.')}
      <div class="grid g-wide">
        <div class="card hero glass rise" style="grid-template-columns:auto 1fr">${ring(avg, 'Data readiness')}<div>
          <div class="eyebrow">Data confidence</div><h2 style="font-size:21px">Data is <em>${avg}% complete</em> across the 8 priority groups.</h2>
          <p>Findings that rest on manual or missing data carry lower confidence scores, and the system says so. Close the gaps marked in red to raise confidence in the money figures.</p>
          <div class="chips mt">${tag(`${cnt('connected')} connected`, 'good')}${tag(`${cnt('partial')} partial`, 'warn')}${tag(`${cnt('manual')} manual`, 'bad')}${tag(`${cnt('missing')} missing`, 'bad')}</div></div></div>
        <div class="card rise" style="--i:1"><h3>${ic('shield')}AI governance built in</h3><ul class="gov" style="margin:0;padding-left:18px">
          <li><b>Human in the loop:</b> no fix starts without approval by an approver role.</li>
          <li><b>Evidence first:</b> every finding shows why, so what, do what and who, with a confidence score.</li>
          <li><b>Read-only connectors:</b> the audit never writes to the ERP or MES.</li>
          <li><b>Effectiveness check:</b> an action closes only on a measured result. If the target is missed, it reopens.</li>
          <li><b>Audit trail:</b> every approval, start, verification and reopening is logged with role and time.</li>
          <li><b>Honest labels:</b> benchmarks are marked verified, vendor-reported or practitioner norm.</li></ul></div>
      </div>
      ${secT('How the audit runs (every month)')}
      <div class="pipe">${steps.map((s, i) => `<div style="--i:${i}"><span class="no">${i + 1}</span><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join('')}</div>
      ${secT('Priority data fields')}
      <div class="grid g-auto-l">${D.DATA_GROUPS.map((g, i) => `<div class="card lift rise" style="--i:${i}">
        <h3>${ic('db')}${esc(g.name)}<span class="sub"><span class="ds-st ${g.status}">${esc(g.status)}</span></span></h3>
        <div class="fieldchips">${g.fields.map(x => `<span>${esc(x)}</span>`).join('')}</div>
        <div class="k-sub mt"><span>Completeness</span><span><b>${g.complete}%</b></span></div>
        <div class="meter ${g.complete >= 85 ? 'good' : g.complete >= 60 ? 'warn' : 'bad'}"><i style="--w:${g.complete}%"></i></div>
        <div class="k-sub mt"><span>Source: ${esc(g.src)}</span><span>Refresh: ${esc(g.fresh)}</span></div>
        <p class="small muted" style="margin:10px 0 0"><b style="color:var(--text)">Gap:</b> ${esc(g.gap)}</p></div>`).join('')}</div>`;
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
      <div class="blk"><b>Measure of success</b><div class="kv"><div><span>Baseline</span><b>${esc(fmtVal(f.kpi.base))}${esc(u)}</b></div><div><span>Target</span><b>${esc(fmtVal(f.kpi.target))}${esc(u)}</b></div><div><span>After fix</span><b>${a.after === null ? '—' : esc(fmtVal(a.after)) + esc(u)}</b></div></div></div>
      <div class="blk"><div class="wsd"><div><b>Why (evidence)</b>${esc(f.why)}</div><div><b>So what</b>${esc(f.sowhat)}</div><div class="do"><b>Do what</b>${esc(f.dowhat)}</div><div><b>Who owns it</b>${esc(f.who)}</div><div><b>Confidence</b>${Math.round(f.conf * 100)}%. Based on linked ERP/MES/QC records (simulated in this prototype).</div></div></div>
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
      ${kpis.length ? `<div class="blk"><b>Tracked live as</b><div class="rows">${kpis.map(([sid, i, k]) => `<button class="next" data-kpi="${sid}:${i}"><span class="rk">${ic('target')}</span><span><span class="t">${esc(k[0])}</span><span class="s">${esc(D.SECTIONS[sid].name)} · target ${esc(fmtVal(k[3]))}</span></span><span class="r"><b style="color:var(--${kStatus(k) === 'good' ? 'good' : kStatus(k) === 'warn' ? 'warn' : 'bad'})">${esc(fmtVal(k[1]))} ${esc(k[2])}</b></span></button>`).join('')}</div></div>` : ''}
      <div class="blk"><button class="btn sm" data-go="${secRoute(g.sec)}">${ic('arrow')} Where it's tracked: ${esc(D.SECTIONS[g.sec].name)}</button></div>`, 'term');
  }
  function openKpi(key) {
    const [sid, idx] = key.split(':');
    const s = D.SECTIONS[sid]; const k = s && s.kpis[+idx];
    if (!k) return;
    const st = kStatus(k);
    const g = D.GLOSSARY.find(x => x.term === k[6]);
    const fs = ranked(D.FINDINGS.filter(f => f.sec === sid)).slice(0, 3);
    openDrawer(`<div class="chips">${tag(esc(s.name), 'acc')}${stTag(st)}</div><h3 id="drawerTitle">${esc(k[0])}</h3>
      <div class="kv"><div><span>Actual</span><b>${esc(fmtVal(k[1]))} ${esc(k[2])}</b></div><div><span>Target</span><b>${esc(fmtVal(k[3]))} ${esc(k[2])}</b></div><div><span>Direction</span><b>${k[4] === 'up' ? 'Higher is better' : 'Lower is better'}</b></div></div>
      <div class="blk"><b>Benchmark</b><p class="muted" style="margin:0">${esc(k[5])}</p></div>
      ${g ? `<div class="blk"><b>What it means · ${esc(g.term)}</b><div class="wsd"><div><b>Definition</b>${esc(g.def)}</div><div><b>Why it matters</b>${esc(g.why)}</div></div></div>` : ''}
      ${termCalc(k[7])}
      ${fs.length ? `<div class="blk"><b>Findings behind this area</b><div class="rows">${fs.map((f, i) => `<button class="next" data-open="${f.id}"><span class="rk">${i + 1}</span><span><span class="t">${esc(f.title)}</span><span class="s">${esc(f.who)}</span></span><span class="r"><b>${f.cash ? fmt.pkr(f.cash) : money(f.pkr)}</b></span></button>`).join('')}</div></div>` : ''}`, 'kpi');
  }

  // ---------------------------------------------------------------- command palette
  function paletteItems() {
    const items = [];
    NAV.forEach(g => g.items.forEach(([id, name, icon]) => items.push({ label: name, sub: g.g, kind: 'Page', icon, go: `#/${id}` })));
    Object.entries(D.SECTIONS).forEach(([id, s]) => items.push({ label: s.name, sub: s.intro, kind: 'Area', icon: SEC_IC[s.icon] || 'factory', go: secRoute(id) }));
    D.SYMPTOMS.forEach(s => items.push({ label: `Why: ${G[s].label}`, sub: G[s].metric, kind: 'Root cause', icon: 'tree', go: `#/rca/${s}` }));
    D.FINDINGS.forEach(f => items.push({ label: f.title, sub: `${f.who} · ${f.where}`, kind: 'Finding', icon: 'alert', open: f.id }));
    Object.entries(D.SECTIONS).forEach(([sid, s]) => s.kpis.forEach((k, i) => items.push({ label: k[0], sub: `${s.name} KPI · ${fmtVal(k[1])} ${k[2]}`, kind: 'KPI', icon: 'target', kpi: `${sid}:${i}` })));
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
    const res = q.trim() ? util.search(q, PALETTE, x => x.label, x => `${x.sub} ${x.kind}`).slice(0, 14) : PALETTE.filter(x => x.kind === 'Page' || x.kind === 'Root cause').slice(0, 14);
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

  // ---------------------------------------------------------------- scan simulation
  function runScan() {
    const steps = ['Gathering data from ERP, MES, QC, WMS and finance', 'Ingesting, cleaning and reconciling lots and orders', 'Running audit modules in parallel', 'Computing tracked metrics from glossary formulas', 'Checking thresholds and control limits', 'Quantifying leakage in PKR and ranking priorities', 'Tracing root causes and drafting recommendations', 'Writing the audit report and trail'];
    const m = $('#modal');
    ui.lastFocus = document.activeElement;
    m.innerHTML = `<h3 id="modalTitle">${ic('spark')} Running AI audit scan</h3><p class="muted small" style="margin:0">Simulation on prototype dummy data.</p><div class="scan-steps">${steps.map(s => `<div><i></i>${esc(s)}</div>`).join('')}</div><div class="progress"><i></i></div>`;
    m.classList.add('on'); $('#scrim').classList.add('on');
    const rows = $$('.scan-steps div', m); const bar = $('.progress i', m);
    let i = 0; const dt = reduced ? 30 : 380;
    (function tick() {
      if (i > 0) { rows[i - 1].classList.remove('run'); rows[i - 1].classList.add('done'); rows[i - 1].querySelector('i').textContent = '✓'; }
      bar.style.width = `${(i / steps.length) * 100}%`;
      if (i === steps.length) {
        setTimeout(() => {
          m.classList.remove('on'); $('#scrim').classList.remove('on');
          S.lastScan = new Date().toISOString();
          const t = totals(findingsFor());
          toast(`Scan complete: ${findingsFor().length} findings, ${money(t.leak)} ${per().per} leakage and ${fmt.pkr(t.cash)} cash to release, ranked by priority.`);
          rerender(true);
        }, reduced ? 10 : 350);
        return;
      }
      rows[i].classList.add('run'); i++; setTimeout(tick, dt);
    })();
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
  const ROUTES = { command: pageCommand, rca: pageRca, audits: pageAudits, ops: pageOps, planning: pagePlanning, supply: pageSupply, finance: pageFinance, actions: pageActions, lab: pageLab, glossary: pageGlossary, bench: pageBench, data: pageData };
  function parse() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return ''; } });
    const page = ROUTES[parts[0]] ? parts[0] : 'command';
    return { page, params: parts.slice(1) };
  }
  function go(h) { if (location.hash === h) rerender(); else location.hash = h; }
  function renderNav(page) {
    const list = findingsFor();
    const canApprove = userCanApprove();
    const badge = list.filter(f => canApprove ? S.actions[f.id].stage === 'diagnosed' : ['approved', 'in_progress'].includes(S.actions[f.id].stage)).length;
    $('#nav').innerHTML = NAV.map(g => `<div class="nav-g">${esc(g.g)}</div>${g.items.map(([id, name, icon]) => `<a href="#/${id}" ${id === page ? 'aria-current="page"' : ''} title="${esc(name)}">${ic(icon)}<span>${esc(name)}</span>${id === 'actions' && badge ? `<span class="badge" aria-label="${badge} need attention">${badge}</span>` : ''}</a>`).join('')}`).join('');
  }
  function rerender(scroll) {
    const { page, params } = parse();
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
    $('#scanBtn').innerHTML = `${ic('spark')}<span>Run AI scan</span>`;
    const setThemeIcon = () => { $('#themeBtn').innerHTML = ic(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun'); };
    setThemeIcon();
    $('#plantSel').innerHTML = D.PLANTS.map(p => `<option value="${p.id}" ${p.id === S.plant ? 'selected' : ''}>${esc(p.short)}</option>`).join('');
    $('#periodSel').innerHTML = PERIODS.map(p => `<option value="${p.id}" ${p.id === S.period ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    $('#plantSel').addEventListener('change', e => { S.plant = e.target.value; save(); rerender(); toast(`Showing ${(D.PLANTS.find(p => p.id === S.plant) || {}).name}`); });
    $('#periodSel').addEventListener('change', e => { S.period = e.target.value; save(); rerender(); });
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
      const t = e.target.closest('[data-go],[data-open],[data-term],[data-kpi],[data-adv],[data-reopen],[data-verify],[data-close],[data-gdom],[data-letter],[data-ldom],#exportCsv,#verifyChain,#signOut,.nav a');
      if ($('#side').classList.contains('open') && !e.target.closest('#side')) { $('#side').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); if (!t) return; }
      if (!t || t.disabled) return;
      if (t.matches('.nav a')) { $('#side').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); return; }
      if (t.dataset.go !== undefined) { e.preventDefault(); const inDrawer = t.closest('#drawer'); if (inDrawer) closeOverlays(); go(t.dataset.go); return; }
      if (t.dataset.open) { openFinding(t.dataset.open); return; }
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
      if (e.target.id === 'afterIn') e.target.removeAttribute('aria-invalid');
    });
    document.addEventListener('change', e => {
      const d = e.target.dataset && e.target.dataset.d8;
      if (!d) return;
      const [id, k] = d.split(':');
      if (!S.actions[id] || ui.busy) { e.target.checked = !e.target.checked; return; }
      setD8(id, +k, e.target.checked);
    });
    document.addEventListener('submit', e => {
      if (e.target.id === 'pwForm') { e.preventDefault(); submitPassword(e.target); }
    });
    document.addEventListener('keydown', e => {
      if (!S.user) return; // signed out: only the login form is active
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); return; }
      if (e.key === 'Escape') { closeOverlays(); return; }
      if (e.key === 'Enter' && e.target.id === 'afterIn') { const b = $('[data-verify]'); if (b) b.click(); return; }
      if (e.key === 'Tab' && $('#drawer').classList.contains('on')) {
        const f = $$('#drawer button:not([disabled]), #drawer input, #drawer a[href]');
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
    const first = !S.user;
    applyState(st);
    let hadPref = false; try { hadPref = !!localStorage.getItem(PREF_KEY); } catch (e) { /* ignore */ }
    if (first && S.user.plant !== 'all' && !hadPref) { S.plant = S.user.plant; save(); }
    $('#login').hidden = true; $('#login').innerHTML = '';
    document.body.classList.remove('locked');
    if (!controlsReady) { initControls(); controlsReady = true; }
    $('#plantSel').value = S.plant;
    renderUserBtn();
    rerender(true);
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
    const can = VIEW_ROLES.includes(u.role)
      ? `Move corrective actions ${scope}${userCanApprove() ? ', including approvals' : ' (approval needs the CEO, Plant Head or Finance)'}.`
      : 'View dashboards. This account type cannot change corrective actions.';
    openDrawer(`<h3 id="drawerTitle">${esc(u.displayName)}</h3><p class="lede">${esc(u.username)} · ${esc(roleName(u.role))} · ${esc(u.plant === 'all' ? 'All plants' : plantShort(u.plant))}</p>
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
