// Runs on VM from api dir. Correction to the 18 Aug cleanse: where dedupe kept
// a survivor and the standup rule then killed it too, the whole cluster vanished.
// Client rule: one tracked signal per issue, never zero. Restore the NEWEST
// member of each fully-dead cluster for risks / people / opportunities
// (routine updates stay dismissed). Marks restores in details.cleanse_restored.
// Usage: node restore-clusters.mjs        (dry run)
//        node restore-clusters.mjs apply
import pg from 'pg'
const APPLY = process.argv[2] === 'apply'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const q = (sql, p) => c.query(sql, p).then((r) => r.rows)

const words = (t) => new Set((t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 4))
const sim = (a, b) => {
  const wa = words(a), wb = words(b)
  if (!wa.size || !wb.size) return 0
  let inter = 0
  for (const w of wa) if (wb.has(w)) inter++
  return inter / (wa.size + wb.size - inter)
}
const key = (s) => `${s.account_id}|${s.type}`

const cleansed = await q(`SELECT id, account_id, type, summary, created_at, details->>'cleanse_rule' AS rule
                          FROM signals WHERE details ? 'auto_cleanse'`)
const open = await q(`SELECT id, account_id, type, summary FROM signals WHERE status = 'new'`)
const openBy = new Map()
for (const s of open) { const k = key(s); if (!openBy.has(k)) openBy.set(k, []); openBy.get(k).push(s) }
const cleansedBy = new Map()
for (const s of cleansed) { const k = key(s); if (!cleansedBy.has(k)) cleansedBy.set(k, []); cleansedBy.get(k).push(s) }

const toRestore = new Map() // clusterRepresentativeId -> chosen newest signal
for (const s of cleansed) {
  if (s.rule !== 'duplicate' || s.type === 'update') continue
  const hasOpenSurvivor = (openBy.get(key(s)) || []).some((o) => sim(o.summary, s.summary) > 0.45)
  if (hasOpenSurvivor) continue
  // cluster = this signal + cleansed mates similar to it
  const mates = (cleansedBy.get(key(s)) || []).filter((m) => m.id === s.id || sim(m.summary, s.summary) > 0.45)
  const newest = mates.reduce((a, b) => (new Date(a.created_at) >= new Date(b.created_at) ? a : b))
  toRestore.set(newest.id, newest)
}
const picks = [...toRestore.values()]
console.log('clusters to restore (newest copy each):', picks.length)
console.table(picks.map((p) => ({ type: p.type, summary: p.summary.slice(0, 85) })))

if (APPLY && picks.length) {
  await q(`UPDATE signals SET status = 'new',
             details = details || '{"cleanse_restored":"2026-08-19 cluster had no open survivor"}'::jsonb
           WHERE id = ANY($1::uuid[])`, [picks.map((p) => p.id)])
  console.log('restored', picks.length, 'signals')
  console.table(await q(`SELECT type, count(*)::int FROM signals WHERE status='new' GROUP BY 1 ORDER BY 2 DESC`))
}
console.log(APPLY ? 'APPLIED' : 'DRY RUN ONLY')
await c.end()
