import { useMemo, useState } from 'react'
import { LayoutDashboard, Building2, Radio, FileText, ArrowRight, ChevronRight, Users, Search } from 'lucide-react'
import { DashboardShell } from '../shell/DashboardShell'
import { projects, accounts, accountName, personName, podName, projectsForAccount, advisors, projectsForAdvisor, advisorLoad } from '../../data/org'
import { weeklyReports } from '../../data/delivery'
import { signals, rankByImpact } from '../../data/signals'
import { RagDot, CoverageBadge } from '../common/primitives'
import { TriageCard } from '../common/TriageCard'
import { ExecSummary } from '../common/ExecSummary'
import { SignalsDonut } from '../common/SignalsDonut'
import { SignalsFeed } from '../common/SignalsFeed'
import { AccountView, money } from '../common/AccountView'
import { ProjectView } from '../common/ProjectView'

type View = 'overview' | 'signals' | 'deliveries' | 'advisors' | 'weekly'

export function Delivery() {
  const [view, setView] = useState<View>('overview')
  const [sel, setSel] = useState<string | null>(null)
  const [selProject, setSelProject] = useState<string | null>(null)
  const [dm, setDm] = useState<string>('all')
  const [advQ, setAdvQ] = useState('')

  const offTrack = useMemo(() => projects.filter((p) => p.rag !== 'green').length, [])
  const toAction = useMemo(() => signals.filter((s) => s.status === 'new').length, [])
  const keySignals = useMemo(() => rankByImpact(signals.filter((s) => s.type !== 'update')).slice(0, 5), [])
  const dms = useMemo(() => Array.from(new Set(projects.map((p) => p.deliveryManager).filter(Boolean))) as string[], [])

  const goTab = (v: string) => { setView(v as View); setSel(null); setSelProject(null) }

  return (
    <DashboardShell
      role="Delivery" persona="Kiera Battersby · Client Delivery Director" active={view} onSelect={goTab} onOpenAccount={(id) => { setSelProject(null); setSel(id) }}
      sections={[
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'signals', label: 'Signals', icon: Radio, count: signals.length },
        { id: 'deliveries', label: 'Accounts & projects', icon: Building2, count: accounts.length },
        { id: 'advisors', label: 'Advisors', icon: Users, count: advisors.length },
        { id: 'weekly', label: 'Weekly reports', icon: FileText },
      ]}
    >
      <div className="px-7 py-6">
        {selProject ? (
          <ProjectView projectId={selProject} onBack={() => setSelProject(null)} onOpenAccount={(id) => { setSelProject(null); setSel(id) }} backLabel={sel ? `Back to ${accountName(sel)}` : 'Back to deliveries'} />
        ) : sel ? (
          <AccountView accountId={sel} onBack={() => setSel(null)} onOpenProject={(id) => setSelProject(id)} backLabel="Back to deliveries" />
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

            {view === 'deliveries' && (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold">Accounts and their projects</h3>
                    <p className="mt-0.5 text-[13px] text-muted">Every account under delivery and the projects inside it. Open an account for the full picture, or jump straight into a project.</p>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-muted">
                    Delivery Manager
                    <select value={dm} onChange={(e) => setDm(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-text">
                      <option value="all">All managers</option>
                      {dms.map((id) => <option key={id} value={id}>{personName(id)}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-3 space-y-3">
                  {accounts.map((a) => {
                    const ps = projectsForAccount(a.id).filter((p) => dm === 'all' || p.deliveryManager === dm)
                    if (ps.length === 0) return null
                    return (
                      <div key={a.id} className="rounded-2xl border border-line bg-surface p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button onClick={() => setSel(a.id)} className="group flex items-center gap-2 text-left">
                            <RagDot health={a.health} withLabel />
                            <span className="text-[14px] font-semibold group-hover:underline">{a.name}</span>
                            {a.coverage === 'limited' && <CoverageBadge coverage="limited" />}
                          </button>
                          <div className="flex items-center gap-x-3 text-[11px] text-muted">
                            <span>{podName(a.pod)} pod</span>
                            <span>CP: {personName(a.clientPartner)}</span>
                            <button onClick={() => setSel(a.id)} className="inline-flex items-center gap-1 font-semibold text-[var(--accent-d)] hover:underline">Open account <ChevronRight size={12} /></button>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {ps.map((p) => (
                            <button key={p.id} onClick={() => setSelProject(p.id)} className="flex items-center justify-between gap-2 rounded-lg bg-bg-2 p-3 text-left transition-colors hover:bg-[var(--line)]">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[13px] font-semibold"><RagDot health={p.rag} /><span className="truncate">{p.name}</span></div>
                                <div className="mt-0.5 text-[11px] text-muted">{p.phase} · {p.sprint} · {p.deliveryManager ? personName(p.deliveryManager) : 'resource-only'}</div>
                                <div className="mt-0.5 text-[11px] text-muted-2">{p.advisors.length} consultant{p.advisors.length !== 1 ? 's' : ''} · {money(p.spend)} spend</div>
                                {p.extension && <div className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--opp)' }}>Extension · {p.extension.status}</div>}
                              </div>
                              <ChevronRight size={15} className="shrink-0 text-muted-2" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {view === 'advisors' && (
              <>
                <h3 className="text-[15px] font-semibold">Advisors</h3>
                <p className="mt-0.5 text-[13px] text-muted">Who's staffed where, and how loaded they are. Search by name, and click any project to open it.</p>
                <div className="relative mt-3 max-w-[340px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
                  <input value={advQ} onChange={(e) => setAdvQ(e.target.value)} placeholder="Search advisors…" className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-2 focus:border-[var(--accent)]" />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {advisors.filter((a) => a.name.toLowerCase().includes(advQ.trim().toLowerCase())).map((a) => {
                    const ps = projectsForAdvisor(a.id)
                    const load = advisorLoad(a.id)
                    const loadColor = load === 'stretched' ? 'var(--people)' : load === 'balanced' ? 'var(--opp)' : 'var(--update)'
                    return (
                      <div key={a.id} className="rounded-2xl border border-line bg-surface p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg-2 text-[12px] font-bold text-muted">{a.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold">{a.name}</div>
                              <div className="truncate text-[11px] text-muted">{a.role}</div>
                            </div>
                          </div>
                          <LoadBadge load={load} />
                        </div>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-2">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (ps.length / 3) * 100)}%`, background: loadColor }} />
                        </div>
                        <div className="mt-2 eyebrow">{ps.length} project{ps.length !== 1 ? 's' : ''} · capacity</div>
                        <div className="mt-1.5 flex flex-col gap-1">
                          {ps.map((p) => (
                            <button key={p.id} onClick={() => setSelProject(p.id)} className="flex items-center justify-between gap-2 rounded-lg bg-bg-2 px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--line)]">
                              <span className="flex min-w-0 items-center gap-1.5"><RagDot health={p.rag} /><span className="truncate">{p.name}</span></span>
                              <span className="shrink-0 text-[11px] text-muted-2">{accountName(p.accountId)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
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

function LoadBadge({ load }: { load: 'light' | 'balanced' | 'stretched' }) {
  const map = {
    light: { c: 'var(--update)', t: 'Light' },
    balanced: { c: 'var(--opp)', t: 'Balanced' },
    stretched: { c: 'var(--people)', t: 'Stretched' },
  } as const
  const m = map[load]
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: m.c, background: `color-mix(in srgb, ${m.c} 14%, transparent)` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.c }} />{m.t}
    </span>
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
