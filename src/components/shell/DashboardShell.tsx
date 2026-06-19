import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { BrandLockup } from '../common/Brand'
import { LiveBadge, InTenantBadge } from '../common/primitives'
import { CoPilot } from '../common/CoPilot'

export type Section = { id: string; label: string; icon: LucideIcon; count?: number }

const INTEGRATIONS = ['MS Teams · live', 'Monday.com', 'SharePoint', 'Confluence', 'HubSpot', 'Azure · in tenant']

export function DashboardShell({
  role,
  persona,
  sections,
  active,
  onSelect,
  children,
  onOpenAccount,
}: {
  role: string
  persona: string
  sections: Section[]
  active: string
  onSelect: (id: string) => void
  children: ReactNode
  onOpenAccount?: (id: string) => void
}) {
  const activeLabel = sections.find((s) => s.id === active)?.label ?? ''
  return (
    <div className="app-bg grid h-screen grid-cols-[256px_1fr] grid-rows-[58px_1fr] overflow-hidden">
      <aside className="row-span-2 flex flex-col overflow-hidden border-r border-line bg-surface">
        <a href="#/" title="All dashboards" className="flex-shrink-0 border-b border-line px-5 py-4 transition-colors hover:bg-bg-2">
          <BrandLockup />
        </a>
        <div className="flex-shrink-0 border-b border-line px-5 py-3.5">
          <div className="eyebrow">Dashboard</div>
          <div className="mt-1 text-[15px] font-bold tracking-tight">{role}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted-2">{persona}</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="px-2.5 pb-1.5 pt-2 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-2">Views</div>
          {sections.map((s) => {
            const Icon = s.icon
            const isActive = active === s.id
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="group relative mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-[var(--bg-2)]"
                style={{
                  background: isActive ? 'var(--accent-l)' : 'transparent',
                  color: isActive ? 'var(--accent-d)' : 'var(--muted)',
                  boxShadow: isActive ? '0 4px 14px -6px color-mix(in srgb, var(--accent) 55%, transparent)' : undefined,
                }}
              >
                {isActive && <span className="absolute -left-3 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r" style={{ background: 'var(--accent)' }} />}
                <Icon size={15} style={{ opacity: isActive ? 1 : 0.6 }} />
                <span className="flex-1">{s.label}</span>
                {s.count != null && (
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none" style={{ background: isActive ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--bg-2)', color: isActive ? 'var(--accent-d)' : 'var(--muted-2)' }}>{s.count}</span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="flex-shrink-0 border-t border-line px-4 py-3">
          <div className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-2">Sources</div>
          <div className="grid grid-cols-2 gap-1.5">
            {INTEGRATIONS.map((i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md bg-bg-2 px-2 py-1.5">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: 'var(--accent)' }} />
                <span className="truncate text-[10px] font-medium text-muted">{i}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <header className="flex items-center gap-3 border-b border-line bg-surface px-6">
        <div className="flex flex-1 items-center gap-2 text-[13px]">
          <span className="text-muted">{role}</span>
          <span className="text-muted-2">/</span>
          <span className="font-semibold text-text">{activeLabel}</span>
        </div>
        <LiveBadge />
        <InTenantBadge />
      </header>

      <main className="main-scroll overflow-y-auto">
        <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
          {children}
        </motion.div>
      </main>
      <CoPilot onOpenAccount={onOpenAccount} />
    </div>
  )
}
