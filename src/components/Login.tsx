// Simple sign-in screen. Kicks off the Microsoft (Entra) redirect flow.
export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#94a3b8' }}>Tecknuovo × BraindAI</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '6px 0 2px', color: '#0f172a' }}>Second Brain</h1>
        <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 22px' }}>Sign in with your Tecknuovo account to continue.</p>
        <button
          onClick={onLogin}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#2f2f2f', color: '#fff', border: 0, borderRadius: 8, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Sign in with Microsoft
        </button>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '18px 0 0' }}>Only Tecknuovo accounts can access this dashboard.</p>
      </div>
    </div>
  )
}
