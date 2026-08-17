// The learning loop, made visible (Cormac, 17 Aug): who gave feedback, which
// accounts drew the most correction, the weekly wrong-rate curve, the exact
// lessons the brain wrote from it, and a guidance card so reviewers learn to
// teach well. Read-only over the feedback table + wf3's lesson summaries.
import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, Users, Building2, ListChecks, Lightbulb, MessageSquare } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { fetchLearning } from '../../data/api'
import type { Learning } from '../../data/api'
import { isLive } from '../../data/source'

const DEMO: Learning = {
  weekly: [
    { week: '28 Jul', total: 9, incorrect: 4, relabel: 1, with_reason: 3 },
    { week: '04 Aug', total: 22, incorrect: 7, relabel: 3, with_reason: 11 },
    { week: '11 Aug', total: 31, incorrect: 6, relabel: 4, with_reason: 19 },
  ],
  reviewers: [
    { name: 'Meesha Chotai', total: 24, with_reason: 15, correct: 9, incorrect: 11, relabel: 4 },
    { name: 'Kiera Battersby', total: 21, with_reason: 12, correct: 10, incorrect: 8, relabel: 3 },
    { name: 'Chloe Hollinshead', total: 17, with_reason: 6, correct: 8, incorrect: 8, relabel: 1 },
  ],
  accounts: [
    { name: 'HMRC', total: 18, incorrect: 8 },
    { name: 'Cabinet Office', total: 12, incorrect: 4 },
    { name: 'DEFRA', total: 9, incorrect: 3 },
    { name: 'DWP', total: 7, incorrect: 2 },
  ],
  recent: [
    { verdict: 'incorrect', correct_type: null, reason: 'SOW paperwork is not a risk', given_by: 'Meesha Chotai', created_at: '2026-08-13', account: 'HMRC', summary: 'Potential risk of overcharging or undercharging due to updates not feeding through.' },
    { verdict: 'relabel', correct_type: 'update', reason: 'This is a milestone, not a risk', given_by: 'Kiera Battersby', created_at: '2026-08-12', account: 'DEFRA', summary: 'Environment provisioning may block the next development phase.' },
  ],
  lessons: [
    { account: 'HMRC', summary: 'Routine SOW and PO paperwork chasers are administrative follow-ups, not delivery risks. Contract renewal signals only qualify as risks when a client stakeholder expresses doubt.', feedback_count: 18 },
    { account: 'Cabinet Office', summary: 'Recurring production issues already tracked by the team should merge into the existing signal rather than appearing as new risks each week.', feedback_count: 12 },
  ],
  totals: { total: 62, with_reason: 33, signals_reviewed: 58, signals_total: 456 },
}

export function LearningView() {
  const [data, setData] = useState<Learning | null>(isLive ? null : DEMO)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!isLive) return
    let on = true
    fetchLearning().then((d) => { if (on) setData(d) }).catch(() => { if (on) setFailed(true) })
    return () => { on = false }
  }, [])

  const weekly = useMemo(() => (data?.weekly ?? []).map((w) => ({
    ...w,
    wrongRate: w.total ? Math.round((100 * w.incorrect) / w.total) : 0,
  })), [data])

  if (failed) return <p className="mt-4 rounded-xl border border-line bg-surface p-6 text-center text-[12.5px] text-muted">Couldn't load the learning data - check the API connection.</p>
  if (!data) return <p className="mt-4 rounded-xl border border-line bg-surface p-6 text-center text-[12.5px] text-muted-2">Reading the feedback ledger...</p>

  const t = data.totals
  const coverage = t.signals_total ? Math.round((100 * t.signals_reviewed) / t.signals_total) : 0
  const reasonRate = t.total ? Math.round((100 * t.with_reason) / t.total) : 0

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[16px] font-bold tracking-tight">The learning loop</h3>
        <span className="text-[12.5px] text-muted-2">every piece of feedback, the lessons written from it, and the improvement it buys</span>
      </div>

      {/* headline numbers */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ListChecks} label="Feedback given" value={`${t.total}`} sub={`${t.signals_reviewed} signals reviewed`} />
        <Stat icon={GraduationCap} label="Coverage" value={`${coverage}%`} sub={`of ${t.signals_total} signals have a verdict`} />
        <Stat icon={MessageSquare} label="With a reason" value={`${reasonRate}%`} sub="reasons teach far more than bare clicks" />
        <Stat icon={Lightbulb} label="Lessons written" value={`${data.lessons.length}`} sub="live in the classifier on every new call" />
      </div>

      {/* the improvement curve + accounts */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <span className="eyebrow">Wrong-rate by week</span>
          <p className="mt-0.5 text-[11.5px] text-muted-2">share of reviewed signals marked incorrect - this is the improvement curve</p>
          <div className="mt-3 h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 4, right: 6, left: -26, bottom: 0 }}>
                <defs>
                  <linearGradient id="learn-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--risk)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--risk)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fontSize: 10, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 11.5 }} formatter={(v: number) => [`${v}%`, 'wrong-rate']} />
                <Area type="monotone" dataKey="wrongRate" stroke="var(--risk)" strokeWidth={2.25} fill="url(#learn-fill)" dot={{ r: 3, fill: 'var(--risk)', strokeWidth: 0 }} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <span className="eyebrow">Feedback by account</span>
          <p className="mt-0.5 text-[11.5px] text-muted-2">where the team is correcting the brain the most</p>
          <div className="mt-3 h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.accounts} margin={{ top: 4, right: 6, left: -26, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} interval={0} angle={-14} height={30} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 11.5 }} />
                <Bar dataKey="total" name="feedback" fill="var(--accent)" radius={[5, 5, 0, 0]} animationDuration={800} />
                <Bar dataKey="incorrect" name="marked incorrect" fill="var(--risk)" radius={[5, 5, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* lessons ledger - the proof of learning */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <Lightbulb size={15} style={{ color: 'var(--accent-d)' }} />
          <span className="text-[14px] font-semibold">What the brain has learned</span>
          <span className="text-[11px] text-muted-2">written by the learning loop from your feedback · injected into every future classification for that account</span>
        </div>
        {data.lessons.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-muted-2">No lessons yet - they appear as feedback accumulates.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {data.lessons.map((l) => (
              <div key={l.account} className="border-l-2 pl-4" style={{ borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--line))' }}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] font-bold">{l.account}</span>
                  <span className="text-[10.5px] text-muted-2">built from {l.feedback_count} piece{l.feedback_count !== 1 ? 's' : ''} of feedback</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-text">{l.summary}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* reviewers */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-muted" />
            <span className="text-[14px] font-semibold">The reviewers</span>
            <span className="text-[11px] text-muted-2">volume and teaching quality per person</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {data.reviewers.map((r) => {
              const q = r.total ? Math.round((100 * r.with_reason) / r.total) : 0
              return (
                <div key={r.name} className="flex items-center gap-3 rounded-xl bg-bg-2 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{r.name}</span>
                  <span className="num text-[11.5px] text-muted">{r.total} review{r.total !== 1 ? 's' : ''}</span>
                  <span className="num rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ color: q >= 50 ? 'var(--opp)' : 'var(--people)', background: `color-mix(in srgb, ${q >= 50 ? 'var(--opp)' : 'var(--people)'} 11%, transparent)` }}
                    title="Share of reviews that included a reason or relabel - the teaching quality">
                    {q}% with reasons
                  </span>
                </div>
              )
            })}
            {data.reviewers.length === 0 && <p className="text-[12.5px] text-muted-2">No reviews yet.</p>}
          </div>
        </div>

        {/* recent feedback stream */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-muted" />
            <span className="text-[14px] font-semibold">Latest feedback</span>
            <span className="text-[11px] text-muted-2">what people actually said</span>
          </div>
          <div className="mt-3 max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
            {data.recent.map((f, i) => (
              <div key={i} className="rounded-xl bg-bg-2 px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                  <span className="rounded-full px-1.5 py-px font-bold uppercase tracking-wide" style={{
                    color: f.verdict === 'correct' ? 'var(--opp)' : f.verdict === 'incorrect' ? 'var(--risk)' : 'var(--people)',
                    background: `color-mix(in srgb, ${f.verdict === 'correct' ? 'var(--opp)' : f.verdict === 'incorrect' ? 'var(--risk)' : 'var(--people)'} 11%, transparent)`,
                  }}>{f.verdict}{f.correct_type ? ` → ${f.correct_type}` : ''}</span>
                  <span className="font-semibold text-muted">{f.given_by}</span>
                  {f.account && <span className="text-muted-2">· {f.account}</span>}
                </div>
                {f.summary && <p className="mt-1 truncate text-[11.5px] text-muted" title={f.summary}>{f.summary}</p>}
                {f.reason && <p className="mt-0.5 text-[11.5px] font-medium text-text">"{f.reason}"</p>}
              </div>
            ))}
            {data.recent.length === 0 && <p className="text-[12.5px] text-muted-2">Nothing yet.</p>}
          </div>
        </div>
      </div>

      {/* how to teach the brain */}
      <div className="mt-4 rounded-2xl border p-5" style={{ borderColor: 'color-mix(in srgb, var(--accent) 25%, var(--line))', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 7%, var(--surface)), var(--surface) 60%)' }}>
        <span className="text-[13px] font-semibold">How to teach the brain well</span>
        <div className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-muted">
          <p><b className="text-text">A bare ✗</b> removes the signal and teaches a little - the brain has to guess why it was wrong.</p>
          <p><b className="text-text">✗ plus a reason chip</b> (or one typed sentence) teaches a lot - the why becomes a rule for future calls.</p>
          <p><b className="text-text">Relabel</b> when the catch was right but the type was wrong - that keeps the signal and corrects the category.</p>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2"><Icon size={14} className="text-muted" /><span className="eyebrow">{label}</span></div>
      <div className="metric-num mt-2" style={{ fontSize: 30, lineHeight: '32px' }}>{value}</div>
      <div className="mt-1 text-[11.5px] text-muted">{sub}</div>
    </div>
  )
}
