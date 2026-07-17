import { useState } from 'react'
import { Info } from 'lucide-react'

// A small ⓘ next to a chart title - hover explains what the graph shows and why
// it matters, in a glass bubble. Keeps the labels clean without losing meaning.
export function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Info size={13} className="cursor-help text-muted-2 transition-colors hover:text-text" />
      {open && (
        <span className="glass absolute left-1/2 top-full z-40 mt-1.5 block w-[250px] -translate-x-1/2 rounded-xl border border-line p-3 text-left text-[11.5px] font-normal normal-case tracking-normal shadow-xl"
          style={{ color: 'var(--text)', lineHeight: 1.5 }}>
          {text}
        </span>
      )}
    </span>
  )
}
