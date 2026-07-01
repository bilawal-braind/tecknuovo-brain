import { Check, ArrowRightCircle, X, Video } from 'lucide-react'
import type { Signal } from '../../data/types'
import { SIGNAL_META } from '../../data/types'
import { accountName, projectById } from '../../data/org'
import { SignalBadge, SeverityTag, ConfidenceBar } from './primitives'
import { QAReview } from './QAReview'
import { useSignal, fmt } from './SignalLayer'

export function SignalCard({ signal, showAccount = true, showAction = true }: { signal: Signal; showAccount?: boolean; showAction?: boolean }) {
  const m = SIGNAL_META[signal.type]
  const { statusOf, setStatus } = useSignal()
  const status = statusOf(signal)
  const done = status === 'actioned' || status === 'dismissed'

  return (
    <div className={`rounded-xl border border-line bg-surface p-3.5 transition-opacity ${done ? 'opacity-60' : ''}`} style={{ borderLeft: `3px solid ${m.color}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SignalBadge type={signal.type} size="sm" />
          {showAccount && <span className="text-[13px] font-semibold">{accountName(signal.accountId)}</span>}
          {signal.projectId && <span className="text-[11px] text-muted-2">· {projectById(signal.projectId)?.name}</span>}
        </div>
        <span className="whitespace-nowrap text-[11px] text-muted-2">{fmt(signal.sourceCall.date)}</span>
      </div>

      <p className="mt-2 text-[13px] font-medium leading-snug text-text">{signal.summary}</p>
      <p className="mt-1 text-[12px] italic leading-relaxed text-muted">“{signal.quote}”</p>

      {/* source shown inline - no extra click */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-2">
        <Video size={11} className="shrink-0" />
        <span className="text-muted">{signal.sourceCall.title}</span>
        <span>· {signal.sourceCall.type} · {signal.sourceCall.speaker} · captured via Microsoft Teams</span>
      </div>

      {showAction && signal.suggestedAction && (
        <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-bg-2 px-3 py-2">
          <ArrowRightCircle size={14} className="mt-0.5 shrink-0" style={{ color: m.color }} />
          <div className="text-[12px] leading-snug text-text">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-2">Suggested </span>
            {signal.suggestedAction}
            <span className="mt-0.5 block text-[11px] text-muted">→ {signal.suggestedOwner.person} · {signal.suggestedOwner.role}</span>
          </div>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SeverityTag severity={signal.severity} />
          {signal.value && <span className="text-[11px] text-muted">{signal.value}</span>}
          <ConfidenceBar value={signal.confidence} />
        </div>
        {showAction && (
          done ? (
            <span className="rounded-md px-2 py-1 text-[11px] font-semibold capitalize" style={{ color: status === 'dismissed' ? 'var(--muted)' : 'var(--opp)', background: status === 'dismissed' ? 'var(--bg-2)' : 'color-mix(in srgb, var(--opp) 12%, transparent)' }}>{status}</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setStatus(signal.id, 'actioned')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white" style={{ background: 'var(--accent)' }}>
                <Check size={12} /> Actioned
              </button>
              <button onClick={() => setStatus(signal.id, 'dismissed')} className="rounded-md border border-line p-1 text-muted transition-colors hover:text-text" aria-label="Dismiss"><X size={13} /></button>
            </div>
          )
        )}
      </div>

      <div className="mt-2.5"><QAReview signalId={signal.id} /></div>
    </div>
  )
}
