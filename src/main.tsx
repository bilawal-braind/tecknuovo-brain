import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { bootstrap } from './data/bootstrap'

// Hydrate data (live mode) before mounting, so components see real data immediately.
bootstrap().then((boot) => {
  const root = ReactDOM.createRoot(document.getElementById('root')!)

  if (boot.source === 'live' && boot.error) {
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

  if (boot.source === 'live') {
    // eslint-disable-next-line no-console
    console.info('[second-brain] live data loaded', boot.counts)
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
