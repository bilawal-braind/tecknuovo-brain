"""Golden test set — GROUND TRUTH for evaluating the classifier.

15 scenarios grounded in REAL Monday data (real accounts, projects, SOW values, dates,
status, and real delivery managers). Each call has PLANTED signals (the answer key) fitted
to that project's real stage, plus TRAP lines that should NOT become signals. The transcript
is generated around these, so we know exactly what the classifier should find.

Matching at eval time is on the distinctive `line` phrase — keep each `line` unique.
Signal fields: risk -> category, likelihood(1-5), impact(1-5);  opportunity -> networks_total(0-40), who.
context/dm are real Monday facts used only to make the generated call realistic.
"""

SPECS = [
    {
        "id": "gold-thames-contact-centre-gov",
        "account": "Thames Water", "project": "SOW063 - Contact Centre", "call_type": "Monthly governance",
        "dm": "Will Walker",
        "context": {"SOW status": "Approved by Client", "commercial model": "T&M", "SOW value (GBP)": 507300,
                    "start": "2023-06-12", "end": "2024-06-30"},
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 4, "impact": 3,
             "line": "the contact-centre release keeps failing load testing and we're worried it won't handle peak call volumes"},
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 3, "impact": 4,
             "line": "we're close to the end of the SOW value and there's more work than budget left, so we'll need a change request soon"},
            {"type": "opportunity", "networks_total": 26, "who": "buyer",
             "line": "the customer experience director said if this lands she'd fund extending us into the billing journey next"},
            {"type": "update",
             "line": "we deployed the new call-routing flow to production last week"},
        ],
        "traps": [
            {"why": "routine cadence", "line": "we ran the usual weekly demo on Thursday"},
            {"why": "praise, positive", "line": "the client complimented the team on how responsive they've been"},
        ],
    },
    {
        "id": "gold-dwp-debt-weekly",
        "account": "DWP", "project": "Debt", "call_type": "Weekly check-in", "dm": "Sarah Facey",
        "context": {"SOW status": "Approved by Client", "commercial model": "T&M", "SOW value (GBP)": 874680,
                    "start": "2023-07-24", "end": "2024-03-31"},
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 3, "impact": 4,
             "line": "the debt-calculation batch job is running too slowly and it might miss the overnight processing window"},
            {"type": "people",
             "line": "one of our senior developers is going on long-term leave from next month and we'll need cover"},
            {"type": "opportunity", "networks_total": 18, "who": "influencer",
             "line": "someone in the debt team mentioned they may want us to look at the repayments service too"},
            {"type": "update",
             "line": "the new debt-dashboard screens passed accessibility testing this week"},
        ],
        "traps": [
            {"why": "routine ceremony", "line": "sprint review is booked for Friday as usual"},
        ],
    },
    {
        "id": "gold-three-datascience-consultant",
        "account": "Three", "project": "SOW008: Data Science", "call_type": "Consultant check-in", "dm": "Minnie Barnett",
        "context": {"SOW status": "Approved by Client", "commercial model": "T&M", "SOW value (GBP)": 562705,
                    "start": "2024-01-02", "end": "2024-12-31"},
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 4, "impact": 3,
             "line": "we can't validate the data-science models because we still don't have access to the production data lake"},
            {"type": "people",
             "line": "the team's morale took a hit when two contractors were moved onto another Three project without notice"},
            {"type": "opportunity", "networks_total": 20, "who": "influencer",
             "line": "the analytics lead hinted there's appetite for a churn-prediction model next quarter"},
        ],
        "traps": [
            {"why": "normal update", "line": "we groomed the backlog and estimated the next set of stories"},
        ],
    },
    {
        "id": "gold-desnz-hntas-gov",
        "account": "DESNZ", "project": "SOW007 - HNTAS Private Beta", "call_type": "Monthly governance", "dm": "Minnie Barnett",
        "context": {"SOW status": "To be Sent (not yet signed)", "commercial model": "T&M", "SOW value (GBP)": 1386513,
                    "start": "2024-08-12", "end": "2025-02-14"},
        "planted": [
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 4, "impact": 4,
             "line": "the private beta SOW still hasn't been signed and we're already staffing it, so we're working at risk from next week"},
            {"type": "risk", "category": "Regulatory & Compliance", "likelihood": 3, "impact": 3,
             "line": "the service needs a GDS service assessment before public beta and we haven't booked it in yet"},
            {"type": "opportunity", "networks_total": 30, "who": "buyer",
             "line": "the programme SRO confirmed there's budget to take HNTAS through to public beta if the private beta goes well"},
            {"type": "update",
             "line": "we completed the heat-network application form and it's ready for private beta users"},
        ],
        "traps": [
            {"why": "onboarding admin", "line": "we onboarded the new starter to the tooling this week"},
        ],
    },
    {
        "id": "gold-hmrc-gvms-gov",
        "account": "HMRC", "project": "GVMS New Work Orders (June 2023 ->)", "call_type": "Monthly governance", "dm": "Sarah Facey",
        "context": {"SOW status": "Approved by Client", "commercial model": "T&M", "SOW value (GBP)": 4375120,
                    "start": "2023-06", "end": "ongoing"},
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 4, "impact": 4,
             "line": "the third-party data migration has slipped by two weeks and it directly blocks our customs go-live"},
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 4, "impact": 3,
             "line": "until the next phase SOW is countersigned we'd be working at risk from the middle of the month"},
            {"type": "opportunity", "networks_total": 30, "who": "buyer",
             "line": "as the SRO I'd want Tecknuovo to lead a funded extension to cover the new intermediary module"},
            {"type": "people",
             "line": "our lead back-end engineer is rolling off at the end of the month and we need a backfill"},
            {"type": "update",
             "line": "we pushed the reconciliation module into production this sprint and it passed UAT"},
        ],
        "traps": [
            {"why": "routine cadence", "line": "we ran our usual morning stand-ups every day this fortnight"},
            {"why": "praise", "line": "the client thanked the team for how smooth the cutover was"},
        ],
    },
    {
        "id": "gold-dfe-batregister-weekly",
        "account": "DFE", "project": "BAT Register", "call_type": "Weekly check-in", "dm": "Minnie Barnett",
        "context": {"SOW status": "Approved by Client", "commercial model": "T&M", "SOW value (GBP)": 1902268,
                    "start": "2023-06-16", "end": "2023-11-30"},
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 3, "impact": 3,
             "line": "the register data cleanse is behind and it's a dependency for the teacher-services integration"},
            {"type": "opportunity", "networks_total": 24, "who": "buyer",
             "line": "the service owner said if we hit the deadline she'd bring us onto the find-and-apply aggregate work"},
            {"type": "update",
             "line": "the register search API went live in the staging environment"},
        ],
        "traps": [
            {"why": "routine", "line": "the retro actions from last sprint are all logged"},
        ],
    },
    {
        "id": "gold-mod-dms-gov",
        "account": "MOD/DESA", "project": "SOW001 - DMS", "call_type": "Monthly governance",
        "context": {"SOW status": "Approved by Client", "commercial model": "Fixed Price", "SOW value (GBP)": 1064000,
                    "start": "2024-04-08", "end": "2025-04-07"},
        "planted": [
            {"type": "risk", "category": "Regulatory & Compliance", "likelihood": 3, "impact": 4,
             "line": "two of the new joiners still don't have SC clearance so they can't get onto the MOD network"},
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 3, "impact": 3,
             "line": "this is a fixed-price engagement and the client keeps asking for extra reports beyond the agreed scope"},
            {"type": "update",
             "line": "we delivered the logistics data model and walked the client through it"},
        ],
        "traps": [
            {"why": "positive people note", "line": "the new project manager has settled in really well"},
        ],
    },
    {
        "id": "gold-kpmg-spire-consultant",
        "account": "KPMG", "project": "SOW001 - Spire", "call_type": "Consultant check-in", "dm": "Will Walker",
        "context": {"SOW status": "Approved by Client", "commercial model": "T&M", "SOW value (GBP)": None,
                    "start": "2024-04-22", "end": "2024-05-17"},
        "planted": [
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 4, "impact": 3,
             "line": "this SOW ends in a couple of weeks and there's no follow-on agreed, so the team could roll off with nothing lined up"},
            {"type": "people",
             "line": "the client-side lead has been off sick and it's slowing down our sign-offs"},
            {"type": "update",
             "line": "we finished the Spire data mapping and shared it with KPMG"},
        ],
        "traps": [
            {"why": "routine", "line": "timesheets are all submitted for the week"},
        ],
    },
    {
        "id": "gold-netcompany-sedex-kickoff",
        "account": "Netcompany", "project": "SOW001 - Sedex", "call_type": "Client kickoff", "dm": "Will Walker",
        "context": {"SOW status": "To be created (not signed)", "commercial model": "TBC", "SOW value (GBP)": None,
                    "start": "TBC", "end": "TBC"},
        "planted": [
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 4, "impact": 3,
             "line": "we're being asked to start on Sedex but the SOW is still to be created, so we'd be beginning work at risk"},
            {"type": "people",
             "line": "we're mobilising three associates and one of them still needs baseline security clearance"},
            {"type": "update",
             "line": "we agreed the delivery approach and a fortnightly governance cadence"},
        ],
        "traps": [
            {"why": "kickoff admin", "line": "we set up the shared channel and invited everyone this morning"},
        ],
    },
    {
        "id": "gold-thames-cooper-weekly",
        "account": "Thames Water", "project": "SOW058: Platform Modernisation/Project Cooper", "call_type": "Weekly check-in", "dm": "Will Walker",
        "context": {"SOW status": "Approved by Client", "commercial model": "T&M", "SOW value (GBP)": 2140063,
                    "start": "2022-04-01", "end": "2024-03-31"},
        "planted": [
            {"type": "risk", "category": "Technical & Cyber", "likelihood": 3, "impact": 4,
             "line": "the platform migration hit a security finding — some data was being logged in plain text and needs fixing before go-live"},
            {"type": "opportunity", "networks_total": 15, "who": "admin",
             "line": "someone from their PMO asked in passing whether we also do mobile development"},
            {"type": "update",
             "line": "we migrated the first set of services onto the new platform over the weekend"},
        ],
        "traps": [
            {"why": "vendor small talk, no real buyer", "line": "we chatted generally about the water regulator's price review"},
        ],
    },
    {
        "id": "gold-hmrc-hawk-consultant",
        "account": "HMRC", "project": "HAWK Core", "call_type": "Consultant check-in", "dm": "Sarah Facey",
        "context": {"SOW status": "Approved by Client", "commercial model": "Fixed Price", "SOW value (GBP)": 2778780,
                    "start": "2023-04-01", "end": "2024-09-30"},
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 3, "impact": 4,
             "line": "the HAWK release is blocked because we can't get into the HMRC pre-prod environment for testing"},
            {"type": "people",
             "line": "one of our senior engineers has handed in her notice and leaves in a month"},
            {"type": "update",
             "line": "we completed the core matching engine and it passed our internal testing"},
        ],
        "traps": [
            {"why": "routine", "line": "stand-ups happened as normal all week"},
        ],
    },
    {
        "id": "gold-three-analytics-standup",
        "account": "Three", "project": "SOW002: Analytics Team", "call_type": "Daily standup", "dm": "Minnie Barnett",
        "context": {"SOW status": "Approved by Client", "commercial model": "T&M", "SOW value (GBP)": 566390,
                    "start": "2022-08-08", "end": "2023-12-29"},
        "planted": [
            {"type": "risk", "category": "Technical & Cyber", "likelihood": 3, "impact": 3,
             "line": "the pen test flagged an exposed API key in one of the analytics jobs that we need to rotate urgently"},
            {"type": "update",
             "line": "the customer-segmentation pipeline is code complete and in review"},
        ],
        "traps": [
            {"why": "standup routine", "line": "yesterday I was on reporting, today I'm on the pipelines, no blockers"},
            {"why": "standup routine", "line": "no blockers from me either, just carrying on with the dashboards"},
        ],
    },
    {
        "id": "gold-tui-booking-gov",
        "account": "TUI", "project": "SOW002: Manage My Booking", "call_type": "Monthly governance",
        "context": {"SOW status": "Sent to Client (awaiting signature)", "commercial model": "T&M", "SOW value (GBP)": 1120125,
                    "start": "2022-03-30", "end": "2023-04-28"},
        "planted": [
            {"type": "opportunity", "networks_total": 28, "who": "buyer",
             "line": "the digital director confirmed budget to proceed with Manage My Booking once the SOW is countersigned"},
            {"type": "risk", "category": "Operational Delivery", "likelihood": 3, "impact": 3,
             "line": "the booking-amendment flow has a defect that's causing failed transactions in testing"},
            {"type": "update",
             "line": "we delivered the flight-change journey and demoed it to the product team"},
        ],
        "traps": [
            {"why": "routine commercial admin", "line": "invoices for last month went in on time"},
        ],
    },
    {
        "id": "gold-alpha-salesforce-kickoff",
        "account": "Alpha FX", "project": "SOW001: Salesforce ABS", "call_type": "Client kickoff", "dm": "Will Walker",
        "context": {"SOW status": "Sent to Client (awaiting signature)", "commercial model": "T&M", "SOW value (GBP)": 567090,
                    "start": "2023-07-12", "end": "2023-12-12"},
        "planted": [
            {"type": "update",
             "line": "we agreed the first milestone is the Salesforce case-management MVP in six weeks"},
            {"type": "risk", "category": "Strategic & Commercial", "likelihood": 3, "impact": 3,
             "line": "the SOW has been sent but not signed, so we've agreed to hold off starting build until it's countersigned"},
            {"type": "people",
             "line": "the client is assigning a product owner who'll join our weekly calls from next week"},
        ],
        "traps": [
            {"why": "kickoff admin", "line": "we introduced the team and shared everyone's roles"},
        ],
    },
    {
        "id": "gold-britishcouncil-registration-consultant",
        "account": "British Council", "project": "Registration Platform", "call_type": "Consultant check-in",
        "context": {"SOW status": "Approved by Client", "commercial model": "T&M", "SOW value (GBP)": 2053256,
                    "start": "2021-11-01", "end": "ongoing"},
        "planted": [
            {"type": "risk", "category": "Operational Delivery", "likelihood": 3, "impact": 3,
             "line": "the registration platform is getting timeouts under load and we need to investigate before the exam-season peak"},
            {"type": "people",
             "line": "a couple of the team have been doing long hours to keep the platform stable and it isn't sustainable"},
            {"type": "opportunity", "networks_total": 22, "who": "influencer",
             "line": "the product lead mentioned there might be funding to build a candidate mobile app"},
        ],
        "traps": [
            {"why": "routine", "line": "we ran our fortnightly knowledge-share session on Friday"},
        ],
    },
]
