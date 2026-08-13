// Projects from the Monday sublists - the fix for phantom projects (Cormac +
// Meesha, 12 Aug). The Live Projects & Allocations board (1599188575) holds
// clients as items and the REAL project list as SUBITEMS, each with its own
// Delivery Coordinator and commercial/delivery owners. This sync makes those
// sublists the source of truth for projects:
//   - Closed-group clients are ignored entirely
//   - each subitem upserts a project (canonical name, DC as delivery lead,
//     people stored in source_refs.monday)
//   - existing projects that fuzzy-match a subitem are renamed to the canonical
//     Monday name and kept (signals/reports history intact)
//   - projects NOT on the sublist are RETIRED (hidden, never deleted)
//   - clients with an empty sublist are left untouched (list not filled yet)
//
// Run (also scheduled via cron on the VM):
//   cd ~/tecknuovo-brain/api && set -a && source .env && set +a && \
//     node ../scripts/monday-projects-sync.mjs
import fs from 'fs'
import { execSync } from 'child_process'
import { createRequire } from 'module'
import path from 'path'
const require = createRequire(path.join(process.cwd(), 'package.json'))
const pg = require('pg')

execSync('n8n export:credentials --all --decrypted --output=/tmp/mc-sync.json 2>/dev/null')
const creds = JSON.parse(fs.readFileSync('/tmp/mc-sync.json', 'utf8'))
fs.unlinkSync('/tmp/mc-sync.json')
const mon = creds.find((c) => /monday/i.test(c.name) || /monday/i.test(c.type))
const token = mon.data.apiToken || mon.data.token || mon.data.apiKey || mon.data.value

const gql = async (query) => {
  const r = await fetch('https://api.monday.com/v2', {
    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
    body: JSON.stringify({ query }),
  })
  const j = await r.json()
  if (j.errors) throw new Error('monday: ' + JSON.stringify(j.errors).slice(0, 200))
  return j.data
}

const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')
// candidates: full name, name without parentheticals, and each parenthetical
// content on its own - so 'Department for Education (DfE)' matches account 'DfE'.
const cands = (s) => {
  const raw = String(s || '')
  const par = [...raw.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])
  return [raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(), norm(raw), ...par.map(norm)].filter(Boolean)
}
const fuzzy = (a, b) => {
  const A = cands(a), B = cands(b)
  return A.some((x) => B.some((y) => x && y && (x === y || x.includes(y) || y.includes(x))))
}

const db = new pg.Client({ ssl: { rejectUnauthorized: false } })
await db.connect()
const accounts = (await db.query(`SELECT id, name FROM accounts`)).rows

const data = await gql(`query { boards(ids: 1599188575) { items_page(limit: 100) { items {
  id name group { title }
  subitems { id name column_values { text column { title } } }
} } } }`)

let created = 0, updated = 0, retired = 0, skippedClosed = 0, noAccount = [], emptyLists = []
for (const item of data.boards[0].items_page.items) {
  if (/closed/i.test(item.group.title)) { skippedClosed++; continue }
  const acc = accounts.find((a) => fuzzy(a.name, item.name))
  if (!acc) { noAccount.push(item.name); continue }
  if (!item.subitems.length) { emptyLists.push(item.name); continue }

  const keepIds = []
  for (const s of item.subitems) {
    const col = (title) => {
      const c = s.column_values.find((c) => norm(c.column.title).includes(norm(title)))
      return c && c.text ? c.text : null
    }
    const dc = col('DC') || col('Delivery Coordinator')
    const monday = {
      subitem_id: s.id, board: '1599188575', list: 'project sublist',
      dc, commercial_accountable: col('Commercial Accountable'),
      commercial_responsible: col('Commercial Respons') || col('Commerical Respons'),
      delivery_responsible: col('Delivery Respons'), delivery_technical: col('Delivery Technical'),
    }
    // exact normalised match first, containment only as fallback; a row can be
    // claimed by ONE subitem per run (overlapping names like GVMS / KMS GVMS)
    const pool = (await db.query(`SELECT id, name FROM projects WHERE account_id = $1`, [acc.id])).rows
      .filter((p) => !keepIds.includes(p.id))
    const exact = pool.find((p) => norm(p.name) === norm(s.name) || cands(p.name)[0] === cands(s.name)[0])
    const existing = exact || pool
      .filter((p) => fuzzy(p.name, s.name))
      .sort((a, b) => Math.abs(norm(a.name).length - norm(s.name).length) - Math.abs(norm(b.name).length - norm(s.name).length))[0]
    if (existing) {
      await db.query(
        `UPDATE projects SET name=$1, monday_item_id=$2, delivery_manager_name=COALESCE($3, delivery_manager_name),
           retired=false, last_verified=now(), source_refs = COALESCE(source_refs,'{}'::jsonb) || jsonb_build_object('monday', $4::jsonb)
         WHERE id=$5`, [s.name, s.id, dc, JSON.stringify(monday), existing.id])
      keepIds.push(existing.id); updated++
    } else {
      const ins = await db.query(
        `INSERT INTO projects (monday_item_id, name, account_id, account_name, delivery_manager_name, last_verified, source_refs, retired)
         VALUES ($1,$2,$3,$4,$5,now(), jsonb_build_object('monday', $6::jsonb), false) RETURNING id`,
        [s.id, s.name, acc.id, acc.name, dc, JSON.stringify(monday)])
      keepIds.push(ins.rows[0].id); created++
    }
  }
  const ret = await db.query(
    `UPDATE projects SET retired=true WHERE account_id=$1 AND retired IS NOT TRUE AND NOT (id = ANY($2::uuid[])) RETURNING name`,
    [acc.id, keepIds])
  if (ret.rowCount) console.log(`retired on ${acc.name}: ${ret.rows.map((r) => r.name).join(' · ')}`)
  retired += ret.rowCount
}

console.log(`\nSYNC DONE: ${created} created · ${updated} matched+canonicalised · ${retired} retired · ${skippedClosed} Closed clients ignored`)
if (emptyLists.length) console.log('sublist not filled yet (untouched):', emptyLists.join(', '))
if (noAccount.length) console.log('no matching account in DB:', noAccount.join(', '))
await db.end()
