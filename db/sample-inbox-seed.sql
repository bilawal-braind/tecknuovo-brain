-- Seed the inbox with two SAMPLE HMRC transcripts so the Main Pipeline classifies them
-- end-to-end (produces real signals). Re-runnable: ON CONFLICT does nothing.
-- To re-process after a change, first: DELETE FROM inbox WHERE dedup_key IN ('hmrc-gov-2026-06','hmrc-checkin-2026-06');
INSERT INTO inbox (source, dedup_key, payload, status) VALUES
  ('teams','hmrc-gov-2026-06',jsonb_build_object('account','HMRC','title','HMRC GVMS New Work Orders — Monthly Governance (June 2026)','dedup_key','hmrc-gov-2026-06','transcript','HMRC — GVMS New Work Orders — Monthly Governance Call
Date: 26 June 2026
Attendees: Rachel Adeyemi (TN Client Partner), Sarah Facey (TN Delivery Manager), Tom Beckett (TN Delivery Coordinator), David Okonkwo (HMRC Service Owner / SRO), Priya Nair (HMRC Programme Lead)
[This is a SAMPLE transcript generated for testing. Client stakeholder names are fictional.]

Rachel Adeyemi (TN): Morning everyone, thanks for making the June governance. I''ll run the usual template — commercials snapshot first, then delivered-this-period, RAID, value-adds, and actions. David, Priya, please jump in wherever.

David Okonkwo (HMRC): Sounds good, Rachel. We''ve got a hard stop at half past so let''s keep moving.

Rachel Adeyemi (TN): Understood. On commercials — the current SOW is nine point seven three million. As of this period we''re at roughly ninety-three percent spend, so we''ve got about three hundred thousand pounds of headroom left. At the current burn that''s about five to six weeks of runway. I want to flag that clearly because the next phase of work isn''t signed yet.

Sarah Facey (TN): That''s the big one from my side. We''ve scoped Phase 3, the team has the roadmap, but until the Phase 3 SOW is countersigned we''d effectively be working at risk from the middle of July. I don''t want to stand the team down, but I also can''t have people delivering against an unsigned statement of work.

Priya Nair (HMRC): Understood. The paperwork is with our commercial team. I''ll chase it — realistically it''s a two to three week turnaround, which is tight against your runway.

Rachel Adeyemi (TN): Noted, we''ll log that as a commercial risk. Sarah, do you want to take delivered-this-period?

Sarah Facey (TN): Yes. Good news first — we delivered the new Work Orders integration into the GVMS core this sprint, it''s live in the staging environment and passed UAT with the HMRC test team. That was the headline milestone for the quarter and it''s done. We also closed out the reconciliation reporting fixes.

David Okonkwo (HMRC): Credit to the team on the integration, genuinely. The way Sarah''s group handled the cutover was the smoothest we''ve seen on this programme. Please pass that on.

Sarah Facey (TN): Thank you, that means a lot to the team. Now the not-so-good — the data migration for the historical declarations has slipped. We were due to complete it this period but our third-party data provider missed their delivery of the cleansed extract twice. Likelihood we slip further is high, and the impact is high because the go-live for the customs reporting module depends on it. Realistically that''s a two week slip.

Priya Nair (HMRC): That''s concerning. What''s the mitigation?

Sarah Facey (TN): We''ve escalated to the provider and put a daily check-in in place. Tom''s owning the tracker. If we don''t have the extract by the tenth of July we''ll need to look at a manual interim load, which isn''t ideal but protects the go-live date.

Tom Beckett (TN): Just to add — there''s also a security review finding from HMRC''s side. The pen test flagged that one of our API endpoints wasn''t enforcing the mutual TLS policy correctly. It''s medium severity, we''ve already got a fix in the next release, but I wanted it on the RAID log because it''s a compliance item.

David Okonkwo (HMRC): Good, keep that visible. Anything on people or the team?

Sarah Facey (TN): Yes, a couple of things. James, one of our senior back-end consultants who''s been on GVMS since the start, is rolling off at the end of July — he''s moving to another programme. We''re backfilling and I''ll have a handover plan. On the positive side we''ve got a new business analyst, Aisha, joining the team on the fifteenth, which will really help with the reporting workstream. The one issue is her SC clearance is still pending — it''s been six weeks and if it doesn''t come through she can''t start on site, so that''s a risk to the reporting timeline.

Rachel Adeyemi (TN): Let''s log the clearance delay. Now value-adds and forward look — David, Priya, anything coming down the line for us?

David Okonkwo (HMRC): Actually yes. There''s a strong appetite from the wider directorate to extend GVMS to cover the new customs intermediary module in Q3. It''s not formally funded yet but I''m the budget holder and I''d want Tecknuovo to lead it given how this phase has gone. Can you put together an indicative shape and cost?

Rachel Adeyemi (TN): Absolutely, that''s exactly what we''d want to hear. We''ll pull together an indicative proposal.

Priya Nair (HMRC): And separately — smaller — the operations team have been asking for a self-serve reporting dashboard on top of the reconciliation data. That''s new scope, probably a few weeks of work, but there''s a real need there.

Sarah Facey (TN): We can shape both. The reporting dashboard could actually reuse a lot of what we''ve already built, so that''s efficient.

Rachel Adeyemi (TN): Great. Actions then: I''ll get the indicative Phase 3-plus-intermediary shape to David; Priya to chase the Phase 3 SOW countersignature; Sarah to own the migration mitigation and the SC clearance follow-up; Tom to keep the RAID log current. Decision logged: we proceed with the manual interim load as contingency if the extract isn''t in by the tenth. Anything else? No? Thanks all.
'),'pending'),
  ('teams','hmrc-checkin-2026-06',jsonb_build_object('account','HMRC','title','HMRC GVMS New Work Orders — Consultant Check-in (June 2026)','dedup_key','hmrc-checkin-2026-06','transcript','HMRC — GVMS New Work Orders — Fortnightly Consultant Check-in
Date: 24 June 2026
Attendees: Tom Beckett (TN Delivery Coordinator), Marcus Reid (Consultant, Front-end), Elena Popescu (Consultant, Back-end), Daniel Osei (Consultant, QA/Test)
[This is a SAMPLE transcript generated for testing. This is a DC ↔ consultants check-in — no commercials discussed.]

Tom Beckett (TN DC): Thanks all for joining the fortnightly. Usual agenda — delivery updates, any risks or blockers, team dynamics, and anything you''re hearing from the customer side. Marcus, want to kick off?

Marcus Reid (Consultant): Sure. Front-end wise, we finished the Work Orders screens and they went into the integration release, so that''s done and dusted. This fortnight I''m on the reconciliation views. No blockers on my side, though I''ll flag I''m a bit stretched — I''m effectively covering two workstreams since James started winding down his handover.

Tom Beckett (TN DC): Noted, thanks Marcus — I''ll come back to capacity. Elena?

Elena Popescu (Consultant): Back-end, the integration is live in staging which is great. My blocker is the test environment — I still don''t have access to the HMRC pre-prod environment for the migration testing. I raised the request nearly two weeks ago and it''s stuck on their side. Until that''s sorted I can''t validate the migration scripts properly, and that''s on the critical path for the customs reporting go-live.

Tom Beckett (TN DC): That''s an important one. I''ll escalate the environment access today — that''s a delivery risk if it drags on because it holds up the migration validation. Daniel, QA?

Daniel Osei (Consultant): Testing''s in decent shape. UAT for the integration passed. One thing — the volume of regression tests is growing and it''s mostly manual right now. If we get the reporting module as well we''ll need to think about automation, otherwise QA becomes a bottleneck. Not urgent this fortnight but worth flagging.

Tom Beckett (TN DC): Good, I''ll note it. On team dynamics — Marcus, you mentioned being stretched. How are you all feeling on workload generally?

Marcus Reid (Consultant): Honestly, morale''s good, the integration going well gave everyone a lift. But if James rolls off and we don''t backfill quickly, front-end is going to be thin. It''s manageable for a few weeks, not longer.

Elena Popescu (Consultant): Agreed, the team''s in a good place. One thing I picked up from the client stand-up — HMRC are reorganising the customs directorate next quarter, and the team we work with is going to merge with another group. Nothing confirmed, but it sounds like the scope of what they''ll want from us could grow.

Tom Beckett (TN DC): That''s really useful, thank you Elena — I''ll pass that up to Rachel and Sarah because that could be relevant commercially. Right, actions: I''ll escalate Elena''s pre-prod access today, flag the front-end capacity risk around James rolling off, note the QA automation point for when the reporting module lands, and pass on the directorate reorg. Anything else? Great, thanks everyone.
'),'pending')
ON CONFLICT (dedup_key) DO NOTHING;
