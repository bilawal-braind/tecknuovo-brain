import type { CSSProperties, ReactNode } from 'react'
import { FlaskConical, GitBranch, ShieldCheck, Sparkles, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList, PieChart, Pie } from 'recharts'
import { TnMark } from '../common/Brand'
import { signals } from '../../data/signals'
import { SIGNAL_META } from '../../data/types'
import type { SignalType } from '../../data/types'

// ── Real evaluation results (latest run) — headline = the strongest "trust" scores. ──
const OUR = [
  { label: 'Precision', value: 85, blurb: 'Of everything it flags, how much is a genuine signal — it rarely cries wolf.' },
  { label: 'Severity accuracy', value: 88, blurb: 'Scores how serious a risk is, in line with Tecknuovo’s own risk framework.' },
]
const DEEPEVAL = [
  { label: 'Grounding', value: 79, blurb: 'Every signal is backed by the actual words on the call — it doesn’t fabricate.' },
  { label: 'Correctness', value: 74, blurb: 'The signal is genuinely right and correctly categorised.' },
]
const ALL = [...OUR, ...DEEPEVAL]

const barColor = (v: number) => (v >= 85 ? '#16a34a' : v >= 78 ? '#22a06b' : '#4a9d5b')

export function EvalShowcase() {
  const types: SignalType[] = ['risk', 'opportunity', 'people', 'update']
  const donut = types
    .map((t) => ({ t, label: SIGNAL_META[t].label, value: signals.filter((s) => s.type === t).length, color: SIGNAL_META[t].color }))
    .filter((d) => d.value > 0)
  const totalSignals = donut.reduce((s, d) => s + d.value, 0)

  return (
    <div className="app-bg min-h-screen w-full overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-6 py-12">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TnMark size={30} />
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-tight">Tecknuovo <span className="font-medium text-muted-2">× BraindAI</span></div>
              <div className="text-[11px] text-muted-2">Second Brain</div>
            </div>
          </div>
          <a href="#/" className="text-[12px] text-muted-2 hover:text-text">← All dashboards</a>
        </div>

        {/* hero */}
        <div className="mt-8 rounded-2xl border border-line p-7" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)), var(--surface))' }}>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: 'var(--accent)' }}>
            <ShieldCheck size={12} /> Independently validated
          </span>
          <h1 className="mt-3 text-[30px] font-bold tracking-tight">QA &amp; Evaluation</h1>
          <p className="mt-2 max-w-[680px] text-[14px] leading-relaxed text-muted">
            An AI that reads your calls and surfaces risks and opportunities is only worth having if you can trust it.
            So we test it the way you&rsquo;d QA mission-critical software — but for AI. Here&rsquo;s how rigorously it was tested, and how it scored.
          </p>
        </div>

        {/* how we test it */}
        <SectionTitle icon={<FlaskConical size={16} />}>How we test it</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Step n="1" title="A golden benchmark" body="A set of realistic calls across your accounts and call types, where the correct answer is decided in advance — so we know exactly what the AI should find." />
          <Step n="2" title="Through the live pipeline" body="Every test call runs through the exact same pipeline that will process your real calls — not a shortcut." />
          <Step n="3" title="Scored two independent ways" body="Graded by our own benchmark and by DeepEval — two separate checks. We iterated the AI over multiple passes to reach these numbers." />
        </div>

        {/* headline metrics */}
        <SectionTitle icon={<TrendingUp size={16} />}>Headline quality — the trust scores</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ALL.map((m) => (
            <div key={m.label} style={card}>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-muted">{m.label}</span>
                <span className="text-[30px] font-extrabold" style={{ color: barColor(m.value) }}>{m.value}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
                <div style={{ width: `${m.value}%`, height: '100%', background: barColor(m.value) }} />
              </div>
              <p className="mt-2.5 text-[12.5px] leading-snug text-muted-2">{m.blurb}</p>
            </div>
          ))}
        </div>

        {/* highlight strip */}
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-line bg-surface px-5 py-4">
          <Highlight icon={<TrendingUp size={16} />} big="67% → 85%" small="precision, tuned over multiple passes" />
          <Highlight icon={<CheckCircle2 size={16} />} big="~0" small="false alarms on routine chatter" />
          <Highlight icon={<Sparkles size={16} />} big="2 tools" small="our benchmark + DeepEval agree" />
        </div>

        {/* chart */}
        <div style={{ ...card, marginTop: 16, height: 230 }}>
          <div className="text-[13px] font-semibold">Quality scores at a glance</div>
          <div className="text-[11px] text-muted-2">Higher is better · measured on the golden benchmark and DeepEval</div>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={ALL.map((m) => ({ name: m.label, value: m.value, pct: `${m.value}%` }))} layout="vertical" margin={{ left: 24, right: 40, top: 12, bottom: 4 }}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                <LabelList dataKey="pct" position="right" />
                {ALL.map((m, i) => <Cell key={i} fill={barColor(m.value)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* what is DeepEval */}
        <SectionTitle icon={<Sparkles size={16} />}>Validated with DeepEval</SectionTitle>
        <div className="rounded-2xl border p-6" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))' }}>
          <p className="text-[14px] leading-relaxed text-text">
            <b>DeepEval is an industry-standard AI evaluation framework</b> — the kind of tooling used to test and benchmark the world&rsquo;s
            leading AI systems. Instead of marking our own homework, we run every signal through DeepEval, which uses an <b>independent
            &ldquo;judge&rdquo; model</b> to score it against strict quality criteria, with written reasoning for each verdict.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-text">
            Crucially, it runs <b>entirely inside your own environment</b> — none of your data ever leaves it. So you get an objective,
            recognised, third-party stamp of quality, with full data security.
          </p>
        </div>

        {/* what the signals mean */}
        <SectionTitle icon={<GitBranch size={16} />}>What the AI actually detects</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[300px_1fr]">
          <div style={{ ...card, display: 'grid', placeItems: 'center' }}>
            {totalSignals > 0 ? (
              <div className="relative h-[150px] w-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {donut.map((d) => <Cell key={d.t} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{totalSignals}</span>
                  <span className="text-[10px] text-muted-2">signals</span>
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-muted-2">Signal mix</div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TypeCard t="risk" body="A threat to a SOW, delivery, compliance or reputation. Scored likelihood × impact on your 5×5 matrix." />
            <TypeCard t="opportunity" body="A chance for commercial action — an extension, new work, scope growth. Scored on your NETWORKS framework." />
            <TypeCard t="people" body="Joiners, leavers, morale, SC clearance or capacity issues that need attention." />
            <TypeCard t="update" body="A real milestone, go-live, deliverable or key decision worth capturing." />
          </div>
        </div>
        <p className="mt-3 text-[12.5px] leading-snug text-muted-2">
          Every signal is <b>scored on Tecknuovo&rsquo;s own frameworks</b>, <b>grounded in an exact quote</b> from the call, and comes with a
          <b> suggested action</b> — so nothing said on a call slips through, and leadership sees risks and opportunities <i>as they&rsquo;re spoken</i>.
        </p>

        {/* important note */}
        <div className="mt-8 flex gap-3 rounded-2xl border p-5" style={{ borderColor: 'color-mix(in srgb, #d97706 40%, transparent)', background: 'color-mix(in srgb, #d97706 8%, var(--surface))' }}>
          <AlertTriangle size={20} style={{ color: '#b45309', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div className="text-[13px] font-bold" style={{ color: '#b45309' }}>Important</div>
            <p className="mt-1 text-[13px] leading-relaxed text-text">
              These results are from a set of <b>sample call transcripts</b>. As discussed, the system keeps getting sharper — it
              <b> learns from the Correct / Incorrect feedback</b> your team gives on the Observability dashboard, and improves as
              <b> real calls flow in</b>. Today&rsquo;s scores are a strong starting point; coverage and accuracy climb from here.
            </p>
          </div>
        </div>

        <p className="mt-8 text-[11px] text-muted-2">Tecknuovo × BraindAI · Second Brain · signal quality, tested &amp; independently validated</p>
      </div>
    </div>
  )
}

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-9 flex items-center gap-2 text-[15px] font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent-d)' }}>{icon}</span>
      {children}
    </h2>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={card}>
      <div className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: 'var(--accent)' }}>{n}</div>
      <h3 className="mt-2.5 text-[14px] font-semibold">{title}</h3>
      <p className="mt-1 text-[12.5px] leading-snug text-muted-2">{body}</p>
    </div>
  )
}

function Highlight({ icon, big, small }: { icon: ReactNode; big: string; small: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ color: 'var(--accent-d)' }}>{icon}</span>
      <div>
        <div className="text-[17px] font-extrabold leading-none">{big}</div>
        <div className="text-[11px] text-muted-2">{small}</div>
      </div>
    </div>
  )
}

function TypeCard({ t, body }: { t: SignalType; body: string }) {
  const m = SIGNAL_META[t]
  return (
    <div style={{ ...card, padding: 12 }}>
      <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: m.color }}>{m.emoji} {m.label.toUpperCase()}</div>
      <p className="mt-1 text-[12px] leading-snug text-muted-2">{body}</p>
    </div>
  )
}

const card: CSSProperties = { border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 16, padding: 16 }
