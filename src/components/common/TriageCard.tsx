import { useState } from 'react'
import { ChevronDown, ArrowRightCircle, Check, X, ArrowRight, RefreshCw, Send, Gauge } from 'lucide-react'
import type { Signal } from '../../data/types'
import { SIGNAL_META } from '../../data/types'
import { projectById, accountName } from '../../data/org'
import { riskScope } from '../../data/signals'
import { submitFeedback, pushToHubspot } from '../../data/api'
import { SignalBadge, SeverityTag, ConfidenceBar } from './primitives'
import { QAReview } from './QAReview'
import type { Verdict } from './QAReview'
import { useSignal, fmt } from './SignalLayer'

// Compact, expandable triage row: scan the headline, click to open the quote,
// the suggested action, and the full call transcript behind it.
export function TriageCard({ signal, onOpenAccount, showAccount = false }: { signal: Signal; onOpenAccount?: (accountId: string) => void; showAccount?: boolean }) {
  const [open, setOpen] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const { statusOf, setStatus } = useSignal()
  const m = SIGNAL_META[signal.type]
  const status = statusOf(signal)
  const done = status === 'actioned' || status === 'dismissed'
  const scope = riskScope(signal)

  // One shared verdict for the row control and the fuller panel in the expanded card.
  const logFeedback = (v: Verdict, note?: string) => {
    setVerdict(v)
    submitFeedback(signal.id, v.kind, { correctType: v.newType, reason: note }).catch(() => {})
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${done ? 'opacity-60' : ''}`} style={{ borderLeft: `3px solid ${m.color}` }}>
      <div className="flex w-full items-start gap-3 p-3">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className="mt-0.5"><SignalBadge type={signal.type} size="sm" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium leading-snug text-text">{signal.summary}</div>
            <div className="truncate text-[11px] text-muted-2">{showAccount && <span className="font-medium text-muted">{accountName(signal.accountId)} · </span>}{signal.projectId ? projectById(signal.projectId)?.name : 'Account-level'} · {fmt(signal.sourceCall.date)}</div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {scope && <span className="hidden rounded-full border px-1.5 py-0.5 text-[10px] font-semibold sm:inline" style={{ color: scope === 'account' ? 'var(--accent-d)' : 'var(--muted)', borderColor: 'var(--line)' }}>{scope === 'account' ? 'Account' : 'Delivery'}</span>}
          <SeverityTag severity={signal.severity} />
          {signal.value && <span className="hidden text-[11px] text-muted sm:inline">{signal.value}</span>}
          <span className="hidden md:inline"><ConfidenceBar value={signal.confidence} /></span>
          {done ? (
            <span className="text-[10px] font-semibold capitalize" style={{ color: status === 'dismissed' ? 'var(--muted)' : 'var(--opp)' }}>{status}</span>
          ) : (
            <FeedbackControl verdict={verdict} onVote={logFeedback} onRelabel={() => setOpen(true)} />
          )}
          <button onClick={() => setOpen((o) => !o)} aria-label="Expand" className="rounded-md p-0.5 text-muted-2 transition-colors hover:text-text"><ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} /></button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-surface-2 p-4">
          {/* Signal - what it is */}
          <div className="eyebrow text-muted-2">Signal</div>
          <div className="mt-1 flex items-start gap-2 text-[13px] font-medium leading-snug text-text">
            <span style={{ color: m.color }}>{m.emoji}</span>
            <span>{signal.summary}</span>
          </div>

          {/* Reason - why it was flagged */}
          <div className="mt-3 eyebrow text-muted-2">Why it was flagged</div>
          <p className="mt-1 border-l-2 pl-2.5 text-[13px] italic leading-relaxed text-muted" style={{ borderColor: m.color }}>“{signal.quote}”</p>
          <div className="mt-1 text-[11px] text-muted-2">{signal.sourceCall.title} · {signal.sourceCall.type}{signal.sourceCall.speaker ? ` · ${signal.sourceCall.speaker}` : ''} · via Microsoft Teams</div>

          {/* Action - what to do next */}
          <div className="mt-3 eyebrow text-muted-2">Suggested action</div>
          <div className="mt-1 flex items-start gap-2 rounded-lg bg-surface px-3 py-2">
            <ArrowRightCircle size={14} className="mt-0.5 shrink-0" style={{ color: m.color }} />
            <div className="text-[12.5px] leading-snug text-text">
              {signal.suggestedAction || 'No action suggested.'}
              {signal.suggestedOwner.person && signal.suggestedOwner.person !== '-' && (
                <span className="mt-0.5 block text-[11px] text-muted">Owner: {signal.suggestedOwner.person}{signal.suggestedOwner.role ? ` · ${signal.suggestedOwner.role}` : ''}</span>
              )}
            </div>
          </div>

          <FrameworkScore signal={signal} />

          {signal.type === 'opportunity' && !done && <HubspotApproval signal={signal} />}

          <div className="mt-3.5 border-t border-line pt-3"><QAReview signalId={signal.id} value={verdict} onSubmit={logFeedback} /></div>

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

// How the score was computed - always against Tecknuovo's own frameworks, never an
// AI opinion. Opportunities: NETWORKS (0-40). Risks: the 5x5 matrix (1-25).
function FrameworkScore({ signal }: { signal: Signal }) {
  let title = ''
  let scoreLine = ''
  let explain = ''
  if (signal.type === 'opportunity' && signal.networksTotal != null) {
    title = 'NETWORKS qualification score'
    scoreLine = `${signal.networksTotal}/40${signal.band ? ` · ${signal.band}` : ''}`
    explain = `Scored against Tecknuovo's NETWORKS framework (Need, Effort, Time, Who, Originality, Resources, Kompetition, Sign-off). Confidence ${signal.confidence}% = ${signal.networksTotal} out of 40.`
  } else if (signal.type === 'risk' && signal.likelihood != null && signal.impact != null) {
    title = '5x5 risk score'
    scoreLine = `${signal.likelihood} x ${signal.impact} = ${signal.likelihood * signal.impact}/25${signal.band ? ` · ${signal.band}` : ''}`
    explain = `Scored on Tecknuovo's 5x5 risk matrix (likelihood x impact). Confidence ${signal.confidence}% = ${signal.likelihood * signal.impact} out of 25.`
  } else {
    return null
  }
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-2"><Gauge size={12} /> {title}</span>
        <span className="text-[13px] font-bold" style={{ color: 'var(--accent-d)' }}>{scoreLine}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{explain}</p>
    </div>
  )
}

// Human-in-the-loop write-back: an approved opportunity is queued and workflow 11
// creates the deal in HubSpot (Opportunity Qualification pipeline, mapped to the
// account's company). Declining records the decision. The ONLY outward write.
function HubspotApproval({ signal }: { signal: Signal }) {
  const [state, setState] = useState<'idle' | 'busy' | 'queued' | 'declined' | 'done'>('idle')
  const decide = (approve: boolean) => {
    setState('busy')
    pushToHubspot(signal.id, approve)
      .then(() => setState(approve ? 'queued' : 'declined'))
      .catch(() => setState('done'))
  }
  if (state === 'queued')
    return <div className="mt-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold" style={{ color: 'var(--opp)', background: 'color-mix(in srgb, var(--opp) 10%, transparent)' }}>Approved. The deal will appear in HubSpot on this account within 15 minutes.</div>
  if (state === 'declined')
    return <div className="mt-3 rounded-lg bg-bg-2 px-3 py-2.5 text-[12px] text-muted">Noted as not an opportunity. It will not be pushed.</div>
  if (state === 'done')
    return <div className="mt-3 rounded-lg bg-bg-2 px-3 py-2.5 text-[12px] text-muted">A decision was already recorded for this opportunity.</div>
  return (
    <div className="mt-3 rounded-lg border px-3 py-2.5" style={{ borderColor: 'color-mix(in srgb, var(--opp) 40%, transparent)', background: 'color-mix(in srgb, var(--opp) 6%, transparent)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12.5px] font-semibold">Is this a real opportunity?</div>
          <div className="mt-0.5 text-[11px] text-muted">Approving creates a deal on this account in HubSpot (Opportunity Qualification pipeline). Nothing is pushed without your yes.</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button disabled={state === 'busy'} onClick={() => decide(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50" style={{ background: 'var(--opp)' }}>
            <Send size={12} /> Yes, push to HubSpot
          </button>
          <button disabled={state === 'busy'} onClick={() => decide(false)} className="rounded-md border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-text disabled:opacity-50">
            No
          </button>
        </div>
      </div>
    </div>
  )
}

// Always-visible feedback control on every signal row, on every dashboard - so anyone
// (not just people with the Observability dashboard) can mark a signal Correct / Incorrect
// or open it to relabel. Once given, it shows the logged verdict.
function FeedbackControl({ verdict, onVote, onRelabel }: { verdict: Verdict | null; onVote: (v: Verdict) => void; onRelabel: () => void }) {
  if (verdict) {
    const label = verdict.kind === 'correct' ? 'Correct' : verdict.kind === 'incorrect' ? 'Incorrect' : 'Relabelled'
    const color = verdict.kind === 'correct' ? 'var(--opp)' : verdict.kind === 'incorrect' ? 'var(--risk)' : 'var(--people)'
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
        {verdict.kind === 'correct' ? <Check size={11} /> : verdict.kind === 'incorrect' ? <X size={11} /> : <RefreshCw size={10} />} {label}
      </span>
    )
  }
  const btn = 'grid h-6 w-6 place-items-center rounded-md border border-line text-muted-2 transition-colors'
  return (
    <span className="inline-flex items-center gap-1" title="Is this signal right? Give feedback">
      <button onClick={(e) => { e.stopPropagation(); onVote({ kind: 'correct' }) }} aria-label="Mark correct" className={`${btn} hover:border-[var(--opp)] hover:text-[var(--opp)]`}><Check size={13} /></button>
      <button onClick={(e) => { e.stopPropagation(); onVote({ kind: 'incorrect' }) }} aria-label="Mark incorrect" className={`${btn} hover:border-[var(--risk)] hover:text-[var(--risk)]`}><X size={13} /></button>
      <button onClick={(e) => { e.stopPropagation(); onRelabel() }} aria-label="Relabel or add a note" className={`${btn} hover:border-[var(--people)] hover:text-[var(--people)]`}><RefreshCw size={11} /></button>
    </span>
  )
}
