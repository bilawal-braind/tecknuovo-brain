// Runs once before React mounts.
//   'live' -> fetches the real org + signals + calls from the Read API (the VM build).
//   otherwise (the public build) -> if src/data/snapshot.json holds real pipeline output,
//             it's fed through the SAME mapping as 'live' and shown exactly like normal data
//             across every tab; if empty/unreadable, the built-in dataset is kept.
// Either way the shared data arrays are hydrated IN PLACE, so every component that imports
// `accounts` / `projects` / `signals` / `calls` sees the data with no further wiring.
//
// Note: compliance, weekly reports, trends and observability are not produced by the
// pipeline yet, so they stay as demo data in all modes.
import { isLive } from './source'
import { fetchAccounts, fetchProjects, fetchSignals, fetchCalls, fetchAssociates, fetchWeeklyReports, fetchStakeholders, fetchDeals } from './api'
import { weeklyReports, stakeholders, deals } from './crm'
import { mapAccount, mapProject, mapSignal, inferCallType } from './map'
import { accounts, projects, people, advisors } from './org'
import { signals } from './signals'
import { calls } from './calls'
import type { Call } from './calls'
import type { ApiAccount, ApiProject, ApiSignal, ApiCall, ApiAssociate } from './api'
import type { Person, Health, Signal } from './types'

// Replace an array's contents while keeping the same reference (live ESM binding).
function replace<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next)
}

// Account health = a defensible read of the OPEN signals on the account, not a blunt
// "any risk => red". Severity is weighted, and positive momentum (more opportunities than
// risks) softens the rating by one level. Returns the RAG plus a short human reason.
function deriveAccountHealth(sigs: Signal[]): { health: Health; reason: string } {
  const open = sigs.filter((s) => s.status !== 'actioned' && s.status !== 'dismissed')
  if (!open.length) return { health: 'green', reason: 'No open signals' }

  const risks = open.filter((s) => s.type === 'risk')
  const opps = open.filter((s) => s.type === 'opportunity')
  const critical = risks.filter((s) => s.severity === 'critical').length
  const high = risks.filter((s) => s.severity === 'high').length
  const otherRisks = risks.length - critical - high

  let health: Health
  if (critical >= 1 || high >= 2) health = 'red'      // a critical, or multiple serious risks
  else if (high >= 1 || risks.length >= 2) health = 'amber' // one serious risk, or a few smaller ones
  else health = 'green'

  // Clear positive momentum softens one level (an account winning more than it's losing
  // isn't "at risk" on the strength of a single issue).
  const softened = opps.length > risks.length
  if (softened) health = health === 'red' ? 'amber' : 'green'

  const parts: string[] = []
  if (critical) parts.push(`${critical} critical risk${critical > 1 ? 's' : ''}`)
  if (high) parts.push(`${high} high-severity risk${high > 1 ? 's' : ''}`)
  if (otherRisks > 0) parts.push(`${otherRisks} lower risk${otherRisks > 1 ? 's' : ''}`)
  if (opps.length) parts.push(`${opps.length} opportunit${opps.length > 1 ? 'ies' : 'y'}`)
  let reason = parts.join(' · ') || `${open.length} open signal${open.length > 1 ? 's' : ''}`
  if (softened) reason += ' · opportunities outweigh risks'
  return { health, reason }
}

export type BootResult = {
  source: 'mock' | 'live'
  counts?: { accounts: number; projects: number; signals: number; calls: number }
  error?: string
}

type Rows = {
  aRows: ApiAccount[]
  pRows: ApiProject[]
  sRows: ApiSignal[]
  cRows: ApiCall[]
  asRows: ApiAssociate[]
}

// The one place that turns API/snapshot rows into the dashboard's data arrays.
function hydrate({ aRows, pRows, sRows, cRows, asRows }: Rows): BootResult['counts'] {
  const liveAccounts = aRows.map(mapAccount)
  const liveProjects = pRows.map(mapProject)
  const liveSignals = sRows.map(mapSignal)

  // SOW value lives on projects in the DB; roll it up to the account for the UI.
  for (const acc of liveAccounts) {
    acc.sowValue = pRows
      .filter((p) => p.account_id === acc.id)
      .reduce((sum, p) => sum + (typeof p.sow_value === 'string' ? Number(p.sow_value) || 0 : p.sow_value ?? 0), 0)
  }

  // People: synthesise a person per Delivery Manager name (from Monday).
  const dmPeople = new Map<string, Person>()
  pRows.forEach((p, i) => {
    const nm = p.delivery_manager_name
    if (nm) {
      const id = 'dm-' + nm.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      if (!dmPeople.has(id)) dmPeople.set(id, { id, name: nm, role: 'Delivery Manager' })
      liveProjects[i].deliveryManager = id
    }
  })

  // Consultants (associates) -> people + project.advisors (linked by team/programme match).
  const consultantPeople: Person[] = asRows.map((as) => ({ id: 'as-' + as.id, name: as.name, role: 'Associate' }))
  asRows.forEach((as) => {
    const pop = (as.project_or_programme || '').toLowerCase()
    const proj = liveProjects.find((p) => {
      if (p.accountId !== as.account_id) return false
      const toks = p.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3)
      return toks.some((t) => pop.includes(t))
    })
    if (proj) proj.advisors.push('as-' + as.id)
  })

  // Real call metadata, keyed by id, so signals carry the true call title/date/type.
  const callMeta = new Map<string, ApiCall>(cRows.map((c) => [c.id, c] as [string, ApiCall]))
  sRows.forEach((row, i) => {
    const c = row.call_id ? callMeta.get(row.call_id) : undefined
    if (c) {
      liveSignals[i].sourceCall = {
        title: c.title || liveSignals[i].sourceCall.title,
        date: (c.call_date || '').slice(0, 10) || liveSignals[i].createdAt,
        type: inferCallType(c.title),
        speaker: liveSignals[i].sourceCall.speaker,
      }
    }
  })

  // Group the live signals back up into their calls (the "calls" layer), carrying transcript.
  const byCall = new Map<string, Call>()
  sRows.forEach((row, i) => {
    const cid = row.call_id
    if (!cid) return
    const meta = callMeta.get(cid)
    let call = byCall.get(cid)
    if (!call) {
      call = {
        id: cid,
        title: meta?.title || 'Call',
        date: (meta?.call_date || '').slice(0, 10) || liveSignals[i].createdAt,
        type: inferCallType(meta?.title ?? null),
        speaker: '',
        accountId: meta?.account_id || liveSignals[i].accountId,
        projectId: meta?.project_id || liveSignals[i].projectId || undefined,
        signals: [],
        transcript: meta?.transcript || undefined,
      }
      byCall.set(cid, call)
    }
    call.signals.push(liveSignals[i])
  })
  const liveCalls = [...byCall.values()].sort((a, b) => b.date.localeCompare(a.date))

  // Last contact / last activity = the most recent call on the account / project.
  for (const acc of liveAccounts) {
    const cs = liveCalls.filter((c) => c.accountId === acc.id)
    if (cs.length) acc.lastContact = cs[0].date
  }
  for (const pr of liveProjects) {
    const cs = liveCalls.filter((c) => c.projectId === pr.id)
    if (cs.length) pr.lastActivity = cs[0].date
  }

  // Recompute account health from the actual open signals (overrides the API's blunt
  // "any high risk => red"), so the portfolio reads as a sensible RAG mix with a reason.
  for (const acc of liveAccounts) {
    const h = deriveAccountHealth(liveSignals.filter((s) => s.accountId === acc.id))
    acc.health = h.health
    acc.healthReason = h.reason
  }

  replace(accounts, liveAccounts)
  replace(projects, liveProjects)
  replace(signals, liveSignals)
  replace(calls, liveCalls)
  if (dmPeople.size || consultantPeople.length) replace(people, [...dmPeople.values(), ...consultantPeople])
  if (consultantPeople.length) replace(advisors, consultantPeople)

  return {
    accounts: liveAccounts.length,
    projects: liveProjects.length,
    signals: liveSignals.length,
    calls: liveCalls.length,
  }
}

// Turn the raw DB snapshot (json_build_object export) into API-shaped rows, computing the
// derived fields the Read API normally adds in SQL (health, open_signals, burn, rag, spend).
async function loadSnapshotRows(): Promise<Rows> {
  const mod = (await import('./snapshot.json')) as { default?: unknown }
  const raw = (mod.default ?? mod) as unknown
  const wrap = Array.isArray(raw) ? (raw[0] as Record<string, unknown>) : (raw as Record<string, unknown>)
  const data = (wrap?.json_build_object ?? wrap) as Record<string, unknown[]>
  const A = (data.accounts ?? []) as Record<string, unknown>[]
  const P = (data.projects ?? []) as Record<string, unknown>[]
  const S = (data.signals ?? []) as Record<string, unknown>[]
  const C = (data.calls ?? []) as Record<string, unknown>[]
  const X = (data.associates ?? []) as Record<string, unknown>[]

  const numOf = (v: unknown) => (v == null ? 0 : Number(v) || 0)
  const isRisk = (s: Record<string, unknown>) => String(s.type ?? '').toLowerCase().includes('risk')
  const isOpen = (s: Record<string, unknown>) => s.status === 'new' || s.status == null
  const isHigh = (s: Record<string, unknown>) => {
    const d = (s.details && typeof s.details === 'object' ? s.details : {}) as Record<string, unknown>
    const b = String(d.band ?? '').toLowerCase()
    return b.includes('high') || b.includes('critical')
  }

  const aRows: ApiAccount[] = A.map((a) => {
    const sig = S.filter((s) => s.account_id === a.id)
    const risks = sig.filter((s) => isRisk(s) && isOpen(s))
    const health = risks.some(isHigh) ? 'red' : risks.length ? 'amber' : 'green'
    const proj = P.filter((p) => p.account_id === a.id)
    const withB = proj.filter((p) => p.budget_remaining != null)
    const sumSow = withB.reduce((t, p) => t + numOf(p.sow_value), 0)
    const sumRem = withB.reduce((t, p) => t + numOf(p.budget_remaining), 0)
    return {
      id: String(a.id),
      name: String(a.name),
      pod: (a.pod as string) ?? null,
      health,
      open_signals: sig.filter(isOpen).length,
      budget_burn_pct: sumSow > 0 ? Math.round((100 * (sumSow - sumRem)) / sumSow) : 0,
      headroom: proj.reduce((t, p) => t + numOf(p.budget_remaining), 0),
    }
  })

  const pRows: ApiProject[] = P.map((p) => {
    const risks = S.filter((s) => s.project_id === p.id && isRisk(s) && isOpen(s))
    const rag = risks.some(isHigh) ? 'red' : risks.length ? 'amber' : 'green'
    return {
      id: String(p.id),
      name: String(p.name),
      account_id: String(p.account_id),
      sow_value: (p.sow_value as number) ?? null,
      sow_status: (p.sow_status as string) ?? null,
      rag,
      start_date: (p.start_date as string) ?? null,
      end_date: (p.end_date as string) ?? null,
      budget_remaining: (p.budget_remaining as number) ?? null,
      spend: p.budget_remaining != null ? numOf(p.sow_value) - numOf(p.budget_remaining) : null,
      delivery_manager_name: (p.delivery_manager_name as string) ?? null,
    }
  })

  const accName = new Map(A.map((a) => [a.id, a.name as string]))
  const projName = new Map(P.map((p) => [p.id, p.name as string]))
  const sRows: ApiSignal[] = S.map((s) => ({
    id: String(s.id),
    type: String(s.type),
    subtype: (s.subtype as string) ?? null,
    summary: (s.summary as string) ?? null,
    quote: (s.quote as string) ?? null,
    suggested_action: (s.suggested_action as string) ?? null,
    confidence: (s.confidence as number) ?? null,
    status: (s.status as string) ?? null,
    details: s.details ?? {},
    created_at: String(s.created_at ?? ''),
    account: accName.get(s.account_id) ?? null,
    project: projName.get(s.project_id) ?? null,
    account_id: (s.account_id as string) ?? null,
    project_id: (s.project_id as string) ?? null,
    call_id: (s.call_id as string) ?? null,
  }))

  const cRows: ApiCall[] = C.map((c) => ({
    id: String(c.id),
    account_id: (c.account_id as string) ?? null,
    project_id: (c.project_id as string) ?? null,
    title: (c.title as string) ?? null,
    call_date: (c.call_date as string) ?? null,
    transcript: (c.transcript as string) ?? null,
    source: (c.source as string) ?? null,
  }))

  const asRows: ApiAssociate[] = X.map((a) => ({
    id: String(a.id),
    name: String(a.name),
    account_id: (a.account_id as string) ?? null,
    project_or_programme: (a.project_or_programme as string) ?? null,
    placement_status: (a.placement_status as string) ?? null,
  }))

  return { aRows, pRows, sRows, cRows, asRows }
}

export async function bootstrap(): Promise<BootResult> {
  // Live: fetch from the Read API (the VM build).
  if (isLive) {
    try {
      const [aRows, pRows, sRows, cRows, asRows, wrRows, stRows, dlRows] = await Promise.all([
        fetchAccounts(),
        fetchProjects(),
        fetchSignals(),
        fetchCalls(),
        fetchAssociates(),
        fetchWeeklyReports(),
        fetchStakeholders(),
        fetchDeals(),
      ])
      const counts = hydrate({ aRows, pRows, sRows, cRows, asRows })
      // Weekly reports + CRM mirror (fetchers are tolerant — empty on older APIs).
      replace(weeklyReports, wrRows)
      replace(stakeholders, stRows)
      replace(deals, dlRows)
      return { source: 'live', counts }
    } catch (e) {
      return { source: 'live', error: e instanceof Error ? e.message : String(e) }
    }
  }

  // Otherwise (the public build): if a real-data snapshot is bundled, display it exactly
  // like normal data across every tab. If the snapshot is empty or unreadable, fall back
  // silently to the built-in dataset — nothing visible changes either way.
  try {
    const rows = await loadSnapshotRows()
    if (!rows.aRows.length) return { source: 'mock' }
    const counts = hydrate(rows)
    return { source: 'mock', counts }
  } catch {
    return { source: 'mock' }
  }
}
