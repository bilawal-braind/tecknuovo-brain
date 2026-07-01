import { useState } from 'react'
import type { MouseEvent } from 'react'
import { ThumbsUp, ThumbsDown, ShieldCheck } from 'lucide-react'
import { submitFeedback } from '../../data/api'

// Lightweight quality control shown on every signal, on every dashboard: a human
// can confirm the AI got it right or wrong. Feeds the same feedback the Observability
// layer uses. (Silently no-ops if the API isn't reachable, e.g. the mock demo.)
export function QAReview({ signalId }: { signalId: string }) {
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null)

  const mark = (e: MouseEvent, v: 'correct' | 'incorrect') => {
    e.stopPropagation()
    setVerdict(v)
    submitFeedback(signalId, v).catch(() => {})
  }

  if (verdict) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: verdict === 'correct' ? 'var(--opp)' : 'var(--risk)' }}>
        <ShieldCheck size={11} /> Marked {verdict}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-2">QA</span>
      <button onClick={(e) => mark(e, 'correct')} className="rounded-md border border-line p-1 text-muted transition-colors hover:text-[var(--opp)]" aria-label="Mark correct" title="Mark correct"><ThumbsUp size={12} /></button>
      <button onClick={(e) => mark(e, 'incorrect')} className="rounded-md border border-line p-1 text-muted transition-colors hover:text-[var(--risk)]" aria-label="Mark incorrect" title="Mark incorrect"><ThumbsDown size={12} /></button>
    </span>
  )
}
