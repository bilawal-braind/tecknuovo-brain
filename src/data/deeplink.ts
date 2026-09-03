// Deep links from outside the app (the Slack briefs): #/delivery?signal=<id>
// opens that signal's card inside its account; ?account=<id> opens the account.
// The dashboards read these once on mount - data is already hydrated because
// bootstrap runs before React mounts.
export function hashParam(name: string): string | null {
  const q = window.location.hash.split('?')[1]
  if (!q) return null
  return new URLSearchParams(q).get(name)
}
