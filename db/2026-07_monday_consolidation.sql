-- Monday consolidation (21 Jul, per the client's board-by-board feedback):
--   dead:   Active SOW's (1126338886), Stakeholder List (5096768090), cadence (1692810780)
--   kept:   Live Projects and Allocations (1599188575)  - org source (wf4)
--           Assigned Associates 2.2 Live (1118885420)   - consultants (wf2, now paginated)
--   added:  Risks, Issues and Incidents (1583443098)    - risk register (wf2)
-- Client directory seeding now comes from HubSpot only (workflow 10, daily 07:30).
--
-- STEP 1 - run now, before wf2's first run: make sure the risks table exists
-- (idempotent; identical to db/schema.sql).
CREATE TABLE IF NOT EXISTS risks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    monday_item_id  text UNIQUE,
    name            text,
    account_id      uuid REFERENCES accounts(id),
    account_name    text,
    project_name    text,
    kind            text,
    likelihood      text,
    severity        text,
    impact_level    text,
    escalation      text,
    status          text,
    treatment_plan  text,
    responsible     text,
    source_refs     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_verified   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_risks_account ON risks(account_id);

-- STEP 2 - stale project cleanup. Run ONLY AFTER (a) the client has updated Live
-- Allocations and (b) the re-imported wf2/wf4 have run once - not before, or account
-- pages look emptier than reality for a few days. Removes projects that came from the
-- dead Active SOW's board and have nothing attached; weekly-report-derived projects
-- ('wr:' prefix) and anything carrying calls or signals stay.
--
-- Preview first:
SELECT p.name, p.account_name, p.sow_status, p.last_verified
FROM projects p
WHERE p.monday_item_id IS NOT NULL AND p.monday_item_id NOT LIKE 'wr:%'
  AND NOT EXISTS (SELECT 1 FROM calls c   WHERE c.project_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id)
ORDER BY p.account_name, p.name;

-- Then delete the same set:
-- BEGIN;
-- DELETE FROM projects p
-- WHERE p.monday_item_id IS NOT NULL AND p.monday_item_id NOT LIKE 'wr:%'
--   AND NOT EXISTS (SELECT 1 FROM calls c   WHERE c.project_id = p.id)
--   AND NOT EXISTS (SELECT 1 FROM signals s WHERE s.project_id = p.id);
-- COMMIT;

-- After wf2's first run, verify the two client complaints are answered:
--   Defra consultant count (was 2, should be ~23):
--     SELECT count(*) FROM associates WHERE account_name ILIKE '%defra%';
--   Risk register landed (Thames Water administration risk should be here):
--     SELECT account_name, name, severity, status FROM risks ORDER BY last_verified DESC LIMIT 20;
