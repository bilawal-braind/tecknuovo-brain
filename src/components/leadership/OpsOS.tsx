// Ops OS: the people/engagement view, navigated by a collapsible left rail.
//   Overview - the MD read: team rhythm (calls over time), where the attention
//              went (calls per account vs account health), and the coverage board.
//   People   - uniform card grid; a card opens the person's FULL-PAGE profile.
// Coverage telemetry from analysed calls - demo figures fill in for the curated
// roster until their first transcribed call, then real numbers take over.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Users, Video, LayoutDashboard, ArrowLeft, ArrowRight, Radio, Building2, Activity, ChevronLeft } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts'
import { fetchPeopleMetrics } from '../../data/api'
import type { ApiPersonMetrics } from '../../data/api'
import { calls } from '../../data/calls'
import { signals } from '../../data/signals'
import type { Call } from '../../data/calls'
import { people, accountName, accounts, projects } from '../../data/org'
import { HEALTH_COLOR, SIGNAL_META } from '../../data/types'
import { fmt } from '../common/SignalLayer'

type Days = 7 | 14 | 30
type Tab = 'overview' | 'people'
const DAY = 86_400_000
const PALETTE = ['#1A8B91', '#7C5CFF', '#E68A00', '#1F62C4', '#1F7A3A', '#B4468E', '#D64545', '#5C7C8A']
const slugify = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const initials = (n: string) => n.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')

// Teams gives "Goldsbrough, Marcus (DES OD-SalesDisposals-005)" - show "Marcus Goldsbrough".
const displayName = (n: string) => {
  const noParen = n.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  return noParen.includes(',') ? noParen.split(',').map((x) => x.trim()).reverse().join(' ') : noParen
}
const normName = (n: string) => displayName(n).toLowerCase().replace(/[^a-z0-9]+/g, '')

// Curated demo roster: ONLY these people show in Ops OS, in this order. Real call
// metrics attach automatically when a person appears in analysed calls; until then
// the demo figures stand in (illustrative, for the demo period only).
const FEATURED: { name: string; role?: string; demo?: { calls: number; accounts: number; signals: number; talk_share: number; accountNames: string[] } }[] = [
  { name: 'Kiera Battersby', role: 'Client Delivery Director', demo: { calls: 6, accounts: 3, signals: 13, talk_share: 9, accountNames: ['HO', 'FCDO', 'DEFRA'] } },
  { name: 'Meesha Chotai', role: 'Portfolio Director', demo: { calls: 6, accounts: 3, signals: 12, talk_share: 8, accountNames: ['HMRC', 'MOJ', 'NHS'] } },
  { name: 'Chloe Hollinshead', role: 'Client Partner', demo: { calls: 5, accounts: 2, signals: 10, talk_share: 7, accountNames: ['MOJ', 'Cabinet Office'] } },
  { name: 'Sophie Martin', role: 'Delivery Manager', demo: { calls: 5, accounts: 2, signals: 11, talk_share: 8, accountNames: ['NHS', 'HMRC'] } },
  { name: 'Kaitlyn Bryant', role: 'Delivery Manager', demo: { calls: 4, accounts: 2, signals: 9, talk_share: 6, accountNames: ['MOJ', 'HO'] } },
  { name: 'Lloyd Evans', role: 'Delivery Manager', demo: { calls: 4, accounts: 2, signals: 8, talk_share: 6, accountNames: ['MOD', 'NHS'] } },
  { name: 'Arjun Mammen', role: 'Consultant', demo: { calls: 3, accounts: 1, signals: 6, talk_share: 4, accountNames: ['HMRC'] } },
  { name: 'Rob Kirkham', role: 'Head of IT', demo: { calls: 2, accounts: 1, signals: 3, talk_share: 2, accountNames: ['Cabinet Office'] } },
]
const featuredOf = (name: string) => FEATURED.find((f) => normName(f.name) === normName(name))

type Row = ApiPersonMetrics & { demoAccounts?: string[]; isDemo?: boolean }

// A person's calls in the window: real attendance where speaker data exists,
// else the recent calls on their (demo) accounts - same rule everywhere.
function personCalls(name: string, demoAccounts: string[] | undefined, days: number): Call[] {
  const cutoff = Date.now() - days * DAY
  const real = calls.filter((c) => Date.parse(c.date) >= cutoff && ((c.speakers && name in c.speakers) || c.speaker === name))
  if (real.length) return real
  const wanted = new Set((demoAccounts ?? []).map((n) => n.toLowerCase()))
  return calls.filter((c) => wanted.has(accountName(c.accountId).toLowerCase())).slice(0, 6)
}

// Photo from /people/<name-slug>.jpg; tries both name orders; initials fallback.
function PersonPhoto({ name, size = 36, color, ring = false }: { name: string; size?: number; color: string; ring?: boolean }) {
  const candidates = useMemo(() => {
    const base = slugify(name)
    const flipped = name.includes(',') ? slugify(name.split(',').map((s) => s.trim()).reverse().join(' ')) : base
    return [...new Set([base, flipped])]
  }, [name])
  const [idx, setIdx] = useState(0)
  const ringStyle = ring ? { boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${color}` } : undefined
  if (idx >= candidates.length)
    return <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.34, ...ringStyle }}>{initials(displayName(name))}</span>
  return <img src={`/people/${candidates[idx]}.jpg`} alt={name} onError={() => setIdx((i) => i + 1)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, ...ringStyle }} />
}

export function OpsOS({ onOpenProject, onOpenAccount }: { onOpenProject?: (id: string) => void; onOpenAccount?: (id: string) => void } = {}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [rail, setRail] = useState(true)
  const [days, setDays] = useState<Days>(30)
  const [selPerson, setSelPerson] = useState<string | null>(null)
  const [apiRows, setApiRows] = useState<ApiPersonMetrics[] | null>(null)
  useEffect(() => { let on = true; fetchPeopleMetrics(days).then((r) => { if (on) setApiRows(r) }); return () => { on = false } }, [days])

  const derived = useMemo<ApiPersonMetrics[]>(() => {
    const cutoff = Date.now() - days * DAY
    const acc = new Map<string, { calls: number; accounts: Set<string>; signals: number; lines: number }>()
    let totalLines = 0
    for (const c of calls) {
      if (Date.parse(c.date) < cutoff) continue
      const entries: [string, number][] = c.speakers ? Object.entries(c.speakers) : c.speaker ? [[c.speaker, 1]] : []
      for (const [name, lines] of entries) {
        const e = acc.get(name) ?? { calls: 0, accounts: new Set<string>(), signals: 0, lines: 0 }
        e.calls += 1; e.accounts.add(c.accountId); e.signals += c.signals.length; e.lines += lines
        acc.set(name, e); totalLines += lines
      }
    }
    return [...acc.entries()]
      .map(([name, e]) => ({ name, calls: e.calls, accounts: e.accounts.size, signals: e.signals, talk_share: totalLines ? Math.round((100 * e.lines) / totalLines) : 0 }))
      .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
  }, [days])

  const rows = apiRows && apiRows.length ? apiRows : derived

  // The display roster: FEATURED people in order; real metrics when present,
  // demo figures otherwise (marked internally, never zero-padded).
  const roster = useMemo<Row[]>(() => {
    const byKey = new Map(rows.map((r) => [normName(r.name), r]))
    return FEATURED.map((f) => {
      const real = byKey.get(normName(f.name))
      if (real && real.calls > 0) return { ...real, demoAccounts: f.demo?.accountNames }
      const d = f.demo
      return d
        ? { name: f.name, calls: d.calls, accounts: d.accounts, signals: d.signals, talk_share: d.talk_share, demoAccounts: d.accountNames, isDemo: true }
        : { name: f.name, calls: 0, accounts: 0, signals: 0, talk_share: 0 }
    })
  }, [rows])

  const maxCalls = Math.max(1, ...roster.map((r) => r.calls))
  const step = Math.max(1, Math.ceil(maxCalls / 4))
  const scaleMax = step * 4
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step)
  const earliest = useMemo(() => (calls.length ? calls[calls.length - 1].date : null), [])

  const line = useMemo(() => {
    const weeks = Math.max(2, Math.ceil(days / 7))
    const now = Date.now()
    return Array.from({ length: weeks }, (_, i) => {
      const start = now - (weeks - i) * 7 * DAY
      const end = start + 7 * DAY
      return {
        week: new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        calls: calls.filter((c) => { const t = Date.parse(c.date); return t >= start && t < end }).length,
      }
    })
  }, [days])

  // Where the team's attention went: calls per account, against account health.
  // The MD question this answers: is our effort where the value and risk are?
  const attention = useMemo(() => {
    const cutoff = Date.now() - days * DAY
    const m = new Map<string, number>()
    let total = 0
    for (const c of calls) {
      if (Date.parse(c.date) < cutoff || !c.accountId) continue
      m.set(c.accountId, (m.get(c.accountId) || 0) + 1)
      total++
    }
    const rows = [...m.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n).slice(0, 8)
    return { total, rows, max: Math.max(1, ...rows.map((r) => r.n)) }
  }, [days])

  const roleOf = (name: string) => {
    const f = featuredOf(name)
    if (f?.role) return f.role
    const clean = displayName(name)
    return people.find((p) => p.name.toLowerCase() === name.toLowerCase() || p.name.toLowerCase() === clean.toLowerCase())?.role ?? 'Team member'
  }

  // ── Full-page person profile ──
  if (selPerson) {
    const i = roster.findIndex((r) => normName(r.name) === normName(selPerson))
    const row = i >= 0 ? roster[i] : { name: selPerson, calls: 0, accounts: 0, signals: 0, talk_share: 0 }
    return <PersonProfile row={row} color={PALETTE[Math.max(0, i) % PALETTE.length]} role={roleOf(row.name)} days={days} onBack={() => setSelPerson(null)} onOpenProject={onOpenProject} onOpenAccount={onOpenAccount} />
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Users size={16} style={{ color: 'var(--accent)' }} /><h3 className="text-[16px] font-bold tracking-tight">Delivery Intel</h3></div>
          <p className="mt-0.5 text-[13px] text-muted">Who's in the conversations, how much, and where{earliest ? ` - from analysed calls since ${fmt(earliest)}` : ''}. Engagement coverage, not a performance measure.</p>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-[12px] font-semibold">
          {([7, 14, 30] as Days[]).map((v) => (
            <button key={v} onClick={() => setDays(v)} className={`rounded-md px-3 py-1.5 transition-colors ${days === v ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text'}`}>{v}d</button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-4">
        {/* the collapsible rail - the arrow toggle switches it between labels and icons */}
        <div className={`glass sticky top-4 flex shrink-0 flex-col gap-1 rounded-2xl p-2 transition-all duration-300 ${rail ? 'w-44' : 'w-[52px]'}`}>
          {([['overview', 'Overview', LayoutDashboard], ['people', 'People', Users]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id as Tab)} title={label}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13px] font-semibold transition-colors ${tab === id ? 'text-white' : 'text-muted hover:text-text'}`}
              style={tab === id ? { background: 'var(--accent)' } : undefined}>
              <Icon size={16} className="shrink-0" />
              {rail && <span className="truncate">{label}</span>}
            </button>
          ))}
          <button onClick={() => setRail((v) => !v)} aria-label={rail ? 'Collapse' : 'Expand'}
            className="mt-1 flex items-center justify-center rounded-xl border border-line bg-surface py-1.5 text-muted-2 transition-colors hover:text-text">
            <ChevronLeft size={15} className={`transition-transform duration-300 ${rail ? '' : 'rotate-180'}`} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          {tab === 'overview' ? (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="glass rounded-2xl p-5">
                  <div className="eyebrow">Team rhythm</div>
                  <p className="mt-0.5 text-[11px] text-muted-2">Calls the brain analysed each week. A dip means a quiet week - or meetings running without transcription.</p>
                  <div className="mt-3 h-[170px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={line} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                        <defs>
                          <linearGradient id="opsFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--line)" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
                        <Area type="monotone" dataKey="calls" stroke="var(--accent)" strokeWidth={2} fill="url(#opsFill)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass rounded-2xl p-5">
                  <div className="eyebrow">Where the attention went</div>
                  <p className="mt-0.5 text-[11px] text-muted-2">Team calls per account, coloured by account health - is the effort where the value and the risk are?</p>
                  <div className="mt-3.5 space-y-2.5">
                    {attention.rows.length === 0 ? (
                      <p className="py-8 text-center text-[12px] text-muted-2">No calls in this window.</p>
                    ) : attention.rows.map((r) => {
                      const acc = accounts.find((a) => a.id === r.id)
                      const color = acc ? HEALTH_COLOR[acc.health] : 'var(--muted-2)'
                      return (
                        <div key={r.id} className="flex items-center gap-2.5">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                          <span className="w-[110px] shrink-0 truncate text-[12px] font-semibold">{accountName(r.id)}</span>
                          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-2">
                            <div className="h-full rounded-full" style={{ width: `${Math.round((100 * r.n) / attention.max)}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})` }} />
                          </div>
                          <span className="w-[72px] shrink-0 text-right text-[11px] font-medium text-muted">{r.n} · {attention.total ? Math.round((100 * r.n) / attention.total) : 0}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* the delivery pulse: real numbers from the period's calls and signals */}
          <DeliveryPulse days={days} />

          {/* the coverage board: faces + bars on a real scale, click through to people */}
              <div className="glass mt-4 rounded-2xl p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="eyebrow">Coverage board</div>
                    <p className="mt-0.5 text-[11px] text-muted-2">Calls attended per person over the last {days} days. Airtime = their share of everything said. Click anyone to open their profile.</p>
                  </div>
                  <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-2">x-axis: calls attended</span>
                </div>
                <div className="mt-4 space-y-3">
                  {roster.map((r, i) => (
                    <button key={r.name} onClick={() => setSelPerson(r.name)} className="group flex w-full items-center gap-3.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-bg-2">
                      <PersonPhoto name={r.name} size={42} color={PALETTE[i % PALETTE.length]} ring />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-bold">{displayName(r.name)}</span>
                          <span className="shrink-0 text-[11px] font-medium text-muted">{r.calls} call{r.calls !== 1 ? 's' : ''} · {r.accounts} acct{r.accounts !== 1 ? 's' : ''} · {r.talk_share}% airtime</span>
                        </div>
                        <div className="relative mt-1.5 h-3 overflow-hidden rounded-full bg-bg-2">
                          {ticks.slice(1, 4).map((t) => (
                            <span key={t} className="absolute bottom-0 top-0 w-px bg-[var(--line-2)] opacity-60" style={{ left: `${(100 * t) / scaleMax}%` }} aria-hidden />
                          ))}
                          <div className="relative flex h-full items-center justify-end rounded-full pr-1.5 transition-all"
                            style={{ width: `${Math.max(6, Math.round((100 * r.calls) / scaleMax))}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${PALETTE[i % PALETTE.length]} 55%, transparent), ${PALETTE[i % PALETTE.length]})` }}>
                            <span className="text-[9px] font-bold text-white drop-shadow">{r.calls}</span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight size={15} className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                  {/* the shared axis, aligned under the bar tracks */}
                  <div className="flex items-center gap-3.5 px-2">
                    <span className="w-[42px] shrink-0" aria-hidden />
                    <div className="relative h-5 min-w-0 flex-1">
                      {ticks.map((t) => (
                        <span key={t} className="absolute top-0 -translate-x-1/2 text-[10px] font-semibold text-muted-2" style={{ left: `${(100 * t) / scaleMax}%` }}>{t}</span>
                      ))}
                    </div>
                    <span className="w-[15px] shrink-0" aria-hidden />
                  </div>
                  <p className="pl-[60px] text-[10px] font-semibold uppercase tracking-wide text-muted-2">Calls attended · last {days} days</p>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {roster.map((r, i) => (
                <button key={r.name} onClick={() => setSelPerson(r.name)}
                  className="flex min-h-[224px] w-full flex-col items-center rounded-2xl border border-line bg-surface p-4 text-center transition-all hover:-translate-y-0.5 hover:border-[var(--line-2)]"
                  style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                  <PersonPhoto name={r.name} size={64} color={PALETTE[i % PALETTE.length]} ring />
                  <div className="mt-2.5 w-full truncate text-[14px] font-bold">{displayName(r.name)}</div>
                  <div className="w-full truncate text-[11.5px] text-muted">{roleOf(r.name)}</div>
                  <div className="mt-2 flex min-h-[22px] flex-wrap justify-center gap-1">
                    {(r.demoAccounts ?? []).slice(0, 3).map((n) => (
                      <span key={n} className="rounded-full bg-bg-2 px-2 py-0.5 text-[10px] font-semibold text-muted">{n}</span>
                    ))}
                  </div>
                  <div className="mt-auto grid w-full grid-cols-3 gap-2 pt-3">
                    <MiniStat label="Calls" value={r.calls} />
                    <MiniStat label="Accounts" value={r.accounts} />
                    <MiniStat label="Signals" value={r.signals} />
                  </div>
                  <CardPulse row={r} days={days} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── The full-page profile ──
function PersonProfile({ row, color, role, days, onBack, onOpenProject, onOpenAccount }: { row: Row; color: string; role: string; days: Days; onBack: () => void; onOpenProject?: (id: string) => void; onOpenAccount?: (id: string) => void }) {
  const theirCalls = useMemo<Call[]>(() => personCalls(row.name, row.demoAccounts, days), [row, days])
  const theirAccountIds = useMemo(() => {
    const fromCalls = [...new Set(theirCalls.map((c) => c.accountId).filter(Boolean))]
    if (fromCalls.length) return fromCalls
    return (row.demoAccounts ?? []).map((n) => accounts.find((a) => a.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean) as string[]
  }, [theirCalls, row])
  const theirSignals = useMemo(() => theirCalls.flatMap((c) => c.signals).slice(0, 8), [theirCalls])
  // Their projects: ones they run as DM first, then everything on their accounts.
  const theirProjects = useMemo(() => {
    const me = normName(displayName(row.name))
    const mine = projects.filter((p) => {
      const dm = p.deliveryManager ? people.find((pp) => pp.id === p.deliveryManager)?.name ?? '' : ''
      return dm && normName(dm) === me
    })
    const onAccounts = projects.filter((p) => theirAccountIds.includes(p.accountId) && !mine.some((m) => m.id === p.id))
    return [...mine, ...onAccounts].slice(0, 8)
  }, [row, theirAccountIds])
  const yieldPerCall = row.calls ? (row.signals / row.calls).toFixed(1) : '0'

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-text">
        <ArrowLeft size={14} /> Back to Delivery Intel
      </button>

      <div className="glass mt-3 rounded-2xl p-6" style={{ borderTop: `3px solid ${color}` }}>
        <div className="flex flex-wrap items-center gap-5">
          <PersonPhoto name={row.name} size={88} color={color} ring />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold tracking-tight">{displayName(row.name)}</h2>
            <div className="mt-0.5 text-[13px] text-muted">{role}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {theirAccountIds.map((id) => (
                <button key={id} onClick={() => onOpenAccount?.(id)} className="rounded-full bg-bg-2 px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:bg-[var(--line)] hover:text-text">{accountName(id)}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BigStat icon={Video} label="Calls" value={row.calls} sub={`last ${days} days`} color={color} />
          <BigStat icon={Building2} label="Accounts" value={row.accounts} sub="covered" color={color} />
          <BigStat icon={Radio} label="Signals" value={row.signals} sub={`${yieldPerCall} per call`} color={color} />
          <BigStat icon={Activity} label="Airtime" value={`${row.talk_share}%`} sub="of team conversations" color={color} />
        </div>
      </div>

      <PersonCharts theirCalls={theirCalls} days={days} color={color} />

      <PersonFootprint days={days} theirCalls={theirCalls} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-[14px] font-semibold">Their projects</h3>
          <p className="text-[11px] text-muted-2">Click one to see its progress - delivery stage, health and the calls behind it</p>
          <div className="mt-3 space-y-2">
            {theirProjects.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted-2">No projects linked in this window.</p>
            ) : theirProjects.map((p) => (
              <button key={p.id} onClick={() => onOpenProject?.(p.id)}
                className="group flex w-full items-center gap-2.5 rounded-lg bg-bg-2 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--line)]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: HEALTH_COLOR[p.rag] }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">{p.name}</div>
                  <div className="truncate text-[11px] text-muted-2">{accountName(p.accountId)} · {p.phase}</div>
                </div>
                <ArrowRight size={13} className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-[14px] font-semibold">Their calls</h3>
          <p className="text-[11px] text-muted-2">Newest first · last {days} days</p>
          <div className="mt-3 space-y-2">
            {theirCalls.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted-2">No analysed calls in this window yet - metrics begin with their first transcribed call.</p>
            ) : theirCalls.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 rounded-lg bg-bg-2 px-3.5 py-2.5">
                <Video size={14} className="shrink-0 text-muted-2" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">{c.title}</div>
                  <div className="truncate text-[11px] text-muted-2">{accountName(c.accountId)} · {fmt(c.date)} · {c.signals.length} signal{c.signals.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-[14px] font-semibold">Signals around their work</h3>
          <p className="text-[11px] text-muted-2">What the brain flagged on the calls and accounts they cover</p>
          <div className="mt-3 space-y-1.5">
            {theirSignals.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-muted-2">Nothing flagged in this window.</p>
            ) : theirSignals.map((s) => (
              <div key={s.id} className="flex items-start gap-2 rounded-lg bg-bg-2 px-3.5 py-2.5 text-[12.5px] leading-snug">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${s.type === 'opportunity' ? 'opp' : s.type})` }} />
                <span className="min-w-0 flex-1 text-text">{s.summary}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// The delivery pulse: entirely real numbers from the period's calls and the
// signals they produced - the MD read of how delivery intelligence is flowing.
function DeliveryPulse({ days }: { days: Days }) {
  const cutoff = Date.now() - days * DAY
  const pCalls = calls.filter((c) => Date.parse(c.date) >= cutoff)
  const pSignals = signals.filter((sg) => Date.parse(sg.createdAt) >= cutoff)
  const risks = pSignals.filter((sg) => sg.type === 'risk').length
  const opps = pSignals.filter((sg) => sg.type === 'opportunity').length
  const yieldPc = pCalls.length ? (pSignals.length / pCalls.length).toFixed(1) : '0'
  const unresolved = signals.filter((sg) => sg.type === 'risk' && (sg.status === 'new' || sg.status === 'routed') && Date.now() - Date.parse(sg.createdAt) >= 14 * DAY).length
  const covered = new Set(pCalls.map((c) => c.accountId).filter(Boolean)).size
  const quiet = Math.max(0, accounts.length - covered)
  const rk = risks + opps ? Math.round((100 * risks) / (risks + opps)) : 50
  return (
    <div className="glass mt-4 rounded-2xl p-5">
      <div className="eyebrow">Delivery pulse · last {days} days</div>
      <p className="mt-0.5 text-[11px] text-muted-2">Straight from the analysed calls and the signals they produced.</p>
      <div className="mt-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QCard label="Signal yield">
          <span className="text-2xl font-bold">{yieldPc}</span>
          <span className="ml-1.5 text-[11px] text-muted">per call · {pSignals.length} signals from {pCalls.length} calls</span>
        </QCard>
        <QCard label="Risk : opportunity mix">
          <div className="flex items-baseline gap-3 text-[15px] font-bold">
            <span style={{ color: 'var(--risk)' }}>{risks} risk{risks !== 1 ? 's' : ''}</span>
            <span style={{ color: 'var(--opp)' }}>{opps} opp{opps !== 1 ? 's' : ''}</span>
          </div>
          <Split a={rk} colors={['var(--risk)', 'var(--opp)']} />
        </QCard>
        <QCard label="Unresolved risks · 14d+">
          <span className="text-2xl font-bold" style={unresolved ? { color: 'var(--risk)' } : undefined}>{unresolved}</span>
          <span className="ml-1.5 text-[11px] text-muted">still open across the portfolio</span>
        </QCard>
        <QCard label="Account coverage">
          <span className="text-2xl font-bold">{covered}</span>
          <span className="ml-1.5 text-[11px] text-muted">of {accounts.length} heard from{quiet ? ` · ${quiet} quiet` : ''}</span>
          <Split a={accounts.length ? Math.round((100 * covered) / accounts.length) : 0} colors={['var(--accent)', 'var(--line-2)']} />
        </QCard>
      </div>
    </div>
  )
}

// The person's chart row: engagement over time, what their calls surface, and
// where their time goes. Field names are the real derivations (calls attended,
// signals produced, signal types, calls per account); hover anything for numbers.
function PersonCharts({ theirCalls, days, color }: { theirCalls: Call[]; days: Days; color: string }) {
  const weekly = useMemo(() => {
    const n = Math.max(3, Math.ceil(days / 7))
    const now = Date.now()
    return Array.from({ length: n }, (_, i) => {
      const start = now - (n - i) * 7 * DAY
      const end = start + 7 * DAY
      const wk = theirCalls.filter((c) => { const t = Date.parse(c.date); return t >= start && t < end })
      return {
        week: new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        calls: wk.length,
        signals: wk.reduce((t, c) => t + c.signals.length, 0),
      }
    })
  }, [theirCalls, days])

  const mix = useMemo(() => {
    const sigs = theirCalls.flatMap((c) => c.signals)
    return (['risk', 'opportunity', 'update', 'people'] as const)
      .map((t) => ({ name: SIGNAL_META[t].label + 's', value: sigs.filter((x) => x.type === t).length, color: SIGNAL_META[t].color }))
      .filter((x) => x.value > 0)
  }, [theirCalls])

  const byAccount = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of theirCalls) { if (c.accountId) m.set(c.accountId, (m.get(c.accountId) || 0) + 1) }
    const rows = [...m.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n)
    return { rows, max: Math.max(1, ...rows.map((r) => r.n)) }
  }, [theirCalls])

  const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="glass rounded-2xl p-5 lg:col-span-2">
        <div className="eyebrow">Engagement over time</div>
        <p className="mt-0.5 text-[11px] text-muted-2">How many calls they were in each week (teal), and how many signals those calls produced (amber). Hover any point for the exact numbers.</p>
        <div className="mt-3 h-[190px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="calls" name="Calls attended" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="signals" name="Signals produced" stroke="var(--people)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="eyebrow">What their calls surface</div>
        <p className="mt-0.5 text-[11px] text-muted-2">The mix of intelligence coming out of their conversations - risks, opportunities, delivery updates and people signals.</p>
        {mix.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-muted-2">No signals from their calls in this window.</p>
        ) : (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" nameKey="name" innerRadius={38} outerRadius={64} paddingAngle={2} isAnimationActive={false}>
                    {mix.map((x, i) => <Cell key={i} fill={x.color} stroke="var(--surface)" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 space-y-1.5">
              {mix.map((x) => (
                <div key={x.name} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: x.color }} />
                  <span className="truncate text-muted">{x.name}</span>
                  <span className="font-semibold">{x.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-5 lg:col-span-3">
        <div className="eyebrow">Where their time goes</div>
        <p className="mt-0.5 text-[11px] text-muted-2">Their calls split across the accounts they cover, coloured by each account's current health.</p>
        <div className="mt-3.5 space-y-2.5">
          {byAccount.rows.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-muted-2">No account activity in this window.</p>
          ) : byAccount.rows.map((r) => {
            const acc = accounts.find((a) => a.id === r.id)
            const hc = acc ? HEALTH_COLOR[acc.health] : 'var(--muted-2)'
            return (
              <div key={r.id} className="flex items-center gap-2.5" title={`${r.n} call${r.n !== 1 ? 's' : ''} on ${accountName(r.id)}`}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hc }} />
                <span className="w-[120px] shrink-0 truncate text-[12px] font-semibold">{accountName(r.id)}</span>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-2">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((100 * r.n) / byAccount.max)}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${hc} 55%, transparent), ${hc})` }} />
                </div>
                <span className="w-[56px] shrink-0 text-right text-[11px] font-medium text-muted">{r.n} call{r.n !== 1 ? 's' : ''}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// One person's real footprint: what their conversations put into the brain.
function PersonFootprint({ days, theirCalls }: { days: Days; theirCalls: Call[] }) {
  const theirSignals = theirCalls.flatMap((c) => c.signals)
  const risks = theirSignals.filter((sg) => sg.type === 'risk').length
  const opps = theirSignals.filter((sg) => sg.type === 'opportunity').length
  const accIds = [...new Set(theirCalls.map((c) => c.accountId).filter(Boolean))]
  const openOnAccounts = signals.filter((sg) => accIds.includes(sg.accountId) && (sg.status === 'new' || sg.status === 'routed')).length
  const health = accIds.map((id) => accounts.find((a) => a.id === id)).filter(Boolean)
  return (
    <div className="glass mt-4 rounded-2xl p-5">
      <div className="eyebrow">Their footprint · last {days} days</div>
      <p className="mt-0.5 text-[11px] text-muted-2">What their conversations put into the brain, and the state of the accounts they cover.</p>
      <div className="mt-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QCard label="Risks surfaced"><span className="text-2xl font-bold" style={{ color: 'var(--risk)' }}>{risks}</span><span className="ml-1.5 text-[11px] text-muted">from their calls</span></QCard>
        <QCard label="Opportunities surfaced"><span className="text-2xl font-bold" style={{ color: 'var(--opp)' }}>{opps}</span><span className="ml-1.5 text-[11px] text-muted">from their calls</span></QCard>
        <QCard label="Open items on their accounts"><span className="text-2xl font-bold">{openOnAccounts}</span><span className="ml-1.5 text-[11px] text-muted">awaiting action</span></QCard>
        <QCard label="Their accounts' health">
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {health.length ? health.map((a) => (
              <span key={a!.id} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR[a!.health] }} />{a!.name}
              </span>
            )) : <span className="text-[11.5px] text-muted-2">no analysed accounts in this window</span>}
          </div>
        </QCard>
      </div>
    </div>
  )
}

// Tiny per-card pulse: their risk/opportunity balance from real call data.
function CardPulse({ row, days }: { row: Row; days: Days }) {
  const sigs = useMemo(() => personCalls(row.name, row.demoAccounts, days).flatMap((c) => c.signals), [row, days])
  const r = sigs.filter((x) => x.type === 'risk').length
  const o = sigs.filter((x) => x.type === 'opportunity').length
  if (r + o === 0) return null
  return (
    <div className="mt-2.5 w-full">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-bg-2">
        <div style={{ width: `${Math.round((100 * r) / (r + o))}%`, background: 'var(--risk)' }} />
        <div className="flex-1" style={{ background: 'var(--opp)' }} />
      </div>
      <div className="mt-1 text-[9.5px] font-semibold text-muted-2">{r} risk{r !== 1 ? 's' : ''} · {o} opp{o !== 1 ? 's' : ''} on their patch</div>
    </div>
  )
}

function QCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

// A one/two-break proportional bar (talk:listen, pos:neg:neu).
function Split({ a, b, colors }: { a: number; b?: number; colors: string[] }) {
  return (
    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-bg-2">
      <div style={{ width: `${a}%`, background: colors[0] }} />
      {b != null && <div style={{ width: `${b}%`, background: colors[1] }} />}
      <div className="flex-1" style={{ background: colors[b != null ? 2 : 1] }} />
    </div>
  )
}

function BigStat({ icon: Icon, label, value, sub, color }: { icon: typeof Video; label: string; value: number | string; sub: string; color: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-2 p-3.5">
      <div className="flex items-center gap-1.5"><Icon size={13} style={{ color }} /><span className="eyebrow">{label}</span></div>
      <div className="mt-1.5 text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-2">{sub}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-bg-2 px-2 py-1.5 text-center">
      <div className="text-[15px] font-bold leading-tight">{value}</div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-2">{label}</div>
    </div>
  )
}
