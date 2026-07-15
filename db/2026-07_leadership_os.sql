-- Leadership OS: tnAI weekly briefs + who-was-on-each-call (speaker stats).
-- Safe to re-run. Run this BEFORE importing the updated workflow 1.

-- The tnAI brief: one row per generation, newest wins. audience allows role-based
-- variants later ('leadership' now; 'delivery'/'partner' when the Slack digests split).
CREATE TABLE IF NOT EXISTS briefs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    audience     text NOT NULL DEFAULT 'leadership',
    period_start date NOT NULL,
    period_end   date NOT NULL,
    content      jsonb NOT NULL,   -- {whats_happening, why, needs_you[]}
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Who spoke on each call and how much: {"Speaker Name": line_count, ...}.
-- Feeds the Ops OS engagement metrics (calls attended, talk share).
ALTER TABLE calls ADD COLUMN IF NOT EXISTS speaker_stats jsonb;

-- Backfill from the transcripts already stored (one-off; skips rows already filled).
WITH lines AS (
    SELECT id,
           trim(regexp_replace((regexp_match(ln, '^:?\s*(.{1,70}?):\s+.+$'))[1], '\s*\|.*$', '')) AS speaker
    FROM (
        SELECT id, unnest(string_to_array(transcript, E'\n')) AS ln
        FROM calls WHERE transcript IS NOT NULL AND transcript <> ''
    ) t
    WHERE ln ~ '^:?\s*.{1,70}?:\s+.+'
)
UPDATE calls c SET speaker_stats = s.stats
FROM (
    SELECT id, jsonb_object_agg(speaker, n) AS stats
    FROM (
        SELECT id, speaker, count(*) AS n
        FROM lines
        WHERE speaker <> '' AND speaker !~* '^(date|attendees)'
        GROUP BY id, speaker
    ) x
    GROUP BY id
) s
WHERE c.id = s.id AND c.speaker_stats IS NULL;

-- Least-privilege role keeps working if it exists (same pattern as other migrations).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tn_api_read') THEN
        GRANT SELECT ON briefs TO tn_api_read;
    END IF;
END $$;

-- Verify: SELECT title, speaker_stats FROM calls WHERE speaker_stats IS NOT NULL LIMIT 3;
