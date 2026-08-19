import { useMemo, useState } from 'react'
import { LayoutDashboard, Radio, FileText, ArrowRight, Cloud, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { DashboardShell } from '../shell/DashboardShell'
import { projects, accountName } from '../../data/org'
import { signals, topByImpact } from '../../data/signals'
import { calls } from '../../data/calls'
import { TriageCard } from '../common/TriageCard'
import { useOpenSignals, useSignal } from '../common/SignalLayer'
import { ExecSummary } from '../common/ExecSummary'
import { RagDot } from '../common/primitives'
import { SignalsDonut } from '../common/SignalsDonut'
import { SignalsFeed } from '../common/SignalsFeed'
import { AccountView } from '../common/AccountView'
import { ProjectView } from '../common/ProjectView'
import { WeeklyReports } from '../common/WeeklyReports'
import { weeklyReports } from '../../data/crm'

// Delivery = "how is the work going" (execution). Account / commercial info
// (consultants, spend, extensions, the account+project browse) lives on the
// Client Partner dashboard, per client feedback.
type View = 'overview' | 'signals' | 'weekly'

export function Delivery() {
  const [view, setView] = useState<View>('overview')
  const [sel, setSel] = useState<string | null>(null)
  const [selProject, setSelProject] = useState<string | null>(null)
  // Set when navigation came from a specific signal - the destination view opens
  // that signal's card expanded and scrolled into view, not just the account.
  const [focusSignal, setFocusSignal] = useState<string | null>(null)

  const offTrackProjects = useMemo(() => projects.filter((p) => p.rag !== 'green'), [])
  const [showOffTrack, setShowOffTrack] = useState(false)
  const { statusOf } = useSignal()
  const open = useOpenSignals(signals)
  const toAction = signals.filter((s) => statusOf(s) === 'new').length
  const callsThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000
    return calls.filter((c) => Date.parse(c.date) >= cutoff).length
  }, [])
  const keySignals = useMemo(() => topByImpact(signals.filter((s) => s.type !== 'update'), 5), [])

  const goTab = (v: string) => { setView(v as View); setSel(null); setSelProject(null); setFocusSignal(null) }
  // A signal line opens its own context: the project view when it's project-level,
  // otherwise the account view - in both cases anchored to that signal's card.
  const openSignal = (s: { id: string; accountId: string; projectId?: string }) => {
    setFocusSignal(s.id)
    setSel(s.accountId)
    setSelProject(s.projectId ?? null)
  }

  return (
    <DashboardShell
      role="Delivery" persona="Every delivery and its signals" active={view} onSelect={goTab} todos onOpenAccount={(id) => { setSelProject(null); setSel(id) }}
      sections={[
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'signals', label: 'Signals', icon: Radio, count: open.length },
        { id: 'weekly', label: 'Weekly reports', icon: FileText },
      ]}
    >
      <div className="px-7 py-6">
        {selProject ? (
          <ProjectView projectId={selProject} focusSignalId={focusSignal ?? undefined} onBack={() => { setSelProject(null); setFocusSignal(null) }} onOpenAccount={(id) => { setSelProject(null); setFocusSignal(null); setSel(id) }} backLabel={sel ? `Back to ${accountName(sel)}` : 'Back'} commercial={false} />
        ) : sel ? (
          <AccountView accountId={sel} focusSignalId={focusSignal ?? undefined} onBack={() => { setSel(null); setFocusSignal(null) }} onOpenProject={(id) => setSelProject(id)} backLabel="Back" commercial={false} />
        ) : (
          <>
            {view === 'overview' && (
              <>
                <h3 className="text-[15px] font-semibold">Delivery, live</h3>
                <p className="mt-0.5 text-[13px] text-muted">A live read of what the Second Brain is hearing across every delivery today.</p>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
                  <ExecSummary items={keySignals} onOpen={openSignal} />
                  <SignalsDonut signals={open} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Kpi label="Active deliveries" value={`${projects.length}`} sub="across the team" />
                  <button onClick={() => offTrackProjects.length && setShowOffTrack((v) => !v)} className="relative rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-[var(--risk)]">
                    <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--risk)' }} /><span className="eyebrow">Off track</span></div>
                    <div className="metric-num mt-3">{offTrackProjects.length}</div>
                    <div className="mt-0.5 text-[12px] text-muted">amber or red · {offTrackProjects.length ? 'click to see which' : 'nothing off track'}</div>
                    {showOffTrack && offTrackProjects.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 space-y-1 rounded-xl border border-line bg-surface p-2 shadow-lg">
                        {offTrackProjects.map((p) => (
                          <span key={p.id} role="button" tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setSel(p.accountId); setSelProject(p.id) }}
                            className="block w-full cursor-pointer rounded-lg bg-bg-2 px-2.5 py-2 text-left transition-colors hover:bg-[var(--line)]">
                            <span className="flex items-center gap-2 text-[12px] font-semibold"><RagDot health={p.rag} />{p.name}</span>
                            <span className="mt-0.5 block text-[10.5px] text-muted">{[accountName(p.accountId), p.rag === 'red' ? 'red' : 'amber', p.phase].filter(Boolean).join(' · ')} · click to open</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                  <Kpi label="Signals to action" value={`${toAction}`} sub="new this week" color="var(--people)" />
                  <Kpi label="Calls this week" value={`${callsThisWeek}`} sub="captured from Teams" color="var(--accent)" />
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

            {view === 'weekly' && (weeklyReports.length ? <WeeklyReports onOpenAccount={(id) => { setSelProject(null); setSel(id) }} /> : <WeeklyComingSoon />)}
          </>
        )}
      </div>
    </DashboardShell>
  )
}

// Weekly reports come from SharePoint, which isn't connected yet - show a polished
// "coming soon" panel instead of a broken/empty list.
function WeeklyComingSoon() {
  return (
    <div className="grid place-items-center px-4 py-16 text-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="max-w-[460px]">
        {/* SharePoint -> Second Brain -> auto-drafted report */}
        <div className="mb-7 flex items-center justify-center gap-5">
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface" style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.06)' }}>
            <Cloud size={24} className="text-muted-2" />
          </motion.div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }} className="relative grid h-16 w-16 place-items-center rounded-2xl text-white" style={{ background: 'var(--accent)', boxShadow: '0 8px 26px color-mix(in srgb, var(--accent) 45%, transparent)' }}>
            <FileText size={26} />
            <motion.span className="absolute -right-1.5 -top-1.5" animate={{ rotate: [0, 15, 0], scale: [1, 1.15, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
              <Sparkles size={16} className="text-[var(--people)]" />
            </motion.span>
          </motion.div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: 'var(--accent-d)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: 'var(--accent)' }} /><span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} /></span>
          Coming soon
        </span>
        <h3 className="mt-3 text-[19px] font-bold tracking-tight">Weekly reports</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Once your <b>SharePoint</b> is connected, each project's weekly report is pulled in and auto-drafted here - what was delivered, the focus for next week, and key risks - so you can scan every delivery in one place without opening them one by one.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-muted-2">
          <Cloud size={13} /> Waiting on SharePoint access <ArrowRight size={12} /> then this fills in automatically
        </div>
      </motion.div>
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-1.5">
        {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
        <span className="eyebrow">{label}</span>
      </div>
      <div className="metric-num mt-3" >{value}</div>
      <div className="mt-0.5 text-[12px] text-muted">{sub}</div>
    </div>
  )
}
