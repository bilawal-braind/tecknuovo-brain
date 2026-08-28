-- 18 Aug cleanse (Cormac's promise on the Kiera/Chloe call): trim the signal
-- noise so the team feedback pass runs on a credible list. Applied live 18 Aug:
-- 513 open signals -> 292 (91 near-duplicates + 132 daily-standup noise dismissed).
-- Every dismissal is marked in details.auto_cleanse and reversible by flipping
-- status back to 'new'. Protected from the cleanse: signals a human confirmed
-- correct, signals pushed to the risk register, and any non-'new' status.

-- Extension-free similarity (pg_trgm is not allow-listed on Azure Postgres):
-- Jaccard overlap of distinct lowercase words of length >= 4. Also used by
-- workflow 1's insert guard so near-duplicates can never be inserted again.
CREATE OR REPLACE FUNCTION tn_word_sim(a text, b text) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fn$
  WITH wa AS (SELECT DISTINCT w FROM unnest(string_to_array(lower(regexp_replace(coalesce(a,''),'[^a-zA-Z0-9 ]',' ','g')),' ')) w WHERE length(w) >= 4),
       wb AS (SELECT DISTINCT w FROM unnest(string_to_array(lower(regexp_replace(coalesce(b,''),'[^a-zA-Z0-9 ]',' ','g')),' ')) w WHERE length(w) >= 4)
  SELECT CASE WHEN (SELECT count(*) FROM wa) = 0 OR (SELECT count(*) FROM wb) = 0 THEN 0
         ELSE (SELECT count(*) FROM (SELECT w FROM wa INTERSECT SELECT w FROM wb) i)::numeric
            / (SELECT count(*) FROM (SELECT w FROM wa UNION SELECT w FROM wb) u) END
$fn$;

-- call_type backfill for the 74 pre-metrics calls, from their titles.
UPDATE calls SET call_type = CASE
    WHEN title ~* '(stand.?up|stand.?down|standup)' THEN 'Daily standup'
    WHEN title ~* '(weekly|bi.?weekly|fortnightly)' THEN 'Weekly report'
    WHEN title ~* '(governance|steering|review session|monthly)' THEN 'Monthly governance'
    WHEN title ~* '(kick.?off)' THEN 'Client kickoff'
    WHEN title ~* '(catch.?up|check.?in|sync|1.?2.?1|wash.?up)' THEN 'Check-in'
    ELSE call_type END
WHERE call_type IS NULL;

-- The dismissals themselves ran via scripts/cleanse-signals.mjs (this repo),
-- dry-run first. Rules:
--   duplicate:     same account + type, word-sim > 0.45 to a NEWER open signal
--                  (newest of each cluster survives)
--   standup_noise: signal from a daily standup / stand up / stand down call,
--                  except opportunities, risks scoring likelihood x impact >= 15,
--                  and risks mentioning SOW / contract / commercial / invoicing /
--                  funding / budget / extension / renewal / PO (working-at-risk
--                  themes always survive)
-- To undo any of it:
--   UPDATE signals SET status = 'new'
--   WHERE details->>'auto_cleanse' = '2026-08-18' [AND details->>'cleanse_rule' = '...'];

-- 19 Aug correction (post-cleanse audit): where dedupe kept a survivor and the
-- standup rule then dismissed that survivor too, whole clusters vanished. The
-- client rule is one tracked signal per issue, never zero - so the newest copy
-- of each fully-dead risk/people/opportunity cluster was restored (9 signals,
-- marked details.cleanse_restored). Routine update clusters stay dismissed.
-- Ran via scripts/restore-clusters.mjs. Open signals: 292 -> 301.

-- 22 Aug (Kiera scoping, from the 21 Aug call): her people row had no email so
-- assignment scoping resolved to nothing. Applied live:
--   UPDATE people SET email = 'kiera.battersby@tecknuovo.com' WHERE name = 'Kiera Battersby';
--   UPDATE app_users SET scope = 'assigned' WHERE email = 'kiera.battersby@tecknuovo.com';
-- scope 'assigned' = full dashboard navigation, data filtered to her accounts
-- (Cabinet Office, DEFRA, DVSA, KPMG x Higher Education). VodafoneThree gone.

-- 29 Aug source corrections (Chloe's provenance check): the three "Cabinet
-- Office projects" were ghosts auto-created by the weekly-report sync from
-- inconsistent SharePoint report titles (wr: prefix), never Monday rows - 8
-- such legacy ghosts retired (wf9's newer dupe guard prevents recurrence).
-- The client directory was polluted by HubSpot DEAL-name prefixes (Chloe:
-- "those exist as Deals, not Companies") - 54 dead deal-title artifacts purged
-- (account aliases like CNWL kept), wf10 now only takes prefixes from OPEN
-- deals, and the phantom "KPMG x Higher Education" account was removed with
-- its call/signals reassigned to DFE. Ran via scripts/fix-sources.mjs.
