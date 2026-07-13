-- Account-level roles from Monday's "Live Projects and Allocations" board (1599188575):
-- Commercial Accountable -> client_director (previously had NO source anywhere),
-- Commercial Responsible -> client_partner, Delivery Responsible -> delivery_lead_name,
-- Pod -> proper pod names. Synced daily by workflow 4. Run BEFORE re-importing wf4.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS client_director uuid REFERENCES people(id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS delivery_lead_name text;
