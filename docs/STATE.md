# STATE — living logbook

_Last updated: 14 Jul 2026_

## Phase: LIVE + HARDENED — handover prep
The system is **live and processing real calls end-to-end**: Teams call → Watcher → inbox →
Main Pipeline (3-tier account attribution: title → attendee domains → transcript-vs-directory)
→ framework-scored signals → dashboards, with Monday/SharePoint/HubSpot context attached at
classify time and event-driven linking (a new account gets its deals/stakeholders/reports/
projects wired in the same pipeline run). Proven on real calls: MOJ (SSO/SCIM), Thames Water
(governance), HMRC (Complex Calc), MOJ monthly governance (6 signals), CDS Bolt DevOps.
Two full audits done (API + all workflows): no SQL injection, no secrets in the JSONs, no PII
leaks; every critical fixed. Next milestone: **handover docs + user guides** (braindai-doc-style
skill — Cowork only) and the client-side hosting migration.

## The 11 workflows (all in `dashboards/n8n/`, repo = source of truth)
Import-in-place to keep workflow IDs (open the workflow → ⋯ menu → Import from File → Save).
Delete-and-reimport changes the ID and the watcher's "Trigger pipeline" node must be re-picked.
1 Main Pipeline (per call + 5-min sweep) · 2 Recon 07:00 (+ NEW dead-letter sweep: inbox rows
with attempts≥5 → status 'failed') · 3 Feedback lessons 06:30 (rolling 90 days) · 4 Org sync
07:10 schedule + manual (pods, DMs, consultants, CPs from stakeholder board "DC/ DM" col,
CD/CP/delivery-lead from Live Projects & Allocations board 1599188575) · 5 Watcher every
30 min (75-min window; TRIPLE dedup: inbox UNIQUE dedup_key + returned-id gate + calls UNIQUE
ON CONFLICT DO NOTHING — a call can never duplicate) · 6 Watchlist sync (OFF until Entra group
trimmed) · 9 Weekly report sync Mon 08:00 ($top=999) · 10 HubSpot sync 07:30 (604 deals,
2,798 stakeholders, directory names) · 11 HubSpot push every 15 min (human-approved
opportunities → deal in Opportunity Qualification pipeline) · 7/8/12 diagnostic only —
don't import (12 = live-projects peek; delete from n8n + repo when convenient).
**Re-import needed for the 14-Jul changes: workflows 1, 2, 3, 4, 9** (if not already done).

## 14-Jul changes (all committed; deploy = push → VM pull → `pm2 restart tn-api tn-dash` + re-imports)
- **Classifier (wf1)**: suggested_action REQUIRED for every signal type (was risks/opps only —
  why people/update cards showed none); max 2 update signals per call (clutter guard).
- **Pipeline robustness**: call store idempotent on retry (ON CONFLICT dedup_key DO NOTHING).
- **API security**: the 3 write endpoints (feedback / signal-notes / hubspot-push) now enforce
  account scoping; approver identity comes from the signed-in token (no body spoofing);
  UUID + limit/offset validation (400s, not 500s); length caps; 4xx passthrough on body errors.
- **API payload/scale**: /calls is metadata-only + new scoped /calls/:id/transcript (lazy);
  /deals and /stakeholders caps raised to 5000 (the DB had ALREADY passed the old 500/1000 —
  £ sums were about to undercount); Postgres TLS verification now opt-in via PGSSLROOTCERT or
  PGSSL_VERIFY=1 (switch on at handover).
- **Dashboard UI**: ONE signal card (TriageCard) everywhere — HubSpot approval, notes,
  framework score now also inside account/project call views; SignalsFeed time filter
  (all/30/7 days) + 5-per-group caps + "Show N more" + flat pagination; transcript opens in a
  scrollable popup with a sticky "captured moments" chip bar — click a chip → smooth-scroll +
  pulse the colour-tinted highlight block (quotes matched to transcript lines, fuzzy);
  shell decluttered (Sources panel + Live/tenant badges removed); sidebar footer shows the
  signed-in user (name + role from /api/me) with sign-out in Entra mode.
- **Dashboard speed**: stale-while-revalidate session cache (instant repaint, keyed per token
  so it can't bleed across users), silent 5-min background refresh + catch-up on tab return,
  "New activity · Refresh" pill (never yanks the view), splash instead of a blank first paint.

## SSO status (nearly on)
- App registration "Braind", client fca468fa-3376-4feb-9801-2fcbfc325bb8, TN tenant
  5de2609a-7085-46d6-a0f5-91c1bdd726b9. SPA platform with BOTH http://localhost:3030 and
  http://localhost:3030/ registered. VM env flipped to entra (api/.env AUTH_MODE=entra +
  dashboard VITE_AUTH=entra — beware `.env.local` OVERRIDES `.env` for Vite).
- **BLOCKED on TN admin consent** (tenant disallows user self-consent): ask IT →
  App registrations → Braind → API permissions → "Grant admin consent for Tecknuovo"
  (scopes are only openid/profile/email). Then sign-in flows tenant-wide, no prompts.
- ALLOWED_EMAIL_DOMAIN is single-domain (default tecknuovo.com). Bilawal tests with
  bilawal.deu@tecknuovo.com. If braind.io must coexist → make it a comma-list (1-line change).
- Role-testing recipe: set app_users row (role/scope) + point people.email at a DM/CP name;
  sign out/in between changes (the data cache is keyed per token). Restore: email=NULL +
  role admin / scope all.

## Access model (baked in, enforced server-side per request)
app_users override (admin/leadership named rows, scope 'all') → ENTRA_LEADERSHIP_GROUP_ID
(optional) → self-wiring on first login (token display name → people.email bind when the name
is unique; CP on any account → partner view, else delivery; scope 'own' = accounts where
they're CP or run a project as DM). Monday org data DRIVES access — change a CP on Monday →
07:10 sync → their access follows. app_users holds ONLY overrides.
**Pending: Meesha/Chloe (partner, all), Kiera (delivery, all), Katie (leadership, all) —
emails still needed.**

## Known/accepted (documented, non-blocking)
- HubSpot sync 3,000-record pagination cap — the nearest fuse (~2.8k stakeholders today).
- wf11 push: no SKIP LOCKED; stranded 'pushing' rows possible; a failure shows as "already
  recorded" in the UI.
- **Classifier can't tell TN staff from client staff on a call** → mis-framed "Carl leaving"
  (a client-side reorg, speaker Kiran = client) as a TN delivery risk and assigned the action
  to the client. Fix scoped, not built: match transcript speakers vs people (TN) and
  stakeholders (client) in wf1's context step + perspective rules (judge from TN's view;
  action owners must be TN people). Meanwhile: the Incorrect feedback button → 06:30 lessons.
- Signals feed loads newest 200 (API paginates beyond).
- TN data gaps: HMRC "DC/ DM" column empty (no CP shown); companies.read HubSpot scope
  (nice-to-have); Entra in-scope group ~47 people (trim → then activate wf6).

## Next phase
- **Handover docs + user guides** — braindai-doc-style skill (Cowork only; not visible in
  Claude Code). Colleague has the template.
- Hosting: blocked on Rob registering Microsoft.App + Microsoft.OperationalInsights on the
  Braind subscription (c572ce6c-0453-4236-a167-68efa08b71d3). Then: az acr import → Terraform
  ACA (n8n 2.26.5, min replicas 1, port 5678, SAME VNet as Postgres) → recreate credentials →
  import 11 workflows → parallel-run with the VM → toggle VM schedules off. ~1 focused day.
  Dashboards + API can stay on the VM initially (API Dockerfile ready; dashboard = npm run
  build + static host + prod redirect URI + CORS).
- Macro "account story" layer (scoped, not built — Notion "How the Data Flows").
- Hardening switches at handover: db/api_role.sql → run API as tn_api_read; PGSSL_VERIFY=1.

## Ops facts
- VM: pm2 runs `n8n`, `tn-api` (:4000, tsx), `tn-dash` (vite :3030, start from repo root).
  **Repo on the VM = `~/tecknuovo-brain`** (equals the local `dashboards/` folder — the git
  repo root). Dashboard via SSH tunnel → localhost:3030; vite proxies /api → :4000.
- Morning-after check: `SELECT workflow,status,created_at FROM run_logs ORDER BY created_at
  DESC LIMIT 10;` + `SELECT status,count(*) FROM inbox GROUP BY 1;` ('failed' = poisoned).
- Reset-a-call: DELETE calls by dedup_key + UPDATE inbox row to pending → run wf1.
