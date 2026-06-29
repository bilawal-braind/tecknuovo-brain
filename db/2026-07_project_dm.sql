-- A: people layer. accounts.pod already exists; add the delivery lead name on projects.
-- Filled by the Monday people-sync workflow (4-monday-people-sync) from the cadence board.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivery_manager_name text;
