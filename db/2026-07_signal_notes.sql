-- Team notes on signals (Kiera's ask, 11 Jul leadership call): human context that the
-- transcripts can't capture ("caught up with Ryan on Slack - mitigated, next steps...").
-- Visible on every dashboard, persists after the signal is actioned. Deliberately NOT
-- fed to the classifier - this is a team log, not model feedback (that's `feedback`).
CREATE TABLE IF NOT EXISTS signal_notes (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id  uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    account_id uuid REFERENCES accounts(id),
    note       text NOT NULL,
    author     text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signal_notes_signal ON signal_notes(signal_id, created_at);

-- HubSpot push now carries the required deal fields (value + close date), entered by
-- the approver in the dashboard form - no more empty deals possible.
ALTER TABLE hubspot_pushes ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE hubspot_pushes ADD COLUMN IF NOT EXISTS close_date date;

-- Grants for the least-privilege API role, when it exists (see api_role.sql).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tn_api_read') THEN
    GRANT INSERT ON signal_notes TO tn_api_read;
  END IF;
END $$;
