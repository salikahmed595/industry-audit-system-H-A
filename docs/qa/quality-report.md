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

## Vercel + Turso port (2026-11-25)

**Why:** the live Vercel site returned `404` on every `/api/*` route (`X-Vercel-Error: NOT_FOUND`) because Vercel served only the static files. The Node server and its SQLite file cannot run on Vercel, whose file system is not persistent.

### What changed
- `server/db.js`: async libSQL adapter (`@libsql/client` 0.18.0, pinned, `npm audit`: 0 vulnerabilities). It works on a local SQLite file, in memory, or on Turso.
  - `db.tx()` runs `BEGIN IMMEDIATE` through an in-process FIFO queue; a nested call joins the open transaction.
  - `busy_timeout` handles other processes. `recursive_triggers` is on inside every transaction.
  - Migrations re-check the version inside their own transaction, so cold starts racing each other are safe.
- Every repository (`users`, `actions`, `kpis`, `records`, `audit`, `measured`), `server/app.js` and the user CLI are now async.
- **State that was in memory is now in the database:**
  - sign-in throttling: the `login_throttle` table (migration 4)
  - the measured-cache version: a `meta` counter bumped inside the approve/void transaction
  - first-run seeding: the check now runs inside the transaction
- **Vercel:**
  - `api/index.js` is the function entry. It handles both the original URL and the rewritten `/api/index?__path=` form, and returns `503` JSON on bad configuration.
  - `scripts/build-static.js` copies only `index.html`, `css/*.css` and `js/*.js` into `public/`.
  - `vercel.json` sets the build, the rewrite and the CSP/HSTS headers.
- `server/config.js`: `DB_URL` / `DB_AUTH_TOKEN`. Startup fails fast when `DB_URL` is missing on Vercel or the token is missing.

### Executed
- `npm test`: **313 tests, 313 pass, 0 fail** (222 unit + 91 integration). Run three times in a row: 313/313 each time.
  - New `db.test.mjs` (11 tests):
    - transactions: commit, rollback, nesting, a 25-way parallel queue
    - two **separate processes** writing one file with no lost update
    - two processes racing the migrations
    - foreign keys and the `INSERT OR REPLACE` guard
    - upgrade from v1
  - New `multi-instance.test.mjs` (4 tests): **two real server processes on one database.**
    - lockout reached on A is enforced on B
    - an approval on B is counted at once on A
    - seeding happens once
    - both answer the health check
    - **RED evidence:** run against the previous commit in a temporary worktree, it failed 4/4 (B answered `200` after 5 failures on A; A still counted `0` after B's approval). It passes 4/4 now.
  - New `vercel.test.mjs` (7 tests):
    - the function entry on both URL forms
    - a JSON body still readable after the rewrite
    - `__path` traversal strings returning `404`
    - no static files from the function
    - security headers
    - `503` without leaking configuration
    - the static build publishing only allow-listed files
    - RED before `api/index.js` existed, GREEN after.
- Browser E2E on the dev server (`data/dev.db`, upgraded from schema v3 to v4 on start):
  - the existing session survived the upgrade
  - sign out, then sign in as `admin`
  - `/api/audit/verify` → `ok: true`, 38 entries: the hash chain is unbroken across rows written by the old and the new engine
  - all 12 admin pages loaded with no page or console errors
  - server log: no errors

### Not verified
- **The real Vercel + Turso deployment: NOT VERIFIED.** It needs the owner's Turso account and Vercel environment variables. These platform behaviours are covered locally but not observed on Vercel: the rewrite form the function receives, request-body streaming with Vercel's helpers, the bundling of the native libSQL binary, and Turso's HTTP transaction latency. Smoke test after deploying: `GET /api/health`, sign in, submit and approve one record, then **Check audit integrity**.
- Load / performance test: **NOT EXECUTED**.

## Independent security review of the port (2026-11-25)

A separate reviewer read the port without running anything and reported 12 findings. Each one was checked against the code before acting on it.

| # | Finding | Decision and fix | Evidence |
|---|---|---|---|
| 1 | A 500-record KPI batch ran 500 single-row INSERTs inside one Turso write transaction (seconds of write lock) | Fixed: multi-row INSERTs of 100 rows (5 statements). `recursive_triggers` is now set only on local files (one round trip saved per Turso write; the app never uses `REPLACE`) | New API test: a 500-record batch is stored completely (count, min, max) |
| 2 | `dev.env` is committed | False positive: it holds only `NODE_ENV`, `HOST`, `PORT`, `DB_PATH`. Still added `.vercelignore` so a `vercel` CLI deploy never uploads `data/` (dev database and dev login file) or `.env*` | File review |
| 3 | Every sign-in attempt, even a locked-out one, took the write lock; success used three separate transactions | Fixed: a locked-out attempt is answered from one read with no transaction. Expired counters count as zero, so the per-attempt DELETE became a 1-in-20 purge. Success is one transaction (release attempt, session, audit). Same for password change | New test: lockout lifts after 15 min with a fresh count; existing burst and lockout tests |
| 4 | Every cold start opened 4 write transactions to check migrations | Fixed: one read; no write at all once the schema is current | New test: with another **process** holding the write lock, opening the database took < 1.5 s. RED with the fix removed: 4065 ms |
| 5 | A stalled network call inside a transaction would block every writer forever | Fixed: 10 s deadline, then rollback and the queue moves on. A remote BEGIN is retried up to 3 times with jitter (nothing has run yet, so it is safe) | New test (200 ms deadline): stalled write rolled back, next transaction runs. RED: the test hung |
| 6 | Action history read every audit row with a target, including one per department record | Fixed: reads only the 33 finding ids through the `audit_target` index (`EXPLAIN QUERY PLAN` confirms) | Browser: F07 history 7 = 7 audit rows; record rows excluded |
| 7 | IPv6 clients could rotate addresses in their /64; a victim's successful sign-in reset an attacker's count from the same NAT address; another proxy in front of Vercel would merge everyone into one bucket | Fixed: throttle keyed per IPv4 address and IPv6 /64 (IPv4-mapped → IPv4); success gives back only its own attempt. Proxy case documented in the README | New unit tests (`ipBucket`) and 3 integration tests, all RED first (401 instead of 429; 200 instead of 429) |
| 8 | If `beforeBegin` failed, `afterEnd` (foreign keys back ON) was skipped | Fixed: both inside one try/finally; also found that the client's local connection **pool** could run a setting on one connection and the transaction on another, so local databases now use a single connection and every local call is queued, as the earlier synchronous code did | Upgrade-from-v1 and foreign-key tests |
| 9 | Password change was three separate writes | Fixed: hash first, then one transaction (new hash, other sessions signed out, audit entry) | Existing password tests (401 / 400 / 204, other sessions ended) |
| 10 | `DB_URL` accepted `user:pw@`, `?authToken=` and fragments; the startup log printed it | Fixed: bare host (and port) only; the log shows only the host; the client is closed if opening fails | New config test; the old pattern accepted 3 of the 4 bad values |
| 11 | The build script would empty any folder inside the project given as its output | Fixed: only `public/` or a folder outside the project (case-insensitive on Windows) | New test. Not run RED on purpose: against the old guard it would have emptied the real `server/` folder |
| 12 | A duplicated `__path` was ambiguous; on `:memory:` a read during a transaction failed with `TRANSACTION_ACTIVE` | Fixed: duplicate → `400`; local reads queue behind the open transaction | New tests; the read test was RED |

### Executed after the fixes
- `npm test`: **330 tests, 330 pass, 0 fail** (227 unit + 103 integration), three runs in a row.
- Browser on the restarted dev server:
  - `/api/health` 200
  - all 12 pages render
  - no console or server errors
  - sign out, a wrong password (clear error, field cleared), then a correct sign-in
  - `login_throttle` afterwards holds exactly the one failure; the success released its own attempt
  - audit chain `ok`, 41 entries
- Not verified, as before: the real Vercel + Turso deployment, and any load test (**NOT EXECUTED**).

## Automation build (2026-11-26): quantified findings, alerts, CEO reports, usage & costs, OCR

Scope, from "UI UX Key Changes.pdf" and the owner's answers:
- The summary and the alerts are shown in the admin panel, with no e-mail.
- OCR is free and local (Tesseract).
- Scheduling is Vercel Cron, plus a script (`npm run cron`), with no outside automation platform.

### What was built (vertical slices)
| Slice | What it does | Evidence |
|---|---|---|
| A. Quantified findings | PKR at risk / financing cost, cash tied up, hours lost, kg and lb lost, each with "How this was calculated"; overlapping KPIs counted once | 7 unit tests in `measure.test.mjs`; browser: Command Center and spinning cards, arithmetic checked by hand |
| B. CEO report summary | Weekly (default), every two weeks or off; catch-up on page visit; one scheduled report per day (DB unique index); on-demand "Generate now"; schedule changes audited | 8 integration tests; browser: list, open, generate, schedule change |
| C. Alerts | High (red) / medium (amber) per KPI and plant; routed to CEO/finance/admin (all), plant head (plant), department manager (department in plant); update, escalate and reopen, self-resolve; acknowledge is audited | 5 integration tests; browser: 6 alerts listed, acknowledge, badge and counts update, department head sees only spinning |
| D. Usage & Costs | LLM cost per day (none called: $0, stated as such), storage by kind, audit cycles per day with avg / p95 and the gather and compute split, record lead time, OCR runs | Integration tests; browser: tiles, charts (hover tooltip and table view per chart), storage breakdown |
| E. OCR | `POST /api/ocr`: form and plant permission checks, base64 and byte-sniffed PNG/JPEG/WebP, 2.5 MB cap, local Tesseract with a 45 s timeout; values only pre-fill the form; the photo is stored as immutable evidence | 7 unit tests (`ocr.test.mjs`), integration tests including permission, 413, 415 and the image ACL; browser: a canvas-drawn ledger filled 4 values plus the date at 95% confidence, then submitted and approved |
| Scheduler | `npm run cron` / `cron:remote` script; `/api/cron/daily` for Vercel Cron, guarded by `CRON_SECRET` (hashed constant-time compare, minimum 16 characters) | Script test (twice in a row: second run writes no report); cron route tests; config and `vercel.json` tests |

### Executed
- `npm test`: **373 tests, 373 pass, 0 fail** (241 unit + 132 integration).
- `npm audit`: **0 vulnerabilities** (adds `tesseract.js@7.0.0` and `@tesseract.js-data/eng@1.0.0`, pinned exactly).
- `node scripts/build-static.js <tmp>`: succeeds; the static-build test still shows only dashboard files are published.
- Browser (built-in browser, disposable demo server `tests/e2e/demo-server.mjs` with an in-memory database and synthetic users):
  - CEO: Alerts, then CEO Reports (open, Generate now, schedule set to every two weeks), then Usage & Costs.
  - Operator: Read from photo, then submit.
  - Department head: approve; the alert counts refresh.
  - Role gating: the operator sees no dashboards; the department head sees Alerts but not Reports or Usage (`#/reports` redirects; the API answers `403`).
  - The only console errors were the expected `401` from `/api/state` before sign-in.

### Defects found and fixed during this build
- **The weekly report measured only the last 7 days.** Monthly records (finance: DSO, DPO, gross margin) dropped out, so coverage read 4.7% against the dashboard's 8.1%, and yarn yield was "high" in the report but "medium" as an alert. It is fixed: reports now measure the same rolling 30 days as the dashboard and the alerts, and the report period still governs the activity counts. A new integration test was RED (11 records against 34), then GREEN.
- **The usage charts' bars were 10 px tall.** A global `.bar` CSS rule overrode the SVG `height`. The chart class was renamed, and the axis labels moved to HTML so they stay readable at any width.
- **The cron script test failed on Windows (`EBUSY`) while removing its temporary database folder.** The assertions had passed. Cleanup now retries and tolerates a leftover temp folder.

### Not verified / open risks
- **Vercel Cron and OCR on Vercel: NOT VERIFIED.**
  - Both need a deployment with `CRON_SECRET` set.
  - `vercel.json` sets `maxDuration: 60` and `includeFiles` for the OCR model and wasm. Whether Vercel's bundler picks up every file tesseract.js loads at run time has only been checked locally.
  - **Smoke test after deploying:** upload one photo on Data Entry, then run the cron job once from Vercel → Settings → Cron Jobs → *Run*.
- **OCR accuracy on real ledgers: NOT MEASURED.** The tests use clean printed text. Handwritten, angled or smudged pages, and Urdu, need a sample set from the plants before anyone relies on it. The design limits the harm: OCR only pre-fills, a person checks, and a second person approves.
- **One libSQL test failed once and was not reproduced.** In one full run during the server work of this build, a single test in the "database adapter (libSQL)" suite failed. It has passed in every full run since. It is treated as flaky and not yet explained.
- **Load / performance test: NOT EXECUTED.** The alert sweep and the report each run `measureAll` once per plant. That is fine at today's volumes but has not been measured at scale.
