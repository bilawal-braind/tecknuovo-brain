// Automated quality checks on every signal — the same deterministic maths as the Phoenix
// eval, but computed in the browser so the dashboard can show it (works live + demo, no API).
// Basis: the call TRANSCRIPT (groundedness) and TN's own FRAMEWORKS (validity + calibration).
import { signals as allSignals } from './signals'
import { calls } from './calls'
import type { Signal, SignalType } from './types'

const norm = (s?: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()

function transcriptFor(sig: Signal): string {
  const c = calls.find((call) => call.signals.some((x) => x.id === sig.id))
  if (c?.transcript) return norm(c.transcript)
  return norm(calls.map((call) => call.transcript || '').join(' '))
}

// 1.0 if the signal's quote is in the transcript; else the share of its words that are.
export function groundedness(sig: Signal): number {
  const q = norm(sig.quote)
  if (!q) return 0
  const ctx = transcriptFor(sig)
  if (!ctx) return 1 // no transcript to check against (built-in demo) — don't penalise
  if (ctx.includes(q)) return 1
  const w = q.split(' ').filter((x) => x.length > 3)
  return w.length ? Math.round((w.filter((x) => ctx.includes(x)).length / w.length) * 100) / 100 : 0
}

// Risk must carry likelihood+impact (1-5); opportunity a NETWORKS total (0-40).
export function frameworkValidity(sig: Signal): number {
  if (sig.type === 'risk')
    return sig.likelihood != null && sig.impact != null && sig.likelihood >= 1 && sig.likelihood <= 5 && sig.impact >= 1 && sig.impact <= 5 ? 1 : 0
  if (sig.type === 'opportunity')
    return sig.networksTotal != null && sig.networksTotal > 0 && sig.networksTotal <= 40 ? 1 : 0
  return 1
}

// Does the stored confidence match the framework maths (L×I/25, NETWORKS/40)?
export function calibration(sig: Signal): number {
  let expected: number | null = null
  if (sig.type === 'risk' && sig.likelihood && sig.impact) expected = ((sig.likelihood * sig.impact) / 25) * 100
  else if (sig.type === 'opportunity' && sig.networksTotal) expected = (sig.networksTotal / 40) * 100
  if (expected == null) return 1
  return Math.max(0, 1 - Math.abs((sig.confidence ?? 0) - expected) / 100)
}

export type EvalRow = { id: string; type: SignalType; g: number; f: number; c: number }
export type EvalSummary = {
  n: number
  groundedness: number
  frameworkValidity: number
  calibration: number
  perSignal: EvalRow[]
}

export function evalSummary(list: Signal[] = allSignals): EvalSummary {
  const perSignal: EvalRow[] = list.map((s) => ({
    id: s.id, type: s.type, g: groundedness(s), f: frameworkValidity(s), c: calibration(s),
  }))
  const avg = (k: 'g' | 'f' | 'c') =>
    perSignal.length ? Math.round((perSignal.reduce((t, x) => t + x[k], 0) / perSignal.length) * 1000) / 10 : 0
  return {
    n: perSignal.length,
    groundedness: avg('g'),
    frameworkValidity: avg('f'),
    calibration: avg('c'),
    perSignal,
  }
}
