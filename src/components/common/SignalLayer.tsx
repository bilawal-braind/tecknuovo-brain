import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Signal, SignalStatus } from '../../data/types'

type Ctx = {
  statusOf: (s: Signal) => SignalStatus
  setStatus: (id: string, status: SignalStatus) => void
}
const SignalCtx = createContext<Ctx>({ statusOf: (s) => s.status, setStatus: () => {} })
export const useSignal = () => useContext(SignalCtx)

export function SignalProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, SignalStatus>>({})
  const statusOf = useCallback((s: Signal) => overrides[s.id] ?? s.status, [overrides])
  const setStatus = useCallback((id: string, status: SignalStatus) => setOverrides((p) => ({ ...p, [id]: status })), [])
  return <SignalCtx.Provider value={{ statusOf, setStatus }}>{children}</SignalCtx.Provider>
}

export function fmt(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]} ${y}`
}
