// Katie's brief — the managing director's one page.
//
// Built to the 11 Aug call (source of truth) with the Revenue OS as the visual
// benchmark. Everything binds to REAL pipeline fields (see data/map.ts): account
// health, escalations, opportunities, calls, confidence, provenance. The one
// number Katie opens with — "at risk" — uses HER escalation lens, not delivery's:
// per the client's risk matrix (Chloe's methodology, ext channel 21 Jul) and
// Meesha's feedback, only a Critical or a senior-client-voice risk crosses her
// line. Register items reach her separately via the Level 1/2 day rules (wf2).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, Sparkles, Building2, Target, TrendingUp, TrendingDown, Minus, Radio,
  ArrowRight, ChevronDown, CheckCircle2, Eye, X, StickyNote,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { signals as allSignals, riskScope } from '../../data/signals'
import { useSignal } from '../common/SignalLayer'
import { calls, callForSignal } from '../../data/calls'
import { accounts, accountName, pods, personName, podName } from '../../data/org'
import { weeklyTrend } from '../../data/trends'
import { registerRisks } from '../../data/crm'
import { fetchBrief, generateBrief, fetchMe } from '../../data/api'
import type { ApiBrief } from '../../data/api'
import type { Signal, Severity, Trend, Account, Health } from '../../data/types'
import { SIGNAL_META, HEALTH_COLOR, HEALTH_LABEL } from '../../data/types'
import { BarChart3 } from 'lucide-react'

export type Days = 7 | 14 | 30
type SortBy = 'impact' | 'newest'
type Lens = 'needs-you' | 'watch' | 'on-track'
const DAY = 86_400_000
const SEV_W: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 }
const LENS_RANK: Record<Lens, number> = { 'needs-you': 3, watch: 2, 'on-track': 1 }
const LENS_DOT: Record<Lens, string> = { 'needs-you': 'var(--rag-red)', watch: 'var(--rag-amber)', 'on-track': 'var(--rag-green)' }
const LENS_WORD: Record<Lens, string> = { 'needs-you': 'Needs you', watch: 'Watch', 'on-track': 'On track' }
const ageDays = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / DAY)

// The MD escalation gate - the TRIPLE gate committed to the client (ext Slack,
// 21 Jul) and re-tightened 14 Aug: a risk reaches Katie only when it is
//   1. ACCOUNT-level (commercial/relationship - delivery mechanics never qualify),
//   2. CRITICAL on the client's own risk matrix, AND
//   3. politically loaded or stuck: raised by a SENIOR CLIENT stakeholder,
//      or unresolved 14+ days (someone owning a fresh risk is delivery's job).
const needsHer = (s: Signal) =>
  s.type === 'risk' && s.status !== 'actioned' && s.status !== 'dismissed' &&
  riskScope(s) === 'account' &&
  s.severity === 'critical' &&
  (s.escalate === true || ageDays(s.createdAt) >= 14)

function parsePounds(v?: string): number {
  const m = (v || '').match(/£\s*([\d.]+)\s*(k|m)?/i)
  if (!m) return 0
  const n = Number(m[1])
  return !isFinite(n) ? 0 : m[2]?.toLowerCase() === 'm' ? n * 1_000_000 : m[2]?.toLowerCase() === 'k' ? n * 1000 : n
}

// Live rows carry owner NAMES; demo rows carry person ids. Resolve either.
const ownerName = (v?: string) => {
  if (!v) return ''
  const n = personName(v)
  return n !== '-' ? n : v
}

// Where a signal was actually heard: prefer the linked call (real type/date/source),
// fall back to the classifier's sourceCall stamp.
function sourceOf(s: Signal): { label: string; date: string; hubspot: boolean } {
  const c = callForSignal(s) ?? (s.callId ? calls.find((x) => x.id === s.callId) : undefined)
  if (c) return { label: c.type, date: c.date, hubspot: c.source === 'hubspot' }
  return { label: s.sourceCall.type, date: s.sourceCall.date, hubspot: false }
}

// Account names inside interpreted prose become quiet links.
function Linked({ text, onOpenAccount }: { text: string; onOpenAccount: (id: string) => void }): ReactNode {
  const names = accounts.filter((a) => a.name.length >= 3).sort((a, b) => b.name.length - a.name.length)
  if (!names.length) return <>{text}</>
  const rx = new RegExp(`\\b(${names.map((a) => a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(rx)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    const hit = names.find((a) => a.name.toLowerCase() === m[0].toLowerCase())
    out.push(
      <button key={`${m.index}`} onClick={() => hit && onOpenAccount(hit.id)} className="font-semibold text-[var(--accent-d)] hover:underline">
        {m[0]}
      </button>,
    )
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

export function LeadershipHome({ onOpenAccount, onOpenSignal }: { onOpenAccount: (id: string) => void; onOpenSignal?: (s: Signal) => void }) {
  const [days, setDays] = useState<Days>(7)
  const [sortBy, setSortBy] = useState<SortBy>('impact')
  const [showAll, setShowAll] = useState(false)
  const [podFilter, setPodFilter] = useState<string | null>(null)
  const [briefOpen, setBriefOpen] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  // Greet whoever is actually signed in (Misha covers in Katie's absence).
  const [who, setWho] = useState('Katie')
  useEffect(() => {
    fetchMe().then((me) => {
      const raw = (me.name || me.email || '').split(/[\s.@_-]+/).filter(Boolean)[0]
      if (raw) setWho(raw[0].toUpperCase() + raw.slice(1))
    }).catch(() => {})
  }, [])

  const { statusOf } = useSignal()
  const d = useMemo(() => {
    const cutoff = Date.now() - days * DAY
    const prevCutoff = Date.now() - 2 * days * DAY
    const inP = (iso: string) => Date.parse(iso) >= cutoff
    const inPrev = (iso: string) => { const t = Date.parse(iso); return t >= prevCutoff && t < cutoff }

    // removed-as-incorrect signals never count anywhere (12 Aug)
    const period = allSignals.filter((s) => inP(s.createdAt) && statusOf(s) !== 'dismissed')
    const opps = period.filter((s) => s.type === 'opportunity')
    const periodCalls = calls.filter((c) => inP(c.date))
    const prevCalls = calls.filter((c) => inPrev(c.date))
    const needsYou = allSignals.filter((s) => needsHer(s) && statusOf(s) !== 'dismissed' && statusOf(s) !== 'actioned')

    // ── Katie's lens on every account ──
    // needs-you: an open signal crossed HER gate. watch: delivery marks it
    // amber/red but nothing crossed her line (their problem, not hers yet).
    const needsYouAccounts = new Set(needsYou.map((s) => s.accountId))
    const lensOf = (a: Account): Lens =>
      needsYouAccounts.has(a.id) ? 'needs-you' : a.health !== 'green' ? 'watch' : 'on-track'
    const lens = new Map(accounts.map((a) => [a.id, lensOf(a)]))
    const onTrack = accounts.filter((a) => lens.get(a.id) === 'on-track').length
    const watching = accounts.filter((a) => lens.get(a.id) === 'watch').length
    const atRisk = accounts.filter((a) => lens.get(a.id) === 'needs-you').length

    const speakers = new Set<string>()
    for (const c of periodCalls) {
      if (c.speakers) Object.keys(c.speakers).forEach((n) => speakers.add(n.toLowerCase()))
      else if (c.speaker) speakers.add(c.speaker.toLowerCase())
    }
    const activeSet = new Set(periodCalls.map((c) => c.accountId))
    const quiet = ([...new Set(prevCalls.map((c) => c.accountId))]
      .filter((id) => id && !activeSet.has(id)) as string[])
      .filter((id) => accounts.some((a) => a.id === id))

    // Highest impact: worst gated risk per account, then biggest opportunities.
    const worst = new Map<string, Signal>()
    for (const s of needsYou) { const c = worst.get(s.accountId); if (!c || SEV_W[s.severity] > SEV_W[c.severity]) worst.set(s.accountId, s) }
    const riskItems = [...worst.values()].sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity])
    const oppItems = [...opps].sort((a, b) => parsePounds(b.value) - parsePounds(a.value)).slice(0, Math.max(0, 5 - riskItems.length))
    const impact = [...riskItems, ...oppItems].slice(0, 5)

    // ── Pods, live-safe: grouped from the accounts themselves (live pod = the
    // Monday board's name string; demo pod = a static id). Owner = the pod lead
    // where known, else the most common client director on the pod's accounts. ──
    const groups = new Map<string, Account[]>()
    for (const a of accounts) { const k = a.pod || 'other'; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(a) }
    const podCards = [...groups.entries()].map(([key, accs]) => {
      const staticPod = pods.find((p) => p.id === key)
      let owner = staticPod ? personName(staticPod.owner) : ''
      if (!owner || owner === '-') {
        const counts = new Map<string, number>()
        for (const a of accs) { const o = ownerName(a.clientDirector); if (o) counts.set(o, (counts.get(o) || 0) + 1) }
        owner = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? ''
      }
      const name = key === 'other' ? 'Unallocated' : podName(key)
      const sigs = period.filter((s) => accs.some((a) => a.id === s.accountId)).length
      const counts: Record<Lens, number> = { 'needs-you': 0, watch: 0, 'on-track': 0 }
      for (const a of accs) counts[lens.get(a.id)!]++
      const trend: Trend = counts['needs-you'] ? 'declining' : accs.some((a) => a.trend === 'declining') ? 'steady' : counts.watch === 0 ? 'improving' : 'steady'
      return { key, name, owner, accs, signals: sigs, counts, trend }
    }).sort((a, b) => b.accs.length - a.accs.length).slice(0, 8)

    const roster = accounts
      .map((a) => {
        const sigs = allSignals.filter((s) => s.accountId === a.id && s.status !== 'actioned' && s.status !== 'dismissed')
        return { a, lens: lens.get(a.id)!, risks: sigs.filter((s) => s.type === 'risk').length, opps: sigs.filter((s) => s.type === 'opportunity').length }
      })
      .sort((x, y) => LENS_RANK[y.lens] - LENS_RANK[x.lens] || y.risks - x.risks)

    return { opps, periodCalls, needsYou, onTrack, watching, atRisk, people: speakers.size, quiet, impact, podCards, roster, signalCount: period.length }
  }, [days, statusOf])

  // Chloe's escalation-ladder rule (25 Aug): any OPEN register item at
  // Level 4 or higher goes to Katie, regardless of what the calls said.
  // The register has only ever held Level 1-2, so this lane is usually empty -
  // it exists so the rule is live the day TN raises one.
  const escalatedRegister = useMemo(() => {
    const levelOf = (e: string | null) => { const m = /(\d+)/.exec(e || ''); return m ? Number(m[1]) : 0 }
    return registerRisks.filter((r) => levelOf(r.escalation) >= 4)
  }, [])

  const sortedImpact = useMemo(() => {
    const arr = [...d.impact]
    if (sortBy === 'newest') arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return arr
  }, [d.impact, sortBy])

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="mx-auto max-w-[1120px]">
      {/* ── Header: greeting + live context, search / brief / Ask tnAI ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display-title">{greet}, {who}</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {today} · {accounts.length} accounts · <b className="font-semibold text-text">{d.atRisk ? `${d.atRisk} need${d.atRisk === 1 ? 's' : ''} you` : 'nothing needs you'}</b> · {d.periodCalls.length} calls analysed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <SearchBox onOpenAccount={onOpenAccount} onOpenSignal={onOpenSignal} />
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

      {/* ── The numbers · Katie's lens, all real ── */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={<Building2 size={15} />} label="Accounts on track" value={`${d.onTrack}/${accounts.length}`} sub={`${d.watching} with delivery watching · ${d.atRisk} need${d.atRisk === 1 ? 's' : ''} you`}
          tip="Your lens, not delivery's: an account only counts against you when a risk crosses your escalation bar (critical, or a senior client voice). Amber here means delivery is watching it - their problem until it isn't." />
        <Metric icon={<Target size={15} />} label="Need your call" value={`${d.needsYou.length}`} sub={d.needsYou.length ? 'account-level critical, senior voice or stuck 14+ days' : 'nothing has crossed your line'}
          tip="The triple gate agreed with the team: an account-level risk, critical on the risk matrix, that is either raised by a senior client stakeholder or has sat unresolved 14+ days. Everything quieter stays with delivery." />
        <Metric icon={<TrendingUp size={15} />} label="Opportunities in play" value={`${d.opps.length}`} sub={`across ${new Set(d.opps.map((s) => s.accountId)).size} account${new Set(d.opps.map((s) => s.accountId)).size !== 1 ? 's' : ''} this period`}
          tip="Opportunities surfaced from the period's calls. No £ values - commercials come off the dashboard until Synergist is the source of truth (agreed with Meesha, 21 Jul)." />
        <Metric icon={<Radio size={15} />} label="Calls analysed" value={`${d.periodCalls.length}`} sub={`${d.signalCount} signals · ${d.people} people active`}
          tip="Every transcribed call the brain read this period. Click a signal anywhere to see the exact moment in the conversation." />
      </div>

      {/* ── Highest impact actions ── */}
      <section className="mt-9">
        <div className="flex flex-wrap items-center gap-3">
          <SectionHead title="Highest impact actions" sub="the few places your weight changes the outcome" />
          <span className="flex-1" />
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-2">
            Sort
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="h-[30px] rounded-lg border border-line bg-surface px-2 text-[12px] font-semibold normal-case tracking-normal text-text outline-none">
              <option value="impact">Impact</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
        {escalatedRegister.length > 0 && (
          <div className="mt-4 space-y-3">
            {escalatedRegister.map((r) => (
              <button key={r.id} onClick={() => r.account_id && onOpenAccount(r.account_id)}
                className="flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5"
                style={{ borderColor: 'color-mix(in srgb, var(--risk) 40%, var(--line))', background: 'color-mix(in srgb, var(--risk) 5%, var(--surface))' }}>
                <span className="mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--risk)', background: 'color-mix(in srgb, var(--risk) 12%, transparent)' }}>
                  {r.escalation} · register
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold leading-snug">{r.name}</span>
                  <span className="mt-1 block text-[12px] text-muted">
                    {[r.account_name, r.impact_level ? `${r.impact_level} impact` : null, r.status, r.responsible].filter(Boolean).join(' · ')}
                  </span>
                  {r.treatment_plan && <span className="mt-1.5 block text-[12px] leading-relaxed text-muted-2">{String(r.treatment_plan).slice(0, 200)}</span>}
                </span>
                <ArrowRight size={15} className="mt-1 shrink-0 text-muted-2" />
              </button>
            ))}
          </div>
        )}
        {sortedImpact.length === 0 && escalatedRegister.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-[14px]">
            <CheckCircle2 size={18} style={{ color: 'var(--opp)' }} />
            <span><span className="font-semibold">You are clear for now.</span> <span className="text-muted">tnAI is monitoring {accounts.length} accounts and will surface the next action the moment a signal crosses your line.</span></span>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedImpact.map((s, i) => <ImpactCard key={s.id} s={s} rank={i + 1} onOpenAccount={onOpenAccount} onOpenSignal={onOpenSignal} />)}
          </div>
        )}
      </section>

      {/* ── The portfolio, by pod ── */}
      <section className="mt-9">
        <SectionHead title="The portfolio" sub="every pod at a glance · owners from the Monday boards" />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.podCards.map((pc) => (
            <PodCard key={pc.key} pc={pc} onClick={() => { setPodFilter(podFilter === pc.key ? null : pc.key); setShowAll(true) }} active={podFilter === pc.key} />
          ))}
        </div>

        <button onClick={() => { setShowAll((v) => !v); if (showAll) setPodFilter(null) }}
          className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3 text-[13px] font-semibold text-muted transition-colors hover:text-text">
          <Building2 size={15} /> {showAll ? 'Hide the account list' : `Every account, one line each · ${accounts.length}`}
          {podFilter && showAll && <span className="rounded-full bg-bg-2 px-2 py-0.5 text-[11px] font-semibold text-muted">filtered · {d.podCards.find((p) => p.key === podFilter)?.name}</span>}
          <ChevronDown size={15} className={`ml-auto transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
        {showAll && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
            {d.roster.filter((r) => !podFilter || r.a.pod === podFilter || (podFilter === 'other' && !r.a.pod)).map(({ a, lens: L, risks, opps }, i) => (
              <button key={a.id} onClick={() => onOpenAccount(a.id)} className={`group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-bg-2 ${i ? 'border-t border-line' : ''}`}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LENS_DOT[L] }} />
                <span className="w-[150px] shrink-0 truncate text-[13.5px] font-semibold">{accountName(a.id)}</span>
                <span className="w-[74px] shrink-0 text-[12px] text-muted-2">{LENS_WORD[L]}</span>
                <span className="hidden w-[140px] shrink-0 truncate text-[12px] text-muted-2 sm:block">{ownerName(a.clientPartner)}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                  {risks || opps ? [risks ? `${risks} open risk${risks !== 1 ? 's' : ''}` : '', opps ? `${opps} opportunit${opps !== 1 ? 'ies' : 'y'}` : ''].filter(Boolean).join(' · ') : 'No open signals'}
                </span>
                <ArrowRight size={14} className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Is the team moving? ── */}
      <section className="mb-2 mt-9">
        <SectionHead title="Is the team moving?" sub="from the calls the brain actually analysed — no guesswork" />
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
              <span className="text-[12px] text-muted-2">Quiet this period — active before, no calls now:</span>
              {d.quiet.map((id) => (
                <button key={id} onClick={() => onOpenAccount(id)} className="rounded-full border border-line bg-bg-2 px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:text-text">
                  {accountName(id)}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Analytics · one click away when she wants to expand ── */}
      <button onClick={() => setShowAnalytics((v) => !v)} className="mt-4 flex w-full items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3 text-[13px] font-semibold text-muted transition-colors hover:text-text">
        <BarChart3 size={15} /> {showAnalytics ? 'Hide the analytics' : 'Expand the analytics'} <span className="font-normal text-muted-2">signal activity · risk mix · portfolio health</span>
        <ChevronDown size={15} className={`ml-auto transition-transform ${showAnalytics ? 'rotate-180' : ''}`} />
      </button>
      {showAnalytics && (
        <div className="mb-2 mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <span className="eyebrow">Signal activity · recent weeks</span>
            <div className="mt-3 h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyTrend()} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
                  <ReTooltip cursor={{ fill: 'var(--bg-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
                  {(['opportunity', 'risk', 'update', 'people'] as const).map((k, i) => (
                    <Bar key={k} dataKey={k} stackId="s" fill={SIGNAL_META[k].color} animationDuration={850} animationEasing="ease-out" radius={i === 3 ? [3, 3, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <Donut title="Risk mix" sub="by framework category, this period"
            data={(() => { const m = new Map<string, number>(); for (const s of allSignals.filter((x) => x.type === 'risk' && x.status !== 'actioned' && x.status !== 'dismissed')) { const k = s.riskCategory || s.subtype || 'Uncategorised'; m.set(k, (m.get(k) || 0) + 1) } return [...m.entries()].map(([name, value]) => ({ name, value })) })()}
            palette={['#D64545', '#E68A00', '#B4468E', '#7C5CFF', '#1F62C4', '#1A8B91']} />
          <Donut title="Portfolio health" sub="current RAG across accounts"
            data={(['red', 'amber', 'green'] as Health[]).map((h) => ({ name: HEALTH_LABEL[h], value: accounts.filter((a) => a.health === h).length })).filter((x) => x.value > 0)}
            palette={[HEALTH_COLOR.red, HEALTH_COLOR.amber, HEALTH_COLOR.green]} />
        </div>
      )}

      {briefOpen && <BriefModal days={days} onClose={() => setBriefOpen(false)} onOpenAccount={(id) => { onOpenAccount(id); setBriefOpen(false) }} />}
    </div>
  )
}

function Donut({ title, sub, data, palette }: { title: string; sub: string; data: { name: string; value: number }[]; palette: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <span className="eyebrow">{title}</span>
      <p className="mt-0.5 text-[11.5px] text-muted-2">{sub}</p>
      {data.length === 0 ? (
        <p className="py-10 text-center text-[12px] text-muted-2">Nothing in this period.</p>
      ) : (
        <div className="mt-2 flex items-center gap-4">
          <div className="h-[120px] w-[120px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={34} outerRadius={56} paddingAngle={2} animationDuration={850} animationEasing="ease-out">
                  {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} stroke="var(--surface)" />)}
                </Pie>
                <ReTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 space-y-1.5">
            {data.map((x, i) => (
              <div key={x.name} className="flex items-center gap-2 text-[12px]">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: palette[i % palette.length] }} />
                <span className="truncate text-muted">{x.name}</span>
                <span className="num font-semibold">{x.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── "Your tnAI brief": the generated overview of everything, on demand.
//    Fresh briefs (<24h) show instantly; otherwise workflow 13 regenerates over
//    exactly this window while we animate. ──
export function BriefModal({ days, onClose, onOpenAccount }: { days: Days; onClose: () => void; onOpenAccount: (id: string) => void }) {
  const [brief, setBrief] = useState<ApiBrief | null>(null)
  const [generating, setGenerating] = useState(true)
  const [failed, setFailed] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    let on = true
    ;(async () => {
      const b = await fetchBrief('leadership', days)
      if (!on) return
      const fresh = b && Date.now() - Date.parse(b.created_at) < 24 * 3600_000
      if (fresh) { setBrief(b); setGenerating(false); return }
      if (b) setBrief(b)
      const g = await generateBrief(days).catch(() => null)
      if (!on) return
      if (g) setBrief(g)
      else if (!b) setFailed(true)
      setGenerating(false)
    })()
    return () => { on = false }
  }, [days])

  useEffect(() => {
    if (!generating) return
    const t = window.setInterval(() => setMsgIdx((i) => i + 1), 2400)
    return () => window.clearInterval(t)
  }, [generating])

  const GEN = [
    `Re-reading the last ${days} days of calls…`,
    'Cross-checking the weekly reports…',
    'Weighing the open pipeline…',
    'Writing your brief…',
  ]
  const when = brief ? new Date(brief.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null
  const c = brief?.content

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[86vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: 'var(--accent)' }}><Sparkles size={15} /></span>
          <div>
            <h3 className="text-[15px] font-bold tracking-tight">Your tnAI brief</h3>
            <p className="text-[11.5px] text-muted-2">{days === 7 ? 'this week' : `last ${days} days`}{when && !generating ? ` · generated ${when}` : ''} · reads every call, weekly report + HubSpot</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto rounded-md p-1 text-muted-2 transition-colors hover:text-text"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {generating ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <span className="relative grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: 'var(--accent)' }}>
                <Sparkles size={22} className="animate-pulse" />
                <span className="absolute inset-0 animate-ping rounded-2xl" style={{ background: 'color-mix(in srgb, var(--accent) 25%, transparent)' }} aria-hidden />
              </span>
              <p className="text-[13.5px] font-semibold">{GEN[msgIdx % GEN.length]}</p>
              <p className="text-[11px] text-muted-2">usually under half a minute</p>
            </div>
          ) : failed || !c ? (
            <div className="py-10 text-center">
              <p className="text-[13.5px] font-semibold">tnAI couldn't write the brief just now.</p>
              <p className="mt-1 text-[12px] text-muted">It will try again when you reopen this - the rest of the dashboard is unaffected.</p>
            </div>
          ) : (
            <div className="space-y-6 px-1 py-1">
              <section>
                <h4 className="text-[14px] font-semibold tracking-[-0.01em]">What's happening</h4>
                <Prose text={c.whats_happening} onOpenAccount={onOpenAccount} />
                {c.why && (
                  <>
                    <h4 className="mt-4 text-[14px] font-semibold tracking-[-0.01em]">The pattern behind it</h4>
                    <Prose text={c.why} onOpenAccount={onOpenAccount} />
                  </>
                )}
              </section>
              {(c.accounts?.length ?? 0) > 0 && (
                <section className="border-t border-line pt-5">
                  <h4 className="text-[14px] font-semibold tracking-[-0.01em]">Account by account</h4>
                  <div className="mt-3 space-y-4">
                    {c.accounts!.map((a) => (
                      <div key={a.name} className="border-l-2 pl-4" style={{ borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--line))' }}>
                        <span className="text-[13.5px] font-bold"><Linked text={a.name} onOpenAccount={onOpenAccount} /></span>
                        <p className="mt-1 text-[13px] leading-relaxed"><Linked text={a.update} onOpenAccount={onOpenAccount} /></p>
                        {a.why && <p className="mt-1 text-[12.5px] leading-relaxed text-muted"><Linked text={a.why} onOpenAccount={onOpenAccount} /></p>}
                        {(a.actions?.length ?? 0) > 0 && a.actions!.map((act, i) => (
                          <p key={i} className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium leading-snug">
                            <ArrowRight size={13} className="mt-[3px] shrink-0" style={{ color: 'var(--accent)' }} />
                            <Linked text={act} onOpenAccount={onOpenAccount} />
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {(c.watch_for?.length ?? 0) > 0 && (
                <section className="border-t border-line pt-5">
                  <h4 className="text-[14px] font-semibold tracking-[-0.01em]">Watch for</h4>
                  <div className="mt-2 space-y-1.5">
                    {c.watch_for!.map((t, i) => (
                      <p key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--muted-2)]" />
                        <span className="min-w-0"><Linked text={t} onOpenAccount={onOpenAccount} /></span>
                      </p>
                    ))}
                  </div>
                </section>
              )}
              <section className="border-t border-line pt-5">
                <h4 className="text-[14px] font-semibold tracking-[-0.01em]">What needs you</h4>
                <div className="mt-2 space-y-1.5">
                  {(c.needs_you.length ? c.needs_you : ['Nothing needs your intervention this period.']).map((t, i) => (
                    <p key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.needs_you.length ? 'var(--risk)' : 'var(--muted-2)' }} />
                      <span className="min-w-0"><Linked text={t} onOpenAccount={onOpenAccount} /></span>
                    </p>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Prose({ text, onOpenAccount }: { text: string; onOpenAccount: (id: string) => void }) {
  const blocks = (text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean)
  return (
    <div className="mt-1.5 space-y-1.5">
      {blocks.map((raw, i) => {
        const isBullet = /^[-•]\s+/.test(raw)
        const t = raw.replace(/^[-•]\s+/, '')
        return (
          <p key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
            {isBullet && <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} />}
            <span className="min-w-0"><Linked text={t} onOpenAccount={onOpenAccount} /></span>
          </p>
        )
      })}
    </div>
  )
}

// ── Search: accounts and signals, straight from the header ──
export function SearchBox({ onOpenAccount, onOpenSignal }: { onOpenAccount: (id: string) => void; onOpenSignal?: (s: Signal) => void }) {
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const ql = q.trim().toLowerCase()
  const accHits = ql ? accounts.filter((a) => a.name.toLowerCase().includes(ql)).slice(0, 4) : []
  const sigHits = ql
    ? allSignals.filter((s) => (s.summary + ' ' + s.quote).toLowerCase().includes(ql) && s.status !== 'dismissed').slice(0, 4)
    : []
  const open = focus && ql.length >= 2 && (accHits.length > 0 || sigHits.length > 0)
  return (
    <div ref={box} className="relative">
      <div className="flex h-[38px] w-[280px] items-center gap-2 rounded-xl border border-line bg-surface px-3 transition-colors focus-within:border-[var(--accent)]">
        <Search size={14} className="shrink-0 text-muted-2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => window.setTimeout(() => setFocus(false), 150)}
          placeholder="Search accounts and signals"
          className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-muted-2"
        />
      </div>
      {open && (
        <div className="absolute right-0 top-[44px] z-50 w-[340px] overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
          {accHits.length > 0 && <div className="eyebrow px-4 pb-1 pt-3">Accounts</div>}
          {accHits.map((a) => (
            <button key={a.id} onMouseDown={() => onOpenAccount(a.id)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-bg-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.health === 'red' ? 'var(--rag-red)' : a.health === 'amber' ? 'var(--rag-amber)' : 'var(--rag-green)' }} />
              <span className="text-[13px] font-semibold">{a.name}</span>
            </button>
          ))}
          {sigHits.length > 0 && <div className="eyebrow px-4 pb-1 pt-3">Signals</div>}
          {sigHits.map((s) => (
            <button key={s.id} onMouseDown={() => (onOpenSignal ? onOpenSignal(s) : onOpenAccount(s.accountId))} className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-bg-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: s.type === 'risk' ? 'var(--risk)' : s.type === 'opportunity' ? 'var(--opp)' : 'var(--update)' }} />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium text-text">{s.summary}</span>
                <span className="text-[11px] text-muted-2">{accountName(s.accountId)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Building blocks ──

export function Metric({ icon, label, value, sub, tip }: { icon: ReactNode; label: string; value: string; sub: string; tip: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5" title={tip} tabIndex={0}>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'var(--bg-2)', color: 'var(--muted)' }}>{icon}</span>
        <span className="eyebrow">{label}</span>
      </div>
      <div className="metric-num mt-4">{value}</div>
      <div className="mt-1.5 text-[12px] text-muted">{sub}</div>
    </div>
  )
}

export function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-[19px] font-semibold tracking-[-0.01em]">{title}</h2>
      <span className="text-[12.5px] text-muted-2">{sub}</span>
    </div>
  )
}

function ScoreRing({ value, color }: { value: number; color: string }) {
  const r = 14
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid h-9 w-9 shrink-0 place-items-center" title={`tnAI confidence ${value}/100`}>
      <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--bg-2)" strokeWidth="3.5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      </svg>
      <span className="num absolute text-[10.5px] font-bold" style={{ color }}>{value}</span>
    </span>
  )
}

export function ImpactCard({ s, rank, onOpenAccount, onOpenSignal }: { s: Signal; rank: number; onOpenAccount: (id: string) => void; onOpenSignal?: (s: Signal) => void }) {
  const isRisk = s.type === 'risk'
  const color = isRisk ? 'var(--risk)' : 'var(--opp)'
  const tag = isRisk ? (s.severity === 'critical' ? 'Critical risk' : 'Escalated to you') : 'Opportunity'
  const age = ageDays(s.createdAt)
  const momentum = isRisk
    ? { label: age <= 2 ? 'New' : `${age}d open`, color: age > 7 ? 'var(--people)' : 'var(--muted)' }
    : { label: (s.mentions ?? 1) >= 2 ? `Heard ${s.mentions}×` : 'Moving', color: 'var(--opp)' }
  const src = sourceOf(s)
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <span className="num mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px] font-bold" style={{ background: 'var(--bg-2)', color: 'var(--muted)' }}>{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => onOpenAccount(s.accountId)} className="text-[15.5px] font-bold tracking-[-0.01em] hover:underline">{accountName(s.accountId)}</button>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color, background: `color-mix(in srgb, ${color} 11%, transparent)` }}>{tag}</span>
            <span className="ml-auto flex items-center gap-2.5">
              <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ color: momentum.color, background: `color-mix(in srgb, ${momentum.color} 11%, transparent)` }}>
                {momentum.label}
              </span>
              <ScoreRing value={s.confidence} color={color} />
            </span>
          </div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-text">{s.summary}</p>
          {/* SOURCES - neutral gray pills, Revenue OS style (screenshot, 11 Aug) */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="eyebrow mr-1">Sources</span>
            <SourcePill icon={src.hubspot ? <StickyNote size={11} /> : <Radio size={11} />}
              label={`${src.hubspot ? 'HubSpot' : src.label} · ${new Date(src.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`} />
            {s.raisedBy && <SourcePill label={`raised by ${s.raisedBy}`} />}
            {(s.mentions ?? 1) >= 2 && <SourcePill label={`${s.mentions} calls`} />}
          </div>
          {s.suggestedAction && (
            <div className="mt-3 rounded-xl p-3.5" style={{ background: 'linear-gradient(155deg, color-mix(in srgb, var(--accent) 9%, var(--surface)), color-mix(in srgb, var(--accent) 3%, var(--surface)))', border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--line))' }}>
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} style={{ color: 'var(--accent-d)' }} />
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent-d)' }}>tnAI suggested next step</span>
              </div>
              <p className="mt-1 text-[13.5px] font-medium leading-snug text-text">{s.suggestedAction}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {onOpenSignal && (
                  <button onClick={() => onOpenSignal(s)} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.02]" style={{ background: 'var(--accent)' }}>
                    <Eye size={12} /> Review
                  </button>
                )}
                <button onClick={() => onOpenAccount(s.accountId)} className="group inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:text-text">
                  Open {accountName(s.accountId)} <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'improving') return <TrendingUp size={14} style={{ color: 'var(--opp)' }} aria-label="Improving" />
  if (trend === 'declining') return <TrendingDown size={14} style={{ color: 'var(--risk)' }} aria-label="Declining" />
  return <Minus size={14} style={{ color: 'var(--muted-2)' }} aria-label="Steady" />
}

type PodCardData = { key: string; name: string; owner: string; accs: Account[]; signals: number; counts: Record<Lens, number>; trend: Trend }
function PodCard({ pc, onClick, active }: { pc: PodCardData; onClick: () => void; active: boolean }) {
  const total = pc.accs.length || 1
  return (
    <button onClick={onClick} className="rounded-2xl border bg-surface p-4 text-left transition-all hover:shadow-md" style={{ borderColor: active ? 'var(--accent)' : 'var(--line)' }}>
      <div className="flex items-start gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent-d)' }}>
          <Building2 size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold leading-tight">{pc.name}</span>
          <span className="block truncate text-[11px] text-muted-2">{pc.owner}</span>
        </span>
        <TrendIcon trend={pc.trend} />
      </div>
      <div className="mt-3.5 flex h-[6px] w-full gap-[3px] overflow-hidden rounded-full" role="img"
        aria-label={`${pc.counts['on-track']} on track, ${pc.counts.watch} watching, ${pc.counts['needs-you']} need you`}>
        {(['on-track', 'watch', 'needs-you'] as Lens[]).map((h) =>
          pc.counts[h] ? <span key={h} style={{ width: `${(100 * pc.counts[h]) / total}%`, background: LENS_DOT[h] }} /> : null,
        )}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-2">
        {pc.counts['on-track']} on track{pc.counts.watch ? ` · ${pc.counts.watch} watch` : ''}{pc.counts['needs-you'] ? ` · ${pc.counts['needs-you']} need you` : ''}
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-[11.5px] text-muted">
        <span>{pc.accs.length} account{pc.accs.length !== 1 ? 's' : ''}</span>
        <span className="ml-auto">{pc.signals} signal{pc.signals !== 1 ? 's' : ''}</span>
      </div>
    </button>
  )
}

function SourcePill({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium text-muted" style={{ background: 'var(--bg-2)' }}>
      {icon}{label}
    </span>
  )
}

export function Pulse({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <div>
      <div className="metric-num" style={{ fontSize: 30, lineHeight: '32px', color: warn ? 'var(--people)' : undefined }}>{value}</div>
      <div className="mt-1 text-[12px] text-muted">{label}</div>
    </div>
  )
}
