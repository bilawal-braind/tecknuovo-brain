// The head-of-delivery layer (Kiera, 21 Aug call): the dashboard version of her
// morning brief. One glance = the state of her world in a sentence, at most
// three priorities to act on, then her accounts as cards. No signal wall - the
// full feed stays in the Signals tab.
import { useMemo } from 'react'
import { ArrowRight, ArrowUpRight, Radio } from 'lucide-react'
import { accounts, projects, personName } from '../../data/org'
import { signals } from '../../data/signals'
import { registerRisksForAccount } from '../../data/crm'
import { useOpenSignals } from '../common/SignalLayer'
import { RagDot, SignalBadge } from '../common/primitives'
import { SEVERITY_RANK } from '../../data/types'
import type { Signal } from '../../data/types'

// Accounts this person is on: client director, client partner, or DM on a project.
export function accountsForPersona(name: string) {
  return accounts.filter((a) =>
    personName(a.clientDirector) === name ||
    personName(a.clientPartner) === name ||
    (a.deliveryManager && personName(a.deliveryManager) === name) ||
    projects.some((p) => p.accountId === a.id && p.deliveryManager && personName(p.deliveryManager) === name))
}

const TYPE_ORDER: Record<Signal['type'], number> = { risk: 3, people: 2, opportunity: 2, update: 0 }
const SEV_LABEL: Record<Signal['severity'], string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }

function daysAgo(iso: string) {
  const d = Math.round((Date.now() - Date.parse(iso)) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

export function PersonalOverview({ personaName, onOpenAccount, onOpenSignal, onOpenSignals }: {
  personaName: string
  onOpenAccount: (id: string) => void
  onOpenSignal: (s: { id: string; accountId: string; projectId?: string }) => void
  onOpenSignals: () => void
}) {
  const mine = useMemo(() => accountsForPersona(personaName), [personaName])
  const mineIds = useMemo(() => new Set(mine.map((a) => a.id)), [mine])
  const myOpen = useOpenSignals(signals.filter((s) => mineIds.has(s.accountId)))
  const actionable = useMemo(() =>
    [...myOpen]
      .filter((s) => s.type !== 'update')
      .sort((a, b) =>
        (TYPE_ORDER[b.type] - TYPE_ORDER[a.type]) ||
        (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) ||
        b.createdAt.localeCompare(a.createdAt)),
    [myOpen])
  const priorities = actionable.slice(0, 3)
  const moreCount = actionable.length - priorities.length

  const myProjects = projects.filter((p) => mineIds.has(p.accountId))
  const offTrack = myProjects.filter((p) => p.rag !== 'green')
  const openRisks = myOpen.filter((s) => s.type === 'risk')
  const seriousRisks = openRisks.filter((s) => s.severity === 'critical' || s.severity === 'high')
  const newSinceYesterday = myOpen.filter((s) => Date.now() - Date.parse(s.createdAt) < 2 * 86_400_000).length

  // The state of her world in one written sentence, worst news first.
  const stateLine = useMemo(() => {
    const bits: string[] = []
    if (seriousRisks.length) {
      const byAcc = new Map<string, number>()
      for (const s of seriousRisks) byAcc.set(s.accountId, (byAcc.get(s.accountId) || 0) + 1)
      const worst = [...byAcc.entries()].sort((a, b) => b[1] - a[1])[0]
      const accName = mine.find((a) => a.id === worst[0])?.name ?? ''
      bits.push(`${seriousRisks.length} serious risk${seriousRisks.length > 1 ? 's' : ''} open${accName ? `, most on ${accName}` : ''}`)
    }
    if (offTrack.length) bits.push(`${offTrack.length} project${offTrack.length > 1 ? 's' : ''} off track`)
    if (!bits.length) return 'All accounts steady - nothing serious is open right now.'
    return bits.join(' and ') + '.'
  }, [seriousRisks, offTrack, mine])

  const firstName = personaName.split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      {/* hero: the state of her world in one glance */}
      <div className="rounded-2xl border p-6" style={{ borderColor: 'color-mix(in srgb, var(--accent) 22%, var(--line))', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 7%, var(--surface)), var(--surface) 62%)' }}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-[260px]">
            <span className="eyebrow">{today} · your day</span>
            <h3 className="display-title mt-1 text-[28px] font-bold leading-tight tracking-tight">{greeting}, {firstName}</h3>
            <p className="mt-2 max-w-[520px] text-[13.5px] leading-relaxed text-muted">{stateLine}</p>
          </div>
          <div className="flex items-end gap-8">
            <HeroStat value={mine.length} label="accounts" />
            <HeroStat value={openRisks.length} label="open risks" color={seriousRisks.length ? 'var(--risk)' : undefined} />
            <HeroStat value={offTrack.length} label="off track" color={offTrack.length ? 'var(--people)' : undefined} />
          </div>
        </div>
      </div>

      {/* the brief, on the dashboard: at most three priorities */}
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <h4 className="text-[15px] font-semibold">Your top priorities</h4>
          <span className="text-[11.5px] text-muted-2">the same three the morning brief would send you</span>
        </div>
        {newSinceYesterday > 0 && (
          <button onClick={onOpenSignals} className="text-[11.5px] font-semibold text-muted transition-colors hover:text-text">
            {newSinceYesterday} new signal{newSinceYesterday > 1 ? 's' : ''} since yesterday - review them →
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {priorities.map((s, i) => (
          <button key={s.id} onClick={() => onOpenSignal(s)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.16)]">
            <span className="metric-num grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[19px]" style={{
              color: s.type === 'risk' ? 'var(--risk)' : s.type === 'opportunity' ? 'var(--opp)' : 'var(--people)',
              background: `color-mix(in srgb, ${s.type === 'risk' ? 'var(--risk)' : s.type === 'opportunity' ? 'var(--opp)' : 'var(--people)'} 10%, transparent)`,
            }}>{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold leading-snug text-text">{s.summary}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-2">
                <SignalBadge type={s.type} size="sm" />
                <b className="font-semibold text-muted">{mine.find((a) => a.id === s.accountId)?.name}</b>
                {s.type === 'risk' && <span className="rounded-full px-1.5 py-px text-[10px] font-bold" style={{ color: s.severity === 'critical' || s.severity === 'high' ? 'var(--risk)' : 'var(--muted)', background: `color-mix(in srgb, ${s.severity === 'critical' || s.severity === 'high' ? 'var(--risk)' : 'var(--muted)'} 10%, transparent)` }}>{SEV_LABEL[s.severity]}</span>}
                <span>· {daysAgo(s.createdAt)}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-muted-2 transition-colors group-hover:text-text">
              Open <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
        {priorities.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-[13px] font-semibold">Nothing needs you right now</p>
            <p className="mt-1 text-[12px] text-muted-2">New risks and opportunities from your calls will land here.</p>
          </div>
        )}
        {moreCount > 0 && (
          <button onClick={onOpenSignals} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line bg-transparent px-4 py-2.5 text-[12px] font-semibold text-muted transition-colors hover:border-[var(--line-2)] hover:text-text">
            <Radio size={13} /> {moreCount} more waiting in Signals <ArrowUpRight size={13} />
          </button>
        )}
      </div>

      {/* her accounts, one card each */}
      <div className="mt-7 flex items-baseline gap-2.5">
        <h4 className="text-[15px] font-semibold">Your accounts</h4>
        <span className="text-[11.5px] text-muted-2">healthiest last - click one to open it</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[...mine].sort((a, b) => ({ red: 0, amber: 1, green: 2 }[a.health] ?? 2) - ({ red: 0, amber: 1, green: 2 }[b.health] ?? 2)).map((a) => {
          const openN = myOpen.filter((s) => s.accountId === a.id).length
          const offN = myProjects.filter((p) => p.accountId === a.id && p.rag !== 'green').length
          const regN = registerRisksForAccount(a.id).length
          const roles = [
            personName(a.clientDirector) === personaName ? 'Client Director' : null,
            personName(a.clientPartner) === personaName ? 'Client Partner' : null,
          ].filter(Boolean).join(' + ')
          return (
            <button key={a.id} onClick={() => onOpenAccount(a.id)}
              className="group flex flex-col rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.18)]">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-[14.5px] font-bold tracking-tight"><RagDot health={a.health} />{a.name}</span>
                <ArrowRight size={14} className="mt-0.5 shrink-0 text-muted-2 transition-all group-hover:translate-x-0.5 group-hover:text-text" />
              </div>
              <p className="mt-0.5 text-[11px] text-muted-2">{roles || 'Delivery oversight'}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                <MicroStat n={openN} label="signals" />
                <MicroStat n={offN} label="off track" color={offN ? 'var(--risk)' : undefined} />
                <MicroStat n={regN} label="register" />
              </div>
              {a.healthReason && <p className="mt-2.5 line-clamp-2 text-[11px] leading-snug text-muted-2">{a.healthReason}</p>}
            </button>
          )
        })}
        {mine.length === 0 && <p className="col-span-full rounded-2xl border border-line bg-surface p-6 text-center text-[12.5px] text-muted-2">No accounts are assigned to {personaName} yet - assignments come from the Monday boards.</p>}
      </div>
    </>
  )
}

function HeroStat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="text-right">
      <div className="metric-num" style={{ fontSize: 34, lineHeight: '36px', ...(color ? { color } : {}) }}>{value}</div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  )
}

function MicroStat({ n, label, color }: { n: number; label: string; color?: string }) {
  return (
    <div>
      <div className="num text-[16px] font-bold" style={color ? { color } : undefined}>{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-2">{label}</div>
    </div>
  )
}
