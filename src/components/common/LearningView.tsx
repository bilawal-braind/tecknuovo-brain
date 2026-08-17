// The learning loop, made visible (Cormac, 17 Aug): account by account, fully
// expanded - who gave feedback, what action they took, the reason they gave,
// and the lesson the brain wrote from it. Lessons are editable; a hand-edited
// lesson pauses auto-learning for that account until resumed.
import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, Users, ListChecks, Lightbulb, MessageSquare, Pencil, RotateCcw, Check } from 'lucide-react'
import { fetchLearning, saveLesson, resumeLessonAuto } from '../../data/api'
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
  ],
  recent: [
    { verdict: 'incorrect', correct_type: null, reason: 'SOW paperwork is not a risk', given_by: 'Meesha Chotai', created_at: '2026-08-13', account: 'HMRC', summary: 'Potential risk of overcharging or undercharging due to updates not feeding through.' },
    { verdict: 'relabel', correct_type: 'update', reason: 'This is a milestone, not a risk', given_by: 'Kiera Battersby', created_at: '2026-08-12', account: 'HMRC', summary: 'Environment provisioning may block the next development phase.' },
    { verdict: 'correct', correct_type: null, reason: null, given_by: 'Chloe Hollinshead', created_at: '2026-08-11', account: 'Cabinet Office', summary: 'Recurring production incident raised for the third week running.' },
  ],
  lessons: [
    { account_id: 'demo-hmrc', account: 'HMRC', manual: false, summary: '- Routine SOW and PO paperwork chasers are administrative follow-ups, not delivery risks. - Contract renewal signals only qualify as risks when a client stakeholder expresses doubt.', feedback_count: 18 },
    { account_id: 'demo-cabo', account: 'Cabinet Office', manual: false, summary: '- Recurring production issues already tracked by the team should merge into the existing signal rather than appearing as new risks each week.', feedback_count: 12 },
  ],
  totals: { total: 62, with_reason: 33, signals_reviewed: 58, signals_total: 456 },
}

// Turn a stored lesson blob ("- rule one. - rule two.") into displayable bullets.
function lessonBullets(text: string): string[] {
  return text
    .split(/\n+|\s+-\s+(?=[A-Z])/)
    .map((s) => s.replace(/^[-\s]+/, '').trim())
    .filter(Boolean)
}

const VERDICT_COLOR: Record<string, string> = { correct: 'var(--opp)', incorrect: 'var(--risk)', relabel: 'var(--people)' }
function actionPhrase(f: Learning['recent'][number]): string {
  if (f.verdict === 'incorrect') return 'marked this incorrect'
  if (f.verdict === 'relabel' || f.correct_type) return `relabelled this to ${f.correct_type ?? 'another type'}`
  return 'confirmed this was right'
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

  // One section per account: its full feedback trail + the lesson written from it.
  const accounts = useMemo(() => {
    if (!data) return []
    const byName = new Map<string, { name: string; lesson: Learning['lessons'][number] | null; feedback: Learning['recent'] }>()
    for (const l of data.lessons) byName.set(l.account, { name: l.account, lesson: l, feedback: [] })
    for (const f of data.recent) {
      if (!f.account) continue
      if (!byName.has(f.account)) byName.set(f.account, { name: f.account, lesson: null, feedback: [] })
      byName.get(f.account)!.feedback.push(f)
    }
    return [...byName.values()].sort((a, b) => b.feedback.length - a.feedback.length)
  }, [data])

  if (failed) return <p className="mt-4 rounded-xl border border-line bg-surface p-6 text-center text-[12.5px] text-muted">Couldn't load the learning data - check the API connection.</p>
  if (!data) return <p className="mt-4 rounded-xl border border-line bg-surface p-6 text-center text-[12.5px] text-muted-2">Reading the feedback ledger...</p>

  const t = data.totals
  const coverage = t.signals_total ? Math.round((100 * t.signals_reviewed) / t.signals_total) : 0
  const reasonRate = t.total ? Math.round((100 * t.with_reason) / t.total) : 0

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[16px] font-bold tracking-tight">The learning loop</h3>
        <span className="text-[12.5px] text-muted-2">account by account - who gave feedback, what they said, and the lesson the brain wrote from it</span>
      </div>

      {/* the loop in one line - so the page explains itself */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-3 text-[12.5px]">
        <span className="grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-bold text-white" style={{ background: 'var(--accent)' }}>1</span>
        <span className="text-muted"><b className="text-text">The team reviews signals</b> - correct, incorrect (with a reason chip), or relabel</span>
        <span className="mx-1 text-muted-2">then</span>
        <span className="grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-bold text-white" style={{ background: 'var(--accent)' }}>2</span>
        <span className="text-muted"><b className="text-text">the brain writes lessons</b> from those verdicts (shown below)</span>
        <span className="mx-1 text-muted-2">then</span>
        <span className="grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-bold text-white" style={{ background: 'var(--accent)' }}>3</span>
        <span className="text-muted"><b className="text-text">every future call is classified with those lessons</b> - so the same mistake stops repeating</span>
      </div>

      {/* headline numbers */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ListChecks} label="Feedback given" value={`${t.total}`} sub={`${t.signals_reviewed} signals reviewed`} />
        <Stat icon={GraduationCap} label="Signals reviewed" value={`${t.signals_reviewed}/${t.signals_total}`} sub={`${coverage}% of everything the brain has flagged`} />
        <Stat icon={MessageSquare} label="With a reason" value={`${reasonRate}%`} sub="reasons teach far more than bare clicks" />
        <Stat icon={Lightbulb} label="Lessons written" value={`${data.lessons.length}`} sub="live in the classifier on every new call" />
      </div>

      {/* account by account - everything expanded, nothing hidden */}
      {accounts.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-surface p-6 text-center text-[12.5px] text-muted-2">No feedback yet - this fills in as the team reviews signals.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {accounts.map((a) => <AccountSection key={a.name} name={a.name} lesson={a.lesson} feedback={a.feedback} />)}
        </div>
      )}

      {/* reviewers roll-up - plain rows, the detail lives in the account sections above */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-muted" />
          <span className="text-[14px] font-semibold">The reviewers</span>
          <span className="text-[11px] text-muted-2">volume and teaching quality per person - their individual feedback is in the account sections above</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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

// One account, fully expanded: the feedback trail on the left, the lesson the
// brain wrote from it on the right. Nothing collapsed, nothing to click open.
function AccountSection({ name, lesson, feedback }: { name: string; lesson: Learning['lessons'][number] | null; feedback: Learning['recent'] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[15px] font-bold tracking-tight">{name}</span>
        <span className="text-[11px] text-muted-2">
          {lesson ? `${lesson.feedback_count} piece${lesson.feedback_count !== 1 ? 's' : ''} of feedback → 1 lesson in the classifier` : `${feedback.length} piece${feedback.length !== 1 ? 's' : ''} of feedback · no lesson written yet`}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* the feedback trail */}
        <div>
          <span className="eyebrow">Who said what</span>
          <div className="mt-2 space-y-2">
            {feedback.map((f, i) => {
              const c = VERDICT_COLOR[f.verdict] ?? 'var(--muted)'
              return (
                <div key={i} className="rounded-xl bg-bg-2 px-3.5 py-2.5" style={{ borderLeft: `3px solid ${c}` }}>
                  <p className="text-[12.5px] leading-snug">
                    <b>{f.given_by}</b> <span style={{ color: c }} className="font-semibold">{actionPhrase(f)}</span>
                    <span className="text-muted-2"> · {String(f.created_at).slice(0, 10)}</span>
                  </p>
                  {f.summary && <p className="mt-1 text-[11.5px] leading-snug text-muted">The signal: {f.summary}</p>}
                  <p className="mt-1 text-[12px] leading-snug">
                    {f.reason
                      ? <><span className="text-muted-2">Their reason: </span><b className="text-text">"{f.reason}"</b></>
                      : <span className="text-muted-2">No reason given - the brain had to guess why.</span>}
                  </p>
                </div>
              )
            })}
            {feedback.length === 0 && <p className="rounded-xl bg-bg-2 px-3.5 py-2.5 text-[11.5px] text-muted-2">The feedback behind this lesson is older than the latest 400 items shown here.</p>}
          </div>
        </div>

        {/* the lesson */}
        <div>
          <span className="eyebrow">What the brain learned</span>
          {lesson
            ? <LessonEditor lesson={lesson} />
            : <p className="mt-2 rounded-xl bg-bg-2 px-3.5 py-2.5 text-[12px] text-muted-2">No lesson yet - the learning loop writes one once feedback accumulates for this account.</p>}
        </div>
      </div>
    </div>
  )
}

// The account's lesson, shown as plain bullets, editable in place. Saving
// pauses auto-learning for the account; Resume hands it back to the loop.
function LessonEditor({ lesson }: { lesson: Learning['lessons'][number] }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(lesson.summary)
  const [saved, setSaved] = useState(lesson.summary)
  const [manual, setManual] = useState(lesson.manual)
  const [busy, setBusy] = useState(false)
  const demo = lesson.account_id.startsWith('demo-')
  const save = async () => {
    setBusy(true)
    try { if (!demo) await saveLesson(lesson.account_id, text.trim()); setSaved(text.trim()); setManual(true); setEditing(false) } catch { /* keep editing */ }
    setBusy(false)
  }
  const resume = async () => {
    setBusy(true)
    try { if (!demo) await resumeLessonAuto(lesson.account_id); setManual(false) } catch { /* noop */ }
    setBusy(false)
  }
  return (
    <div className="mt-2 rounded-xl bg-bg-2 p-3.5" style={{ borderLeft: '3px solid color-mix(in srgb, var(--accent) 55%, var(--line))' }}>
      <div className="flex flex-wrap items-center gap-1.5">
        {manual && <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent-d)', background: 'color-mix(in srgb, var(--accent) 11%, transparent)' }}>edited by hand · auto-learning paused</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {manual && !editing && (
            <button onClick={resume} disabled={busy} title="Let the learning loop take over this lesson again"
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[10.5px] font-semibold text-muted transition-colors hover:text-text"><RotateCcw size={10} /> Resume auto</button>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[10.5px] font-semibold text-muted transition-colors hover:text-text"><Pencil size={10} /> Edit</button>
          )}
        </span>
      </div>
      {editing ? (
        <div className="mt-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed outline-none focus:border-[var(--accent)]" />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button onClick={save} disabled={busy || !text.trim()} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11.5px] font-semibold text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}><Check size={11} /> Save - the classifier uses this from the next call</button>
            <button onClick={() => { setEditing(false); setText(saved) }} className="rounded-md border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-muted">Cancel</button>
          </div>
        </div>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {lessonBullets(saved).map((b, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-text">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
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
