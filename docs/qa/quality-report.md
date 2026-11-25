# Textile AI Audit — Quality Report (2026-11-25)

## How to run
- `npm run dev` starts the Node server on http://127.0.0.1:5174 (see README for users and production setup).
- `npm test` runs unit and integration tests (Node 22.13+, no dependencies).

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

## Backend / connection audit (2026-11-25)
- Code scan: no `fetch`, XHR, WebSocket, beacon or external URL in `index.html`, `js/`, `css/`.
- Live traffic (all pages + AI scan): only `/`, `styles.css`, `engine.js`, `data.js`, `app.js` from the same origin. **There is no backend.** "ERP / MES / QC connectors" and the scan are simulated; every figure comes from `js/data.js`.
- Storage: `localStorage` only (`ta.state.v1`, `ta.theme`), per browser, per device.
  - Corrupt JSON → app boots with defaults: PASS.
  - HTML injected into a stored log entry → rendered as text, not executed: PASS.
  - **Forged state accepted: FAIL (P0 for production).** Editing localStorage let a Department Head mark F01 "verified" with no approval and display a fake "approved by CEO" log line. Approvals, roles and the audit trail are client-side only.

The findings above describe the static prototype **before** the backend was built. They are kept for the record.

## Backend build (2026-11-25): status per gap

| Was | Now | Evidence | Result |
|---|---|---|---|
| P0: no authentication, role was a dropdown | Username + scrypt password, server sessions (HttpOnly, SameSite=Strict, `__Host-`/Secure in prod), lockout, CLI-only user admin | `tests/integration/api.test.mjs` (authentication) + browser E2E: wrong password message, sign-in, sign-out kills the session (`/api/state` → 401) | VERIFIED |
| P0: approvals and audit trail editable in the browser | Server enforces stage order, approver roles, plant scope and optimistic locking. Append-only, hash-chained audit log with DB triggers | API tests + browser E2E as `khi.dept`: approve 403, skip stage 422, other plant 403, stale version 409 (UI refreshes, no lost update), forged localStorage no longer read | VERIFIED |
| P0: dummy data shown as plant figures | `POST /api/kpis/ingest` for integration accounts, all-or-nothing validation. Tiles show "● Live from <source>" or "Demo value" | API tests + E2E: feed posted Yarn yield 81.5 → tile shows it as Live and Off target. Bad batch 422, nothing stored | VERIFIED for KPIs. Findings remain the baseline dataset (labelled) |
| P1: actions not shared between users | SQLite on the server (WAL); every user sees the same state | E2E: change by plant head visible to CEO after sign-in | VERIFIED (single instance) |
| P1: no security headers | CSP without inline script, HSTS (secure mode), nosniff, frame-ancestors none, COOP/CORP, Referrer-Policy | API header test + no CSP violations in the browser console across the E2E run | VERIFIED |
| P2: no committed browser tests | E2E was run interactively in the built-in browser | — | NOT DONE (Playwright specs still to add) |

### Defects found and fixed during this build
- **Password in the URL (found in E2E).** On first load, the sign-in form submitted natively as GET before its handler existed. Fixed in three ways: the handler is bound when the form is built, the form uses `method="post"`, and the app strips any query string at boot. Re-tested: URL stays clean.
- **Independent security review (subagent, read-only).** It confirmed SQL parameterisation, session handling, CSRF, plant scope, static allow-list and client escaping as sound. It flagged the following, each now covered by `tests/integration/security.test.mjs` (failed first, then passed):
  - Leftmost `X-Forwarded-For` was trusted (lockout bypass). Now the rightmost entry, validated with `net.isIP`.
  - A parallel login burst could pass the lockout check. Attempts are now counted before the password check.
  - Every role could read the full audit log, including raw failed-login usernames. The log is now limited to CEO, Finance and admin, and unknown usernames are not stored.
  - 8D ticks could be changed on verified actions. They are now frozen until reopened.
  - Password-change guessing was unlimited. It is now limited per account.
  - Production could start without an explicit `TRUST_PROXY`. It now refuses to start.
  - Also fixed, without a dedicated test: the 415 body drain is capped, throttle memory is capped, and audit appends run in transactions.

### Executed
- `npm test`: **219 tests, 219 pass, 0 fail.** That is 178 unit, 33 API integration and 8 security regression tests, all on real HTTP and in-memory SQLite.
- Mutation checks on the API suite: removing the approver check, the plant-scope check or the audit trigger each made tests fail; the code was restored afterwards.
- Browser E2E on localhost covered:
  - sign-in, the wrong-password message, case-insensitive username;
  - dept, plant-head and CEO journeys: diagnose → approve → start → verify (missed target) → reopen;
  - 8D tick, the 409 conflict path, password change with the wrong current password, sign-out;
  - a KPI feed going live, the CEO audit integrity check (chain intact);
  - 375 px mobile with no horizontal overflow.

### Not done / open risks
| Priority | Item | Note |
|---|---|---|
| P1 | No SSO / MFA | Put behind VPN or identity-aware proxy, or add OIDC, before internet exposure |
| P2 | Audit chain is unkeyed | Someone with DB file write access can rebuild it. Export the head hash off-box regularly (README) or add an HMAC key |
| P2 | Single instance only | In-memory rate limiter + SQLite single writer. Move to Postgres to scale out |
| P2 | Findings are the baseline dataset | Only KPIs are live. Findings need a real analysis pipeline or import |
| P2 | Playwright specs not committed | E2E above was interactive |
| P3 | KPI tiles refresh on page load only | No live polling |
| — | **Load / performance testing** | **NOT EXECUTED.** No load tool was run. Capacity claims would need k6 or similar against a staging copy |

## Known limits
1. Benchmarks are labelled verified / vendor-reported / practitioner norm on the Benchmarks page.
2. The glossary's EOQ worked example is internally inconsistent. The Lab uses holding cost 1,000 so the result matches its 3,464 kg answer (noted on the card).
