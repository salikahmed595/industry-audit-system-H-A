# Textile AI Audit — Quality Report (2026-11-25)

## How to run
- Open `index.html` through a local server (the browser blocks scripts on some `file://` previews):
  `python -m http.server 5174 --bind 127.0.0.1` → http://localhost:5174
- Unit tests: `node --test tests/unit/*.test.mjs` (Node 22, no dependencies)

## Status: VERIFIED for the prototype scope (static app, dummy data)

| Check | Evidence | Result |
|---|---|---|
| Unit: 61 glossary formulas (golden examples from the PDF), guards, RCA trace / Pareto / score / health, 8D workflow rules, formatting, escaping, search | `node --test` → 178 tests, 178 pass, 0 fail | PASS |
| Data integrity: ~131 glossary terms, formula + page links, causal graph weights sum to 1, every symptom reaches a root with an owner and a fix | same run | PASS |
| E2E (built-in browser, localhost) — 29 routes render, no JS errors, no `undefined`/`NaN` in text | scripted sweep | PASS |
| E2E workflow: Department Head cannot approve (button disabled; forced click refused by engine); CEO approves → start → verify | scripted | PASS |
| E2E verify: empty value rejected; missed target → "Not effective" → Reopen → back to Diagnosed; effective fix marked "Verified effective" | scripted | PASS |
| Audit trail + persistence (localStorage, schema-validated on load) | log entries and stored stage checked | PASS |
| Search palette (Ctrl+K), HTML injection in search input renders as text | `<img onerror>` query → 0 `img` nodes | PASS |
| Formula Lab: glossary example loads, invalid/negative input shows error | EOQ card | PASS |
| Role views (CEO / Plant / Dept / Finance), plant + period filters, light/dark theme | scripted + screenshots | PASS |
| Responsive: 375 px mobile (menu, hero, cards), 1024 px desktop | screenshots | PASS |
| Load / performance testing | — | NOT EXECUTED (static single-user prototype, no server) |
| Real data connectors (ERP/MES/QC) | — | NOT IN SCOPE (simulated) |

## Fixed during verification
- All 86 dummy KPIs were off target (health 3/100, every tile red). Rebalanced 13 non-narrative KPIs → health 23/100, so the red tiles point to the real problems.
- Meter bars, ranked list text and oversized icons (inline elements inside buttons) — layout fixed.
- Counters stuck at 0 when the tab is in the background — added a timed fallback to the true value.
- Mobile: hero overflow and blurred slide-out menu (stacking context) fixed.

## Known limits / next steps
1. Data is dummy (PKR). Benchmarks are labelled verified / vendor-reported / practitioner norm on the Benchmarks page.
2. The glossary's EOQ worked example is internally inconsistent; the Lab uses holding cost 1,000 so the result matches its 3,464 kg answer (noted on the card).
3. Roles are a view switch, not authentication. A production build needs real auth, server-side authorization of approvals, and a tamper-proof audit log.
4. No automated browser test file is committed yet (E2E was run interactively); add Playwright specs before a production release.
