-- B: capture the commercial position the brain hears on governance calls.
-- budget_remaining (£) is written by the pipeline; spend + burn % are derived from it
-- against the project's sow_value in the Read API. Safe to re-run.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_remaining numeric;
