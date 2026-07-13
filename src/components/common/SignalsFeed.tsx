import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Signal, SignalType } from '../../data/types'
import { rankByImpact, riskScope } from '../../data/signals'
import { accountById, podName } from '../../data/org'
import { SignalBadge, RagDot, FilterChip } from './primitives'
import { SIGNAL_META } from '../../data/types'
import { TriageCard } from './TriageCard'

const CALL_TYPES = ['Daily standup', 'Weekly report', 'Monthly governance', 'Check-in', 'Client kickoff']
const TYPE_ORDER: SignalType[] = ['risk', 'opportunity', 'people', 'update']
type Filter = 'all' | SignalType
type Sort = 'urgent' | 'newest'
type GroupBy = 'account' | 'type' | 'none'

// Shared signal feed: filter by type + call type, sort, and group (by account, by type,
// or flat). Each row opens to the call + transcript. Used by every role dashboard.
export function SignalsFeed({ signals, onOpenAccount }: { signals: Signal[]; onOpenAccount: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [riskLevel, setRiskLevel] = useState<'all' | 'account' | 'delivery'>('all')
  const [callType, setCallType] = useState('all')
  const [sort, setSort] = useState<Sort>('urgent')
  const [groupBy, setGroupBy] = useState<GroupBy>('account')
  const [range, setRange] = useState<'all' | '30' | '7'>('all')
  const [shownAll, setShownAll] = useState<Record<string, boolean>>({})
  const [flatCount, setFlatCount] = useState(20)
  const GROUP_CAP = 5
  const count = (t: SignalType) => signals.filter((s) => s.type === t).length

  const feed = useMemo(() => {
    let list = filter === 'all' ? signals : signals.filter((s) => s.type === filter)
    if (filter === 'risk' && riskLevel !== 'all') list = list.filter((s) => riskScope(s) === riskLevel)
    if (callType !== 'all') list = list.filter((s) => s.sourceCall.type === callType)
    if (range !== 'all') {
      const cutoff = Date.now() - Number(range) * 86400000
      list = list.filter((s) => new Date(s.createdAt).getTime() >= cutoff)
    }
    return sort === 'newest' ? [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : rankByImpact(list)
  }, [filter, riskLevel, callType, sort, range, signals])

  const groups = useMemo(() => {
    if (groupBy === 'none') return null
    const order: string[] = []
    const map: Record<string, Signal[]> = {}
    for (const s of feed) {
      const key = groupBy === 'account' ? s.accountId : s.type
      if (!map[key]) { map[key] = []; order.push(key) }
      map[key].push(s)
    }
    const keys = groupBy === 'type' ? TYPE_ORDER.filter((t) => map[t]) : order
    return keys.map((k) => ({ key: k, items: map[k] }))
  }, [feed, groupBy])

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`All (${signals.length})`} />
        <FilterChip active={filter === 'opportunity'} onClick={() => setFilter('opportunity')} color={SIGNAL_META.opportunity.color} label={`Opportunities (${count('opportunity')})`} />
        <FilterChip active={filter === 'risk'} onClick={() => setFilter('risk')} color={SIGNAL_META.risk.color} label={`Risks (${count('risk')})`} />
        <FilterChip active={filter === 'update'} onClick={() => setFilter('update')} color={SIGNAL_META.update.color} label={`Updates (${count('update')})`} />
        <FilterChip active={filter === 'people'} onClick={() => setFilter('people')} color={SIGNAL_META.people.color} label={`People (${count('people')})`} />
      </div>
      {filter === 'risk' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-2">Risk level</span>
          <FilterChip active={riskLevel === 'all'} onClick={() => setRiskLevel('all')} label="All risks" />
          <FilterChip active={riskLevel === 'account'} onClick={() => setRiskLevel('account')} label="Account" />
          <FilterChip active={riskLevel === 'delivery'} onClick={() => setRiskLevel('delivery')} label="Delivery" />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select label="Group by" value={groupBy} onChange={(v) => setGroupBy(v as GroupBy)} options={[['account', 'Account'], ['type', 'Signal type'], ['none', 'No grouping']]} />
        <Select label="Call type" value={callType} onChange={setCallType} options={[['all', 'All call types'], ...CALL_TYPES.map((c) => [c, c] as [string, string])]} />
        <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)} options={[['urgent', 'Most urgent'], ['newest', 'Newest first']]} />
        <Select label="Time" value={range} onChange={(v) => setRange(v as 'all' | '30' | '7')} options={[['all', 'All time'], ['30', 'Last 30 days'], ['7', 'Last 7 days']]} />
      </div>

      {feed.length === 0 && <p className="mt-3 rounded-xl border border-line bg-surface p-8 text-center text-[12px] text-muted-2">No signals match these filters.</p>}

      {/* flat */}
      {groupBy === 'none' && (
        <div className="mt-3 space-y-2">
          {feed.slice(0, flatCount).map((s) => <TriageCard key={s.id} signal={s} showAccount onOpenAccount={onOpenAccount} />)}
          {feed.length > flatCount && (
            <button onClick={() => setFlatCount((c) => c + 20)} className="w-full rounded-lg border border-dashed border-line bg-surface px-3 py-2 text-[12px] font-semibold text-muted transition-colors hover:text-text">
              Show 20 more ({feed.length - flatCount} remaining)
            </button>
          )}
        </div>
      )}

      {/* grouped by account */}
      {groupBy === 'account' && groups && (
        <div className="mt-3 space-y-5">
          {groups.map((g) => {
            // A signal not yet linked to an account must not crash the whole tab -
            // it gets an "Unlinked" group until the pipeline's linker attaches it.
            const a = accountById(g.key)
            return (
              <div key={g.key || 'unlinked'}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {a ? (
                      <>
                        <RagDot health={a.health} withLabel />
                        <span className="text-[14px] font-semibold">{a.name}</span>
                        <span className="text-[11px] text-muted-2">{podName(a.pod)} · {g.items.length} signal{g.items.length !== 1 ? 's' : ''}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[14px] font-semibold text-muted">Unlinked</span>
                        <span className="text-[11px] text-muted-2">not yet matched to an account · {g.items.length} signal{g.items.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                  {a && <button onClick={() => onOpenAccount(g.key)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-d)] hover:underline">Open account <ArrowRight size={12} /></button>}
                </div>
                <div className="space-y-2">
                  {(shownAll[g.key] ? g.items : g.items.slice(0, GROUP_CAP)).map((s) => <TriageCard key={s.id} signal={s} onOpenAccount={onOpenAccount} />)}
                  <ShowMore total={g.items.length} cap={GROUP_CAP} open={!!shownAll[g.key]} onToggle={() => setShownAll((m) => ({ ...m, [g.key]: !m[g.key] }))} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* grouped by type */}
      {groupBy === 'type' && groups && (
        <div className="mt-3 space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-2">
                <SignalBadge type={g.key as SignalType} />
                <span className="text-[11px] text-muted-2">{g.items.length} signal{g.items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {(shownAll[g.key] ? g.items : g.items.slice(0, GROUP_CAP)).map((s) => <TriageCard key={s.id} signal={s} showAccount onOpenAccount={onOpenAccount} />)}
                <ShowMore total={g.items.length} cap={GROUP_CAP} open={!!shownAll[g.key]} onToggle={() => setShownAll((m) => ({ ...m, [g.key]: !m[g.key] }))} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// Groups cap at GROUP_CAP rows with a show-more toggle, so the feed stays scannable
// as months of signals accumulate.
function ShowMore({ total, cap, open, onToggle }: { total: number; cap: number; open: boolean; onToggle: () => void }) {
  if (total <= cap) return null
  return (
    <button onClick={onToggle} className="w-full rounded-lg border border-dashed border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-text">
      {open ? 'Show fewer' : `Show ${total - cap} more`}
    </button>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] text-muted">
      <span className="text-muted-2">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-medium text-text outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

