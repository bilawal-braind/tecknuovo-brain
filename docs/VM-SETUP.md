# What runs on the VM — the complete picture

_The Azure VM inside Tecknuovo's tenant. One box, three processes under pm2,
plus the repo it all deploys from._

## Processes (pm2)
| pm2 name | What it is | Port |
|---|---|---|
| `tn-api` | The Read API (Express/TypeScript, `api/` in the repo, run via tsx) — every dashboard request goes through it; enforces login scoping and leadership visibility in SQL | 4000 |
| `tn-dash` | The dashboard (Vite/React, repo root) | 3030 |
| `n8n` | A DORMANT legacy n8n — production automations run in the separate n8n **container**, not here | 5678 |

`pm2 status` shows all three; `pm2 logs tn-api` tails the API.

## The repo
- `~/tecknuovo-brain` = a clone of `github.com/bilawal-braind/tecknuovo-brain`
  (single source of truth: dashboard, API, workflow JSONs, migrations, docs).
- **Deploy ritual:** `git pull && pm2 restart tn-api tn-dash`.

## Configuration
- `~/tecknuovo-brain/api/.env` — Postgres connection (PG* vars), `AUTH_MODE`
  (entra in production), `ALLOWED_EMAIL_DOMAIN`, `BRAIND_SLACK_WEBHOOK`
  (feedback), and — once provided — `AZURE_OPENAI_ENDPOINT/KEY/DEPLOYMENT`
  (turns tnAI's answers conversational).
- The dashboard is served by the Vite process; users reach it via the
  Entra-protected front door (ast.tecknuovo.com).

## What the VM can reach
- **Azure Postgres** (private, VNet-only) — this is WHY the API must live here:
  the database is unreachable from anywhere else.
- Azure OpenAI (for tnAI), Slack webhooks (outbound HTTPS).

## The database
- Managed Azure PostgreSQL, ~20 tables (see the architecture doc §21). Migrations
  are dated files in `db/` — idempotent, run once each.
- Hardening at handover: switch the API to the `tn_api_read` role
  (`db/api_role.sql`) and set `PGSSL_VERIFY=1`.

## What does NOT run here
- The production **n8n container** (all 19 automations) — TN-side, reached via its
  own URL, changed only by importing JSONs from this repo.
- The AI models — Azure OpenAI, in-tenant, called by n8n (and the API for tnAI).

## Health checks
```sql
SELECT workflow, status, created_at FROM run_logs ORDER BY created_at DESC LIMIT 10;
SELECT status, count(*) FROM inbox GROUP BY 1;
```
Plus the daily heartbeat line in Slack (workflow 18) — if it stops arriving,
something is wrong even if nobody is looking.
