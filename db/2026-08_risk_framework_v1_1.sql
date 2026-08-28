-- Tecknuovo Risk Framework 5x5 v1.1 (Apr 2026) - full incorporation into the
-- classifier's knowledge store (Chloe's document, received 19 Aug). Workflow 1
-- injects tn_knowledge.risk_framework into every classification, so this takes
-- effect on the next call with no workflow change. The band arithmetic in
-- workflow 1 (Critical 20-25, High 12-19, Medium 8-11, Low-Medium 4-7, Low 1-3)
-- already matches v1.1 and is unchanged.

-- 20 Aug revision: the first incorporation carried the full worked examples
-- (4.6k chars) and, combined with wider signal context, pushed big-transcript
-- calls over the Azure gpt-4o-mini tokens-per-minute cap (429 rate limits, one
-- call stuck all night). This slimmed version keeps every scoring rule of v1.1
-- at roughly half the tokens. Applied live 20 Aug.

UPDATE tn_knowledge SET content = 'Tecknuovo 5x5 risk framework v1.1 (Apr 2026). Score = Likelihood (1-5) x Impact (1-5), scored INHERENT (before treatment). LIKELIHOOD: 5 Almost Certain (happening or will in most circumstances), 4 Likely, 3 Possible (might occur; a vague or hedged worry is 3 at most), 2 Unlikely, 1 Rare. Be conservative: 5 needs an explicit quote showing it is already happening. IMPACT = the HIGHEST of four dimensions (financial / operational / reputational / regulatory): 5 Severe (loss >GBP 5m, shutdown >4 weeks, national press, prosecution or licence loss), 4 Significant (GBP 1m-5m, major function offline 2-4 weeks, sustained press or major client loss, regulatory investigation), 3 Moderate (GBP 250k-1m, partial outage 1-2 weeks, sector coverage or client concern, formal regulatory action), 2 Minor (GBP 25k-250k, days of degradation, complaint), 1 Negligible (<GBP 25k, <1 day, internal only). BANDS: 20-25 Critical (zero tolerance, immediate escalation, board item - reserve for what the MD must personally see; when in doubt score High), 12-19 High (active mitigation, CLOO review in 2 weeks), 8-11 Medium (monthly monitoring), 4-7 Low-Medium (quarterly review), 1-3 Low (accept and record). Portfolio risks escalate to MD+CLOO within a week; delivery risks to MD at Moderate+. THE 14 CATEGORIES (Technology and AI are separate since Apr 2026): 1 Strategic & Commercial (lost material contracts, missed growth), 2 People & Key Person (senior loss, critical knowledge gaps, attrition), 3 Information Security & Cyber (data breaches, ISO 27001), 4 Regulatory & Compliance (IR35, ICO, certification, procurement debarment), 5 Supplier & Third-Party (freelancer supply, subcontractor failure), 6 Operational Delivery (slips >4 weeks, SLA breach, CNI failure), 7 Financial & Economic (payment disputes, bad debt, client insolvency), 8 Technology (platform outages, shadow IT, systematic data loss), 9 Business Continuity (facility or DR failure), 10 Reputational (press coverage, brand damage), 11 ESG & Sustainability (B-Corp, CSRD, procurement exclusion), 12 Portfolio & Customer Concentration (major account loss, >40% revenue exposure), 13 Growth & Integration (scaling strain, culture erosion, ISO slippage), 14 Artificial Intelligence (client data into public models, unreviewed AI output in deliverables, GDPR).'
WHERE key = 'risk_framework';

-- 26 Aug calibration (Adam: "everything is 48% and High"): 37 of 81 scored
-- risks sat at exactly L4xI3=12. Applied live: a CALIBRATION sentence appended
-- to the knowledge content (score each axis on its own evidence, full 1-5
-- range, never default to 4x3), plus in workflow 1's instructions: the same
-- anti-default rule, a required scoring_basis sentence in every risk's details
-- justifying both numbers against the framework anchors, and speaker gating
-- (a TN person recapping context is never a new opportunity or lead - Will).

-- 28 Aug backlog re-score (Bilawal: the display fix alone left 37 risks at
-- 12/25): every OPEN risk re-scored against framework v1.1 by the calibrated
-- model, temperature 0, with a written scoring_basis each. 70 of 85 changed.
-- Distribution after: 20:1, 12:9, 9:27, 8:1, 6:44, 4:3 (was 37 at exactly 12).
-- Old numbers preserved per signal in details.rescored_from; marker
-- details.rescored = '2026-08-28'. Ran via scripts/rescore-risks.mjs.
