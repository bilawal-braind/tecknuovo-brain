import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Build stamp shown in the sidebar footer - kills "am I on the right version?"
  define: { __BUILD_TS__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC') },
  plugins: [react()],
  // host:true so it's reachable over an SSH tunnel. The /api proxy lets the dashboard call
  // the Read API as the same origin (no CORS, one tunnel): browser -> vite:3030 -> api:4000.
  server: {
    host: true,
    port: 3030,
    proxy: { '/api': 'http://localhost:4000' },
  },
})
