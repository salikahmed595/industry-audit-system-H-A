# Textile AI Audit — Control Tower

A root-cause dashboard for large textile groups. It has two parts:

- A glassmorphism single-page dashboard (`index.html`, `css/`, `js/`).
- A backend in `server/`. It handles sign-in, enforces the 8D corrective-action workflow, keeps a tamper-evident audit trail, and takes KPI readings from your ERP/MES.
- **Ground-truth measurement.** Department staff enter shift, daily, event and month-end records on 16 forms. A different person approves each one, and every KPI is calculated only from approved records. A KPI without records shows **Not measured**, never a demo number. Gaps are explained with control charts, trend tests, Welch t-tests and Pareto analysis, and costed in PKR at finance's own cost rates. No AI model is involved: the calculations are deterministic and statistical.

The backend uses **Node.js built-ins only** (`node:http`, `node:sqlite`, `node:crypto`) and has **zero npm dependencies**.

## Quick start (local)

```powershell
node --version          # needs 22.13 or newer
npm test                # 292 tests: 222 unit + 70 integration (API, security, records)
npm run user:create -- --username ayesha --name "Ayesha Khan" --role ceo --plant all
npm run dev             # http://127.0.0.1:5174 using dev.env (database in data/dev.db)
```

`user:create` prints a one-time password. Give it to the person privately; they can change it from their account menu.

## What the server enforces

The browser only displays decisions. The server makes them.

| Rule | Where |
|---|---|
| Must be signed in for every `/api/*` call except login | `server/app.js` |
| Actions move one stage at a time: Detected → Diagnosed → Approved → In progress → Verified | `server/actions.js` (rules shared with `js/engine.js`) |
| Only CEO, Plant Head or Finance can approve | `server/actions.js` |
| Plant-scoped users can change actions only in their own plant | `server/actions.js` |
| Admin and integration accounts cannot change actions | `server/actions.js` |
| Verifying needs a measured after-value; the server decides "effective" against the target | `server/actions.js` |
| Two people editing the same action: the second gets `409` and the fresh copy (optimistic locking) | `server/actions.js` |
| Every change, sign-in, failed sign-in and admin command is written to an append-only, SHA-256 hash-chained log. Database triggers block UPDATE/DELETE. Only CEO, Finance and admin can read the full log; everyone sees each action's own history | `server/audit.js`, `server/db.js` |
| Once an action is verified, its 8D checklist is frozen; reopen it to change anything | `server/actions.js` |
| Sign-in and password-change guesses are limited (per user+IP, per IP, per account). Attempts are counted before the password check, so parallel bursts can't slip through | `server/app.js` |
| KPI batches are validated all-or-nothing: known section/KPI, finite value, sane timestamp | `server/kpis.js` |
| Department records are validated with the same rules the form shows: known fields only, numeric ranges, cross-field checks (e.g. yarn + waste ≤ cotton fed), no future dates, nothing older than the form allows | `js/measure.js`, `server/records.js` |
| Staff can enter only their own department's forms, in their own plant. The same shift/line/date cannot be entered twice while the first is waiting or approved, and a dye lot, PO or cutting lay number only once whatever the date. Keys ignore case, spacing and punctuation ("RF-12" = "rf 12") | `server/records.js`, `js/measure.js`, unique index in `server/db.js` |
| A record counts only after a **different** person approves it (department head, plant head, CEO, or finance for finance forms), within their plant | `server/records.js` |
| Rejecting or voiding needs a reason. Approved values are never edited: database triggers block changes and deletes, and a wrong record is voided and entered again. The database also enforces the status flow: new rows start as submitted, status only moves submitted → approved/rejected or approved → voided, and a decision cannot be rewritten | `server/records.js`, `server/db.js` |
| Plant-scoped users read measured KPIs for their own plant only. The KPI feed (`/api/kpis`) is readable only by dashboard roles | `server/measured.js`, `server/app.js` |
| Values far from the plant's own history (median ± 5 robust SD over the last 30 approved records) are flagged to the approver. They are never blocked | `js/measure.js` |

### Roles

| Role | See dashboards | Enter records | Approve records | Move actions | Approve actions | Audit integrity check | Push KPIs |
|---|---|---|---|---|---|---|---|
| `ceo` | ✓ | all forms | all forms (scoped) | ✓ (scoped by plant) | ✓ | ✓ | |
| `plant` | ✓ | all forms | all forms (scoped) | ✓ (scoped) | ✓ | | |
| `dept` | ✓ | own department | own department (scoped) | ✓ (scoped) | | | |
| `finance` | ✓ | finance, inventory, procurement | same | ✓ (scoped) | ✓ | ✓ | |
| `operator` | | own department | | | | | |
| `admin` | ✓ | | | | | ✓ | ✓ |
| `integration` | | all forms | | | | | ✓ |

`--plant all` gives group-wide scope. A plant code limits writes to that plant. `dept` and `operator` users need `--department` (a section id such as `spinning`, `dyeing` or `finance`). Run `node server/cli/users.js` with no command to see the valid roles, plants and departments.

## Managing users (server console only)

There is no sign-up page and no web admin. That is deliberate: it is less to attack.

```powershell
npm run user:create  -- --username ali --name "Ali Raza" --role plant --plant KHI
npm run user:create  -- --username sana --name "Sana Iqbal" --role dept --plant FSD --department spinning
npm run user:create  -- --username bilal --name "Bilal Ahmed" --role operator --plant FSD --department spinning
npm run user:reset   -- --username ali      # new one-time password, signs out all their sessions
npm run user:disable -- --username ali      # blocks sign-in, signs out all sessions
npm run user:enable  -- --username ali
npm run user:list
```

Every command is recorded in the audit trail. Run them against the same `DB_PATH` the server uses, for example `node --disable-warning=ExperimentalWarning --env-file=.env server/cli/users.js list`.

## Entering department data (ground truth)

This is the main way data gets in. Each department records what happened on the floor:

1. **Enter.** An operator or department head opens **Data Entry** and fills in a form: spinning shift report, dye lot result, sewing line day, finance month-end, and so on (16 forms in `js/measure.js`). The browser checks the values; the server checks them again with the same code.
2. **Approve.** The record waits in the **Approval queue** of the people allowed to check it. Unusual values are flagged. The approver approves, or rejects with a reason. Nobody can approve their own record.
3. **Measure.** `GET /api/measured` recalculates every KPI from approved records in the chosen plant and period (last 30 days, 3 months or 12 months). Each KPI comes back with its value, record count, date range, staleness and formula. With no records the value is `null`, shown as **Not measured** together with the form that would fill it.
4. **Explain.** For every measured KPI that misses its target, the server attaches evidence. That is an XmR control chart (special-cause signals), a trend test (t statistic), the worst stratum by shift, machine, supplier or line (Welch t-test, p < 0.05), a Pareto of downtime reasons or defect types, and the PKR cost of the gap per 30 days at the plant's approved **Cost rates** record. It also links the audit-playbook hypotheses that match.
5. **Correct.** A wrong approved record is voided with a reason and entered again. Every step is in the hash-chained audit log.

The dashboard's **Measured** ring is the share of applicable KPIs that have approved data. Raise it by assigning each form to the department that owns it.

## Sending real KPI data (machine feeds)

Create an `integration` user for each feed. The feed signs in, then posts batches of 1–500 readings:

```http
POST /api/login            {"username":"erp-feed","password":"…"}      → sets session cookie
POST /api/kpis/ingest      {"source":"SAP ERP","records":[
  {"section":"spinning","kpi":"Yarn yield","value":91.2,"asOf":"2026-11-25T06:00:00Z"}
]}                                                                       → {"accepted":1}
```

`section` and `kpi` must match the names in `js/data.js`. A fed value is shown only when there are no approved department records for that KPI. The tile then reads **● Live feed from <source>**, and with neither the tile shows **Not measured**. If any record in a batch is invalid, the whole batch is rejected (`422`) and nothing is stored. The dashboard loads KPIs when it opens, so users see new readings on their next page load.

## API summary

| Method & path | Who | Notes |
|---|---|---|
| `POST /api/login` | anyone | `{username,password}`. Returns `429` with `Retry-After` after repeated failures |
| `POST /api/logout` | signed in | `204` |
| `GET /api/me` | signed in | |
| `POST /api/me/password` | signed in | `{current,next}`, next ≥ 12 chars. Signs out your other sessions |
| `GET /api/state` | signed in | user, all actions, recent audit log, latest KPIs |
| `POST /api/actions/:id/transition` | workflow roles | `{to, version, after?}` |
| `POST /api/actions/:id/reopen` | workflow roles | `{version}`. Only for a verified, not-effective fix |
| `POST /api/actions/:id/d8` | workflow roles | `{index 0-7, checked, version}` |
| `GET /api/audit?limit=` | ceo, finance, admin | |
| `GET /api/audit/verify` | ceo, finance, admin | recomputes the whole hash chain |
| `POST /api/records` | roles with forms | `{type, plant, date, data}` → `201 {record}`. `422 {errors:[{field,error}]}`, `409` duplicate, `403` other department/plant |
| `GET /api/records?scope=mine\|queue\|all&status=&type=&limit=` | signed in | operators only ever see their own records |
| `POST /api/records/:id/review` | reviewers | `{decision: approve\|reject\|void, version, note?}`. A note (≥ 3 chars) is required to reject or void. `409` returns the fresh record |
| `GET /api/measured?plant=all\|FSD\|KHI\|LHR\|GRP&period=m\|q\|y` | ceo, plant, dept, finance, admin | KPIs, coverage and ranked findings with evidence, from approved records only. Plant-scoped users default to their own plant; any other plant gets `403` |
| `GET /api/kpis` | ceo, plant, dept, finance, admin | latest feed values |
| `POST /api/kpis/ingest` | integration, admin | see above |
| `GET /healthz` | anyone | `{"ok":true,"db":true}`, or `503` if the database is unreachable |

All writes need `Content-Type: application/json`. Browser requests must come from `PUBLIC_ORIGIN`.

## Production deployment

1. Install Node 22.13+ on the server. Copy the repo (no `npm install` needed).
2. Copy `.env.example` to `.env` and edit it. `PUBLIC_ORIGIN` must be the exact `https://` address users type. The server refuses to start in production without it.
3. Create the first users with the CLI (above).
4. Run under a service manager (systemd, NSSM or pm2) that restarts it on failure:
   `node --disable-warning=ExperimentalWarning --env-file=.env server/index.js`
5. Put an HTTPS reverse proxy in front: nginx, Caddy or IIS ARR. Node listens on `127.0.0.1` only.
   - `TRUST_PROXY` must be set explicitly in production; the server refuses to start otherwise. Use `true` when Node is reachable **only** through your proxy. The server then trusts the **rightmost** `X-Forwarded-For` entry, which your proxy adds, and ignores anything the client sent. Use `false` if clients connect to Node directly. Without it behind a proxy, every user shares the proxy's IP, so one attacker could trip the per-IP sign-in limit for everyone.
   - Pass the `Host` header through unchanged.
6. Check: `curl https://audit.example.com/healthz` returns `{"ok":true,"db":true}`.

### Backups

Everything lives in one SQLite file (`DB_PATH`, plus `-wal`/`-shm` side files while running). Take a consistent copy while the server runs:

```bash
sqlite3 /var/lib/textile-audit/textile-audit.db ".backup '/backups/textile-audit-$(date +%F).db'"
```

Keep backups off the server. Test a restore. After restoring, sign in as CEO and press **Check audit integrity** in the Action Center.

### Known limits (read before scaling)

- **One server process.** The sign-in rate limiter is in memory, and SQLite allows one writer at a time. That is fine for one group's management team (hundreds of users). Do not run several copies against one file. To go multi-node, move the repositories in `server/*.js` to PostgreSQL. All SQL lives there.
- **`node:sqlite` is marked experimental** in Node 22. Pin the Node version you tested with.
- **The audit hash chain is not keyed.** It detects edits made through the app or by anyone who doesn't recompute every later hash. Someone with direct write access to the database file could rebuild the chain. Protect the file with OS permissions, and copy the `head` hash from **Check audit integrity** somewhere they can't write (e.g. a weekly email to the auditor). A matching head later proves nothing was rewritten.
- **No SSO/MFA yet.** Sign-in is username + password (scrypt-hashed). For internet-facing use, put the app behind your VPN or an identity-aware proxy, or add OIDC.
- **KPI values come only from approved records** (or the machine feed). The 33 audit-playbook findings in `js/data.js`, with their PKR amounts and baselines, are still **estimates**. The dashboard labels them "baseline estimate, not measured" and shows each one's measured KPI next to it.
- **`/api/measured` is cached in memory** per plant, period and day, and the cache is dropped on every approval or void. A cache miss recalculates synchronously from all approved records in the window. That is fine for tens of thousands of records but has not been load-tested beyond that.
- **No per-user submission cap or list paging yet.** A user can submit many valid event records (defects, downtime), and record lists show only the newest 200. Add a daily cap and paging before opening entry to large teams.
- **Shared forms (defect tally, downtime event) are not tied to the enterer's department.** That is deliberate: maintenance and quality staff log events for every area. The approver still has to be allowed to review that form in that plant.
- **Measured findings are statistical evidence, not proof of cause.** A control-chart signal or a significant stratum tells you where to look; the 8D root-cause step still needs a person to confirm it.
- **Records older than 62–100 days** (by form) cannot be entered through the API, so a late month-end needs an administrator.
- **Load testing has not been run.** See `docs/qa/quality-report.md`.

## Project layout

```text
index.html, css/, js/       dashboard (static, served by the Node server under a strict CSP)
js/engine.js                workflow and KPI rules shared by browser and server
js/data.js                  findings, sections, plants, glossary (baseline dataset)
js/measure.js               data-entry forms, validation, KPI formulas and statistics (browser + server)
server/app.js               HTTP routes, auth, CSRF checks, security headers
server/records.js           maker-checker department records
server/measured.js          KPIs from approved records
server/{actions,audit,kpis,users,security,db,http,config}.js
server/cli/users.js         user administration
tests/unit, tests/integration
docs/qa/quality-report.md   what was tested and what is still open
```
