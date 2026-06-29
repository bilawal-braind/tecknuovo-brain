# Read API — Tecknuovo Second Brain

Runs **on the VM** (the only thing that can reach the private Postgres). Node + Express + pg.
Serves read-only endpoints over the tree; one write path (`POST /api/feedback`).

## Endpoints
- `GET /health` — public health check.
- `GET /api/accounts` — accounts + open-signal counts (portfolio/list).
- `GET /api/accounts/:id` — account + projects/SOWs + recent signals (drill-down).
- `GET /api/signals?type=&status=&account_id=&limit=&offset=` — filterable signals feed.
- `POST /api/feedback` — `{ signal_id, verdict: correct|incorrect|relabel, correct_type?, reason?, given_by? }`.

All `/api/*` require `Authorization: Bearer <API_TOKEN>` (dev) — swap to Entra SSO via `AUTH_MODE=entra`.

## Run on the VM
1. `psql` as admin → run `../db/api_role.sql` (set a real password) to create the read-only role.
2. `cp .env.example .env` → fill `PGHOST`, `PGPASSWORD` (the `tn_api_read` password), `API_TOKEN`, `CORS_ORIGINS`.
3. `npm install`
4. `npm start`  (or under PM2: `pm2 start "npm start" --name tn-api`)
5. Test: `curl localhost:4000/health` then `curl -H "Authorization: Bearer <API_TOKEN>" localhost:4000/api/accounts`

## nginx (front door — serves dashboard + proxies the API on one origin)
The API mounts its routes at `/api`, so the proxy must KEEP the `/api` prefix
(no trailing slash on `proxy_pass`). Same origin → the dashboard calls `/api/...`
with `VITE_API_URL=` empty and there is no CORS to configure.
```
server {
  listen 80;
  server_name _;
  root /home/<user>/tecknuovo-brain/dist;   # vite build output (repo root)
  index index.html;

  location /api/ { proxy_pass http://localhost:4000; }  # NO trailing slash — keeps /api
  location /     { try_files $uri /index.html; }        # SPA fallback (hash routing)
}
```

## Auth: dev → Entra
- Now: `AUTH_MODE=token` + a long random `API_TOKEN` (dashboard sends it as a Bearer header).
- Go-live: create an Entra app registration for dashboard login (MSAL), set `AUTH_MODE=entra`, `ENTRA_TENANT_ID`, `ENTRA_API_AUDIENCE`; implement JWT validation in `src/auth.ts`. Then add row-level authorisation (a Client Partner sees their accounts; leadership sees all).
