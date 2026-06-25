import { useState } from 'react'
import { Gauge, ClipboardCheck, TrendingUp, TrendingDown, Minus, Check, X, RefreshCw } from 'lucide-react'
import { DashboardShell } from '../shell/DashboardShell'
import { observabilityChecks, reviewItems } from '../../data/observability'
import type { ObservabilityCheck, Trend, SignalType } from '../../data/types'
import { SIGNAL_META } from '../../data/types'
import { accountName } from '../../data/org'
import { SignalBadge, ConfidenceBar } from '../common/primitives'
import { fmt } from '../common/SignalLayer'

type View = 'checks' | 'review'
type Verdict = { kind: 'correct' | 'incorrect' | 'relabel'; newType?: SignalType; note?: string }
const TYPES: SignalType[] = ['opportunity', 'risk', 'update', 'people']

export function Observability() {
  const [view, setView] = useState<View>('checks')
  const [sel, setSel] = useState<ObservabilityCheck>(observabilityChecks[2])
  const [feedback, setFeedback] = useState<Record<string, Verdict>>({})
  const [relabeling, setRelabeling] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})

  const avg = Math.round(observabilityChecks.reduce((s, c) => s + c.score, 0) / observabilityChecks.length)
  const below = observabilityChecks.filter((c) => c.score < c.target).length
  const reviewed = Object.keys(feedback).length

  const submit = (id: string, kind: Verdict['kind'], newType?: SignalType) => {
    setFeedback((p) => ({ ...p, [id]: { kind, newType, note: note[id] } }))
    setRelabeling(null)
  }

  return (
    <DashboardShell
      role="Observability" persona="Meesha Chotai · Portfolio Director" active={view} onSelect={(v) => setView(v as View)}
      sections={[
        { id: 'checks', label: 'Quality checks', icon: Gauge, count: observabilityChecks.length },
        { id: 'review', label: 'Review & feedback', icon: ClipboardCheck, count: reviewItems.length - reviewed },
      ]}
    >
      <div className="px-7 py-6">
        {view === 'checks' && (
          <>
            <h3 className="text-[15px] font-semibold">Quality checks</h3>
            <p className="mt-0.5 text-[13px] text-muted">How accurate the AI is across every area it covers - signals, account risk, routing, resourcing, extensions and sales. Overall <b className="text-text">{avg}%</b> · {below} below target. Click a row to open its card.</p>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="overflow-hidden rounded-2xl border border-line bg-surface lg:col-span-2">
                <table className="w-full text-[13px]">
                  <thead><tr className="border-b border-line text-left">
                    <th className="px-4 py-2.5 eyebrow">Check</th><th className="px-4 py-2.5 eyebrow">Input</th><th className="px-4 py-2.5 eyebrow">Output</th><th className="px-4 py-2.5 eyebrow text-right">Score</th><th className="px-4 py-2.5 eyebrow text-right">Audit</th>
                  </tr></thead>
                  <tbody>
                    {observabilityChecks.map((c) => {
                      const ok = c.score >= c.target
                      const active = sel.id === c.id
                      return (
                        <tr key={c.id} onClick={() => setSel(c)} className={`cursor-pointer border-b border-line transition-colors last:border-0 ${active ? 'bg-bg-2' : 'hover:bg-bg-2'}`}>
                          <td className="px-4 py-3 font-semibold">{c.check}</td>
                          <td className="px-4 py-3 text-muted">{c.input}</td>
                          <td className="px-4 py-3 text-muted">{c.output}</td>
                          <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1.5"><TrendIcon trend={c.trend} ok={ok} /><span className="font-bold" style={{ color: ok ? 'var(--opp)' : 'var(--risk)' }}>{c.score}%</span></span></td>
                          <td className="px-4 py-3 text-right text-[12px] text-muted-2">view log</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5" style={{ borderTop: `3px solid ${sel.score >= sel.target ? 'var(--opp)' : 'var(--risk)'}` }}>
                <div className="eyebrow">Check detail</div>
                <h3 className="mt-1 text-[16px] font-bold">{sel.check}</h3>
                <div className="mt-3 flex items-end gap-3"><span className="text-4xl font-bold" style={{ color: sel.score >= sel.target ? 'var(--opp)' : 'var(--risk)' }}>{sel.score}%</span><span className="mb-1.5 text-[12px] text-muted">target {sel.target}%</span></div>
                <p className="mt-3 text-[13px] leading-relaxed text-text">{sel.whatItTests}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                  <Mini label="Input" value={sel.input} />
                  <Mini label="Output" value={sel.output} />
                  <Mini label="Last run" value={sel.lastRun.slice(5)} />
                  <Mini label="Samples" value={`${sel.samples}`} />
                  <Mini label="Overrides" value={`${sel.overrides}`} />
                  <Mini label="Target" value={`${sel.target}%`} />
                </div>
                <div className="mt-4 rounded-xl bg-bg-2 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-2">Suggestions</div><p className="mt-1 text-[12px] leading-snug text-text">{sel.suggestion}</p></div>
                <button onClick={() => setView('review')} className="mt-4 w-full rounded-lg border border-line py-2 text-[12px] font-medium text-muted hover:text-text">Review samples &amp; give feedback</button>
              </div>
            </div>
          </>
        )}

        {view === 'review' && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold">Review &amp; feedback</h3>
                <p className="mt-0.5 text-[13px] text-muted">For each call, see what the AI decided and why - then tell it where it's right or wrong. Your feedback is logged and the system learns from it.</p>
              </div>
              <div className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] text-muted">Reviewed <b className="text-text">{reviewed}</b> / {reviewItems.length}</div>
            </div>
            <div className="mt-3 space-y-3">
              {reviewItems.map((it) => (
                <ReviewItemCard
                  key={it.id} it={it} verdict={feedback[it.id]} relabeling={relabeling === it.id}
                  note={note[it.id] ?? ''} onNote={(v) => setNote((p) => ({ ...p, [it.id]: v }))}
                  onCorrect={() => submit(it.id, 'correct')} onIncorrect={() => submit(it.id, 'incorrect')}
                  onStartRelabel={() => setRelabeling(it.id)} onRelabel={(t) => submit(it.id, 'relabel', t)} onCancel={() => setRelabeling(null)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}

function ReviewItemCard({ it, verdict, relabeling, note, onNote, onCorrect, onIncorrect, onStartRelabel, onRelabel, onCancel }: {
  it: typeof reviewItems[number]; verdict?: Verdict; relabeling: boolean; note: string; onNote: (v: string) => void
  onCorrect: () => void; onIncorrect: () => void; onStartRelabel: () => void; onRelabel: (t: SignalType) => void; onCancel: () => void
}) {
  const m = SIGNAL_META[it.modelType]
  const done = !!verdict
  return (
    <div className={`rounded-xl border border-line bg-surface p-4 transition-opacity ${done ? 'opacity-80' : ''}`} style={{ borderLeft: `3px solid ${m.color}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-2">
        <span className="font-semibold text-text">{accountName(it.accountId)} <span className="font-normal text-muted-2">· {it.project}</span></span>
        <span>{it.call} · {fmt(it.date)} · via Microsoft Teams</span>
      </div>

      <div className="mt-2.5">
        <div className="eyebrow">Input · what was said on the call</div>
        <p className="mt-1 text-[13px] italic leading-relaxed text-muted">“{it.quote}”</p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-bg-2 p-3">
          <div className="eyebrow">Model output</div>
          <div className="mt-1.5 flex items-center gap-2"><SignalBadge type={it.modelType} size="sm" /><ConfidenceBar value={it.confidence} /></div>
        </div>
        <div className="rounded-lg bg-bg-2 p-3">
          <div className="eyebrow">Why the model said this</div>
          <p className="mt-1 text-[12px] leading-snug text-text">{it.reasoning}</p>
        </div>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <div className="eyebrow">Your feedback</div>
        {done ? (
          <div className="mt-1.5 rounded-lg bg-bg-2 px-3 py-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5 font-medium">
              {verdict!.kind === 'correct' && <><Check size={14} className="text-[var(--opp)]" /> Marked correct</>}
              {verdict!.kind === 'incorrect' && <><X size={14} className="text-[var(--risk)]" /> Marked incorrect</>}
              {verdict!.kind === 'relabel' && <><RefreshCw size={13} className="text-[var(--people)]" /> Relabelled to <SignalBadge type={verdict!.newType!} size="sm" /></>}
            </span>
            {verdict!.note && <span className="text-muted"> · "{verdict!.note}"</span>}
            <span className="ml-1 text-muted-2">- logged, the system will learn from this.</span>
          </div>
        ) : relabeling ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-2">Correct label:</span>
            {TYPES.map((t) => (
              <button key={t} onClick={() => onRelabel(t)} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium hover:border-[var(--line-2)]" style={{ color: SIGNAL_META[t].color }}>{SIGNAL_META[t].label}</button>
            ))}
            <button onClick={onCancel} className="text-[11px] text-muted-2 hover:text-text">cancel</button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <input value={note} onChange={(e) => onNote(e.target.value)} placeholder="Add a note for the model (optional)…" className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] outline-none placeholder:text-muted-2 focus:border-[var(--accent)]" />
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={onCorrect} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: 'var(--opp)' }}><Check size={12} /> Correct</button>
              <button onClick={onIncorrect} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-muted hover:text-text"><X size={12} /> Incorrect</button>
              <button onClick={onStartRelabel} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-muted hover:text-text"><RefreshCw size={12} /> Relabel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-surface-2 p-2"><div className="eyebrow">{label}</div><div className="mt-0.5 text-[12px] font-semibold">{value}</div></div>
}
function TrendIcon({ trend, ok }: { trend: Trend; ok: boolean }) {
  if (trend === 'improving') return <TrendingUp size={13} className="text-[var(--opp)]" />
  if (trend === 'declining') return <TrendingDown size={13} style={{ color: ok ? 'var(--people)' : 'var(--risk)' }} />
  return <Minus size={13} className="text-muted-2" />
}
