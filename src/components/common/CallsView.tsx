import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Video, ChevronDown, FileText, X, Flag } from 'lucide-react'
import { fetchTranscript, createManualSignal } from '../../data/api'
import type { Call } from '../../data/calls'
import type { TranscriptLine } from '../../data/calls'
import { signals } from '../../data/signals'
import { transcriptWithMoments } from '../../data/calls'
import type { Signal, SignalType } from '../../data/types'
import { accountName, projectById } from '../../data/org'
import { SignalBadge, FilterChip } from './primitives'
import { SIGNAL_META } from '../../data/types'
import { TriageCard } from './TriageCard'
import { fmt } from './SignalLayer'

const TODAY = new Date().toISOString().slice(0, 10)
type Filter = 'all' | SignalType
type DateRange = 'all' | '30' | '7'

function daysAgo(iso: string) {
  const d = (s: string) => { const [y, m, dd] = s.split('-').map(Number); return Date.UTC(y, m - 1, dd) }
  return Math.round((d(TODAY) - d(iso)) / 86400000)
}

export function CallsView({ calls, title = 'Calls', subtitle, accountId }: { calls: Call[]; title?: string; subtitle?: string; accountId?: string }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [range, setRange] = useState<DateRange>('all')

  // In an account context, a call only counts the signals filed to THAT account -
  // a multi-client standup shows each account its own extractions, not everyone's.
  const sigsOf = (c: Call) => (accountId ? c.signals.filter((s) => s.accountId === accountId) : c.signals)

  const counts = useMemo(() => ({
    all: calls.length,
    opportunity: calls.filter((c) => sigsOf(c).some((s) => s.type === 'opportunity')).length,
    risk: calls.filter((c) => sigsOf(c).some((s) => s.type === 'risk')).length,
    update: calls.filter((c) => sigsOf(c).some((s) => s.type === 'update')).length,
    people: calls.filter((c) => sigsOf(c).some((s) => s.type === 'people')).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [calls, accountId])

  const ql = q.trim().toLowerCase()
  const filtered = calls.filter((c) => {
    if (filter !== 'all' && !sigsOf(c).some((s) => s.type === filter)) return false
    if (range !== 'all' && daysAgo(c.date) > Number(range)) return false
    if (ql) {
      const hay = `${c.title} ${c.type} ${c.speaker} ${accountName(c.accountId)} ${sigsOf(c).map((s) => s.summary + ' ' + s.quote).join(' ')}`.toLowerCase()
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
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`All (${counts.all})`} />
        <FilterChip active={filter === 'opportunity'} onClick={() => setFilter('opportunity')} color={SIGNAL_META.opportunity.color} label={`Opportunities (${counts.opportunity})`} />
        <FilterChip active={filter === 'risk'} onClick={() => setFilter('risk')} color={SIGNAL_META.risk.color} label={`Risks (${counts.risk})`} />
        <FilterChip active={filter === 'update'} onClick={() => setFilter('update')} color={SIGNAL_META.update.color} label={`Updates (${counts.update})`} />
        <FilterChip active={filter === 'people'} onClick={() => setFilter('people')} color={SIGNAL_META.people.color} label={`People (${counts.people})`} />
      </div>

      <div className="mt-3 space-y-2.5">
        {filtered.map((c) => <CallCard key={c.id} call={c} accountId={accountId} />)}
        {filtered.length === 0 && <p className="rounded-xl border border-line bg-surface p-8 text-center text-[12px] text-muted-2">No calls match your search.</p>}
      </div>
    </div>
  )
}

function CallCard({ call, accountId }: { call: Call; accountId?: string }) {
  const [open, setOpen] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const sigs = accountId ? call.signals.filter((s) => s.accountId === accountId) : call.signals
  const types = Array.from(new Set(sigs.map((s) => s.type)))
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition-colors hover:bg-bg-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bg-2"><Video size={15} className="text-muted" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[13px] font-semibold">{call.title}</span>
              <span className="rounded-full bg-bg-2 px-2 py-0.5 text-[10px] font-medium text-muted">{call.type}</span>
              {call.visibility === 'leadership' && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: 'var(--accent-d)', background: 'var(--accent-l)' }} title="Leadership-only meeting - visible to leadership and admin only">Leadership</span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">{[accountName(call.accountId), call.projectId ? projectById(call.projectId)?.name : null, call.speaker || null, fmt(call.date)].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1">
            {types.map((t) => <SignalBadge key={t} type={t} size="sm" />)}
          </div>
          <span className="hidden text-[11px] text-muted-2 sm:inline">{sigs.length} signal{sigs.length !== 1 ? 's' : ''}</span>
          <ChevronDown size={15} className={`text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-line bg-surface-2 p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Signals from this call ({sigs.length})</span>
            <button onClick={() => setShowTranscript(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-text">
              <FileText size={13} /> View transcript
            </button>
          </div>

          <div className="space-y-2">
            {/* Same full signal card as everywhere else - framework score, notes,
                feedback and the HubSpot approval all work inside the account view too. */}
            {sigs.map((s) => <TriageCard key={s.id} signal={s} />)}
          </div>
        </div>
      )}

      {/* The transcript opens as an overlay rather than inline - a full call can run to
          hundreds of lines, which would stretch the dashboard page unusably. */}
      {showTranscript && <TranscriptModal call={call} onClose={() => setShowTranscript(false)} />}
    </div>
  )
}

export function TranscriptModal({ call, onClose }: { call: Call; onClose: () => void }) {
  // Live calls carry only metadata in the list; the full transcript loads here, on
  // demand, and is cached back onto the call so reopening is instant. Mock/demo
  // calls (non-UUID ids) keep their built-in representative transcript. A LIVE call
  // never falls back to the representative version - if the real transcript can't
  // be loaded we say so instead of passing framed quotes off as the recording.
  const isLive = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(call.id)
  const [state, setState] = useState<'ready' | 'loading' | 'empty' | 'error'>(
    call.transcript || !isLive ? 'ready' : call.hasTranscript === false ? 'empty' : 'loading',
  )
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (call.transcript || !isLive || call.hasTranscript === false) return
    let stale = false
    setState('loading')
    fetchTranscript(call.id)
      .then((r) => {
        if (stale) return
        if (r.transcript && r.transcript.trim()) { call.transcript = r.transcript; setState('ready') }
        else setState('empty')
      })
      .catch(() => { if (!stale) setState('error') })
    return () => { stale = true }
  }, [call, isLive, attempt])

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl border border-line bg-surface"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold tracking-tight">{call.title}</h3>
            <div className="mt-0.5 text-[11.5px] text-muted">{[accountName(call.accountId), call.projectId ? projectById(call.projectId)?.name : null, call.type, fmt(call.date)].filter(Boolean).join(' · ')}</div>
          </div>
          <button onClick={onClose} aria-label="Close transcript" className="rounded-md p-1 text-muted-2 transition-colors hover:text-text"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {state === 'loading' ? (
            <p className="py-10 text-center text-[12.5px] text-muted">Loading the transcript…</p>
          ) : state === 'empty' ? (
            <p className="py-10 text-center text-[12.5px] text-muted">No transcript was captured for this call - the signals above carry the quotes that were extracted from it.</p>
          ) : state === 'error' ? (
            <div className="py-10 text-center">
              <p className="text-[12.5px] text-muted">The transcript couldn&apos;t be loaded just now.</p>
              <button onClick={() => setAttempt((n) => n + 1)} className="mt-3 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-text">Try again</button>
            </div>
          ) : (
            <CallTranscript call={call} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Stable colour per speaker so a long transcript is scannable at a glance.
const SPEAKER_PALETTE = ['#1A8B91', '#7C5CFF', '#E68A00', '#1F62C4', '#1F7A3A', '#B4468E']
const speakerColor = (name: string) => {
  let h = 7
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return SPEAKER_PALETTE[Math.abs(h) % SPEAKER_PALETTE.length]
}
const initials = (name: string) =>
  name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')

export function CallTranscript({ call }: { call: Call }) {
  const { lines, moments } = transcriptWithMoments(call)
  const blockRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [flash, setFlash] = useState<number | null>(null)

  // "The brain missed this" - flag any line as a signal (Chloe's quality backstop).
  // Creates a real, human-marked signal on the call's account; the line becomes a
  // captured block on save because the new signal joins call.signals immediately.
  const isLiveCall = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(call.id)
  const [flagIdx, setFlagIdx] = useState<number | null>(null)
  const [flagType, setFlagType] = useState<SignalType>('risk')
  const [flagSummary, setFlagSummary] = useState('')
  const [flagState, setFlagState] = useState<'idle' | 'saving' | 'error'>('idle')
  const openFlag = (i: number, text: string) => { setFlagIdx(i); setFlagType('risk'); setFlagSummary(text.slice(0, 200)); setFlagState('idle') }
  const saveFlag = (line: TranscriptLine) => {
    setFlagState('saving')
    createManualSignal(call.id, flagType, flagSummary.trim(), line.text)
      .then((r) => {
        const s: Signal = {
          id: r.id, type: flagType, accountId: call.accountId, projectId: call.projectId, pod: '',
          sourceCall: { title: call.title, date: call.date, type: call.type, speaker: line.speaker || '' },
          quote: line.text, summary: flagSummary.trim(), confidence: 100, severity: 'medium',
          suggestedOwner: { person: '-', role: '' }, suggestedAction: '', status: 'new',
          createdAt: new Date().toISOString().slice(0, 10), subtype: 'human-flagged',
        }
        signals.push(s)
        call.signals.push(s)
        setFlagIdx(null)
      })
      .catch(() => setFlagState('error'))
  }
  const jump = (i: number) => {
    blockRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(i)
    window.setTimeout(() => setFlash((f) => (f === i ? null : f)), 1800)
  }
  return (
    <div>
      {/* Sticky wayfinder: one chip per captured moment - click to scroll straight to
          it (and pulse it), so nobody hunts through a long transcript by hand. */}
      {moments.length > 0 ? (
        <div className="sticky top-0 z-10 -mx-1 mb-2 flex flex-wrap items-center gap-1.5 border-b border-line bg-surface px-1 pb-2.5 pt-1">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-muted-2">{moments.length} captured moment{moments.length > 1 ? 's' : ''}</span>
          {moments.map((m, n) => {
            const label = `${SIGNAL_META[m.type].label}${moments.filter((x) => x.type === m.type).length > 1 ? ` ${moments.filter((x, j) => x.type === m.type && j <= n).length}` : ''}`
            // A signal whose quote couldn't be located still gets a chip - honest,
            // muted, with the why on hover. The signal itself is on the cards below.
            if (m.line == null)
              return (
                <span key={n} title="The exact wording wasn't found in this transcript - open the signal card for the captured quote" className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-dashed border-line bg-bg-2 px-2.5 py-1 text-[11px] font-semibold text-muted-2">
                  <span className="h-1.5 w-1.5 rounded-full opacity-50" style={{ background: SIGNAL_META[m.type].color }} />
                  {label} · not located
                </span>
              )
            return (
              <button
                key={n}
                onClick={() => jump(m.line as number)}
                title={`Jump to this ${SIGNAL_META[m.type].label.toLowerCase()} in the conversation`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg-2 px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:text-text"
                style={{ borderColor: `color-mix(in srgb, ${SIGNAL_META[m.type].color} 45%, transparent)` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: SIGNAL_META[m.type].color }} />
                {label}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-2">Transcript</div>
      )}
      <div>
        {lines.map((l, i) => {
          const color = l.speaker ? speakerColor(l.speaker) : 'var(--muted-2)'
          const sameSpeaker = i > 0 && lines[i - 1].speaker === l.speaker && !l.signalTypes && !lines[i - 1].signalTypes
          if (l.signalTypes?.length) {
            const sc = SIGNAL_META[l.signalTypes[0]].color
            return (
              <div
                key={i}
                ref={(el) => { blockRefs.current[i] = el }}
                className="my-2.5 rounded-xl p-3.5 transition-all duration-500"
                style={{
                  borderLeft: `3px solid ${sc}`,
                  background: `color-mix(in srgb, ${sc} 7%, var(--surface))`,
                  boxShadow: flash === i
                    ? `0 0 0 2.5px ${sc}, 0 8px 24px color-mix(in srgb, ${sc} 30%, transparent)`
                    : `inset 0 0 0 1px color-mix(in srgb, ${sc} 22%, transparent)`,
                }}
              >
                <div className="flex items-center gap-2">
                  {l.speaker && (
                    <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: color }}>{initials(l.speaker)}</span>
                  )}
                  {l.speaker && <span className="text-[12px] font-semibold" style={{ color }}>{l.speaker}</span>}
                  {l.signalTypes.map((t, k) => <SignalBadge key={k} type={t} size="sm" />)}
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide" style={{ color: sc }}>Captured</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-text">“{l.text}”</p>
              </div>
            )
          }
          return (
            <div key={i} className={`group flex items-start gap-2.5 px-1 ${sameSpeaker ? 'mt-0.5' : 'mt-2.5'}`}>
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white ${sameSpeaker ? 'invisible' : ''}`} style={{ background: color }}>
                {l.speaker ? initials(l.speaker) : '·'}
              </span>
              <div className="min-w-0 flex-1">
                {!sameSpeaker && l.speaker && <div className="text-[11.5px] font-semibold leading-tight" style={{ color }}>{l.speaker}</div>}
                <p className="text-[13px] leading-relaxed text-text">{l.text}</p>
                {flagIdx === i && (
                  <div className="mt-2 rounded-lg border border-line bg-bg-2 p-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(SIGNAL_META) as SignalType[]).map((t) => (
                        <button key={t} onClick={() => setFlagType(t)}
                          className="rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors"
                          style={{ borderColor: flagType === t ? SIGNAL_META[t].color : 'var(--line)', color: SIGNAL_META[t].color, background: flagType === t ? `color-mix(in srgb, ${SIGNAL_META[t].color} 12%, transparent)` : 'transparent' }}>
                          {SIGNAL_META[t].label}
                        </button>
                      ))}
                    </div>
                    <input value={flagSummary} onChange={(e) => setFlagSummary(e.target.value)} placeholder="One line on why this matters…"
                      className="mt-2 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] text-text outline-none placeholder:text-muted-2 focus:border-[var(--accent)]" />
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={() => saveFlag(l)} disabled={!flagSummary.trim() || flagState === 'saving'}
                        className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                        {flagState === 'saving' ? 'Flagging…' : 'Flag as signal'}
                      </button>
                      <button onClick={() => setFlagIdx(null)} className="text-[11px] text-muted-2 hover:text-text">Cancel</button>
                      {flagState === 'error' && <span className="text-[11px]" style={{ color: 'var(--risk)' }}>Could not save - try again.</span>}
                    </div>
                  </div>
                )}
              </div>
              {isLiveCall && flagIdx !== i && (
                <button onClick={() => openFlag(i, l.text)} title="The brain missed something here? Flag this line as a signal"
                  className="mt-0.5 shrink-0 rounded-md p-1 text-muted-2 opacity-0 transition-opacity hover:text-text group-hover:opacity-100">
                  <Flag size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-2">Captured via Microsoft Teams · transcript stored in your environment</p>
    </div>
  )
}

