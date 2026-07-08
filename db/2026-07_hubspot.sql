-- HubSpot read-only mirror (client stakeholders + deals), synced daily by
-- workflow "10 — HubSpot sync". Read-only: the brain never writes back to HubSpot
-- (the thumbs-up -> deal write-back is banked pending client sign-off).
-- Stays in TN's Azure Postgres (client PII lives only in the TN tenant).
-- Run BEFORE importing workflow 10 and the updated Main Pipeline.

-- Client-side stakeholders: who they are and their buying power. Feeds the
-- NETWORKS "W (Who)" weighting when the classifier scores opportunities.
CREATE TABLE IF NOT EXISTS stakeholders (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hubspot_contact_id text UNIQUE,               -- idempotent sync key
    name               text,
    email              text,
    job_title          text,
    buying_role        text,                      -- hs_buying_role, e.g. 'BUDGET_HOLDER;KEY_BUYER'
    seniority          text,
    hubspot_company_id text,
    company_name       text,
    account_id         uuid REFERENCES accounts(id),
    last_verified      timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now()
);

-- Deals: the commercial pipeline per account (amount, stage label, open/closed).
CREATE TABLE IF NOT EXISTS deals (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hubspot_deal_id    text UNIQUE,
    name               text,
    amount             numeric,
    pipeline           text,                      -- label, e.g. 'Sales Pipeline'
    stage              text,                      -- label, e.g. 'Bid Submitted' (ids translated)
    is_open            boolean,                   -- not Closed Won/Lost/Qualified Out
    networks_score     numeric,                   -- their 'Qualification score' deal property
    close_date         timestamptz,
    hubspot_company_id text,
    company_name       text,
    account_id         uuid REFERENCES accounts(id),
    last_verified      timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stakeholders_account ON stakeholders(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_account        ON deals(account_id, is_open);
