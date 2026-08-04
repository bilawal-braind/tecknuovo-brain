# n8n revival runbook (container) — one call, ~30 min

_Why: the pipeline stopped on 22 Jul 2026 when the BraindAI account lost Tecknuovo
sign-in. Everything below is done INSIDE the container n8n by someone with a
working Tecknuovo login, with Bilawal on the call. The repo's `n8n/` folder is
the source of truth for every workflow._

## 0. Access (once)
- Log into the container n8n with YOUR Tecknuovo account. If Bilawal's dead
  account is the only owner, create a new owner/admin user.
- **Lesson baked in: nothing may depend on a personal identity.** Prefer a
  service account for any credential that needs a Microsoft login.

## 1. Check the damage
- Executions list: confirm the last run is ~22 Jul and note any red errors.
- Credentials: open each and hit test/reconnect. The likely casualty is the
  **Microsoft Graph** credential (OAuth consented by the removed account).
  Re-authenticate it — ideally as a service account. Verify: Postgres, Monday,
  HubSpot, Azure OpenAI, Slack.

## 2. Run the DB migration first
In any Postgres node (or have Bilawal run it from the VM):
- `db/2026-08_call_metrics.sql` (duration_seconds, tone, call_type on calls).
(Older migrations are already applied.)

## 3. Import the updated workflows — IN PLACE
Open each existing workflow → ⋯ menu → **Import from File** → Save. Import-in-
place keeps the workflow IDs (delete-and-reimport breaks the Watcher→Pipeline
trigger link).
1. `n8n/1-main-pipeline.json` — adds whole-call tone + call type; **fixes
   leadership visibility being dropped** between context and store; stores real
   duration.
2. `n8n/5-watcher.json` — real call duration from the VTT cue timestamps;
   leadership-title stamping.
3. `n8n/6-watchlist-sync.json` — import AND **toggle Active** (it was off).
   Execute once now: fills the `watchlist` table from the transcription
   security group → Delivery Intel switches to full-team mode automatically.
4. Any other workflow that shows differences from the repo (2/3/4/9/10/11/13-16
   were last imported ~21 Jul and are already current unless the repo says
   otherwise — `git log --oneline -- n8n/` shows what changed when).

## 4. Reactivate + verify
- Toggle every production workflow **Active** (1,2,3,4,5,6,9,10,11,13,14,15,16).
- Execute workflow 5 once manually; within minutes check:
  `SELECT workflow, status, created_at FROM run_logs ORDER BY created_at DESC LIMIT 5;`
  `SELECT status, count(*) FROM inbox GROUP BY 1;`
- Release anything stuck from the outage:
  `UPDATE inbox SET status='pending', attempts=0 WHERE status='processing';`

## 5. Backfill the missed weeks (22 Jul → today)
The Watcher only looks back 75 minutes. To recover the gap: open workflow 5,
temporarily raise the lookback window (the `startDateTime` filter in the
getAllTranscripts call) to cover 2026-07-22 → now, **Execute once manually**,
then restore the value and Save. Dedup keys make this safe to repeat — nothing
can double-file.

## 6. Next morning
- 07:00-08:00 crons should log again. Check `run_logs` has rows for 2, 3, 4, 10.
- Delivery Intel: people = the security group with real stats; new calls carry
  measured duration + tone + call type.
