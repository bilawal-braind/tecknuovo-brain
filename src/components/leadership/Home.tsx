// Katie's home: the week zoomed out, for a MANAGING DIRECTOR.
// tnAI brief (detailed prose, parallel columns, live account links) -> numbers ->
// charts -> "The week, account by account": one macro card per active account.
// Card face = generated headline. Expand = the in-depth tnAI story (wf15).
// "View the conversations" = a popup where the week's moments flow in as an
// animated chain of transcript snippets. No individual signal rows, ever.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, AlertTriangle, TrendingUp, Radio, Building2, ChevronDown, Eye, CheckCircle2, ArrowRight, Video, MessagesSquare, X } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { signals as allSignals, riskScope } from '../../data/signals'
import { calls, snippetAround, transcriptWithMoments } from '../../data/calls'
import type { Call, TranscriptLine } from '../../data/calls'
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

const needsHer = (s: Signal) =>
  s.type === 'risk' &&
  s.status !== 'actioned' && s.status !== 'dismissed' &&
  (s.severity === 'critical' || riskScope(s) === 'account' || ageDays(s.createdAt) >= 14)

const SEV_W: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 }
const SEV_COLOR: Record<Severity, string> = { critical: 'var(--risk)', high: 'var(--people)', medium: 'var(--muted)', low: 'var(--muted-2)' }

type Moment = {
  key: string
  quote: string
  color: string
  caption?: string
  step?: string
  callId?: string
  callTitle?: string
  date?: string
  accountId?: string
}

type Story = { account: string; headline: string; story: string }

export function LeadershipHome({ onOpenAccount }: { onOpenAccount: (id: string) => void }) {
  const [days, setDays] = useState<Days>(7)
  const [stories, setStories] = useState<Story[]>([])
  useEffect(() => {
    let on = true
    fetchBrief('stories').then((b) => {
      if (!on || !b) return
      const items = (b.content as unknown as { items?: Story[] }).items
      if (Array.isArray(items)) setStories(items)
    })
    return () => { on = false }
  }, [])

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

    // One card per account active this period (signals or gated older risks).
    const perAccount = new Map<string, Signal[]>()
    for (const s of [...risks, ...opps]) { if (!perAccount.has(s.accountId)) perAccount.set(s.accountId, []); perAccount.get(s.accountId)!.push(s) }
    for (const s of allSignals.filter(needsHer)) {
      if (!perAccount.has(s.accountId)) perAccount.set(s.accountId, [])
      if (!perAccount.get(s.accountId)!.some((x) => x.id === s.id)) perAccount.get(s.accountId)!.push(s)
    }
    const cards = [...perAccount.entries()].map(([accountId, items]) => {
      const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      const rk = items.filter((s) => s.type === 'risk')
      const op = items.filter((s) => s.type === 'opportunity')
      const cats = [...new Set(rk.map((s) => s.riskCategory || s.subtype).filter(Boolean))] as string[]
      const worstRisk = rk.length ? [...rk].sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity])[0] : null
      return {
        accountId, items: sorted, rk, op, cats,
        gated: items.some(needsHer),
        critical: rk.filter((s) => s.severity === 'critical').length,
        oldest: rk.length ? Math.max(...rk.map((s) => ageDays(s.createdAt))) : 0,
        value: op.reduce((t, s) => t + parsePounds(s.value), 0),
        callCount: new Set(items.map((s) => s.callId ?? s.sourceCall.title)).size,
        worstRisk,
      }
    }).sort((a, b) => Number(b.gated) - Number(a.gated) || (SEV_W[b.worstRisk?.severity ?? 'low'] - SEV_W[a.worstRisk?.severity ?? 'low']) || b.items.length - a.items.length)

    // Trajectories (computed); recurring themes carry evidence for the chains.
    const warnings: { text: string; accountId?: string; evidence?: Signal[] }[] = []
    const perAcctTheme = new Map<string, Signal[]>()
    for (const s of risks) {
      const k = `${s.accountId}|${s.riskCategory || s.subtype || 'risk'}`
      if (!perAcctTheme.has(k)) perAcctTheme.set(k, [])
      perAcctTheme.get(k)!.push(s)
    }
    for (const [k, sigs] of perAcctTheme) {
      if (sigs.length >= 2) {
        const [acc, theme] = k.split('|')
        warnings.push({ text: `"${theme}" has come up ${sigs.length} times on ${accountName(acc)} in ${days} days - a pattern forming, not a one-off.`, accountId: acc, evidence: sigs })
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
      warnings.push({ text: `Opportunity chatter is accelerating (${oppPrev} → ${opps.length} period on period), gathering around ${hot}.`, evidence: opps })
    }

    return {
      period, opps, periodCalls, cards, warnings: warnings.slice(0, 4),
      riskCount: risks.length,
      attentionCount: allSignals.filter(needsHer).length,
      oppValue: opps.reduce((t, s) => t + parsePounds(s.value), 0),
      accountsActive: new Set(periodCalls.map((c) => c.accountId).filter(Boolean)).size,
    }
  }, [days])

  const storyFor = (accountId: string) => stories.find((s) => s.account.toLowerCase() === accountName(accountId).toLowerCase())

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
          data={(() => { const m = new Map<string, number>(); for (const s of d.cards.flatMap((c) => c.rk)) { const k = s.riskCategory || s.subtype || 'Uncategorised'; m.set(k, (m.get(k) || 0) + 1) } return [...m.entries()].map(([name, value]) => ({ name, value })) })()}
          palette={['#D64545', '#E68A00', '#B4468E', '#7C5CFF', '#1F62C4', '#1A8B91']} />
        <DonutCard title="Portfolio health" sub="current RAG across accounts"
          data={(['red', 'amber', 'green'] as const).map((h) => ({ name: HEALTH_LABEL[h], value: accounts.filter((a) => a.health === h).length })).filter((x) => x.value > 0)}
          palette={[HEALTH_COLOR.red, HEALTH_COLOR.amber, HEALTH_COLOR.green]} />
      </div>

      {/* ── The week, account by account ── */}
      <div className="mt-6">
        <div className="mb-2.5 flex items-center gap-2">
          <h3 className="text-[15px] font-semibold">The week, account by account</h3>
          <span className="text-[11.5px] text-muted-2">tnAI's macro read per account · accounts needing you come first</span>
        </div>
        {d.cards.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5 text-[13px] text-muted">
            <CheckCircle2 size={16} style={{ color: 'var(--opp)' }} /> Nothing accumulated in this period.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {d.cards.map((c) => <AccountCard key={c.accountId} card={c} story={storyFor(c.accountId)} onOpenAccount={onOpenAccount} />)}
          </div>
        )}
      </div>

      <RadarSection computed={d.warnings} onOpenAccount={onOpenAccount} />
    </div>
  )
}

// ── tnAI brief ──
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
          <div className={`mt-4 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 ${hasWatch ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            <BriefCol title="What's happening" paragraphs={brief.content.whats_happening.split(/\n\n+/)} onOpenAccount={onOpenAccount} />
            <BriefCol title="Why" paragraphs={brief.content.why.split(/\n\n+/)} onOpenAccount={onOpenAccount} />
            {hasWatch && <BriefCol title="Watch for" paragraphs={brief.content.watch_for!} accent="var(--people)" onOpenAccount={onOpenAccount} />}
            <BriefCol title="What needs you" accent="var(--risk)" onOpenAccount={onOpenAccount}
              paragraphs={brief.content.needs_you.length ? brief.content.needs_you : ['Nothing needs your intervention this week.']} />
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[13.5px] leading-relaxed text-text">
              Over the last {fallback.days} days the Second Brain analysed <b>{fallback.calls} call{fallback.calls !== 1 ? 's' : ''}</b> across <b>{fallback.accounts} account{fallback.accounts !== 1 ? 's' : ''}</b>,
              surfacing <b>{fallback.opps} opportunit{fallback.opps !== 1 ? 'ies' : 'y'}</b>{fallback.attention ? <> and <b style={{ color: 'var(--risk)' }}>{fallback.attention} escalation{fallback.attention !== 1 ? 's' : ''}</b> (below)</> : <> and nothing that needs your intervention</>}.
            </p>
            {checked && <p className="mt-2 text-[11.5px] text-muted-2">The full written brief generates every Monday at 07:50 - run workflow 13 to generate one now.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function BriefCol({ title, paragraphs, accent, onOpenAccount }: { title: string; paragraphs: string[]; accent?: string; onOpenAccount: (id: string) => void }) {
  return (
    <div className="border-l-2 pl-3.5" style={{ borderColor: accent ?? 'color-mix(in srgb, var(--accent) 35%, transparent)' }}>
      <div className="eyebrow" style={{ color: accent ?? 'var(--accent-d)' }}>{title}</div>
      <div className="mt-1.5 space-y-2">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[13px] leading-relaxed text-text"><Linkified text={p} onOpenAccount={onOpenAccount} /></p>
        ))}
      </div>
    </div>
  )
}

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

// ── One account's macro card: headline on the face, tnAI story on expand,
//    "View the conversations" opens the animated snippet-chain popup. ──
type CardData = {
  accountId: string; items: Signal[]; rk: Signal[]; op: Signal[]; cats: string[]
  gated: boolean; critical: number; oldest: number; value: number; callCount: number
  worstRisk: Signal | null
}

function AccountCard({ card, story, onOpenAccount }: { card: CardData; story?: Story; onOpenAccount: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [convo, setConvo] = useState(false)
  const acc = accounts.find((a) => a.id === card.accountId)
  const accent = card.gated ? 'var(--risk)' : card.rk.length ? SEV_COLOR[card.worstRisk!.severity] : 'var(--opp)'

  const headline = story?.headline
    || `${card.rk.length ? `${card.rk.length} risk${card.rk.length !== 1 ? 's' : ''}` : ''}${card.rk.length && card.op.length ? ' and ' : ''}${card.op.length ? `${card.op.length} opportunit${card.op.length !== 1 ? 'ies' : 'y'}` : ''} across ${card.callCount} call${card.callCount !== 1 ? 's' : ''} this period${card.cats.length ? `, centred on ${card.cats.join(' and ').toLowerCase()}` : ''}.`

  const fallbackStory = [
    `${accountName(card.accountId)} generated ${card.items.length} signal${card.items.length !== 1 ? 's' : ''} across ${card.callCount} call${card.callCount !== 1 ? 's' : ''} this period.`,
    card.rk.length ? `On the risk side, the conversations kept returning to ${card.cats.length ? card.cats.join(' and ').toLowerCase() : 'delivery concerns'}${card.worstRisk ? ` - most seriously: ${card.worstRisk.summary}` : ''}${card.oldest >= 14 ? ` One item has now sat unresolved for ${card.oldest} days.` : ''}` : '',
    card.op.length ? `Commercially, ${card.op.length} opportunit${card.op.length !== 1 ? 'ies were' : 'y was'} surfaced${card.value ? ` with roughly ${gbp(card.value)} mentioned` : ''}.` : '',
    'Run workflow 15 for the full tnAI analysis of this account.',
  ].filter(Boolean).join(' ')

  const moments: Moment[] = card.items.map((s) => ({
    key: s.id, quote: s.quote,
    color: s.type === 'opportunity' ? 'var(--opp)' : SEV_COLOR[s.severity],
    caption: s.summary, step: s.suggestedAction,
    callId: s.callId, callTitle: s.sourceCall.title, date: s.createdAt, accountId: s.accountId,
  }))

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ borderTop: `3px solid ${accent}` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex-1 p-4 text-left transition-colors hover:bg-bg-2">
        <div className="flex flex-wrap items-center gap-2">
          {acc && <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR[acc.health] }} />}
          <span className="text-[15px] font-bold">{accountName(card.accountId)}</span>
          {card.gated && <Chip color="var(--risk)">needs you</Chip>}
          {card.critical > 0 && <Chip color="var(--risk)">{card.critical} critical</Chip>}
          {card.oldest >= 14 && <Chip color="var(--people)">{card.oldest}d unresolved</Chip>}
          {card.op.length > 0 && <Chip color="var(--opp)">{card.op.length} opp{card.op.length !== 1 ? 's' : ''}{card.value ? ` · ~${gbp(card.value)}` : ''}</Chip>}
          <ChevronDown size={15} className={`ml-auto shrink-0 text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-text">{headline}</p>
      </button>

      {open && (
        <div className="border-t border-line bg-surface-2 p-4">
          <div className="space-y-2.5">
            {(story?.story ?? fallbackStory).split(/\n\n+/).map((p, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-text">{p}</p>
            ))}
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button onClick={() => setConvo(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white transition-transform hover:scale-[1.02]" style={{ background: 'var(--accent)' }}>
              <MessagesSquare size={13} /> View the conversations
            </button>
            <button onClick={() => onOpenAccount(card.accountId)} className="group inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3.5 py-2 text-[12px] font-semibold text-muted transition-colors hover:text-text">
              Open {accountName(card.accountId)} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      )}

      {convo && <ConversationsModal accountId={card.accountId} moments={moments} onClose={() => setConvo(false)} />}
    </div>
  )
}

// The popup: the week's moments flowing in as an animated chain.
function ConversationsModal({ accountId, moments, onClose }: { accountId: string; moments: Moment[]; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight">The conversations · {accountName(accountId)}</h3>
            <p className="mt-0.5 text-[11.5px] text-muted">Every captured moment this period, in the flow of the actual calls - oldest first.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-2 transition-colors hover:text-text"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <SnippetChain moments={moments} animated />
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Evidence chain ──
function SnippetChain({ moments, animated = false }: { moments: Moment[]; animated?: boolean }) {
  return (
    <div className="relative mt-1 space-y-4 pl-5">
      <span className="absolute bottom-2 left-[7px] top-2 w-[2px] rounded-full bg-[var(--line-2)]" aria-hidden />
      {moments.map((m, i) => (
        <div key={m.key} className={animated ? 'chain-node' : undefined} style={animated ? { animationDelay: `${i * 140}ms` } : undefined}>
          <ChainNode m={m} />
        </div>
      ))}
    </div>
  )
}

function ChainNode({ m }: { m: Moment }) {
  const [snip, setSnip] = useState<{ lines: TranscriptLine[]; hit: number } | null | 'pending'>('pending')

  useEffect(() => {
    let on = true
    const done = (v: { lines: TranscriptLine[]; hit: number } | null) => { if (on) setSnip(v) }
    const cands: Call[] = m.callId
      ? calls.filter((c) => c.id === m.callId)
      : calls.filter((c) => c.accountId === m.accountId).slice(0, 4)
    if (!cands.length) { done(null); return }
    ;(async () => {
      for (const c of cands) {
        if (!c.transcript && /^[0-9a-f]{8}-/i.test(c.id)) {
          try { const r = await fetchTranscript(c.id); if (r.transcript) c.transcript = r.transcript } catch { /* try the next call */ }
        }
        if (!on) return
        const { lines } = transcriptWithMoments(c)
        const s = snippetAround(lines, m.quote, 2)
        if (s) { done(s); return }
      }
      done(null)
    })()
    return () => { on = false }
  }, [m])

  return (
    <div className="relative">
      <span className="absolute -left-[19px] top-3 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-[var(--surface-2)]" style={{ background: m.color }} aria-hidden />
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {(m.callTitle || m.date) && (
          <div className="flex items-center gap-2 border-b border-line px-3.5 py-2 text-[11px] text-muted-2">
            <Video size={11} /> {m.callTitle}{m.date ? ` · ${fmt(m.date)}` : ''}
          </div>
        )}
        <div className="p-3.5">
          {snip === 'pending' ? (
            <p className="text-[12px] text-muted-2">Pulling the conversation…</p>
          ) : snip ? (
            <div className="space-y-1">
              {snip.lines.map((l, i) => (
                <div key={i} className={`rounded-md px-2.5 py-1.5 text-[12.5px] leading-relaxed ${i === snip.hit ? 'font-medium text-text' : 'text-muted'}`}
                  style={i === snip.hit ? { background: `color-mix(in srgb, ${m.color} 8%, var(--surface))`, boxShadow: `inset 2px 0 0 ${m.color}` } : undefined}>
                  {l.speaker && <span className="font-semibold">{l.speaker}: </span>}{l.text}
                </div>
              ))}
            </div>
          ) : (
            <p className="border-l-2 pl-2.5 text-[12.5px] italic leading-relaxed text-muted" style={{ borderColor: m.color }}>“{m.quote}”</p>
          )}
          {m.caption && <p className="mt-2.5 text-[12px] font-medium leading-snug text-text">{m.caption}</p>}
          {m.step && <p className="mt-1 text-[11.5px] leading-snug text-muted"><span className="font-bold uppercase tracking-wide text-[9.5px] text-muted-2">The step · </span>{m.step}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Potential risks ──
type RadarItem = { account?: string; insight: string; quote?: string }

function RadarSection({ computed, onOpenAccount }: { computed: { text: string; accountId?: string; evidence?: Signal[] }[]; onOpenAccount: (id: string) => void }) {
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
      <div className="space-y-2">
        {radar.map((r, i) => {
          const accId = accountIdFor(r.account)
          return (
            <WatchCard key={`r${i}`} accountId={accId} onOpenAccount={onOpenAccount}
              text={<>{r.account && <span className="font-semibold">{r.account}: </span>}{r.insight}</>}
              moments={r.quote ? [{ key: `rq${i}`, quote: r.quote, color: 'var(--people)', accountId: accId, caption: 'Heard in conversation this week - not yet a formal risk.' }] : []}
            />
          )
        })}
        {computed.map((w, i) => (
          <WatchCard key={`c${i}`} accountId={w.accountId} onOpenAccount={onOpenAccount}
            text={<>{w.text}</>}
            moments={(w.evidence ?? []).map((s) => ({
              key: s.id, quote: s.quote, color: 'var(--people)',
              caption: s.summary, callId: s.callId, callTitle: s.sourceCall.title, date: s.createdAt, accountId: s.accountId,
            }))}
          />
        ))}
      </div>
    </div>
  )
}

function WatchCard({ text, moments, accountId, onOpenAccount }: { text: ReactNode; moments: Moment[]; accountId?: string; onOpenAccount: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const expandable = moments.length > 0
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface" style={{ borderLeft: '3px solid var(--people)' }}>
      <div className="flex items-center gap-2 p-3.5">
        <button onClick={() => expandable && setOpen((o) => !o)} className={`min-w-0 flex-1 text-left text-[13px] leading-snug text-text ${expandable ? '' : 'cursor-default'}`}>
          {text}
        </button>
        {accountId && (
          <button onClick={() => onOpenAccount(accountId)} title="Open the account" className="shrink-0 rounded-md p-1 text-muted-2 transition-colors hover:text-text">
            <ArrowRight size={14} />
          </button>
        )}
        {expandable && (
          <button onClick={() => setOpen((o) => !o)} aria-label="Show the conversation" className="shrink-0 rounded-md p-1 text-muted-2 transition-colors hover:text-text">
            <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {open && expandable && (
        <div className="border-t border-line bg-surface-2 p-4">
          <SnippetChain moments={moments} animated />
        </div>
      )}
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
