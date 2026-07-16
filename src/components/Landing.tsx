import { ClipboardList, Briefcase, BarChart3, ShieldCheck, GitBranch, ArrowRight, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TnMark } from './common/Brand'

type Card = { hash: string; role: string; persona: string; blurb: string; icon: LucideIcon }

const DASHBOARDS: Card[] = [
  { hash: '#/delivery', role: 'Delivery', persona: 'Kiera Battersby · Client Delivery Director', blurb: 'Every delivery, the signals on it, and the calls behind them.', icon: ClipboardList },
  { hash: '#/partner', role: 'Client Partner', persona: 'Commercial view · own accounts', blurb: 'Opportunities and risks across the portfolio, ranked by value.', icon: Briefcase },
  { hash: '#/leadership', role: 'Leadership', persona: 'Katie Carruthers · Managing Director', blurb: 'The whole business in a glance - pods, pipeline, what needs a decision.', icon: BarChart3 },
  { hash: '#/observability', role: 'Observability', persona: 'Meesha Chotai · Portfolio Director', blurb: 'How accurate the AI is, and the human-in-the-loop feedback.', icon: ShieldCheck },
]

export function Landing() {
  return (
    <div className="app-bg min-h-screen w-full overflow-y-auto">
      <div className="mx-auto max-w-[1040px] px-6 py-14">
        <div className="flex items-center gap-3"><TnMark size={34} /><div className="leading-tight"><div className="text-[17px] font-bold tracking-tight">Tecknuovo <span className="font-medium text-muted-2">× BraindAI</span></div><div className="text-[12px] text-muted-2">Second Brain</div></div></div>

        <h1 className="mt-8 text-[32px] font-bold tracking-tight">The Second Brain, by role</h1>
        <p className="mt-2 max-w-[640px] text-[14px] leading-relaxed text-muted">Every client call is read, classified into four signals, and routed to the right person. Pick a dashboard to see what each role gets - all on real Tecknuovo accounts, with mock signals.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DASHBOARDS.map((d) => {
            const Icon = d.icon
            return (
              <a key={d.hash} href={d.hash} className="group rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--line-2)]">
                <div className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: 'var(--accent)' }}><Icon size={19} /></span>
                  <ArrowRight size={18} className="text-muted-2 transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
                </div>
                <h3 className="mt-3 text-[16px] font-semibold">{d.role}</h3>
                <div className="text-[12px] text-muted-2">{d.persona}</div>
                <p className="mt-2 text-[13px] leading-snug text-muted">{d.blurb}</p>
              </a>
            )
          })}
        </div>

        <a href="#/qa" className="group mt-4 flex items-center gap-3 rounded-2xl border p-4 transition-all hover:-translate-y-0.5" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))' }}>
          <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: 'var(--accent)' }}><Sparkles size={19} /></span>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold">QA &amp; Evaluation <span className="ml-1 align-middle rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: 'var(--accent)' }}>validated</span></h3>
            <p className="text-[13px] text-muted">How rigorously the AI is tested, and how it scored. Independently validated with DeepEval.</p>
          </div>
          <ArrowRight size={18} className="text-muted-2 transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
        </a>

        <a href="#/flow" className="group mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-all hover:border-[var(--line-2)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent-d)' }}><GitBranch size={19} /></span>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold">How the Second Brain works</h3>
            <p className="text-[13px] text-muted">The flow - a call comes in, context joins it, the AI classifies it, signals route out.</p>
          </div>
          <ArrowRight size={18} className="text-muted-2 transition-transform group-hover:translate-x-0.5 group-hover:text-text" />
        </a>

        <p className="mt-8 text-[11px] text-muted-2">Functional mock-up · real Tecknuovo org, illustrative signals · built by BraindAI</p>
      </div>
    </div>
  )
}
