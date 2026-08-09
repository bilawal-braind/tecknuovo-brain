import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Route, X, Send, Check, ArrowDown } from 'lucide-react'
import type { Signal } from '../../data/types'
import type { Call } from '../../data/calls'
import { calls } from '../../data/calls'
import { accountById, accountName, personName, projectById } from '../../data/org'
import { sendSourceFeedback } from '../../data/api'
import { isLive } from '../../data/source'
import { fmt } from './SignalLayer'

// ── The transparency layer ───────────────────────────────────────────────────
// "Where does this come from?" answered as a TRACE MAP: a small Source button on
// every displayed thing (signal, call, account, project, register risk, weekly
// report, CRM panel, person) opens a sidebar walking the data's journey - the
// exact system, board name AND id, sync schedule, every processing hop, ending
// at "displayed on your dashboard". Same colour language as the Notion source
// map. A feedback box sends "this looks wrong" to BraindAI (typed words only).
const C = {
  teams: '#1F62C4', monday: '#E68A00', sharepoint: '#1F7A3A', hubspot: '#D64545', brain: '#0e9f93', screen: '#7C5CFF',
}
const BOARDS = {
  alloc: 'from the Live Projects & Allocations board in Monday',
  assoc: 'from the Assigned Associates board in Monday',
  risk: 'from the Risks, Issues & Incidents board in Monday',
  sp: 'from the weekly reports in SharePoint',
  hs: 'from HubSpot',
}

type Step = { color: string; icon: string; title: string; sub?: string; sub2?: string }
const SCREEN_STEP: Step = { color: C.screen, icon: '📊', title: 'Displayed on your dashboard' }

function stepsForSignal(s: Signal): Step[] {
  const call = s.callId ? calls.find((c) => c.id === s.callId) : undefined
  const fromHubspot = call?.source === 'hubspot'
  const acc = accountById(s.accountId)
  const steps: Step[] = [
    fromHubspot
      ? { color: C.hubspot, icon: '🧡', title: 'Meeting notes logged in HubSpot', sub: `${s.sourceCall.title} · ${fmt(s.sourceCall.date)}`, }
      : { color: C.teams, icon: '🎥', title: 'Said on a transcribed Teams call', sub: `${s.sourceCall.title} · ${fmt(s.sourceCall.date)}`, },
    { color: C.brain, icon: '🧠', title: `Classified as ${s.type.toUpperCase()} · ${s.confidence}% confidence`, sub: s.riskCategory ? `category: ${s.riskCategory} (5×5 framework)` : s.type === 'opportunity' ? 'scored with the NETWORKS framework' : undefined, sub2: 'AI reads the words; fixed rules compute severity and routing' },
    { color: C.brain, icon: '🏷️', title: `Filed to ${accountName(s.accountId) || 'no account yet'}`, sub: 'matched from the meeting title, attendees and content', sub2: s.mentions && s.mentions > 1 ? `raised in ${s.mentions} calls - tracked as ONE signal, not ${s.mentions}` : undefined },
  ]
  if (s.escalate) steps.push({ color: C.brain, icon: '🚨', title: 'Escalated to leadership', sub: s.raisedBy ? `raised by ${s.raisedBy} - matched as a senior client voice in HubSpot` : 'passed the leadership escalation bar' })
  if (acc) {
    const owners = [personName(acc.clientPartner), personName(acc.clientDirector)].filter(Boolean).join(' · ')
    if (owners) steps.push({ color: C.monday, icon: '📋', title: `Account owners: ${owners}`, sub: BOARDS.alloc })
  }
  if (s.projectId) {
    const p = projectById(s.projectId)
    if (p) steps.push({ color: C.sharepoint, icon: '📄', title: `Project: ${p.name}`, sub: BOARDS.sp })
  }
  steps.push(SCREEN_STEP)
  return steps
}

function stepsForCall(c: Call): Step[] {
  const fromHubspot = c.source === 'hubspot'
  const steps: Step[] = [
    fromHubspot
      ? { color: C.hubspot, icon: '🧡', title: 'Meeting logged in HubSpot', sub: 'notes added by the team - no transcript existed', }
      : { color: C.teams, icon: '🎥', title: 'Transcribed Teams call', sub: `${fmt(c.date)}${c.durationSeconds ? ` · ${Math.round(c.durationSeconds / 60)} min (measured)` : ''}`, sub2: 'transcription was switched on for this meeting' },
    { color: C.brain, icon: '🧠', title: `Read by the Second Brain`, sub: `${c.signals.length} signal${c.signals.length !== 1 ? 's' : ''} extracted from what was said`, sub2: c.tone ? `whole-call tone: ${c.tone}` : undefined },
    c.accountId
      ? { color: C.brain, icon: '🏷️', title: `Linked to ${accountName(c.accountId)}`, sub: 'matched from the meeting title and attendees' }
      : { color: C.brain, icon: '🧭', title: 'Team-level call (covers several clients)', sub: 'each signal inside it is filed to its own account' },
    SCREEN_STEP,
  ]
  return steps
}

function stepsForAccount(accountId: string): Step[] {
  const acc = accountById(accountId)
  if (!acc) return []
  const owners = [personName(acc.clientPartner), personName(acc.clientDirector)].filter(Boolean).join(' · ')
  return [
    { color: C.monday, icon: '📋', title: owners ? `Owners: ${owners}` : 'Owners not on the board yet', sub: BOARDS.alloc, sub2: 'this board also decides who sees this account at login' },
    { color: C.monday, icon: '👥', title: `${acc.consultantCount ?? 0} consultant${(acc.consultantCount ?? 0) !== 1 ? 's' : ''} on site`, sub: BOARDS.assoc },
    { color: C.sharepoint, icon: '📄', title: 'Projects, phases & RAG trend', sub: BOARDS.sp, sub2: 'no weekly report filed = no project shown' },
    { color: C.monday, icon: '🛡️', title: 'Risk register items', sub: BOARDS.risk },
    { color: C.hubspot, icon: '🧡', title: 'Stakeholders & open pipeline', sub: BOARDS.hs },
    { color: C.teams, icon: '🎥', title: 'Calls & signals', sub: 'from transcribed Teams calls (and HubSpot notes)' },
    { color: C.brain, icon: '❤️', title: `Health: ${acc.health.toUpperCase()}`, sub: 'computed from open signals + high-impact register items', sub2: acc.healthReason || undefined },
    SCREEN_STEP,
  ]
}

function stepsForProject(projectId: string): Step[] {
  const p = projectById(projectId)
  if (!p) return []
  return [
    { color: C.sharepoint, icon: '📄', title: `Named in the weekly reports`, sub: BOARDS.sp, sub2: 'a project exists on the dashboard because a weekly report names it' },
    { color: C.sharepoint, icon: '🧑‍💼', title: p.deliveryManager ? `Delivery Manager: ${personName(p.deliveryManager)}` : 'No DM named yet', sub: 'named inside that weekly report' },
    { color: C.sharepoint, icon: '🚦', title: `Current RAG: ${(p.rag || 'unknown').toUpperCase()} · phase: ${p.phase || '-'}`, sub: 'from the latest weekly report · the trend graph shows the history' },
    { color: C.teams, icon: '🎥', title: 'Signals on this project', sub: 'from transcribed calls matched to it' },
    SCREEN_STEP,
  ]
}

const PRESETS: Record<string, { label: string; steps: Step[] }> = {
  register: {
    label: 'Risk register',
    steps: [
      { color: C.monday, icon: '🛡️', title: 'Maintained by your team in Monday', sub: BOARDS.risk },
      { color: C.brain, icon: '🚨', title: 'Escalation timing applied', sub: 'Level 2 items reach Katie after 1 day · Level 1 after 5 days', sub2: 'the item age comes from the board itself' },
      SCREEN_STEP,
    ],
  },
  report: {
    label: 'Weekly report',
    steps: [
      { color: C.sharepoint, icon: '📄', title: 'Filed by your delivery team', sub: BOARDS.sp },
      { color: C.brain, icon: '🧠', title: 'Read automatically by the brain', sub: 'projects, phases, RAG, highlights and risks are lifted from the document' },
      SCREEN_STEP,
    ],
  },
  crm: {
    label: 'CRM data',
    steps: [
      { color: C.hubspot, icon: '🧡', title: 'Maintained by your team in HubSpot', sub: BOARDS.hs, sub2: 'stakeholders (with buying roles) and the deal pipeline' },
      { color: C.brain, icon: '🧠', title: 'Used for context, never edited', sub: 'buying power feeds opportunity scoring and leadership escalations', sub2: 'the ONLY write ever: a deal is created after a human approves an opportunity' },
      SCREEN_STEP,
    ],
  },
  person: {
    label: 'Person',
    steps: [
      { color: C.teams, icon: '🎥', title: 'Activity from transcribed calls', sub: 'calls attended, time and talk-share come from the transcripts themselves' },
      { color: C.monday, icon: '📋', title: 'Team from the Monday boards', sub: `${BOARDS.alloc}`, sub2: `consultants: ${BOARDS.assoc}` },
      SCREEN_STEP,
    ],
  },
}

export function ProvenanceButton(props: { signal?: Signal; call?: Call; accountId?: string; projectId?: string; preset?: keyof typeof PRESETS; refLabel?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const kind = props.signal ? 'signal' : props.call ? 'call' : props.accountId ? 'account' : props.projectId ? 'project' : (props.preset as string)
  const refId = props.signal?.id ?? props.call?.id ?? props.accountId ?? props.projectId ?? (props.preset as string) ?? ''
  const refLabel = props.refLabel ?? (props.signal?.summary?.slice(0, 80) ?? props.call?.title ?? (props.accountId ? accountName(props.accountId) : props.projectId ? projectById(props.projectId)?.name : PRESETS[props.preset ?? '']?.label) ?? '')
  const steps = props.signal ? stepsForSignal(props.signal)
    : props.call ? stepsForCall(props.call)
    : props.accountId ? stepsForAccount(props.accountId)
    : props.projectId ? stepsForProject(props.projectId)
    : PRESETS[props.preset ?? '']?.steps ?? []

  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true) }} title="Where does this come from?"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted-2 transition-colors hover:text-[var(--accent-d)]">
        <Route size={11} />{props.label ?? 'Source'}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[95] flex justify-end bg-black/35 backdrop-blur-[1px]" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full max-w-[420px] flex-col border-l border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
                  <div key={i}>
                    <div className="flex gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: `color-mix(in srgb, ${st.color} 30%, var(--line))`, background: `color-mix(in srgb, ${st.color} 5%, var(--surface))` }}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px]"
                        style={{ background: `color-mix(in srgb, ${st.color} 12%, var(--surface))`, boxShadow: `inset 0 0 0 1.5px ${st.color}` }}>
                        {st.icon}
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <div className="text-[12.5px] font-semibold leading-snug">{st.title}</div>
                        {st.sub && <div className="mt-0.5 text-[11px] leading-snug text-muted">{st.sub}</div>}
                        {st.sub2 && <div className="mt-0.5 text-[10.5px] leading-snug text-muted-2">{st.sub2}</div>}
                      </div>
                    </div>
                    {i < steps.length - 1 && (
                      <div className="flex justify-center py-1"><ArrowDown size={13} className="text-muted-2" /></div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 rounded-xl bg-bg-2 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-2">
                The brain never invents data - everything above comes from your own systems. Fix it at the source and it's fixed everywhere.
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
