import type { Account, Person, Project } from './types'

// ── People (real Tecknuovo org, from the org chart) ──
export const people: Person[] = [
  // Leadership + function heads
  { id: 'katie', name: 'Katie Carruthers', role: 'Managing Director' },
  { id: 'kiera', name: 'Kiera Battersby', role: 'Client Delivery Director' },
  { id: 'meesha', name: 'Meesha Chotai', role: 'Portfolio Director' },
  { id: 'jess', name: 'Jess Kilkenny-Roddy', role: 'Client Director' },
  { id: 'annette', name: 'Annette Cole', role: 'Client Director' },
  { id: 'adam-b', name: 'Adam Bellerby', role: 'Head of Finance' },
  { id: 'chloe', name: 'Chloe Hollinshead', role: 'Head of Portfolio' },
  // Engagement (Client Partners / Managers)
  { id: 'alice', name: 'Alice Wells', role: 'Client Partner' },
  { id: 'adam-al', name: 'Adam Adebowale-Lowe', role: 'Client Partner' },
  { id: 'alex', name: 'Alex Burger', role: 'Client Partner' },
  { id: 'luke', name: 'Luke Adams', role: 'Client Delivery Partner' },
  { id: 'will', name: 'Will Walker', role: 'Client Manager' },
  // Portfolio
  { id: 'rauly', name: 'Rauly Vasir', role: 'Portfolio Manager' },
  // Delivery Managers
  { id: 'kaitlyn', name: 'Kaitlyn Bryant', role: 'Lead Delivery Manager' },
  { id: 'pippa', name: 'Pippa Burrell', role: 'Delivery Manager' },
  { id: 'emily', name: 'Emily Prins', role: 'Delivery Manager' },
  { id: 'louis', name: 'Louis Evans', role: 'Delivery Manager' },
  { id: 'nick', name: 'Nick Bennett', role: 'Delivery Manager' },
  { id: 'sarah', name: 'Sarah Facey', role: 'Delivery Manager' },
  { id: 'jasmin', name: 'Jasmin Hunjan', role: 'Delivery Manager' },
  { id: 'sophie', name: 'Sophie Martin', role: 'Junior Delivery Manager' },
  // Coordinators / Finance / Talent
  { id: 'ellie', name: 'Ellie Benson', role: 'Delivery Coordinator' },
  { id: 'liam', name: 'Liam Perkins', role: 'Commercial Finance Partner' },
  { id: 'talent', name: 'Talent team', role: 'Talent' },
]
export const personName = (id?: string) => people.find((p) => p.id === id)?.name ?? '—'
export const personRole = (id?: string) => people.find((p) => p.id === id)?.role ?? ''

// ── Pods (real, from the pod board) - each led by a Client/Portfolio Director ──
export const pods = [
  { id: 'cg1', name: 'Central Gov 1', owner: 'annette' },
  { id: 'cg2', name: 'Central Gov 2', owner: 'kiera' },
  { id: 'hmrc', name: 'HMRC', owner: 'meesha' },
  { id: 'uhe', name: 'Utilities, Health & Education', owner: 'jess' },
] as const
export const podName = (id: string) => pods.find((p) => p.id === id)?.name ?? id

// ── Accounts (real Tecknuovo accounts + owners, from the pod board) ──
// clientDirector = pod lead; clientPartner = the account owner sticky on the board.
export const accounts: Account[] = [
  // Central Gov 1 (Annette)
  { id: 'dwp', name: 'DWP', pod: 'cg1', coverage: 'full', health: 'amber', trend: 'declining', clientDirector: 'annette', clientPartner: 'alice', deliveryManager: 'pippa', sowValue: 1_800_000, budgetBurnPct: 58, headroom: 756_000, lastContact: '2026-06-15', relationship: 'stable', valueAdds: 2 },
  { id: 'moj', name: 'MOJ', pod: 'cg1', coverage: 'full', health: 'green', trend: 'steady', clientDirector: 'annette', clientPartner: 'annette', deliveryManager: 'louis', sowValue: 1_100_000, budgetBurnPct: 42, headroom: 638_000, lastContact: '2026-06-13', relationship: 'strong', valueAdds: 1 },
  { id: 'mod', name: 'MOD', pod: 'cg1', coverage: 'full', health: 'green', trend: 'steady', clientDirector: 'annette', clientPartner: 'annette', deliveryManager: 'emily', sowValue: 1_600_000, budgetBurnPct: 44, headroom: 896_000, lastContact: '2026-06-12', relationship: 'strong', valueAdds: 2 },
  { id: 'maps', name: 'MaPS', pod: 'cg1', coverage: 'limited', health: 'amber', trend: 'declining', clientDirector: 'annette', clientPartner: 'will', deliveryManager: undefined, sowValue: 380_000, budgetBurnPct: 67, headroom: 125_400, lastContact: '2026-06-04', relationship: 'stable', valueAdds: 0 },

  // Central Gov 2 (Kiera)
  { id: 'cabo', name: 'Cabinet Office', pod: 'cg2', coverage: 'full', health: 'red', trend: 'declining', clientDirector: 'kiera', clientPartner: 'adam-al', deliveryManager: 'jasmin', sowValue: 1_150_000, budgetBurnPct: 78, headroom: 253_000, lastContact: '2026-06-16', relationship: 'strained', valueAdds: 1 },
  { id: 'defra', name: 'Defra', pod: 'cg2', coverage: 'full', health: 'green', trend: 'improving', clientDirector: 'kiera', clientPartner: 'kiera', deliveryManager: 'sarah', sowValue: 1_400_000, budgetBurnPct: 39, headroom: 854_000, lastContact: '2026-06-14', relationship: 'strong', valueAdds: 3 },
  { id: 'dvsa', name: 'DVSA', pod: 'cg2', coverage: 'full', health: 'amber', trend: 'steady', clientDirector: 'kiera', clientPartner: 'adam-al', deliveryManager: 'pippa', sowValue: 820_000, budgetBurnPct: 53, headroom: 385_400, lastContact: '2026-06-11', relationship: 'stable', valueAdds: 1 },

  // HMRC pod (Meesha) - programmes + delivery partners
  { id: 'gvms', name: 'GVMS', pod: 'hmrc', coverage: 'full', health: 'amber', trend: 'declining', clientDirector: 'meesha', clientPartner: 'alice', deliveryManager: 'nick', sowValue: 2_400_000, budgetBurnPct: 61, headroom: 936_000, lastContact: '2026-06-16', relationship: 'stable', valueAdds: 3 },
  { id: 'hawk', name: 'HAWK', pod: 'hmrc', coverage: 'full', health: 'amber', trend: 'declining', clientDirector: 'meesha', clientPartner: 'alice', deliveryManager: 'louis', sowValue: 1_900_000, budgetBurnPct: 64, headroom: 684_000, lastContact: '2026-06-15', relationship: 'stable', valueAdds: 1 },
  { id: 'kms', name: 'KMS', pod: 'hmrc', coverage: 'full', health: 'green', trend: 'steady', clientDirector: 'meesha', clientPartner: 'alice', deliveryManager: 'emily', sowValue: 1_200_000, budgetBurnPct: 46, headroom: 648_000, lastContact: '2026-06-13', relationship: 'strong', valueAdds: 2 },
  { id: 'kainos', name: 'Kainos', pod: 'hmrc', coverage: 'full', health: 'green', trend: 'steady', clientDirector: 'meesha', clientPartner: 'adam-al', deliveryManager: 'sarah', sowValue: 900_000, budgetBurnPct: 40, headroom: 540_000, lastContact: '2026-06-12', relationship: 'strong', valueAdds: 1 },
  { id: 'netcompany', name: 'Netcompany', pod: 'hmrc', coverage: 'full', health: 'green', trend: 'improving', clientDirector: 'meesha', clientPartner: 'will', deliveryManager: 'jasmin', sowValue: 700_000, budgetBurnPct: 35, headroom: 455_000, lastContact: '2026-06-10', relationship: 'strong', valueAdds: 0 },

  // Utilities, Health & Education (Jess)
  { id: 'thames', name: 'Thames Water', pod: 'uhe', coverage: 'full', health: 'amber', trend: 'improving', clientDirector: 'jess', clientPartner: 'chloe', deliveryManager: 'nick', sowValue: 1_240_000, budgetBurnPct: 38, headroom: 768_800, lastContact: '2026-06-16', relationship: 'stable', valueAdds: 4 },
  { id: 'neso', name: 'NESO', pod: 'uhe', coverage: 'full', health: 'green', trend: 'steady', clientDirector: 'jess', clientPartner: 'luke', deliveryManager: 'emily', sowValue: 640_000, budgetBurnPct: 31, headroom: 441_600, lastContact: '2026-06-14', relationship: 'strong', valueAdds: 1 },
  { id: 'nhs', name: 'NHS', pod: 'uhe', coverage: 'limited', health: 'red', trend: 'declining', clientDirector: 'jess', clientPartner: undefined, deliveryManager: undefined, sowValue: 1_020_000, budgetBurnPct: 66, headroom: 347_000, lastContact: '2026-06-06', relationship: 'strained', valueAdds: 1 },
  { id: 'dfe', name: 'DfE', pod: 'uhe', coverage: 'full', health: 'green', trend: 'steady', clientDirector: 'jess', clientPartner: 'will', deliveryManager: 'louis', sowValue: 760_000, budgetBurnPct: 33, headroom: 509_200, lastContact: '2026-06-11', relationship: 'strong', valueAdds: 1 },
  { id: 'voda3', name: 'Vodafone (Voda3)', pod: 'uhe', coverage: 'full', health: 'amber', trend: 'steady', clientDirector: 'jess', clientPartner: 'alice', deliveryManager: 'jasmin', sowValue: 950_000, budgetBurnPct: 49, headroom: 484_500, lastContact: '2026-06-13', relationship: 'stable', valueAdds: 2 },
]
export const accountById = (id: string) => accounts.find((a) => a.id === id)
export const accountName = (id: string) => accountById(id)?.name ?? id

// ── Projects (one delivery per account; resource-only accounts have no DM) ──
export const projects: Project[] = [
  // Central Gov 1
  { id: 'dwp-ucdp', name: 'Universal Credit Data Platform', accountId: 'dwp', phase: 'Build', rag: 'amber', deliveryManager: 'pippa', sprint: 'Sprint 7 of 12', lastActivity: '2026-06-15' },
  { id: 'moj-courts', name: 'Courts Digital Service', accountId: 'moj', phase: 'Build', rag: 'green', deliveryManager: 'louis', sprint: 'Sprint 5 of 9', lastActivity: '2026-06-13' },
  { id: 'mod-coe', name: 'Salesforce Centre of Excellence', accountId: 'mod', phase: 'Run', rag: 'green', deliveryManager: 'emily', sprint: 'Sprint 12 of 16', lastActivity: '2026-06-12' },
  { id: 'maps-moneyhelper', name: 'MoneyHelper Platform (resource only)', accountId: 'maps', phase: 'Build', rag: 'amber', deliveryManager: undefined, sprint: 'Ongoing', lastActivity: '2026-06-04' },

  // Central Gov 2
  { id: 'cabo-govuk', name: 'GOV.UK ICT Modernisation', accountId: 'cabo', phase: 'Build', rag: 'red', deliveryManager: 'jasmin', sprint: 'Sprint 6 of 10', lastActivity: '2026-06-16' },
  { id: 'defra-eds', name: 'Environmental Data Service', accountId: 'defra', phase: 'Build', rag: 'green', deliveryManager: 'sarah', sprint: 'Sprint 4 of 8', lastActivity: '2026-06-14' },
  { id: 'dvsa-vehicle', name: 'Vehicle Testing Digital', accountId: 'dvsa', phase: 'Design', rag: 'amber', deliveryManager: 'pippa', sprint: 'Sprint 3 of 9', lastActivity: '2026-06-11' },

  // HMRC
  { id: 'gvms-platform', name: 'GVMS Platform', accountId: 'gvms', phase: 'Build', rag: 'amber', deliveryManager: 'nick', sprint: 'Sprint 7 of 12', lastActivity: '2026-06-16' },
  { id: 'hawk-risk', name: 'HAWK Risk Engine', accountId: 'hawk', phase: 'Test', rag: 'amber', deliveryManager: 'louis', sprint: 'Sprint 9 of 11', lastActivity: '2026-06-15' },
  { id: 'kms-svc', name: 'Knowledge Management Service', accountId: 'kms', phase: 'Build', rag: 'green', deliveryManager: 'emily', sprint: 'Sprint 4 of 8', lastActivity: '2026-06-13' },
  { id: 'kainos-delivery', name: 'Kainos Partner Delivery', accountId: 'kainos', phase: 'Run', rag: 'green', deliveryManager: 'sarah', sprint: 'Sprint 10 of 14', lastActivity: '2026-06-12' },
  { id: 'netcompany-int', name: 'Netcompany Integration', accountId: 'netcompany', phase: 'Build', rag: 'green', deliveryManager: 'jasmin', sprint: 'Sprint 6 of 9', lastActivity: '2026-06-10' },

  // UHE
  { id: 'thames-asset', name: 'Asset Data & Analytics', accountId: 'thames', phase: 'Build', rag: 'amber', deliveryManager: 'nick', sprint: 'Sprint 5 of 10', lastActivity: '2026-06-16' },
  { id: 'neso-grid', name: 'Grid Data Platform', accountId: 'neso', phase: 'Build', rag: 'green', deliveryManager: 'emily', sprint: 'Sprint 4 of 7', lastActivity: '2026-06-14' },
  { id: 'nhs-data', name: 'NHS Data Infrastructure (resource only)', accountId: 'nhs', phase: 'Build', rag: 'red', deliveryManager: undefined, sprint: 'Ongoing', lastActivity: '2026-06-06' },
  { id: 'dfe-skills', name: 'Skills Digital Service', accountId: 'dfe', phase: 'Discovery', rag: 'green', deliveryManager: 'louis', sprint: 'Sprint 2 of 6', lastActivity: '2026-06-11' },
  { id: 'voda3-network', name: 'Network Analytics', accountId: 'voda3', phase: 'Build', rag: 'amber', deliveryManager: 'jasmin', sprint: 'Sprint 6 of 11', lastActivity: '2026-06-13' },
]
export const projectById = (id?: string) => projects.find((p) => p.id === id)
export const projectsForAccount = (accountId: string) => projects.filter((p) => p.accountId === accountId)
