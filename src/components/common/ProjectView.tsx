import { ArrowLeft, Phone, Activity, Flag, Building2 } from 'lucide-react'
import { projectById, accountById, personName, podName } from '../../data/org'
import { callsForProject } from '../../data/calls'
import { RagDot, SignalBadge } from './primitives'
import { CallsView } from './CallsView'
import { money } from './AccountView'
import { fmt } from './SignalLayer'

const PHASES = ['Discovery', 'Design', 'Build', 'Test', 'Go-live', 'Run'] as const

export function ProjectView({ projectId, onBack, onOpenAccount, backLabel = 'Back' }: { projectId: string; onBack: () => void; onOpenAccount?: (accountId: string) => void; backLabel?: string }) {
  const project = projectById(projectId)
  const account = project ? accountById(project.accountId) : undefined
  if (!project || !account) return null

  const projCalls = callsForProject(projectId)
  const allSignals = projCalls.flatMap((c) => c.signals).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const latestCall = projCalls[0]
  const latestSignal = allSignals[0]
  const phaseIdx = PHASES.indexOf(project.phase)

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors hover:text-text">
        <ArrowLeft size={14} /> {backLabel}
      </button>

      {/* header */}
      <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <RagDot health={project.rag} withLabel />
              <button onClick={() => onOpenAccount?.(account.id)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg-2 px-2.5 py-0.5 text-[11px] font-medium text-muted transition-colors hover:text-text">
                <Building2 size={11} /> {account.name}
              </button>
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">{project.name}</h2>
            <div className="mt-1 text-[13px] text-muted">{podName(account.pod)} pod · {project.sprint} · last activity {project.lastActivity}</div>
            {project.advisors.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="eyebrow mr-1">Advisors</span>
                {project.advisors.map((a) => (
                  <span key={a} className="inline-flex items-center rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[11px] font-medium text-muted">{personName(a)}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 text-[12px]">
            <span className="text-muted">Delivery Manager <b className="font-semibold text-text">{project.deliveryManager ? personName(project.deliveryManager) : 'None (resource-only)'}</b></span>
            <span className="text-muted">Consultants <b className="font-semibold text-text">{project.advisors.length}</b></span>
            <span className="text-muted">Spend <b className="font-semibold text-text">{money(project.spend)}</b></span>
            <span className="text-muted">Client Partner <b className="font-semibold text-text">{personName(account.clientPartner)}</b></span>
            <span className="text-muted">Client Director <b className="font-semibold text-text">{personName(account.clientDirector)}</b></span>
          </div>
        </div>

        {/* milestone / phase stepper */}
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-1.5 text-muted-2"><Flag size={12} /><span className="eyebrow">Delivery stage</span></div>
          <div className="flex items-center">
            {PHASES.map((ph, i) => {
              const done = i < phaseIdx, current = i === phaseIdx
              const color = current ? 'var(--accent)' : done ? 'var(--opp)' : 'var(--muted-2)'
              return (
                <div key={ph} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: color, opacity: done || current ? 1 : 0.35 }}>{i + 1}</span>
                    <span className="mt-1 text-[10.5px] font-medium" style={{ color: current ? 'var(--accent-d)' : 'var(--muted)' }}>{ph}</span>
                  </div>
                  {i < PHASES.length - 1 && <div className="mx-1 h-0.5 flex-1 rounded-full" style={{ background: i < phaseIdx ? 'var(--opp)' : 'var(--line-2)' }} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* project extension context */}
      {project.extension && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4" style={{ borderLeft: '3px solid var(--opp)' }}>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Project extension</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: 'var(--opp)', background: 'color-mix(in srgb, var(--opp) 12%, transparent)' }}>{project.extension.status}</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-text">{project.extension.detail}</p>
        </div>
      )}

      {/* latest call + latest signal */}
      {latestCall && latestSignal && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-1.5 text-muted-2"><Phone size={12} /><span className="eyebrow">Latest call</span></div>
            <h3 className="mt-1.5 text-[14px] font-semibold">{latestCall.title}</h3>
            <div className="mt-0.5 text-[12px] text-muted">{latestCall.type} · {fmt(latestCall.date)} · {latestCall.speaker}</div>
            <div className="mt-2 text-[11px] text-muted-2">Captured via Microsoft Teams, in your environment</div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-1.5 text-muted-2"><Activity size={12} /><span className="eyebrow">Latest signal</span></div>
            <div className="mt-1.5 flex items-center gap-2"><SignalBadge type={latestSignal.type} size="sm" /><span className="text-[12px] text-muted-2">{fmt(latestSignal.createdAt)}</span></div>
            <p className="mt-1.5 text-[13px] font-medium leading-snug">{latestSignal.summary}</p>
          </div>
        </div>
      )}

      {/* calls logged on this project */}
      <div className="mt-5">
        <CallsView calls={projCalls} title="Calls on this project" subtitle="Every call logged here, newest first. Open one to see what was discussed and what the Second Brain pulled out of it." />
      </div>
    </div>
  )
}
