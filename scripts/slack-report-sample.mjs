// Post a SAMPLE of the tnAI Slack report to BRAIND_SLACK_WEBHOOK for review.
// Rebuilt to Govind's 12 Aug feedback: start at the highest level (the verdict),
// then go deeper; real spacing between blocks; no activity-count clutter at the
// top (counts live in the footer); readable section text, not small print.
//
//   cd ~/tecknuovo-brain/api && set -a && source .env && set +a && \
//     DAYS=14 AUDIENCE=delivery node ../scripts/slack-report-sample.mjs
//   AUDIENCE=delivery (Kiera: full detail, people) | leadership (Katie: needs-you first, tighter)
import { createRequire } from 'module'
import path from 'path'
const require = createRequire(path.join(process.cwd(), 'package.json'))
const pg = require('pg')

const DAYS = Math.min(Math.max(Number(process.env.DAYS) || 14, 1), 90)
const AUD = process.env.AUDIENCE === 'leadership' ? 'leadership' : 'delivery'
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

const ctx = rows[0].ctx || {}
const brief = ctx.brief || {}
const k = ctx.kpis || {}
const cleanName = (n) => {
  const noParen = String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim()
  return noParen.includes(',') ? noParen.split(',').map((x) => x.trim()).reverse().join(' ') : noParen
}

// group signals per account, worst first
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
const verdict = wh.split('\n').map((s) => s.trim()).filter((l) => l && !/^- /.test(l)).join(' ')
const needs = brief.needs_you || []

const blocks = []
const div = () => blocks.push({ type: 'divider' })

// ── 1 · header + the verdict (highest level first, no counts) ──
blocks.push({ type: 'header', text: { type: 'plain_text', text: AUD === 'leadership' ? 'tnAI · Your week' : 'tnAI · The week in delivery', emoji: true } })
if (verdict) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: verdict.slice(0, 2900) } })

// ── 2 · what needs you (leadership leads with this) ──
if (needs.length) {
  div()
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*What needs you*' } })
  for (const n of needs.slice(0, 3)) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ':small_red_triangle:  ' + n } })
} else if (AUD === 'leadership') {
  div()
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: ':white_check_mark:  *Nothing needs your intervention this period.*' } })
}

// ── 3 · account by account, spaced: one clean block per account ──
div()
blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*Account by account*' } })
const MAX_ACC = AUD === 'leadership' ? 4 : 6
for (const acc of order.slice(0, MAX_ACC)) {
  const sigs = by[acc]
  const nR = sigs.filter((x) => x.type === 'risk').length, nO = sigs.filter((x) => x.type === 'opportunity').length
  const rest = sigs.length - nR - nO
  const bits = []
  if (nR) bits.push(nR + ' risk' + (nR > 1 ? 's' : ''))
  if (nO) bits.push(nO + ' opportunit' + (nO > 1 ? 'ies' : 'y'))
  if (rest && AUD !== 'leadership') bits.push(rest + ' update' + (rest > 1 ? 's' : ''))
  const topRisk = sigs.find((x) => x.type === 'risk')
  const topGood = sigs.find((x) => x.type === 'opportunity') || sigs.find((x) => x.type === 'update')
  const lines = ['*' + acc + '*   ·   ' + bits.join(' · ')]
  if (topRisk) lines.push(':red_circle:  ' + topRisk.summary)
  if (topGood && topGood !== topRisk) lines.push(':large_green_circle:  ' + topGood.summary)
  const why = whyBy[acc.toLowerCase()]
  if (why) lines.push('_' + why + '_')
  const act = actBy[acc.toLowerCase()]
  if (act) lines.push(':arrow_right:  *' + act + '*')
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n').slice(0, 2900) } })
}

// ── 4 · the people (delivery only) ──
const people = (ctx.people || []).map((p) => ({ ...p, name: cleanName(p.name) })).filter((p) => p.name)
if (AUD !== 'leadership' && people.length) {
  div()
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*The people*' } })
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: people.map((p) =>
    ':bust_in_silhouette:  *' + p.name + '*  ·  ' + p.calls + ' call' + (p.calls !== 1 ? 's' : '') + ' across ' + p.accounts + ' account' + (p.accounts !== 1 ? 's' : '')
  ).join('\n') } })
}

// ── 5 · footer: the counts live here, small, out of the way ──
div()
blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `${k.calls || 0} calls · ${k.signals || 0} signals · ${k.accounts || 0} accounts · last ${DAYS} days  ·  <https://ast.tecknuovo.com|open the dashboard>  ·  written by tnAI from the period's calls, weekly reports + HubSpot` }] })

const r = await fetch(HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
  text: (AUD === 'leadership' ? 'tnAI · Your week' : 'tnAI · The week in delivery') + ' (sample)',
  username: 'tnAI', icon_emoji: ':brain:',
  blocks,
}) })
console.log(r.ok ? `Sample ${AUD} report posted (${DAYS}-day window).` : `Slack said ${r.status}: ${await r.text()}`)
