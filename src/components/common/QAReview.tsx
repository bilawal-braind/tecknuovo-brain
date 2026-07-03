import { useState } from 'react'
import { Check, X, RefreshCw } from 'lucide-react'
import type { SignalType } from '../../data/types'
import { SIGNAL_META } from '../../data/types'
import { submitFeedback } from '../../data/api'

// Prominent quality/feedback control shown on every signal, on every dashboard —
// the same Correct / Incorrect / Relabel + note flow as the Observability screen.
// Feeds the feedback loop (silently no-ops if the API isn't reachable, e.g. the mock demo).
const TYPES: SignalType[] = ['opportunity', 'risk', 'update', 'people']
export type Verdict = { kind: 'correct' | 'incorrect' | 'relabel'; newType?: SignalType }

// Uncontrolled by default (manages + submits its own verdict). If `value`/`onSubmit`
// are passed it is controlled by the parent (e.g. TriageCard, which shares one verdict
// between the always-visible row control and this fuller panel).
export function QAReview({ signalId, value, onSubmit }: { signalId: string; value?: Verdict | null; onSubmit?: (v: Verdict, note?: string) => void }) {
  const controlled = value !== undefined
  const [internal, setInternal] = useState<Verdict | null>(null)
  const verdict = controlled ? value : internal
  const [relabeling, setRelabeling] = useState(false)
  const [note, setNote] = useState('')

  const submit = (kind: 'correct' | 'incorrect' | 'relabel', newType?: SignalType) => {
    setRelabeling(false)
    if (controlled) { onSubmit?.({ kind, newType }, note || undefined); return }
    setInternal({ kind, newType })
    submitFeedback(signalId, kind, { correctType: newType, reason: note || undefined }).catch(() => {})
  }

  return (
    <div className="rounded-lg border border-line bg-bg-2 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-2">Quality check — is this right?</div>

      {verdict ? (
        <div className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-[12px] font-medium">
          {verdict.kind === 'correct' && <><Check size={14} className="text-[var(--opp)]" /> Marked correct</>}
          {verdict.kind === 'incorrect' && <><X size={14} className="text-[var(--risk)]" /> Marked incorrect</>}
          {verdict.kind === 'relabel' && verdict.newType && <><RefreshCw size={13} className="text-[var(--people)]" /> Relabelled to {SIGNAL_META[verdict.newType].label}</>}
          <span className="text-[11px] text-muted-2">— logged, the system learns from this.</span>
        </div>
      ) : relabeling ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-2">Correct label:</span>
          {TYPES.map((t) => (
            <button key={t} onClick={() => submit('relabel', t)} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium hover:border-[var(--line-2)]" style={{ color: SIGNAL_META[t].color }}>{SIGNAL_META[t].label}</button>
          ))}
          <button onClick={() => setRelabeling(false)} className="text-[11px] text-muted-2 hover:text-text">cancel</button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the model (optional)…" className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] outline-none placeholder:text-muted-2 focus:border-[var(--accent)]" />
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => submit('correct')} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: 'var(--opp)' }}><Check size={12} /> Correct</button>
            <button onClick={() => submit('incorrect')} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-muted hover:text-text"><X size={12} /> Incorrect</button>
            <button onClick={() => setRelabeling(true)} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-muted hover:text-text"><RefreshCw size={12} /> Relabel</button>
          </div>
        </div>
      )}
    </div>
  )
}
