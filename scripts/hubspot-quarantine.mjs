// Inspect + quarantine the HubSpot inbox queue (workflow 17).
// Bilawal's finding: 101 "meetings" is impossible as real calls — wf17's
// hs_lastmodifieddate window caught bulk-modified CRM meetings (many with no
// real notes). This does NOT touch n8n. It only:
//   1. shows you the most recent hubspot rows so you can see what they are,
//   2. flips every queued (pending/processing) hubspot row to 'failed' so the
//      pipeline sweep ignores them (dedup stops re-inserts),
//   3. lists any calls already created from hubspot so you can decide on them.
// Nothing is deleted. Run from the api/ dir so pg + .env resolve:
//   cd ~/tecknuovo-brain/api && set -a && source .env && set +a && \
//     node ../scripts/hubspot-quarantine.mjs
// Add DELETE_PROCESSED=1 to also delete calls (and their signals) that were
// created from hubspot rows — only after you've eyeballed the list.
import { createRequire } from 'module'
import path from 'path'
const require = createRequire(path.join(process.cwd(), 'package.json'))
const pg = require('pg')

const c = new pg.Client({ ssl: { rejectUnauthorized: false } })
await c.connect()

const total = await c.query(
  `SELECT status, count(*) FROM inbox WHERE source = 'hubspot' GROUP BY status ORDER BY status`
)
console.log('\n== hubspot inbox by status ==')
total.rows.forEach((r) => console.log(`  ${r.status.padEnd(12)} ${r.count}`))

const sample = await c.query(
  `SELECT payload->>'title'   AS title,
          payload->>'account' AS account,
          length(coalesce(payload->>'transcript','')) AS note_len,
          status,
          received_at
   FROM inbox WHERE source = 'hubspot'
   ORDER BY received_at DESC LIMIT 20`
)
console.log('\n== 20 most-recent hubspot rows (note_len = chars of note text) ==')
sample.rows.forEach((r) =>
  console.log(
    `  [${String(r.note_len).padStart(5)}c ${String(r.status).padEnd(9)}] ${String(r.account || '—').padEnd(18)} ${String(r.title || '(no title)').slice(0, 60)}`
  )
)

const q = await c.query(
  `UPDATE inbox SET status = 'failed', error = 'quarantined: hubspot bulk-modified, not a real call'
   WHERE source = 'hubspot' AND status IN ('pending', 'processing')`
)
console.log(`\n== quarantined ${q.rowCount} queued hubspot rows (now 'failed', sweep will skip) ==`)

const done = await c.query(
  `SELECT id, title, call_date FROM calls WHERE source = 'hubspot' ORDER BY call_date DESC`
)
console.log(`\n== calls already created from hubspot: ${done.rows.length} ==`)
done.rows.forEach((r) => console.log(`  ${r.id}  ${r.call_date}  ${String(r.title || '').slice(0, 60)}`))

if (process.env.DELETE_PROCESSED === '1' && done.rows.length) {
  const ids = done.rows.map((r) => r.id)
  const ds = await c.query(`DELETE FROM signals WHERE call_id = ANY($1::uuid[])`, [ids])
  const dc = await c.query(`DELETE FROM calls WHERE id = ANY($1::uuid[])`, [ids])
  console.log(`\n== DELETE_PROCESSED: removed ${dc.rowCount} calls + ${ds.rowCount} signals ==`)
}

await c.end()
console.log('\nDone. No n8n touched. Ask TN to toggle workflow 17 Inactive when convenient.')
