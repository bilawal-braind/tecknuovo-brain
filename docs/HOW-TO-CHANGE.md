# How to change things — the complete guide

_Everything in the system is changed in one of four places. Nothing else exists._

## 1 · Change the DATA on the dashboards (no engineering, your team, daily)
The dashboards only reflect your own systems (see the source map):
| To change… | Edit… |
|---|---|
| Account owners (CP / Client Director / delivery lead), pods, who sees what at login | **Live Projects & Allocations** board (1599188575) in Monday |
| Consultants shown on an account | **Assigned Associates 2.2 Live** board (1118885420) |
| Risk register items + Katie's register escalations | **Risks, Issues & Incidents** board (1583443098) |
| Projects, phases, RAG (and the trend graph) | File the account's **weekly report** in SharePoint ("Generated Reports") |
| Stakeholders, buying roles, deals | **HubSpot** |
| A missing call | Turn **transcription on** in the meeting (or log the notes against the HubSpot meeting) |
| A signal filed to the wrong account | Use the **Move** button on the signal — the brain learns from it |

Changes flow through on the next scheduled sync (morning for boards, Monday for reports, ≤30 min for calls/notes).

## 2 · Change the BRAIN'S BEHAVIOUR (prompts, thresholds — n8n import)
- All prompts live in named workflow nodes — extracted verbatim in `docs/PROMPTS.md`:
  classifier (wf1 "Assemble context"), Katie's brief (wf13 "Build prompt"),
  account stories (wf15), early radar (wf14).
- Escalation thresholds: register timing (Level 2 = 1 day, Level 1 = 5 days) in
  wf2's register section and the dashboard's `Home.tsx`; Katie's needs-you gate
  (Critical or senior client voice) in `src/components/leadership/Home.tsx`.
- **The change ritual:** edit the JSON in the repo's `n8n/` folder (BraindAI does
  this) → open the EXISTING workflow in n8n → ⋯ → **Import from File** → Save.
  Never delete-and-reimport (it breaks the watcher→pipeline link).

## 3 · Change the DASHBOARD (UI/API — VM deploy)
- Code lives in the repo: `src/` (React dashboard), `api/` (Read API).
- Deploy: `cd ~/tecknuovo-brain && git pull && pm2 restart tn-api tn-dash` on the VM.
- DB migrations: dated files in `db/`, run once via a Postgres node or the VM.
- The sidebar footer shows a **build stamp** — confirm you're on the new version.

## 4 · Change WHERE ALERTS & REPORTS GO (Slack webhooks, no accounts needed)
- Feedback from the dashboard: `BRAIND_SLACK_WEBHOOK` in `api/.env` (restart tn-api).
- Heartbeat (wf18), error alerts (wf19), the weekly report (wf16): paste a Slack
  **incoming webhook URL** into the `SLACK_WEBHOOK` constant at the top of each
  workflow's build node. Any channel, any workspace, no Slack credential.

## Who does what
- **Tecknuovo team**: everything in §1, plus pasting webhook URLs / importing
  JSONs on a screen-share.
- **BraindAI**: authors every change in §2–3 in the repo, and is alerted by the
  heartbeat/error workflows when anything misbehaves (support & maintenance phase).
