// Runs on VM from api dir. Chloe's source findings (29 Aug), three fixes:
// 1. Retire legacy weekly-report ghost projects: duplicates of the same
//    normalized name per account (keep newest), and wr: rows on accounts that
//    have a live Monday-sourced project. wf9's guard already prevents new ones.
// 2. Purge client_directory names that only ever came from HubSpot DEAL-name
//    prefixes (Chloe: "those exist as Deals, not Companies") and match no
//    account, no company, and no open deal.
// Usage: node fix-sources.mjs        (dry run)   |   node fix-sources.mjs apply
import pg from 'pg'
const APPLY = process.argv[2] === 'apply'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const q = (s, p) => c.query(s, p).then((r) => r.rows)

// ---- 1a. wr: duplicates per account+normalized name: keep the newest ----
const dupSql = `
  SELECT p.id, p.name, p.account_name FROM projects p
  WHERE p.monday_item_id LIKE 'wr:%' AND p.retired IS NOT TRUE
    AND EXISTS (
      SELECT 1 FROM projects p2
      WHERE p2.account_id = p.account_id AND p2.id <> p.id AND p2.retired IS NOT TRUE
        AND p2.monday_item_id LIKE 'wr:%'
        AND regexp_replace(lower(p2.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g')
        AND (p2.last_verified > p.last_verified OR (p2.last_verified = p.last_verified AND p2.id > p.id)))`
// ---- 1b. wr: rows superseded by a real Monday project on the account ----
const supSql = `
  SELECT p.id, p.name, p.account_name FROM projects p
  WHERE p.monday_item_id LIKE 'wr:%' AND p.retired IS NOT TRUE
    AND EXISTS (SELECT 1 FROM projects pm WHERE pm.account_id = p.account_id
                AND pm.retired IS NOT TRUE AND pm.monday_item_id NOT LIKE 'wr:%' AND pm.monday_item_id IS NOT NULL)`
const dups = await q(dupSql)
const sup = await q(supSql)
console.log('wr: duplicate ghosts to retire:', dups.length)
console.table(dups.slice(0, 10))
console.log('wr: rows superseded by a real Monday project:', sup.length)
console.table(sup.slice(0, 10))
if (APPLY) {
  const ids = [...new Set([...dups, ...sup].map((r) => r.id))]
  if (ids.length) await q(`UPDATE projects SET retired = true WHERE id = ANY($1::uuid[])`, [ids])
  console.log('retired', ids.length, 'ghost projects')
}

// ---- 2. directory purge: hubspot-sourced names that are deal-prefix artifacts ----
// keep anything that fuzzy-matches a real account either direction ("CNWL" is
// a matching alias for NHS CNWL) - only true deal-title junk goes
const purgeSql = `
  SELECT d.name FROM client_directory d
  WHERE d.source = 'hubspot'
    AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.name <> 'KPMG x Higher Education'
                    AND (lower(a.name) LIKE '%'||lower(d.name)||'%' OR lower(d.name) LIKE '%'||lower(a.name)||'%'))
    AND NOT EXISTS (SELECT 1 FROM deals dl WHERE lower(dl.company_name) = lower(d.name))
    AND NOT EXISTS (SELECT 1 FROM deals dl WHERE dl.is_open
                    AND lower(split_part(dl.name, ' - ', 1)) = lower(d.name))`
const purge = await q(purgeSql)
console.log('directory names to remove (deal-prefix artifacts):', purge.length)
console.log(purge.map((r) => r.name).join(' | '))
if (APPLY) {
  await q(`DELETE FROM client_directory WHERE source = 'hubspot' AND name = ANY($1::text[])`, [purge.map((r) => r.name)])
  console.log('purged')
}
// ---- 3. the phantom KPMG x Higher Education account ----
const kpmg = await q(`SELECT id FROM accounts WHERE name = 'KPMG x Higher Education'`)
if (kpmg.length) {
  const kid = kpmg[0].id
  const refs = await q(`SELECT
    (SELECT count(*) FROM calls WHERE account_id = $1)::int AS calls,
    (SELECT count(*) FROM signals WHERE account_id = $1)::int AS signals,
    (SELECT count(*) FROM deals WHERE account_id = $1)::int AS deals,
    (SELECT count(*) FROM feedback WHERE account_id = $1)::int AS feedback`, [kid])
  console.log('phantom KPMG account references:', JSON.stringify(refs[0]))
  if (APPLY) {
    const dfe = (await q(`SELECT id FROM accounts WHERE name = 'DFE'`))[0].id
    await q(`UPDATE calls SET account_id = $2 WHERE account_id = $1`, [kid, dfe])
    await q(`UPDATE signals SET account_id = $2 WHERE account_id = $1`, [kid, dfe])
    await q(`UPDATE feedback SET account_id = $2 WHERE account_id = $1`, [kid, dfe])
    await q(`UPDATE deals SET account_id = NULL WHERE account_id = $1`, [kid])
    await q(`UPDATE stakeholders SET account_id = NULL WHERE account_id = $1`, [kid])
    await q(`DELETE FROM accounts WHERE id = $1`, [kid])
    console.log('phantom account removed; its call reassigned to DFE')
  }
}
console.log(APPLY ? 'APPLIED' : 'DRY RUN ONLY')
await c.end()
