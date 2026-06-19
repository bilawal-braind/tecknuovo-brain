import type { Compliance, WeeklyReport } from './types'

// Call compliance per project: did the expected cadence happen this week?
export const compliance: Compliance[] = [
  // Central Gov 1
  { projectId: 'dwp-ucdp', standup: 'done', weekly: 'missed', governance: 'done', note: 'Friday weekly report not submitted this week' },
  { projectId: 'moj-courts', standup: 'done', weekly: 'done', governance: 'done' },
  { projectId: 'mod-coe', standup: 'done', weekly: 'done', governance: 'done' },
  { projectId: 'maps-moneyhelper', standup: 'missed', weekly: 'missed', governance: 'missed', note: 'Resource-only account - no Delivery Manager, reporting is patchy' },

  // Central Gov 2
  { projectId: 'cabo-govuk', standup: 'done', weekly: 'overdue', governance: 'done', note: 'Friday weekly report overdue; standup missed mid-week under pressure' },
  { projectId: 'defra-eds', standup: 'done', weekly: 'done', governance: 'done' },
  { projectId: 'dvsa-vehicle', standup: 'done', weekly: 'done', governance: 'not-due' },

  // HMRC
  { projectId: 'gvms-platform', standup: 'done', weekly: 'done', governance: 'done' },
  { projectId: 'hawk-risk', standup: 'done', weekly: 'done', governance: 'done' },
  { projectId: 'kms-svc', standup: 'done', weekly: 'done', governance: 'not-due' },
  { projectId: 'kainos-delivery', standup: 'done', weekly: 'done', governance: 'done' },
  { projectId: 'netcompany-int', standup: 'done', weekly: 'done', governance: 'not-due' },

  // Utilities, Health & Education
  { projectId: 'thames-asset', standup: 'done', weekly: 'done', governance: 'done' },
  { projectId: 'neso-grid', standup: 'done', weekly: 'done', governance: 'not-due' },
  { projectId: 'nhs-data', standup: 'missed', weekly: 'missed', governance: 'missed', note: 'Resource-only account - no Delivery Manager, reporting is patchy' },
  { projectId: 'dfe-skills', standup: 'done', weekly: 'done', governance: 'not-due' },
  { projectId: 'voda3-network', standup: 'done', weekly: 'done', governance: 'done' },
]
export const complianceFor = (projectId: string) => compliance.find((c) => c.projectId === projectId)

// "The weekly report writes itself" - auto-drafted from the week's calls + signals.
export const weeklyReports: WeeklyReport[] = [
  {
    projectId: 'gvms-platform',
    delivered: ['Integration blocker with the platform team cleared', 'Sprint 7 stories largely accepted'],
    focusNext: ['Re-baseline the delivery plan with the client', 'Recover sprint velocity', 'Scope the second data workstream'],
    risks: ['Velocity down two sprints running; client concerned about go-live date'],
    confidence: 86,
  },
  {
    projectId: 'cabo-govuk',
    delivered: ['Accessibility audit passed first time with written sign-off', 'Two client change requests absorbed'],
    focusNext: ['Agree a recovery plan with the client director within 48 hours', 'Tighten change-control discipline'],
    risks: ['Two milestones slipped', 'Budget burn at 78% with a third of scope remaining', 'Team morale dipping under change requests'],
    confidence: 90,
  },
  {
    projectId: 'thames-asset',
    delivered: ['Sprint 5 completed, all committed stories accepted', 'Dashboard value-add delivered out of SOW'],
    focusNext: ['Scope the reporting-layer extension', 'Prepare indicative effort for the client'],
    risks: ['None material this week; trend improving'],
    confidence: 87,
  },
  {
    projectId: 'hawk-risk',
    delivered: ['Regression suite green', 'Test phase tracking to plan'],
    focusNext: ['Escalate the third-party integration dependency', 'Document timeline impact for the client'],
    risks: ['Third-party integration on the critical path and still outstanding'],
    confidence: 80,
  },
  {
    projectId: 'dwp-ucdp',
    delivered: ['Sprint 7 stories mostly accepted; one story carried over by agreement'],
    focusNext: ['Chase the next SOW through procurement', 'Confirm associate backfill before sprint end'],
    risks: ['Procurement sitting on the next SOW, current one ends in three weeks', 'Two associates rolling off with no backfill confirmed'],
    confidence: 76,
  },
  {
    projectId: 'defra-eds',
    delivered: ['Sprint 4 closed clean with zero carryover', 'Data ingestion service shipped to staging', 'Security review passed with no findings'],
    focusNext: ['Quote for the data-quality dashboard upsell', 'Begin Sprint 5'],
    risks: ['None material this week; account green and improving'],
    confidence: 90,
  },
]
export const weeklyReportFor = (projectId: string) => weeklyReports.find((w) => w.projectId === projectId)
