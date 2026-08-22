// The personalised delivery layer (Kiera's ask, 21 Aug call): one level above
// the weeds. Opens with the handful of highest-impact actions across the
// accounts this person is actually on, then their accounts at a glance.
// The full signal feed stays one click away in the Signals tab.
import { useMemo } from 'react'
import { Sparkles, FolderKanban, Radio, ShieldAlert, ArrowRight } from 'lucide-react'
import { accounts, projects, personName } from '../../data/org'
import { signals } from '../../data/signals'
import { registerRisksForAccount } from '../../data/crm'
import { useOpenSignals } from '../common/SignalLayer'
import { TriageCard } from '../common/TriageCard'
import { RagDot } from '../common/primitives'
import { SEVERITY_RANK } from '../../data/types'
import type { Signal } from '../../data/types'

// Accounts this person is on: client director, client partner, or DM on a project.
export function accountsForPersona(name: string) {
  const mine = accounts.filter((a) =>
    personName(a.clientDirector) === name ||
    personName(a.clientPartner) === name ||
    (a.deliveryManager && personName(a.deliveryManager) === name) ||
    projects.some((p) => p.accountId === a.id && p.deliveryManager && personName(p.deliveryManager) === name))
  return mine
}

const TYPE_ORDER: Record<Signal['type'], number> = { risk: 3, people: 2, opportunity: 2, update: 0 }

export function PersonalOverview({ personaName, onOpenAccount }: {
  personaName: string
  onOpenAccount: (id: string) => void
}) {
  const mine = useMemo(() => accountsForPersona(personaName), [personaName])
  const mineIds = useMemo(() => new Set(mine.map((a) => a.id)), [mine])
  const myOpen = useOpenSignals(signals.filter((s) => mineIds.has(s.accountId)))

  const topActions = useMemo(() =>
    [...myOpen]
      .filter((s) => s.type !== 'update')
      .sort((a, b) =>
        (TYPE_ORDER[b.type] - TYPE_ORDER[a.type]) ||
        (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) ||
        b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
    [myOpen])

  const myProjects = projects.filter((p) => mineIds.has(p.accountId))
  const offTrack = myProjects.filter((p) => p.rag !== 'green')
  const registerOpen = mine.reduce((n, a) => n + registerRisksForAccount(a.id).length, 0)
  const firstName = personaName.split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="display-title text-[22px] font-bold tracking-tight">{greeting}, {firstName}</h3>
        <span className="text-[12.5px] text-muted-2">your accounts, distilled to what needs you first - the full feed lives in Signals</span>
      </div>

      {/* the handful that matter today */}
      <div className="mt-4 flex items-center gap-2">
        <Sparkles size={15} style={{ color: 'var(--accent-d)' }} />
        <span className="text-[14px] font-semibold">{topActions.length ? `The ${topActions.length} thing${topActions.length > 1 ? 's' : ''} that need you first` : 'Nothing needs you right now'}</span>
        <span className="text-[11px] text-muted-2">tick what is right, cross what is wrong, add the real ones to your list</span>
      </div>
      <div className="mt-3 space-y-2">
        {topActions.map((s) => <TriageCard key={s.id} signal={s} showAccount onOpenAccount={onOpenAccount} />)}
        {topActions.length === 0 && (
          <p className="rounded-2xl border border-line bg-surface p-6 text-center text-[12.5px] text-muted-2">All clear across your accounts - new signals land here as calls come in.</p>
        )}
      </div>

      {/* the numbers behind it */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PStat icon={FolderKanban} label="Your accounts" value={mine.length} />
        <PStat icon={Radio} label="Open signals" value={myOpen.length} color="var(--accent-d)" />
        <PStat icon={FolderKanban} label="Off-track projects" value={offTrack.length} color={offTrack.length ? 'var(--risk)' : undefined} />
        <PStat icon={ShieldAlert} label="On the risk register" value={registerOpen} />
      </div>

      {/* your accounts, one card each */}
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-[14px] font-semibold">Your accounts</span>
        <span className="text-[11px] text-muted-2">click one to open it</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mine.map((a) => {
          const openN = myOpen.filter((s) => s.accountId === a.id).length
          const roles = [
            personName(a.clientDirector) === personaName ? 'Client Director' : null,
            personName(a.clientPartner) === personaName ? 'Client Partner' : null,
          ].filter(Boolean).join(' · ')
          return (
            <button key={a.id} onClick={() => onOpenAccount(a.id)}
              className="group rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.18)]">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-[14px] font-bold tracking-tight"><RagDot health={a.health} />{a.name}</span>
                <ArrowRight size={14} className="mt-0.5 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--accent-d)' }} />
              </div>
              <p className="mt-1 text-[11.5px] text-muted">{roles || 'Delivery'}</p>
              <p className="mt-1.5 text-[11.5px] text-muted-2">
                <b className="num text-text">{openN}</b> open signal{openN !== 1 ? 's' : ''}
                {a.healthReason && <span> · {a.healthReason}</span>}
              </p>
            </button>
          )
        })}
        {mine.length === 0 && <p className="col-span-full rounded-2xl border border-line bg-surface p-6 text-center text-[12.5px] text-muted-2">No accounts are assigned to {personaName} yet - assignments come from the Monday boards.</p>}
      </div>
    </>
  )
}

function PStat({ icon: Icon, label, value, color }: { icon: typeof Radio; label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2"><Icon size={14} className="text-muted" /><span className="eyebrow">{label}</span></div>
      <div className="metric-num mt-2" style={{ fontSize: 30, lineHeight: '32px', ...(color ? { color } : {}) }}>{value}</div>
    </div>
  )
}
