import { useState } from 'react'
import { ChevronDown, ArrowRightCircle, Check, X, ArrowRight } from 'lucide-react'
import type { Signal } from '../../data/types'
import { SIGNAL_META } from '../../data/types'
import { projectById, accountName } from '../../data/org'
import { riskScope } from '../../data/signals'
import { callForSignal } from '../../data/calls'
import { SignalBadge, SeverityTag, ConfidenceBar } from './primitives'
import { CallTranscript } from './CallsView'
import { QAReview } from './QAReview'
import { useSignal, fmt } from './SignalLayer'

// Compact, expandable triage row: scan the headline, click to open the quote,
// the suggested action, and the full call transcript behind it.
export function TriageCard({ signal, onOpenAccount, showAccount = false }: { signal: Signal; onOpenAccount?: (accountId: string) => void; showAccount?: boolean }) {
  const [open, setOpen] = useState(false)
  const { statusOf, setStatus } = useSignal()
  const m = SIGNAL_META[signal.type]
  const status = statusOf(signal)
  const done = status === 'actioned' || status === 'dismissed'
  const call = callForSignal(signal)
  const scope = riskScope(signal)

  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${done ? 'opacity-60' : ''}`} style={{ borderLeft: `3px solid ${m.color}` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-bg-2">
        <span className="mt-0.5"><SignalBadge type={signal.type} size="sm" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium leading-snug text-text">{signal.summary}</div>
          <div className="truncate text-[11px] text-muted-2">{showAccount && <span className="font-medium text-muted">{accountName(signal.accountId)} · </span>}{signal.projectId ? projectById(signal.projectId)?.name : 'Account-level'} · {fmt(signal.sourceCall.date)}</div>
        </div>
        {scope && <span className="hidden shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold sm:inline" style={{ color: scope === 'account' ? 'var(--accent-d)' : 'var(--muted)', borderColor: 'var(--line)' }}>{scope === 'account' ? 'Account' : 'Delivery'}</span>}
        <SeverityTag severity={signal.severity} />
        {signal.value && <span className="hidden text-[11px] text-muted sm:inline">{signal.value}</span>}
        <span className="hidden md:inline"><ConfidenceBar value={signal.confidence} /></span>
        {done && <span className="text-[10px] font-semibold capitalize" style={{ color: status === 'dismissed' ? 'var(--muted)' : 'var(--opp)' }}>{status}</span>}
        <ChevronDown size={15} className={`shrink-0 text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-line bg-surface-2 p-3.5">
          <p className="text-[13px] italic leading-relaxed text-muted">“{signal.quote}”</p>
          <div className="mt-1.5 text-[11px] text-muted-2">{signal.sourceCall.title} · {signal.sourceCall.type} · {signal.sourceCall.speaker} · captured via Microsoft Teams</div>

          <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-surface px-3 py-2">
            <ArrowRightCircle size={14} className="mt-0.5 shrink-0" style={{ color: m.color }} />
            <div className="text-[12px] leading-snug text-text">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-2">Suggested </span>
              {signal.suggestedAction}
              <span className="mt-0.5 block text-[11px] text-muted">→ {signal.suggestedOwner.person} · {signal.suggestedOwner.role}</span>
            </div>
          </div>

          {call && (
            <div className="mt-3 rounded-lg border border-line bg-surface p-3">
              <CallTranscript call={call} />
            </div>
          )}

          <div className="mt-3"><QAReview signalId={signal.id} /></div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {onOpenAccount && (
              <button onClick={() => onOpenAccount(signal.accountId)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-d)] hover:underline">Open the account <ArrowRight size={12} /></button>
            )}
            {!done && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => setStatus(signal.id, 'actioned')} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: 'var(--accent)' }}><Check size={12} /> Actioned</button>
                <button onClick={() => setStatus(signal.id, 'dismissed')} className="rounded-md border border-line p-1 text-muted transition-colors hover:text-text" aria-label="Dismiss"><X size={13} /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
