-- Human-approved opportunity -> HubSpot deal push queue.
-- The dashboard's approval box INSERTs here (the API's second allowed write);
-- workflow 11 claims pending rows and creates the deal in HubSpot, mapped to the
-- account's company. Nothing is pushed without a human clicking Yes.
CREATE TABLE IF NOT EXISTS hubspot_pushes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id    uuid REFERENCES signals(id) ON DELETE CASCADE,
    account_id   uuid REFERENCES accounts(id),
    deal_name    text,
    status       text NOT NULL DEFAULT 'pending',  -- pending | pushed | failed | declined
    hubspot_deal_id text,
    error        text,
    given_by     text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    pushed_at    timestamptz,
    UNIQUE (signal_id)                             -- one decision per signal
);

-- The Read API may queue approvals (alongside feedback, its only other write).
GRANT INSERT ON hubspot_pushes TO tn_api_read;
