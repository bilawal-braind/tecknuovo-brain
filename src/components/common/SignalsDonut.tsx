import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { Signal, SignalType } from '../../data/types'
import { SIGNAL_META } from '../../data/types'

const COLORS: Record<SignalType, string> = {
  opportunity: '#15a34a', risk: '#dc2626', update: '#2563eb', people: '#d97706',
}
const ORDER: SignalType[] = ['opportunity', 'risk', 'update', 'people']

export function SignalsDonut({ signals }: { signals: Signal[] }) {
  const data = ORDER.map((t) => ({ type: t, label: SIGNAL_META[t].label, value: signals.filter((s) => s.type === t).length, color: COLORS[t] })).filter((d) => d.value > 0)
  const total = signals.length

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="eyebrow">Signals captured</div>
      <h3 className="mt-1 text-[14px] font-semibold">By type, this period</h3>
      <div className="mt-2 flex items-center gap-5">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {data.map((d) => <Cell key={d.type} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{total}</span>
            <span className="text-[10px] text-muted-2">signals</span>
          </div>
        </div>
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.type} className="flex items-center gap-2 text-[12.5px]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
              <span className="text-muted">{d.label}</span>
              <span className="ml-auto font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
