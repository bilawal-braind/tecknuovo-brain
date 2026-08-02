import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { weeklyReports } from '../../data/crm'

// Kiera's ask (25 Jul call): "if Cabinet Office was red this week, I want to see
// that next week it improved" - the RAG journey per project as an animated line
// graph, right at the top of the account view. Green sits high, red sits low, so
// a recovering project literally climbs. Renders nothing when the account has no
// weekly reports (mock mode stays clean).
const RAG_LEVEL: Record<string, number> = { green: 3, amber: 2, red: 1 }
const LEVEL_COLOR: Record<number, string> = { 3: 'var(--opp)', 2: 'var(--people)', 1: 'var(--risk)' }
const LEVEL_LABEL: Record<number, string> = { 3: 'Green', 2: 'Amber', 1: 'Red' }
const PALETTE = ['#1A8B91', '#7C5CFF', '#E68A00', '#1F62C4', '#B4468E', '#5C7C8A', '#1F7A3A', '#D64545']

const fmtWeek = (w: string) => {
  const d = new Date(w)
  return isNaN(d.getTime()) ? w.slice(5, 10) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Dots carry the information: coloured by that week's RAG, not by the project line.
function RagDot(props: { cx?: number; cy?: number; value?: number; index?: number }) {
  const { cx, cy, value } = props
  if (cx == null || cy == null || value == null) return <g />
  const color = LEVEL_COLOR[Math.round(value)] ?? 'var(--muted-2)'
  return (
    <g key={`${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r={7} fill={color} opacity={0.18} />
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="var(--surface)" strokeWidth={1.5} />
    </g>
  )
}

function RagTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[12px] shadow-lg">
      <div className="font-semibold">w/e {label}</div>
      <div className="mt-1 space-y-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted">{p.name}</span>
            <span className="font-bold" style={{ color: LEVEL_COLOR[Math.round(p.value ?? 0)] }}>{LEVEL_LABEL[Math.round(p.value ?? 0)] ?? '-'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RagTrend({ accountId }: { accountId: string }) {
  // 'account' = one combined line (the account is only as green as its worst
  // project that week); 'projects' = one line per project.
  const [mode, setMode] = useState<'account' | 'projects'>('account')
  const { weeks, titles, data, moves } = useMemo(() => {
    const mine = weeklyReports.filter((w) => w.account_id === accountId)
    const weeks = [...new Set(mine.map((w) => w.week_ending))].sort().slice(-8)
    const titles = [...new Set(mine.map((w) => w.project_title))].sort()
    const byKey = new Map<string, string>()
    for (const w of mine) byKey.set(`${w.project_title}|${w.week_ending}`, (w.rag || '').toLowerCase())
    // one row per week, one numeric series per project (missing week = gap in the line)
    const data = weeks.map((wk) => {
      const row: Record<string, number | string | null> = { week: fmtWeek(wk) }
      const levels: number[] = []
      for (const t of titles) {
        const v = RAG_LEVEL[byKey.get(`${t}|${wk}`) ?? ''] ?? null
        row[t] = v
        if (v != null) levels.push(v)
      }
      // combined view: the worst reported project sets the account's colour
      row['Account'] = levels.length ? Math.min(...levels) : null
      return row
    })
    // what moved in the latest reported week - the line Kiera scans for
    const moves = titles.flatMap((t) => {
      const seen = weeks.map((wk) => RAG_LEVEL[byKey.get(`${t}|${wk}`) ?? ''] ?? null).filter((v): v is number => v != null)
      const n = seen.length
      if (n < 2 || seen[n - 1] === seen[n - 2]) return []
      return [{ title: t, from: seen[n - 2], to: seen[n - 1], up: seen[n - 1] > seen[n - 2] }]
    })
    return { weeks, titles, data, moves }
  }, [accountId])
  if (!weeks.length || !titles.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="glass relative mt-4 overflow-hidden rounded-2xl border border-line p-5"
      style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--surface)), var(--surface) 55%)' }}
    >
      <div className="ai-sheen pointer-events-none absolute inset-x-0 top-0 h-[2px]" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: 'var(--accent)', boxShadow: '0 0 16px color-mix(in srgb, var(--accent) 60%, transparent)' }}>
          <TrendingUp size={14} />
        </span>
        <h3 className="text-[14px] font-bold tracking-tight">Delivery trend</h3>
        <span className="text-[11px] text-muted-2">RAG by week · from the weekly reports</span>
        <div className="ml-1 inline-flex rounded-lg border border-line bg-surface p-0.5 text-[11px] font-semibold">
          {([['account', 'Account'], ['projects', 'By project']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)}
              className={`rounded-md px-2.5 py-1 transition-colors ${mode === id ? 'text-white' : 'text-muted hover:text-text'}`}
              style={mode === id ? { background: 'var(--accent)' } : undefined}>{label}</button>
          ))}
        </div>
        {moves.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-1.5">
            {moves.map((m) => (
              <motion.span
                key={m.title}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  color: LEVEL_COLOR[m.to],
                  borderColor: `color-mix(in srgb, ${LEVEL_COLOR[m.to]} 35%, transparent)`,
                  background: `color-mix(in srgb, ${LEVEL_COLOR[m.to]} 9%, var(--surface))`,
                }}
              >
                {m.title}: {LEVEL_LABEL[m.from]} → {LEVEL_LABEL[m.to]} {m.up ? '▲' : '▼'}
              </motion.span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 h-[210px]" style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.10))' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 14, left: -14, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0.5, 3.5]} ticks={[1, 2, 3]} allowDecimals={false}
              tickFormatter={(v: number) => LEVEL_LABEL[v] ?? ''}
              tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--muted)' }} axisLine={false} tickLine={false}
            />
            <Tooltip content={<RagTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {(mode === 'account' ? ['Account'] : titles).map((t, i) => (
              <Line
                key={`${mode}-${t}`} type="monotone" dataKey={t} name={t}
                stroke={mode === 'account' ? 'var(--accent)' : PALETTE[i % PALETTE.length]}
                strokeWidth={mode === 'account' ? 3.5 : 2.5} connectNulls
                dot={(p: { cx?: number; cy?: number; value?: number; index?: number }) => <RagDot {...p} />}
                activeDot={{ r: 6 }}
                animationDuration={1400} animationEasing="ease-out" animationBegin={i * 160}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1.5 text-[10.5px] text-muted-2">{mode === 'account' ? 'One line for the account: it takes the colour of its worst-reported project each week - a recovering account climbs.' : 'Green rides high, red sits low - a recovering project climbs.'} Gaps mean no report was filed that week. From the weekly reports the team files - not inferred from calls.</p>
    </motion.div>
  )
}
