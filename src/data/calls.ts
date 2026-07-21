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
  // Whether the DB row holds a transcript (the live /calls list is metadata-only, so
  // the text itself loads on demand). undefined = unknown -> try the fetch.
  hasTranscript?: boolean
  speakers?: Record<string, number>
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

// A call belongs on an account page when it's the account's own call OR when any of
// its signals were filed to that account - internal multi-client calls (and manually
// re-filed signals) surface on every account they actually concern.
export const callsForAccount = (accountId: string) =>
  calls.filter((c) => c.accountId === accountId || c.signals.some((s) => s.accountId === accountId))
export const callsForProject = (projectId: string) => calls.filter((c) => c.projectId === projectId)
export const callForSignal = (signal: Signal) => calls.find((c) => c.signals.some((s) => s.id === signal.id))

// ── Transcript (representative): the real captured quotes are the highlighted moments,
// framed with natural surrounding turns. In production this is the full Teams transcript. ──
export type TranscriptLine = { speaker: string; text: string; signalTypes?: SignalType[] }
// One entry per signal on the call: which transcript line its quote lives on.
// line=null only when nothing in the transcript resembles the quote at all.
export type CapturedMoment = { type: SignalType; line: number | null }

// Prefer the REAL stored transcript (from the DB / snapshot) when present - parse it into
// "Speaker: text" lines, skipping metadata/header lines. Falls back to the representative
// transcript for demo/mock rows that don't carry one.
export function transcriptLinesFor(call: Call): TranscriptLine[] {
  return transcriptWithMoments(call).lines
}

export function transcriptWithMoments(call: Call): { lines: TranscriptLine[]; moments: CapturedMoment[] } {
  const raw = call.transcript
  if (raw && raw.trim()) {
    const lines: TranscriptLine[] = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^\[.*\]$/.test(l) && !/^(Date|Attendees)\s*:/i.test(l))
      .map((line) => {
        // Teams speaker labels can carry pronouns ("Horton, Shaun | He/His") and the
        // odd leading colon from the VTT parse. Match generously, then clean.
        const m = line.match(/^:?\s*(.{1,70}?):\s+(.+)$/)
        if (!m) return { speaker: '', text: line.replace(/^:\s*/, '') }
        const speaker = m[1].replace(/\s*\|.*$/, '').replace(/^:\s*/, '').trim()
        return { speaker, text: m[2].trim() }
      })
    const normed = lines.map((l) => normText(l.text))
    const words = lines.map((l) => contentWords(l.text))
    // EVERY signal gets a moment. A line can carry several signals (Teams merges
    // consecutive turns into long monologues, so two quotes often share a line).
    const moments: CapturedMoment[] = call.signals.map((s) => {
      const idx = findQuoteLine(normed, words, s.quote)
      if (idx >= 0) {
        const l = lines[idx]
        lines[idx] = { ...l, signalTypes: [...(l.signalTypes ?? []), s.type] }
      }
      return { type: s.type, line: idx >= 0 ? idx : null }
    })
    return { lines, moments }
  }
  const lines = transcriptFor(call)
  const moments: CapturedMoment[] = []
  lines.forEach((l, i) => (l.signalTypes ?? []).forEach((t) => moments.push({ type: t, line: i })))
  return { lines, moments }
}

// Find the transcript line a signal's quote was captured from. Three passes, strict
// to loose: exact head-of-quote probes (normalised: case/punctuation/em-dash-proof),
// reverse containment (a short line inside a long quote), then a distinctive-word
// overlap - because the classifier sometimes compresses or stitches its quote, and
// an approximate anchor into the right part of the conversation beats no anchor.
const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const contentWords = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5))

// Verbatim-or-nothing: head probes and containment only - no fuzzy fallback.
// Used where a wrong anchor is worse than no anchor (the early-radar evidence).
function findQuoteLineStrict(normed: string[], quote: string): number {
  const nq = normText(quote)
  if (nq.length < 12) return -1
  for (const len of [96, 56, 32, 18]) {
    const probe = nq.slice(0, len)
    if (probe.length < 12) break
    const idx = normed.findIndex((t) => t.includes(probe))
    if (idx >= 0) return idx
  }
  return normed.findIndex((t) => t.length >= 20 && nq.includes(t))
}

function findQuoteLine(normed: string[], words: Set<string>[], quote: string): number {
  const nq = normText(quote)
  if (nq.length >= 12) {
    for (const len of [96, 56, 32, 18]) {
      const probe = nq.slice(0, len)
      if (probe.length < 12) break
      const idx = normed.findIndex((t) => t.includes(probe))
      if (idx >= 0) return idx
    }
    const contained = normed.findIndex((t) => t.length >= 20 && nq.includes(t))
    if (contained >= 0) return contained
  }
  const qw = contentWords(quote)
  if (!qw.size) return -1
  let best = -1
  let bestScore = 0
  for (let i = 0; i < words.length; i++) {
    let score = 0
    for (const w of qw) if (words[i].has(w)) score++
    if (score > bestScore) { bestScore = score; best = i }
  }
  // At least two distinctive words shared (or the whole quote if it's tiny).
  return bestScore >= Math.min(2, qw.size) ? best : -1
}

// A window of conversation around a quote - the "read the context" view used by
// the Leadership macro cards. Returns the surrounding lines with the hit marked.
export function snippetAround(lines: TranscriptLine[], quote: string, context = 2, strict = false): { lines: TranscriptLine[]; hit: number } | null {
  const normed = lines.map((l) => normText(l.text))
  const words = lines.map((l) => contentWords(l.text))
  const idx = strict ? findQuoteLineStrict(normed, quote) : findQuoteLine(normed, words, quote)
  if (idx < 0) return null
  const start = Math.max(0, idx - context)
  return { lines: lines.slice(start, Math.min(lines.length, idx + context + 1)), hit: idx - start }
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
    lines.push({ speaker: s.sourceCall.speaker, text: s.quote, signalTypes: [s.type] })
    lines.push({ speaker: host, text: ACK[s.type] })
  }
  lines.push({ speaker: host, text: 'Great - I will capture the actions and follow up. Thanks everyone.' })
  return lines
}
