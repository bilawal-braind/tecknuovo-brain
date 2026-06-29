// Where the dashboard gets its data.
//   'mock' (default) -> the bundled demo dataset, byte-for-byte unchanged.
//   'live'           -> the Read API over the real Postgres "memory".
// Flip with VITE_DATA_SOURCE=live (see .env.example). Nothing else changes.
const env = (import.meta as { env?: Record<string, string> }).env ?? {}

export const DATA_SOURCE: 'mock' | 'live' = env.VITE_DATA_SOURCE === 'live' ? 'live' : 'mock'
export const isLive = DATA_SOURCE === 'live'

// Base URL of the Read API. For a local SSH-tunnel setup this is http://localhost:4000;
// for the VM-tunnel setup it is the tunnel URL. Trailing slash trimmed.
export const API_URL = (env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '')

// Dev bearer token (AUTH_MODE=token on the API). Swapped for Entra SSO at go-live.
export const API_TOKEN = env.VITE_API_TOKEN ?? ''
