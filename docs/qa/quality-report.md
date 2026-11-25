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

## Ground-truth measurement build (2026-11-25)

Goal (user): KPIs must reflect the factory's real state ("ground reality"), entered manually by each department's staff, measured without AI. A KPI with no data shows **Not measured**, never a demo value.

### What was built
| Slice | Files | Evidence |
|---|---|---|
| Form catalogue (16 forms), shared validation, 86 KPI formulas, statistics (XmR control chart, OLS trend t, Welch t-test, stratification, Pareto, robust outlier flags), coverage, PKR impact | `js/measure.js` | `tests/unit/measure.test.mjs`: 42 tests. Golden values: t-table p(2.228, 10) ≈ 0.05; textbook Welch t ≈ −2.46, p ≈ 0.021; impact 3% × 30,000 m × PKR 500 |
| Migration 2: `operator` role, `department` column, `records` table, duplicate-prevention unique index, immutability and no-delete triggers | `server/db.js`, `server/users.js`, `server/cli/users.js` | integration test upgrades a v1 database: users and sessions kept, `foreign_key_check` clean |
| Maker-checker records API, measured API | `server/records.js`, `server/measured.js`, `server/app.js` | `tests/integration/records.test.mjs`: 24 tests covering scope 403s, self-approval ban, 409 duplicate and version conflicts, reject note, DB trigger, approved-only measurement, void, operator and feed denied on `/api/measured`, outlier flag, audit entries |
| Dashboard: Data Entry page (forms, inline errors, approval queue, review drawer), Not-measured tiles, measured trends, findings and evidence, coverage ring, measured value stream, benchmarks, Data & Governance coverage | `js/app.js`, `css/styles.css`, `index.html` | browser E2E below |

TDD note: the `js/measure.js` unit tests were written after the module, so they never ran RED. The server slice (records, measured, migration) followed RED → GREEN.

### Executed
- `npm test`: **292 tests, 292 pass, 0 fail** (222 unit + 70 integration), after the security fixes below.
- Browser E2E on localhost (built-in browser, dev database, two test users created for the run):
  - Operator (spinning, FSD) sees only Data Entry, Formula Lab and Glossary. Dashboard routes fall back to Data Entry, and the plant/period/refresh controls are hidden.
  - Empty submit: 5 inline field errors, focus moves to the first one, nothing saved.
  - Valid spinning shift submit saves R1 as "Waiting approval". The measured fields clear; shift and machine stay.
  - Re-submitting the same shift and machine is refused with "already entered (record R1)".
  - The operator's record drawer has no approve/reject buttons.
  - Head (spinning, FSD): the nav badge shows 1 waiting, and the hero offers "1 record waiting for your approval".
  - Reject without a note: blocked, field marked invalid.
  - Approve: toast shown, queue empty, badge cleared.
  - Spinning page: Yarn yield **86%** (860/1000) and Spinning waste **14%** (140/1000), "Measured from 1 approved record". Both appear as measured findings with evidence; the other 8 tiles show "Not measured · Needs: Spinning shift report".
  - A measured value takes priority over the earlier live-feed test value (81.5).
  - All 16 routes render with no runtime errors.
  - The KPI drawer shows the source, formula and evidence.
  - Search palette shows measured values and the forms.
  - Refresh measurements recalculates and toasts the coverage.
  - At 375 px the entry form is one column with no horizontal overflow.

### Defects found and fixed during E2E
- The `hidden` attribute did not hide `.btn`/`.sel` controls (component `display` won). Fixed with a global `[hidden] { display: none !important; }`.
- A restricted user's URL stayed on `#/command` while showing Data Entry. Fixed by replacing the hash with the real page.
- The health ring scored a live-feed value while coverage said "nothing measured". Coverage now counts feed-filled KPIs separately (`feed`), and the hero names them.
- Evidence label text ran together ("Measured:Measured"), and the toast said "1 approved records". Both fixed.

### Not done / open risks
- **Load testing: NOT EXECUTED.** `/api/measured` recalculates on each request with no cache. Cost grows with approved records in the window. Measure before rolling out to many plants.
- No automated browser test suite. The E2E runs above were scripted by hand in the built-in browser and are not in CI.
- Measured findings are statistical signals, not confirmed root causes. The 8D step still needs a person.
- Playbook findings (`js/data.js`) stay as labelled baseline estimates.

### Independent security review (separate reviewer agent, static read of the code, no exploits run)
No P0 or P1 findings. Each fix was done RED → GREEN: the test was written first, failed, then passed.

| # | Finding | Severity | Action | Test |
|---|---|---|---|---|
| 1 | `GET /api/kpis` had no role check, so operators and feeds could read dashboard data | P2 | Fixed: dashboard roles only | `only dashboard readers can read the KPI feed` |
| 2 | `/api/measured` ignored the caller's plant | P2 | Fixed: scoped users get their own plant, other plants return `403`, and the plant picker shows only their plant | `plant-scoped readers only get the measured KPIs of their own plant`, plus a browser check |
| 3 | The same dye lot, PO or lay could be entered again under another date (double counting) | P2 | Fixed: event forms with their own number are keyed without the date | unit test, plus `the same purchase order cannot be entered again…` |
| 7 | The duplicate check could be beaten with case, spacing, punctuation or full-width letters | P3 | Fixed: keys are normalised (NFKC, letters and digits only) | unit test `duplicate keys ignore case, spacing…` |
| 8 | DB triggers did not cover status, review fields, ids, rows inserted as approved, or `INSERT OR REPLACE` | P3 | Fixed: migration 3 adds status-flow, review-frozen, id and insert triggers, and `recursive_triggers` is on | `the database refuses status changes that skip the workflow…` |
| 5 | `/api/measured` recalculated everything on every request | P2 | Mitigated: cache per plant, period and day, cleared on approve or void | `measured results refresh as soon as a record is approved` |
| 4 | No per-user submission cap; lists stop at 200 with no paging | P2 | **Open**, documented in README known limits | — |
| 6 | Shared forms (defects, downtime) are not tied to the enterer's department | P3 | **Accepted by design**: maintenance and quality log events for every area | — |
| 9, 10 | 404 vs 403 reveals which record ids exist; refused review attempts are not audited | P3 | **Open**, low impact | — |

The reviewer also checked these and found them OK: parameterised SQL (including the dynamic IN lists), prototype-pollution handling, escaping of every record-derived string in the UI (stored XSS), numeric and date validation, the order of review authorisation checks, the version race inside `BEGIN IMMEDIATE`, audit atomicity, body limits, and the safety of migration 2.

Load / performance test: **NOT EXECUTED**.
