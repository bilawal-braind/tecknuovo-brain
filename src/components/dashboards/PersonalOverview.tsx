// Kiera's page - the head-of-delivery version of Katie's one page (Bilawal,
// 25 Aug: same structure as the leadership home, condensed to HER delivery
// world). Same components, same calm: greeting + tnAI brief, four muted
// metrics, at most five highest-impact actions, her accounts, and a pulse
// strip. Numbers stay quiet - the enemy is the wall of work, not the reader.
import { useMemo, useState } from 'react'
import { Sparkles, FolderKanban, Target, TrendingUp, Radio, ArrowRight, CheckCircle2, Eye } from 'lucide-react'
import { accounts, accountName, projects, personName } from '../../data/org'
import { signals as allSignals } from '../../data/signals'
import { calls } from '../../data/calls'
import { registerRisksForAccount } from '../../data/crm'
import { useSignal } from '../common/SignalLayer'
import { RagDot } from '../common/primitives'
import { BriefModal, SearchBox, Metric, SectionHead, ImpactCard, Pulse } from '../leadership/Home'
import type { Days } from '../leadership/Home'
import type { Signal, Severity } from '../../data/types'

const DAY = 86_400_000
const SEV_W: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 }
const ageDays = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / DAY)

// Accounts this person is on: client director, client partner, or DM on a project.
export function accountsForPersona(name: string) {
  return accounts.filter((a) =>
    personName(a.clientDirector) === name ||
    personName(a.clientPartner) === name ||
    (a.deliveryManager && personName(a.deliveryManager) === name) ||
    projects.some((p) => p.accountId === a.id && p.deliveryManager && personName(p.deliveryManager) === name))
}

// The head-of-delivery gate - one notch wider than Katie's: she owns delivery,
// so delivery-level risks DO qualify, but only the serious ones: critical, or
// high that is escalated or has sat unresolved a week.
const needsKiera = (s: Signal) =>
  s.type === 'risk' &&
  (s.severity === 'critical' || (s.severity === 'high' && (s.escalate === true || ageDays(s.createdAt) >= 7)))

export function PersonalOverview({ personaName, onOpenAccount, onOpenSignal, onOpenSignals }: {
  personaName: string
  onOpenAccount: (id: string) => void
  onOpenSignal: (s: { id: string; accountId: string; projectId?: string }) => void
  onOpenSignals: () => void
}) {
  const [days, setDays] = useState<Days>(7)
  const [briefOpen, setBriefOpen] = useState(false)
  const { statusOf } = useSignal()

  const mine = useMemo(() => accountsForPersona(personaName), [personaName])
  const mineIds = useMemo(() => new Set(mine.map((a) => a.id)), [mine])

  const d = useMemo(() => {
    const cutoff = Date.now() - days * DAY
    const prevCutoff = Date.now() - 2 * days * DAY
    const inP = (iso: string) => Date.parse(iso) >= cutoff
    const open = allSignals.filter((s) => mineIds.has(s.accountId) && statusOf(s) !== 'dismissed' && statusOf(s) !== 'actioned')
    const period = allSignals.filter((s) => mineIds.has(s.accountId) && inP(s.createdAt) && statusOf(s) !== 'dismissed')
    const needsYou = open.filter(needsKiera)
    const opps = period.filter((s) => s.type === 'opportunity')
    const periodCalls = calls.filter((c) => mineIds.has(c.accountId) && inP(c.date))
    const prevCalls = calls.filter((c) => mineIds.has(c.accountId) && Date.parse(c.date) >= prevCutoff && Date.parse(c.date) < cutoff)

    // Highest impact: the worst gated risk per account, then the best opportunities.
    const worst = new Map<string, Signal>()
    for (const s of needsYou) { const c = worst.get(s.accountId); if (!c || SEV_W[s.severity] > SEV_W[c.severity]) worst.set(s.accountId, s) }
    const impact = [
      ...[...worst.values()].sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity]),
      ...opps.slice(0, Math.max(0, 5 - worst.size)),
    ].slice(0, 5)

    const myProjects = projects.filter((p) => mineIds.has(p.accountId))
    const offTrack = myProjects.filter((p) => p.rag !== 'green')
    const speakers = new Set<string>()
    for (const c of periodCalls) {
      if (c.speakers) Object.keys(c.speakers).forEach((n) => speakers.add(n.toLowerCase()))
      else if (c.speaker) speakers.add(c.speaker.toLowerCase())
    }
    const activeSet = new Set(periodCalls.map((c) => c.accountId))
    const quiet = ([...new Set(prevCalls.map((c) => c.accountId))].filter((id) => id && !activeSet.has(id)) as string[])
      .filter((id) => mineIds.has(id))

    return { open, needsYou, opps, periodCalls, impact, myProjects, offTrack, people: speakers.size, quiet, signalCount: period.length }
  }, [days, statusOf, mineIds])

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = personaName.split(' ')[0]

  return (
    <div className="mx-auto max-w-[1120px]">
      {/* ── Header: greeting + live context, search / brief ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display-title">{greet}, {firstName}</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {today} · {mine.length} accounts · <b className="font-semibold text-text">{d.needsYou.length ? `${d.needsYou.length} need${d.needsYou.length === 1 ? 's' : ''} you` : 'nothing needs you'}</b> · {d.periodCalls.length} calls analysed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchBox onOpenAccount={onOpenAccount} onOpenSignal={(s) => onOpenSignal(s)} />
          <button
            onClick={() => setBriefOpen(true)}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            style={{ background: 'var(--accent)' }}>
            <Sparkles size={14} /> Your tnAI brief
          </button>
        </div>
      </div>

      {/* period toggle */}
      <div className="mt-4 inline-flex rounded-lg border border-line bg-surface p-0.5 text-[12px] font-semibold">
        {([7, 14, 30] as Days[]).map((v) => (
          <button key={v} onClick={() => setDays(v)} className={`rounded-md px-3 py-1.5 transition-colors ${days === v ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text'}`}>
            {v === 7 ? 'This week' : `${v} days`}
          </button>
        ))}
      </div>

      {/* ── The numbers · her delivery lens, quiet ── */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={<FolderKanban size={15} />} label="Projects on track" value={`${d.myProjects.length - d.offTrack.length}/${d.myProjects.length}`}
          sub={d.offTrack.length ? `${d.offTrack.map((p) => p.name).slice(0, 2).join(', ')}${d.offTrack.length > 2 ? ` +${d.offTrack.length - 2}` : ''} off track` : 'everything reporting green'}
          tip="From the weekly reports your teams file - a project counts against you when its latest RAG is amber or red." />
        <Metric icon={<Target size={15} />} label="Need your call" value={`${d.needsYou.length}`}
          sub={d.needsYou.length ? 'critical, or high and stuck a week' : 'nothing has crossed your line'}
          tip="Your escalation bar as head of delivery: a critical risk, or a high risk that is escalated or has sat unresolved 7+ days. Everything quieter stays with the team." />
        <Metric icon={<TrendingUp size={15} />} label="Opportunities in play" value={`${d.opps.length}`}
          sub={`across ${new Set(d.opps.map((s) => s.accountId)).size} account${new Set(d.opps.map((s) => s.accountId)).size !== 1 ? 's' : ''} this period`}
          tip="Opportunities surfaced from this period's calls on your accounts." />
        <Metric icon={<Radio size={15} />} label="Calls analysed" value={`${d.periodCalls.length}`}
          sub={`${d.signalCount} signals · ${d.people} people heard`}
          tip="Every transcribed call the brain read on your accounts this period. Open any signal to see the exact moment in the conversation." />
      </div>

      {/* ── Highest impact actions ── */}
      <section className="mt-9">
        <SectionHead title="Highest impact actions" sub="the few places your weight changes the outcome" />
        {d.impact.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-[14px]">
            <CheckCircle2 size={18} style={{ color: 'var(--opp)' }} />
            <span><span className="font-semibold">You are clear for now.</span> <span className="text-muted">tnAI is watching your {mine.length} accounts and will surface the next action the moment something crosses your line.</span></span>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {d.impact.map((s, i) => <ImpactCard key={s.id} s={s} rank={i + 1} onOpenAccount={onOpenAccount} onOpenSignal={(x) => onOpenSignal(x)} />)}
          </div>
        )}
        {d.open.length > d.impact.length && (
          <button onClick={onOpenSignals} className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3 text-[13px] font-semibold text-muted transition-colors hover:text-text">
            <Radio size={15} /> Everything else on your accounts · {d.open.length} open signals <ArrowRight size={14} className="ml-auto" />
          </button>
        )}
      </section>

      {/* ── Her accounts ── */}
      <section className="mb-2 mt-9">
        <SectionHead title="Your accounts" sub="delivery health from the weekly reports · click one to open it" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...mine].sort((a, b) => ({ red: 0, amber: 1, green: 2 }[a.health] ?? 2) - ({ red: 0, amber: 1, green: 2 }[b.health] ?? 2)).map((a) => {
            const risks = d.open.filter((s) => s.accountId === a.id && s.type === 'risk').length
            const opps = d.open.filter((s) => s.accountId === a.id && s.type === 'opportunity').length
            const offN = d.myProjects.filter((p) => p.accountId === a.id && p.rag !== 'green').length
            const regN = registerRisksForAccount(a.id).length
            const roles = [
              personName(a.clientDirector) === personaName ? 'Client Director' : null,
              personName(a.clientPartner) === personaName ? 'Client Partner' : null,
            ].filter(Boolean).join(' + ') || 'Delivery oversight'
            return (
              <button key={a.id} onClick={() => onOpenAccount(a.id)}
                className="group rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.14)]">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 text-[14px] font-bold tracking-tight"><RagDot health={a.health} />{a.name}</span>
                  <ArrowRight size={14} className="mt-0.5 shrink-0 text-muted-2 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-2">{roles}</p>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  {risks || opps || offN || regN
                    ? [risks ? `${risks} open risk${risks !== 1 ? 's' : ''}` : '', opps ? `${opps} opportunit${opps !== 1 ? 'ies' : 'y'}` : '', offN ? `${offN} project${offN !== 1 ? 's' : ''} off track` : '', regN ? `${regN} on the register` : ''].filter(Boolean).join(' · ')
                    : 'No open signals'}
                </p>
              </button>
            )
          })}
          {mine.length === 0 && <p className="col-span-full rounded-2xl border border-line bg-surface p-6 text-center text-[12.5px] text-muted-2">No accounts are assigned to {personaName} yet - assignments come from the Monday boards.</p>}
        </div>
      </section>

      {/* ── Is the delivery moving? ── */}
      <section className="mb-2 mt-9">
        <SectionHead title="Is the delivery moving?" sub="from the calls the brain actually analysed on your accounts" />
        <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
            <Pulse value={`${d.periodCalls.length}`} label="calls analysed" />
            <Pulse value={`${d.people}`} label="people heard on calls" />
            <Pulse value={`${d.signalCount}`} label="signals extracted" />
            <Pulse value={`${d.quiet.length}`} label="accounts gone quiet" warn={d.quiet.length > 0} />
          </div>
          {d.quiet.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Eye size={13} className="text-muted-2" />
              <span className="text-[12px] text-muted-2">Quiet this period - active before, no calls now:</span>
              {d.quiet.map((id) => (
                <button key={id} onClick={() => onOpenAccount(id)} className="rounded-full border border-line bg-bg-2 px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:text-text">
                  {accountName(id)}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {briefOpen && <BriefModal days={days} onClose={() => setBriefOpen(false)} onOpenAccount={onOpenAccount} />}
    </div>
  )
}
