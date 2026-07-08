-- Go-live cleanup: remove the GOLDEN TEST-RUN data so real calls aren't mixed with samples.
-- Run this ONCE, right when real transcribed calls start flowing (NOT before — the current
-- demo dashboards are populated by this test data, so clearing it early empties them).
--
-- Keeps the real Monday org data (accounts / projects / associates). Only removes the
-- sample calls and the signals extracted from them.

BEGIN;

-- Signals cascade from calls (signals.call_id ON DELETE CASCADE), so deleting the golden
-- calls removes their signals too. Golden calls are titled "... (golden test)".
DELETE FROM calls WHERE title ILIKE '%(golden test)%';

-- Any leftover golden inbox rows.
DELETE FROM inbox WHERE payload->>'title' ILIKE '%(golden test)%';

-- Safety net: remove any orphan signals whose call is gone.
DELETE FROM signals s WHERE NOT EXISTS (SELECT 1 FROM calls c WHERE c.id = s.call_id);

COMMIT;

-- Sanity check after running:
--   SELECT count(*) FROM calls;    -- should drop to real calls only
--   SELECT count(*) FROM signals;  -- should drop to signals from real calls only
