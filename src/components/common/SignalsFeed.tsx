import { useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Signal, SignalType } from '../../data/types'
import { rankByImpact, riskScope } from '../../data/signals'
import { accountById, podName } from '../../data/org'
import { SignalBadge, RagDot } from './primitives'
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
  const count = (t: SignalType) => signals.filter((s) => s.type === t).length

  const feed = useMemo(() => {
    let list = filter === 'all' ? signals : signals.filter((s) => s.type === filter)
    if (filter === 'risk' && riskLevel !== 'all') list = list.filter((s) => riskScope(s) === riskLevel)
    if (callType !== 'all') list = list.filter((s) => s.sourceCall.type === callType)
    return sort === 'newest' ? [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : rankByImpact(list)
  }, [filter, riskLevel, callType, sort, signals])

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
        <Chip active={filter === 'all'} onClick={() => setFilter('all')} label={`All (${signals.length})`} />
        <Chip active={filter === 'opportunity'} onClick={() => setFilter('opportunity')} type="opportunity" label={`Opportunities (${count('opportunity')})`} />
        <Chip active={filter === 'risk'} onClick={() => setFilter('risk')} type="risk" label={`Risks (${count('risk')})`} />
        <Chip active={filter === 'update'} onClick={() => setFilter('update')} type="update" label={`Updates (${count('update')})`} />
        <Chip active={filter === 'people'} onClick={() => setFilter('people')} type="people" label={`People (${count('people')})`} />
      </div>
      {filter === 'risk' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-2">Risk level</span>
          <Chip active={riskLevel === 'all'} onClick={() => setRiskLevel('all')} label="All risks" />
          <Chip active={riskLevel === 'account'} onClick={() => setRiskLevel('account')} label="Account" />
          <Chip active={riskLevel === 'delivery'} onClick={() => setRiskLevel('delivery')} label="Delivery" />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select label="Group by" value={groupBy} onChange={(v) => setGroupBy(v as GroupBy)} options={[['account', 'Account'], ['type', 'Signal type'], ['none', 'No grouping']]} />
        <Select label="Call type" value={callType} onChange={setCallType} options={[['all', 'All call types'], ...CALL_TYPES.map((c) => [c, c] as [string, string])]} />
        <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)} options={[['urgent', 'Most urgent'], ['newest', 'Newest first']]} />
      </div>

      {feed.length === 0 && <p className="mt-3 rounded-xl border border-line bg-surface p-8 text-center text-[12px] text-muted-2">No signals match these filters.</p>}

      {/* flat */}
      {groupBy === 'none' && (
        <div className="mt-3 space-y-2">
          {feed.map((s) => <TriageCard key={s.id} signal={s} showAccount onOpenAccount={onOpenAccount} />)}
        </div>
      )}

      {/* grouped by account */}
      {groupBy === 'account' && groups && (
        <div className="mt-3 space-y-5">
          {groups.map((g) => {
            const a = accountById(g.key)!
            return (
              <div key={g.key}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RagDot health={a.health} withLabel />
                    <span className="text-[14px] font-semibold">{a.name}</span>
                    <span className="text-[11px] text-muted-2">{podName(a.pod)} · {g.items.length} signal{g.items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <button onClick={() => onOpenAccount(g.key)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-d)] hover:underline">Open account <ArrowRight size={12} /></button>
                </div>
                <div className="space-y-2">
                  {g.items.map((s) => <TriageCard key={s.id} signal={s} onOpenAccount={onOpenAccount} />)}
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
                {g.items.map((s) => <TriageCard key={s.id} signal={s} showAccount onOpenAccount={onOpenAccount} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
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

function Chip({ active, onClick, label, type }: { active: boolean; onClick: () => void; label: string; type?: SignalType }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${active ? 'border-transparent bg-[var(--accent)] text-white' : 'border-line bg-surface text-muted hover:text-text'}`}>
      {type && !active && <SignalBadge type={type} size="sm" />}
      {label}
    </button>
  )
}
