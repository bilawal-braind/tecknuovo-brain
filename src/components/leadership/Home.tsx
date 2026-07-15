// Katie's home: the week zoomed out, for a MANAGING DIRECTOR.
// Order: tnAI brief (parallel columns, account names are live links) -> numbers ->
// charts -> risks as detailed macro cards per account (expand: the risk, why it was
// flagged, the step, and transcript snippets from across the week's calls) ->
// potential risks (computed trajectories + the early-radar automation that reads
// whole transcripts) -> opportunity heat. No raw signal feed, ever.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Sparkles, AlertTriangle, TrendingUp, Radio, Building2, ChevronDown, Eye, CheckCircle2, ArrowRight, MessageSquareQuote } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { signals as allSignals, riskScope } from '../../data/signals'
import { calls, snippetAround, transcriptWithMoments } from '../../data/calls'
import type { Call } from '../../data/calls'
import { accounts, accountName } from '../../data/org'
import { weeklyTrend } from '../../data/trends'
import { fetchBrief, fetchTranscript } from '../../data/api'
import type { ApiBrief } from '../../data/api'
import type { Signal, Severity } from '../../data/types'
import { SIGNAL_META, HEALTH_COLOR, HEALTH_LABEL } from '../../data/types'
import { fmt } from '../common/SignalLayer'

type Days = 7 | 14 | 30
const DAY = 86_400_000
const ageDays = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / DAY)

function parsePounds(v?: string): number {
  const m = (v || '').match(/£\s*([\d.]+)\s*(k|m)?/i)
  if (!m) return 0
  const n = Number(m[1])
  return !isFinite(n) ? 0 : m[2]?.toLowerCase() === 'm' ? n * 1_000_000 : m[2]?.toLowerCase() === 'k' ? n * 1000 : n
}
const gbp = (n: number) => (n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}m` : n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`)

// Escalation gate: critical, account/relationship level, or unresolved 14+ days.
const needsHer = (s: Signal) =>
  s.type === 'risk' &&
  s.status !== 'actioned' && s.status !== 'dismissed' &&
  (s.severity === 'critical' || riskScope(s) === 'account' || ageDays(s.createdAt) >= 14)

const SEV_W: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 }
const SEV_COLOR: Record<Severity, string> = { critical: 'var(--risk)', high: 'var(--people)', medium: 'var(--muted)', low: 'var(--muted-2)' }

export function LeadershipHome({ onOpenAccount }: { onOpenAccount: (id: string) => void }) {
  const [days, setDays] = useState<Days>(7)

  const d = useMemo(() => {
    const cutoff = Date.now() - days * DAY
    const prevCutoff = Date.now() - 2 * days * DAY
    const inP = (iso: string) => Date.parse(iso) >= cutoff
    const inPrev = (iso: string) => { const t = Date.parse(iso); return t >= prevCutoff && t < cutoff }

    const period = allSignals.filter((s) => inP(s.createdAt))
    const risks = period.filter((s) => s.type === 'risk')
    const opps = period.filter((s) => s.type === 'opportunity')
    const periodCalls = calls.filter((c) => inP(c.date))
    const prevCalls = calls.filter((c) => inPrev(c.date))

    // Risks grouped PER ACCOUNT - one macro card each. Escalated accounts first.
    const riskMap = new Map<string, Signal[]>()
    for (const s of risks) { if (!riskMap.has(s.accountId)) riskMap.set(s.accountId, []); riskMap.get(s.accountId)!.push(s) }
    // Unresolved older risks join their account's card even if outside the window.
    for (const s of allSignals.filter(needsHer)) {
      if (!riskMap.has(s.accountId)) riskMap.set(s.accountId, [])
      if (!riskMap.get(s.accountId)!.some((x) => x.id === s.id)) riskMap.get(s.accountId)!.push(s)
    }
    const riskCards = [...riskMap.entries()].map(([accountId, items]) => {
      const sorted = [...items].sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity] || b.createdAt.localeCompare(a.createdAt))
      const cats = [...new Set(items.map((s) => s.riskCategory || s.subtype).filter(Boolean))] as string[]
      const callIds = new Set(items.map((s) => s.callId ?? s.sourceCall.title))
      return {
        accountId,
        items: sorted,
        gated: items.some(needsHer),
        critical: items.filter((s) => s.severity === 'critical').length,
        oldest: Math.max(...items.map((s) => ageDays(s.createdAt))),
        cats,
        callCount: callIds.size,
      }
    }).sort((a, b) => Number(b.gated) - Number(a.gated) || SEV_W[b.items[0].severity] - SEV_W[a.items[0].severity])

    // Trajectories computed from the data (the radar automation adds transcript-level ones).
    const warnings: { text: string; accountId?: string }[] = []
    const perAcctTheme = new Map<string, number>()
    for (const s of risks) {
      const k = `${s.accountId}|${s.riskCategory || s.subtype || 'risk'}`
      perAcctTheme.set(k, (perAcctTheme.get(k) || 0) + 1)
    }
    for (const [k, n] of perAcctTheme) {
      if (n >= 2) {
        const [acc, theme] = k.split('|')
        warnings.push({ text: `"${theme}" has come up ${n} times on ${accountName(acc)} in ${days} days - a pattern forming, not a one-off.`, accountId: acc })
      }
    }
    const activeNow = new Set(periodCalls.map((c) => c.accountId))
    for (const c of prevCalls) {
      if (c.accountId && !activeNow.has(c.accountId) && !warnings.some((w) => w.accountId === c.accountId)) {
        warnings.push({ text: `${accountName(c.accountId)} has gone quiet - active in the previous period, no calls in the last ${days} days.`, accountId: c.accountId })
      }
    }
    const oppPrev = allSignals.filter((s) => s.type === 'opportunity' && inPrev(s.createdAt)).length
    if (opps.length >= 2 && opps.length > oppPrev) {
      const hot = [...new Set(opps.map((s) => s.accountId))].map((id) => accountName(id)).slice(0, 2).join(' and ')
      warnings.push({ text: `Opportunity chatter is accelerating (${oppPrev} → ${opps.length} period on period), gathering around ${hot}.` })
    }

    // Opportunities per account - same macro card treatment.
    const oppMap = new Map<string, Signal[]>()
    for (const s of opps) { if (!oppMap.has(s.accountId)) oppMap.set(s.accountId, []); oppMap.get(s.accountId)!.push(s) }
    const oppCards = [...oppMap.entries()].map(([accountId, items]) => ({
      accountId,
      items: [...items].sort((a, b) => (b.networksTotal ?? 0) - (a.networksTotal ?? 0)),
      value: items.reduce((t, s) => t + parsePounds(s.value), 0),
      topScore: Math.max(0, ...items.map((s) => s.networksTotal ?? 0)),
    })).sort((a, b) => b.value - a.value || b.items.length - a.items.length)

    return {
      period, opps, periodCalls, riskCards, oppCards, warnings: warnings.slice(0, 3),
      riskCount: risks.length,
      attentionCount: allSignals.filter(needsHer).length,
      oppValue: opps.reduce((t, s) => t + parsePounds(s.value), 0),
      accountsActive: new Set(periodCalls.map((c) => c.accountId).filter(Boolean)).size,
    }
  }, [days])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold tracking-tight">The portfolio, zoomed out</h3>
          <p className="mt-0.5 text-[13px] text-muted">Everything the Second Brain heard, accumulated for a managing director. Nothing day-to-day.</p>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-[12px] font-semibold">
          {([7, 14, 30] as Days[]).map((v) => (
            <button key={v} onClick={() => setDays(v)} className={`rounded-md px-3 py-1.5 transition-colors ${days === v ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text'}`}>
              {v === 7 ? 'This week' : `${v} days`}
            </button>
          ))}
        </div>
      </div>

      <TnaiBrief onOpenAccount={onOpenAccount} fallback={{ calls: d.periodCalls.length, accounts: d.accountsActive, attention: d.attentionCount, opps: d.opps.length, days }} />

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Building2} label="Accounts active" value={`${d.accountsActive}`} sub={`of ${accounts.length} in the brain`} />
        <Stat icon={Radio} label="Calls analysed" value={`${d.periodCalls.length}`} sub={`${d.period.length} signals extracted`} color="var(--accent)" />
        <Stat icon={AlertTriangle} label="Needs attention" value={`${d.attentionCount}`} sub="past the escalation bar" color={d.attentionCount ? 'var(--risk)' : undefined} />
        <Stat icon={TrendingUp} label="Opportunities" value={`${d.opps.length}`} sub={d.oppValue ? `${gbp(d.oppValue)} surfaced` : 'surfaced this period'} color="var(--opp)" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="eyebrow">Signal activity · recent weeks</div>
          <div className="mt-3 h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend()} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'var(--bg-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
                {(['opportunity', 'risk', 'update', 'people'] as const).map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="s" fill={SIGNAL_META[k].color} isAnimationActive={false} radius={i === 3 ? [3, 3, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <DonutCard title="Risk mix" sub="by framework category, this period"
          data={(() => { const m = new Map<string, number>(); for (const s of d.riskCards.flatMap((c) => c.items)) { const k = s.riskCategory || s.subtype || 'Uncategorised'; m.set(k, (m.get(k) || 0) + 1) } return [...m.entries()].map(([name, value]) => ({ name, value })) })()}
          palette={['#D64545', '#E68A00', '#B4468E', '#7C5CFF', '#1F62C4', '#1A8B91']} />
        <DonutCard title="Portfolio health" sub="current RAG across accounts"
          data={(['red', 'amber', 'green'] as const).map((h) => ({ name: HEALTH_LABEL[h], value: accounts.filter((a) => a.health === h).length })).filter((x) => x.value > 0)}
          palette={[HEALTH_COLOR.red, HEALTH_COLOR.amber, HEALTH_COLOR.green]} />
      </div>

      {/* ── Risks: one detailed macro card per account ── */}
      <div className="mt-6">
        <div className="mb-2.5 flex items-center gap-2">
          <AlertTriangle size={15} className="text-[var(--risk)]" />
          <h3 className="text-[15px] font-semibold">Risks, by account</h3>
          <span className="text-[11.5px] text-muted-2">{d.riskCount} accumulated this period · accounts needing you come first</span>
        </div>
        {d.riskCards.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5 text-[13px] text-muted">
            <CheckCircle2 size={16} style={{ color: 'var(--opp)' }} /> No risks in this period, and nothing older left unresolved.
          </div>
        ) : (
          <div className="space-y-3">
            {d.riskCards.map((c) => <RiskAccountCard key={c.accountId} card={c} onOpenAccount={onOpenAccount} />)}
          </div>
        )}
      </div>

      {/* ── Potential risks: before they're formally risks ── */}
      <RadarSection computed={d.warnings} onOpenAccount={onOpenAccount} />

      {/* ── Opportunity heat ── */}
      <div className="mt-6">
        <div className="mb-2.5 flex items-center gap-2">
          <TrendingUp size={15} style={{ color: 'var(--opp)' }} />
          <h3 className="text-[15px] font-semibold">Opportunity heat</h3>
          <span className="text-[11.5px] text-muted-2">where the commercial energy is gathering</span>
        </div>
        {d.oppCards.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-5 text-center text-[12.5px] text-muted-2">No opportunities surfaced in this period.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {d.oppCards.map((c) => <OppAccountCard key={c.accountId} card={c} onOpenAccount={onOpenAccount} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── tnAI brief: parallel columns like the reference; account names live-linked ──
function TnaiBrief({ onOpenAccount, fallback }: { onOpenAccount: (id: string) => void; fallback: { calls: number; accounts: number; attention: number; opps: number; days: number } }) {
  const [brief, setBrief] = useState<ApiBrief | null>(null)
  const [checked, setChecked] = useState(false)
  useEffect(() => { let on = true; fetchBrief().then((b) => { if (on) { setBrief(b); setChecked(true) } }); return () => { on = false } }, [])

  const when = brief ? new Date(brief.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null
  const hasWatch = (brief?.content.watch_for?.length ?? 0) > 0
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-line" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 9%, var(--surface)), var(--surface) 55%)' }}>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: 'var(--accent)' }}><Sparkles size={16} /></span>
          <span className="text-[16px] font-bold tracking-tight"><span className="lowercase">tn</span><span style={{ color: 'var(--accent-d)' }}>AI</span></span>
          <span className="text-[12px] text-muted">· weekly brief{when ? ` · generated ${when}` : ''}</span>
          <span className="ml-auto rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-muted-2">reads every call, weekly report + HubSpot</span>
        </div>

        {brief ? (
          <div className={`mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 ${hasWatch ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            <BriefCol title="What's happening" items={splitSentences(brief.content.whats_happening)} dot="var(--accent)" onOpenAccount={onOpenAccount} />
            <BriefCol title="Why" items={splitSentences(brief.content.why)} dot="var(--muted-2)" onOpenAccount={onOpenAccount} />
            {hasWatch && <BriefCol title="Watch for" items={brief.content.watch_for!} dot="var(--people)" onOpenAccount={onOpenAccount} />}
            <BriefCol title="What needs you" dot="var(--risk)" onOpenAccount={onOpenAccount}
              items={brief.content.needs_you.length ? brief.content.needs_you : ['Nothing needs your intervention this week.']} />
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[13.5px] leading-relaxed text-text">
              Over the last {fallback.days} days the Second Brain analysed <b>{fallback.calls} call{fallback.calls !== 1 ? 's' : ''}</b> across <b>{fallback.accounts} account{fallback.accounts !== 1 ? 's' : ''}</b>,
              surfacing <b>{fallback.opps} opportunit{fallback.opps !== 1 ? 'ies' : 'y'}</b>{fallback.attention ? <> and <b style={{ color: 'var(--risk)' }}>{fallback.attention} escalation{fallback.attention !== 1 ? 's' : ''}</b> (below)</> : <> and nothing that needs your intervention</>}.
            </p>
            {checked && <p className="mt-2 text-[11.5px] text-muted-2">The full written brief generates every Monday at 07:50 - this is the live summary meanwhile.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

const splitSentences = (t: string) => t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 2)

function BriefCol({ title, items, dot, onOpenAccount }: { title: string; items: string[]; dot: string; onOpenAccount: (id: string) => void }) {
  return (
    <div>
      <div className="eyebrow" style={{ color: 'var(--accent-d)' }}>{title}</div>
      <ul className="mt-2 space-y-2">
        {items.map((x, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-text">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
            <span><Linkified text={x} onOpenAccount={onOpenAccount} /></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Account names inside text become live links (hover -> arrow -> the account).
function Linkified({ text, onOpenAccount }: { text: string; onOpenAccount: (id: string) => void }) {
  const parts = useMemo(() => {
    const names = accounts.filter((a) => a.name.length >= 3).sort((a, b) => b.name.length - a.name.length)
    if (!names.length) return [{ text }]
    const rx = new RegExp(`\\b(${names.map((a) => a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
    const out: { text: string; accountId?: string }[] = []
    let last = 0
    for (const m of text.matchAll(rx)) {
      if (m.index! > last) out.push({ text: text.slice(last, m.index) })
      const hit = names.find((a) => a.name.toLowerCase() === m[0].toLowerCase())
      out.push({ text: m[0], accountId: hit?.id })
      last = m.index! + m[0].length
    }
    if (last < text.length) out.push({ text: text.slice(last) })
    return out
  }, [text])
  return (
    <>
      {parts.map((p, i) =>
        p.accountId ? (
          <button key={i} onClick={() => onOpenAccount(p.accountId!)}
            className="group inline-flex items-baseline gap-0.5 font-semibold text-[var(--accent-d)] hover:underline">
            {p.text}
            <ArrowRight size={11} className="translate-y-[1px] opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

// ── The detailed risk macro card ──
type RiskCard = { accountId: string; items: Signal[]; gated: boolean; critical: number; oldest: number; cats: string[]; callCount: number }

function RiskAccountCard({ card, onOpenAccount }: { card: RiskCard; onOpenAccount: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const worst = card.items[0]
  const acc = accounts.find((a) => a.id === card.accountId)
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface" style={{ borderLeft: `3px solid ${card.gated ? 'var(--risk)' : SEV_COLOR[worst.severity]}` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-bg-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {acc && <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR[acc.health] }} />}
            <span className="text-[14.5px] font-bold">{accountName(card.accountId)}</span>
            {card.gated && <Chip color="var(--risk)">needs you</Chip>}
            {card.critical > 0 && <Chip color="var(--risk)">{card.critical} critical</Chip>}
            {card.oldest >= 14 && <Chip color="var(--people)">oldest {card.oldest}d unresolved</Chip>}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
            {card.items.length} risk{card.items.length !== 1 ? 's' : ''} across {card.callCount} call{card.callCount !== 1 ? 's' : ''}
            {card.cats.length ? <> · themes: <span className="font-medium text-text">{card.cats.join(', ')}</span></> : null}
            {' · '}headline: <span className="font-medium text-text">{worst.summary}</span>
          </p>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-line bg-surface-2 p-4">
          <div className="space-y-3">
            {card.items.map((s) => <RiskDetail key={s.id} s={s} />)}
          </div>
          <button onClick={() => onOpenAccount(card.accountId)} className="group mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent-d)] hover:underline">
            Open {accountName(card.accountId)} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// One risk inside the card: what it was, why it was flagged, the step - and the
// transcript snippets toggle that pulls the conversation around the moment.
function RiskDetail({ s }: { s: Signal }) {
  const [showSnips, setShowSnips] = useState(false)
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip color={SEV_COLOR[s.severity]}>{s.severity}</Chip>
        {s.riskCategory && <span className="rounded-full bg-bg-2 px-2 py-0.5 text-[10.5px] font-semibold text-muted">{s.riskCategory}</span>}
        <span className="ml-auto text-[11px] text-muted-2">{s.sourceCall.title} · {fmt(s.createdAt)}</span>
      </div>
      <p className="mt-2 text-[13.5px] font-semibold leading-snug text-text">{s.summary}</p>
      <p className="mt-1.5 border-l-2 pl-2.5 text-[12.5px] italic leading-relaxed text-muted" style={{ borderColor: SEV_COLOR[s.severity] }}>“{s.quote}”</p>
      {s.suggestedAction && (
        <p className="mt-2 text-[12.5px] leading-snug text-text"><span className="font-bold uppercase tracking-wide text-[10px] text-muted-2">The step · </span>{s.suggestedAction}</p>
      )}
      <button onClick={() => setShowSnips((v) => !v)} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-2 px-2.5 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-text">
        <MessageSquareQuote size={13} /> {showSnips ? 'Hide the conversation' : 'View transcript snippets'}
      </button>
      {showSnips && <Snippet signal={s} />}
    </div>
  )
}

// The conversation around the captured moment, fetched lazily from the call.
function Snippet({ signal }: { signal: Signal }) {
  const [state, setState] = useState<'loading' | 'ready' | 'none'>('loading')
  const [snip, setSnip] = useState<{ lines: { speaker: string; text: string }[]; hit: number } | null>(null)

  useEffect(() => {
    let on = true
    const call: Call | undefined = calls.find((c) => c.id === signal.callId) ?? calls.find((c) => c.signals.some((x) => x.id === signal.id))
    const build = (c: Call) => {
      const { lines } = transcriptWithMoments(c)
      const s = snippetAround(lines, signal.quote, 2)
      if (!on) return
      if (s) { setSnip(s); setState('ready') } else setState('none')
    }
    if (!call) { setState('none'); return }
    if (call.transcript || !/^[0-9a-f]{8}-/i.test(call.id)) { build(call); return }
    fetchTranscript(call.id)
      .then((r) => { if (r.transcript) call.transcript = r.transcript; build(call) })
      .catch(() => { if (on) setState('none') })
    return () => { on = false }
  }, [signal])

  if (state === 'loading') return <p className="mt-2 text-[11.5px] text-muted-2">Loading the conversation…</p>
  if (state === 'none' || !snip) return <p className="mt-2 text-[11.5px] text-muted-2">The exact moment couldn't be located in the stored transcript.</p>
  return (
    <div className="mt-2.5 space-y-1.5 rounded-lg bg-bg-2 p-3">
      {snip.lines.map((l, i) => (
        <div key={i} className={`rounded-md px-2.5 py-1.5 text-[12px] leading-relaxed ${i === snip.hit ? 'bg-surface font-medium text-text' : 'text-muted'}`}
          style={i === snip.hit ? { boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--risk) 30%, transparent)' } : undefined}>
          {l.speaker && <span className="font-semibold">{l.speaker}: </span>}{l.text}
        </div>
      ))}
    </div>
  )
}

// ── Opportunity macro card ──
type OppCard = { accountId: string; items: Signal[]; value: number; topScore: number }

function OppAccountCard({ card, onOpenAccount }: { card: OppCard; onOpenAccount: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface" style={{ borderLeft: '3px solid var(--opp)' }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-bg-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-bold">{accountName(card.accountId)}</span>
            <Chip color="var(--opp)">{card.items.length} opportunit{card.items.length !== 1 ? 'ies' : 'y'}</Chip>
            {card.value > 0 && <Chip color="var(--accent-d)">~{gbp(card.value)} mentioned</Chip>}
            {card.topScore > 0 && <Chip color="var(--muted)">best NETWORKS {card.topScore}/40</Chip>}
          </div>
          <p className="mt-1.5 truncate text-[12.5px] text-muted">{card.items[0].summary}</p>
        </div>
        <ChevronDown size={16} className={`shrink-0 text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-line bg-surface-2 p-4">
          <div className="space-y-3">
            {card.items.map((s) => (
              <div key={s.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {s.networksTotal != null && <Chip color="var(--opp)">NETWORKS {s.networksTotal}/40</Chip>}
                  {s.value && <Chip color="var(--accent-d)">{s.value}</Chip>}
                  <span className="ml-auto text-[11px] text-muted-2">{s.sourceCall.title} · {fmt(s.createdAt)}</span>
                </div>
                <p className="mt-2 text-[13.5px] font-semibold leading-snug text-text">{s.summary}</p>
                <p className="mt-1.5 border-l-2 pl-2.5 text-[12.5px] italic leading-relaxed text-muted" style={{ borderColor: 'var(--opp)' }}>“{s.quote}”</p>
                {s.suggestedAction && <p className="mt-2 text-[12.5px] leading-snug text-text"><span className="font-bold uppercase tracking-wide text-[10px] text-muted-2">The step · </span>{s.suggestedAction}</p>}
              </div>
            ))}
          </div>
          <button onClick={() => onOpenAccount(card.accountId)} className="group mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent-d)] hover:underline">
            Open {accountName(card.accountId)} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Potential risks: computed trajectories + the transcript-reading radar ──
type RadarItem = { account?: string; insight: string; quote?: string }

function RadarSection({ computed, onOpenAccount }: { computed: { text: string; accountId?: string }[]; onOpenAccount: (id: string) => void }) {
  const [radar, setRadar] = useState<RadarItem[]>([])
  useEffect(() => {
    let on = true
    fetchBrief('radar').then((b) => {
      if (!on || !b) return
      const items = (b.content as unknown as { items?: RadarItem[] }).items
      if (Array.isArray(items)) setRadar(items.slice(0, 5))
    })
    return () => { on = false }
  }, [])

  const accountIdFor = (name?: string) => (name ? accounts.find((a) => a.name.toLowerCase() === name.toLowerCase())?.id : undefined)
  if (radar.length === 0 && computed.length === 0) return null

  return (
    <div className="mt-6">
      <div className="mb-2.5 flex items-center gap-2">
        <Eye size={15} style={{ color: 'var(--people)' }} />
        <h3 className="text-[15px] font-semibold">Potential risks forming</h3>
        <span className="text-[11.5px] text-muted-2">read from the raw conversations, before anything is formally flagged</span>
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {radar.map((r, i) => {
          const accId = accountIdFor(r.account)
          return (
            <button key={`r${i}`} onClick={() => accId && onOpenAccount(accId)} disabled={!accId}
              className="group rounded-xl border border-line bg-surface p-3.5 text-left transition-colors enabled:hover:border-[var(--line-2)]"
              style={{ borderLeft: '3px solid var(--people)' }}>
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-[13px] leading-snug text-text">
                  {r.account && <span className="font-semibold">{r.account}: </span>}{r.insight}
                </span>
                {accId && <ArrowRight size={14} className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />}
              </div>
              {r.quote && <p className="mt-1.5 truncate text-[11.5px] italic text-muted-2">“{r.quote}”</p>}
            </button>
          )
        })}
        {computed.map((w, i) => (
          <button key={`c${i}`} onClick={() => w.accountId && onOpenAccount(w.accountId)} disabled={!w.accountId}
            className="group flex items-center gap-2 rounded-xl border border-line bg-surface p-3.5 text-left text-[13px] leading-snug text-text transition-colors enabled:hover:border-[var(--line-2)]"
            style={{ borderLeft: '3px solid var(--people)' }}>
            <span className="min-w-0 flex-1">{w.text}</span>
            {w.accountId && <ArrowRight size={14} className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chip({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {children}
    </span>
  )
}

function Stat({ icon: Icon, label, value, sub, color }: { icon: typeof Building2; label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2"><Icon size={15} style={{ color: color ?? 'var(--muted)' }} /><span className="eyebrow">{label}</span></div>
      <div className="mt-2 text-3xl font-bold" style={color ? { color } : undefined}>{value}</div>
      <div className="mt-0.5 text-[12px] text-muted">{sub}</div>
    </div>
  )
}

function DonutCard({ title, sub, data, palette }: { title: string; sub: string; data: { name: string; value: number }[]; palette: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="text-[11.5px] text-muted-2">{sub}</p>
      {data.length === 0 ? (
        <p className="py-10 text-center text-[12px] text-muted-2">Nothing in this period.</p>
      ) : (
        <div className="mt-2 flex items-center gap-4">
          <div className="h-[130px] w-[130px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={36} outerRadius={60} paddingAngle={2} isAnimationActive={false}>
                  {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} stroke="var(--surface)" />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 space-y-1.5">
            {data.map((x, i) => (
              <div key={x.name} className="flex items-center gap-2 text-[12px]">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: palette[i % palette.length] }} />
                <span className="truncate text-muted">{x.name}</span>
                <span className="font-semibold">{x.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
