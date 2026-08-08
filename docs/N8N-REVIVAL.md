# n8n revival runbook (container) — one call, ~40 min

_Why: the pipeline stopped on 22 Jul 2026 when the BraindAI account lost Tecknuovo
sign-in. Everything below is done INSIDE the container n8n by someone with a
working Tecknuovo login, with Bilawal on the call. The repo's `n8n/` folder is
the source of truth for every workflow._

## 0. Access (once) — the lesson of 22 July
- Log into the container n8n with YOUR Tecknuovo account. If Bilawal's dead
  account is the only owner, create a new owner/admin user.
- **Nothing may depend on a personal identity ever again.** Every credential
  below gets bound to a service account / org app, never a person.
- Bilawal cannot hold access (data residency — outside the EU). Future changes
  arrive as workflow JSONs from the repo; monitoring is content-free
  (workflows 18/19), so nobody needs standing access to notice failures.

## 1. Check the damage
- Executions list: confirm the last run is ~22 Jul and note any red errors.
- Credentials: open each and test/reconnect. The likely casualty is the
  **Microsoft Graph** credential (OAuth consented by the removed account) —
  re-authenticate as a service account. Verify all of:

| Credential | Notes |
|---|---|
| MS Graph | transcript read permissions; service account |
| TN Azure DB (Postgres) | values in the VM's `api/.env` if lost |
| Azure OpenAI | gpt-4o-mini key |
| Monday | switch to a **service-account** token |
| HubSpot | for NEW workflow 17 add scopes: `crm.objects.meetings.read`, `crm.objects.notes.read` |
| Slack | any workspace app that can post to the agreed channel (wf 16/18/19) |

## 2. Run the DB migration first
In any Postgres node (or Bilawal runs it from the VM):
- `db/2026-08_call_metrics.sql` (duration_seconds, tone, call_type on calls).
(Older migrations are already applied.)

## 3. Import the updated workflows — IN PLACE
Open each existing workflow → ⋯ menu → **Import from File** → Save. Import-in-
place keeps the workflow IDs (delete-and-reimport breaks the Watcher→Pipeline
trigger link).
1. `n8n/1-main-pipeline.json` — whole-call tone + call type; **fixes leadership
   visibility being dropped**; stores real duration; **NEW: multi-client call
   hierarchy** — internal stand-ups/wash-ups carry NO account themselves, every
   signal is attributed to its own client and re-filed (Meesha's Friday-wash-up
   issue, fixed at the pipeline level).
2. `n8n/5-watcher.json` — real call duration from the VTT cue timestamps;
   leadership-title stamping.
3. `n8n/6-watchlist-sync.json` — import AND **toggle Active**. Execute once now:
   fills `watchlist` from the transcription security group → Delivery Intel
   switches to full-team mode automatically.
4. **NEW** `n8n/17-hubspot-notes.json` — client-laptop calls: HubSpot meetings +
   notes tagged to them → same inbox → classified like transcripts (agreed with
   Meesha, 21 Jul thread). Needs the HubSpot scopes from §1. Toggle Active.
5. **NEW** `n8n/18-heartbeat.json` — daily 08:30 one-line health post (counts
   only, zero client data). After import: pick the Slack channel on the node;
   optionally paste a healthchecks.io ping URL into `PING_URL` (dead-man's
   switch: if the heartbeat stops, Bilawal gets an email — no data leaves).
   Toggle Active.
6. **NEW** `n8n/19-error-alert.json` — any workflow failure announces itself in
   Slack. After import: pick the channel, then set it as the **Error workflow**
   on each production workflow (Settings → Error workflow) or instance-wide.
7. Any other workflow that differs from the repo (2/3/4/9/10/11/13–16 were last
   imported ~21 Jul; `git log --oneline -- n8n/` shows what changed since).

## 4. Reactivate + smoke-test
1. Toggle every production workflow **Active** (1–6, 9–11, 13–19; NOT 7/8/12).
2. Execute workflow 5 manually once → Executions green.
3. Execute workflow 18 manually → the Slack health line arrives.
4. Verify in the DB:
   ```sql
   SELECT workflow, status, created_at FROM run_logs ORDER BY created_at DESC LIMIT 10;
   SELECT status, count(*) FROM inbox GROUP BY 1;
   ```

## 5. Backfill the missed window (22 Jul → today)
The watcher only looks back 75 minutes; the dead weeks need one manual wide run:
1. Open workflow 5 → the Graph transcripts request → temporarily set the window
   start to `2026-07-22T00:00:00Z`.
2. **Execute once manually.** Triple-dedup makes re-runs safe — nothing ingests twice.
3. **Revert the window to 75 minutes and Save** (critical).
4. The Main Pipeline's 5-minute sweep chews through the backlog (~1–2 min/call).
5. Release anything stuck from the crash:
   `UPDATE inbox SET status='pending', attempts=0 WHERE status='processing';`

## 6. Done-checks (what "revived" means)
- [ ] Heartbeat line arrived in Slack.
- [ ] A fresh transcribed call shows on the dashboard within ~35 min.
- [ ] Delivery Intel shows the full security-group roster (wf6 ran).
- [ ] The missed weeks are back (Chloe's examples: DfE "GiT CRM Catch Up",
      VodafoneThree — if still missing, those organisers aren't in the group).
- [ ] Katie's "ingestion paused" banner disappears on its own (keys off call recency).
- [ ] Next weekday 08:30: the heartbeat arrives again untouched.
