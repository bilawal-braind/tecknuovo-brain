// ── Core domain types for the Tecknuovo "Second Brain" ──

export type SignalType = 'opportunity' | 'risk' | 'update' | 'people'
export type Health = 'green' | 'amber' | 'red'
export type Trend = 'improving' | 'steady' | 'declining'
export type Coverage = 'full' | 'limited' // full = has a Technovo Delivery Manager; limited = resource-only
export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type SignalStatus = 'new' | 'acknowledged' | 'routed' | 'actioned' | 'dismissed'

export type Person = { id: string; name: string; role: string }

export type Account = {
  id: string
  name: string
  pod: string
  coverage: Coverage
  health: Health
  trend: Trend
  clientDirector?: string // person id
  clientPartner?: string
  deliveryManager?: string // undefined for resource-only accounts
  sowValue: number // £
  budgetBurnPct: number // 0-100
  headroom: number // £ remaining
  lastContact: string // ISO date
  relationship: 'strong' | 'stable' | 'strained'
  valueAdds: number
  healthReason?: string // why the account is On track / Watch / At risk (derived from open signals)
}

export type Project = {
  id: string
  name: string
  accountId: string
  phase: 'Discovery' | 'Design' | 'Build' | 'Test' | 'Go-live' | 'Run'
  rag: Health
  deliveryManager?: string
  sprint: string // e.g. "Sprint 6 of 10"
  lastActivity: string // ISO date
  advisors: string[] // person ids of consultants staffed on the project
  spend: number // spend-to-date, GBP
  extension?: { status: 'In discussion' | 'Likely' | 'Agreed'; detail: string } // context on an extension/renewal
}

export type SourceCall = {
  title: string
  date: string // ISO
  type: 'Daily standup' | 'Weekly report' | 'Monthly governance' | 'Client kickoff' | 'Check-in'
  speaker: string
}

export type Signal = {
  id: string
  type: SignalType
  accountId: string
  projectId?: string
  pod: string
  sourceCall: SourceCall
  quote: string
  summary: string
  confidence: number // 0-100
  severity: Severity
  value?: string // commercial value or t-shirt size
  suggestedOwner: { person: string; role: string }
  suggestedAction: string
  status: SignalStatus
  createdAt: string // ISO
  // Framework scores carried through for the QA / evaluation layer (from the classifier).
  riskCategory?: string
  subtype?: string
  callId?: string
  likelihood?: number
  impact?: number
  networksTotal?: number
  band?: string
}

export type CadenceKind = 'standup' | 'weekly' | 'governance'
export type CadenceStatus = 'done' | 'missed' | 'overdue' | 'not-due'

export type Compliance = {
  projectId: string
  standup: CadenceStatus // expected daily, rolled up for the week
  weekly: CadenceStatus // Friday weekly report
  governance: CadenceStatus // monthly governance call
  note?: string
}

export type WeeklyReport = {
  projectId: string
  delivered: string[]
  focusNext: string[]
  risks: string[]
  confidence: number // how complete the auto-draft is, 0-100
}

export type ObservabilityCheck = {
  id: string
  check: string
  input: string
  output: string
  score: number // 0-100
  target: number
  trend: Trend
  lastRun: string
  samples: number
  overrides: number
  whatItTests: string
  suggestion: string
}

// ── display config ──

export const SIGNAL_META: Record<
  SignalType,
  { label: string; short: string; color: string; emoji: string; routesTo: string }
> = {
  opportunity: { label: 'Opportunity', short: 'Opp', color: 'var(--opp)', emoji: '🟢', routesTo: 'Client Partner, pipeline' },
  risk: { label: 'Risk', short: 'Risk', color: 'var(--risk)', emoji: '🔴', routesTo: 'Client Partner + Delivery Manager' },
  update: { label: 'Update', short: 'Update', color: 'var(--update)', emoji: '🔵', routesTo: 'Delivery dashboard' },
  people: { label: 'People', short: 'People', color: 'var(--people)', emoji: '🟡', routesTo: 'Talent + Delivery' },
}

export const HEALTH_COLOR: Record<Health, string> = {
  green: 'var(--rag-green)',
  amber: 'var(--rag-amber)',
  red: 'var(--rag-red)',
}
export const HEALTH_LABEL: Record<Health, string> = {
  green: 'On track',
  amber: 'Watch',
  red: 'At risk',
}

export const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
