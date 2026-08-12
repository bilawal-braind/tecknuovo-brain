// tnAI chat - the conversational layer over the Second Brain.
// 12 Aug pass: smooth and interactive - typewriter answers, animated thinking
// state, gradient line/area and bar charts rendered in the thread, contextual
// follow-up chips. Tecknuovo branding only, no emojis.
import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, ArrowUp, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from 'recharts'
import { accountById, accountName } from '../../data/org'
import { askBrain } from '../../data/api'
import type { AskChart, AskItem } from '../../data/api'
import { isLive } from '../../data/source'

type Msg = {
  role: 'user' | 'ai'
  text: string
  accounts?: string[]
  chart?: AskChart | null
  items?: AskItem[]
  thinking?: boolean
  done?: boolean // typewriter finished -> chart/items/follow-ups reveal
}

const SUGGESTIONS = [
  'What needs my attention today?',
  'Which accounts are at risk?',
  'Where are the biggest opportunities?',
  'How are the calls trending this month?',
]

// Contextual follow-ups after an answer - picked from what the question was about.
function followUps(lastQ: string): string[] {
  const s = lastQ.toLowerCase()
  if (/risk|issue|concern|escalat/.test(s)) return ['Which of these needs action first?', 'Show the risk trend this month', 'Any opportunities to balance this?']
  if (/opportun|deal|pipeline|grow/.test(s)) return ['Which account has the most momentum?', 'Any risks on those accounts?', 'How are the calls trending?']
  if (/call|meeting|activity|trend/.test(s)) return ['Who has been on the most calls?', 'Which accounts went quiet?', 'What signals came from those calls?']
  return ['Show the trend over the last month', 'Which accounts are at risk?', 'Where are the biggest opportunities?']
}

// Mock co-pilot - illustrative for the demo, with a sample chart so the design shows.
function answer(q: string): { text: string; accounts: string[]; chart?: AskChart } {
  const s = q.toLowerCase()
  if (/risk|at risk|escalat|churn|behind/.test(s))
    return {
      text: 'Two accounts are at risk right now: Cabinet Office - two milestones slipped and the client director is escalating - and NHS, where a new sponsor is reviewing all contracts. Open either to see the calls behind it.',
      accounts: ['cabo', 'nhs'],
      chart: { kind: 'bar', title: 'Risks by account · last 14 days', data: [{ label: 'Cabinet Office', value: 4 }, { label: 'NHS', value: 3 }, { label: 'GVMS', value: 2 }, { label: 'DWP', value: 1 }] },
    }
  if (/opportun|grow|upsell|pipeline|expand|revenue/.test(s))
    return { text: 'The biggest open opportunities: GVMS (second data workstream), MOD (Centre of Excellence rollout to two more directorates), and Thames Water (extending into the reporting layer).', accounts: ['gvms', 'mod', 'thames'] }
  if (/people|team|resourc|flight|morale|associate/.test(s))
    return { text: 'Two people signals to watch: an associate is over-stretched across two Vodafone workstreams, and morale has dipped on Cabinet Office after repeated client change requests.', accounts: ['voda3', 'cabo'] }
  if (/trend|call|week|month|summar|overview|going on|happening/.test(s))
    return {
      text: 'Call activity is holding steady this month with a lift in the last week. Cabinet Office is the top risk, GVMS has both a velocity slip and an open opportunity, and DWP has a procurement delay on its next SOW.',
      accounts: ['cabo', 'gvms', 'dwp'],
      chart: { kind: 'line', title: 'Calls per day · last 14 days', data: [{ label: '29-07', value: 2 }, { label: '31-07', value: 4 }, { label: '03-08', value: 3 }, { label: '05-08', value: 6 }, { label: '07-08', value: 5 }, { label: '10-08', value: 8 }, { label: '11-08', value: 7 }] },
    }
  return { text: 'Top of the list today: Cabinet Office (at risk), GVMS (velocity slip plus an open opportunity), and a people signal on Vodafone. Open any to dig in.', accounts: ['cabo', 'gvms', 'voda3'] }
}

const THINKING = ['Reading the signals', 'Checking the calls', 'Looking across your accounts', 'Writing the answer']

export function CoPilot({ onOpenAccount }: { onOpenAccount?: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const h = () => setOpen(true)
    window.addEventListener('tn-open-copilot', h)
    return () => window.removeEventListener('tn-open-copilot', h)
  }, [])
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'ai', text: 'I read every call, report and signal across your accounts. Ask me anything.', done: true },
  ])
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastQ = useRef('')

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 250) }, [open])
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [msgs])

  const busy = msgs.some((m) => m.thinking)

  const send = (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    setInput('')
    lastQ.current = t
    if (!isLive) {
      const a = answer(t)
      setMsgs((m) => [...m, { role: 'user', text: t, done: true }, { role: 'ai', text: a.text, accounts: a.accounts, chart: a.chart }])
      return
    }
    setMsgs((m) => [...m, { role: 'user', text: t, done: true }, { role: 'ai', text: '', thinking: true }])
    askBrain(t)
      .then((r) => setMsgs((m) => [...m.slice(0, -1), { role: 'ai', text: r.answer, chart: r.chart, items: r.items }]))
      .catch(() => setMsgs((m) => [...m.slice(0, -1), { role: 'ai', text: "I couldn't reach the brain just now - check the connection and try again.", done: true }]))
  }

  const openAccount = (id: string) => { onOpenAccount?.(id); setOpen(false) }
  const markDone = (i: number) => setMsgs((m) => m.map((x, j) => (j === i ? { ...x, done: true } : x)))
  const lastAiDone = msgs.length > 1 && msgs[msgs.length - 1].role === 'ai' && msgs[msgs.length - 1].done && !msgs[msgs.length - 1].thinking

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mb-3 flex h-[560px] w-[400px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3"
              style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%)' }}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: 'var(--accent)' }}><Sparkles size={16} /></span>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5 text-[13.5px] font-bold tracking-tight">tnAI{isLive && <span className="rounded-full border border-line bg-surface px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide text-muted">beta</span>}</div>
                  <div className="text-[10.5px] text-muted-2">Ask across your accounts</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bg-2 hover:text-text"><X size={16} /></button>
            </div>

            {/* thread */}
            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.map((m, i) =>
                m.role === 'user' ? (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px] leading-relaxed text-white" style={{ background: 'var(--accent)' }}>{m.text}</div>
                  </motion.div>
                ) : (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                    <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-bg-2 px-3.5 py-2.5 text-[13px] leading-relaxed">
                      {m.thinking ? <Thinking /> : m.done ? m.text : <TypeText text={m.text} onDone={() => markDone(i)} />}
                    </div>
                    {m.done && m.chart && <ChartCard chart={m.chart} />}
                    {m.done && (m.items?.length ?? 0) > 0 && (
                      <div className="space-y-1.5">
                        {m.items!.slice(0, 4).map((it) => (
                          <motion.button key={it.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                            onClick={() => it.account_id && openAccount(it.account_id)}
                            className="group flex w-full items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-left text-[11.5px] leading-snug transition-colors hover:border-[var(--accent)]">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.type === 'risk' ? 'var(--risk)' : it.type === 'opportunity' ? 'var(--opp)' : 'var(--update)' }} />
                            <span className="min-w-0 flex-1"><b className="font-semibold">{it.account ?? ''}</b>{it.account ? ' · ' : ''}{it.summary}</span>
                            <ArrowRight size={12} className="mt-0.5 shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
                          </motion.button>
                        ))}
                      </div>
                    )}
                    {m.done && (m.accounts?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.accounts!.filter((id) => accountById(id)).map((id) => (
                          <button key={id} onClick={() => openAccount(id)} disabled={!onOpenAccount}
                            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-d)] transition-colors hover:border-[var(--accent)] disabled:text-muted-2">
                            {accountName(id)} <ArrowRight size={10} />
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ),
              )}

              {/* suggestions: starters on a fresh thread, follow-ups after an answer */}
              {(msgs.length === 1 || lastAiDone) && !busy && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-1.5 pt-1">
                  {(msgs.length === 1 ? SUGGESTIONS : followUps(lastQ.current)).map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-muted transition-all hover:border-[var(--accent)] hover:text-[var(--accent-d)]">
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* input */}
            <div className="border-t border-line p-3">
              <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex items-center gap-2">
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the Second Brain..."
                  className="h-[38px] flex-1 rounded-xl border border-line bg-bg-2 px-3.5 text-[13px] outline-none transition-colors placeholder:text-muted-2 focus:border-[var(--accent)]" />
                <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
                  className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl text-white transition-all enabled:hover:scale-105 disabled:opacity-40" style={{ background: 'var(--accent)' }}>
                  <ArrowUp size={16} />
                </button>
              </form>
              <div className="mt-1.5 text-center text-[9.5px] text-muted-2">{isLive ? 'tnAI beta · answers from your visible accounts only' : 'demo mode · illustrative answers'}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-4 py-3 text-[13px] font-semibold text-white shadow-xl" style={{ background: 'var(--accent)' }}>
        <Sparkles size={17} /> {open ? 'Close' : 'Ask the brain'}
      </motion.button>
    </div>
  )
}

// ── the animated thinking state ──
function Thinking() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setIdx((i) => i + 1), 1800)
    return () => window.clearInterval(t)
  }, [])
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <span className="inline-flex gap-[3px]">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }}
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </span>
      <span className="text-[12px]">{THINKING[idx % THINKING.length]}...</span>
    </span>
  )
}

// ── typewriter reveal for fresh answers ──
function TypeText({ text, onDone }: { text: string; onDone: () => void }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (n >= text.length) { onDone(); return }
    const t = window.setTimeout(() => setN((v) => Math.min(text.length, v + 3)), 12)
    return () => window.clearTimeout(t)
  }, [n, text, onDone])
  return <span>{text.slice(0, n)}<span className="inline-block h-[13px] w-[2px] translate-y-[2px] animate-pulse" style={{ background: 'var(--accent)' }} /></span>
}

// ── charts in the thread: gradient area for lines, rounded bars ──
function ChartCard({ chart }: { chart: AskChart }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="max-w-[92%] rounded-xl border border-line bg-surface p-3">
      <div className="eyebrow mb-2">{chart.title}</div>
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          {chart.kind === 'line' ? (
            <AreaChart data={chart.data} margin={{ top: 4, right: 6, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="tnai-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 9.5, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ stroke: 'var(--line-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 11.5 }} />
              <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2.25} fill="url(#tnai-fill)"
                dot={{ r: 2.5, fill: 'var(--accent)', strokeWidth: 0 }} activeDot={{ r: 4 }} animationDuration={900} animationEasing="ease-out" />
            </AreaChart>
          ) : (
            <BarChart data={chart.data} margin={{ top: 4, right: 6, left: -30, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 , fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} interval={0} angle={-18} height={34} textAnchor="end" />
              <YAxis allowDecimals={false} tick={{ fontSize: 9.5, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'var(--bg-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 11.5 }} />
              <Bar dataKey="value" fill="var(--accent)" radius={[5, 5, 0, 0]} animationDuration={900} animationEasing="ease-out" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
