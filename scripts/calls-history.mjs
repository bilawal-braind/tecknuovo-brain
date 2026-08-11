// Did the pipeline ever successfully ingest Teams transcripts? If source='teams'
// calls exist from before the block, the machinery is proven and the tenant
// toggle is the only regression.
import { createRequire } from 'module'
import path from 'path'
const require = createRequire(path.join(process.cwd(), 'package.json'))
const pg = require('pg')
const c = new pg.Client({ ssl: { rejectUnauthorized: false } })
await c.connect()

const bySource = await c.query(
  `SELECT source, count(*) AS n, min(call_date)::date AS first, max(call_date)::date AS last
   FROM calls GROUP BY source ORDER BY n DESC`
)
console.log('== calls by source (all time) ==')
bySource.rows.forEach((r) => console.log(`  ${String(r.source || 'null').padEnd(10)} ${String(r.n).padStart(5)}   ${r.first} -> ${r.last}`))

const teams = await c.query(
  `SELECT to_char(call_date,'YYYY-MM-DD') AS d, count(*) AS n
   FROM calls WHERE source='teams' GROUP BY 1 ORDER BY 1 DESC LIMIT 15`
)
console.log('\n== most recent 15 days that produced teams calls ==')
teams.rows.forEach((r) => console.log(`  ${r.d}  ${r.n}`))

const inboxTeams = await c.query(
  `SELECT status, count(*) AS n, max(received_at)::date AS last
   FROM inbox WHERE source='teams' GROUP BY status ORDER BY status`
)
console.log('\n== inbox rows with source=teams (ever) ==')
if (!inboxTeams.rows.length) console.log('  (none — no teams transcript has ever reached the inbox)')
inboxTeams.rows.forEach((r) => console.log(`  ${String(r.status).padEnd(12)} ${String(r.n).padStart(5)}   last ${r.last}`))

await c.end()
