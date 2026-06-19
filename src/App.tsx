import { useEffect, useState } from 'react'
import { SignalProvider } from './components/common/SignalLayer'
import { Delivery } from './components/dashboards/Delivery'
import { ClientPartner } from './components/dashboards/ClientPartner'
import { Leadership } from './components/dashboards/Leadership'
import { Observability } from './components/dashboards/Observability'
import { SecondBrainFlow } from './components/vision/SecondBrainFlow'
import { Landing } from './components/Landing'

// Local dev serves one dashboard per port via VITE_DASH (npm run dev:delivery, etc.).
// Hosted (one site), the dashboard is chosen at runtime from the URL hash (#/delivery),
// with a landing page at the root. Hash routing needs no server rewrite rules on Amplify.
const ENV_DASH = (import.meta as { env?: Record<string, string> }).env?.VITE_DASH

const routeFromHash = () => window.location.hash.replace(/^#\/?/, '').trim()

export default function App() {
  const [route, setRoute] = useState<string>(() => ENV_DASH ?? routeFromHash())

  useEffect(() => {
    if (ENV_DASH) return
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route === 'flow') return <SecondBrainFlow />

  const dash =
    route === 'partner' ? <ClientPartner /> :
    route === 'leadership' ? <Leadership /> :
    route === 'observability' ? <Observability /> :
    route === 'delivery' ? <Delivery /> :
    null

  if (!dash) return <Landing />
  return <SignalProvider>{dash}</SignalProvider>
}
