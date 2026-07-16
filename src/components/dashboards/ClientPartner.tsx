import { useMemo, useState } from 'react'
import { LayoutDashboard, Radio, Building2, PoundSterling, ArrowRight, Search } from 'lucide-react'
import { DashboardShell } from '../shell/DashboardShell'
import { accounts, projectsForAccount } from '../../data/org'
import { signals, rankByImpact, riskScope } from '../../data/signals'
import { RagDot, CoverageBadge } from '../common/primitives'
import { TriageCard } from '../common/TriageCard'
import { ExecSummary } from '../common/ExecSummary'
import { SignalsDonut } from '../common/SignalsDonut'
import { SignalsFeed } from '../common/SignalsFeed'
import { AccountView, money } from '../common/AccountView'
import { ProjectView } from '../common/ProjectView'

type View = 'overview' | 'signals' | 'accounts' | 'commercials'

export function ClientPartner() {
  const [view, setView] = useState<View>('overview')
  const [sel, setSel] = useState<string | null>(null)
  const [selProject, setSelProject] = useState<string | null>(null)
  const [acctQ, setAcctQ] = useState('')

  const actionable = useMemo(() => rankByImpact(signals.filter((s) => s.type !== 'update')), [])
  const opps = actionable.filter((s) => s.type === 'opportunity')
  const risks = actionable.filter((s) => s.type === 'risk')
  const acctRiskN = risks.filter((r) => riskScope(r) === 'account').length
  const keySignals = actionable.slice(0, 5)
  const underMgmt = useMemo(() => accounts.reduce((s, a) => s + a.sowValue, 0), [])

  const goTab = (v: string) => { setView(v as View); setSel(null); setSelProject(null) }

  return (
    <DashboardShell
      role="Client Partner" persona="Commercial view · your accounts" active={view} onSelect={goTab} onOpenAccount={(id) => { setSelProject(null); setSel(id) }}
      sections={[
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'signals', label: 'Signals', icon: Radio, count: signals.length },
        { id: 'accounts', label: 'Portfolio', icon: Building2, count: accounts.length },
        { id: 'commercials', label: 'Commercials', icon: PoundSterling },
      ]}
    >
      <div className="px-7 py-6">
        {selProject ? (
          <ProjectView projectId={selProject} onBack={() => setSelProject(null)} onOpenAccount={(id) => { setSelProject(null); setSel(id) }} backLabel="Back" />
        ) : sel ? (
          <AccountView accountId={sel} onBack={() => setSel(null)} onOpenProject={(id) => setSelProject(id)} backLabel="Back to portfolio" />
        ) : (
          <>
            {view === 'overview' && (
              <>
                <h3 className="text-[15px] font-semibold">Your portfolio, live</h3>
                <p className="mt-0.5 text-[13px] text-muted">A live read of what the Second Brain is hearing across your accounts today.</p>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
                  <ExecSummary items={keySignals} onOpen={(id) => setSel(id)} />
                  <SignalsDonut signals={signals} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Kpi label="Accounts" value={`${accounts.length}`} sub="in portfolio" />
                  <Kpi label="Open opportunities" value={`${opps.length}`} sub="ranked by value" color="var(--opp)" />
                  <Kpi label="Open risks" value={`${risks.length}`} sub={`${acctRiskN} account · ${risks.length - acctRiskN} delivery`} color="var(--risk)" />
                  <Kpi label="Under management" value={money(underMgmt)} sub="total SOW value" color="var(--accent)" />
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="text-[15px] font-semibold">Key signals</h3><p className="mt-0.5 text-[13px] text-muted">Your highest-priority items right now. Click any to open the call and transcript.</p></div>
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
                <p className="mt-0.5 text-[13px] text-muted">Every signal the Second Brain has pulled from your calls. Filter and sort, then open any to see the call and transcript behind it.</p>
                <SignalsFeed signals={signals} onOpenAccount={(id) => setSel(id)} />
              </>
            )}

            {view === 'accounts' && (
              <>
                <h3 className="text-[15px] font-semibold">Portfolio</h3>
                <p className="mt-0.5 text-[13px] text-muted">Every account in your portfolio - health, relationship and a commercial snapshot. Click any account to open its full page.</p>
                <p className="mt-1 text-[11px] text-muted-2">Budget burn is <b>as reported on governance calls</b> - live actuals via Synergist to follow.</p>
                <div className="relative mt-3 max-w-[340px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
                  <input value={acctQ} onChange={(e) => setAcctQ(e.target.value)} placeholder="Search accounts…" className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-2 focus:border-[var(--accent)]" />
                </div>
                <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="px-4 py-2.5 eyebrow">Account</th><th className="px-4 py-2.5 eyebrow">Health</th><th className="px-4 py-2.5 eyebrow">Team &amp; scope</th><th className="px-4 py-2.5 eyebrow">SOW</th><th className="px-4 py-2.5 eyebrow">Budget burn</th><th className="px-4 py-2.5 eyebrow">Headroom</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.filter((a) => a.name.toLowerCase().includes(acctQ.trim().toLowerCase())).map((a) => {
                        const ps = projectsForAccount(a.id)
                        const consultants = new Set(ps.flatMap((p) => p.advisors)).size
                        const extensions = ps.filter((p) => p.extension).length
                        return (
                        <tr key={a.id} onClick={() => setSel(a.id)} className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-bg-2">
                          <td className="px-4 py-3 font-semibold">{a.name}{a.coverage === 'limited' && <span className="ml-2 align-middle"><CoverageBadge coverage="limited" /></span>}</td>
                          <td className="px-4 py-3">
                            <RagDot health={a.health} withLabel />
                            {a.healthReason && <div className="mt-0.5 text-[11px] leading-tight text-muted-2">{a.healthReason}</div>}
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {ps.length} project{ps.length !== 1 ? 's' : ''} · {consultants} consultant{consultants !== 1 ? 's' : ''}
                            {extensions > 0 && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: 'var(--opp)', background: 'color-mix(in srgb, var(--opp) 12%, transparent)' }}>{extensions} ext</span>}
                          </td>
                          <td className="px-4 py-3">{money(a.sowValue)}</td>
                          <td className="px-4 py-3"><BurnBar pct={a.budgetBurnPct} /></td>
                          <td className="px-4 py-3 text-muted">{money(a.headroom)}</td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {view === 'commercials' && (
              <>
                <h3 className="text-[15px] font-semibold">Commercials</h3>
                <p className="mt-0.5 text-[13px] text-muted">Budget burn against SOW, headroom and value-adds per account. Click any to open its full page.</p>
                <p className="mt-1 text-[11px] text-muted-2">Budget figures are <b>as reported on governance calls</b> - live actuals via Synergist to follow.</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {accounts.map((a) => (
                    <button key={a.id} onClick={() => setSel(a.id)} className="rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--line-2)]">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[14px] font-semibold"><RagDot health={a.health} />{a.name}</span>
                        <span className="text-[12px] text-muted">{money(a.sowValue)} SOW</span>
                      </div>
                      <div className="mt-3"><BurnBar pct={a.budgetBurnPct} big /></div>
                      <div className="mt-2 flex justify-between text-[11px] text-muted">
                        <span>{a.budgetBurnPct}% burned · {money(a.headroom)} headroom</span>
                        <span>{a.valueAdds} value-adds</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </DashboardShell>
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

function BurnBar({ pct, big = false }: { pct: number; big?: boolean }) {
  const color = pct > 75 ? 'var(--risk)' : pct > 60 ? 'var(--people)' : 'var(--opp)'
  return (
    <div className="flex items-center gap-2">
      <div className={`overflow-hidden rounded-full bg-bg-2 ${big ? 'h-2 w-full' : 'h-1.5 w-24'}`}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      {!big && <span className="text-[11px] text-muted">{pct}%</span>}
    </div>
  )
}
