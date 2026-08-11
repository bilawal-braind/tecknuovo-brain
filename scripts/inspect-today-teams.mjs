import { createRequire } from 'module'
import path from 'path'
const require = createRequire(path.join(process.cwd(), 'package.json'))
const pg = require('pg')
const c = new pg.Client({ ssl: { rejectUnauthorized: false } })
await c.connect()
const r = await c.query(
  `SELECT id, title, source, dedup_key,
          to_char(call_date,'YYYY-MM-DD HH24:MI') AS call_date,
          to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at,
          length(coalesce(transcript,'')) AS chars, duration_seconds
   FROM calls
   WHERE source='teams' AND call_date::date = '2026-08-10'
   ORDER BY created_at DESC`
)
console.log(`teams calls dated 2026-08-10: ${r.rows.length}`)
r.rows.forEach((x) => console.log(JSON.stringify(x)))

// also: the 5 most-recently CREATED teams calls regardless of call_date
const recent = await c.query(
  `SELECT title, to_char(call_date,'YYYY-MM-DD') AS call_date,
          to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at, length(coalesce(transcript,'')) AS chars
   FROM calls WHERE source='teams' ORDER BY created_at DESC LIMIT 6`
)
console.log('\nmost recently CREATED teams calls:')
recent.rows.forEach((x) => console.log(`  created ${x.created_at}  call_date ${x.call_date}  ${x.chars}c  ${String(x.title||'').slice(0,50)}`))
await c.end()
