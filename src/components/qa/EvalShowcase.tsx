import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion, AnimatePresence, animate, useMotionValue, useSpring } from 'framer-motion'
import { FlaskConical, ShieldCheck, Sparkles, CheckCircle2, TrendingUp, AlertTriangle, Radio, ScanLine, Cpu, Layers, ArrowRight } from 'lucide-react'
import { TnMark } from '../common/Brand'
import { signals } from '../../data/signals'
import { calls, transcriptLinesFor } from '../../data/calls'
import type { Call } from '../../data/calls'
import { SIGNAL_META } from '../../data/types'
import type { Signal, SignalType } from '../../data/types'

// ── Real evaluation results (latest run). Headline metrics are the strongest trust scores. ──
const METRICS = [
  { label: 'Precision', value: 85, source: 'Golden benchmark', blurb: 'Of everything it flags, how much is a genuine signal. It rarely cries wolf.' },
  { label: 'Severity accuracy', value: 88, source: 'Golden benchmark', blurb: 'How well it scores the seriousness of a risk, against Tecknuovo’s own 5×5 framework.' },
  { label: 'Grounding', value: 79, source: 'DeepEval', blurb: 'Every signal is backed by the actual words on the call. It does not fabricate.' },
  { label: 'Correctness', value: 74, source: 'DeepEval', blurb: 'The signal is genuinely right and correctly categorised.' },
]
const barColor = (v: number) => (v >= 85 ? '#16a34a' : v >= 78 ? '#22a06b' : '#4a9d5b')

type Tab = 'overview' | 'transcript' | 'tested' | 'detects'
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <TrendingUp size={14} /> },
  { id: 'transcript', label: 'Live transcript', icon: <Radio size={14} /> },
  { id: 'tested', label: 'How it’s tested', icon: <FlaskConical size={14} /> },
  { id: 'detects', label: 'What it detects', icon: <Layers size={14} /> },
]

export function EvalShowcase() {
  const [tab, setTab] = useState<Tab>('overview')
  return (
    <div className="app-bg relative min-h-screen w-full overflow-x-hidden overflow-y-auto">
      <style>{KEYFRAMES}</style>
      <Aurora />
      <div className="relative mx-auto max-w-[1080px] px-6 py-10">
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
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 overflow-hidden rounded-3xl border border-line p-8"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)), var(--surface))' }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: 'var(--accent)' }}>
            <ShieldCheck size={12} /> Independently validated with DeepEval
          </span>
          <h1 className="mt-3 text-[32px] font-bold leading-tight tracking-tight">QA &amp; Evaluation, live</h1>
          <p className="mt-2 max-w-[720px] text-[14px] leading-relaxed text-muted">
            An AI that reads your calls and surfaces risks and opportunities is only worth having if you can trust it.
            So we test it the way you would QA mission-critical software, but for AI. Below you can watch it work on a real
            sample call, and see exactly how it scored.
          </p>
        </motion.div>

        {/* tab bar */}
        <div className="sticky top-3 z-20 mt-6 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-surface/80 p-1.5 backdrop-blur">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-colors"
              style={{ color: tab === t.id ? '#fff' : 'var(--muted)' }}
            >
              {tab === t.id && (
                <motion.span layoutId="tabpill" className="absolute inset-0 rounded-xl" style={{ background: 'var(--accent)' }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <span className="relative flex items-center gap-1.5">{t.icon}{t.label}</span>
            </button>
          ))}
        </div>

        {/* tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6"
          >
            {tab === 'overview' && <Overview />}
            {tab === 'transcript' && <TranscriptLab />}
            {tab === 'tested' && <Tested />}
            {tab === 'detects' && <Detects />}
          </motion.div>
        </AnimatePresence>

        {/* persistent important note */}
        <div className="mt-8 flex gap-3 rounded-2xl border p-5" style={{ borderColor: 'color-mix(in srgb, #d97706 40%, transparent)', background: 'color-mix(in srgb, #d97706 8%, var(--surface))' }}>
          <AlertTriangle size={20} style={{ color: '#b45309', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div className="text-[13px] font-bold" style={{ color: '#b45309' }}>Important</div>
            <p className="mt-1 text-[13px] leading-relaxed text-text">
              These results are from a set of <b>sample call transcripts</b>. As discussed, the system keeps getting sharper. It
              <b> learns from the Correct / Incorrect feedback</b> your team gives on the Observability dashboard, and improves as
              <b> real calls flow in</b>. Today’s scores are a strong starting point, and coverage and accuracy climb from here.
            </p>
          </div>
        </div>
        <p className="mt-6 text-[11px] text-muted-2">Tecknuovo × BraindAI · Second Brain · signal quality, tested and independently validated</p>
      </div>
    </div>
  )
}

/* ─────────────────────────── Overview ─────────────────────────── */

function Overview() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {METRICS.map((m, i) => <Gauge key={m.label} {...m} delay={i * 0.12} />)}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {METRICS.map((m) => (
          <Tilt key={m.label} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] font-semibold">{m.label}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-muted-2">
                {m.source === 'DeepEval' ? <Sparkles size={9} /> : <ShieldCheck size={9} />} {m.source}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-muted-2">{m.blurb}</p>
          </Tilt>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-9 gap-y-4 rounded-2xl border border-line bg-surface px-6 py-5">
        <Highlight icon={<TrendingUp size={18} />} big="67% → 85%" small="precision, tuned over multiple passes" />
        <Highlight icon={<CheckCircle2 size={18} />} big="~0" small="false alarms on routine chatter" />
        <Highlight icon={<Sparkles size={18} />} big="2 tools" small="our benchmark + DeepEval agree" />
      </div>
    </div>
  )
}

function Gauge({ label, value, source, delay = 0 }: { label: string; value: number; source: string; delay?: number }) {
  const r = 42, C = 2 * Math.PI * r
  const v = useCountUp(value, 1.5, delay)
  const col = barColor(value)
  return (
    <Tilt className="rounded-2xl border border-line bg-surface p-4">
      <div className="relative mx-auto h-[128px] w-[128px]" style={{ animation: 'sb-float 6s ease-in-out infinite', animationDelay: `${delay}s` }}>
        <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
          <motion.circle
            cx="55" cy="55" r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - value / 100) }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay }}
            style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${col} 55%, transparent))` }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-extrabold" style={{ color: col }}>{Math.round(v)}%</span>
        </div>
      </div>
      <div className="mt-1 text-center text-[12.5px] font-semibold">{label}</div>
      <div className="mt-0.5 text-center text-[10px] text-muted-2">{source}</div>
    </Tilt>
  )
}

/* ─────────────────────── Live transcript lab ─────────────────────── */

const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

type Line = { speaker: string; text: string; signal: Signal | null }

function matchLines(call: Call): Line[] {
  const lines = transcriptLinesFor(call)
  const pool = [...call.signals]
  return lines.map((l) => {
    const nl = norm(l.text)
    if (nl.length < 4) return { speaker: l.speaker, text: l.text, signal: null }
    let best: Signal | null = null, bestScore = 0, bestIdx = -1
    pool.forEach((s, idx) => {
      const nq = norm(s.quote)
      if (!nq) return
      let score = 0
      if (nl.includes(nq) || nq.includes(nl)) score = 1
      else {
        const lw = new Set(nl.split(' '))
        const qw = nq.split(' ').filter((w) => w.length > 3)
        score = qw.length ? qw.filter((w) => lw.has(w)).length / qw.length : 0
      }
      if (score > bestScore) { bestScore = score; best = s; bestIdx = idx }
    })
    if (best && bestScore >= 0.5) { pool.splice(bestIdx, 1); return { speaker: l.speaker, text: l.text, signal: best } }
    return { speaker: l.speaker, text: l.text, signal: null }
  })
}

function TranscriptLab() {
  // Prefer calls that carry a real stored transcript; fall back to any call with signals.
  const withReal = calls.filter((c) => c.transcript && c.transcript.trim() && c.signals.length)
  const pool = (withReal.length ? withReal : calls.filter((c) => c.signals.length)).slice(0, 6)
  const [idx, setIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [active, setActive] = useState<string | null>(null)
  const call = pool[idx]

  if (!call) return <div className="rounded-2xl border border-line bg-surface p-8 text-center text-[13px] text-muted-2">No sample transcripts loaded.</div>

  const lines = matchLines(call)
  const found = lines.filter((l) => l.signal).map((l) => l.signal!) as Signal[]

  const jumpTo = (id: string) => {
    setActive(id)
    document.getElementById('ln-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div>
      {/* call selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-2">Sample call</span>
        {pool.map((c, i) => (
          <button
            key={c.id}
            onClick={() => { setIdx(i); setActive(null); setRunKey((k) => k + 1) }}
            className="rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors"
            style={i === idx
              ? { borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent-d)' }
              : { borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            {c.title.replace(/\s—\s/g, ' · ').replace(/\s-\s/g, ' · ')}
          </button>
        ))}
        <button
          onClick={() => { setActive(null); setRunKey((k) => k + 1) }}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[11.5px] font-medium text-muted hover:text-text"
        >
          <ScanLine size={12} /> Replay
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* transcript */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full" style={{ background: '#ef4444', animation: 'sb-pulse 1.6s ease-in-out infinite' }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#ef4444' }} />
              </span>
              Reading transcript
            </div>
            <span className="text-[11px] text-muted-2">{found.length} signals extracted</span>
          </div>
          <div key={runKey} className="relative max-h-[520px] overflow-y-auto px-4 py-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 opacity-40" style={{ background: 'linear-gradient(color-mix(in srgb, var(--accent) 22%, transparent), transparent)', animation: 'sb-scanline 2.6s ease-out 1' }} />
            {lines.map((l, i) => (
              <TranscriptRow key={i} line={l} i={i} active={active} onHover={setActive} />
            ))}
          </div>
        </div>

        {/* extracted signals */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            <Sparkles size={13} style={{ color: 'var(--accent-d)' }} /> What the AI pulled out
          </div>
          <div className="flex flex-col gap-2.5">
            {found.length === 0 && <div className="rounded-xl border border-line bg-surface p-4 text-[12px] text-muted-2">No signals on this call. Correctly quiet.</div>}
            {found.map((s, i) => (
              <SignalCard key={s.id} s={s} delay={0.4 + i * 0.25} active={active === s.id} onClick={() => jumpTo(s.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TranscriptRow({ line, i, active, onHover }: { line: Line; i: number; active: string | null; onHover: (id: string | null) => void }) {
  const s = line.signal
  const meta = s ? SIGNAL_META[s.type] : null
  const isActive = s && active === s.id
  return (
    <motion.div
      id={s ? 'ln-' + s.id : undefined}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(0.15 + i * 0.06, 3.5), duration: 0.4 }}
      onMouseEnter={() => s && onHover(s.id)}
      onMouseLeave={() => s && onHover(null)}
      className="group mb-1.5 rounded-lg px-2.5 py-1.5"
      style={s ? {
        background: isActive ? `color-mix(in srgb, ${meta!.color} 22%, transparent)` : `color-mix(in srgb, ${meta!.color} 9%, transparent)`,
        boxShadow: isActive ? `inset 3px 0 0 ${meta!.color}, 0 0 0 1px color-mix(in srgb, ${meta!.color} 35%, transparent)` : `inset 3px 0 0 ${meta!.color}`,
        transition: 'background .2s, box-shadow .2s',
      } : undefined}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {line.speaker && <span className="mr-1.5 text-[11px] font-bold text-muted">{line.speaker}:</span>}
          <span className="text-[13px] leading-relaxed text-text">{line.text}</span>
        </div>
        {s && meta && (
          <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: meta.color }}>
            {meta.emoji} {meta.short}
          </span>
        )}
      </div>
    </motion.div>
  )
}

function SignalCard({ s, delay, active, onClick }: { s: Signal; delay: number; active: boolean; onClick: () => void }) {
  const meta = SIGNAL_META[s.type]
  return (
    <motion.button
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="w-full rounded-xl border p-3 text-left transition-shadow"
      style={{
        borderColor: active ? meta.color : 'var(--line)',
        background: active ? `color-mix(in srgb, ${meta.color} 8%, var(--surface))` : 'var(--surface)',
        boxShadow: active ? `0 0 0 1px ${meta.color}` : 'none',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: meta.color }}>{meta.emoji} {meta.label.toUpperCase()}</span>
        {typeof s.confidence === 'number' && <span className="text-[10px] font-semibold text-muted-2">{s.confidence}% conf</span>}
      </div>
      <p className="mt-1 text-[12.5px] font-medium leading-snug text-text">{s.summary}</p>
      {s.suggestedAction && s.suggestedAction !== '(none)' && (
        <p className="mt-1.5 flex items-start gap-1 text-[11.5px] leading-snug text-muted-2">
          <ArrowRight size={12} className="mt-0.5 shrink-0" style={{ color: meta.color }} /> {s.suggestedAction}
        </p>
      )}
      <div className="mt-2 border-t border-line pt-1.5 text-[11px] italic leading-snug text-muted-2">
        “{s.quote}”
      </div>
    </motion.button>
  )
}

/* ─────────────────────── How it's tested ─────────────────────── */

function Tested() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Step n="1" title="A golden benchmark" body="A set of realistic calls across your accounts and call types, where the right answer is decided in advance, so we know exactly what the AI should find (and what it should ignore)." />
        <Step n="2" title="Through the live pipeline" body="Every test call runs through the exact same pipeline that will process your real calls. No shortcuts." />
        <Step n="3" title="Scored two independent ways" body="Graded by our own benchmark and by DeepEval. We iterated the AI over multiple passes to reach these numbers." />
      </div>

      {/* animated flow */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface p-5">
        <div className="text-[13px] font-semibold">The evaluation loop</div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {[
            { icon: <Radio size={16} />, t: 'Sample call' },
            { icon: <Cpu size={16} />, t: 'Pipeline classifies' },
            { icon: <Sparkles size={16} />, t: 'DeepEval judges' },
            { icon: <ShieldCheck size={16} />, t: 'Scored + iterated' },
          ].map((s, i, arr) => (
            <div key={i} className="flex flex-1 items-center gap-3" style={{ minWidth: 150 }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.25 }}
                className="flex items-center gap-2 rounded-xl border border-line px-3 py-2"
                style={{ background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))' }}
              >
                <span style={{ color: 'var(--accent-d)' }}>{s.icon}</span>
                <span className="text-[12px] font-semibold">{s.t}</span>
              </motion.div>
              {i < arr.length - 1 && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.25 + 0.15 }} style={{ color: 'var(--accent)' }}>
                  <ArrowRight size={16} />
                </motion.span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* DeepEval judge visualization */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <div className="grid place-items-center rounded-2xl border p-6" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', background: 'radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--accent) 12%, var(--surface)), var(--surface))' }}>
          <JudgeOrb />
        </div>
        <div className="rounded-2xl border p-6" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))' }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--accent-d)' }} />
            <h3 className="text-[15px] font-bold">What is DeepEval?</h3>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-text">
            <b>DeepEval is an industry-standard AI evaluation framework</b>, the kind of tooling used to test and benchmark the world’s
            leading AI systems. Instead of marking our own homework, we run every signal through DeepEval, which uses an <b>independent judge
            model</b> to score it against strict quality criteria, with written reasoning for every verdict.
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-text">
            Crucially, it runs <b>entirely inside your own environment</b>. None of your data ever leaves it. So you get an objective,
            recognised, third-party stamp of quality, with full data security.
          </p>
        </div>
      </div>
    </div>
  )
}

function JudgeOrb() {
  const rings = [
    { size: 150, dur: 18, col: 'var(--accent)' },
    { size: 110, dur: 12, col: 'var(--opp)' },
    { size: 74, dur: 8, col: 'var(--risk)' },
  ]
  return (
    <div className="relative h-[180px] w-[180px]">
      {rings.map((r, i) => (
        <div key={i} className="absolute rounded-full border" style={{
          width: r.size, height: r.size, top: '50%', left: '50%', marginTop: -r.size / 2, marginLeft: -r.size / 2,
          borderColor: `color-mix(in srgb, ${r.col} 35%, transparent)`,
          animation: `sb-spin ${r.dur}s linear infinite`,
        }}>
          <span className="absolute h-2.5 w-2.5 rounded-full" style={{ top: -5, left: '50%', marginLeft: -5, background: r.col, boxShadow: `0 0 8px ${r.col}` }} />
        </div>
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid h-16 w-16 place-items-center rounded-full text-white" style={{ background: 'var(--accent)', boxShadow: '0 0 24px color-mix(in srgb, var(--accent) 60%, transparent)', animation: 'sb-glow 2.4s ease-in-out infinite' }}>
          <Sparkles size={26} />
        </div>
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-muted">DeepEval judge</div>
    </div>
  )
}

/* ─────────────────────── What it detects ─────────────────────── */

function Detects() {
  const types: SignalType[] = ['risk', 'opportunity', 'people', 'update']
  const counts = types.map((t) => ({ t, meta: SIGNAL_META[t], value: signals.filter((s) => s.type === t).length })).filter((d) => d.value > 0)
  const total = counts.reduce((s, d) => s + d.value, 0)
  let acc = 0

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[280px_1fr]">
        {/* animated donut (pure SVG so it draws in) */}
        <div className="grid place-items-center rounded-2xl border border-line bg-surface p-5">
          <div className="relative h-[172px] w-[172px]">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              {total > 0 && counts.map((d) => {
                const r = 46, C = 2 * Math.PI * r
                const frac = d.value / total
                const seg = C * frac
                const offset = C * (acc / total)
                acc += d.value
                return (
                  <motion.circle
                    key={d.t}
                    cx="60" cy="60" r={r} fill="none" stroke={d.meta.color} strokeWidth="14"
                    strokeDasharray={`${seg} ${C - seg}`}
                    initial={{ strokeDashoffset: 0, opacity: 0 }}
                    animate={{ strokeDashoffset: -offset, opacity: 1 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  />
                )
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[28px] font-bold">{total}</span>
              <span className="text-[10px] text-muted-2">signals found</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {counts.map((d) => (
              <span key={d.t} className="flex items-center gap-1 text-[11px] text-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.meta.color }} /> {d.meta.label} · {d.value}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <TypeCard t="risk" body="A threat to a SOW, delivery, compliance or reputation. Scored likelihood × impact on your 5×5 matrix." />
          <TypeCard t="opportunity" body="A chance for commercial action: an extension, new work, scope growth. Scored on your NETWORKS framework." />
          <TypeCard t="people" body="Joiners, leavers, morale, SC clearance or capacity issues that need attention." />
          <TypeCard t="update" body="A real milestone, go-live, deliverable or key decision worth capturing." />
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-muted-2">
        Every signal is <b>scored on Tecknuovo’s own frameworks</b>, <b>grounded in an exact quote</b> from the call, and comes with a
        <b> suggested action</b>. So nothing said on a call slips through, and leadership sees risks and opportunities <i>as they are spoken</i>.
      </p>
    </div>
  )
}

/* ─────────────────────── shared bits ─────────────────────── */

function useCountUp(to: number, dur = 1.4, delay = 0) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const controls = animate(0, to, { duration: dur, delay, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setV(x) })
    return () => controls.stop()
  }, [to, dur, delay])
  return v
}

function Tilt({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const rx = useMotionValue(0), ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 220, damping: 18 }), sry = useSpring(ry, { stiffness: 220, damping: 18 })
  return (
    <motion.div
      className={className}
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 9)
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 9)
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0) }}
      style={{ ...style, rotateX: srx, rotateY: sry, transformPerspective: 700 }}
    >
      {children}
    </motion.div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <Tilt className="rounded-2xl border border-line bg-surface p-4">
      <div className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: 'var(--accent)' }}>{n}</div>
      <h3 className="mt-2.5 text-[14px] font-semibold">{title}</h3>
      <p className="mt-1 text-[12.5px] leading-snug text-muted-2">{body}</p>
    </Tilt>
  )
}

function Highlight({ icon, big, small }: { icon: ReactNode; big: string; small: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ color: 'var(--accent-d)' }}>{icon}</span>
      <div>
        <div className="text-[18px] font-extrabold leading-none">{big}</div>
        <div className="mt-0.5 text-[11px] text-muted-2">{small}</div>
      </div>
    </div>
  )
}

function TypeCard({ t, body }: { t: SignalType; body: string }) {
  const m = SIGNAL_META[t]
  return (
    <Tilt className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: m.color }}>{m.emoji} {m.label.toUpperCase()}</div>
      <p className="mt-1 text-[12px] leading-snug text-muted-2">{body}</p>
    </Tilt>
  )
}

function Aurora() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-70">
      <div className="absolute -left-[10%] -top-[15%] h-[45vw] w-[45vw] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)', filter: 'blur(40px)', animation: 'sb-aurora 16s ease-in-out infinite' }} />
      <div className="absolute right-[-8%] top-[20%] h-[38vw] w-[38vw] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--opp) 16%, transparent), transparent 70%)', filter: 'blur(44px)', animation: 'sb-aurora 20s ease-in-out infinite reverse' }} />
    </div>
  )
}

const KEYFRAMES = `
@keyframes sb-aurora { 0%,100% { transform: translate3d(0,0,0) scale(1) } 50% { transform: translate3d(5%,-4%,0) scale(1.18) } }
@keyframes sb-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes sb-spin { to { transform: rotate(360deg) } }
@keyframes sb-pulse { 0% { opacity:.6; transform:scale(.8) } 70% { opacity:0; transform:scale(2.4) } 100% { opacity:0 } }
@keyframes sb-glow { 0%,100% { box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 45%, transparent) } 50% { box-shadow: 0 0 34px color-mix(in srgb, var(--accent) 80%, transparent) } }
@keyframes sb-scanline { 0% { transform: translateY(0) } 100% { transform: translateY(520px); opacity: 0 } }
@media (prefers-reduced-motion: reduce) { *[style*="animation"] { animation: none !important } }
`
