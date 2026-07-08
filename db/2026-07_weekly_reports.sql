-- Weekly delivery reports, parsed from the Power-Automate-generated portfolio HTML
-- (SharePoint: Reporting Efficiency / "Generated Report" / WeeklyStatus_YYYY-MM-DD.html).
-- One row per PROJECT SECTION per week, written by workflow "9 — Weekly report sync"
-- (Mondays 08:00 — an hour after their 07:05 generator). The Main Pipeline's context
-- step attaches the call account's most recent rows to the classifier prompt.
-- Run BEFORE importing workflow 9 and the updated Main Pipeline.
CREATE TABLE IF NOT EXISTS weekly_reports (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id       text,                          -- SharePoint driveItem id
    week_ending   date NOT NULL,
    project_title text NOT NULL,                 -- section heading, e.g. "GVMS Delivery Summary"
    account_id    uuid REFERENCES accounts(id),  -- matched via accounts -> projects fallback (nullable)
    account_name  text,                          -- raw client_directory name match, if any
    rag           text,                          -- red | amber | green | grey
    customer_lead text,
    phase         text,
    summary       text,
    highlights    text,
    lowlights     text,
    next_week     text,
    risks         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (week_ending, project_title)          -- idempotent re-sync
);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_account ON weekly_reports(account_id, week_ending DESC);
