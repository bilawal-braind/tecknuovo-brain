-- "This looks wrong" feedback from the provenance sidebar (transparency layer).
-- Stored here as the system of record; the API optionally forwards a content-
-- light copy (kind + the user's typed note only) to BraindAI's internal Slack
-- via BRAIND_SLACK_WEBHOOK so bugs arrive without a call.
CREATE TABLE IF NOT EXISTS source_feedback (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind        text NOT NULL,            -- signal | call | account | project
    ref_id      text,                     -- the item's id
    ref_label   text,                     -- short human label (title/name)
    note        text NOT NULL,            -- what the user typed
    author      text NOT NULL DEFAULT '', -- login email ('' in dev mode)
    created_at  timestamptz NOT NULL DEFAULT now()
);
-- When the API moves to the hardened tn_api_read role:
-- GRANT INSERT ON source_feedback TO tn_api_read;
