// Katie's home: the week zoomed out, for a MANAGING DIRECTOR.
// Rules of this page: no individual day-to-day signals, ever - only accumulations,
// patterns and trajectories. Account names are live links (hover -> arrow -> the
// account). Detail always exists one click away; it is never the default.
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Sparkles, AlertTriangle, TrendingUp, Radio, Building2, ChevronDown, Eye, CheckCircle2, ArrowRight } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { signals as allSignals, riskScope } from '../../data/signals'
import { calls } from '../../data/calls'
import { accounts, accountName } from '../../data/org'
import { weeklyTrend } from '../../data/trends'
import { fetchBrief } from '../../data/api'
import type { ApiBrief } from '../../data/api'
import type { Signal, Severity } from '../../data/types'
import { SIGNAL_META, HEALTH_COLOR, HEALTH_LABEL } from '../../data/types'

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

// The escalation gate: critical, account/relationship level, or flagged 14+ days
// ago and still not actioned. Everything else never reaches this page.
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

    // Escalations, ROLLED UP PER ACCOUNT - never shown as individual signal rows.
    const attention = allSignals.filter(needsHer)
    const attnMap = new Map<string, Signal[]>()
    for (const s of attention) { if (!attnMap.has(s.accountId)) attnMap.set(s.accountId, []); attnMap.get(s.accountId)!.push(s) }
    const attnRows = [...attnMap.entries()].map(([accountId, items]) => {
      const worst = [...items].sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity])[0]
      const oldest = Math.max(...items.map((s) => ageDays(s.createdAt)))
      return { accountId, count: items.length, worst, oldest, critical: items.filter((s) => s.severity === 'critical').length }
    }).sort((a, b) => SEV_W[b.worst.severity] - SEV_W[a.worst.severity] || b.oldest - a.oldest)

    // Risk themes: the period's risks accumulated by framework category.
    const themeMap = new Map<string, Signal[]>()
    for (const s of risks) {
      const key = s.riskCategory || s.subtype || 'Uncategorised'
      if (!themeMap.has(key)) themeMap.set(key, [])
      themeMap.get(key)!.push(s)
    }
    const themes = [...themeMap.entries()]
      .map(([name, items]) => ({ name, items, accounts: [...new Set(items.map((s) => s.accountId))] }))
      .sort((a, b) => Math.max(...b.items.map((s) => SEV_W[s.severity])) - Math.max(...a.items.map((s) => SEV_W[s.severity])) || b.items.length - a.items.length)

    // Potential risks: trajectories caught BEFORE they're formally big.
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

    // Opportunities, rolled up per account.
    const oppMap = new Map<string, Signal[]>()
    for (const s of opps) { if (!oppMap.has(s.accountId)) oppMap.set(s.accountId, []); oppMap.get(s.accountId)!.push(s) }
    const oppRows = [...oppMap.entries()].map(([accountId, items]) => ({
      accountId,
      count: items.length,
      value: items.reduce((t, s) => t + parsePounds(s.value), 0),
      topScore: Math.max(0, ...items.map((s) => s.networksTotal ?? 0)),
    })).sort((a, b) => b.value - a.value || b.count - a.count)

    return {
      period, risks, opps, periodCalls, attnRows, themes, warnings: warnings.slice(0, 4), oppRows,
      attentionCount: attention.length,
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

      {/* numbers, then the shape of the period - visuals up top */}
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
          data={d.themes.map((t) => ({ name: t.name, value: t.items.length }))} palette={['#D64545', '#E68A00', '#B4468E', '#7C5CFF', '#1F62C4', '#1A8B91']} />
        <DonutCard title="Portfolio health" sub="current RAG across accounts"
          data={(['red', 'amber', 'green'] as const).map((h) => ({ name: HEALTH_LABEL[h], value: accounts.filter((a) => a.health === h).length })).filter((x) => x.value > 0)}
          palette={[HEALTH_COLOR.red, HEALTH_COLOR.amber, HEALTH_COLOR.green]} />
      </div>

      {/* needs her - per ACCOUNT, never per signal */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle size={15} className="text-[var(--risk)]" />
          <h3 className="text-[15px] font-semibold">Needs your attention</h3>
          <span className="text-[11.5px] text-muted-2">critical · account-level · unresolved 14+ days</span>
        </div>
        {d.attnRows.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5 text-[13px] text-muted">
            <CheckCircle2 size={16} style={{ color: 'var(--opp)' }} /> Nothing needs your intervention right now. Everything flagged is being handled at delivery or partner level.
          </div>
        ) : (
          <div className="space-y-2">
            {d.attnRows.map((r) => (
              <button key={r.accountId} onClick={() => onOpenAccount(r.accountId)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--line-2)]"
                style={{ borderLeft: '3px solid var(--risk)' }}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold">{accountName(r.accountId)}</span>
                    {r.critical > 0 && <Chip color="var(--risk)">{r.critical} critical</Chip>}
                    <Chip color="var(--muted)">{r.count} open escalation{r.count !== 1 ? 's' : ''}</Chip>
                    {r.oldest >= 14 && <Chip color="var(--people)">oldest {r.oldest}d unresolved</Chip>}
                  </div>
                  <p className="mt-1 truncate text-[12.5px] text-muted">{r.worst.summary}</p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* potential risks - before they're formally risks */}
      {d.warnings.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <Eye size={15} style={{ color: 'var(--people)' }} />
            <h3 className="text-[15px] font-semibold">Potential risks forming</h3>
            <span className="text-[11.5px] text-muted-2">trajectories the brain is watching - not formally flagged yet</span>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {d.warnings.map((w, i) => (
              <button key={i} onClick={() => w.accountId && onOpenAccount(w.accountId)} disabled={!w.accountId}
                className="group flex items-center gap-2 rounded-xl border border-line bg-surface p-3.5 text-left text-[13px] leading-snug text-text transition-colors enabled:hover:border-[var(--line-2)]"
                style={{ borderLeft: '3px solid var(--people)' }}>
                <span className="min-w-0 flex-1">{w.text}</span>
                {w.accountId && <ArrowRight size={14} className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* risk themes - accumulated; expansion stays macro (one line per moment, links to the account) */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">Risk themes</h3>
            <span className="text-[11.5px] text-muted-2">{d.risks.length} risk{d.risks.length !== 1 ? 's' : ''} accumulated · grouped by framework category</span>
          </div>
          {d.themes.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-5 text-center text-[12.5px] text-muted-2">No risks flagged in this period.</p>
          ) : (
            <div className="space-y-2">{d.themes.map((t) => <ThemeCard key={t.name} name={t.name} items={t.items} accountIds={t.accounts} onOpenAccount={onOpenAccount} />)}</div>
          )}
        </div>

        {/* opportunity heat - per account */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">Opportunity heat</h3>
            <span className="text-[11.5px] text-muted-2">where the commercial energy is gathering</span>
          </div>
          {d.oppRows.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-5 text-center text-[12.5px] text-muted-2">No opportunities surfaced in this period.</p>
          ) : (
            <div className="space-y-2">
              {d.oppRows.map((r) => (
                <button key={r.accountId} onClick={() => onOpenAccount(r.accountId)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--line-2)]"
                  style={{ borderLeft: '3px solid var(--opp)' }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-bold">{accountName(r.accountId)}</span>
                      <Chip color="var(--opp)">{r.count} opportunit{r.count !== 1 ? 'ies' : 'y'}</Chip>
                      {r.value > 0 && <Chip color="var(--accent-d)">~{gbp(r.value)} mentioned</Chip>}
                      {r.topScore > 0 && <Chip color="var(--muted)">best NETWORKS {r.topScore}/40</Chip>}
                    </div>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── tnAI brief: her analyst. Ivy-style compact bullets; account names inside the
// text are live - hover shows the arrow, click opens the account. ──
function TnaiBrief({ onOpenAccount, fallback }: { onOpenAccount: (id: string) => void; fallback: { calls: number; accounts: number; attention: number; opps: number; days: number } }) {
  const [brief, setBrief] = useState<ApiBrief | null>(null)
  const [checked, setChecked] = useState(false)
  useEffect(() => { let on = true; fetchBrief().then((b) => { if (on) { setBrief(b); setChecked(true) } }); return () => { on = false } }, [])

  const when = brief ? new Date(brief.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null
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
          <div className="mt-3.5 space-y-3">
            <BriefBullets title="What's happening" items={splitSentences(brief.content.whats_happening)} dot="var(--accent)" onOpenAccount={onOpenAccount} />
            <BriefBullets title="Why" items={splitSentences(brief.content.why)} dot="var(--muted-2)" onOpenAccount={onOpenAccount} />
            {(brief.content.watch_for?.length ?? 0) > 0 && (
              <BriefBullets title="Watch for" items={brief.content.watch_for!} dot="var(--people)" onOpenAccount={onOpenAccount} />
            )}
            <BriefBullets title="What needs you" dot="var(--risk)" onOpenAccount={onOpenAccount}
              items={brief.content.needs_you.length ? brief.content.needs_you : ['Nothing needs your intervention this week.']} />
          </div>
        ) : (
          <div className="mt-3.5">
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

function BriefBullets({ title, items, dot, onOpenAccount }: { title: string; items: string[]; dot: string; onOpenAccount: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-1 lg:grid-cols-[130px_1fr]">
      <div className="eyebrow pt-1" style={{ color: 'var(--accent-d)' }}>{title}</div>
      <ul className="space-y-1.5">
        {items.map((x, i) => (
          <li key={i} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-text">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
            <span><Linkified text={x} onOpenAccount={onOpenAccount} /></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Turn account names inside brief text into live links (hover -> arrow -> account).
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

// Theme card: expansion stays MACRO - one line per accumulated moment, linking to
// the account. No triage cards, no feedback buttons, no forms on this page.
function ThemeCard({ name, items, accountIds, onOpenAccount }: { name: string; items: Signal[]; accountIds: string[]; onOpenAccount: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const worst = [...items].sort((a, b) => SEV_W[b.severity] - SEV_W[a.severity])[0].severity
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface" style={{ borderLeft: `3px solid ${SEV_COLOR[worst]}` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 p-3.5 text-left transition-colors hover:bg-bg-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold">{name}</span>
            <span className="rounded-full bg-bg-2 px-2 py-0.5 text-[10.5px] font-bold text-muted">{items.length}</span>
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-muted">{accountIds.map((id) => accountName(id)).join(' · ')}</div>
        </div>
        <ChevronDown size={15} className={`shrink-0 text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-line bg-surface-2 p-3">
          {items.map((s) => (
            <button key={s.id} onClick={() => onOpenAccount(s.accountId)}
              className="group flex w-full items-start gap-2 rounded-lg bg-surface px-3 py-2 text-left transition-colors hover:bg-bg-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEV_COLOR[s.severity] }} />
              <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-text">
                {s.summary} <span className="text-muted-2">· {accountName(s.accountId)}</span>
              </span>
              <ArrowRight size={13} className="mt-0.5 shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
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
