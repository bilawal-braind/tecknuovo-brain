// Diagnostic: does the Braind app token actually carry transcript-read roles,
// and what does getAllTranscripts really return? Reads the decrypted cred file.
import fs from 'fs'
const CRED_FILE = process.env.CRED_FILE || '/tmp/gcred.json'
const p = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'))
const c = Array.isArray(p) ? p[0] : p
const d = c.data
const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: d.clientId, client_secret: d.clientSecret, scope: d.scope })
const tr = await fetch(d.accessTokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
const tj = await tr.json()
if (!tr.ok) { console.log('TOKEN FAIL', tr.status, JSON.stringify(tj)); process.exit(1) }
const tok = tj.access_token
const claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64').toString())
console.log('app roles granted:', JSON.stringify(claims.roles || 'NONE'))
console.log('appid:', claims.appid)

const u = process.env.PROBE_USER || '8709b85e-2636-42c9-8b44-2ec0f3f08db3'
const url = `https://graph.microsoft.com/beta/users/${u}/onlineMeetings/getAllTranscripts(meetingOrganizerUserId=%27${u}%27,startDateTime=2026-07-22T00:00:00Z,endDateTime=2026-08-10T00:00:00Z)`
const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } })
console.log('getAllTranscripts HTTP:', r.status)
console.log('body:', (await r.text()).slice(0, 500))
