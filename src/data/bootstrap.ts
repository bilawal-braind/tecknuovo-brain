// Runs once before React mounts. In 'mock' mode it does nothing (the demo dataset
// is already loaded). In 'live' mode it fetches the real org + signals from the Read
// API and hydrates the shared data arrays IN PLACE, so every component that imports
// `accounts` / `projects` / `signals` sees live data with no further wiring.
//
// Note: calls, compliance, weekly reports, trends and observability are not produced
// by the pipeline yet, so they stay as demo data in both modes.
import { isLive } from './source'
import { fetchAccounts, fetchProjects, fetchSignals } from './api'
import { mapAccount, mapProject, mapSignal } from './map'
import { accounts, projects } from './org'
import { signals } from './signals'

// Replace an array's contents while keeping the same reference (live ESM binding).
function replace<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next)
}

export type BootResult = {
  source: 'mock' | 'live'
  counts?: { accounts: number; projects: number; signals: number }
  error?: string
}

export async function bootstrap(): Promise<BootResult> {
  if (!isLive) return { source: 'mock' }

  try {
    const [aRows, pRows, sRows] = await Promise.all([fetchAccounts(), fetchProjects(), fetchSignals()])

    const liveAccounts = aRows.map(mapAccount)
    const liveProjects = pRows.map(mapProject)
    const liveSignals = sRows.map(mapSignal)

    // SOW value lives on projects in the DB; roll it up to the account for the UI.
    for (const acc of liveAccounts) {
      acc.sowValue = pRows
        .filter((p) => p.account_id === acc.id)
        .reduce((sum, p) => sum + (typeof p.sow_value === 'string' ? Number(p.sow_value) || 0 : p.sow_value ?? 0), 0)
    }

    replace(accounts, liveAccounts)
    replace(projects, liveProjects)
    replace(signals, liveSignals)

    return {
      source: 'live',
      counts: { accounts: liveAccounts.length, projects: liveProjects.length, signals: liveSignals.length },
    }
  } catch (e) {
    return { source: 'live', error: e instanceof Error ? e.message : String(e) }
  }
}
