// Weekly reports + CRM mirror (stakeholders, deals), hydrated in live mode by
// bootstrap.ts exactly like the other shared arrays. Empty in mock mode - views
// that use these fall back gracefully (weekly tab keeps its "coming soon" panel,
// the account pipeline panel simply doesn't render).
import type { ApiWeeklyReport, ApiStakeholder, ApiDeal, ApiSignalNote } from './api'

export const weeklyReports: ApiWeeklyReport[] = []
export const stakeholders: ApiStakeholder[] = []
export const deals: ApiDeal[] = []

// Team notes on signals (human log, shown on every dashboard).
export const signalNotes: ApiSignalNote[] = []
export const notesForSignal = (signalId: string) => signalNotes.filter((n) => n.signal_id === signalId)

export const stakeholdersForAccount = (accountId: string) =>
  stakeholders.filter((s) => s.account_id === accountId)

export const dealsForAccount = (accountId: string) =>
  deals.filter((d) => d.account_id === accountId)

export const openDealsForAccount = (accountId: string) =>
  dealsForAccount(accountId).filter((d) => d.is_open)

// 'BUDGET_HOLDER;KEY_BUYER' -> 'Budget Holder · Key Buyer'
export const prettyBuyingRole = (raw: string | null) =>
  raw
    ? raw
        .split(';')
        .map((r) => r.trim().toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
        .join(' · ')
    : null
