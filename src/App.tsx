import { useEffect, useState } from 'react'
import { SignalProvider } from './components/common/SignalLayer'
import { Delivery } from './components/dashboards/Delivery'
import { ClientPartner } from './components/dashboards/ClientPartner'
import { Leadership } from './components/dashboards/Leadership'
import { Observability } from './components/dashboards/Observability'
import { SecondBrainFlow } from './components/vision/SecondBrainFlow'
import { QA } from './components/qa/QA'
import { EvalShowcase } from './components/qa/EvalShowcase'
import { Landing } from './components/Landing'
import { LoginScreen } from './components/Login'
import { authEnabled, handleRedirect, getAuthToken, login } from './data/auth'
import { fetchMe } from './data/api'
import type { Me } from './data/api'

// Local dev serves one dashboard per port via VITE_DASH. Hosted (one site), the
// dashboard is chosen from the URL hash (#/delivery). When AUTH is on, the signed-in
// user's role decides what they can open (enforced server-side by the API too).
const ENV_DASH = (import.meta as { env?: Record<string, string> }).env?.VITE_DASH
const routeFromHash = () => window.location.hash.replace(/^#\/?/, '').trim()

function renderDash(route: string) {
  if (route === 'flow') return <SecondBrainFlow />
  if (route === 'qa') return <EvalShowcase />
  if (route === 'qa-review') return <QA />
  const dash =
    route === 'partner' ? <ClientPartner /> :
    route === 'leadership' ? <Leadership /> :
    route === 'observability' ? <Observability /> :
    route === 'delivery' ? <Delivery /> :
    null
  if (!dash) return <Landing />
  return <SignalProvider>{dash}</SignalProvider>
}

export default function App() {
  const [route, setRoute] = useState<string>(() => ENV_DASH ?? routeFromHash())
  const [me, setMe] = useState<Me | null>(null)
  const [checked, setChecked] = useState<boolean>(!authEnabled)

  useEffect(() => {
    if (ENV_DASH) return
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!authEnabled) return
    ;(async () => {
      try {
        await handleRedirect()
        if (getAuthToken()) setMe(await fetchMe())
      } catch {
        /* fall through to the login screen */
      }
      setChecked(true)
    })()
  }, [])

  // No auth (mock demo / current behaviour) - unchanged.
  if (!authEnabled) return renderDash(route)

  // Auth on.
  if (!checked) return <Splash text="Signing you in…" />
  if (!me || !getAuthToken()) return <LoginScreen onLogin={login} />

  // Role → what they can open. scope 'all' (or admin) can navigate every dashboard,
  // and at the root route they get the landing page to pick from (the tn logo links
  // back to it). Everyone else is pinned to their own dashboard.
  const allowAll = me.role === 'admin' || me.scope === 'all'
  return renderDash(allowAll ? route : me.role)
}

function Splash({ text }: { text: string }) {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', font: '500 14px system-ui, sans-serif', color: '#64748b' }}>{text}</div>
}
