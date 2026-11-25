# Textile AI Audit — Control Tower

A root-cause dashboard for large textile groups. It has two parts:

- A glassmorphism single-page dashboard (`index.html`, `css/`, `js/`).
- A backend in `server/`. It handles sign-in, enforces the 8D corrective-action workflow, keeps a tamper-evident audit trail, and takes KPI readings from your ERP/MES.

The backend uses **Node.js built-ins only** (`node:http`, `node:sqlite`, `node:crypto`) and has **zero npm dependencies**.

## Quick start (local)

```powershell
node --version          # needs 22.13 or newer
npm test                # 178 unit + 41 integration tests (API + security)
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

### Roles

| Role | See dashboards | Move actions | Approve | Audit integrity check | Push KPIs |
|---|---|---|---|---|---|
| `ceo` | ✓ | ✓ (scoped by plant) | ✓ | ✓ | |
| `plant` | ✓ | ✓ (scoped) | ✓ | | |
| `dept` | ✓ | ✓ (scoped) | | | |
| `finance` | ✓ | ✓ (scoped) | ✓ | ✓ | |
| `admin` | ✓ | | | ✓ | ✓ |
| `integration` | | | | | ✓ |

`--plant all` gives group-wide scope. A plant code limits writes to that plant. Run `node server/cli/users.js` with no command to see the valid roles and plant codes.

## Managing users (server console only)

There is no sign-up page and no web admin. That is deliberate: it is less to attack.

```powershell
npm run user:create  -- --username ali --name "Ali Raza" --role plant --plant KHI
npm run user:reset   -- --username ali      # new one-time password, signs out all their sessions
npm run user:disable -- --username ali      # blocks sign-in, signs out all sessions
npm run user:enable  -- --username ali
npm run user:list
```

Every command is recorded in the audit trail. Run them against the same `DB_PATH` the server uses, for example `node --disable-warning=ExperimentalWarning --env-file=.env server/cli/users.js list`.

## Sending real KPI data

Create an `integration` user for each feed. The feed signs in, then posts batches of 1–500 readings:

```http
POST /api/login            {"username":"erp-feed","password":"…"}      → sets session cookie
POST /api/kpis/ingest      {"source":"SAP ERP","records":[
  {"section":"spinning","kpi":"Yarn yield","value":91.2,"asOf":"2026-11-25T06:00:00Z"}
]}                                                                       → {"accepted":1}
```

`section` and `kpi` must match the names in `js/data.js`. On the dashboard, a tile with fed data shows **● Live from <source>**; tiles without it are labelled **Demo value**. If any record in a batch is invalid, the whole batch is rejected (`422`) and nothing is stored. The dashboard loads KPIs when it opens, so users see new readings on their next page load.

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
| `GET /api/kpis` | signed in | |
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
- **Findings and baseline KPIs are still the built-in dataset** (`js/data.js`). Only KPIs pushed through `/api/kpis/ingest` are live. The AI scan button replays the analysis on that dataset.
- **Load testing has not been run.** See `docs/qa/quality-report.md`.

## Project layout

```text
index.html, css/, js/       dashboard (static, served by the Node server under a strict CSP)
js/engine.js                workflow and KPI rules shared by browser and server
js/data.js                  findings, sections, plants, glossary (baseline dataset)
server/app.js               HTTP routes, auth, CSRF checks, security headers
server/{actions,audit,kpis,users,security,db,http,config}.js
server/cli/users.js         user administration
tests/unit, tests/integration
docs/qa/quality-report.md   what was tested and what is still open
```
