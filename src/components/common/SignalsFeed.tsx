import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Search } from 'lucide-react'
import type { Signal, SignalType } from '../../data/types'
import { rankByImpact, riskScope } from '../../data/signals'
import { accountById, accountName, podName, projectById } from '../../data/org'
import { SignalBadge, RagDot, FilterChip } from './primitives'
import { SIGNAL_META } from '../../data/types'
import { TriageCard } from './TriageCard'
import { useSignal } from './SignalLayer'
import { CheckCircle2, EyeOff, X, RotateCcw } from 'lucide-react'
import { undoFeedback } from '../../data/api'

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
  const [q, setQ] = useState('')
  const [shownAll, setShownAll] = useState<Record<string, boolean>>({})
  const [flatCount, setFlatCount] = useState(20)
  const GROUP_CAP = 5
  const { statusOf } = useSignal()
  const [showResolved, setShowResolved] = useState(false)
  const [showRemoved, setShowRemoved] = useState(false)
  const live = signals.filter((s) => { const st = statusOf(s); return st !== 'actioned' && st !== 'dismissed' })
  const count = (t: SignalType) => live.filter((s) => s.type === t).length

  const parts = useMemo(() => {
    let list = filter === 'all' ? signals : signals.filter((s) => s.type === filter)
    if (filter === 'risk' && riskLevel !== 'all') list = list.filter((s) => riskScope(s) === riskLevel)
    if (callType !== 'all') list = list.filter((s) => s.sourceCall.type === callType)
    if (range !== 'all') {
      const cutoff = Date.now() - Number(range) * 86400000
      list = list.filter((s) => new Date(s.createdAt).getTime() >= cutoff)
    }
    const ql = q.trim().toLowerCase()
    if (ql) {
      list = list.filter((s) => {
        const hay = [
          accountName(s.accountId),
          s.projectId ? projectById(s.projectId)?.name : '',
          s.sourceCall.title,
          s.summary,
          s.quote,
          s.suggestedAction,
        ].join(' ').toLowerCase()
        return hay.includes(ql)
      })
    }
    // Option A (Meesha, 12 Aug): resolved work collapses to the bottom as a quiet
    // win pile; removed-as-incorrect hides behind its own strip, restorable.
    const open = list.filter((x) => { const st = statusOf(x); return st !== 'actioned' && st !== 'dismissed' })
    const resolved = list.filter((x) => statusOf(x) === 'actioned').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const removed = list.filter((x) => statusOf(x) === 'dismissed').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return {
      open: sort === 'newest' ? [...open].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : rankByImpact(open),
      resolved, removed,
    }
  }, [filter, riskLevel, callType, sort, range, q, signals, statusOf])
  const feed = parts.open

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
      <div className="relative mt-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search signals by account, call, quote, project…"
          className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-[13px] text-text outline-none placeholder:text-muted-2 focus:border-[var(--accent)]"
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`All (${live.length})`} />
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
        <span className="ml-auto inline-flex items-center gap-1.5">
          {parts.resolved.length > 0 && (
            <button onClick={() => setShowResolved(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-text"
              title="Actioned and done - kept for the record, reopen any of them">
              <CheckCircle2 size={13} style={{ color: 'var(--opp)' }} /> Resolved · {parts.resolved.length}
            </button>
          )}
          {parts.removed.length > 0 && (
            <button onClick={() => setShowRemoved(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-text"
              title="Signals marked incorrect or dismissed - restore any of them">
              <EyeOff size={13} /> Removed · {parts.removed.length}
            </button>
          )}
        </span>
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

      {showResolved && (
        <StatusPanel signals={parts.resolved} onClose={() => setShowResolved(false)}
          icon={<CheckCircle2 size={15} style={{ color: 'var(--opp)' }} />} title="Resolved signals"
          subtitle="actioned and done - kept for the record, Reopen puts one back" actionLabel="Reopen" retract={false} />
      )}
      {showRemoved && (
        <StatusPanel signals={parts.removed} onClose={() => setShowRemoved(false)}
          icon={<EyeOff size={15} className="text-muted" />} title="Removed signals"
          subtitle="marked incorrect or dismissed - Restore puts one straight back" actionLabel="Restore" retract />
      )}
    </>
  )
}

// The status panel: Resolved and Removed signals, one click to put back -
// opened from the toolbar so nobody scrolls hunting for a signal.
function StatusPanel({ signals, onClose, icon, title, subtitle, actionLabel, retract }: {
  signals: Signal[]; onClose: () => void; icon: React.ReactNode; title: string; subtitle: string; actionLabel: string; retract: boolean
}) {
  const { setStatus } = useSignal()
  const restore = (id: string) => {
    if (retract) undoFeedback(id).catch(() => {})
    setStatus(id, 'new')
  }
  return createPortal(
    <div className="fixed inset-0 z-[85] grid place-items-center bg-black/35 p-4" onClick={onClose}>
      <div className="flex max-h-[72vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
          {icon}
          <div>
            <div className="text-[14px] font-bold tracking-tight">{title}</div>
            <div className="text-[11px] text-muted-2">{subtitle}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto rounded-md p-1 text-muted-2 transition-colors hover:text-text"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-3">
          {signals.length === 0 && <p className="p-6 text-center text-[12px] text-muted-2">Nothing here - every signal is live.</p>}
          <div className="space-y-1.5">
            {signals.map((s) => (
              <div key={s.id} className="flex items-start gap-2.5 rounded-xl border border-line bg-bg-2 px-3.5 py-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SIGNAL_META[s.type].color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] leading-snug text-text">{s.summary}</div>
                  <div className="text-[10.5px] text-muted-2">{accountName(s.accountId)} · {s.sourceCall.title}</div>
                </div>
                <button onClick={() => restore(s.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-d)] transition-colors hover:border-[var(--accent)]">
                  <RotateCcw size={11} /> {actionLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
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

