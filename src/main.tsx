import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { bootstrap } from './data/bootstrap'
import { authEnabled, handleRedirect, getAuthToken, clearAuth } from './data/auth'

const root = ReactDOM.createRoot(document.getElementById('root')!)
// Remounting with a fresh key re-reads the in-memory data arrays everywhere - used
// once, right after load, if the background refresh found newer data than the cache.
let gen = 0
const mount = () => root.render(<React.StrictMode><App key={gen++} /></React.StrictMode>)

// Never a blank page: paint a splash before any network work starts.
root.render(
  <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', font: '500 14px system-ui, sans-serif', color: '#64748b' }}>
    Loading the Second Brain…
  </div>,
)

window.addEventListener('tn-data-updated', (e) => {
  // 'boot' = the catch-up fetch just after an instant cache paint (safe to remount:
  // the user has barely arrived). Later 'poll' updates show a gentle refresh pill
  // in the shell instead - never yank a view out from under someone mid-read.
  if ((e as CustomEvent).detail?.reason === 'boot') mount()
})

async function start() {
  // SSO mode: complete any sign-in redirect and make sure we hold a token BEFORE
  // fetching data - otherwise the API (rightly) rejects the request.
  if (authEnabled) {
    try { await handleRedirect() } catch { /* fall through to the login screen */ }
    if (!getAuthToken()) {
      // Not signed in yet → mount the app so it shows the sign-in screen. No data fetch.
      mount()
      return
    }
  }

  const boot = await bootstrap()

  // In SSO mode, a data 401 means the token is stale/invalid - clear it and let the
  // app show the sign-in screen again (rather than the hard "API unreachable" error).
  if (boot.source === 'live' && boot.error) {
    if (authEnabled && /401|unauthorized|invalid|expired|forbidden/i.test(boot.error)) {
      clearAuth()
      mount()
      return
    }
    root.render(
      <React.StrictMode>
        <div style={{ maxWidth: 560, margin: '15vh auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#e5e7eb' }}>
          <h2 style={{ margin: '0 0 8px' }}>Could not reach the Read API</h2>
          <p style={{ margin: '0 0 12px', color: '#9ca3af' }}>
            The dashboard is in live mode but the API did not respond. Check <code>VITE_API_URL</code>, the API
            process, and the tunnel/SSH bridge to Postgres.
          </p>
          <pre style={{ background: '#111827', padding: 12, borderRadius: 8, overflowX: 'auto', fontSize: 12 }}>{boot.error}</pre>
        </div>
      </React.StrictMode>,
    )
    return
  }

  if (boot.counts) {
    // eslint-disable-next-line no-console
    console.info('[second-brain] data loaded', boot.counts)
  }
  mount()
}

start()
