import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { weeklyReports } from '../../data/crm'

// Kiera's ask (25 Jul call): "if Cabinet Office was red this week, I want to see
// that next week it improved" - the RAG history per project, week by week,
// straight from the synced weekly reports. Renders nothing when the account has
// no reports (mock mode stays clean).
const RAG_COLOR: Record<string, string> = {
  green: 'var(--opp)', amber: 'var(--people)', red: 'var(--risk)', grey: 'var(--muted-2)',
}
const fmtWeek = (w: string) => {
  const d = new Date(w)
  return isNaN(d.getTime()) ? w.slice(5, 10) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

type Cell = { rag: string; phase: string | null; summary: string | null } | null

export function RagTrend({ accountId }: { accountId: string }) {
  const { weeks, rows, moves } = useMemo(() => {
    const mine = weeklyReports.filter((w) => w.account_id === accountId)
    const weeks = [...new Set(mine.map((w) => w.week_ending))].sort().slice(-8)
    const titles = [...new Set(mine.map((w) => w.project_title))].sort()
    const byKey = new Map<string, Cell>()
    for (const w of mine) byKey.set(`${w.project_title}|${w.week_ending}`, { rag: (w.rag || 'grey').toLowerCase(), phase: w.phase, summary: w.summary })
    const rows = titles.map((t) => ({ title: t, cells: weeks.map((wk) => byKey.get(`${t}|${wk}`) ?? null) }))
    // What moved in the latest week vs the week before - the line Kiera scans for.
    const moves = rows.flatMap((r) => {
      const n = r.cells.length
      const prev = r.cells[n - 2], last = r.cells[n - 1]
      if (n < 2 || !prev || !last || prev.rag === last.rag) return []
      return [{ title: r.title, from: prev.rag, to: last.rag }]
    })
    return { weeks, rows, moves }
  }, [accountId])
  if (weeks.length < 2 && !rows.length) return null
  if (!rows.length) return null

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUp size={14} className="text-muted-2" />
        <h3 className="text-[14px] font-semibold">Delivery trend</h3>
        <span className="text-[11px] text-muted-2">RAG by week · from the weekly reports</span>
      </div>

      {moves.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {moves.map((m) => (
            <span key={m.title} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg-2 px-2.5 py-1 text-[11px] font-medium text-muted">
              <b className="font-semibold text-text">{m.title}</b>
              <span className="h-2 w-2 rounded-full" style={{ background: RAG_COLOR[m.from] ?? RAG_COLOR.grey }} />
              →
              <span className="h-2 w-2 rounded-full" style={{ background: RAG_COLOR[m.to] ?? RAG_COLOR.grey }} />
              <span className="capitalize">{m.to}</span> this week
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[420px]">
          {/* week header, aligned over the cell track */}
          <div className="flex items-center gap-3">
            <span className="w-[150px] shrink-0" aria-hidden />
            <div className="flex min-w-0 flex-1 gap-1">
              {weeks.map((w) => (
                <span key={w} className="flex-1 text-center text-[10px] font-semibold text-muted-2">{fmtWeek(w)}</span>
              ))}
            </div>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {rows.map((r) => (
              <div key={r.title} className="flex items-center gap-3">
                <span className="w-[150px] shrink-0 truncate text-[12px] font-semibold" title={r.title}>{r.title}</span>
                <div className="flex min-w-0 flex-1 gap-1">
                  {r.cells.map((c, i) => (
                    <span
                      key={i}
                      className="h-5 flex-1 rounded-md"
                      title={c ? `${r.title} · w/e ${fmtWeek(weeks[i])} · ${c.rag.toUpperCase()}${c.phase ? ` · ${c.phase}` : ''}` : `no report w/e ${fmtWeek(weeks[i])}`}
                      style={c
                        ? { background: `color-mix(in srgb, ${RAG_COLOR[c.rag] ?? RAG_COLOR.grey} 82%, transparent)`, boxShadow: `inset 0 0 0 1px ${RAG_COLOR[c.rag] ?? RAG_COLOR.grey}` }
                        : { background: 'var(--bg-2)', boxShadow: 'inset 0 0 0 1px var(--line)' }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 pl-[162px] text-[10px] font-medium text-muted-2">
            {(['green', 'amber', 'red'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1 capitalize"><span className="h-2 w-2 rounded-full" style={{ background: RAG_COLOR[k] }} />{k}</span>
            ))}
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--bg-2)', boxShadow: 'inset 0 0 0 1px var(--line)' }} />no report</span>
          </div>
        </div>
      </div>
    </div>
  )
}
