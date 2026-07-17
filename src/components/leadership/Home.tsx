// Katie's home: the week zoomed out, for a MANAGING DIRECTOR.
// tnAI brief (detailed prose, parallel columns, live account links) -> numbers ->
// charts -> "The week, account by account": one macro card per active account.
// Card face = generated headline. Expand = the in-depth tnAI story (wf15).
// "View the conversations" = a popup where the week's moments flow in as an
// animated chain of transcript snippets. No individual signal rows, ever.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, AlertTriangle, TrendingUp, Radio, Building2, ChevronDown, Eye, CheckCircle2, ArrowRight, Video, MessagesSquare, X, Activity } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { signals as allSignals, riskScope } from '../../data/signals'
import { calls, snippetAround, transcriptWithMoments } from '../../data/calls'
import type { Call, TranscriptLine } from '../../data/calls'
import { accounts, accountName } from '../../data/org'
import { weeklyTrend } from '../../data/trends'
import { fetchBrief, generateBrief, fetchTranscript } from '../../data/api'
import type { ApiBrief } from '../../data/api'
import type { Signal, Severity } from '../../data/types'
import { SIGNAL_META, HEALTH_COLOR, HEALTH_LABEL } from '../../data/types'
import { fmt } from '../common/SignalLayer'
import { InfoHint } from '../common/InfoHint'

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
  strict?: boolean   // verbatim match or nothing (radar evidence)
  context?: number   // conversation turns either side of the hit
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
    const cards = [...perAccount.entries()]
      .filter(([accountId]) => accountId && accounts.some((a) => a.id === accountId))
      .map(([accountId, items]) => {
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

      <TnaiBrief days={days} onOpenAccount={onOpenAccount} fallback={{ calls: d.periodCalls.length, accounts: d.accountsActive, attention: d.attentionCount, opps: d.opps.length, days }} />

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Building2} label="Accounts active" value={`${d.accountsActive}`} sub={`of ${accounts.length} in the brain`} />
        <Stat icon={Radio} label="Calls analysed" value={`${d.periodCalls.length}`} sub={`${d.period.length} signals extracted`} color="var(--accent)" />
        <Stat icon={AlertTriangle} label="Needs attention" value={`${d.attentionCount}`} sub="past the escalation bar" color={d.attentionCount ? 'var(--risk)' : undefined} />
        <Stat icon={TrendingUp} label="Opportunities" value={`${d.opps.length}`} sub={d.oppValue ? `${gbp(d.oppValue)} surfaced` : 'surfaced this period'} color="var(--opp)" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <span className="flex items-center gap-1.5"><div className="eyebrow">Signal activity · recent weeks</div><InfoHint text="What the brain pulled out of the calls each week, split by signal type. The mix matters more than the height: red growing faster than green is the trend to watch." /></span>
          <div className="mt-3 h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend()} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'var(--bg-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 12 }} />
                {(['opportunity', 'risk', 'update', 'people'] as const).map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="s" fill={SIGNAL_META[k].color} animationDuration={850} animationEasing="ease-out" radius={i === 3 ? [3, 3, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <DonutCard hint="What kind of risk the period produced. A cluster in one category (say, People & Key Person) is a pattern, not a coincidence." title="Risk mix" sub="by framework category, this period"
          data={(() => { const m = new Map<string, number>(); for (const s of d.cards.flatMap((c) => c.rk)) { const k = s.riskCategory || s.subtype || 'Uncategorised'; m.set(k, (m.get(k) || 0) + 1) } return [...m.entries()].map(([name, value]) => ({ name, value })) })()}
          palette={['#D64545', '#E68A00', '#B4468E', '#7C5CFF', '#1F62C4', '#1A8B91']} />
        <DonutCard hint="Every account by its current RAG state. The number to hold: how many are green this week versus last." title="Portfolio health" sub="current RAG across accounts"
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
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
            {d.cards.map((c) => <AccountCard key={c.accountId} card={c} story={storyFor(c.accountId)} onOpenAccount={onOpenAccount} />)}
          </div>
        )}
      </div>

      <RadarSection computed={d.warnings} onOpenAccount={onOpenAccount} />
    </div>
  )
}

// ── tnAI brief ──
function TnaiBrief({ days, onOpenAccount, fallback }: { days: Days; onOpenAccount: (id: string) => void; fallback: { calls: number; accounts: number; attention: number; opps: number; days: number } }) {
  const [brief, setBrief] = useState<ApiBrief | null>(null)
  const [checked, setChecked] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)

  // The toggle re-evaluates the brief: a fresh one for this window shows instantly;
  // otherwise workflow 13 regenerates it over exactly these days while we animate.
  useEffect(() => {
    let on = true
    setChecked(false)
    fetchBrief('leadership', days).then(async (b) => {
      if (!on) return
      const fresh = b && Date.now() - Date.parse(b.created_at) < 24 * 3600_000
      if (fresh) { setBrief(b); setChecked(true); return }
      if (b) setBrief(b) // show the stale one behind the scenes if generation fails
      setGenerating(true)
      // Debounce: someone flicking 7 -> 14 -> 30 must not stack three model calls
      // onto a tiny Azure OpenAI quota - only the window they settle on generates.
      await new Promise((r) => setTimeout(r, 700))
      if (!on) return
      const g = await generateBrief(days).catch(() => null)
      if (!on) return
      if (g) setBrief(g)
      setGenerating(false)
      setChecked(true)
    })
    return () => { on = false }
  }, [days])

  useEffect(() => {
    if (!generating) return
    const t = window.setInterval(() => setMsgIdx((i) => i + 1), 2600)
    return () => window.clearInterval(t)
  }, [generating])

  const GEN_MSGS = [
    `Re-reading the last ${days} days of calls…`,
    'Cross-checking the weekly reports…',
    'Weighing the open pipeline…',
    'Writing the brief…',
  ]

  const when = brief ? new Date(brief.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null
  const hasWatch = (brief?.content.watch_for?.length ?? 0) > 0
  const chain = brief?.content.accounts ?? []
  const teaser = brief ? brief.content.whats_happening.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') : ''
  return (
    <div className="mt-4 rounded-2xl border border-line" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 9%, var(--surface)), var(--surface) 55%)' }}>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: 'var(--accent)' }}><Sparkles size={16} /></span>
          <span className="text-[16px] font-bold tracking-tight"><span className="lowercase">tn</span><span style={{ color: 'var(--accent-d)' }}>AI</span></span>
          <span className="text-[12px] text-muted">· {days === 7 ? 'weekly brief' : `last ${days} days`}{when && !generating ? ` · generated ${when}` : ''}</span>
          <span className="ml-auto rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-muted-2">reads every call, weekly report + HubSpot</span>
        </div>

        {generating ? (
          <div className="mt-2 flex flex-col items-center gap-3 py-8">
            <span className="relative grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: 'var(--accent)' }}>
              <Sparkles size={22} className="animate-pulse" />
              <span className="absolute inset-0 animate-ping rounded-2xl" style={{ background: 'color-mix(in srgb, var(--accent) 25%, transparent)' }} aria-hidden />
            </span>
            <p className="text-[13.5px] font-semibold text-text">{GEN_MSGS[msgIdx % GEN_MSGS.length]}</p>
            <p className="text-[11px] text-muted-2">tnAI is re-evaluating the {days === 7 ? 'week' : `last ${days} days`} - usually under half a minute</p>
          </div>
        ) : brief && !expanded ? (
          <div className="mt-3.5">
            <p className="text-[13.5px] leading-relaxed text-text"><RichText text={teaser} onOpenAccount={onOpenAccount} /></p>
            <div className="mt-3 flex justify-center">
              <button onClick={() => setExpanded(true)}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2 text-[12px] font-semibold text-[var(--accent-d)] transition-all hover:scale-[1.03]"
                style={{ boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 20%, transparent)' }}>
                <Sparkles size={13} /> Read the full {days === 7 ? 'weekly brief' : `${days}-day brief`} <ChevronDown size={13} />
              </button>
            </div>
          </div>
        ) : brief ? (
          <>
            <div className="mt-4 max-w-[860px] space-y-3">
              {/* 1 · the headline: macro summary + the pattern behind it */}
              <section className="rounded-xl border p-4" style={{ borderColor: 'color-mix(in srgb, var(--accent) 28%, var(--line))', background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, var(--surface)), var(--surface) 70%)' }}>
                <SectionTag icon={Activity} color="var(--accent)">The headline</SectionTag>
                <RichBlocks text={brief.content.whats_happening} onOpenAccount={onOpenAccount} />
                {brief.content.why && (
                  <div className="mt-3 rounded-lg px-3.5 py-2.5" style={{ background: 'color-mix(in srgb, var(--update) 8%, var(--surface))', boxShadow: 'inset 2px 0 0 var(--update)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--update)' }}>The pattern behind it</span>
                    <RichBlocks text={brief.content.why} onOpenAccount={onOpenAccount} />
                  </div>
                )}
              </section>

              {/* 2 · one chain: each account's update, its own why beneath it, then the move */}
              {chain.length > 0 && (
                <section>
                  <SectionTag icon={Building2} color="var(--accent-d)">Account by account</SectionTag>
                  <div className="ml-1 mt-2.5 space-y-2.5 border-l-2 pl-4" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--line))' }}>
                    {chain.map((a) => {
                      const accId = accounts.find((x) => x.name.toLowerCase() === a.name.toLowerCase())?.id
                      return (
                        <div key={a.name} className="relative rounded-xl border border-line bg-surface p-4">
                          <span className="absolute -left-[23px] top-5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)]" style={{ background: 'var(--accent)' }} aria-hidden />
                          {accId ? (
                            <button onClick={() => onOpenAccount(accId)} className="group inline-flex items-center gap-1 text-[13.5px] font-bold text-[var(--accent-d)] hover:underline">
                              {a.name}<ArrowRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          ) : (
                            <span className="text-[13.5px] font-bold">{a.name}</span>
                          )}
                          <p className="mt-1 text-[13px] leading-relaxed text-text"><RichText text={a.update} accountId={accId} onOpenAccount={onOpenAccount} /></p>
                          {a.why && (
                            <div className="mt-2 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed" style={{ background: 'color-mix(in srgb, var(--update) 8%, var(--surface))', boxShadow: 'inset 2px 0 0 var(--update)' }}>
                              <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--update)' }}>Why</span>
                              <RichText text={a.why} accountId={accId} onOpenAccount={onOpenAccount} />
                            </div>
                          )}
                          {(a.actions?.length ?? 0) > 0 && a.actions!.map((act, i) => (
                            <div key={i} className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed">
                              <ArrowRight size={13} className="mt-[3px] shrink-0" style={{ color: 'var(--accent)' }} />
                              <span className="min-w-0 font-medium"><RichText text={act} accountId={accId} onOpenAccount={onOpenAccount} /></span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* 3 · watch for (when present) and what needs her */}
              {hasWatch && (
                <section className="rounded-xl border p-4" style={{ borderColor: 'color-mix(in srgb, var(--people) 30%, var(--line))', background: 'color-mix(in srgb, var(--people) 6%, var(--surface))' }}>
                  <SectionTag icon={Eye} color="var(--people)">Watch for</SectionTag>
                  <BulletList items={brief.content.watch_for!} color="var(--people)" onOpenAccount={onOpenAccount} />
                </section>
              )}
              <section className="rounded-xl border p-4" style={{ borderColor: 'color-mix(in srgb, var(--risk) 30%, var(--line))', background: 'color-mix(in srgb, var(--risk) 5%, var(--surface))' }}>
                <SectionTag icon={AlertTriangle} color="var(--risk)">What needs you</SectionTag>
                <BulletList items={brief.content.needs_you.length ? brief.content.needs_you : ['Nothing needs your intervention this period.']} color="var(--risk)" onOpenAccount={onOpenAccount} />
              </section>
            </div>
            <div className="mt-4 flex justify-center">
              <button onClick={() => setExpanded(false)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-1.5 text-[11.5px] font-semibold text-muted transition-colors hover:text-text">
                Collapse <ChevronDown size={12} className="rotate-180" />
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <p className="text-[13.5px] leading-relaxed text-text">
              Over the last {fallback.days} days the Second Brain analysed <b>{fallback.calls} call{fallback.calls !== 1 ? 's' : ''}</b> across <b>{fallback.accounts} account{fallback.accounts !== 1 ? 's' : ''}</b>,
              surfacing <b>{fallback.opps} opportunit{fallback.opps !== 1 ? 'ies' : 'y'}</b>{fallback.attention ? <> and <b style={{ color: 'var(--risk)' }}>{fallback.attention} escalation{fallback.attention !== 1 ? 's' : ''}</b> (below)</> : <> and nothing that needs your intervention</>}.
            </p>
            {checked && <p className="mt-2 text-[11.5px] text-muted-2">tnAI couldn't write the full brief just now - it will try again when you reopen this page or switch the period.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionTag({ icon: Icon, color, children }: { icon: typeof Activity; color: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <Icon size={13} style={{ color }} />
      </span>
      <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color }}>{children}</span>
    </div>
  )
}

// Prose from the model: paragraphs and "- " lines, each rendered rich.
function RichBlocks({ text, onOpenAccount, accountId }: { text: string; onOpenAccount: (id: string) => void; accountId?: string }) {
  const blocks = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  return (
    <div className="mt-2 space-y-2">
      {blocks.map((raw, i) => {
        const isBullet = /^[-•]\s+/.test(raw)
        const t = raw.replace(/^[-•]\s+/, '')
        return isBullet ? (
          <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-text">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} />
            <span className="min-w-0"><RichText text={t} accountId={accountId} onOpenAccount={onOpenAccount} /></span>
          </div>
        ) : (
          <p key={i} className="text-[13px] leading-relaxed text-text"><RichText text={t} accountId={accountId} onOpenAccount={onOpenAccount} /></p>
        )
      })}
    </div>
  )
}

function BulletList({ items, color, onOpenAccount }: { items: string[]; color: string; onOpenAccount: (id: string) => void }) {
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((t, i) => (
        <div key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-text">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="min-w-0"><RichText text={t} onOpenAccount={onOpenAccount} /></span>
        </div>
      ))}
    </div>
  )
}

// Rich prose: account names become live links (as before), and the words
// "risk(s)" / "opportunity(-ies)" become colour-coded terms - hover opens a mini
// card with the actual signals behind the wording, click jumps to the account.
function RichText({ text, onOpenAccount, accountId }: { text: string; onOpenAccount: (id: string) => void; accountId?: string }) {
  const parts = useMemo(() => {
    type Part = { text: string; accountId?: string; term?: 'risk' | 'opportunity'; termAccount?: string }
    const names = accounts.filter((a) => a.name.length >= 3).sort((a, b) => b.name.length - a.name.length)
    const segs: Part[] = []
    const rx = names.length ? new RegExp(`\\b(${names.map((a) => a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi') : null
    let last = 0
    if (rx) {
      for (const m of text.matchAll(rx)) {
        if (m.index! > last) segs.push({ text: text.slice(last, m.index) })
        const hit = names.find((a) => a.name.toLowerCase() === m[0].toLowerCase())
        segs.push({ text: m[0], accountId: hit?.id })
        last = m.index! + m[0].length
      }
    }
    if (last < text.length) segs.push({ text: text.slice(last) })
    const out: Part[] = []
    const termRx = /\b(risks?|opportunit(?:y|ies))\b/gi
    for (const seg of segs) {
      if (seg.accountId) { out.push(seg); continue }
      let l = 0
      for (const m of seg.text.matchAll(termRx)) {
        if (m.index! > l) out.push({ text: seg.text.slice(l, m.index) })
        out.push({ text: m[0], term: m[0].toLowerCase().startsWith('risk') ? 'risk' : 'opportunity' })
        l = m.index! + m[0].length
      }
      if (l < seg.text.length) out.push({ text: seg.text.slice(l) })
    }
    // Scope each term to the nearest account NAMED in this text (the account
    // mentioned before it, else the next one after) - "HMRC has seen a rise in
    // risks" hovers HMRC's risks, not the portfolio's freshest two.
    let prevAcc: string | undefined
    for (const p of out) { if (p.accountId) prevAcc = p.accountId; else if (p.term) p.termAccount = prevAcc }
    let nextAcc: string | undefined
    for (let i = out.length - 1; i >= 0; i--) { const p = out[i]; if (p.accountId) nextAcc = p.accountId; else if (p.term && !p.termAccount) p.termAccount = nextAcc }
    return out
  }, [text])
  return (
    <>
      {parts.map((p, i) =>
        p.accountId ? (
          <button key={i} onClick={() => onOpenAccount(p.accountId!)}
            className="group inline-flex items-baseline font-semibold text-[var(--accent-d)] hover:underline">
            {p.text}
            <ArrowRight size={11} className="w-0 translate-y-[1px] opacity-0 transition-all group-hover:ml-0.5 group-hover:w-[11px] group-hover:opacity-100" />
          </button>
        ) : p.term ? (
          <SignalTerm key={i} word={p.text} kind={p.term} accountId={p.termAccount ?? accountId} context={text} onOpenAccount={onOpenAccount} />
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}

// A colour-coded "risk"/"opportunity" mention. Hover: the freshest matching
// signals (scoped to the account when the prose sits inside an account block).
function SignalTerm({ word, kind, accountId, context, onOpenAccount }: { word: string; kind: 'risk' | 'opportunity'; accountId?: string; context?: string; onOpenAccount: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const items = useMemo(() => {
    const pool = allSignals.filter((sg) => sg.type === kind && (!accountId || sg.accountId === accountId))
    // Rank by overlap with the sentence the word sits in, so two "risk" mentions
    // in different bullets each surface the signals they're actually about.
    const ctxWords = new Set((context ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5))
    const score = (sg: Signal) => {
      let n = 0
      for (const w of new Set(`${sg.summary} ${sg.quote}`.toLowerCase().split(/[^a-z0-9]+/))) if (w.length >= 5 && ctxWords.has(w)) n++
      return n
    }
    return [...pool].sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt)).slice(0, 2)
  }, [kind, accountId, context])
  const color = kind === 'risk' ? 'var(--risk)' : 'var(--opp)'
  if (!items.length) return <span className="font-semibold" style={{ color }}>{word}</span>
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button onClick={() => onOpenAccount(accountId ?? items[0].accountId)}
        className="font-semibold underline decoration-dotted underline-offset-2" style={{ color, textDecorationColor: color }}>
        {word}
      </button>
      {open && (
        <span className="glass absolute left-0 top-full z-30 mt-1.5 block w-[290px] rounded-2xl border p-3.5 text-left"
          style={{ borderColor: `color-mix(in srgb, ${color} 35%, var(--line))`, boxShadow: `0 14px 44px -14px color-mix(in srgb, ${color} 50%, transparent), 0 2px 10px rgba(16,24,40,0.08)` }}>
          <span className="block text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
            {kind === 'risk' ? 'The risk behind this' : 'The opportunity behind this'}{accountId ? ` · ${accountName(accountId)}` : ''}
          </span>
          {items.map((sg) => (
            <span key={sg.id} className="mt-2 block text-[11.5px] font-normal leading-snug text-text">
              {sg.summary}
              {sg.quote && <span className="mt-0.5 block italic text-muted">“{sg.quote.length > 130 ? sg.quote.slice(0, 130) + '…' : sg.quote}”</span>}
            </span>
          ))}
          <span className="mt-2 block text-[10px] font-medium text-muted-2">Click the word to open the account</span>
        </span>
      )}
    </span>
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
    'tnAI writes its full analysis for this account with the next weekly brief.',
  ].filter(Boolean).join(' ')

  const moments: Moment[] = card.items.map((s) => ({
    key: s.id, quote: s.quote,
    color: s.type === 'opportunity' ? 'var(--opp)' : SEV_COLOR[s.severity],
    caption: s.summary, step: s.suggestedAction,
    callId: s.callId, callTitle: s.sourceCall.title, date: s.createdAt, accountId: s.accountId,
  }))

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ borderTop: `3px solid ${accent}` }}>
      <button onClick={() => setOpen((o) => !o)} className="min-h-[124px] flex-1 p-4 text-left transition-colors hover:bg-bg-2">
        <div className="flex flex-wrap items-center gap-2">
          {acc && <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_COLOR[acc.health] }} />}
          <span className="text-[15px] font-bold">{accountName(card.accountId)}</span>
          {card.gated && <Chip color="var(--risk)">needs you</Chip>}
          {card.critical > 0 && <Chip color="var(--risk)">{card.critical} critical</Chip>}
          {card.oldest >= 14 && <Chip color="var(--people)">{card.oldest}d unresolved</Chip>}
          {card.op.length > 0 && <Chip color="var(--opp)">{card.op.length} opp{card.op.length !== 1 ? 's' : ''}{card.value ? ` · ~${gbp(card.value)}` : ''}</Chip>}
          <ChevronDown size={15} className={`ml-auto shrink-0 text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-text">{headline}</p>
      </button>

      {open && (
        <div className="border-t border-line bg-surface-2 p-4">
          <div className="space-y-2.5">
            {(story?.story ?? fallbackStory).split(/\n\n+/).map((p, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-text"><RichText text={p} accountId={card.accountId} onOpenAccount={onOpenAccount} /></p>
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

      {convo && <ConversationsModal title={`The conversations · ${accountName(card.accountId)}`} moments={moments} onClose={() => setConvo(false)} />}
    </div>
  )
}

// The popup: the week's moments flowing in as an animated chain.
function ConversationsModal({ title, moments, onClose }: { title: string; moments: Moment[]; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
            <p className="mt-0.5 text-[11.5px] text-muted">The captured moments, in the flow of the actual calls - oldest first.</p>
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
        const s = snippetAround(lines, m.quote, m.context ?? 2, m.strict ?? false)
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
            <div className="rounded-lg px-3.5 py-3" style={{ background: `color-mix(in srgb, ${m.color} 6%, var(--surface))`, boxShadow: `inset 2px 0 0 ${m.color}` }}>
              <p className="text-[13px] italic leading-relaxed text-text">“{m.quote}”</p>
              <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-2">Verbatim from this week's calls</p>
            </div>
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
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {radar.map((r, i) => {
          const accId = accountIdFor(r.account)
          return (
            <WatchCard key={`r${i}`} accountId={accId} onOpenAccount={onOpenAccount}
              text={<>{r.account && <span className="font-semibold">{r.account}: </span>}{r.insight}</>}
              moments={r.quote ? [{ key: `rq${i}`, quote: r.quote, color: 'var(--people)', accountId: accId, caption: 'Heard in conversation this week - not yet a formal risk.', strict: true, context: 1 }] : []}
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
  const [convo, setConvo] = useState(false)
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ borderTop: '3px solid var(--people)' }}>
      <div className="flex-1 p-4">
        <p className="text-[13px] leading-relaxed text-text">{text}</p>
      </div>
      <div className="flex items-center gap-3 border-t border-line bg-surface-2 px-4 py-2.5">
        {moments.length > 0 && (
          <button onClick={() => setConvo(true)} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--accent-d)] hover:underline">
            <MessagesSquare size={12} /> View the conversation
          </button>
        )}
        {accountId && (
          <button onClick={() => onOpenAccount(accountId)} className="group ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-muted transition-colors hover:text-text">
            Open account <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
      {convo && <ConversationsModal title="Potential risk · the conversation" moments={moments} onClose={() => setConvo(false)} />}
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
      <div className="mt-2 text-3xl font-bold">{value}</div>
      <div className="mt-0.5 text-[12px] text-muted">{sub}</div>
    </div>
  )
}

function DonutCard({ title, sub, data, palette, hint }: { title: string; sub: string; data: { name: string; value: number }[]; palette: string[]; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <span className="flex items-center gap-1.5"><h3 className="text-[15px] font-semibold">{title}</h3>{hint && <InfoHint text={hint} />}</span>
      <p className="text-[11.5px] text-muted-2">{sub}</p>
      {data.length === 0 ? (
        <p className="py-10 text-center text-[12px] text-muted-2">Nothing in this period.</p>
      ) : (
        <div className="mt-2 flex items-center gap-4">
          <div className="h-[130px] w-[130px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={36} outerRadius={60} paddingAngle={2} animationDuration={850} animationEasing="ease-out">
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
