// Signal activity over the last 6 weeks, by type (for the Leadership trend chart).
export type WeekPoint = {
  week: string
  opportunity: number
  risk: number
  update: number
  people: number
}

export const weeklyTrend: WeekPoint[] = [
  { week: 'May 12', opportunity: 4, risk: 3, update: 9, people: 2 },
  { week: 'May 19', opportunity: 5, risk: 4, update: 10, people: 3 },
  { week: 'May 26', opportunity: 6, risk: 4, update: 11, people: 3 },
  { week: 'Jun 02', opportunity: 7, risk: 6, update: 12, people: 4 },
  { week: 'Jun 09', opportunity: 8, risk: 7, update: 13, people: 5 },
  { week: 'Jun 16', opportunity: 9, risk: 8, update: 14, people: 6 },
]
