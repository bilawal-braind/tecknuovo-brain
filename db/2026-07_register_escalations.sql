-- Register escalation timing (Chloe, 22 Jul): the board's "Ticket Age" column gives
-- the true age of each risk, so a 60-day-old Level 1 escalates to Katie immediately
-- instead of starting a fresh clock the day we first synced it. Run BEFORE
-- re-importing workflow 2.
ALTER TABLE risks ADD COLUMN IF NOT EXISTS age_days int;
