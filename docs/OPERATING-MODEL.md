# Tecknuovo Operating Model (from Workshop 0)

> How Tecknuovo actually works — the "static" knowledge the second brain models. Captured from the Workshop 0 / context session. Reference doc; pointed to from `CLAUDE.md`.
> _No client PII stored here (client stakeholder contacts live only in Monday)._

## The four functions
- **Delivery** — where projects are *run* on the ground, day-to-day with the customer ("the **how** + **who**"). Headed by **Kira Battersby (Client Delivery Director)**. Staffed by **Delivery Managers (DMs)** — internal Tecknuovo employees.
- **Engagement** — owns customer **relationships + commercials** ("the **what** + **how much**"). No single engagement director.
- **Portfolio** — internal process layer: how new customers/work are mobilised, tagged, kept consistent, and handed over between Engagement and Delivery ("the oil in the cogs"). Works closely with Talent.
- **Talent** — separate area; sources/hires consultants ("associates"). Hires via **Pinpoint**.
- (**Finance** — uses **Synergist** for resource bookings/accounts/projects.) (**Leadership/MD = Katie Carruthers**.)

## Roles (Engagement account-ownership hierarchy)
- **Client Director** — owns a **pod** of accounts; growth-focused; manages key accounts. (Some people, incl. Kira, do this on top of another role.)
- **Client Partner (CP)** — account management, commercials, relationships; less growth-focused. One CP can own **multiple** accounts.
- **Client Manager (CM)** — most junior account role (only one currently); owns one/multiple accounts or supports a bigger one.
- **Delivery Manager (DM)** — internal TN; runs project delivery. **Not every account/project has a DM** — only where we deliver "proper outcomes-based work." Resource-only engagements (e.g. a single consultant) have **no DM**.
- Seniority is assigned by **account size/complexity** (simpler account → less senior owner; escalations go up to the client director).

## Pods (customer groupings — "target state")
- **Central Gov 1**, **Central Gov 2** (split), **HMRC** (its own pod — large, many projects), **Utilities / Healthcare / Education**.
- Each pod has a **client director** owner (e.g. Annette; Jess owns Utilities/Healthcare/Education; Kira owns one). HMRC is large enough to stand alone.
- Accounts (validated from Monday) sit under these pods: DWP, MOJ, MOD, Cabinet Office, DEFRA, DVSA, GVMS, Hawk, KMS, DfE, MaPS, NHS (CNWL / K+R / Alder Hey), VodafoneThree, Thames Water, NESO (+ partner orgs Capgemini, Netcompany).

## The delivery flow (trigger → delivery)
1. **Sales** (Ryan, Sales Director) tracks deals in **HubSpot**. **Closed Won** → leaves sales, handed to Engagement + Delivery.
2. Team **shaped** (e.g. 4 devs, 1 tester, 1 BA, land in 2 weeks). **Talent** sources via **Pinpoint**; DM runs a **values call** (technical vetting done by specialist associates). Clearance: **BPSS / SC** (Portfolio + Talent coordinate).
3. **Mobilisation** — Monday.com **"Project Mobilization"** board (role-segmented: delivery coordinator / client partner / delivery lead). Captures IR35 status, clearance, commercial model, etc.
4. **Sprint Zero** (pre-dev): definition of ready/done, RACI, set up in SharePoint or customer site; Agile ceremonies (stand-ups, sprint planning, retros, demos, backlog refinement — 2-week sprints); governance setup; tooling (e.g. MOD = own Jira; or client-laptop tooling: Azure DevOps / Jira / Monday / Excel).
5. **Delivery** begins.

## Source of truth & documentation reality (critical for the brain)
- **Statement of Work (SOW) + deliverables = the contract source of truth.** DM builds a roadmap from SOW deliverables (Jira roadmap / Gantt in Excel), agreed with stakeholders.
- **Project docs live wherever the customer allows** — Excel on customer site, Jira, Monday, customer SharePoint. **No single standard location, usually no internal mirror.** Sometimes a **Confluence page per account** (not standard). → **Implication:** don't try to pull client-system project docs initially (too much complexity / access). Rely on SOW + calls + Monday + SharePoint + HubSpot.
- **HubSpot** = account/pre-sales info: project name, what's sold, price, team size, emails tagged to contacts. (Cluttered pre-close — use only post-Closed-Won.)
- **Staffing (consultants-on-project)** = Monday.com **"assigned associates" tab**: associate names, contract dates, which project, their client partner. **Moving to Synergist** (finance). → *This answers our earlier open question of where staffing lives.*
- **Spend/commercials** = SOW budget + **monthly governance call** (SOW burn, headroom, ramp up/down) + HubSpot price. → *spend isn't one clean field; it's assembled from these.*

## Call types (the tributaries → ranked by signal value)
- **Kickoff** (one-off): internal onboarding (associates + TN ways of working), then **client kickoff** (meet client service owner/SRO + team; present governance cadence, invoicing/sign-off dates).
- **Daily standup** (in-project): did / doing / blockers. Usually TN team only (DM + associates); sometimes client joins.
- **DM ↔ stakeholder check-ins** (frequent, ad hoc).
- **Weekly report** (Friday): delivered this week, focus next week, **RAID** (risks/assumptions/issues/dependencies).
- **Monthly governance call** ⭐ (richest): TN template — commercials snapshot (SOW burn, headroom), associate ramp up/down, delivered this period, **RAID log**, **actions log**, **decision log**, **value-adds** (extra deliverables beyond SOW = opportunity signals). Attendees: client + CP/director + delivery coordinator + (usually) DM.
- **Internal TN — Monday 9am standup** (15 min, per pillar): a Monday.com board, **one line per SOW** — goals for the week, events this week. Revisited **Friday stand-down** (goals achieved?).

## Internal reporting flow
- DMs submit a **weekly form in SharePoint** (Friday): customer + project title, week-ending, **RAG status**, phase, summary, highlights, lowlights, next-week priority, risks/issues.
- **Power Automate** generates a **portfolio report Monday 8am** → this is what **Katie (leadership)** sees. **Only covers projects with a Technovo DM.**
- **Gap:** consultant/associate-led accounts (no TN DM) have **no structured reporting** — weekly updates go via email/PowerPoint, ideally saved to SharePoint but inconsistent. → For these, **calls are the primary/only signal source**. Plus **in-person & client-laptop calls can't be captured** → affects "capture coverage."

## Systems map
| System | Use |
|---|---|
| **HubSpot** | CRM — deals, account info, price, team size, tagged emails (post-Closed-Won only) |
| **Monday.com** | Project Mobilization board; internal Monday-standup board (1 line/SOW); assigned-associates tab (staffing) → migrating to Synergist |
| **Synergist** | Finance resource bookings (replacing Monday for associate↔project) |
| **SharePoint** | Weekly project report forms + Power Automate Monday-8am portfolio report; weekly report deposits |
| **Pinpoint** | Talent hiring |
| **BambooHR** | HR system + org chart (Katie's function + Kira's team) |
| **Jira / Azure DevOps / Excel** | Delivery tooling — often on **client** systems |
| **Confluence** | Occasional per-account pages (not standard) |
| **Power Automate** | Generates the SharePoint Monday-8am report |

## Data-source map — where every piece the brain needs actually lives
| Data the brain needs | Source of truth | Via | Status |
|---|---|---|---|
| Accounts (client list) | Monday **Stakeholder List** `Account` column | Monday API | ✅ validated, synced to `accounts` |
| Account → TN owner (CP/CD/CM) | Monday **Stakeholder List** `DC/DM` person col + BambooHR org chart | Monday API | ✅ accessible |
| Pods & pod ownership | Org structure (BambooHR / internal mural) | manual / BambooHR | partial — confirm from org chart |
| Consultants-on-project ("runners") | Monday **"assigned associates" tab** → migrating to **Synergist** | Monday API (board id TBC) / Synergist | ⏳ find board / Synergist later |
| **Projects** (real client delivery) | **Not cleanly in Monday** (Portfolio Projects = internal; Projects Overview = demo). Scattered on client systems; **Synergist** tracks live projects | Synergist | ⏳ gap — Synergist emerging |
| SOW (source-of-truth doc) | TN SharePoint or customer site | SharePoint API / manual | ⏳ SharePoint pending |
| Roadmap / plan | Jira / Excel / Monday — **often on CLIENT systems** | — | ❌ don't pull client systems (v1) |
| Spend / commercials | SOW budget + monthly governance pack + HubSpot price + **Synergist** (invoices) | assembled | ⏳ no single field |
| Contacts + **buyer/influencer/admin tags** | **HubSpot** | HubSpot API | ⏳ needed for opportunity scoring |
| Deals / sales pipeline | **HubSpot** | HubSpot API | ⏳ (also opp write-back target) |
| Weekly delivery status | SharePoint weekly form → Power Automate → **Monday-8am report** (TN-DM projects only) | SharePoint API | ⏳ |
| **Risk log** | Monday risk board (3×3 → 5×5) | Monday API (board id TBC) | ⏳ best-structured dataset |
| Customer feedback / complaints | Monday **"feedback & complaints" board** | Monday API (board id TBC) | ⏳ |
| Call transcripts (the main tributary) | **MS Teams via Graph** `getAllTranscripts` | Graph API | ⏳ secret pending |

> **CORRECTION (full Monday inventory, 25 Jun):** the earlier "projects/spend/staffing not in Monday" verdict was based on a 5-board sample and was **wrong**. A full crawl of Delivery/Talent/Business-Ops hubs shows Monday holds **far more than expected** — staffing, live SOWs, rates, the risk log, feedback, pods, per-account call-notes. Synergist is still the *future* home for finance, but **most of what we need is in Monday today.**

## Monday board allow-list (high-value, from full inventory)
_Curated targets to sync — ignore the 100s of noise boards (IT, marketing, onboarding, vibes)._
**Static memory / org**
- Accounts → `5096768090` Delivery Account Stakeholder List
- **Pods → `5096476533` Pod Goals** (123 items) ← the pod board
- Owners (CP/DC/DM) → Stakeholder List + `1574271602` RACI
- **Staffing ("runners") → `1118885420` Assigned Associates 2.2 Live** (1081 items) ← associate↔project↔dates↔CP
**Commercials**
- **`1126338886` Active SOW's** (79) + `1176547739` Expired SOW's
- `1599021999` SoW and CR Tracker 2.0 (578) · `1142351127` Rate Tracker (296) · `1909013412` Rate Change
- `1388371950` Key Commercial Terms – Customer Frameworks · `5089131608` Contract Tracker (Aladdin)
**Live engagement master**
- **`1312375190` Engagement & Delivery Tracker (Live Service)** (3505 items — likely the live SOW/engagement master)
**Risk log**
- **`1583443098` Risks, Issues and Incidents** (450) + `1584698710` Standing Risk and Issue Register
**Delivery reporting**
- `1129700088` Delivery Report Tracker (70 + 760 subitems) · `1390166529` Portfolio Reporting (337)
**Feedback / satisfaction (people)**
- **`1276401714` Customer Complaint&Feedback Log** (43) · `1788738231` DSAT/ESAT/CSAT · `1786089608` Professional satisfaction
**Call-notes trackers (signal-rich even pre-transcript)**
- Per-account: `2084019353` KMS · `1677497535` Three · `5084210444` DWP · `2087281677` DFE · `1422589999` DESNZ · `2087300110` B&T Platform Services · `2087322081` Accenture · Thames Water / MOD / NoA / KPMG / Alpha / Kainos catch-ups
**Decisions / lessons / briefs**
- `5094257054` Delivery Decision Log · `1631069418` Delivery Lessons Learnt · `1323468680` Key Decisions & Open Q · `1642509162` Client Crib Sheet (account briefs)
**Mobilisation (sprint-zero, per account)**
- DEFRA / DFE / MaPS / NESO / HMRC AI / Cab Off / MOD Mobilisation boards

**The "intricate reporting layer" = an overlapping hierarchy:** daily standup → Friday weekly form → Power-Automate **Monday-8am report** → monthly governance pack → **6-monthly** delivery review → quarterly capacity form → **6-weekly** associate performance review. It's duplicated and unconsolidated — part of the brain's value is **consolidating it from the calls**.

## Call enrichment sequence (the "second brain" dynamic layer)
When a transcript lands in `inbox`, before classifying we **wrap it in context**:
1. **Identify** the call → account/project (meeting title, attendees, organiser → match `accounts`/`projects`).
2. **Attach account context** from memory (Postgres, sourced from Monday): pod, owner (CP/CD/CM), associates on project, contract/SOW info.
3. **Attach project context**: SOW deliverables (if held), recent signal history + open risks for that account (the growing memory).
4. **Attach HubSpot context** (for opportunity scoring): is the speaker/stakeholder a **buyer / influencer / admin**?
5. **Attach relevant past feedback** (two-tier retrieval).
6. → enriched bundle → **gpt-4o-mini classifier** → signals.
7. **Risk signals** → deterministic **5×5 engine** (category + L×I → band → escalation → route).
8. **File** signals onto the tree; **route** to dashboards.

## Access / routing map (who sees what)
- **Delivery dashboard** → **Kira** (+ Kaitlyn): Operational-Delivery risks, delivery updates, capacity/runners; DC pre-call briefs feed up.
- **DC view** → pre-call brief for the junior Delivery Coordinators (their consultant check-ins).
- **Client Partner dashboard** → each CP/CD sees **ONLY their own accounts** (row-level by owner): account-level risks, opportunities, health.
- **Portfolio view** → **Chloe + Meesha**: the **rolled-up** version of all CP views = everything across accounts.
- **Leadership** → **Katie (MD) + Sara (CLOO)**: **escalated only** — HIGH (12–19) + CRITICAL (20–25) across all categories, AI risks, portfolio health, opportunity pipeline.
- **Observability** → QA/human-in-the-loop (Meesha, Kira, Kaitlyn, Chloe); shows reasoning; corrections train the model.
- **Access control** = row-level by account ownership (CP → own accounts; CD → own pod; leadership → all) — enforced by the Read API (role-based authz).

## Compliance note (Acceptable Use Policy v3.1 + Risk cat 14 / AI-02)
Our system is "an AI tool processing client data," so it **must** be: in-tenant (Azure OpenAI only, **no public models** — submitting client data to a public model = risk **AI-02, L4×I5=20 Critical**), approved by the compliance hub, MFA'd, data-residency-compliant (UK GDPR / DPA 2018). **We are already aligned** (Azure tenant, gpt-4o-mini in-tenant, display-only). Worth stating explicitly in handover.
