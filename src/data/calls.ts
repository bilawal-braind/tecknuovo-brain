import type { Signal, SourceCall, SignalType } from './types'
import { signals } from './signals'
import { personName, projectById } from './org'

// A "call" is the source Teams call a signal was captured from. Several signals can
// come from one call, so we group the signal stream back up into the calls layer.
export type Call = {
  id: string
  title: string
  date: string
  type: SourceCall['type']
  speaker: string
  accountId: string
  projectId?: string
  signals: Signal[]
  transcript?: string
}

const byKey = new Map<string, Call>()
for (const s of signals) {
  const key = `${s.sourceCall.title}__${s.sourceCall.date}`
  let c = byKey.get(key)
  if (!c) {
    c = {
      id: key,
      title: s.sourceCall.title,
      date: s.sourceCall.date,
      type: s.sourceCall.type,
      speaker: s.sourceCall.speaker,
      accountId: s.accountId,
      projectId: s.projectId,
      signals: [],
    }
    byKey.set(key, c)
  }
  c.signals.push(s)
}

export const calls: Call[] = [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date))

export const callsForAccount = (accountId: string) => calls.filter((c) => c.accountId === accountId)
export const callsForProject = (projectId: string) => calls.filter((c) => c.projectId === projectId)
export const callForSignal = (signal: Signal) => calls.find((c) => c.signals.some((s) => s.id === signal.id))

// ── Transcript (representative): the real captured quotes are the highlighted moments,
// framed with natural surrounding turns. In production this is the full Teams transcript. ──
export type TranscriptLine = { speaker: string; text: string; signalType?: SignalType }

// Prefer the REAL stored transcript (from the DB / snapshot) when present — parse it into
// "Speaker: text" lines, skipping metadata/header lines. Falls back to the representative
// transcript for demo/mock rows that don't carry one.
export function transcriptLinesFor(call: Call): TranscriptLine[] {
  const raw = call.transcript
  if (raw && raw.trim()) {
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^\[.*\]$/.test(l) && !/^(Date|Attendees)\s*:/i.test(l))
      .map((line) => {
        const m = line.match(/^([A-Za-z0-9 .,'()/&-]{1,60}?):\s*(.+)$/)
        return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: '', text: line }
      })
  }
  return transcriptFor(call)
}

const ACK: Record<SignalType, string> = {
  risk: 'Understood - we will get a plan together on that and come back to you.',
  opportunity: 'Good to hear - we will scope it and bring an outline to the next session.',
  people: 'Noted - we will sort the resourcing side and keep you posted.',
  update: 'Thanks, that is helpful - we will keep it moving.',
}

export function transcriptFor(call: Call): TranscriptLine[] {
  const proj = call.projectId ? projectById(call.projectId) : undefined
  const host = proj?.deliveryManager ? personName(proj.deliveryManager) : 'Tecknuovo team'
  const lines: TranscriptLine[] = [
    { speaker: host, text: `Thanks for joining the ${call.type.toLowerCase()}. Let's walk through where we are.` },
  ]
  for (const s of call.signals) {
    lines.push({ speaker: s.sourceCall.speaker, text: s.quote, signalType: s.type })
    lines.push({ speaker: host, text: ACK[s.type] })
  }
  lines.push({ speaker: host, text: 'Great - I will capture the actions and follow up. Thanks everyone.' })
  return lines
}
