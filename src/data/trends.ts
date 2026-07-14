// Signal activity over the last 6 weeks, by type (for the Leadership trend chart).
// Computed from the actual signals in memory, so it's live data in live mode and
// consistent demo data in mock mode - never a hardcoded chart.
import { signals } from './signals'

export type WeekPoint = {
  week: string
  opportunity: number
  risk: number
  update: number
  people: number
}

const DAY = 86_400_000

// Monday 00:00 UTC of the week containing d.
function weekStart(d: Date): number {
  const x = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const dow = (new Date(x).getUTCDay() + 6) % 7
  return x - dow * DAY
}

export function weeklyTrend(): WeekPoint[] {
  const thisWeek = weekStart(new Date())
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = thisWeek - (5 - i) * 7 * DAY
    return {
      start,
      point: {
        week: new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        opportunity: 0,
        risk: 0,
        update: 0,
        people: 0,
      } as WeekPoint,
    }
  })
  for (const s of signals) {
    const t = Date.parse(s.createdAt) // 'YYYY-MM-DD' parses as UTC midnight
    if (isNaN(t)) continue
    const idx = Math.floor((t - weeks[0].start) / (7 * DAY))
    if (idx >= 0 && idx < weeks.length) {
      weeks[idx].point[s.type] += 1
    }
  }
  return weeks.map((w) => w.point)
}
