# Hosting the Read API + dashboard on Azure

Companion to `../n8n/README.md`, same style. Two pieces: the **API** (one more Container
App) and the **dashboard** (static files — no server needed).

---

## Part 1 — The API as a Container App

## The idea
The API is a small Node service (Express + pg). Its image is built from `../../api/Dockerfile`
— nothing sensitive is baked in; all config arrives as environment variables at deploy time.
It is the ONLY thing the dashboard talks to, and the only thing (besides n8n) that talks to
Postgres.

**The image is the easy part. Three settings make it actually work:**

1. **Same VNet as Postgres.** The database is private — without VNet integration the API
   starts fine and then every request times out. Same setup as the n8n Container App.
2. **Min replicas = 1.** Scale-to-zero adds a cold start to the first dashboard load of the
   day and drops the in-memory rate-limit state. It's a tiny app — keep 1 replica.
3. **Ingress port 4000**, external (the dashboard's browser calls it directly).

## Build & push to ACR
```bash
# from the repo root (the folder containing api/)
az acr build --registry <yourRegistry> --image tn-api:1.0.0 ./api
```
(`az acr build` builds in Azure — no local Docker needed. Same pattern as n8n.
Alternatively: `docker build -t <yourRegistry>.azurecr.io/tn-api:1.0.0 ./api && docker push …`)

## Environment variables (see `../../api/.env.example`)
| Var | Value / notes |
|---|---|
| `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` | the existing Azure Postgres (same values n8n uses) |
| `PGPASSWORD` | **secret** |
| `PGSSL_VERIFY` | `1` — turn certificate verification on for production |
| `AUTH_MODE` | `entra` for production (`token` only for testing) |
| `ENTRA_TENANT_ID` | `5de2609a-7085-46d6-a0f5-91c1bdd726b9` |
| `ENTRA_CLIENT_ID` | `fca468fa-3376-4feb-9801-2fcbfc325bb8` |
| `ALLOWED_EMAIL_DOMAIN` | `tecknuovo.com` |
| `ENTRA_LEADERSHIP_GROUP_ID` | optional — Entra group that gets full visibility |
| `API_TOKEN` | **secret** — only used when `AUTH_MODE=token` |
| `CORS_ORIGINS` | the dashboard's public URL, e.g. `https://<dashboard-host>` (comma-separated if several) |
| `PORT` | `4000` |

## Sanity check after deploy
- `curl https://<api-app-url>/health` → `{"ok":true}` (public, unmetered — safe for probes).
- `curl -H "Authorization: Bearer <API_TOKEN>" https://<api-app-url>/api/accounts` with
  `AUTH_MODE=token` → JSON array. Then flip to `entra` for production.

---

## Part 2 — The dashboard as static files

## The idea
`npm run build` compiles the React app to plain HTML/JS/CSS in `dist/`. Any static host
works; **Azure Static Web Apps** is the natural fit. There is no server code — the browser
calls the API directly.

**Vite bakes `VITE_*` values in at BUILD time** — build with production values, don't expect
to change them at runtime:

```bash
# from the repo root
cat > .env.production <<'EOF'
VITE_DATA_SOURCE=live
VITE_API_URL=https://<api-app-url>
VITE_AUTH=entra
VITE_ENTRA_TENANT_ID=5de2609a-7085-46d6-a0f5-91c1bdd726b9
VITE_ENTRA_CLIENT_ID=fca468fa-3376-4feb-9801-2fcbfc325bb8
VITE_ENTRA_REDIRECT=https://<dashboard-host>
EOF
npm install && npm run build     # output: dist/
```

Deploy `dist/` to the static host (Static Web Apps CLI, storage upload, or their CI).
One host requirement: **SPA fallback** — unknown paths serve `index.html`
(the app uses hash routing, so this rarely triggers, but set it anyway).

## The two cross-links to configure (the usual gotchas)
1. **Entra redirect URI:** add `https://<dashboard-host>` (and `https://<dashboard-host>/`)
   under the app registration's **Single-page application** platform — exactly like the
   localhost ones. Sign-in fails with AADSTS50011 until this matches.
2. **CORS:** the API's `CORS_ORIGINS` must contain the dashboard's origin, or the browser
   blocks every call after sign-in.

## Sanity check after deploy
- Open `https://<dashboard-host>` → Tecknuovo sign-in screen → Microsoft login → dashboard
  loads with the signed-in user's name bottom-left.
- Data appears (accounts/signals) → API + CORS + VNet all good.
- A user without an `app_users` row sees only their own accounts (self-wiring) — that's
  correct behaviour, not a bug.

---

## End state
```
Browser ──HTTPS──▶ Static dashboard (Static Web App)
   │
   └─HTTPS (Bearer: Entra id_token)──▶ tn-api Container App :4000 ──VNet──▶ Azure Postgres
                                            ▲
n8n Container App :5678 ────────────────────┴── (same VNet, same DB)
```
Three managed pieces + the database. The VM can be decommissioned once both Container Apps
and the static site are verified.
