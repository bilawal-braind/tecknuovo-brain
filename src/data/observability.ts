import type { ObservabilityCheck, SignalType } from './types'

// D4 Observability - one row per check, the AI's quality on the agreed standard.
export const observabilityChecks: ObservabilityCheck[] = [
  {
    id: 'risk', check: 'Risk classification', input: 'Call quotes', output: 'Risk signals', score: 92, target: 85, trend: 'steady',
    lastRun: '2026-06-16', samples: 40, overrides: 2,
    whatItTests: 'Are Risk signals labelled correctly, with no missed escalations?',
    suggestion: 'Maintaining well above target. Keep recall on Risk the top priority.',
  },
  {
    id: 'opp', check: 'Opportunity classification', input: 'Call quotes', output: 'Opportunity signals', score: 90, target: 85, trend: 'improving',
    lastRun: '2026-06-16', samples: 36, overrides: 3,
    whatItTests: 'Are growth/expansion hints picked up and labelled as Opportunity?',
    suggestion: 'Improved after adding governance-call examples to the golden set.',
  },
  {
    id: 'people', check: 'People classification', input: 'Call quotes', output: 'People signals', score: 78, target: 85, trend: 'declining',
    lastRun: '2026-06-16', samples: 14, overrides: 3,
    whatItTests: 'Are People signals (flight risk, stakeholder change) labelled correctly?',
    suggestion: 'Below the 85% target. Add edge-case examples and review with Chloe Hollinshead.',
  },
  {
    id: 'update', check: 'Update classification', input: 'Call quotes', output: 'Update signals', score: 95, target: 85, trend: 'steady',
    lastRun: '2026-06-16', samples: 30, overrides: 1,
    whatItTests: 'Are routine delivery updates labelled correctly and not over-flagged?',
    suggestion: 'Strong. Routine status is reliably separated from risk.',
  },
  {
    id: 'route', check: 'Routing accuracy', input: 'Signal + people map', output: 'Recipients', score: 95, target: 90, trend: 'steady',
    lastRun: '2026-06-16', samples: 50, overrides: 2,
    whatItTests: 'Does each signal reach the right Client Partner / DM / Talent?',
    suggestion: 'Above target. Two reroutes fed back into the routing map.',
  },
  {
    id: 'coverage', check: 'Capture coverage', input: 'Calls in', output: 'Calls captured', score: 96, target: 95, trend: 'steady',
    lastRun: '2026-06-16', samples: 120, overrides: 0,
    whatItTests: 'What share of calls are actually captured and transcribed?',
    suggestion: 'On target. The 4% gap is mostly resource-only accounts with no DM.',
  },
]

// ── Layer 2: the human-in-the-loop review queue ──
// Signals the AI classified that a human validates. Confirming / relabelling / rejecting
// each one is logged and feeds Stage 3 (the golden set + thresholds).
export type ReviewItem = {
  id: string
  accountId: string
  project: string
  call: string
  date: string
  quote: string // INPUT - the exact line from the call
  modelType: SignalType // MODEL OUTPUT - the label it assigned
  confidence: number
  reasoning: string // WHY - the model's own reasoning
}

export const reviewItems: ReviewItem[] = [
  { id: 'r1', accountId: 'nhs', project: 'NHS Data Infrastructure', call: 'NHS governance (emailed note)', date: '2026-06-06', quote: 'The new programme lead has their own preferred suppliers and is reviewing all contracts.', modelType: 'risk', confidence: 62, reasoning: 'A new sponsor reviewing all contracts puts the relationship and renewal at risk. Confidence is low because this came via an emailed note, not a captured call.' },
  { id: 'r2', accountId: 'voda3', project: 'Network Analytics', call: 'Vodafone standup', date: '2026-06-13', quote: "One associate flagged they're stretched across two workstreams and it is not sustainable.", modelType: 'risk', confidence: 64, reasoning: 'Read "not sustainable" as a delivery Risk. Note: stretched-associate language often points to a People signal instead - worth a human check.' },
  { id: 'r3', accountId: 'cabo', project: 'GOV.UK ICT Modernisation', call: 'GOV.UK check-in', date: '2026-06-12', quote: 'Morale on the team has dipped after the constant change requests from the client side.', modelType: 'people', confidence: 68, reasoning: 'Morale and team wellbeing is interpersonal, so classified as a People signal rather than a delivery Risk.' },
  { id: 'r4', accountId: 'gvms', project: 'GVMS Platform', call: 'GVMS weekly delivery report', date: '2026-06-13', quote: 'Velocity dropped for the second sprint running and the client flagged concern about the delivery date.', modelType: 'risk', confidence: 90, reasoning: 'Two consecutive sprints of dropping velocity plus an explicit client concern about go-live is a clear delivery Risk.' },
  { id: 'r5', accountId: 'mod', project: 'Salesforce Centre of Excellence', call: 'MOD monthly governance', date: '2026-06-12', quote: 'If this lands well we would want the same Centre of Excellence model rolled out to two more directorates.', modelType: 'opportunity', confidence: 87, reasoning: 'Client asking to expand the model to more directorates is a growth/expansion cue, so classified as an Opportunity.' },
  { id: 'r6', accountId: 'defra', project: 'Environmental Data Service', call: 'Defra weekly report', date: '2026-06-14', quote: 'Sprint 4 closed, all stories accepted, no carryover into the next sprint.', modelType: 'update', confidence: 94, reasoning: 'A clean sprint close with no carryover is routine status, so classified as a delivery Update and not over-flagged as a Risk.' },
  { id: 'r7', accountId: 'hawk', project: 'HAWK Risk Engine', call: 'HAWK monthly governance', date: '2026-06-15', quote: 'We are still waiting on the third-party integration and it is now squarely on our critical path.', modelType: 'risk', confidence: 84, reasoning: 'A third-party dependency on the critical path is a delivery blocker, so classified as a Risk.' },
  { id: 'r8', accountId: 'dwp', project: 'Universal Credit Data Platform', call: 'DWP weekly delivery report', date: '2026-06-15', quote: 'Procurement are sitting on the next statement of work and the current one runs out in three weeks.', modelType: 'risk', confidence: 85, reasoning: 'A stalled SOW with the current one expiring soon threatens continuity of work, so classified as a Risk.' },
]

// ── Layer 3: the learning loop ──
// Audit trail of human actions already fed back, the growing golden set, and the
// accuracy trend that rises as feedback accumulates.
export type FeedbackAction = 'Confirmed' | 'Relabelled' | 'Marked incorrect' | 'Added to golden set' | 'Rerouted'
export type FeedbackEntry = {
  id: string
  date: string
  reviewer: string
  action: FeedbackAction
  target: string
  detail: string
  feeds: string
}

export const feedbackLog: FeedbackEntry[] = [
  { id: 'f1', date: '2026-06-16', reviewer: 'Chloe Hollinshead', action: 'Relabelled', target: 'NHS CNWL', detail: 'Risk → People (sponsor change is a stakeholder signal)', feeds: 'Golden set · People recall improving' },
  { id: 'f2', date: '2026-06-16', reviewer: 'Meesha Chotai', action: 'Confirmed', target: 'MOD', detail: 'Opportunity on the CoE rollout confirmed as a true call', feeds: 'Golden set · Opportunity examples' },
  { id: 'f3', date: '2026-06-15', reviewer: 'Rauly Vasir', action: 'Marked incorrect', target: 'Defra', detail: 'Routine status over-flagged as a Risk (false positive)', feeds: 'Stage 3 tuning · threshold raised' },
  { id: 'f4', date: '2026-06-14', reviewer: 'Chloe Hollinshead', action: 'Rerouted', target: 'DWP', detail: 'Risk sent to the right Client Partner', feeds: 'Routing map updated' },
  { id: 'f5', date: '2026-06-13', reviewer: 'Meesha Chotai', action: 'Added to golden set', target: 'GVMS', detail: 'Velocity-slip Risk promoted as a reference example', feeds: 'Stage 3 examples' },
]

export const accuracyTrend = [
  { week: 'May 12', score: 82 },
  { week: 'May 19', score: 84 },
  { week: 'May 26', score: 85 },
  { week: 'Jun 02', score: 87 },
  { week: 'Jun 09', score: 89 },
  { week: 'Jun 16', score: 91 },
]

export const goldenSetSize = 148
