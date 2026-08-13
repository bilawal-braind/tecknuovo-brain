-- Projects sourced from the Monday sublists (12 Aug): phantom report-derived
-- projects are RETIRED (hidden from dashboards, history preserved), never deleted.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS retired boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_projects_retired ON projects (retired) WHERE retired;
