// Wrapper: load the decrypted n8n Graph credential (exported by n8n's own CLI
// to CRED_FILE) into the environment, then run the Teams backfill. The secret
// is only ever held in memory here — never printed. Delete CRED_FILE after.
//
//   n8n export:credentials --decrypted --id=QIB3e7FDXq9aL6tW --output=/tmp/gcred.json
//   cd ~/tecknuovo-brain/api && set -a && source .env && set +a && \
//     CRED_FILE=/tmp/gcred.json DRY_RUN=1 node ../scripts/backfill-run.mjs
//   rm -f /tmp/gcred.json
import fs from 'fs'
const CRED_FILE = process.env.CRED_FILE || '/tmp/gcred.json'
let parsed
try { parsed = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8')) } catch (e) { console.error('cannot read CRED_FILE:', e.message); process.exit(1) }
const cred = Array.isArray(parsed) ? parsed.find((c) => /graph/i.test(c.name)) || parsed[0] : parsed
const d = cred.data || cred
const clientId = d.clientId || d.client_id
const clientSecret = d.clientSecret || d.client_secret
let tokenUrl = d.accessTokenUrl || d.tokenUrl || ''
const scope = d.scope || 'https://graph.microsoft.com/.default'
// derive tenant from the token URL if present (…/login.microsoftonline.com/<tenant>/…)
const tm = tokenUrl.match(/login\.microsoftonline\.com\/([^/]+)\//i)
const tenant = d.tenantId || d.tenant || (tm ? tm[1] : '')
if (!tokenUrl && tenant) tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
if (!clientId || !clientSecret || !tokenUrl) {
  console.error('credential missing fields. keys present:', Object.keys(d).join(', '))
  process.exit(1)
}
process.env.GRAPH_CLIENT_ID = clientId
process.env.GRAPH_CLIENT_SECRET = clientSecret
process.env.GRAPH_TOKEN_URL = tokenUrl
process.env.GRAPH_SCOPE = scope
const host = (() => { try { return new URL(tokenUrl).host } catch { return '?' } })()
console.log(`Loaded Graph credential "${cred.name || 'graph'}"  (clientId ****${String(clientId).slice(-4)}, token host ${host}, grant clientCredentials)`)
await import('./backfill-teams.mjs')
