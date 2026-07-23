-- Leadership-only meetings (Meesha, 22 Jul): calls titled "Business Leadership",
-- "Customer Leadership" or "Leadership Team Meeting" (Katie's diary) are ingested
-- but visible ONLY to leadership + admin roles - the API filters them out of every
-- list, transcript and signal feed for everyone else. Stamped at ingestion by the
-- Watcher; calls and their signals both carry the flag. Additive + safe to re-run.
ALTER TABLE calls   ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all';
ALTER TABLE signals ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'all';
CREATE INDEX IF NOT EXISTS idx_calls_visibility   ON calls(visibility);
CREATE INDEX IF NOT EXISTS idx_signals_visibility ON signals(visibility);

-- Backfill: flag any already-ingested leadership meetings + their signals.
UPDATE calls SET visibility = 'leadership'
WHERE title ~* '(business leadership|customer leadership|leadership team meeting)';
UPDATE signals s SET visibility = 'leadership'
FROM calls c WHERE s.call_id = c.id AND c.visibility = 'leadership';
