// Maps API rows -> the dashboard's existing domain types. The DB is sparser than
// the demo model, so fields the pipeline doesn't (yet) produce get safe defaults.
// As the pipeline grows richer, fill these in here only - the UI never changes.
import type { Account, Project, Signal, SignalType, SignalStatus, Severity, Health, SourceCall } from './types'
import type { ApiAccount, ApiProject, ApiSignal } from './api'

// Infer the call type from its title (governance / standup / weekly / kickoff).
export function inferCallType(title: string | null): SourceCall['type'] {
  const t = (title || '').toLowerCase()
  if (t.includes('governance')) return 'Monthly governance'
  if (t.includes('standup') || t.includes('stand-up')) return 'Daily standup'
  if (t.includes('weekly')) return 'Weekly report'
  if (t.includes('kick')) return 'Client kickoff'
  return 'Check-in'
}

const TODAY = new Date().toISOString().slice(0, 10)
const toDate = (ts: string | null) => (ts || '').slice(0, 10) || TODAY
const num = (v: number | string | null | undefined) => {
  const n = typeof v === 'string' ? Number(v) : v ?? 0
  return Number.isFinite(n as number) ? (n as number) : 0
}

const HEALTHS: Health[] = ['green', 'amber', 'red']
const asHealth = (v: string | null): Health => (HEALTHS.includes((v || '') as Health) ? (v as Health) : 'green')

const STATUSES: SignalStatus[] = ['new', 'acknowledged', 'routed', 'actioned', 'dismissed']
const asStatus = (v: string | null): SignalStatus =>
  STATUSES.includes((v || '') as SignalStatus) ? (v as SignalStatus) : 'new'

// The classifier may label types as "Opportunity", "Delivery update", "risk", etc.
export function mapSignalType(raw: string): SignalType {
  const t = (raw || '').toLowerCase()
  if (t.includes('opp')) return 'opportunity'
  if (t.includes('risk')) return 'risk'
  if (t.includes('people') || t.includes('talent')) return 'people'
  return 'update'
}

const SEVS: Severity[] = ['low', 'medium', 'high', 'critical']
function asSeverity(details: unknown, confidence: number): Severity {
  const d = (details && typeof details === 'object' ? details : {}) as Record<string, unknown>
  const explicit = String(d.severity ?? '').toLowerCase()
  if (SEVS.includes(explicit as Severity)) return explicit as Severity
  const band = String(d.risk_band ?? d.band ?? '').toLowerCase()
  if (band.includes('critical') || band.includes('severe') || band.includes('extreme')) return 'critical'
  if (band.includes('high')) return 'high'
  if (band.includes('low') || band.includes('minor')) return 'low'
  return confidence >= 90 ? 'high' : confidence >= 75 ? 'medium' : 'low'
}

function valueOf(details: unknown): string | undefined {
  const d = (details && typeof details === 'object' ? details : {}) as Record<string, unknown>
  const v = d.value ?? d.commercial_value ?? d.sow_value
  return v == null ? undefined : String(v)
}

export const mapAccount = (a: ApiAccount): Account => ({
  id: a.id,
  name: a.name,
  pod: a.pod ?? '',
  coverage: 'full',
  health: asHealth(a.health),
  trend: 'steady',
  sowValue: 0, // aggregated from projects in bootstrap
  budgetBurnPct: num(a.budget_burn_pct),
  headroom: num(a.headroom),
  lastContact: TODAY,
  relationship: 'stable',
  valueAdds: 0,
})

export const mapProject = (p: ApiProject): Project => ({
  id: p.id,
  name: p.name,
  accountId: p.account_id,
  phase: 'Build',
  rag: asHealth(p.rag),
  sprint: '',
  lastActivity: toDate(p.end_date),
  advisors: [],
  spend: num(p.spend),
})

export const mapSignal = (s: ApiSignal): Signal => {
  const confidence = num(s.confidence)
  const d: Record<string, unknown> = s.details && typeof s.details === 'object' ? (s.details as Record<string, unknown>) : {}
  const asNum = (v: unknown) => (typeof v === 'number' ? v : undefined)
  return {
    id: s.id,
    type: mapSignalType(s.type),
    accountId: s.account_id ?? '',
    projectId: s.project_id ?? undefined,
    pod: '',
    sourceCall: { title: s.project || s.account || 'Call', date: toDate(s.created_at), type: 'Weekly report', speaker: '' },
    quote: s.quote ?? '',
    summary: s.summary ?? '',
    confidence,
    severity: asSeverity(s.details, confidence),
    value: valueOf(s.details),
    suggestedOwner: { person: '-', role: '' },
    suggestedAction: s.suggested_action ?? '',
    status: asStatus(s.status),
    createdAt: toDate(s.created_at),
    riskCategory: typeof d.risk_category === 'string' ? d.risk_category.replace(/^\s*\d+[\s.·-]*/, '') : undefined,
    subtype: s.subtype ?? undefined,
    escalate: d.escalate === true,
    raisedBy: typeof d.raised_by === 'string' && d.raised_by ? d.raised_by : undefined,
    mentions: asNum(typeof d.mentions === 'string' ? Number(d.mentions) : d.mentions),
    lastSeen: typeof d.last_seen === 'string' ? d.last_seen.slice(0, 10) : undefined,
    callId: s.call_id ?? undefined,
    likelihood: asNum(d.likelihood),
    impact: asNum(d.impact),
    networksTotal: asNum(d.networks_total),
    band: typeof d.band === 'string' ? d.band : undefined,
  }
}
