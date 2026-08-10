// Post a SAMPLE of the weekly tnAI Slack report (workflow 16's exact format)
// to a webhook - so the report can be reviewed in OUR Slack before TN picks
// their channel. Runs anywhere with the api/.env values loaded:
//
//   cd ~/tecknuovo-brain/api && set -a && source .env && set +a && \
//     DAYS=30 node ../scripts/slack-report-sample.mjs
//
// DAYS widens the window (default 7; use 30 while ingestion is still paused).
// Posts to BRAIND_SLACK_WEBHOOK. No n8n needed - same SQL, same builder.
// pg is resolved from the api package (run this from the api/ directory)
import { createRequire } from 'module'
import path from 'path'
const require = createRequire(path.join(process.cwd(), 'package.json'))
const pg = require('pg')

const DAYS = Math.min(Math.max(Number(process.env.DAYS) || 7, 1), 90)
const HOOK = process.env.BRAIND_SLACK_WEBHOOK
if (!HOOK) { console.error('BRAIND_SLACK_WEBHOOK not set'); process.exit(1) }

const client = new pg.Client({ ssl: { rejectUnauthorized: false } })
await client.connect()
const { rows } = await client.query(`
SELECT jsonb_build_object(
 'brief', (SELECT content FROM briefs WHERE audience = 'leadership' ORDER BY created_at DESC LIMIT 1),
 'kpis', jsonb_build_object(
   'calls', (SELECT count(*) FROM calls WHERE call_date > now() - ($1 || ' days')::interval),
   'signals', (SELECT count(*) FROM signals WHERE created_at > now() - ($1 || ' days')::interval),
   'accounts', (SELECT count(DISTINCT account_id) FROM calls WHERE call_date > now() - ($1 || ' days')::interval AND account_id IS NOT NULL)),
 'people', COALESCE((SELECT jsonb_agg(y.j) FROM (
   SELECT jsonb_build_object('name', n.name, 'calls', count(DISTINCT c.id), 'accounts', count(DISTINCT c.account_id)) AS j
   FROM calls c CROSS JOIN LATERAL jsonb_object_keys(COALESCE(c.speaker_stats, '{}'::jsonb)) AS n(name)
   WHERE c.call_date > now() - ($1 || ' days')::interval
   GROUP BY n.name ORDER BY count(DISTINCT c.id) DESC LIMIT 4) y), '[]'::jsonb),
 'by_account', COALESCE((SELECT jsonb_agg(x.j) FROM (
   SELECT jsonb_build_object('account', a.name, 'type', s.type, 'summary', left(s.summary, 170), 'band', s.details->>'band') AS j
   FROM signals s JOIN accounts a ON a.id = s.account_id
   WHERE s.created_at > now() - ($1 || ' days')::interval
   ORDER BY a.name, s.created_at DESC LIMIT 60) x), '[]'::jsonb)
) AS ctx;`, [String(DAYS)])
await client.end()

// ── identical to workflow 16's builder ──
const ctx = rows[0].ctx || {}
const brief = ctx.brief || {}
const k = ctx.kpis || {}
const E = { risk: ':red_circle:', opportunity: ':large_green_circle:', update: ':large_blue_circle:', people: ':large_yellow_circle:' }
const cleanName = (n) => {
  const noParen = String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim()
  return noParen.includes(',') ? noParen.split(',').map((x) => x.trim()).reverse().join(' ') : noParen
}
const by = {}
for (const r of ctx.by_account || []) (by[r.account] = by[r.account] || []).push(r)
const order = Object.keys(by).sort((a, b) => {
  const ra = by[a].filter((x) => x.type === 'risk').length, rb = by[b].filter((x) => x.type === 'risk').length
  return rb - ra || by[b].length - by[a].length
})
const whyBy = {}, actBy = {}
for (const a of brief.accounts || []) {
  whyBy[(a.name || '').toLowerCase()] = a.why || ''
  actBy[(a.name || '').toLowerCase()] = (a.actions || [])[0] || ''
}
const wh = String(brief.whats_happening || '')
const overview = wh.split('\n').map((s) => s.trim()).filter((l) => l && !/^- /.test(l)).join(' ')
const points = wh.split('\n').map((s) => s.trim()).filter((l) => /^- /.test(l)).map((l) => l.slice(2))

const blocks = [
  { type: 'header', text: { type: 'plain_text', text: '🧠 tnAI — the week in delivery (SAMPLE)', emoji: true } },
  { type: 'context', elements: [{ type: 'mrkdwn', text: `${k.calls || 0} calls analysed · ${k.signals || 0} signals · ${k.accounts || 0} accounts · last ${DAYS} days` }] },
]
if (overview) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: overview.slice(0, 2900) } })
if (points.length) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: points.slice(0, 4).map((p) => '•  ' + p).join('\n').slice(0, 2000) }] })
blocks.push({ type: 'divider' })
blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ':bar_chart:  *Account by account*' } })
for (const acc of order.slice(0, 6)) {
  const sigs = by[acc]
  const nR = sigs.filter((x) => x.type === 'risk').length, nO = sigs.filter((x) => x.type === 'opportunity').length
  const rest = sigs.length - nR - nO
  const bits = []
  if (nR) bits.push(nR + ' risk' + (nR > 1 ? 's' : ''))
  if (nO) bits.push(nO + ' opportunit' + (nO > 1 ? 'ies' : 'y'))
  if (rest) bits.push(rest + ' update' + (rest > 1 ? 's' : ''))
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${acc}*   ·   ${bits.join(' · ')}` } })
  const sub = []
  const topRisk = sigs.find((x) => x.type === 'risk')
  const topGood = sigs.find((x) => x.type === 'opportunity') || sigs.find((x) => x.type === 'update') || sigs.find((x) => x.type === 'people' && x !== topRisk)
  const picks = [topRisk, topGood].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i)
  for (const s of picks) sub.push(`${E[s.type] || '▪️'} ${s.summary}`)
  const why = whyBy[acc.toLowerCase()]
  if (why) sub.push(`↳ _${why}_`)
  const act = actBy[acc.toLowerCase()]
  if (act) sub.push(`→ *${act}*`)
  if (sub.length) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: sub.join('\n').slice(0, 2000) }] })
}
const people = (ctx.people || []).map((p) => ({ ...p, name: cleanName(p.name) })).filter((p) => p.name)
if (people.length) {
  blocks.push({ type: 'divider' })
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ':busts_in_silhouette:  *The people*' } })
  const totalCalls = Number(k.calls) || 0
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: people.map((p) => {
    const pct = totalCalls ? Math.round((100 * p.calls) / totalCalls) : 0
    return `*${p.name}*  —  ${p.calls} call${p.calls !== 1 ? 's' : ''} across ${p.accounts} account${p.accounts !== 1 ? 's' : ''}  ·  in ${pct}% of the week's calls`
  }).join('\n') }] })
}
const needs = brief.needs_you || []
if (needs.length) {
  blocks.push({ type: 'divider' })
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ':rotating_light:  *Needs you*\n' + needs.map((n) => '•  ' + n).join('\n') } })
}
blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '<https://ast.tecknuovo.com|Open the dashboard>  ·  generated by tnAI from the week\'s calls, weekly reports + HubSpot' }] })

const r = await fetch(HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'tnAI — the week in delivery (sample)', blocks }) })
console.log(r.ok ? `Sample report posted to Slack (${DAYS}-day window).` : `Slack said ${r.status}: ${await r.text()}`)
