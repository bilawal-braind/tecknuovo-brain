import { useMemo, useState } from 'react'
import { LayoutDashboard, Radio, FileText, ArrowRight } from 'lucide-react'
import { DashboardShell } from '../shell/DashboardShell'
import { projects, accountName } from '../../data/org'
import { weeklyReports } from '../../data/delivery'
import { signals, rankByImpact } from '../../data/signals'
import { RagDot } from '../common/primitives'
import { TriageCard } from '../common/TriageCard'
import { ExecSummary } from '../common/ExecSummary'
import { SignalsDonut } from '../common/SignalsDonut'
import { SignalsFeed } from '../common/SignalsFeed'
import { AccountView } from '../common/AccountView'
import { ProjectView } from '../common/ProjectView'

// Delivery = "how is the work going" (execution). Account / commercial info
// (consultants, spend, extensions, the account+project browse) lives on the
// Client Partner dashboard, per client feedback.
type View = 'overview' | 'signals' | 'weekly'

export function Delivery() {
  const [view, setView] = useState<View>('overview')
  const [sel, setSel] = useState<string | null>(null)
  const [selProject, setSelProject] = useState<string | null>(null)

  const offTrack = useMemo(() => projects.filter((p) => p.rag !== 'green').length, [])
  const toAction = useMemo(() => signals.filter((s) => s.status === 'new').length, [])
  const keySignals = useMemo(() => rankByImpact(signals.filter((s) => s.type !== 'update')).slice(0, 5), [])

  const goTab = (v: string) => { setView(v as View); setSel(null); setSelProject(null) }

  return (
    <DashboardShell
      role="Delivery" persona="Kiera Battersby · Client Delivery Director" active={view} onSelect={goTab} onOpenAccount={(id) => { setSelProject(null); setSel(id) }}
      sections={[
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'signals', label: 'Signals', icon: Radio, count: signals.length },
        { id: 'weekly', label: 'Weekly reports', icon: FileText },
      ]}
    >
      <div className="px-7 py-6">
        {selProject ? (
          <ProjectView projectId={selProject} onBack={() => setSelProject(null)} onOpenAccount={(id) => { setSelProject(null); setSel(id) }} backLabel={sel ? `Back to ${accountName(sel)}` : 'Back'} />
        ) : sel ? (
          <AccountView accountId={sel} onBack={() => setSel(null)} onOpenProject={(id) => setSelProject(id)} backLabel="Back" />
        ) : (
          <>
            {view === 'overview' && (
              <>
                <h3 className="text-[15px] font-semibold">Delivery, live</h3>
                <p className="mt-0.5 text-[13px] text-muted">A live read of what the Second Brain is hearing across every delivery today.</p>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
                  <ExecSummary items={keySignals} onOpen={(id) => setSel(id)} />
                  <SignalsDonut signals={signals} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Kpi label="Active deliveries" value={`${projects.length}`} sub="across the team" />
                  <Kpi label="Off track" value={`${offTrack}`} sub="amber or red" color="var(--risk)" />
                  <Kpi label="Signals to action" value={`${toAction}`} sub="new this week" color="var(--people)" />
                  <Kpi label="Call capture" value="96%" sub="of calls captured" color="var(--accent)" />
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="text-[15px] font-semibold">Key signals</h3><p className="mt-0.5 text-[13px] text-muted">The highest-priority risks and opportunities across your deliveries. Click any to open the call and transcript.</p></div>
                  <button onClick={() => setView('signals')} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white transition-transform hover:scale-[1.02]" style={{ background: 'var(--accent)' }}>See all signals <ArrowRight size={14} /></button>
                </div>
                <div className="mt-3 space-y-2">
                  {keySignals.map((s) => <TriageCard key={s.id} signal={s} showAccount onOpenAccount={(id) => setSel(id)} />)}
                </div>
              </>
            )}

            {view === 'signals' && (
              <>
                <h3 className="text-[15px] font-semibold">Signals</h3>
                <p className="mt-0.5 text-[13px] text-muted">Every signal the Second Brain has pulled from your delivery calls. Filter and sort, then open any to see the call and transcript.</p>
                <SignalsFeed signals={signals} onOpenAccount={(id) => setSel(id)} />
              </>
            )}

            {view === 'weekly' && (
              <>
                <div className="flex items-center gap-2"><FileText size={16} style={{ color: 'var(--accent)' }} /><h3 className="text-[15px] font-semibold">Weekly reports</h3></div>
                <p className="mt-0.5 text-[13px] text-muted">Each project's latest weekly report, shown here in one place - read from SharePoint, so you can scan every delivery without opening them one by one.</p>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {weeklyReports.map((w) => {
                    const p = projects.find((x) => x.id === w.projectId)!
                    return (
                      <div key={w.projectId} className="rounded-2xl border border-line bg-surface p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><RagDot health={p.rag} /><span className="text-[14px] font-semibold">{p.name}</span></div>
                          <span className="text-[11px] text-muted">{accountName(p.accountId)}</span>
                        </div>
                        <ReportBlock title="Delivered this week" items={w.delivered} color="var(--opp)" />
                        <ReportBlock title="Focus next week" items={w.focusNext} color="var(--update)" />
                        <ReportBlock title="Key risks" items={w.risks} color="var(--risk)" />
                        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                          <span className="text-[11px] text-muted-2">Source: SharePoint</span>
                          <button className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-muted hover:text-text">Open in SharePoint <ArrowRight size={11} /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-[12px] text-muted">
                  <ArrowRight size={14} className="text-[var(--people)]" />
                  Resource-only accounts (MaPS, NHS) have no Delivery Manager, so there's no weekly report to show - their updates arrive by email and coverage is limited.
                </div>
              </>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  )
}

function ReportBlock({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null
  return (
    <div className="mt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>{title}</div>
      <ul className="mt-1 space-y-0.5">
        {items.map((it, i) => <li key={i} className="flex gap-1.5 text-[12px] leading-snug text-text"><span style={{ color }}>·</span>{it}</li>)}
      </ul>
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-3xl font-bold" style={color ? { color } : undefined}>{value}</div>
      <div className="mt-0.5 text-[12px] text-muted">{sub}</div>
    </div>
  )
}
