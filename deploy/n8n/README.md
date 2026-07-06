# Hosting n8n on Azure Container Apps

Plain-English guide for standing up n8n in TN's Azure so it runs unattended.

## The idea
n8n already ships an **official image** (a sealed, ready-to-run box). Azure Container Apps
runs that box for you and keeps it alive. You *can* point Container Apps straight at the
public image — the `Dockerfile` here is a thin wrapper so we can **pin the version** and
push it to **Azure Container Registry (ACR)** (image lives inside TN's tenant). Either works.

**The image is the easy part. Three settings are what actually make it work:**

1. **External database.** n8n keeps workflows/credentials/history in a database. Containers
   restart and move, so this must be an *external* DB — otherwise a restart wipes everything.
   Use the **existing Azure Postgres server**, but a **separate database** (`n8n`) so it
   doesn't mix with the Second Brain memory tables. (`DB_*` vars in `.env.example`.)
2. **Fixed encryption key.** n8n encrypts saved credentials with `N8N_ENCRYPTION_KEY`. Set
   one long random value as a **secret** and never change it — if it changes, all stored
   credentials become unreadable.
3. **Don't scale to zero.** Our system polls Teams every 15 minutes (the Watcher) and runs a
   7am reconcile. If Container Apps scales the app to **0 replicas**, those timers stop firing.
   Set **min replicas = 1** (and max = 1 for community n8n). This is the one Container-Apps
   default that will silently break us if missed.

## Other settings that matter
- **Ingress port:** target port **5678** (n8n's port).
- **Public URL vars:** set `N8N_HOST` / `WEBHOOK_URL` / `N8N_EDITOR_BASE_URL` to the
  Container Apps address so the editor and any callbacks resolve.
- **Timezone:** `GENERIC_TIMEZONE` / `TZ` so crons fire on UK time.

## Build & push to ACR (if using our pinned image)
```bash
# from deploy/n8n/
az acr login --name <yourRegistry>
docker build -t <yourRegistry>.azurecr.io/tn-n8n:2.26.5 .
docker push  <yourRegistry>.azurecr.io/tn-n8n:2.26.5
```
Then create the Container App from that image, target port 5678, min replicas 1, and add the
environment variables from `.env.example` (secrets for the password + encryption key).

(If you'd rather skip ACR for now, point the Container App straight at
`docker.n8n.io/n8nio/n8n:2.26.5` and apply the same env vars.)

## Moving our workflows over
The VM's n8n likely stores its data in a local file, so the new container starts with an
empty database. That's fine — our workflows are version-controlled JSON in `../../n8n/`:
1. Create the `n8n` database on the Postgres server.
2. Start the Container App with the config above.
3. In the new n8n UI, **import** the workflow JSONs (`1-main-pipeline`, `2-reconciliation`,
   `3-feedback-summary`, `5-watcher`, `6-watchlist-sync`).
4. **Re-create the credentials** (MS Graph, TN Azure DB, Azure OpenAI) — credentials don't
   export with the JSON, and the encryption key is fresh.
5. Re-select those credentials on the imported nodes, then activate the workflows.

## Sanity check after deploy
- App shows **1 running replica** (never 0).
- n8n UI loads at the Container Apps URL.
- A manual run of the Watcher/reconcile succeeds (proves DB + credentials + outbound work).
