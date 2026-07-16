# Tecknuovo Second Brain — Project Brain (always-loaded)

> Read this first every session. Durable truth lives here; live status lives in `STATE.md`.
> Full technical source of truth = the Notion doc **"Tecknuovo Second Brain — Architecture & Decisions"** (marked FINAL). When in doubt, that doc wins.

## What this is
BraindAI (Bilawal) is building an AI **"second brain"** for **Tecknuovo** (UK digital-delivery consultancy). It ingests calls (+ Monday, SharePoint), classifies them into four **signals** — 🟢 Opportunity, 🔴 Risk, 🔵 Delivery update, 🟡 People — and surfaces them on four role-based, **read-only** dashboards (Delivery, Client Partner, Leadership, Observability). Build-and-hand-over engagement.

## The vision (hold this mental model)
A structured, hierarchical second brain (à la Karpathy's "second brain"):
- **Static memory** — org tree: accounts → projects → people → pods (from Monday/SharePoint → Postgres).
- **Dynamic layer** — each call transcript is **enriched by auto-attaching the relevant account/project context**, then passed to the classifier to extract signals that file back onto the tree.

## Golden rules (shape every decision)
1. Work only with existing infra — never ask the client to provision anything new.
2. Everything owned by Tecknuovo — survives BraindAI leaving ("if Bilawal vanished" test).
3. **Display-only** — surface intelligence; never act/push outward (Slack/routing = banked/Stage-2).
4. Data residency — all client data stays in TN's Azure tenant.
5. Clean, beautiful, Tecknuovo-branded.

## Final architecture (FINAL — no new infra)
- **One Azure VM** runs n8n + the Read API + serves the dashboards.
- **Managed Azure Postgres** (PG 16.14, private, SSL required) = the memory. pgvector 0.8.2 available (enable when embeddings land).
- **Azure OpenAI gpt-4o-mini** only (compensate with tight prompts, structured output, good context, feedback flywheel).
- Deterministic **n8n** pipeline (agentic loops only at bounded edges). Durable **`inbox`** table = the queue (no Service Bus).

## Build order
1. **Memory schema** (`db/`) ← current.  2. Monday → accounts/people sync.  3. Call inbox + pipeline skeleton (mock transcript).  4. Classifier (Stage 3 — needs workshop rubric).  5. Reconciliation (7am) + Feedback loop.  6. Read API + dashboards (live).  7. Availability hardening.

## Working method
- I can't reach the VM directly → I generate **importable n8n workflow JSON** (or SQL); Bilawal runs it on the self-hosted n8n / Postgres and pastes results back.
- Thin slice end-to-end first, then widen. Propose → OK → build on localhost → review → push. Never change mockups without confirming.
- **Never** save client PII (e.g. Monday stakeholder data) to memory or disk.

## Repo map
- `db/` — schema + migrations.  `n8n/` — workflow JSONs.  `api/` — Read API (TS/Node).  `dashboards/` — React app (4 dashboards).
- `CLAUDE.md` — this file.  `STATE.md` — living logbook.  `OPERATING-MODEL.md` — how Tecknuovo works (Workshop 0).  `SIGNAL-RUBRIC.md` — signal definitions, risk/opportunity frameworks, routing, dashboards (Workshop 2).

## Status pointer
See `STATE.md` for what's validated / pending / next.
