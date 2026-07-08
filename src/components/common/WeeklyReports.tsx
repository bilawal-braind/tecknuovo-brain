import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { FileText, User, ThumbsUp, ThumbsDown, ArrowRight, AlertTriangle, Search, ExternalLink } from 'lucide-react'
import { weeklyReports } from '../../data/crm'
import type { ApiWeeklyReport } from '../../data/api'

// Live weekly reports - the per-project sections of the Monday portfolio report,
// pulled from SharePoint by the Weekly Report Sync.
// Features: week picker · RAG summary strip (click to filter) · account filter chips ·
// week-over-week RAG change badges · free-text search across ALL weeks.
const RAG_COLOR: Record<string, string> = {
  green: 'var(--opp)', amber: 'var(--people)', red: 'var(--risk)', grey: 'var(--muted-2)',
}
const ragOf = (r: ApiWeeklyReport) => (r.rag || 'grey').toLowerCase()

const fmtWeek = (w: string) => {
  const d = new Date(w)
  return isNaN(d.getTime()) ? w : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function WeeklyReports({ onOpenAccount }: { onOpenAccount?: (accountId: string) => void }) {
  const weeks = useMemo(() => [...new Set(weeklyReports.map((r) => r.week_ending))].sort().reverse(), [])
  const [week, setWeek] = useState<string>(weeks[0] ?? '')
  const [rag, setRag] = useState<string | null>(null)
  const [acct, setAcct] = useState<string | null>(null)
  const [q, setQ] = useState('')

  // Previous-week RAG per project, for the "what moved" badges.
  const prevRag = useMemo(() => {
    const m = new Map<string, string>() // `${week}|${title}` -> previous week's rag
    for (const r of weeklyReports) {
      const older = weeklyReports
        .filter((o) => o.project_title === r.project_title && o.week_ending < r.week_ending)
        .sort((a, b) => b.week_ending.localeCompare(a.week_ending))[0]
      if (older) m.set(`${r.week_ending}|${r.project_title}`, ragOf(older))
    }
    return m
  }, [])

  const searching = q.trim().length > 0
  const ql = q.trim().toLowerCase()
  const matches = (r: ApiWeeklyReport) =>
    [r.project_title, r.account_name, r.customer_lead, r.summary, r.highlights, r.lowlights, r.next_week, r.risks]
      .some((f) => (f || '').toLowerCase().includes(ql))

  // Search spans all weeks; otherwise show the selected week.
  const base = useMemo(
    () => (searching ? weeklyReports.filter(matches) : weeklyReports.filter((r) => r.week_ending === week)),
    [searching, ql, week],
  )
  const accounts = useMemo(
    () => [...new Set(base.map((r) => r.account_name || 'Unlinked'))].sort(),
    [base],
  )
  const rows = base
    .filter((r) => (rag ? ragOf(r) === rag : true))
    .filter((r) => (acct ? (r.account_name || 'Unlinked') === acct : true))
    .sort((a, b) => b.week_ending.localeCompare(a.week_ending) || a.project_title.localeCompare(b.project_title))

  const ragCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of base) c[ragOf(r)] = (c[ragOf(r)] || 0) + 1
    return c
  }, [base])

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Weekly reports</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            Every project's weekly delivery report, pulled from SharePoint each Monday.
          </p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all weeks - risks, summaries…"
            className="w-[260px] rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-[12px] outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {!searching && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {weeks.slice(0, 8).map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className="rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors"
              style={
                w === week
                  ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
                  : { borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--muted)' }
              }
            >
              w/e {fmtWeek(w)}
            </button>
          ))}
        </div>
      )}

      {/* RAG summary strip - click to filter */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(['green', 'amber', 'red'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setRag(rag === k ? null : k)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors"
            style={{
              color: RAG_COLOR[k],
              borderColor: rag === k ? RAG_COLOR[k] : 'var(--line)',
              background: rag === k ? `color-mix(in srgb, ${RAG_COLOR[k]} 12%, transparent)` : 'var(--surface)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RAG_COLOR[k] }} />
            {ragCounts[k] || 0} {k}
          </button>
        ))}
        {accounts.length > 1 && <span className="mx-1 h-4 w-px bg-[var(--line)]" />}
        {accounts.length > 1 &&
          accounts.map((a) => (
            <button
              key={a}
              onClick={() => setAcct(acct === a ? null : a)}
              className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={
                acct === a
                  ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
                  : { borderColor: 'var(--line)', background: 'var(--surface)', color: 'var(--muted)' }
              }
            >
              {a}
            </button>
          ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rows.map((r) => (
          <ReportCard
            key={r.id}
            r={r}
            showWeek={searching}
            wasRag={prevRag.get(`${r.week_ending}|${r.project_title}`)}
            onOpenAccount={onOpenAccount}
          />
        ))}
      </div>
      {!rows.length && (
        <p className="mt-8 text-center text-[13px] text-muted">
          {searching ? 'No reports match that search.' : 'No reports for this selection.'}
        </p>
      )}
    </>
  )
}

export function ReportCard({
  r, showWeek = false, wasRag, onOpenAccount,
}: {
  r: ApiWeeklyReport
  showWeek?: boolean
  wasRag?: string
  onOpenAccount?: (accountId: string) => void
}) {
  const rag = ragOf(r)
  const color = RAG_COLOR[rag] ?? 'var(--muted-2)'
  const moved = wasRag && wasRag !== rag
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-muted-2" />
          <h4 className="text-[14px] font-semibold">{r.project_title}</h4>
        </div>
        <div className="flex items-center gap-1.5">
          {moved && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: RAG_COLOR[wasRag!] ?? 'var(--muted-2)', background: 'var(--bg-2)' }}
              title={`Was ${wasRag} the previous week`}
            >
              was {wasRag}
            </span>
          )}
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            {rag}
          </span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
        {showWeek && <span className="font-semibold text-text">w/e {fmtWeek(r.week_ending)}</span>}
        {showWeek && <span className="text-muted-2">·</span>}
        {r.customer_lead && <span className="inline-flex items-center gap-1"><User size={11} /> {r.customer_lead}</span>}
        {r.phase && (<><span className="text-muted-2">·</span><span>{r.phase}</span></>)}
        {r.account_id && onOpenAccount ? (
          <>
            <span className="text-muted-2">·</span>
            <button
              onClick={() => onOpenAccount(r.account_id!)}
              className="inline-flex items-center gap-1 font-semibold transition-colors hover:underline"
              style={{ color: 'var(--accent-d)' }}
            >
              {r.account_name || 'Open account'} <ExternalLink size={10} />
            </button>
          </>
        ) : (
          r.account_name && (<><span className="text-muted-2">·</span><span>{r.account_name}</span></>)
        )}
      </div>

      {r.summary && <p className="mt-2.5 text-[13px] leading-relaxed">{r.summary}</p>}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {r.highlights && <Block icon={<ThumbsUp size={12} />} label="Highlights" text={r.highlights} color="var(--opp)" />}
        {r.lowlights && <Block icon={<ThumbsDown size={12} />} label="Lowlights" text={r.lowlights} color="var(--people)" />}
      </div>
      {r.next_week && <div className="mt-3"><Block icon={<ArrowRight size={12} />} label="Next week" text={r.next_week} color="var(--accent)" /></div>}
      {r.risks && <div className="mt-3"><Block icon={<AlertTriangle size={12} />} label="Risks & issues" text={r.risks} color="var(--risk)" /></div>}
    </div>
  )
}

function Block({ icon, label, text, color }: { icon: ReactNode; label: string; text: string; color: string }) {
  return (
    <div className="rounded-xl bg-bg-2 p-3">
      <div className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
        {icon} {label}
      </div>
      <p className="text-[12.5px] leading-relaxed text-muted">{text}</p>
    </div>
  )
}
