// Thin typed client for the Read API. One place that knows about HTTP, the base
// URL and the auth header; everything above this layer works in domain types.
import { API_URL, API_TOKEN } from './source'
import { getAuthToken } from './auth'

// The signed-in user's token (Entra SSO) if present, else the dev token.
const bearer = () => getAuthToken() || API_TOKEN

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: bearer() ? { Authorization: `Bearer ${bearer()}` } : {},
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GET ${path} -> ${res.status} ${res.statusText}${body ? ` (${body.slice(0, 200)})` : ''}`)
  }
  return (await res.json()) as T
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(bearer() ? { Authorization: `Bearer ${bearer()}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`)
  return (await res.json()) as T
}

// ── Shapes the API actually returns (snake_case, nullable as the DB allows) ──
export type ApiAccount = {
  id: string
  name: string
  pod: string | null
  health: string | null
  open_signals: number
  budget_burn_pct: number | string | null
  headroom: number | string | null
  client_partner_name?: string | null
  delivery_lead?: string | null
}

export type ApiProject = {
  id: string
  name: string
  account_id: string
  sow_value: number | string | null
  sow_status: string | null
  rag: string | null
  start_date: string | null
  end_date: string | null
  budget_remaining: number | string | null
  spend: number | string | null
  delivery_manager_name: string | null
}

export type ApiSignal = {
  id: string
  type: string
  subtype: string | null
  summary: string | null
  quote: string | null
  suggested_action: string | null
  confidence: number | string | null
  status: string | null
  details: unknown
  created_at: string
  account: string | null
  project: string | null
  account_id: string | null
  project_id: string | null
  call_id: string | null
}

export type ApiCall = {
  id: string
  account_id: string | null
  project_id: string | null
  title: string | null
  call_date: string | null
  transcript: string | null
  source: string | null
}

export type ApiAssociate = {
  id: string
  name: string
  account_id: string | null
  project_or_programme: string | null
  placement_status: string | null
}

export const fetchAccounts = () => get<ApiAccount[]>('/api/accounts')
export const fetchProjects = () => get<ApiProject[]>('/api/projects')
export const fetchSignals = () => get<ApiSignal[]>('/api/signals?limit=200')
export const fetchCalls = () => get<ApiCall[]>('/api/calls')
export const fetchAssociates = () => get<ApiAssociate[]>('/api/associates')

// ── Weekly reports + CRM mirror (HubSpot, read-only) ──
export type ApiWeeklyReport = {
  id: string
  week_ending: string
  project_title: string
  account_id: string | null
  account_name: string | null
  rag: string | null
  customer_lead: string | null
  phase: string | null
  summary: string | null
  highlights: string | null
  lowlights: string | null
  next_week: string | null
  risks: string | null
}
export type ApiStakeholder = {
  id: string
  name: string
  job_title: string | null
  buying_role: string | null
  seniority: string | null
  account_id: string | null
  company_name: string | null
}
export type ApiDeal = {
  id: string
  name: string
  amount: number | string | null
  pipeline: string | null
  stage: string | null
  is_open: boolean
  networks_score: number | string | null
  close_date: string | null
  account_id: string | null
  company_name: string | null
}
// Tolerant fetchers: an older API without these endpoints just yields empty lists.
export const fetchWeeklyReports = () => get<ApiWeeklyReport[]>('/api/weekly-reports').catch(() => [] as ApiWeeklyReport[])
export const fetchStakeholders = () => get<ApiStakeholder[]>('/api/stakeholders').catch(() => [] as ApiStakeholder[])
export const fetchDeals = () => get<ApiDeal[]>('/api/deals').catch(() => [] as ApiDeal[])

// ── QA & Evaluation ──
export type QaAuditRow = {
  id: string
  type: string
  summary: string | null
  quote: string | null
  confidence: number | string | null
  details: unknown
  account: string | null
  project: string | null
  call_title: string | null
  created_at: string
  verdict: string | null
}
export type QaData = {
  totals: { signals: number; calls: number; reviewed: number; agreed: number }
  byType: { type: string; n: number; avg_conf: number | null }[]
  audit: QaAuditRow[]
}
export const fetchQA = () => get<QaData>('/api/qa')

// ── Who am I (role + scope from the signed-in token) ──
export type Me = { email: string; role: string; scope: string; name: string | null }
export const fetchMe = () => get<Me>('/api/me')
// Human approval on an opportunity -> queue the HubSpot deal push (workflow 11 pushes).
export const pushToHubspot = (signalId: string, approve: boolean, givenBy?: string) =>
  post<{ id: string; status: string }>('/api/hubspot-push', { signal_id: signalId, approve, given_by: givenBy })

export const submitFeedback = (
  signalId: string,
  verdict: 'correct' | 'incorrect' | 'relabel',
  opts?: { correctType?: string; reason?: string },
) => post<{ id: string }>('/api/feedback', { signal_id: signalId, verdict, correct_type: opts?.correctType, reason: opts?.reason })
