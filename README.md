# Tecknuovo × BraindAI - Second Brain (dashboard mock-ups)

Functional, clickable mock-ups of the role-based dashboards for Tecknuovo's AI "Second Brain".
Real Tecknuovo org (people, pods, accounts), illustrative signals, no backend.
Built with Vite + React + TypeScript + Tailwind + Recharts.

## The surfaces (one app, chosen by URL)
| Surface | Who | Route |
|---|---|---|
| **Landing** | pick a dashboard | `/` |
| **Delivery** | Kiera Battersby (Client Delivery Director) | `/#/delivery` |
| **Client Partner** | Alice Wells (Client Partner) | `/#/partner` |
| **Leadership** | Katie Carruthers (Managing Director) | `/#/leadership` |
| **Observability** | Meesha Chotai (Portfolio Director) - trust + human-in-the-loop | `/#/observability` |
| **How it works** | the river / flow vision | `/#/flow` |

## Run locally
```bash
npm install
npm run dev          # landing at http://localhost:5173, then click in (or add #/delivery)
```
Single-dashboard ports (optional, for focused work):
```bash
npm run dev:delivery       # 3030    npm run dev:partner        # 3031
npm run dev:leadership     # 3032    npm run dev:observability  # 3033
npm run dev:flow           # 3034
```

## Deploy to AWS Amplify (one site, one link)
1. Push this repo to GitHub.
2. Amplify Console → **New app → Host web app** → connect the GitHub repo + branch.
3. Amplify auto-detects the build (or uses `amplify.yml` in the root). Build command `npm run build`, output dir `dist`.
4. Deploy. You get one URL, e.g. `https://main.xxxx.amplifyapp.com`.
   - Landing `/` · Delivery `/#/delivery` · Client Partner `/#/partner` · Leadership `/#/leadership` · Observability `/#/observability` · Flow `/#/flow`

Routing is hash-based, so **no redirect/rewrite rules are needed** on Amplify.

## What's modelled
- **Four signals** - 🟢 Opportunity, 🔴 Risk, 🔵 Update, 🟡 People - consistent everywhere.
- **Real org** - the four pods (Central Gov 1/2, HMRC, Utilities-Health-Education), real accounts and owners.
- **Traceability** - every signal links to its source call + the transcript ("captured via Microsoft Teams").
- **Read-only** - the dashboards display data from Teams / Monday / SharePoint / SOW; nothing is generated or written back.
- **Observability** - Measure → Validate (human-in-the-loop) → Learn, per the Vision Doc Stage 5.
- **Co-pilot** - a mock "Ask the brain" assistant (clearly labelled), on every dashboard.

All data lives in `src/data/`. Signal actions and review feedback are in-memory only (reset on refresh).
