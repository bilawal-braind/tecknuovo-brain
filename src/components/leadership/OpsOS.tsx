// Ops OS: the people/engagement view, in two sections.
//   Overview - the graphs: calls over time, share of calls, avatar coverage bars.
//   People   - the card grid (up to 12): photo, role, projects; expand for their
//              calls, accounts covered and the signals their calls surfaced.
// Coverage telemetry from analysed calls - NOT a performance measure.
import { useEffect, useMemo, useState } from 'react'
import { Users, ChevronDown, Video, LayoutDashboard } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { fetchPeopleMetrics } from '../../data/api'
import type { ApiPersonMetrics } from '../../data/api'
import { calls } from '../../data/calls'
import { people, accountName } from '../../data/org'
import { fmt } from '../common/SignalLayer'

type Days = 7 | 14 | 30
type Tab = 'overview' | 'people'
const DAY = 86_400_000
const PALETTE = ['#1A8B91', '#7C5CFF', '#E68A00', '#1F62C4', '#1F7A3A', '#B4468E', '#D64545', '#5C7C8A', '#8A6D3B', '#3B8A6D', '#6D3B8A', '#8A3B5C']
const slugify = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const initials = (n: string) => n.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')

// Photo from /people/<name-slug>.jpg. Teams often gives "Surname, Firstname" -
// try that slug, then the flipped order, then fall back to initials.
function PersonPhoto({ name, size = 36, color }: { name: string; size?: number; color: string }) {
  const candidates = useMemo(() => {
    const base = slugify(name)
    const flipped = name.includes(',') ? slugify(name.split(',').map((s) => s.trim()).reverse().join(' ')) : base
    return [...new Set([base, flipped])]
  }, [name])
  const [idx, setIdx] = useState(0)
  if (idx >= candidates.length)
    return <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.34 }}>{initials(name)}</span>
  return <img src={`/people/${candidates[idx]}.jpg`} alt={name} onError={() => setIdx((i) => i + 1)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
}

export function OpsOS() {
  const [tab, setTab] = useState<Tab>('overview')
  const [days, setDays] = useState<Days>(30)
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
  const top = rows.slice(0, 12)
  const maxCalls = Math.max(1, ...top.map((r) => r.calls))
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

  const roleOf = (name: string) => {
    const clean = name.includes(',') ? name.split(',').map((s) => s.trim()).reverse().join(' ') : name
    return people.find((p) => p.name.toLowerCase() === name.toLowerCase() || p.name.toLowerCase() === clean.toLowerCase())?.role ?? 'Team member'
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Users size={16} style={{ color: 'var(--accent)' }} /><h3 className="text-[16px] font-bold tracking-tight">Ops OS</h3></div>
          <p className="mt-0.5 text-[13px] text-muted">Who's in the conversations, how much, and where{earliest ? ` - from analysed calls since ${fmt(earliest)}` : ''}. Engagement coverage, not a performance measure.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-[12px] font-semibold">
            <button onClick={() => setTab('overview')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${tab === 'overview' ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text'}`}><LayoutDashboard size={13} /> Overview</button>
            <button onClick={() => setTab('people')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${tab === 'people' ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text'}`}><Users size={13} /> People</button>
          </div>
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-[12px] font-semibold">
            {([7, 14, 30] as Days[]).map((v) => (
              <button key={v} onClick={() => setDays(v)} className={`rounded-md px-3 py-1.5 transition-colors ${days === v ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text'}`}>{v}d</button>
            ))}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-surface p-8 text-center text-[12.5px] text-muted-2">
          No attendance data in this window yet. New calls record who spoke automatically; run the leadership_os migration to backfill the existing ones.
        </p>
      ) : tab === 'overview' ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
              <div className="eyebrow">Calls analysed over time</div>
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

            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="eyebrow">Share of calls</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-[150px] w-[150px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={top.map((r) => ({ name: r.name, value: r.calls }))} dataKey="value" nameKey="name" innerRadius={40} outerRadius={68} paddingAngle={2} isAnimationActive={false}>
                        {top.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="var(--surface)" />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 space-y-1">
                  {top.slice(0, 6).map((r, i) => (
                    <div key={r.name} className="flex items-center gap-1.5 text-[11.5px]">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="truncate text-muted">{r.name.split(',')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
            <div className="eyebrow">Calls attended · last {days} days</div>
            <div className="mt-3 space-y-2.5">
              {top.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3">
                  <PersonPhoto name={r.name} size={32} color={PALETTE[i % PALETTE.length]} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px] font-semibold">{r.name}</span>
                      <span className="shrink-0 text-[11px] text-muted">{r.calls} call{r.calls !== 1 ? 's' : ''} · {r.accounts} account{r.accounts !== 1 ? 's' : ''} · {r.talk_share}% of airtime</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((100 * r.calls) / maxCalls)}%`, background: PALETTE[i % PALETTE.length] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {top.map((r, i) => <PersonCard key={r.name} r={r} color={PALETTE[i % PALETTE.length]} role={roleOf(r.name)} days={days} />)}
        </div>
      )}
    </div>
  )
}

function PersonCard({ r, color, role, days }: { r: ApiPersonMetrics; color: string; role: string; days: Days }) {
  const [open, setOpen] = useState(false)
  const theirCalls = useMemo(() => {
    const cutoff = Date.now() - days * DAY
    return calls.filter((c) => Date.parse(c.date) >= cutoff && ((c.speakers && r.name in c.speakers) || c.speaker === r.name))
  }, [r.name, days])
  const theirAccounts = useMemo(() => [...new Set(theirCalls.map((c) => c.accountId).filter(Boolean))], [theirCalls])
  const theirSignals = useMemo(() => theirCalls.flatMap((c) => c.signals).slice(0, 5), [theirCalls])

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="w-full p-4 text-left transition-colors hover:bg-bg-2">
        <div className="flex flex-col items-center text-center">
          <PersonPhoto name={r.name} size={64} color={color} />
          <div className="mt-2.5 w-full truncate text-[14px] font-bold">{r.name}</div>
          <div className="w-full truncate text-[11.5px] text-muted">{role}</div>
          {theirAccounts.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {theirAccounts.slice(0, 3).map((id) => (
                <span key={id} className="rounded-full bg-bg-2 px-2 py-0.5 text-[10px] font-semibold text-muted">{accountName(id)}</span>
              ))}
              {theirAccounts.length > 3 && <span className="text-[10px] text-muted-2">+{theirAccounts.length - 3}</span>}
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Calls" value={r.calls} />
          <MiniStat label="Accounts" value={r.accounts} />
          <MiniStat label="Signals" value={r.signals} />
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 text-[10.5px] text-muted-2">
          {r.talk_share}% of team airtime <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-line bg-surface-2 p-3">
          <div className="eyebrow mb-1.5">Their calls · last {days} days</div>
          {theirCalls.length === 0 ? (
            <p className="py-2 text-center text-[11.5px] text-muted-2">No call detail in this window.</p>
          ) : (
            <div className="space-y-1.5">
              {theirCalls.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                  <Video size={13} className="shrink-0 text-muted-2" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium">{c.title}</div>
                    <div className="truncate text-[10.5px] text-muted-2">{accountName(c.accountId)} · {fmt(c.date)} · {c.signals.length} signal{c.signals.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {theirSignals.length > 0 && (
            <>
              <div className="eyebrow mb-1.5 mt-3">Signals from their calls</div>
              <div className="space-y-1">
                {theirSignals.map((s) => (
                  <div key={s.id} className="flex items-start gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[11.5px] leading-snug text-muted">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--${s.type === 'opportunity' ? 'opp' : s.type})` }} />
                    {s.summary}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-bg-2 px-2 py-1.5">
      <div className="text-[15px] font-bold leading-tight">{value}</div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wide text-muted-2">{label}</div>
    </div>
  )
}
