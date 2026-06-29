// Runs once before React mounts. In 'mock' mode it does nothing (the demo dataset
// is already loaded). In 'live' mode it fetches the real org + signals + calls from
// the Read API and hydrates the shared data arrays IN PLACE, so every component that
// imports `accounts` / `projects` / `signals` / `calls` sees live data with no further wiring.
//
// Note: compliance, weekly reports, trends and observability are not produced by the
// pipeline yet, so they stay as demo data in both modes.
import { isLive } from './source'
import { fetchAccounts, fetchProjects, fetchSignals, fetchCalls, fetchAssociates } from './api'
import { mapAccount, mapProject, mapSignal, inferCallType } from './map'
import { accounts, projects, people, advisors } from './org'
import { signals } from './signals'
import { calls } from './calls'
import type { Call } from './calls'
import type { ApiCall } from './api'
import type { Person } from './types'

// Replace an array's contents while keeping the same reference (live ESM binding).
function replace<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next)
}

export type BootResult = {
  source: 'mock' | 'live'
  counts?: { accounts: number; projects: number; signals: number; calls: number }
  error?: string
}

export async function bootstrap(): Promise<BootResult> {
  if (!isLive) return { source: 'mock' }

  try {
    const [aRows, pRows, sRows, cRows, asRows] = await Promise.all([
      fetchAccounts(),
      fetchProjects(),
      fetchSignals(),
      fetchCalls(),
      fetchAssociates(),
    ])

    const liveAccounts = aRows.map(mapAccount)
    const liveProjects = pRows.map(mapProject)
    const liveSignals = sRows.map(mapSignal)

    // SOW value lives on projects in the DB; roll it up to the account for the UI.
    for (const acc of liveAccounts) {
      acc.sowValue = pRows
        .filter((p) => p.account_id === acc.id)
        .reduce((sum, p) => sum + (typeof p.sow_value === 'string' ? Number(p.sow_value) || 0 : p.sow_value ?? 0), 0)
    }

    // People: synthesise a person per Delivery Manager name (from Monday) so the UI,
    // which looks names up by person-id, can display them.
    const dmPeople = new Map<string, Person>()
    pRows.forEach((p, i) => {
      const nm = p.delivery_manager_name
      if (nm) {
        const id = 'dm-' + nm.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        if (!dmPeople.has(id)) dmPeople.set(id, { id, name: nm, role: 'Delivery Manager' })
        liveProjects[i].deliveryManager = id
      }
    })

    // Consultants (associates) -> people + project.advisors.
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

    // Group the live signals back up into their calls (the "calls" layer).
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

    replace(accounts, liveAccounts)
    replace(projects, liveProjects)
    replace(signals, liveSignals)
    replace(calls, liveCalls)
    if (dmPeople.size || consultantPeople.length) replace(people, [...dmPeople.values(), ...consultantPeople])
    if (consultantPeople.length) replace(advisors, consultantPeople)

    return {
      source: 'live',
      counts: {
        accounts: liveAccounts.length,
        projects: liveProjects.length,
        signals: liveSignals.length,
        calls: liveCalls.length,
      },
    }
  } catch (e) {
    return { source: 'live', error: e instanceof Error ? e.message : String(e) }
  }
}
