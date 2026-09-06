# Deploying tnAI onto a VM (dev or prod)

The whole system is three processes on one VM, kept alive by pm2, plus n8n's
workflow store. Nothing else. A deploy is: pull code, install, restart, verify.
Expected downtime: under five minutes; incoming calls are never lost during it
(they queue in the database inbox and are processed on recovery).

## What runs where

| Process  | What it is                       | Port | Started as                          |
|----------|----------------------------------|------|-------------------------------------|
| tn-api   | Read API (Express + TypeScript)  | 4000 | `npm start` in `api/` (tsx, no build step) |
| tn-dash  | Dashboard (Vite + React)         | 3030 | `npm run dev` in the dashboard folder, or serve `dist/` after `npm run build` |
| n8n      | All automations (16 workflows)   | 5678 | `n8n` (workflows imported from `n8n/*.json`) |

nginx terminates HTTPS for the dashboard domain and proxies to :3030.
The dashboard's own vite server proxies `/api/*` to :4000, so the browser only
ever talks to one origin.

## One-time setup on a fresh VM

1. Node 20+, pm2, nginx with the site config + certificate.
2. `api/.env` from `api/.env.example`: Postgres host/user/password (a READ-ONLY
   role, see `db/api_role.sql`), `AUTH_MODE=entra`, the Entra tenant + client id,
   `CORS_ORIGINS` = the dashboard origin.
3. Database: run `db/schema.sql`, then the dated `db/2026-*.sql` files in
   filename order (each is idempotent and documented).
4. n8n: import every JSON in `n8n/` (skip 7/8/12, they are manual diagnostics),
   recreate the credentials inside n8n's own credential store (Monday token,
   HubSpot token, Microsoft Graph app, Azure OpenAI key, Postgres), then
   publish the workflows that should run (all except 22/23/24 until the Slack
   token exists, and 6 which stays off).
5. `pm2 start` all three, `pm2 save`.

## Routine deploy (what Monday's session is)

```bash
cd ~/tecknuovo-brain          # or wherever the repo is cloned
git pull                      # from the approved main branch
npm install                   # dashboard deps (only if package.json changed)
(cd api && npm install)       # api deps (only if package.json changed)
npm run build                 # type-checks + builds the dashboard
pm2 restart tn-api tn-dash    # ~seconds of downtime
```

If any n8n workflow JSON changed: in the n8n UI open the workflow ->
"Import from File" -> pick the file from `n8n/` -> Save (this keeps the
workflow id, which the watcher's trigger link depends on), then re-publish.
Headless alternative: `n8n import:workflow --input=n8n/<file>.json` then
re-publish and `pm2 restart n8n` (import deactivates workflows, so always
re-publish and confirm they show active).

If any `db/2026-*.sql` file is new since the last deploy: run it once against
the database before restarting (each file says at the top what it does).

## Verifying the deploy

```bash
bash scripts/api-smoke.sh http://localhost:4000            # entra mode
bash scripts/api-smoke.sh http://localhost:4000 <token>    # token mode: full data checks
```

Then the human pass: open the dashboard, sign in, confirm accounts and signals
load, open one signal, open its transcript. If the smoke test is green and the
dashboard shows data, the deploy is good.

Pipeline check (proves classification still works end to end): in n8n, run the
Main Pipeline once on any pending/recent inbox row, or wait for the next real
call; then confirm a fresh row in `run_logs` and the signal appearing on the
dashboard.

## Secrets - the complete list, and where each lives

Nothing secret is in the repository (verified before every push).

| Secret | Used by | Lives in |
|--------|---------|----------|
| Postgres password (read-only api role) | Read API | `api/.env` on the VM |
| Postgres password (n8n role) | n8n workflows | n8n credential store |
| Monday.com API token | wf2 / wf4 syncs | n8n credential store |
| HubSpot private-app token | wf10 sync, wf11 push | n8n credential store |
| Microsoft Graph app (client id + secret) | wf5 transcript watcher | n8n credential store |
| Azure OpenAI key | wf1 classifier, brief writers, API chat | n8n credential store + `api/.env` |
| API_TOKEN (only in AUTH_MODE=token, dev) | Read API | `api/.env` |
| TN_SLACK_BOT_TOKEN (future, briefs) | wf22/23/24 | n8n environment |

Not secrets (safe in code): the Entra tenant id and client id (public
identifiers), Monday board ids, the dashboard URL.
