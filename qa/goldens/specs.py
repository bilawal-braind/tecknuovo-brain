"""Golden test set — the GROUND TRUTH for evaluating the classifier.

Each scenario is a realistic call across Tecknuovo's actual accounts/pods and call types.
We PLANT a known set of signals (with their expected type/category/severity) plus TRAPS
(lines that should NOT become signals). A transcript is then generated around these lines,
so we know exactly what the classifier *should* find — no manual labelling needed.

Matching at eval time is done on the distinctive `line` phrase, so keep each `line` unique.

Signal fields:
  risk        -> category, likelihood(1-5), impact(1-5)
  opportunity -> networks_total(0-40), who (buyer/influencer/admin — drives strength)
  people      -> (no score)
  update      -> (no score)
Traps: {why, line} — expected NON-signals (flagging one is a false positive).
"""

SPECS = [
    {
        "id": "gold-hmrc-gvms-gov",
        "account": "HMRC", "project": "GVMS New Work Orders", "call_type": "Monthly governance",
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 4, "impact": 4,
             "line": "the third-party data migration has slipped by two weeks and it directly blocks our customs go-live"},
            {"type": "opportunity", "networks_total": 30, "who": "buyer",
             "line": "as the SRO I'd want Tecknuovo to lead a funded Phase 4 to cover the new intermediary module"},
            {"type": "people",
             "line": "our lead back-end engineer is rolling off at the end of the month and we need a backfill"},
            {"type": "update",
             "line": "we pushed the reconciliation module into production this sprint and it passed UAT"},
        ],
        "traps": [
            {"why": "routine cadence, not a risk", "line": "we ran our usual morning stand-ups every day this fortnight"},
            {"why": "praise is positive, not a delivery risk", "line": "the client thanked the team for how smooth the cutover was"},
        ],
    },
    {
        "id": "gold-dwp-health-weekly",
        "account": "DWP", "project": "Health Assessment Digital", "call_type": "Weekly check-in",
        "planted": [
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 4, "impact": 3,
             "line": "the change request for the extra assessment flow still isn't costed so we're building it at risk"},
            {"type": "update",
             "line": "the claimant status API went live in the integration environment on Tuesday"},
            {"type": "opportunity", "networks_total": 18, "who": "influencer",
             "line": "one of the product leads mentioned they might want a Welsh-language version later in the year"},
        ],
        "traps": [
            {"why": "normal agile ceremony", "line": "sprint planning is booked for Monday as always"},
        ],
    },
    {
        "id": "gold-moj-prison-consultant",
        "account": "MOJ", "project": "Prison Video Link", "call_type": "Consultant check-in",
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 3, "impact": 4,
             "line": "we still don't have access to the court test environment and it's holding up all our end-to-end testing"},
            {"type": "people",
             "line": "morale on the team dipped a bit this fortnight because two people were pulled onto another project"},
            {"type": "opportunity", "networks_total": 22, "who": "influencer",
             "line": "the prison ops team said they're reorganising and the video-link scope could grow next quarter"},
        ],
        "traps": [
            {"why": "just a delivery update, no issue", "line": "we closed off five tickets from the backlog this week"},
        ],
    },
    {
        "id": "gold-mod-logistics-gov",
        "account": "MOD", "project": "Defence Logistics Platform", "call_type": "Monthly governance",
        "planted": [
            {"type": "risk", "category": "Regulatory & Compliance", "likelihood": 3, "impact": 4,
             "line": "two of the new joiners still don't have SC clearance so they can't get on the MOD network"},
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 3, "impact": 3,
             "line": "the next statement of work hasn't been signed and the current one expires in three weeks"},
            {"type": "update",
             "line": "we delivered the inventory tracking dashboard and demoed it to the logistics command"},
        ],
        "traps": [
            {"why": "positive people note, not a risk", "line": "the new delivery manager has settled in really well"},
        ],
    },
    {
        "id": "gold-defra-farming-kickoff",
        "account": "DEFRA", "project": "Farming Payments Service", "call_type": "Client kickoff",
        "planted": [
            {"type": "update",
             "line": "we agreed the governance cadence will be a monthly steering group plus weekly delivery calls"},
            {"type": "risk", "category": "Operational Delivery", "likelihood": 3, "impact": 3,
             "line": "the legacy payments data is in poor shape and cleansing it could eat into the first two sprints"},
            {"type": "people",
             "line": "we're onboarding four associates next week and one is still finishing baseline security checks"},
        ],
        "traps": [
            {"why": "scheduling admin", "line": "we'll set up the SharePoint site and invite everyone by Friday"},
        ],
    },
    {
        "id": "gold-nhs-cnwl-weekly",
        "account": "NHS CNWL", "project": "Patient Flow Dashboard", "call_type": "Weekly check-in",
        "planted": [
            {"type": "risk", "category": "Reputational", "likelihood": 3, "impact": 4,
             "line": "the ward managers said the numbers on the dashboard didn't match their counts and they've lost some trust in it"},
            {"type": "opportunity", "networks_total": 26, "who": "buyer",
             "line": "the clinical director said if we fix this she'd fund rolling the dashboard out to three more sites"},
            {"type": "update",
             "line": "we shipped the bed-occupancy view and it's live for the pilot ward"},
        ],
        "traps": [
            {"why": "routine", "line": "we had our fortnightly retro and actions are logged"},
        ],
    },
    {
        "id": "gold-thames-asset-gov",
        "account": "Thames Water", "project": "Asset Management Portal", "call_type": "Monthly governance",
        "planted": [
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 4, "impact": 4,
             "line": "we're now at ninety-five percent of the budget with a month of work still to go so there's a real overspend risk"},
            {"type": "opportunity", "networks_total": 15, "who": "admin",
             "line": "someone from their PMO asked in passing whether we also do mobile apps"},
            {"type": "update",
             "line": "the asset register import is complete and reconciled against SAP"},
        ],
        "traps": [
            {"why": "vendor small talk, weak/no buyer", "line": "we chatted about the water regulator's new reporting rules in general terms"},
        ],
    },
    {
        "id": "gold-neso-grid-consultant",
        "account": "NESO", "project": "Grid Connections Reform", "call_type": "Consultant check-in",
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 4, "impact": 3,
             "line": "the connections data model keeps changing on the client side and it's causing a lot of rework for us"},
            {"type": "people",
             "line": "one of our senior developers has handed in her notice and leaves in four weeks"},
            {"type": "update",
             "line": "the queue-management prototype is working end to end in the demo environment"},
        ],
        "traps": [
            {"why": "normal update", "line": "we refined the backlog and estimated the next set of stories"},
        ],
    },
    {
        "id": "gold-dfe-apprentice-gov",
        "account": "DfE", "project": "Apprenticeships Service", "call_type": "Monthly governance",
        "planted": [
            {"type": "opportunity", "networks_total": 32, "who": "buyer",
             "line": "I hold the budget and I want a proposal to extend you into the employer-portal rebuild next financial year"},
            {"type": "risk", "category": "Operational Delivery", "likelihood": 2, "impact": 3,
             "line": "the accessibility audit found a few issues we'll need to fix before the public beta"},
            {"type": "update",
             "line": "we delivered the funding-calculation engine and it's been signed off by the policy team"},
        ],
        "traps": [
            {"why": "positive, praise", "line": "the minister's office passed on positive feedback about the last release"},
        ],
    },
    {
        "id": "gold-cabinet-forms-standup",
        "account": "Cabinet Office", "project": "GOV.UK Forms", "call_type": "Daily standup",
        "planted": [
            {"type": "risk", "category": "Technical & Cyber", "likelihood": 3, "impact": 3,
             "line": "the penetration test flagged a cross-site scripting issue on the form builder that we need to patch"},
            {"type": "update",
             "line": "the form-templates feature is code complete and in review"},
        ],
        "traps": [
            {"why": "standup routine (did/doing/blockers) — not signals", "line": "yesterday I was on the templates, today I'm on validation, no blockers"},
            {"why": "routine", "line": "no blockers from me either, just carrying on with the API work"},
        ],
    },
    {
        "id": "gold-dvsa-mot-weekly",
        "account": "DVSA", "project": "MOT Modernisation", "call_type": "Weekly check-in",
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 4, "impact": 4,
             "line": "the garage-facing rollout is going to slip past the deadline because the hardware at test centres isn't ready"},
            {"type": "opportunity", "networks_total": 20, "who": "influencer",
             "line": "the service owner hinted there may be new work around the vehicle recall service"},
        ],
        "traps": [
            {"why": "normal delivery update", "line": "we finished the certificate-generation story this week"},
        ],
    },
    {
        "id": "gold-maps-pension-consultant",
        "account": "MaPS", "project": "Pension Dashboard", "call_type": "Consultant check-in",
        "planted": [
            {"type": "people",
             "line": "one of the contractors is rolling off next week and we haven't got a replacement lined up yet"},
            {"type": "people",
             "line": "honestly the team's a bit stretched, a couple of people have been doing long hours to hit the deadline"},
            {"type": "risk", "category": "Regulatory & Compliance", "likelihood": 3, "impact": 4,
             "line": "we're not sure the data-matching approach meets the new pensions regulator guidance and need legal to confirm"},
        ],
        "traps": [
            {"why": "positive morale note", "line": "the team really enjoyed the hack day we ran on Friday"},
        ],
    },
    {
        "id": "gold-vodafone-billing-gov",
        "account": "VodafoneThree", "project": "Network Billing Migration", "call_type": "Monthly governance",
        "planted": [
            {"type": "opportunity", "networks_total": 28, "who": "buyer",
             "line": "the programme director confirmed budget to bring us onto the CRM migration once billing is done"},
            {"type": "risk", "category": "Technical & Cyber", "likelihood": 3, "impact": 4,
             "line": "the data migration dry run showed a number of billing records didn't reconcile and that's a customer-impacting risk"},
            {"type": "update",
             "line": "we cut over the first customer segment to the new billing platform over the weekend"},
        ],
        "traps": [
            {"why": "routine commercial admin", "line": "invoices for last month went in on time and were approved"},
        ],
    },
    {
        "id": "gold-alderhey-theatres-kickoff",
        "account": "NHS Alder Hey", "project": "Theatres Scheduling", "call_type": "Client kickoff",
        "planted": [
            {"type": "update",
             "line": "we walked through the delivery roadmap and agreed the first milestone is the scheduling MVP in eight weeks"},
            {"type": "risk", "category": "Operational Delivery", "likelihood": 3, "impact": 3,
             "line": "access to the theatres system will need an information-governance sign-off which can take several weeks"},
            {"type": "people",
             "line": "the trust is assigning a clinical lead who'll join our weekly calls from next week"},
        ],
        "traps": [
            {"why": "kickoff admin", "line": "we introduced the team and shared everyone's roles and contact details"},
        ],
    },
    {
        "id": "gold-capgemini-cds-consultant",
        "account": "Capgemini", "project": "HMRC CDS Subcontract", "call_type": "Consultant check-in",
        "planted": [
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 4, "impact": 3,
             "line": "our purchase order runs out at the end of the month and the renewal paperwork from the prime hasn't come through"},
            {"type": "risk", "category": "Operational Delivery", "likelihood": 3, "impact": 3,
             "line": "the prime keeps changing the interface spec and it's making it hard for us to finish the integration"},
            {"type": "update",
             "line": "we completed the declarations service integration and handed it to the prime for testing"},
        ],
        "traps": [
            {"why": "routine", "line": "timesheets are all submitted and approved for the month"},
        ],
    },
]
