import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { LayoutDashboard, Layers, Radio, AlertTriangle, TrendingUp, Building2, ShieldCheck, ArrowUpRight, PoundSterling, BarChart3, Percent } from 'lucide-react'
import { DashboardShell } from '../shell/DashboardShell'
import { accounts, pods, podName, personName, accountById, accountName } from '../../data/org'
import { signals, signalsByType, rankByImpact } from '../../data/signals'
import { weeklyTrend } from '../../data/trends'
import { SIGNAL_META, HEALTH_COLOR, HEALTH_LABEL } from '../../data/types'
import { RagDot, CoverageBadge } from '../common/primitives'
import { ExecSummary } from '../common/ExecSummary'
import { SignalsFeed } from '../common/SignalsFeed'
import { AccountView, money } from '../common/AccountView'
import { ProjectView } from '../common/ProjectView'

type View = 'overview' | 'signals' | 'pods' | 'sales'
const TREND_ORDER = ['opportunity', 'risk', 'update', 'people'] as const

// Sales reporting - illustrative demo data (real version draws from HubSpot + call transcripts)
const SALES = {
  pipeline: 3_650_000,
  weighted: 1_980_000,
  winRate: 38,
  inFlight: 11,
  stages: [
    { stage: 'Discovery', value: 1_200_000, deals: 4 },
    { stage: 'Proposal', value: 980_000, deals: 3 },
    { stage: 'Negotiation', value: 870_000, deals: 2 },
    { stage: 'Closing', value: 600_000, deals: 2 },
  ],
  fromCalls: [
    { account: 'MOD', note: 'CoE rollout to two more directorates', value: '~£500k', stage: 'Discovery' },
    { account: 'GVMS', note: 'Second data workstream flagged in governance', value: '~£400k', stage: 'Proposal' },
    { account: 'KMS', note: 'Managed-service wrap post go-live', value: '~£350k/yr', stage: 'Negotiation' },
    { account: 'Thames Water', note: 'Reporting-layer extension requested', value: '~£300k', stage: 'Discovery' },
  ],
}

export function Leadership() {
  const [view, setView] = useState<View>('overview')
  const [sel, setSel] = useState<string | null>(null)
  const [selProject, setSelProject] = useState<string | null>(null)

  const t = useMemo(() => {
    const atRisk = accounts.filter((a) => a.health === 'red').length
    const watch = accounts.filter((a) => a.health === 'amber').length
    const opps = signalsByType('opportunity').length
    const full = accounts.filter((a) => a.coverage === 'full').length
    return { atRisk, watch, opps, coverage: Math.round((full / accounts.length) * 100), full }
  }, [])

  const attention = useMemo(
    () => accounts.filter((a) => a.health !== 'green').sort((a, b) => ({ red: 0, amber: 1, green: 2 }[a.health] - { red: 0, amber: 1, green: 2 }[b.health])),
    [],
  )
  const execItems = useMemo(() => rankByImpact(signals.filter((s) => s.type !== 'update')).slice(0, 5), [])
  const topOpps = useMemo(() => rankByImpact(signalsByType('opportunity')).slice(0, 6), [])

  return (
    <>
      <DashboardShell
        role="Leadership" persona="Katie Carruthers · Managing Director" active={view} onSelect={(v) => { setView(v as View); setSel(null); setSelProject(null) }} onOpenAccount={(id) => { setSelProject(null); setSel(id) }}
        sections={[
          { id: 'overview', label: 'Portfolio health', icon: LayoutDashboard },
          { id: 'signals', label: 'Signals', icon: Radio, count: signals.length },
          { id: 'sales', label: 'Sales', icon: PoundSterling },
          { id: 'pods', label: 'Pods', icon: Layers, count: pods.length },
        ]}
      >
        <div className="px-7 py-6">
          {selProject ? (
            <ProjectView projectId={selProject} onBack={() => setSelProject(null)} onOpenAccount={(id) => { setSelProject(null); setSel(id) }} backLabel={sel ? `Back to ${accountName(sel)}` : 'Back to portfolio'} />
          ) : sel ? (
            <AccountView accountId={sel} onBack={() => setSel(null)} onOpenProject={(id) => setSelProject(id)} backLabel="Back to portfolio" />
          ) : (
          <>
          {view === 'overview' && (
            <>
              <div className="mb-4"><ExecSummary items={execItems} onOpen={(id) => setSel(id)} /></div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi icon={Building2} label="Accounts" value={`${accounts.length}`} sub="across 4 pods" />
                <Kpi icon={AlertTriangle} label="At risk" value={`${t.atRisk}`} sub={`${t.watch} on watch`} color="var(--risk)" />
                <Kpi icon={TrendingUp} label="Open opportunities" value={`${t.opps}`} sub="in the pipeline" color="var(--opp)" />
                <Kpi icon={ShieldCheck} label="Call coverage" value={`${t.coverage}%`} sub={`${accounts.length - t.full} resource-only`} color="var(--accent)" />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="eyebrow">Signal activity</div>
                      <h3 className="mt-1 text-[15px] font-semibold">Last 6 weeks, by signal</h3>
                    </div>
                    <Legend />
                  </div>
                  <div className="mt-4 h-[190px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyTrend} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="var(--line)" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'var(--bg-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
                        {TREND_ORDER.map((k, i) => (
                          <Bar key={k} isAnimationActive={false} dataKey={k} stackId="s" fill={SIGNAL_META[k].color} radius={i === TREND_ORDER.length - 1 ? [4, 4, 0, 0] : undefined} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight size={15} style={{ color: SIGNAL_META.opportunity.color }} />
                    <div className="eyebrow">Opportunity pipeline</div>
                  </div>
                  <h3 className="mt-1 text-[15px] font-semibold">Top opportunities by value</h3>
                  <div className="mt-3 space-y-2">
                    {topOpps.slice(0, 5).map((s) => (
                      <button key={s.id} onClick={() => setSel(s.accountId)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-bg-2 p-2.5 text-left transition-colors hover:bg-[var(--bg)]">
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold">{accountById(s.accountId)?.name}</div>
                          <div className="truncate text-[11px] text-muted">{s.summary}</div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold" style={{ color: SIGNAL_META.opportunity.color }}>{s.value}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <AlertTriangle size={16} className="text-[var(--risk)]" />
                <h3 className="text-[15px] font-semibold">Accounts needing attention</h3>
                <span className="text-[12px] text-muted">click any to drill in</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {attention.map((a) => (
                  <AccountTile key={a.id} id={a.id} onClick={() => setSel(a.id)} />
                ))}
              </div>
            </>
          )}

          {view === 'pods' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {pods.map((p) => {
                const accts = accounts.filter((a) => a.pod === p.id)
                const red = accts.filter((a) => a.health === 'red').length
                return (
                  <div key={p.id} className="rounded-2xl border border-line bg-surface p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[15px] font-semibold">{p.name}</h3>
                        <div className="text-[11px] text-muted">Owner: {personName(p.owner)} · {accts.length} accounts</div>
                      </div>
                      {red > 0 ? <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: 'var(--risk)', background: 'color-mix(in srgb, var(--risk) 12%, transparent)' }}>{red} at risk</span> : <RagDot health="green" />}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {accts.map((a) => (
                        <button key={a.id} onClick={() => setSel(a.id)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-bg-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg)]">
                          <span className="flex items-center gap-2 text-[13px] font-medium"><RagDot health={a.health} />{a.name}</span>
                          <span className="flex items-center gap-2 text-[11px] text-muted">{a.coverage === 'limited' && <CoverageBadge coverage="limited" />}{money(a.sowValue)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {view === 'signals' && (
            <>
              <h3 className="text-[15px] font-semibold">Signals</h3>
              <p className="mt-0.5 text-[13px] text-muted">Every signal across the portfolio. Filter and sort, then open any to see the call and transcript behind it.</p>
              <SignalsFeed signals={signals} onOpenAccount={(id) => setSel(id)} />
            </>
          )}

          {view === 'sales' && (
            <>
              <div className="flex items-center gap-2">
                <PoundSterling size={16} style={{ color: 'var(--accent)' }} />
                <h3 className="text-[15px] font-semibold">Sales reporting</h3>
              </div>
              <p className="mt-0.5 text-[13px] text-muted">Pipeline and deal movement, drawn from call transcripts and HubSpot. <span className="text-muted-2">Source: HubSpot + call transcripts · illustrative for the demo.</span></p>

              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi icon={TrendingUp} label="Total pipeline" value={money(SALES.pipeline)} sub="open opportunities" color="var(--opp)" />
                <Kpi icon={BarChart3} label="Weighted forecast" value={money(SALES.weighted)} sub="probability-adjusted" color="var(--accent)" />
                <Kpi icon={Percent} label="Win rate" value={`${SALES.winRate}%`} sub="last 12 months" />
                <Kpi icon={Layers} label="Deals in flight" value={`${SALES.inFlight}`} sub="across the portfolio" color="var(--people)" />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-line bg-surface p-5">
                  <div className="eyebrow">Pipeline by stage</div>
                  <div className="mt-3 space-y-3">
                    {SALES.stages.map((s) => (
                      <div key={s.stage}>
                        <div className="flex items-center justify-between text-[12px]"><span className="font-medium">{s.stage}</span><span className="text-muted">{money(s.value)} · {s.deals} deals</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg-2"><div className="h-full rounded-full" style={{ width: `${Math.round((s.value / SALES.pipeline) * 100)}%`, background: 'var(--accent)' }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-line bg-surface p-5">
                  <div className="eyebrow">Surfaced from calls</div>
                  <p className="mt-0.5 text-[11px] text-muted-2">Opportunities the Second Brain heard on calls, matched to HubSpot deals.</p>
                  <div className="mt-3 space-y-2">
                    {SALES.fromCalls.map((d, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-bg-2 p-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold">{d.account} <span className="font-normal text-muted-2">· {d.stage}</span></div>
                          <div className="truncate text-[11px] text-muted">{d.note}</div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold" style={{ color: 'var(--opp)' }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
          </>
          )}
        </div>
      </DashboardShell>
    </>
  )
}

function Kpi({ icon: Icon, label, value, sub, color }: { icon: typeof Building2; label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2"><Icon size={15} style={{ color: color ?? 'var(--muted)' }} /><span className="eyebrow">{label}</span></div>
      <div className="mt-2 text-3xl font-bold" style={color ? { color } : undefined}>{value}</div>
      <div className="mt-0.5 text-[12px] text-muted">{sub}</div>
    </div>
  )
}

function AccountTile({ id, onClick }: { id: string; onClick: () => void }) {
  const a = accountById(id)!
  return (
    <button onClick={onClick} className="rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--line-2)]" style={{ borderTop: `3px solid ${HEALTH_COLOR[a.health]}` }}>
      <div className="flex items-start justify-between">
        <h4 className="text-[14px] font-semibold">{a.name}</h4>
        <RagDot health={a.health} />
      </div>
      <div className="mt-1.5 text-[13px] font-semibold" style={{ color: HEALTH_COLOR[a.health] }}>{HEALTH_LABEL[a.health]}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
        <span>{podName(a.pod)}</span><span className="text-muted-2">·</span><span>{personName(a.clientDirector)}</span><span className="text-muted-2">·</span><span>{money(a.sowValue)}</span>
      </div>
      {a.coverage === 'limited' && <div className="mt-2"><CoverageBadge coverage="limited" /></div>}
    </button>
  )
}

function Legend() {
  return (
    <div className="hidden flex-wrap items-center gap-3 sm:flex">
      {TREND_ORDER.map((k) => (
        <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: SIGNAL_META[k].color }} /><span className="text-[11px] text-muted">{SIGNAL_META[k].label}</span></span>
      ))}
    </div>
  )
}
