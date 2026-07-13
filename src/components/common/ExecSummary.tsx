import { useEffect, useRef, useState } from 'react'
import { Sparkles, ChevronRight } from 'lucide-react'
import type { Signal } from '../../data/types'
import { accountName, accounts } from '../../data/org'
import { calls } from '../../data/calls'
import { SignalBadge } from './primitives'
import { fmt } from './SignalLayer'

// "Today's intelligence" - an AI executive summary. On load it shows a brief "reading the
// calls" moment, then streams in layered lines (signal-type badge + account link + takeaway).
export function ExecSummary({ items, onOpen }: { items: Signal[]; onOpen: (accountId: string) => void }) {
  const [phase, setPhase] = useState<'thinking' | 'done'>('thinking')
  const [shown, setShown] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPhase('done'); setShown(items.length); return }
    setPhase('thinking')
    setShown(0)
    const start = window.setTimeout(() => {
      setPhase('done')
      items.forEach((_, i) => timers.current.push(window.setTimeout(() => setShown(i + 1), i * 220)))
    }, 1050)
    timers.current.push(start)
    return () => timers.current.forEach((t) => clearTimeout(t))
  }, [items.length])

  const nRisk = items.filter((s) => s.type === 'risk').length
  const nOpp = items.filter((s) => s.type === 'opportunity').length
  const parts: string[] = []
  if (nRisk) parts.push(`${nRisk} risk${nRisk > 1 ? 's' : ''}`)
  if (nOpp) parts.push(`${nOpp} opportunit${nOpp > 1 ? 'ies' : 'y'}`)
  const lead = parts.length ? `${parts.join(' and ')} lead today's brief.` : "Here's what matters across your accounts today."

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line p-5" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, var(--surface)), var(--surface))' }}>
      <div className="ai-sheen pointer-events-none absolute inset-x-0 top-0 h-[2px]" />

      <div className="flex flex-wrap items-center gap-2">
        <span className="relative grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: 'var(--accent)', boxShadow: '0 0 16px color-mix(in srgb, var(--accent) 70%, transparent)' }}>
          <Sparkles size={14} className={phase === 'thinking' ? 'animate-pulse' : ''} />
        </span>
        <span className="eyebrow">Today's intelligence</span>
        {phase === 'done' && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[10px] font-medium text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--opp)]" /> Generated just now
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-2">{fmt(new Date().toISOString().slice(0, 10))}</span>
      </div>

      {phase === 'thinking' ? (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-[14px] font-medium text-text">
            Reading {calls.length} calls across {accounts.length} accounts
            <span className="inline-flex gap-0.5">
              {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 animate-pulse rounded-full bg-[var(--accent)]" style={{ animationDelay: `${i * 180}ms` }} />)}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {[88, 70, 80].map((w, i) => <div key={i} className="ai-sheen h-3 rounded" style={{ width: `${w}%`, opacity: 0.5 }} />)}
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 text-[15px] font-semibold leading-snug">{lead}</p>
          <p className="mt-0.5 text-[12px] text-muted">The Second Brain skimmed every call across your accounts - click any line to open the account.</p>
          <ul className="mt-3 space-y-0.5">
            {items.map((s, i) => {
              const visible = i < shown
              return (
                <li key={s.id} className="transition-all duration-300 ease-out" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(5px)' }}>
                  <button onClick={() => onOpen(s.accountId)} className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-bg-2">
                    <span className="shrink-0"><SignalBadge type={s.type} size="sm" /></span>
                    <span className="flex-1 truncate text-[13px]">
                      <span className="font-semibold">{accountName(s.accountId)}</span>
                      <span className="text-muted"> · {s.summary}</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
