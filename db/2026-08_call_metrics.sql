-- Per-call metrics for Delivery Intel (3 Aug 2026). Filled by the updated
-- workflows: duration_seconds from the VTT cue timestamps (workflow 5), tone +
-- call_type from the classifier's whole-call read (workflow 1). Old calls keep
-- NULLs - the dashboard falls back to its estimates for those.
ALTER TABLE calls ADD COLUMN IF NOT EXISTS duration_seconds int;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS tone text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_type text;
