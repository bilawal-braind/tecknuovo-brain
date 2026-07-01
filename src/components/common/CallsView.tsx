import { useMemo, useState } from 'react'
import { Search, Video, ChevronDown } from 'lucide-react'
import type { Call } from '../../data/calls'
import { transcriptLinesFor } from '../../data/calls'
import type { SignalType } from '../../data/types'
import { accountName, projectById } from '../../data/org'
import { SignalBadge, ConfidenceBar, SeverityTag } from './primitives'
import { QAReview } from './QAReview'
import { fmt } from './SignalLayer'

const TODAY = '2026-06-18'
type Filter = 'all' | SignalType
type DateRange = 'all' | '30' | '7'

function daysAgo(iso: string) {
  const d = (s: string) => { const [y, m, dd] = s.split('-').map(Number); return Date.UTC(y, m - 1, dd) }
  return Math.round((d(TODAY) - d(iso)) / 86400000)
}

export function CallsView({ calls, title = 'Calls', subtitle }: { calls: Call[]; title?: string; subtitle?: string }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [range, setRange] = useState<DateRange>('all')

  const counts = useMemo(() => ({
    all: calls.length,
    opportunity: calls.filter((c) => c.signals.some((s) => s.type === 'opportunity')).length,
    risk: calls.filter((c) => c.signals.some((s) => s.type === 'risk')).length,
    update: calls.filter((c) => c.signals.some((s) => s.type === 'update')).length,
    people: calls.filter((c) => c.signals.some((s) => s.type === 'people')).length,
  }), [calls])

  const ql = q.trim().toLowerCase()
  const filtered = calls.filter((c) => {
    if (filter !== 'all' && !c.signals.some((s) => s.type === filter)) return false
    if (range !== 'all' && daysAgo(c.date) > Number(range)) return false
    if (ql) {
      const hay = `${c.title} ${c.type} ${c.speaker} ${accountName(c.accountId)} ${c.signals.map((s) => s.summary + ' ' + s.quote).join(' ')}`.toLowerCase()
      if (!hay.includes(ql)) return false
    }
    return true
  })

  return (
    <div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-0.5 text-[13px] text-muted">{subtitle ?? 'Every client call captured from Teams, with the signals the Second Brain pulled out of each one.'}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search calls, people, quotes, accounts…"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-[13px] text-text outline-none placeholder:text-muted-2 focus:border-[var(--accent)]"
          />
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value as DateRange)} className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[12px] font-medium text-muted">
          <option value="all">All time</option>
          <option value="30">Last 30 days</option>
          <option value="7">Last 7 days</option>
        </select>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')} label={`All (${counts.all})`} />
        <Chip active={filter === 'opportunity'} onClick={() => setFilter('opportunity')} type="opportunity" label={`Opportunities (${counts.opportunity})`} />
        <Chip active={filter === 'risk'} onClick={() => setFilter('risk')} type="risk" label={`Risks (${counts.risk})`} />
        <Chip active={filter === 'update'} onClick={() => setFilter('update')} type="update" label={`Updates (${counts.update})`} />
        <Chip active={filter === 'people'} onClick={() => setFilter('people')} type="people" label={`People (${counts.people})`} />
      </div>

      <div className="mt-3 space-y-2.5">
        {filtered.map((c) => <CallCard key={c.id} call={c} />)}
        {filtered.length === 0 && <p className="rounded-xl border border-line bg-surface p-8 text-center text-[12px] text-muted-2">No calls match your search.</p>}
      </div>
    </div>
  )
}

function CallCard({ call }: { call: Call }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'signals' | 'transcript'>('signals')
  const types = Array.from(new Set(call.signals.map((s) => s.type)))
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition-colors hover:bg-bg-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bg-2"><Video size={15} className="text-muted" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[13px] font-semibold">{call.title}</span>
              <span className="rounded-full bg-bg-2 px-2 py-0.5 text-[10px] font-medium text-muted">{call.type}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">{accountName(call.accountId)}{call.projectId ? ` · ${projectById(call.projectId)?.name}` : ''} · {call.speaker} · {fmt(call.date)}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1">
            {types.map((t) => <SignalBadge key={t} type={t} size="sm" />)}
          </div>
          <span className="hidden text-[11px] text-muted-2 sm:inline">{call.signals.length} signal{call.signals.length !== 1 ? 's' : ''}</span>
          <ChevronDown size={15} className={`text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-line bg-surface-2 p-3.5">
          <div className="mb-3 inline-flex rounded-lg border border-line bg-surface p-0.5 text-[11px] font-semibold">
            <button onClick={() => setTab('signals')} className={`rounded-md px-3 py-1 transition-colors ${tab === 'signals' ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text'}`}>Signals ({call.signals.length})</button>
            <button onClick={() => setTab('transcript')} className={`rounded-md px-3 py-1 transition-colors ${tab === 'transcript' ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text'}`}>Transcript</button>
          </div>

          {tab === 'signals' ? (
            <div className="space-y-2">
              {call.signals.map((s) => (
                <div key={s.id} className="rounded-lg border border-line bg-surface p-3" style={{ borderLeft: `3px solid var(--${s.type === 'opportunity' ? 'opp' : s.type})` }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <SignalBadge type={s.type} size="sm" />
                    <SeverityTag severity={s.severity} />
                    {s.value && <span className="text-[11px] text-muted">{s.value}</span>}
                    <span className="ml-auto"><ConfidenceBar value={s.confidence} /></span>
                  </div>
                  <p className="mt-2 text-[13px] font-medium leading-snug">{s.summary}</p>
                  <p className="mt-1 text-[12px] italic leading-relaxed text-muted">“{s.quote}”</p>
                  <p className="mt-1.5 text-[11px] text-muted">→ {s.suggestedAction} <span className="text-muted-2">({s.suggestedOwner.person} · {s.suggestedOwner.role})</span></p>
                  <div className="mt-2.5"><QAReview signalId={s.id} /></div>
                </div>
              ))}
            </div>
          ) : (
            <CallTranscript call={call} />
          )}
        </div>
      )}
    </div>
  )
}

export function CallTranscript({ call }: { call: Call }) {
  const lines = transcriptLinesFor(call)
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-2">Transcript · captured moments highlighted</div>
      <div className="space-y-1.5">
        {lines.map((l, i) =>
          l.signalType ? (
            <div key={i} className="rounded-lg bg-surface p-2.5" style={{ borderLeft: `3px solid var(--${l.signalType === 'opportunity' ? 'opp' : l.signalType})` }}>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold">{l.speaker}</span>
                <SignalBadge type={l.signalType} size="sm" />
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-text">“{l.text}”</p>
            </div>
          ) : (
            <p key={i} className="px-1 text-[13px] leading-relaxed">
              <span className="font-semibold text-muted">{l.speaker}:</span> <span className="text-text">{l.text}</span>
            </p>
          ),
        )}
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-2">Captured via Microsoft Teams · transcript stored in your environment</p>
    </div>
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
