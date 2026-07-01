// Microsoft Entra sign-in, hand-rolled (no dependency), auth-code + PKCE flow.
// response_mode=query keeps the ?code out of the URL fragment, so it never clashes
// with the app's hash routing (#/delivery). Token is kept in sessionStorage.
import { AUTH_MODE, ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_REDIRECT } from './source'

export const authEnabled = AUTH_MODE === 'entra'
const AUTHORITY = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}`

let idToken: string | null = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tn_id_token') : null
export const getAuthToken = () => idToken

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return b64url(new Uint8Array(digest))
}
function randString(bytes = 48): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return b64url(a)
}

export async function login(): Promise<void> {
  const verifier = randString()
  const state = randString(16)
  sessionStorage.setItem('tn_pkce', verifier)
  sessionStorage.setItem('tn_state', state)
  const params = new URLSearchParams({
    client_id: ENTRA_CLIENT_ID,
    response_type: 'code',
    response_mode: 'query',
    redirect_uri: ENTRA_REDIRECT,
    scope: 'openid profile email',
    state,
    code_challenge: await sha256(verifier),
    code_challenge_method: 'S256',
  })
  window.location.href = `${AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`
}

// Run on app load. If we're returning from Microsoft with a ?code, exchange it for a token.
export async function handleRedirect(): Promise<void> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code) return
  const verifier = sessionStorage.getItem('tn_pkce')
  if (!verifier || state !== sessionStorage.getItem('tn_state')) return
  const body = new URLSearchParams({
    client_id: ENTRA_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: ENTRA_REDIRECT,
    code_verifier: verifier,
  })
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (data.id_token) {
    idToken = data.id_token as string
    sessionStorage.setItem('tn_id_token', idToken)
  }
  sessionStorage.removeItem('tn_pkce')
  sessionStorage.removeItem('tn_state')
  // strip the OAuth params, keep the hash route
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('session_state')
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}

export function logout(): void {
  idToken = null
  sessionStorage.removeItem('tn_id_token')
  window.location.href = `${AUTHORITY}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(ENTRA_REDIRECT)}`
}
