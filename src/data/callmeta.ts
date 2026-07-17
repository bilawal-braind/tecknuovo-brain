// Call-level metadata for Delivery Intel: type colours, estimated duration,
// sentiment and project progress. Everything here is DETERMINISTIC - derived
// from the call/project record or a stable hash of its id, never random - so
// the dashboard shows the same numbers on every load.
import type { Call } from './calls'
import type { Project } from './types'

export const CALL_TYPES = ['Daily standup', 'Weekly report', 'Monthly governance', 'Client kickoff', 'Check-in'] as const

export const CALL_TYPE_COLOR: Record<Call['type'], string> = {
  'Daily standup': '#1A8B91',
  'Weekly report': '#1F62C4',
  'Monthly governance': '#7C5CFF',
  'Client kickoff': '#E68A00',
  'Check-in': '#5C7C8A',
}

const hash = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Estimated minutes in the call. Where we have the transcript's speaker line
// counts, length follows the conversation (~3 lines/minute, rounded to 5).
// Otherwise a sensible per-type baseline with a stable per-call variation.
const TYPE_MINUTES: Record<Call['type'], number> = {
  'Daily standup': 15,
  'Weekly report': 30,
  'Monthly governance': 45,
  'Client kickoff': 60,
  'Check-in': 25,
}
export function callMinutes(c: Call): number {
  const lines = c.speakers ? Object.values(c.speakers).reduce((a, b) => a + b, 0) : 0
  if (lines >= 12) return Math.max(10, Math.min(90, Math.round(lines / 15) * 5))
  return TYPE_MINUTES[c.type] + (hash(c.id) % 3) * 5
}

export const hoursLabel = (mins: number) => (mins >= 60 ? `${Math.round((mins / 60) * 10) / 10}h` : `${mins}m`)

// Sentiment of a call, -1..1. Signal-bearing calls score from what was actually
// flagged (opportunities lift, risks weigh); quiet calls sit near neutral with a
// stable per-call lean, the way an uneventful check-in reads in the room.
export function callSentiment(c: Call): number {
  if (c.signals.length) {
    let s = 0
    for (const x of c.signals) s += x.type === 'opportunity' ? 1 : x.type === 'update' ? 0.35 : x.type === 'risk' ? -1 : -0.2
    return Math.max(-1, Math.min(1, s / c.signals.length))
  }
  return ((hash(c.id) % 7) - 2) / 10
}

export type SentimentBand = 'positive' | 'neutral' | 'negative'
export const sentimentBand = (v: number): SentimentBand => (v > 0.15 ? 'positive' : v < -0.15 ? 'negative' : 'neutral')
export const SENTIMENT_COLOR: Record<SentimentBand, string> = {
  positive: 'var(--opp)',
  neutral: 'var(--line-2)',
  negative: 'var(--risk)',
}

// Progress through the engagement, %: the sprint plan when stated ("Sprint 6 of
// 10" -> 60%), else the delivery phase reached.
const PHASES = ['Discovery', 'Design', 'Build', 'Test', 'Go-live', 'Run']
export function projectProgress(p: Project): number {
  const m = p.sprint?.match(/(\d+)\s*of\s*(\d+)/i)
  if (m) return Math.min(100, Math.round((100 * +m[1]) / Math.max(1, +m[2])))
  return Math.round((100 * (PHASES.indexOf(p.phase) + 1)) / PHASES.length)
}
