import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { FileText, User, ThumbsUp, ThumbsDown, ArrowRight, AlertTriangle } from 'lucide-react'
import { weeklyReports } from '../../data/crm'
import type { ApiWeeklyReport } from '../../data/api'

// Live weekly reports — the per-project sections of the Monday portfolio report,
// pulled from SharePoint by the Weekly Report Sync. One card per project, newest
// week selected by default.
const RAG_COLOR: Record<string, string> = {
  green: 'var(--opp)', amber: 'var(--people)', red: 'var(--risk)', grey: 'var(--muted-2)',
}

export function WeeklyReports() {
  const weeks = useMemo(() => [...new Set(weeklyReports.map((r) => r.week_ending))].sort().reverse(), [])
  const [week, setWeek] = useState<string>(weeks[0] ?? '')
  const rows = useMemo(() => weeklyReports.filter((r) => r.week_ending === week), [week])

  const fmtWeek = (w: string) => {
    const d = new Date(w)
    return isNaN(d.getTime()) ? w : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">Weekly reports</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            Every project's weekly delivery report, pulled from SharePoint each Monday. Pick a week to scan the whole portfolio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
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
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rows.map((r) => <ReportCard key={r.id} r={r} />)}
      </div>
    </>
  )
}

function ReportCard({ r }: { r: ApiWeeklyReport }) {
  const rag = (r.rag || 'grey').toLowerCase()
  const color = RAG_COLOR[rag] ?? 'var(--muted-2)'
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-muted-2" />
          <h4 className="text-[14px] font-semibold">{r.project_title}</h4>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
        >
          {rag}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
        {r.customer_lead && <span className="inline-flex items-center gap-1"><User size={11} /> {r.customer_lead}</span>}
        {r.phase && (<><span className="text-muted-2">·</span><span>{r.phase}</span></>)}
        {r.account_name && (<><span className="text-muted-2">·</span><span>{r.account_name}</span></>)}
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
