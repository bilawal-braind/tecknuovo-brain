// Thin typed client for the Read API. One place that knows about HTTP, the base
// URL and the auth header; everything above this layer works in domain types.
import { API_URL, API_TOKEN } from './source'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
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
    headers: { 'Content-Type': 'application/json', ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}) },
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
export const submitFeedback = (signalId: string, verdict: 'correct' | 'incorrect', givenBy?: string) =>
  post<{ id: string }>('/api/feedback', { signal_id: signalId, verdict, given_by: givenBy })
