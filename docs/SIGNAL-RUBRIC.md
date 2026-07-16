# Signal Rubric, Routing & Dashboards (from Workshop 2)

> The classifier spec + routing model. From Workshop 2 (signals/dashboards). Pointed to from `CLAUDE.md`.
> ⚠️ **Frameworks here are in active revision** (risk matrix 3×3→5×5 "this week"; opportunity framework under review "tomorrow"). Build them **configurable/swappable**, never hardcoded.

## Core principles (how signals really work here)
- A **signal** attaches to a **project**, comes out of a **call**, and **one call can have multiple signals** (e.g. a risk + an opportunity together).
- Risks/opportunities are **identified throughout the engagement** (in DCs'/DMs'/CPs' heads, across all calls) — not "discovered" at the governance call. If something first surfaces at governance, that's a *failure*. → **The brain's value = catching signals as they're said, across every call type**, not just the formal ones.
- **Precision over recall:** don't surface 100 opportunities where only 10 are real. Tune for trust.

## Terminology gotcha (important)
- **DC = Delivery Coordinator** (junior PMO / Portfolio function) — runs check-ins with the **consultants**. **NOT "delivery consultant."** (The old vision doc mislabelled D1 as "Delivery Consultant.")
- **"Consultants" = the contractors / associates** delivered on engagements.
- **DM = Delivery Manager** (permanent TN staff, runs project delivery).

## Call cadences (refines WS1)
- **DC ↔ consultants check-in** — fortnightly (varies). Group call (whole project team), not 1:1. Agenda: risks, delivery updates, team-dynamic feedback, key customer updates (project/staffing/org changes). **Most valuable when there's no permanent DM** (only signal source there).
- **Monthly governance** — CP/CD + customer stakeholders (+ permanent DM; consultant-DM excluded — commercially sensitive). RAID log discussed here.
- **Weekly/fortnightly customer check-in** — delivery status (DM and/or CP + customer).
- **Daily standup + Sprint ceremonies** — project team only (no CP/CD).

---

## 🟢 Opportunity
**In one line:** anything that needs a **commercial action** (sales/engagement).
**Examples:** project extension (first we're hearing of it); new work/requirement; a stakeholder describing a problem we didn't know about; capacity shortfall → add roles (more revenue); org change (e.g. teams merging → scope grows); a **new person entering a role** (trigger an intro, esp. if a buyer); customer policy/tooling change (security/regulatory) needing a response.
**Strength depends on WHO said it** — must come from someone with **budget/buying power/influence**. **HubSpot tags contacts as buyer / influencer / administrator.** Buyer says it → high priority; admin says it → low. → *Opportunity scoring needs the HubSpot contact role → enrichment must pull HubSpot.*
**Qualification:** existing-customer opps run through a **"need pipeline"** scored **0–5** on a criteria framework (acronym ~**NETWORKS**: Need, Effort, Time, …, Originality, Resources, Competition, Sign-off). New work uses MQL→SQL. *(Framework changing — keep configurable.)* Run signals against **their** framework rather than inventing an AI score.
**Mostly identified on external/customer calls** (not internal).
**Routing nuance:** **extensions** = low-ceremony, "done and dusted" (don't force full qualification); **big strategic/commercial** opps = full visibility + human approval.
⚠️ **HubSpot write-back:** they want a thumbs-up → push the opp into HubSpot as a **deal** (build a HubSpot integration). **This is an outward ACTION — conflicts with the display-only golden rule.** See Open Decisions.

## 🔴 Risk
**In one line:** anything that threatens a **sale/SOW (SAL)** or our **reputation**.
- **Reputation** = deliverable quality/pace, team way of working, communication. **SAL** = missed deadlines, financial impact. We can *cause* a risk or be the *result* of the customer's.
- **Classification (their framework):** ~**13 categories** (delivery, commercial, reputational, compliance, cyber, …). Decision rule: **commercial impact? → commercial risk (portfolio-monitored); else → delivery/portfolio risk.** (e.g. hits SOW deliverable but not payment = delivery; hits payment = commercial; team starts with no signed SOW = commercial "working-at-risk"; missed IR35 assessment = compliance.)
- **Scoring:** **severity × likelihood** matrix, moving **3×3 → 5×5**. Maps to **5 escalation levels** (non-escalation → Accountable → Director → MD → …). Some categories auto-escalate: **AI risk = auto level-4 → straight to Sara (CLO) + Katie.**
- **Each risk also carries:** a **mitigation/monitoring plan** + a **check-in date** (when you must update it). RACI: who **found** it (owns updates/docs), who's **responsible** commercially (CP), who must be **aware/own** it (Sara / Katie / CP by severity).
- **Design implication:** the **LLM classifies** (category + severity + likelihood + who/what); a **deterministic rule engine** computes the escalation level + routing from their matrix. Don't let the LLM invent the score.
- Risk log lives in **Monday** today (best-structured dataset they have); tooling may change — keep the data schema consistent regardless of platform.

## 🟢 Opportunity framework (RECEIVED — "NETWORKS Qualification Guide")
Score **8 components 0–5 each**; sum = confidence the opportunity will succeed.
- **N — Need:** clear/pressing need tied to client (UK Gov) strategic priorities.
- **E — Effort:** effort to deliver (low effort → high score).
- **T — Timeline:** clear, gov-aligned deadline (fiscal year Apr–Mar, procurement cycles).
- **W — Who:** key decision-makers identified & engaged (champions = 5). ← maps to **HubSpot buyer/influencer tags** (who raised it).
- **O — Originality:** uniqueness/innovation vs competitors.
- **R — Resources:** do we have the people/skills/capacity to deliver.
- **K — Kompetition:** competitive position (minimal competition = 5).
- **S — Sign-Off:** closeness to final approval.
- **Bands:** 0–14 = low (qualify out/delay) · 15–24 = moderate (more work) · 25–35 = high (proceed).
- *(Note: 8×5 = 40 max but the guide caps bands at "closer to 35" — minor inconsistency; treat thresholds as **configurable**, they may revise.)*
- **How the brain uses it:** LLM extracts the opportunity + scores each component from the call + context (esp. **W** from HubSpot); deterministic sum → band → surface for human thumbs-up. Replaces the earlier placeholder.

## 🔴 Risk framework (RECEIVED — "5×5 v1.1", Apr 2026)
The actual framework PDF. **This supersedes the placeholder above.**
- **Score = Likelihood (1–5) × Impact (1–5).** Assessed **inherent** (before controls) and **residual** (after). Impact = the **highest** of 4 dimensions: Financial / Operational / Reputational / Regulatory-Legal.
- **Likelihood:** 1 Rare · 2 Unlikely · 3 Possible · 4 Likely · 5 Almost Certain.
- **Impact:** 1 Negligible (<£25k) · 2 Minor (£25k–250k) · 3 Moderate (£250k–1m) · 4 Significant (£1m–5m) · 5 Severe (>£5m / existential).
- **Bands (5):** **CRITICAL 20–25** (red, zero-tolerance, board) · **HIGH 12–19** (amber, CLOO review ≤2wks) · **MEDIUM 8–11** (yellow, monthly, CLOO-owned) · **LOW-MEDIUM 4–7** (quarterly, function-owned) · **LOW 1–3** (green, accept). *(These 5 bands = the "5 escalation levels" Chloe described.)*
- **14 categories** (was 13 Jan-26; AI split from Technology Apr-26): 1 Strategic & Commercial · 2 People & Key Person · 3 Information Security & Cyber · 4 Regulatory & Compliance · 5 Supplier & Third-Party · 6 Operational Delivery · 7 Financial & Economic · 8 Technology · 9 Business Continuity · 10 Reputational · 11 ESG & Sustainability · 12 Portfolio & Customer Concentration · 13 Growth & Integration · 14 Artificial Intelligence (has 14 sub-risks AI-01..AI-14).
- **Escalation/ownership by register** (→ maps to our dashboards):
  - **Operational Delivery** → Delivery Leads own; **MD escalation for Moderate+** → *Delivery dashboard* (+ Leadership at Moderate+).
  - **Customer Portfolio** → MD/Head of Portfolio; **MD+CLOO within 1 week** → *Client Partner / Portfolio* (+ Leadership).
  - **Any HIGH/CRITICAL** → Leadership (Katie/MD) + CLOO (Sara) always; Critical = board item.
  - **AI risk** → CLOO/IT; Board for High+; CLOO within 48hrs for Critical (auto-priority in current climate).
- **Build split:** LLM extracts `category + likelihood + impact (+ which dimension) + inherent/residual + mitigation`; **deterministic engine** computes `score → band → escalation → dashboard routing`. Never let the LLM invent the band.

## 🔵 Delivery update
**In one line:** anything about a **project's progress** — what we did vs what we said we'd do (in- or out-of-SOW scope), plus anything impacting it.
- Sources: **Friday weekly delivery-summaries form** → Kira's reporting; **monthly governance pack**; **Sprint reports** (customer-facing); **6-monthly delivery report** (3-pronged: consultant + customer + delivery feedback → RAG; accounts learn from each other).
- **A risk is also a delivery update; an opportunity is NOT** (opportunity is by definition outside delivery progress).

## 🟡 People (loosely defined — weakest bucket)
They were unsure this deserves equal status; **no dedicated People dashboard.** Candidates: org/team change, new client stakeholder, **sentiment**, **associate performance** (6-weekly review, scored /5 on TN values + customer feedback + 1 more → "superstars / ones to watch"), **capacity/bandwidth** (quarterly MS Form). **Tentative decision:** treat People as a **single sentiment/people flag**, not a full fourth pillar. *(Confirm with client.)*

## Cross-cutting flags (not full signals, but they want them)
- **Value-add** — work done **outside the SOW** (above & beyond, e.g. apprentices on-site free, a scoping workshop). Comes via delivery updates. Fine line vs scope creep and vs opportunity.
- **Customer feedback** — **positive → "win of the week"** (Slack shout-out / testimonials); **negative → captured as a risk.** There's a Monday **"feedback & complaints"** board (also used for audits).
- Likely surfaced in a **Friday AI summary** a human skims (thumbs-up → Slack), rather than as new top-level signal types.

---

## Dashboards & routing (confirmed)
Three role layers + Client Partner + Observability (**no People dashboard**):
- **DC (Delivery Coordinator)** — a **pre-call brief**: "last bi-weekly you raised X — follow up on these" + talking points. *Distinct* from the Delivery dashboard (DC = junior, manages consultant chats).
- **Delivery** — audience **Kira** (Kaitlyn some visibility). Shows **delivery risks**.
- **Client Partner** — one view per CP/CD, who click into **their own accounts** (account-level risks). The **rolled-up version = the Portfolio view** (Chloe + Meesha).
- **Leadership** — **Katie**. Escalated risks / everything that reaches leadership level.
- **Observability** — **not a dashboard, a QA/human-in-the-loop review capability.** Reviewers: Meesha, Kira, Kaitlyn, Chloe. Shows the **reasoning/logic** behind each decision; misclassification → relabel → loops into training.
- **Metrics wanted:** live projects, **SOW spend vs budget**, **# consultants per project ("runners")** — pulled from **Synergist** (Chloe's reporting). Revenue/spend per project + live-consultant count.
- **Branding:** on-brand ("right shade of blue"), happy with the look.
- Brief delivery (email / Slack / in-dashboard) = a final, flexible tweak.

## Open decisions / dependencies
1. ⚠️ **HubSpot write-back (opp → deal on approval)** — conflicts with **display-only**. Decide: Stage-2/banked vs an explicit in-scope add-on (HubSpot *was* a SOW variable cost). **Needs Bilawal/client decision.**
2. **People signal** — keep as a loose sentiment flag or drop as a pillar? Confirm.
3. **Frameworks incoming** (Chloe to send): the **13-category risk framework + 5×5 matrix + 5 escalation levels**, and the **opportunity qualification** criteria. Both **under revision** → build configurable.
4. **Value-add & customer-feedback** — model as signal **subtypes/flags**, surfaced in the Friday summary.
5. **Risk routing table** (category → which dashboard + escalation → who) — finalise once the framework arrives.
