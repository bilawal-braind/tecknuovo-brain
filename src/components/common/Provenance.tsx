import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Route, X, Send, Check } from 'lucide-react'
import type { Signal } from '../../data/types'
import type { Call } from '../../data/calls'
import { calls } from '../../data/calls'
import { accountById, accountName, personName, projectById } from '../../data/org'
import { sendSourceFeedback } from '../../data/api'
import { isLive } from '../../data/source'
import { fmt } from './SignalLayer'

// ── The transparency layer ───────────────────────────────────────────────────
// "Where does this come from?" answered in one glance: a small route icon on
// signals / calls / accounts / projects opens a QUIET sidebar tracing the item
// back to the client's own systems, step by step, in the same colour language
// as the Notion source map (blue Teams · orange Monday · green SharePoint ·
// red HubSpot · teal brain). A feedback box at the bottom sends "this looks
// wrong" to BraindAI - the user's typed words only, never content.
const C = {
  teams: '#1F62C4', monday: '#E68A00', sharepoint: '#1F7A3A', hubspot: '#D64545', brain: '#0e9f93',
}

type Step = { color: string; icon: string; title: string; sub?: string }

function stepsForSignal(s: Signal): Step[] {
  const call = s.callId ? calls.find((c) => c.id === s.callId) : undefined
  const fromHubspot = call?.source === 'hubspot'
  const acc = accountById(s.accountId)
  const steps: Step[] = [
    fromHubspot
      ? { color: C.hubspot, icon: '🧡', title: 'Notes logged in HubSpot', sub: `${s.sourceCall.title} · ${fmt(s.sourceCall.date)}` }
      : { color: C.teams, icon: '🎥', title: 'Said on a Teams call', sub: `${s.sourceCall.title} · ${fmt(s.sourceCall.date)} · from the transcript` },
    { color: C.brain, icon: '🧠', title: `Classified as ${s.type}`, sub: `by the Second Brain · ${s.confidence}% confidence${s.riskCategory ? ` · ${s.riskCategory}` : ''}` },
    { color: C.brain, icon: '🏷️', title: `Filed to ${accountName(s.accountId) || 'no account yet'}`, sub: s.mentions && s.mentions > 1 ? `raised in ${s.mentions} calls - tracked as ONE signal` : 'matched from this call' },
  ]
  if (acc) {
    const owners = [personName(acc.clientPartner), personName(acc.clientDirector)].filter(Boolean).join(' · ')
    if (owners) steps.push({ color: C.monday, icon: '📋', title: `Owners: ${owners}`, sub: 'from the Live Allocations board in Monday' })
  }
  if (s.projectId) {
    const p = projectById(s.projectId)
    if (p) steps.push({ color: C.sharepoint, icon: '📄', title: `Project: ${p.name}`, sub: 'from the weekly reports in SharePoint' })
  }
  return steps
}

function stepsForCall(c: Call): Step[] {
  const fromHubspot = c.source === 'hubspot'
  const steps: Step[] = [
    fromHubspot
      ? { color: C.hubspot, icon: '🧡', title: 'Meeting logged in HubSpot', sub: 'notes added by the team - no transcript existed' }
      : { color: C.teams, icon: '🎥', title: 'Transcribed Teams call', sub: `${fmt(c.date)} · transcription was switched on` },
    { color: C.brain, icon: '🧠', title: `Read by the Second Brain`, sub: `${c.signals.length} signal${c.signals.length !== 1 ? 's' : ''} extracted from what was said` },
  ]
  if (c.accountId) steps.push({ color: C.brain, icon: '🏷️', title: `Linked to ${accountName(c.accountId)}`, sub: 'matched from the meeting title and attendees' })
  else steps.push({ color: C.brain, icon: '🧭', title: 'Team-level call', sub: 'covers several clients - each signal is filed to its own account' })
  return steps
}

function stepsForAccount(accountId: string): Step[] {
  const acc = accountById(accountId)
  if (!acc) return []
  const owners = [personName(acc.clientPartner), personName(acc.clientDirector)].filter(Boolean).join(' · ')
  return [
    { color: C.monday, icon: '📋', title: owners ? `Owners: ${owners}` : 'Owners not on the board yet', sub: 'from the Live Allocations board in Monday' },
    { color: C.monday, icon: '👥', title: `${acc.consultantCount ?? 0} consultant${(acc.consultantCount ?? 0) !== 1 ? 's' : ''} on site`, sub: 'from the Assigned Associates board in Monday' },
    { color: C.sharepoint, icon: '📄', title: 'Projects & RAG trend', sub: "from this account's weekly reports in SharePoint" },
    { color: C.monday, icon: '🛡️', title: 'Risk register items', sub: 'from the Risks, Issues & Incidents board in Monday' },
    { color: C.teams, icon: '🎥', title: 'Calls & signals', sub: 'from transcribed Teams calls (and HubSpot notes)' },
  ]
}

function stepsForProject(projectId: string): Step[] {
  const p = projectById(projectId)
  if (!p) return []
  return [
    { color: C.sharepoint, icon: '📄', title: `"${p.name}" exists because a weekly report names it`, sub: 'projects come from the weekly reports in SharePoint' },
    { color: C.sharepoint, icon: '🧑‍💼', title: p.deliveryManager ? `DM: ${personName(p.deliveryManager)}` : 'No DM named yet', sub: 'named in the weekly report' },
    { color: C.teams, icon: '🎥', title: 'Signals on this project', sub: 'from transcribed calls matched to it' },
  ]
}

export function ProvenanceButton(props: { signal?: Signal; call?: Call; accountId?: string; projectId?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const kind = props.signal ? 'signal' : props.call ? 'call' : props.accountId ? 'account' : 'project'
  const refId = props.signal?.id ?? props.call?.id ?? props.accountId ?? props.projectId ?? ''
  const refLabel = props.signal?.summary?.slice(0, 80) ?? props.call?.title ?? (props.accountId ? accountName(props.accountId) : projectById(props.projectId ?? '')?.name) ?? ''
  const steps = props.signal ? stepsForSignal(props.signal) : props.call ? stepsForCall(props.call) : props.accountId ? stepsForAccount(props.accountId) : stepsForProject(props.projectId ?? '')

  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true) }} title="Where does this come from?"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted-2 transition-colors hover:text-[var(--accent-d)]">
        <Route size={11} />{props.label ?? 'Source'}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[95] flex justify-end bg-black/35 backdrop-blur-[1px]" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full max-w-[400px] flex-col border-l border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: 'var(--accent)' }}><Route size={15} /></span>
              <div className="min-w-0">
                <h3 className="text-[14.5px] font-bold tracking-tight">Where this comes from</h3>
                <div className="truncate text-[11px] text-muted-2">{refLabel}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-md border border-line p-1.5 text-muted-2 hover:text-text"><X size={14} /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="relative">
                {steps.map((st, i) => (
                  <div key={i} className="relative flex gap-3 pb-5">
                    {i < steps.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-32px)] w-px bg-[var(--line)]" aria-hidden />}
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px]"
                      style={{ background: `color-mix(in srgb, ${st.color} 12%, var(--surface))`, boxShadow: `inset 0 0 0 1.5px ${st.color}` }}>
                      {st.icon}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <div className="text-[13px] font-semibold leading-snug">{st.title}</div>
                      {st.sub && <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{st.sub}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1 rounded-xl bg-bg-2 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-2">
                The brain never invents data - everything above comes from your own systems. If something is wrong on screen, fixing it at the source fixes it everywhere.
              </p>
            </div>

            <FeedbackBox kind={kind} refId={refId} refLabel={refLabel} />
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// "This looks wrong" - lands with BraindAI directly (typed words only).
function FeedbackBox({ kind, refId, refLabel }: { kind: string; refId: string; refLabel: string }) {
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')
  const submit = () => {
    const n = note.trim()
    if (!n || state === 'busy') return
    setState('busy')
    if (!isLive) { setState('sent'); return }
    sendSourceFeedback(kind, refId, refLabel, n).then(() => setState('sent')).catch(() => setState('error'))
  }
  if (state === 'sent') {
    return (
      <div className="border-t border-line px-5 py-4">
        <div className="flex items-center gap-2 rounded-xl px-3.5 py-3 text-[12.5px] font-medium" style={{ color: 'var(--opp)', background: 'color-mix(in srgb, var(--opp) 10%, transparent)' }}>
          <Check size={15} /> Sent - the BraindAI team will take a look. Thank you!
        </div>
      </div>
    )
  }
  return (
    <div className="border-t border-line px-5 py-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-2">Something look wrong?</div>
      <textarea
        value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        placeholder="Tell us what's off - it goes straight to the BraindAI team…"
        className="mt-2 w-full resize-none rounded-xl border border-line bg-bg-2 px-3 py-2.5 text-[12.5px] text-text outline-none placeholder:text-muted-2 focus:border-[var(--accent)]"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-2">Only your words are sent - no call content leaves your systems.</span>
        <button onClick={submit} disabled={!note.trim() || state === 'busy'}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-40"
          style={{ background: state === 'error' ? 'var(--risk)' : 'var(--accent)' }}>
          <Send size={12} /> {state === 'error' ? 'Retry' : 'Send'}
        </button>
      </div>
    </div>
  )
}
