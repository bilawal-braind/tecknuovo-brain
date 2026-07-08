import { ArrowLeft, Users, FolderKanban, CalendarCheck, ChevronRight, Briefcase, Contact } from 'lucide-react'
import { accountById, personName, podName, projectsForAccount } from '../../data/org'
import { signalsForAccount } from '../../data/signals'
import { callsForAccount } from '../../data/calls'
import { complianceFor } from '../../data/delivery'
import { dealsForAccount, stakeholdersForAccount, prettyBuyingRole } from '../../data/crm'
import type { CadenceStatus } from '../../data/types'
import { RagDot, CoverageBadge } from './primitives'
import { CallsView } from './CallsView'

export function money(n: number) {
  return n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}m` : `£${Math.round(n / 1000)}k`
}

const CAD_COLOR: Record<CadenceStatus, string> = {
  done: 'var(--opp)', missed: 'var(--risk)', overdue: 'var(--people)', 'not-due': 'var(--muted-2)',
}
const CAD_LABEL: Record<CadenceStatus, string> = {
  done: 'Held', missed: 'Missed', overdue: 'Overdue', 'not-due': 'Not due',
}

export function AccountView({ accountId, onBack, onOpenProject, backLabel = 'Back', commercial = true }: { accountId: string; onBack: () => void; onOpenProject?: (projectId: string) => void; backLabel?: string; commercial?: boolean }) {
  const account = accountById(accountId)
  if (!account) return null
  const projects = projectsForAccount(account.id)
  const calls = callsForAccount(account.id)
  const openCount = signalsForAccount(account.id).filter((s) => s.status === 'new' || s.status === 'routed').length
  const offTrack = projects.filter((p) => p.rag !== 'green').length

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-text">
        <ArrowLeft size={14} /> {backLabel}
      </button>

      {/* header */}
      <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <RagDot health={account.health} withLabel />
              <CoverageBadge coverage={account.coverage} />
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{account.name}</h2>
            <div className="mt-1 text-[13px] text-muted">{podName(account.pod)} pod · {projects.length} project{projects.length !== 1 ? 's' : ''} · last contact {account.lastContact}</div>
          </div>
          <div className="flex flex-col gap-1.5 text-[12px]">
            <span className="flex items-center gap-1.5 text-muted"><Users size={12} /> Client Director <b className="font-semibold text-text">{personName(account.clientDirector)}</b></span>
            <span className="text-muted">Client Partner <b className="font-semibold text-text">{personName(account.clientPartner)}</b></span>
            <span className="text-muted">Delivery Manager <b className="font-semibold text-text">{account.deliveryManager ? personName(account.deliveryManager) : 'None (resource-only)'}</b></span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {commercial ? (
            <>
              <Stat label="SOW value" value={money(account.sowValue)} />
              <Stat label="Budget burn" value={`${account.budgetBurnPct}%`} color={account.budgetBurnPct > 75 ? 'var(--risk)' : account.budgetBurnPct > 60 ? 'var(--people)' : undefined} bar={account.budgetBurnPct} />
              <Stat label="Headroom" value={money(account.headroom)} />
              <Stat label="Open signals" value={`${openCount}`} color="var(--accent)" />
            </>
          ) : (
            <>
              <Stat label="Projects" value={`${projects.length}`} />
              <Stat label="Open signals" value={`${openCount}`} color="var(--accent)" />
              <Stat label="Off track" value={`${offTrack}`} color={offTrack ? 'var(--risk)' : undefined} />
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        {/* calls on this account */}
        <CallsView calls={calls} title="Calls on this account" subtitle="Every call captured across this account's projects, newest first. Open one to see what was pulled from it." />

        {/* projects + cadence */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2.5 flex items-center gap-2"><FolderKanban size={14} className="text-muted-2" /><h3 className="text-[14px] font-semibold">Projects</h3><span className="text-[11px] text-muted-2">click to open</span></div>
            <div className="space-y-2">
              {projects.map((p) => (
                <button key={p.id} onClick={() => onOpenProject?.(p.id)} className="w-full rounded-lg bg-bg-2 p-3 text-left transition-colors hover:bg-[var(--line)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] font-semibold"><RagDot health={p.rag} />{p.name}</span>
                    <ChevronRight size={15} className="text-muted-2" />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                    <span>{p.phase}</span><span className="text-muted-2">·</span>
                    <span>{p.sprint}</span><span className="text-muted-2">·</span>
                    <span>{p.deliveryManager ? personName(p.deliveryManager) : 'resource-only'}</span>
                  </div>
                  <Cadence projectId={p.id} />
                </button>
              ))}
            </div>
          </div>

          {/* commercial pipeline + client stakeholders (CRM mirror; only renders when synced) */}
          {commercial && <CrmPanel accountId={account.id} />}
        </div>
      </div>
    </div>
  )
}

// Open deals + who holds the budget on this account — from the read-only HubSpot
// mirror. Renders nothing until the HubSpot sync has run (mock mode stays clean).
function CrmPanel({ accountId }: { accountId: string }) {
  const accDeals = dealsForAccount(accountId)
  const openDeals = accDeals.filter((d) => d.is_open)
  const stak = stakeholdersForAccount(accountId)
  if (!accDeals.length && !stak.length) return null
  const amt = (v: number | string | null) => {
    const n = typeof v === 'string' ? Number(v) : v
    return n && !isNaN(n) && n > 0 ? money(n) : null
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      {openDeals.length > 0 && (
        <>
          <div className="mb-2.5 flex items-center gap-2"><Briefcase size={14} className="text-muted-2" /><h3 className="text-[14px] font-semibold">Open pipeline</h3><span className="text-[11px] text-muted-2">from HubSpot</span></div>
          <div className="space-y-2">
            {openDeals.slice(0, 6).map((d) => (
              <div key={d.id} className="rounded-lg bg-bg-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold">{d.name}</span>
                  {amt(d.amount) && <span className="text-[13px] font-bold" style={{ color: 'var(--accent)' }}>{amt(d.amount)}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                  {d.stage && <span>{d.stage}</span>}
                  {d.pipeline && (<><span className="text-muted-2">·</span><span>{d.pipeline}</span></>)}
                  {d.networks_score != null && d.networks_score !== '' && (<><span className="text-muted-2">·</span><span>NETWORKS {d.networks_score}/40</span></>)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {stak.length > 0 && (
        <>
          <div className={`${openDeals.length ? 'mt-4 ' : ''}mb-2.5 flex items-center gap-2`}><Contact size={14} className="text-muted-2" /><h3 className="text-[14px] font-semibold">Key stakeholders</h3><span className="text-[11px] text-muted-2">buying power from CRM</span></div>
          <div className="space-y-1.5">
            {stak.slice(0, 8).map((s) => {
              const role = prettyBuyingRole(s.buying_role)
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 rounded-lg bg-bg-2 px-3 py-2">
                  <div className="text-[12.5px]"><b className="font-semibold">{s.name}</b>{s.job_title && <span className="text-muted"> · {s.job_title}</span>}</div>
                  {role && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: 'var(--accent-d)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                      {role}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color, bar }: { label: string; value: string; color?: string; bar?: number }) {
  return (
    <div className="rounded-xl border border-line bg-bg-2 p-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-xl font-bold" style={color ? { color } : undefined}>{value}</div>
      {bar != null && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full" style={{ width: `${bar}%`, background: color ?? 'var(--opp)' }} />
        </div>
      )}
    </div>
  )
}

function Cadence({ projectId }: { projectId: string }) {
  const c = complianceFor(projectId)
  if (!c) return null
  const items: { k: string; v: CadenceStatus }[] = [
    { k: 'Standup', v: c.standup }, { k: 'Weekly', v: c.weekly }, { k: 'Governance', v: c.governance },
  ]
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
      <CalendarCheck size={11} className="text-muted-2" />
      {items.map((it) => (
        <span key={it.k} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{ color: CAD_COLOR[it.v], background: `color-mix(in srgb, ${CAD_COLOR[it.v]} 12%, transparent)` }}>
          {it.k}: {CAD_LABEL[it.v]}
        </span>
      ))}
    </div>
  )
}
