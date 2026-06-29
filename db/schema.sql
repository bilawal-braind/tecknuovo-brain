-- Tecknuovo Second Brain — Memory schema (v2)
-- Target: Azure Database for PostgreSQL 16.x (validated 16.14)
-- Non-destructive: all CREATE ... IF NOT EXISTS. Safe to re-run.
-- v2 adds the real Monday model: SOWs (projects + £), associates (staffing),
-- the synced risk register, and customer feedback. pgvector still DEFERRED.
-- Sync pattern: every synced row carries monday_item_id (UNIQUE) for idempotent
-- upsert, a raw account_name (linked to account_id in a later pass), and
-- last_verified for freshness.

-- ---------- People (TN staff + client stakeholders) ----------
CREATE TABLE IF NOT EXISTS people (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name             text NOT NULL,
    email            text,
    role             text,
    pod              text,
    is_internal      boolean,
    monday_person_id text,
    source_refs      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz NOT NULL DEFAULT now(),
    last_verified    timestamptz
);

-- ---------- Accounts ----------
CREATE TABLE IF NOT EXISTS accounts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL UNIQUE,
    pod             text,
    client_partner  uuid REFERENCES people(id),
    health          text,
    status          text,
    source_refs     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_verified   timestamptz
);

-- ---------- Projects / SOWs (the unit of work + money) ----------
CREATE TABLE IF NOT EXISTS projects (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    monday_item_id   text UNIQUE,                 -- idempotent sync key
    account_id       uuid REFERENCES accounts(id),-- linked in a later pass
    account_name     text,                        -- raw client name from Monday
    name             text NOT NULL,
    sow_value        numeric,
    commercial_model text,
    sow_status       text,
    start_date       date,
    end_date         date,
    phase            text,
    rag              text,
    delivery_manager uuid REFERENCES people(id),
    source_refs      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz NOT NULL DEFAULT now(),
    last_verified    timestamptz
);

-- ---------- Associates (consultants on the ground = "runners") ----------
CREATE TABLE IF NOT EXISTS associates (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    monday_item_id      text UNIQUE,
    name                text NOT NULL,
    account_id          uuid REFERENCES accounts(id),
    account_name        text,                     -- raw client name
    project_or_programme text,
    placement_status    text,
    internal_external   text,
    sfia_level          text,
    ir35_status         text,
    sc_status           text,
    day_rate            numeric,
    bill_rate           numeric,
    contract_start      date,
    contract_end        date,
    tn_rating           numeric,
    customer_rating     numeric,
    values_rating       numeric,
    source_refs         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    last_verified       timestamptz
);

-- ---------- Risk register (synced from Monday Risks, Issues & Incidents) ----------
CREATE TABLE IF NOT EXISTS risks (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    monday_item_id  text UNIQUE,
    name            text,
    account_id      uuid REFERENCES accounts(id),
    account_name    text,                         -- raw client name
    project_name    text,
    kind            text,                         -- Risk | Issue | Incident
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

-- ---------- Customer feedback (synced from Monday feedback log) ----------
CREATE TABLE IF NOT EXISTS customer_feedback (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    monday_item_id  text UNIQUE,
    account_name    text,
    feedback_type   text,                         -- positive | negative
    channel         text,
    details         text,
    root_cause      text,
    feedback_date   date,
    source_refs     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------- Calls (transcripts) ----------
CREATE TABLE IF NOT EXISTS calls (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  uuid REFERENCES accounts(id),
    project_id  uuid REFERENCES projects(id),
    title       text,
    call_date   timestamptz,
    transcript  text,
    source      text,
    dedup_key   text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Signals (extracted from calls) ----------
CREATE TABLE IF NOT EXISTS signals (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id          uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    account_id       uuid REFERENCES accounts(id),
    project_id       uuid REFERENCES projects(id),
    type             text NOT NULL,               -- opportunity | risk | update | people
    subtype          text,
    summary          text,
    quote            text,
    suggested_action text,
    confidence       numeric,
    status           text NOT NULL DEFAULT 'new', -- new | reviewed | actioned | dismissed
    -- risk-specific (5x5): risk_category, likelihood, impact, band, escalation
    -- opportunity-specific (NETWORKS): networks_score, who_role
    -- flags: value_add, feedback_sentiment
    details          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- framework-specific fields (configurable)
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT signals_type_chk CHECK (type IN ('opportunity','risk','update','people'))
);

-- ---------- Feedback (Observability — humans correcting the AI) ----------
CREATE TABLE IF NOT EXISTS feedback (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id    uuid REFERENCES signals(id) ON DELETE CASCADE,
    account_id   uuid REFERENCES accounts(id),
    verdict      text,            -- correct | incorrect | relabel
    correct_type text,
    reason       text,
    given_by     text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- Inbox (durable queue) ----------
CREATE TABLE IF NOT EXISTS inbox (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source       text,
    dedup_key    text UNIQUE,
    payload      jsonb NOT NULL,
    status       text NOT NULL DEFAULT 'pending', -- pending | processing | done | error
    attempts     int NOT NULL DEFAULT 0,
    error        text,
    received_at  timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

-- ---------- Run logs (observability) ----------
CREATE TABLE IF NOT EXISTS run_logs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow   text,
    status     text,
    detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_projects_account   ON projects(account_id);
CREATE INDEX IF NOT EXISTS idx_projects_acctname  ON projects(lower(account_name));
CREATE INDEX IF NOT EXISTS idx_associates_account ON associates(account_id);
CREATE INDEX IF NOT EXISTS idx_associates_acctname ON associates(lower(account_name));
CREATE INDEX IF NOT EXISTS idx_risks_account      ON risks(account_id);
CREATE INDEX IF NOT EXISTS idx_calls_account      ON calls(account_id);
CREATE INDEX IF NOT EXISTS idx_signals_account    ON signals(account_id);
CREATE INDEX IF NOT EXISTS idx_signals_type       ON signals(type);
CREATE INDEX IF NOT EXISTS idx_signals_status     ON signals(status);
CREATE INDEX IF NOT EXISTS idx_inbox_status       ON inbox(status);
