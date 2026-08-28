// Runs on VM from api dir. One-off backlog re-score (28 Aug, Bilawal's call):
// every OPEN risk is re-scored against the 5x5 framework v1.1 by the same Azure
// model the pipeline uses, with the calibrated instructions - full 1-5 range,
// no 4x3 default, and a written scoring_basis for every risk. Auditable: old
// score preserved in details.rescored_from, marker details.rescored.
// Usage: node rescore.mjs         (dry run - first 3 risks, prints results, writes nothing)
//        node rescore.mjs apply   (re-scores all open risks)
import pg from 'pg'
import fs from 'fs'
const APPLY = process.argv[2] === 'apply'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

// Azure credential from the n8n export placed at /tmp/creds.json by the caller
const creds = JSON.parse(fs.readFileSync('/tmp/creds.json', 'utf8'))
const az = creds.find((x) => /azure/i.test(x.type || '') && x.data && x.data.apiKey)
if (!az) { console.error('no azure credential found'); process.exit(1) }
const ENDPOINT = az.data.endpoint || `https://${az.data.resourceName}.openai.azure.com`
const KEY = az.data.apiKey

const kn = (await c.query(`SELECT content FROM tn_knowledge WHERE key = 'risk_framework'`)).rows[0].content

const system = `${kn}

You are re-scoring existing risk signals for Tecknuovo. Score STRICTLY against the framework above, on an INHERENT basis. Use the FULL 1-5 range for likelihood AND impact independently - never default to likelihood 4 x impact 3. A concern voiced once with no commercial exposure is typically likelihood 2-3 and impact 2-3. Impact is the HIGHEST of the four dimensions, anchored to the framework's thresholds. Return ONLY JSON: {"likelihood": 1-5, "impact": 1-5, "scoring_basis": "one short sentence justifying BOTH numbers against the framework anchors"}`

async function score(risk) {
  const user = `Risk on account "${risk.account ?? 'unknown'}": ${risk.summary}
Heard on the call: "${risk.quote ?? ''}"
Suggested action: ${risk.suggested_action ?? ''}`
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${ENDPOINT}/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-06-01`, {
      method: 'POST',
      headers: { 'api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0, max_tokens: 200, response_format: { type: 'json_object' },
      }),
    })
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 8000 * attempt)); continue }
    if (!res.ok) throw new Error(`azure ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const j = await res.json()
    const out = JSON.parse(j.choices[0].message.content)
    const L = Math.min(5, Math.max(1, Number(out.likelihood) || 3))
    const I = Math.min(5, Math.max(1, Number(out.impact) || 3))
    return { L, I, basis: String(out.scoring_basis || '').slice(0, 400) }
  }
  throw new Error('rate limited after 4 attempts')
}

const band = (s) => (s >= 20 ? 'Critical' : s >= 12 ? 'High' : s >= 8 ? 'Medium' : s >= 4 ? 'Low-Medium' : 'Low')

const risks = (await c.query(`
  SELECT s.id, s.summary, s.quote, s.suggested_action, a.name AS account,
         (s.details->>'likelihood')::int AS old_l, (s.details->>'impact')::int AS old_i
  FROM signals s LEFT JOIN accounts a ON a.id = s.account_id
  WHERE s.status = 'new' AND s.type = 'risk' ORDER BY s.created_at`)).rows
const todo = APPLY ? risks : risks.slice(0, 3)
console.log(`${risks.length} open risks; ${APPLY ? 'RE-SCORING ALL' : 'dry run on first 3'}`)

let changed = 0
const dist = {}
for (const [i, r] of todo.entries()) {
  const { L, I, basis } = await score(r)
  const s = L * I
  dist[s] = (dist[s] || 0) + 1
  const moved = r.old_l !== L || r.old_i !== I
  if (moved) changed++
  console.log(`${i + 1}/${todo.length} ${String(r.summary).slice(0, 48)} | ${r.old_l ?? '?'}x${r.old_i ?? '?'} -> ${L}x${I}=${s} ${band(s)}${moved ? '' : ' (same)'}`)
  if (APPLY) {
    await c.query(`
      UPDATE signals SET
        confidence = $2,
        details = COALESCE(details,'{}'::jsonb) || jsonb_build_object(
          'rescored', '2026-08-28',
          'rescored_from', jsonb_build_object('likelihood', details->'likelihood', 'impact', details->'impact', 'band', details->'band'),
          'likelihood', $3::int, 'impact', $4::int, 'score', $5::int, 'band', $6::text, 'scoring_basis', $7::text)
      WHERE id = $1`, [r.id, Math.round((s / 25) * 100), L, I, s, band(s), basis])
  }
  await new Promise((r2) => setTimeout(r2, 1200))
}
console.log(`\nscore distribution: ${JSON.stringify(dist)}`)
console.log(`changed: ${changed}/${todo.length}`)
await c.end()
