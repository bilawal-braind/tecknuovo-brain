import type { ReactNode } from 'react'
import { ShieldCheck, AlertTriangle, Wifi } from 'lucide-react'
import type { Health, SignalType, Severity, Coverage } from '../../data/types'
import { SIGNAL_META, HEALTH_COLOR, HEALTH_LABEL } from '../../data/types'

export function RagDot({ health, withLabel = false }: { health: Health; withLabel?: boolean }) {
  const c = HEALTH_COLOR[health]
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}66` }} />
      {withLabel && (
        <span className="text-[12px] font-semibold" style={{ color: c }}>
          {HEALTH_LABEL[health]}
        </span>
      )}
    </span>
  )
}

export function SignalBadge({ type, size = 'md' }: { type: SignalType; size?: 'sm' | 'md' }) {
  const m = SIGNAL_META[type]
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide ${pad}`}
      style={{ color: m.color, backgroundColor: `${m.color}15`, border: `1px solid ${m.color}33` }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.color }} />
      {m.label}
    </span>
  )
}

const SEV_STYLE: Record<Severity, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#dc2626' },
  high: { label: 'High', color: '#ea580c' },
  medium: { label: 'Medium', color: '#d97706' },
  low: { label: 'Low', color: '#64748b' },
}
export function SeverityTag({ severity }: { severity: Severity }) {
  const s = SEV_STYLE[severity]
  return (
    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: s.color, backgroundColor: `${s.color}14` }}>
      {s.label}
    </span>
  )
}

export function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 85 ? 'var(--opp)' : value >= 70 ? 'var(--people)' : 'var(--risk)'
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence ${value}%`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-bg-2">
        <span className="block h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </span>
      <span className="text-[11px] font-medium text-muted">{value}%</span>
    </span>
  )
}

export function CoverageBadge({ coverage }: { coverage: Coverage }) {
  if (coverage === 'full') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
        <Wifi size={11} className="text-[var(--opp)]" /> Full coverage
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: 'var(--people)', background: 'color-mix(in srgb, var(--people) 12%, transparent)' }}
      title="Resource-only account - no Delivery Manager, data is patchy"
    >
      <AlertTriangle size={11} /> Limited data
    </span>
  )
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-medium text-muted" title="Refreshes from new calls automatically">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--opp)]" style={{ boxShadow: '0 0 8px var(--opp)' }} />
      Live
    </span>
  )
}

export function InTenantBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium" style={{ color: 'var(--accent-d)', borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)', background: 'var(--accent-l)' }} title="Runs inside Tecknuovo's environment">
      <ShieldCheck size={12} /> In your environment
    </span>
  )
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-2xl border border-line bg-surface ${onClick ? 'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-[var(--line-2)]' : ''} ${className}`}>
      {children}
    </div>
  )
}
