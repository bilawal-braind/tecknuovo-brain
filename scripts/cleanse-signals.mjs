// Runs on VM from api dir. The signal cleanse Cormac promised (18 Aug call):
// 1. backfill call_type on old calls from their titles
// 2. dismiss near-duplicate open signals (keep the newest of each cluster)
// 3. dismiss delivery-level noise from daily standups (keep score>=15 risks + opportunities)
// Similarity = Jaccard word overlap via tn_word_sim() (pg_trgm is not allow-listed
// on this Azure Postgres). Dismissals carry details.auto_cleanse so they are
// auditable and reversible. Protected: human-confirmed, register-pushed, non-'new'.
// Usage: node cleanse.mjs        (dry run - counts + sample pairs)
//        node cleanse.mjs apply  (writes)
import pg from 'pg'
const APPLY = process.argv[2] === 'apply'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const q = (sql, p) => c.query(sql, p).then((r) => r.rows)

// Extension-free similarity: Jaccard over distinct lowercase words of length >= 4.
await q(`CREATE OR REPLACE FUNCTION tn_word_sim(a text, b text) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fn$
  WITH wa AS (SELECT DISTINCT w FROM unnest(string_to_array(lower(regexp_replace(coalesce(a,''),'[^a-zA-Z0-9 ]',' ','g')),' ')) w WHERE length(w) >= 4),
       wb AS (SELECT DISTINCT w FROM unnest(string_to_array(lower(regexp_replace(coalesce(b,''),'[^a-zA-Z0-9 ]',' ','g')),' ')) w WHERE length(w) >= 4)
  SELECT CASE WHEN (SELECT count(*) FROM wa) = 0 OR (SELECT count(*) FROM wb) = 0 THEN 0
         ELSE (SELECT count(*) FROM (SELECT w FROM wa INTERSECT SELECT w FROM wb) i)::numeric
            / (SELECT count(*) FROM (SELECT w FROM wa UNION SELECT w FROM wb) u) END
$fn$`)
console.log('tn_word_sim() ready')

// ---- 1. call_type backfill from titles (only where NULL) ----
if (APPLY) {
  const r = await c.query(`
    UPDATE calls SET call_type = CASE
      WHEN title ~* '(stand.?up|stand.?down|standup)' THEN 'Daily standup'
      WHEN title ~* '(weekly|bi.?weekly|fortnightly)' THEN 'Weekly report'
      WHEN title ~* '(governance|steering|review session|monthly)' THEN 'Monthly governance'
      WHEN title ~* '(kick.?off)' THEN 'Client kickoff'
      WHEN title ~* '(catch.?up|check.?in|sync|1.?2.?1|wash.?up)' THEN 'Check-in'
      ELSE call_type END
    WHERE call_type IS NULL`)
  console.log('call_type backfilled on', r.rowCount, 'calls')
} else {
  const r = await q(`SELECT count(*)::int AS n FROM calls WHERE call_type IS NULL AND title ~* '(stand.?up|stand.?down|standup|weekly|bi.?weekly|fortnightly|governance|steering|review session|monthly|kick.?off|catch.?up|check.?in|sync|1.?2.?1|wash.?up)'`)
  console.log('call_type would backfill on', r[0].n, 'calls')
}

const PROTECTED = `(
  s.status <> 'new'
  OR COALESCE(s.details ? 'register_item_id', false)
  OR EXISTS (SELECT 1 FROM feedback fb WHERE fb.signal_id = s.id AND fb.verdict = 'correct')
)`

// ---- 2. near-duplicate open signals: keep newest per cluster ----
const SIM = 0.45
const dupPairs = await q(`
  SELECT s.id, left(s.summary, 70) AS older, left(newer.summary, 70) AS newer,
         round(tn_word_sim(s.summary, newer.summary), 2) AS sim, a.name AS account
  FROM signals s
  JOIN signals newer ON newer.account_id IS NOT DISTINCT FROM s.account_id
    AND newer.type = s.type AND newer.id <> s.id
    AND newer.status = 'new'
    AND (newer.created_at > s.created_at OR (newer.created_at = s.created_at AND newer.id > s.id))
    AND tn_word_sim(s.summary, newer.summary) > ${SIM}
  LEFT JOIN accounts a ON a.id = s.account_id
  WHERE s.status = 'new' AND NOT ${PROTECTED}`)
const dupIds = [...new Set(dupPairs.map((r) => r.id))]
console.log('duplicates to dismiss:', dupIds.length)
console.log('== sample duplicate pairs (older goes, newer stays) ==')
console.table(dupPairs.slice(0, 12))

if (APPLY && dupIds.length) {
  await q(`UPDATE signals SET status = 'dismissed',
             details = COALESCE(details,'{}'::jsonb) || '{"auto_cleanse":"2026-08-18","cleanse_rule":"duplicate"}'::jsonb
           WHERE id = ANY($1::uuid[])`, [dupIds])
  console.log('duplicates dismissed')
}

// ---- 3. daily standup noise (standup calls incl. title-matched) ----
const standupRows = await q(`
  SELECT s.id, s.type, left(s.summary, 70) AS summary, a.name AS account
  FROM signals s JOIN calls ca ON ca.id = s.call_id
  LEFT JOIN accounts a ON a.id = s.account_id
  WHERE s.status = 'new' AND NOT ${PROTECTED}
    AND (ca.call_type = 'Daily standup' OR ca.title ~* '(stand.?up|stand.?down|standup)')
    AND s.type <> 'opportunity'
    AND NOT (s.type = 'risk' AND (
      COALESCE((s.details->>'likelihood')::numeric, 3) * COALESCE((s.details->>'impact')::numeric, 3) >= 15
      OR (s.summary || ' ' || COALESCE(s.subtype,'')) ~* '(sow|statement of work|contract|commercial|invoic|funding|budget|extension|renewal|purchase order|\\bpo\\b)'
    ))`)
const standupIds = standupRows.map((r) => r.id).filter((id) => !dupIds.includes(id))
console.log('standup noise to dismiss (after dedupe):', standupIds.length)
console.log('== sample standup noise ==')
console.table(standupRows.slice(0, 12))

if (APPLY && standupIds.length) {
  await q(`UPDATE signals SET status = 'dismissed',
             details = COALESCE(details,'{}'::jsonb) || '{"auto_cleanse":"2026-08-18","cleanse_rule":"standup_noise"}'::jsonb
           WHERE id = ANY($1::uuid[])`, [standupIds])
  console.log('standup noise dismissed')
}

const going = [...dupIds, ...standupIds]
console.log('== what goes, by account/type ==')
console.table(await q(`
  SELECT COALESCE(a.name,'(no account)') AS account, s.type, count(*)::int AS n
  FROM signals s LEFT JOIN accounts a ON a.id = s.account_id
  WHERE s.id = ANY($1::uuid[]) GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20`, [going]))

console.log('== open signals after ==')
console.table(await q(APPLY
  ? `SELECT type, count(*)::int FROM signals WHERE status = 'new' GROUP BY 1 ORDER BY 2 DESC`
  : `SELECT type, count(*)::int FROM signals WHERE status = 'new' AND NOT (id = ANY($1::uuid[])) GROUP BY 1 ORDER BY 2 DESC`,
  APPLY ? undefined : [going]))
console.log(APPLY ? 'APPLIED' : 'DRY RUN ONLY - nothing dismissed (tn_word_sim function created)')
await c.end()
