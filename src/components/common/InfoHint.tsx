import { useState } from 'react'
import { Info } from 'lucide-react'

// A small ⓘ next to a chart title - hover explains what the graph shows and why
// it matters, in a TN-teal glass bubble. Keeps the labels clean without losing meaning.
export function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Info size={13} className="cursor-help transition-colors" style={{ color: open ? 'var(--accent-d)' : 'var(--muted-2)' }} />
      {open && (
        <span
          className="glass absolute left-1/2 top-full z-40 mt-1.5 block w-[250px] -translate-x-1/2 rounded-xl border p-3 text-left text-[11.5px] font-normal normal-case tracking-normal"
          style={{
            borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--line))',
            background: 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 10%, var(--surface)), color-mix(in srgb, var(--surface) 72%, transparent))',
            boxShadow: '0 14px 40px -14px color-mix(in srgb, var(--accent) 50%, transparent), 0 2px 10px rgba(16,24,40,0.08)',
          }}
        >
          <span className="block text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent-d)' }}>What this shows</span>
          <span className="mt-1 block" style={{ color: 'var(--text)', lineHeight: 1.55 }}>{text}</span>
        </span>
      )}
    </span>
  )
}
