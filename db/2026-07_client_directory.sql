-- Names-only directory of known clients, kept warm by the 07:00 reconcile from the
-- Monday "Active SOW's" board group titles. Lets the Watcher recognise an account the
-- brain has never seen a call for, WITHOUT bulk-seeding accounts/projects — the lazy
-- read-through model is unchanged: the account row + its SOWs are still created on
-- demand by the Main Pipeline when that client's first call arrives.
-- Run BEFORE importing the updated Watcher (5) and Reconciliation (2) workflows.
CREATE TABLE IF NOT EXISTS client_directory (
    name      text PRIMARY KEY,
    source    text,
    last_seen timestamptz NOT NULL DEFAULT now()
);
