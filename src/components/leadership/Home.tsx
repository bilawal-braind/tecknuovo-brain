// Katie's home: the week zoomed out. tnAI brief on top, then accumulated macro
// insights - never a raw signal feed. Everything respects the period toggle
// (weekly by default; 14/30 days to zoom further out).
import { useEffect, useMemo, useState } from 'react'
import { Sparkles, AlertTriangle, TrendingUp, Radio, Building2, ChevronDown, Eye, CheckCircle2 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { signals as allSignals, riskScope } from '../../data/signals'
import { calls } from '../../data/calls'
import { accounts, accountName } from '../../data/org'
import { fetchBrief } from '../../data/api'
import type { ApiBrief } from '../../data/api'
import type { Signal } from '../../data/types'
import { SIGNAL_META, HEALTH_COLOR, HEALTH_LABEL } from '../../data/types'
import { TriageCard } from '../common/TriageCard'

type Days = 7 | 14 | 30
const DAY = 86_400_000
const ageDays = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / DAY)

// "£250k", "£1.15m account" -> pounds. Unparseable -> 0 (counted, not valued).
function parsePounds(v?: string): number {
  const m = (v || '').match(/£\s*([\d.]+)\s*(k|m)?/i)
  if (!m) return 0
  const n = Number(m[1])
  return !isFinite(n) ? 0 : m[2]?.toLowerCase() === 'm' ? n * 1_000_000 : m[2]?.toLowerCase() === 'k' ? n * 1000 : n
}
const gbp = (n: number) => (n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}m` : n >= 1000 ? `£${Math.round(n / 1000)}k` : `£${n}`)

// The escalation gate: what qualifies for the MD. Critical, account/relationship
// level, or flagged 14+ days ago and still not actioned (the system doesn't forget).
const needsHer = (s: Signal) =>
  s.type === 'risk' &&
  s.status !== 'actioned' && s.status !== 'dismissed' &&
  (s.severity === 'critical' || riskScope(s) === 'account' || ageDays(s.createdAt) >= 14)

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

    // Escalations: gated risks from the period PLUS anything older still unresolved.
    const attention = allSignals.filter(needsHer).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    // Macro risk themes: accumulate the period's risks by framework category.
    const themeMap = new Map<string, Signal[]>()
    for (const s of risks) {
      const key = s.riskCategory || s.subtype || 'Uncategorised'
      if (!themeMap.has(key)) themeMap.set(key, [])
      themeMap.get(key)!.push(s)
    }
    const sevW = { critical: 3, high: 2, medium: 1, low: 0 } as const
    const themes = [...themeMap.entries()]
      .map(([name, items]) => ({ name, items, accounts: [...new Set(items.map((s) => s.accountId))] }))
      .sort((a, b) => Math.max(...b.items.map((s) => sevW[s.severity])) - Math.max(...a.items.map((s) => sevW[s.severity])) || b.items.length - a.items.length)

    // Early warnings: trajectory, not fortune-telling.
    const warnings: { text: string; accountId?: string }[] = []
    const perAcctTheme = new Map<string, number>()
    for (const s of risks) {
      const k = `${s.accountId}|${s.riskCategory || s.subtype || 'risk'}`
      perAcctTheme.set(k, (perAcctTheme.get(k) || 0) + 1)
    }
    for (const [k, n] of perAcctTheme) {
      if (n >= 2) {
        const [acc, theme] = k.split('|')
        warnings.push({ text: `"${theme}" has come up ${n} times on ${accountName(acc)} in ${days} days - a pattern, not a one-off.`, accountId: acc })
      }
    }
    const activeNow = new Set(periodCalls.map((c) => c.accountId))
    for (const c of prevCalls) {
      if (!activeNow.has(c.accountId) && !warnings.some((w) => w.accountId === c.accountId)) {
        warnings.push({ text: `${accountName(c.accountId)} has gone quiet - calls in the previous period, none in the last ${days} days.`, accountId: c.accountId })
      }
    }
    const oppNow = opps.length
    const oppPrev = allSignals.filter((s) => s.type === 'opportunity' && inPrev(s.createdAt)).length
    if (oppNow >= 2 && oppNow > oppPrev) {
      const hot = [...new Set(opps.map((s) => s.accountId))].map((id) => accountName(id)).slice(0, 2).join(', ')
      warnings.push({ text: `Opportunity chatter is accelerating (${oppPrev} → ${oppNow}), gathering around ${hot}.` })
    }

    const oppValue = opps.reduce((t, s) => t + parsePounds(s.value), 0)
    const mostTalked = [...opps.reduce((m, s) => m.set(s.accountId, (m.get(s.accountId) || 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])[0]

    return {
      period, risks, opps, periodCalls, attention, themes, warnings: warnings.slice(0, 4), oppValue, mostTalked,
      accountsActive: new Set(periodCalls.map((c) => c.accountId)).size,
    }
  }, [days])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold tracking-tight">The portfolio, zoomed out</h3>
          <p className="mt-0.5 text-[13px] text-muted">Everything the Second Brain heard, rolled up for a managing director. Nothing day-to-day.</p>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-[12px] font-semibold">
          {([7, 14, 30] as Days[]).map((v) => (
            <button key={v} onClick={() => setDays(v)} className={`rounded-md px-3 py-1.5 transition-colors ${days === v ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-text'}`}>
              {v === 7 ? 'This week' : `${v} days`}
            </button>
          ))}
        </div>
      </div>

      <TnaiBrief fallback={{ calls: d.periodCalls.length, accounts: d.accountsActive, attention: d.attention.length, opps: d.opps.length, days }} />

      {/* the numbers strip */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Building2} label="Accounts active" value={`${d.accountsActive}`} sub={`of ${accounts.length} in the brain`} />
        <Stat icon={Radio} label="Calls analysed" value={`${d.periodCalls.length}`} sub={`${d.period.length} signals extracted`} color="var(--accent)" />
        <Stat icon={AlertTriangle} label="Needs attention" value={`${d.attention.length}`} sub="past the escalation bar" color={d.attention.length ? 'var(--risk)' : undefined} />
        <Stat icon={TrendingUp} label="Opportunities" value={`${d.opps.length}`} sub={d.oppValue ? `${gbp(d.oppValue)} surfaced` : 'surfaced this period'} color="var(--opp)" />
      </div>

      {/* what needs her - or an honest clean bill */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle size={15} className="text-[var(--risk)]" />
          <h3 className="text-[15px] font-semibold">Needs your attention</h3>
          <span className="text-[11.5px] text-muted-2">critical · account-level · unresolved 14+ days</span>
        </div>
        {d.attention.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5 text-[13px] text-muted">
            <CheckCircle2 size={16} style={{ color: 'var(--opp)' }} /> Nothing needs your intervention right now. Everything flagged is being handled at delivery or partner level.
          </div>
        ) : (
          <div className="space-y-2">
            {d.attention.map((s) => <TriageCard key={s.id} signal={s} showAccount onOpenAccount={onOpenAccount} />)}
          </div>
        )}
      </div>

      {/* early warnings */}
      {d.warnings.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <Eye size={15} style={{ color: 'var(--people)' }} />
            <h3 className="text-[15px] font-semibold">Early warnings</h3>
            <span className="text-[11.5px] text-muted-2">not big yet - trending that way</span>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {d.warnings.map((w, i) => (
              <button key={i} onClick={() => w.accountId && onOpenAccount(w.accountId)} disabled={!w.accountId}
                className="rounded-xl border border-line bg-surface p-3.5 text-left text-[13px] leading-snug text-text transition-colors enabled:hover:border-[var(--line-2)]"
                style={{ borderLeft: '3px solid var(--people)' }}>
                {w.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* macro risks by theme */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">Risk themes</h3>
            <span className="text-[11.5px] text-muted-2">{d.risks.length} risk{d.risks.length !== 1 ? 's' : ''} accumulated, grouped by framework category</span>
          </div>
          {d.themes.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-5 text-center text-[12.5px] text-muted-2">No risks flagged in this period.</p>
          ) : (
            <div className="space-y-2">{d.themes.map((t) => <ThemeCard key={t.name} name={t.name} items={t.items} accounts={t.accounts} onOpenAccount={onOpenAccount} />)}</div>
          )}
        </div>

        {/* macro opportunities */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">Opportunity heat</h3>
            <span className="text-[11.5px] text-muted-2">where the commercial energy is</span>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-2xl font-bold" style={{ color: 'var(--opp)' }}>{d.opps.length}</span>
              <span className="text-[12.5px] text-muted">surfaced{d.oppValue ? ` · ~${gbp(d.oppValue)} of value mentioned` : ''}</span>
              {d.mostTalked && d.mostTalked[1] > 1 && (
                <button onClick={() => onOpenAccount(d.mostTalked![0])} className="text-[12px] font-semibold text-[var(--accent-d)] hover:underline">
                  most talked about: {accountName(d.mostTalked[0])} ({d.mostTalked[1]}) →
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {[...d.opps].sort((a, b) => (b.networksTotal ?? 0) - (a.networksTotal ?? 0)).map((s) => (
                <TriageCard key={s.id} signal={s} showAccount onOpenAccount={onOpenAccount} />
              ))}
              {d.opps.length === 0 && <p className="py-4 text-center text-[12.5px] text-muted-2">No opportunities surfaced in this period.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* the shape of the period */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutCard title="Risk mix" sub="by framework category, this period"
          data={d.themes.map((t) => ({ name: t.name, value: t.items.length }))} palette={['#D64545', '#E68A00', '#B4468E', '#7C5CFF', '#1F62C4', '#1A8B91']} />
        <DonutCard title="Portfolio health" sub="current RAG across accounts"
          data={(['red', 'amber', 'green'] as const).map((h) => ({ name: HEALTH_LABEL[h], value: accounts.filter((a) => a.health === h).length })).filter((x) => x.value > 0)}
          palette={[HEALTH_COLOR.red, HEALTH_COLOR.amber, HEALTH_COLOR.green]} />
      </div>
    </div>
  )
}

// The hero: her analyst. Reads the stored Monday brief; until the first one exists
// it shows an honest deterministic summary so the card is never fake or broken.
function TnaiBrief({ fallback }: { fallback: { calls: number; accounts: number; attention: number; opps: number; days: number } }) {
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
          <span className="text-[12px] text-muted">· your weekly brief{when ? ` · generated ${when}` : ''}</span>
          <span className="ml-auto rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-muted-2">reads every call, weekly report + HubSpot</span>
        </div>

        {brief ? (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <BriefSection title="What's happening" text={brief.content.whats_happening} />
            <BriefSection title="Why" text={brief.content.why} />
            <div>
              <div className="eyebrow" style={{ color: 'var(--accent-d)' }}>What needs you</div>
              {brief.content.needs_you.length ? (
                <ul className="mt-1.5 space-y-1.5">
                  {brief.content.needs_you.map((x, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-text">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--risk)' }} />{x}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Nothing needs your intervention this week.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[13.5px] leading-relaxed text-text">
              Over the last {fallback.days} days the Second Brain analysed <b>{fallback.calls} call{fallback.calls !== 1 ? 's' : ''}</b> across <b>{fallback.accounts} account{fallback.accounts !== 1 ? 's' : ''}</b>,
              surfacing <b>{fallback.opps} opportunit{fallback.opps !== 1 ? 'ies' : 'y'}</b>{fallback.attention ? <> and <b style={{ color: 'var(--risk)' }}>{fallback.attention} item{fallback.attention !== 1 ? 's' : ''}</b> that pass the escalation bar (below)</> : <> and nothing that needs your intervention</>}.
            </p>
            {checked && <p className="mt-2 text-[11.5px] text-muted-2">The full written brief generates every Monday at 07:50 (workflow 13) - this is the live summary meanwhile.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function BriefSection({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ color: 'var(--accent-d)' }}>{title}</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-text">{text}</p>
    </div>
  )
}

function ThemeCard({ name, items, accounts: accIds, onOpenAccount }: { name: string; items: Signal[]; accounts: string[]; onOpenAccount: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const worst = items.some((s) => s.severity === 'critical') ? 'critical' : items.some((s) => s.severity === 'high') ? 'high' : 'medium'
  const color = worst === 'critical' ? 'var(--risk)' : worst === 'high' ? 'var(--people)' : 'var(--muted-2)'
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface" style={{ borderLeft: `3px solid ${color}` }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 p-3.5 text-left transition-colors hover:bg-bg-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold">{name}</span>
            <span className="rounded-full bg-bg-2 px-2 py-0.5 text-[10.5px] font-bold text-muted">{items.length}</span>
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-muted">{accIds.map((id) => accountName(id)).join(' · ')}</div>
        </div>
        <ChevronDown size={15} className={`shrink-0 text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-line bg-surface-2 p-3">
          {items.map((s) => <TriageCard key={s.id} signal={s} showAccount onOpenAccount={onOpenAccount} />)}
        </div>
      )}
    </div>
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
  if (!data.length) return null
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="text-[11.5px] text-muted-2">{sub}</p>
      <div className="mt-2 flex items-center gap-4">
        <div className="h-[150px] w-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2} isAnimationActive={false}>
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
    </div>
  )
}
