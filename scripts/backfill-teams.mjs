// Teams transcript backfill — fetch every transcribed call since the pipeline
// died (22 Jul 2026) straight from Microsoft Graph and drop them into `inbox`.
// Workflow 1's 5-minute sweep then classifies them automatically. No n8n.
//
// This replicates workflow 5 (the watcher) EXACTLY: same Graph endpoints, same
// VTT->text + duration parsing, same leadership-title stamping, same account
// match, same dedup_key (transcript id), same inbox payload shape.
//
// DRY_RUN=1 (the default) fetches everything and prints an inventory + counts
// but writes NOTHING. Set DRY_RUN=0 to actually insert.
//
// Run from api/ so pg + .env (PG*) resolve, with the Graph creds in the env:
//   cd ~/tecknuovo-brain/api && set -a && source .env && set +a && \
//     GRAPH_CLIENT_ID=... GRAPH_CLIENT_SECRET=... GRAPH_TENANT=... \
//     DRY_RUN=1 node ../scripts/backfill-teams.mjs
//
// Env:
//   GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET   (required)
//   GRAPH_TENANT   OR  GRAPH_TOKEN_URL      (one required)
//   START          default 2026-07-22T00:00:00Z
//   END            default now
//   DRY_RUN        default 1  (1 = inventory only, 0 = insert)
//   ONLY_USER      optional graph_user_id to limit to one person (for a probe)
import { createRequire } from 'module'
import path from 'path'
const require = createRequire(path.join(process.cwd(), 'package.json'))
const pg = require('pg')

const CID = process.env.GRAPH_CLIENT_ID
const SEC = process.env.GRAPH_CLIENT_SECRET
const TENANT = process.env.GRAPH_TENANT
const TOKEN_URL = process.env.GRAPH_TOKEN_URL || (TENANT ? `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token` : '')
const SCOPE = process.env.GRAPH_SCOPE || 'https://graph.microsoft.com/.default'
const START = process.env.START || '2026-07-22T00:00:00Z'
const END = process.env.END || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
const DRY = process.env.DRY_RUN !== '0'
const ONLY_USER = process.env.ONLY_USER || ''
if (!CID || !SEC || !TOKEN_URL) {
  console.error('Missing creds: need GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, and GRAPH_TENANT or GRAPH_TOKEN_URL')
  process.exit(1)
}

// ── exact copies of the watcher's parsers ──
function vttToText(v) {
  if (!v) return ''
  const turns = []; let cur = null; let inCue = false
  for (const raw of String(v).split(/\r?\n/)) {
    const l = raw.trim()
    if (!l) { inCue = false; continue }
    if (/-->/.test(l)) { inCue = true; continue }
    if (!inCue) continue
    const m = l.match(/^<v\s+([^>]+)>([\s\S]*)$/i)
    if (m) {
      const speaker = m[1].trim()
      const text = m[2].replace(/<\/v>/ig, '').replace(/<[^>]+>/g, '').trim()
      if (cur && cur.speaker === speaker) { cur.text += ' ' + text }
      else { cur = { speaker, text }; turns.push(cur) }
    } else {
      const text = l.replace(/<[^>]+>/g, '').trim()
      if (!text) continue
      if (cur) { cur.text += ' ' + text } else { cur = { speaker: '', text }; turns.push(cur) }
    }
  }
  return turns.map((t) => (t.speaker ? t.speaker + ': ' : '') + t.text.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
}
function vttDuration(v) {
  let max = 0
  for (const raw of String(v || '').split(/\r?\n/)) {
    const m = raw.match(/-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,]\d{1,3})?/)
    if (m) { const s = (m[1] ? +m[1] * 3600 : 0) + (+m[2]) * 60 + (+m[3]); if (s > max) max = s }
  }
  return max
}
const LEADERSHIP_TITLES = ['business leadership', 'customer leadership', 'leadership team meeting']

// ── Graph helpers ──
let TOKEN = ''
async function getToken() {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: CID, client_secret: SEC, scope: SCOPE })
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const j = await r.json()
  if (!r.ok) throw new Error('token ' + r.status + ' ' + JSON.stringify(j))
  TOKEN = j.access_token
}
async function graph(url, asText = false) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } })
    if (r.status === 429) { const wait = (+r.headers.get('retry-after') || 5) * 1000; await new Promise((s) => setTimeout(s, wait)); continue }
    if (r.status === 401) { await getToken(); continue }
    if (!r.ok) { const t = await r.text(); const e = new Error('graph ' + r.status + ' ' + t.slice(0, 200)); e.status = r.status; throw e }
    return asText ? r.text() : r.json()
  }
  throw new Error('graph: too many retries ' + url)
}
function chunks(startISO, endISO, days = 7) {
  const out = []; let s = new Date(startISO); const end = new Date(endISO)
  while (s < end) {
    const e = new Date(Math.min(s.getTime() + days * 864e5, end.getTime()))
    out.push([s.toISOString().replace(/\.\d{3}Z$/, 'Z'), e.toISOString().replace(/\.\d{3}Z$/, 'Z')])
    s = e
  }
  return out
}
const cleanName = (n) => String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim()

// ── DB ──
const db = new pg.Client({ ssl: { rejectUnauthorized: false } })
await db.connect()
const wl = await db.query(
  `SELECT * FROM watchlist WHERE active = true AND graph_user_id IS NOT NULL` + (ONLY_USER ? ` AND graph_user_id = '${ONLY_USER}'` : '')
)
const people = wl.rows.map((r) => ({ guid: r.graph_user_id, name: r.display_name || r.name || r.full_name || r.email || r.graph_user_id }))
const seen = await db.query(`SELECT dedup_key FROM inbox WHERE source = 'teams'`)
const already = new Set(seen.rows.map((r) => r.dedup_key))

await getToken()
console.log(`\nBackfill window: ${START}  ->  ${END}`)
console.log(`Watchlist people: ${people.length}${ONLY_USER ? ' (probe: single user)' : ''}   |   MODE: ${DRY ? 'DRY RUN (no writes)' : 'LIVE INSERT'}\n`)

const insertSQL =
  `INSERT INTO inbox (source, dedup_key, payload, status)
   SELECT 'teams', $1, jsonb_build_object(
     'account', COALESCE(
        (SELECT name FROM accounts WHERE $2 ILIKE '%'||name||'%' ORDER BY length(name) DESC LIMIT 1),
        (SELECT name FROM client_directory WHERE $2 ILIKE '%'||name||'%' ORDER BY length(name) DESC LIMIT 1),
        'UNKNOWN'),
     'title', $2::text,
     'visibility', $3::text,
     'duration_seconds', $4::int,
     'external_domains', $5::jsonb,
     'attendee_check', $6::text,
     'dedup_key', $1::text,
     'transcript', $7::text
   ), 'pending'
   WHERE $7 <> ''
   ON CONFLICT (dedup_key) DO NOTHING
   RETURNING id`

const inv = []
let inserted = 0, dup = 0, empty = 0, errored = 0
for (const p of people) {
  let found = 0
  for (const [cs, ce] of chunks(START, END)) {
    let url = `https://graph.microsoft.com/beta/users/${p.guid}/onlineMeetings/getAllTranscripts(meetingOrganizerUserId='${p.guid}',startDateTime=${cs},endDateTime=${ce})`
    while (url) {
      let page
      try { page = await graph(url) } catch (e) { if (e.status === 403 || e.status === 404) { url = ''; break } throw e }
      const vals = Array.isArray(page.value) ? page.value : []
      for (const t of vals) {
        found++
        const tid = t.id
        if (!tid) continue
        let subject = '', participants = {}
        try {
          const mtg = await graph(`https://graph.microsoft.com/v1.0/users/${p.guid}/onlineMeetings/${t.meetingId}`)
          subject = mtg.subject || ''; participants = mtg.participants || {}
        } catch (e) { /* subject best-effort */ }
        // attendee check (watcher logic)
        const ppl = []; if (participants.organizer) ppl.push(participants.organizer); (participants.attendees || []).forEach((a) => ppl.push(a))
        const upns = ppl.map((a) => ((a && a.upn) || '').toLowerCase()).filter(Boolean)
        const externals = upns.filter((u) => { const d = u.split('@')[1] || ''; return d && d !== 'tecknuovo.com' })
        const external_domains = [...new Set(externals.map((u) => u.split('@')[1]))]
        const attendee_check = upns.length ? 'ok' : 'unavailable'
        let vtt = ''
        try {
          vtt = await graph(`https://graph.microsoft.com/beta/users/${p.guid}/onlineMeetings/${t.meetingId}/transcripts/${tid}/content?$format=text/vtt`, true)
        } catch (e) { errored++; continue }
        const text = vttToText(vtt)
        const secs = vttDuration(vtt)
        const visibility = LEADERSHIP_TITLES.some((x) => (subject || '').toLowerCase().includes(x)) ? 'leadership' : 'all'
        const isDup = already.has(tid)
        const isEmpty = !text
        const row = { person: cleanName(p.name), date: (t.createdDateTime || '').slice(0, 10), subject: subject || '(no subject)', mins: Math.round(secs / 60), chars: text.length, status: isEmpty ? 'empty' : isDup ? 'dup' : 'NEW' }
        inv.push(row)
        if (isEmpty) { empty++; continue }
        if (isDup) { dup++; continue }
        if (!DRY) {
          const res = await db.query(insertSQL, [tid, subject, visibility, secs || 0, JSON.stringify(external_domains), attendee_check, text])
          if (res.rowCount) { inserted++; already.add(tid) }
          else { dup++ }
        } else { inserted++; already.add(tid) } // count as would-insert; add to seen to avoid double-count across users
      }
      url = page['@odata.nextLink'] || ''
    }
  }
  if (found) console.log(`  ${cleanName(p.name).padEnd(24)} ${found} transcript(s)`)
}

// ── report ──
inv.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
console.log('\n==== inventory (chronological) ====')
console.log('  date        min  chars   status  person / subject')
for (const r of inv) {
  console.log(`  ${r.date.padEnd(10)} ${String(r.mins).padStart(4)}  ${String(r.chars).padStart(6)}  ${r.status.padEnd(6)}  ${r.person} · ${r.subject.slice(0, 52)}`)
}
console.log('\n==== summary ====')
console.log(`  transcripts found : ${inv.length}`)
console.log(`  ${DRY ? 'WOULD INGEST (new)' : 'INSERTED (new)'}   : ${inserted}`)
console.log(`  already in DB     : ${dup}`)
console.log(`  empty transcript  : ${empty}`)
console.log(`  content errors    : ${errored}`)
console.log(DRY ? '\nDRY RUN — nothing written. Re-run with DRY_RUN=0 to ingest.\n' : '\nDONE — rows are in inbox (status=pending). Workflow 1 will process them.\n')
await db.end()
