import { useState } from 'react'
import { Sparkles, X, ArrowUp, ArrowRight } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { accountById, accountName } from '../../data/org'
import { askBrain } from '../../data/api'
import type { AskChart, AskItem } from '../../data/api'
import { isLive } from '../../data/source'

type Msg = { role: 'user' | 'ai'; text: string; accounts?: string[]; chart?: AskChart | null; items?: AskItem[]; thinking?: boolean }

const SUGGESTIONS = [
  'What needs my attention today?',
  'Which accounts are at risk?',
  'Where are the biggest opportunities?',
  'Any people or resourcing issues?',
]

// Mock co-pilot - illustrative for the demo. Replies are canned but tailored to the question,
// and the accounts it names are clickable so you can jump straight to them.
function answer(q: string): { text: string; accounts: string[] } {
  const s = q.toLowerCase()
  if (/risk|at risk|escalat|churn|behind/.test(s))
    return { text: 'Two accounts are at risk right now: Cabinet Office - two milestones slipped and the client director is escalating - and NHS, where a new sponsor is reviewing all contracts. Open either to see the calls behind it.', accounts: ['cabo', 'nhs'] }
  if (/opportun|grow|upsell|pipeline|expand|revenue/.test(s))
    return { text: 'The biggest open opportunities: GVMS (~£400k second data workstream), MOD (Centre of Excellence rollout to two more directorates, ~£500k), and Thames Water (extending into the reporting layer).', accounts: ['gvms', 'mod', 'thames'] }
  if (/people|team|resourc|flight|morale|associate/.test(s))
    return { text: 'Two people signals to watch: an associate is over-stretched across two Vodafone workstreams, and morale has dipped on Cabinet Office after repeated client change requests.', accounts: ['voda3', 'cabo'] }
  if (/summar|week|overview|going on|happening/.test(s))
    return { text: "This week: 36 signals captured across your accounts. Cabinet Office is the top risk, GVMS has both a velocity slip and a ~£400k opportunity, and DWP has a procurement delay on its next SOW. Open any to dig in.", accounts: ['cabo', 'gvms', 'dwp'] }
  return { text: 'Top of the list today: Cabinet Office (at risk), GVMS (velocity slip plus a ~£400k opportunity), and a people signal on Vodafone. Open any to dig in.', accounts: ['cabo', 'gvms', 'voda3'] }
}

export function CoPilot({ onOpenAccount }: { onOpenAccount?: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'ai', text: "Hi - I'm your Second Brain. Ask me anything about your accounts, signals or calls." },
  ])

  const send = (text: string) => {
    const t = text.trim()
    if (!t) return
    setInput('')
    if (!isLive) {
      const a = answer(t)
      setMsgs((m) => [...m, { role: 'user', text: t }, { role: 'ai', text: a.text, accounts: a.accounts }])
      return
    }
    // LIVE: the real engine - scoped retrieval over Postgres, optional LLM phrasing,
    // charts rendered right here in the thread.
    setMsgs((m) => [...m, { role: 'user', text: t }, { role: 'ai', text: 'Reading the brain…', thinking: true }])
    askBrain(t)
      .then((r) => setMsgs((m) => [...m.slice(0, -1), { role: 'ai', text: r.answer, chart: r.chart, items: r.items }]))
      .catch(() => setMsgs((m) => [...m.slice(0, -1), { role: 'ai', text: "I couldn't reach the brain just now - check the connection and try again." }]))
  }

  const openAccount = (id: string) => { onOpenAccount?.(id); setOpen(false) }

  return (
    <div className="fixed bottom-5 right-5 z-[70]">
      {open && (
        <div className="mb-3 flex h-[460px] w-[372px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3" style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: 'var(--accent)' }}><Sparkles size={15} /></span>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">tnAI{isLive && <span className="rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--people)' }}>beta</span>}</div>
                <div className="text-[10px] text-muted-2">Ask across your accounts</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted hover:text-text"><X size={16} /></button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[88%]">
                  <div className={`rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${m.role === 'user' ? 'text-white' : 'bg-bg-2 text-text'} ${m.thinking ? 'animate-pulse text-muted' : ''}`} style={m.role === 'user' ? { background: 'var(--accent)' } : undefined}>{m.text}</div>
                  {m.chart && m.chart.data.length > 0 && (
                    <div className="mt-1.5 rounded-xl border border-line bg-surface p-2.5">
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-2">{m.chart.title}</div>
                      <div className="h-[130px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={m.chart.data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} interval={0} angle={-20} height={30} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'var(--muted-2)' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 11 }} />
                            <Bar dataKey="value" fill="var(--accent)" radius={[3, 3, 0, 0]} animationDuration={700} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {m.items && m.items.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {m.items.slice(0, 4).map((it) => (
                        <button key={it.id} onClick={() => it.account_id && openAccount(it.account_id)}
                          className="flex w-full items-start gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-[11px] leading-snug text-muted transition-colors hover:text-text">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.type === 'opportunity' ? 'var(--opp)' : it.type === 'risk' ? 'var(--risk)' : it.type === 'people' ? 'var(--people)' : 'var(--update)' }} />
                          <span className="min-w-0 flex-1">{it.account ? <b className="font-semibold text-text">{it.account} · </b> : null}{it.summary}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {m.accounts && m.accounts.filter((id) => accountById(id)).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.accounts.filter((id) => accountById(id)).map((id) => (
                        <button key={id} onClick={() => openAccount(id)} disabled={!onOpenAccount} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-d)] transition-colors hover:border-[var(--accent)] disabled:text-muted-2 disabled:hover:border-line">
                          {accountName(id)} <ArrowRight size={11} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {msgs.length <= 1 && (
              <div className="space-y-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="block w-full rounded-lg border border-line bg-bg-2 px-3 py-2 text-left text-[12px] text-muted transition-colors hover:text-text">{s}</button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-line p-3">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5">
              <input
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder="Ask the Second Brain…" className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-2"
              />
              <button onClick={() => send(input)} className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: 'var(--accent)' }}><ArrowUp size={15} /></button>
            </div>
            <p className="mt-1.5 text-center text-[9.5px] text-muted-2">{isLive ? 'tnAI beta · answers from your visible accounts only' : 'Mock co-pilot · illustrative for the demo'}</p>
          </div>
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full px-4 py-3 text-[13px] font-semibold text-white shadow-xl transition-transform hover:scale-[1.03]" style={{ background: 'var(--accent)' }}>
        <Sparkles size={17} /> {open ? 'Close' : 'Ask the brain'}
      </button>
    </div>
  )
}
