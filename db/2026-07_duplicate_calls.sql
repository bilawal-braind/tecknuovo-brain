-- Duplicate calls: detect, preview, remove.
--
-- calls.dedup_key (the Teams transcript id) is UNIQUE, so a duplicate means the SAME
-- meeting arrived under TWO different transcript ids (Teams re-issues one when
-- transcription restarts mid-call, and per-organizer fetches can surface the same
-- meeting twice). Run STEP 1, eyeball the groups, then STEP 2 to preview exactly what
-- would be deleted, then STEP 3 inside the transaction.
--
-- Deleting a call CASCADES to its signals (and their feedback / signal_notes /
-- hubspot_pushes) - that's what we want for duplicates: the survivor keeps its set.
-- The inbox rows are deliberately KEPT (status 'done'): their UNIQUE dedup_key is
-- what stops the Watcher re-ingesting the same transcript ids on the next sweep.

-- ── STEP 1 — find duplicate groups (same title on the same day) ──────────────────
WITH sig AS (SELECT call_id, count(*) AS n FROM signals GROUP BY call_id)
SELECT c.id, a.name AS account, c.title, c.call_date, c.dedup_key, c.created_at,
       COALESCE(s.n, 0) AS signals, length(c.transcript) AS transcript_chars,
       count(*) OVER w AS copies
FROM calls c
LEFT JOIN sig s ON s.call_id = c.id
LEFT JOIN accounts a ON a.id = c.account_id
WINDOW w AS (PARTITION BY lower(trim(c.title)), c.call_date::date)
ORDER BY copies DESC, lower(trim(c.title)), c.call_date, c.created_at;
-- Only rows with copies > 1 are duplicates. Same title on DIFFERENT days (a recurring
-- standup) is normal and shows copies = 1 here.

-- Safety net: byte-identical transcripts stored under different titles/dates
-- (should be empty; if not, handle those ids by hand):
SELECT md5(transcript) AS content_hash, count(*) AS copies, array_agg(id) AS call_ids
FROM calls WHERE transcript IS NOT NULL AND transcript <> ''
GROUP BY 1 HAVING count(*) > 1;

-- ── STEP 2 — preview: which copy survives, which get deleted ─────────────────────
-- Survivor per group = the copy with the MOST signals (it did the classification
-- work); tie -> the earliest stored. Everything else in the group is a duplicate.
WITH sig AS (SELECT call_id, count(*) AS n FROM signals GROUP BY call_id),
ranked AS (
  SELECT c.id, c.title, c.call_date, c.created_at, COALESCE(s.n, 0) AS signals,
         row_number() OVER (
           PARTITION BY lower(trim(c.title)), c.call_date::date
           ORDER BY COALESCE(s.n, 0) DESC, c.created_at ASC
         ) AS rn,
         count(*) OVER (PARTITION BY lower(trim(c.title)), c.call_date::date) AS copies
  FROM calls c LEFT JOIN sig s ON s.call_id = c.id
)
SELECT id, title, call_date, signals,
       CASE WHEN rn = 1 THEN 'KEEP' ELSE 'DELETE' END AS action
FROM ranked WHERE copies > 1
ORDER BY lower(trim(title)), call_date, rn;

-- ── STEP 3 — delete the duplicates (run only after STEP 2 looks right) ───────────
BEGIN;

WITH sig AS (SELECT call_id, count(*) AS n FROM signals GROUP BY call_id),
ranked AS (
  SELECT c.id,
         row_number() OVER (
           PARTITION BY lower(trim(c.title)), c.call_date::date
           ORDER BY COALESCE(s.n, 0) DESC, c.created_at ASC
         ) AS rn,
         count(*) OVER (PARTITION BY lower(trim(c.title)), c.call_date::date) AS copies
  FROM calls c LEFT JOIN sig s ON s.call_id = c.id
)
DELETE FROM calls WHERE id IN (SELECT id FROM ranked WHERE copies > 1 AND rn > 1)
RETURNING id, title, call_date;

-- Check the RETURNING list matches STEP 2's DELETE rows, then:
COMMIT;   -- or ROLLBACK; if anything is off

-- Afterwards, orphan-signal sanity check (must return 0):
SELECT count(*) FROM signals s WHERE NOT EXISTS (SELECT 1 FROM calls c WHERE c.id = s.call_id);
