import { Sparkles, ChevronRight } from 'lucide-react'
import type { Signal } from '../../data/types'
import { SIGNAL_META } from '../../data/types'
import { accountName } from '../../data/org'
import { fmt } from './SignalLayer'

// "Today's intelligence" - an AI executive summary. Each bullet links to the real
// signal/account it came from (the account name is the clickable entity, with its signal dot).
export function ExecSummary({ items, onOpen }: { items: Signal[]; onOpen: (accountId: string) => void }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg text-white" style={{ background: 'var(--accent)' }}><Sparkles size={13} /></span>
        <span className="eyebrow">Today's intelligence · AI summary</span>
        <span className="ml-auto text-[11px] text-muted-2">read from {items.length} top signals · {fmt('2026-06-18')}</span>
      </div>
      <p className="mt-2 text-[13px] text-muted">The Second Brain skimmed every call across your accounts. Here's what matters - click any line to open the account.</p>
      <ul className="mt-3 space-y-0.5">
        {items.map((s) => {
          const c = SIGNAL_META[s.type].color
          return (
            <li key={s.id}>
              <button onClick={() => onOpen(s.accountId)} className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug transition-colors hover:bg-bg-2">
                <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}66` }} />
                <span className="flex-1 text-text"><span className="font-semibold" style={{ color: c }}>{accountName(s.accountId)}</span> {s.summary}</span>
                <ChevronRight size={15} className="mt-0.5 shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
