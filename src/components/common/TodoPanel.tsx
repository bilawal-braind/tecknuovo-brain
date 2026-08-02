import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ListChecks, Check, X, ArrowRight } from 'lucide-react'
import { fetchTodos, updateTodo } from '../../data/api'
import type { ApiTodo } from '../../data/api'
import { signals } from '../../data/signals'
import { accountName } from '../../data/org'
import { isLive } from '../../data/source'

// Kiera's to-do list (25 Jul call): every "Add to list" on a suggested action
// lands here - tick things off, or jump back to the signal each item came from.
// Per-user (login email) in live mode; mock mode keeps items in the browser.
export function TodoPanel({ onOpenSignal }: { onOpenSignal?: (s: { id: string; accountId: string; projectId?: string }) => void }) {
  const [todos, setTodos] = useState<ApiTodo[]>([])

  useEffect(() => {
    let on = true
    if (isLive) fetchTodos().then((t) => { if (on) setTodos(t) })
    const onAdd = (e: Event) => {
      const d = (e as CustomEvent).detail as ApiTodo | undefined
      if (isLive) fetchTodos().then((t) => { if (on) setTodos(t) })
      else if (d) setTodos((p) => (p.some((x) => x.signal_id && x.signal_id === d.signal_id) ? p : [d, ...p]))
    }
    window.addEventListener('tn-todo-added', onAdd)
    return () => { on = false; window.removeEventListener('tn-todo-added', onAdd) }
  }, [])

  const isReal = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)
  const toggle = (t: ApiTodo) => {
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)))
    if (isReal(t.id)) updateTodo(t.id, { done: !t.done }).catch(() => {})
  }
  const remove = (t: ApiTodo) => {
    setTodos((p) => p.filter((x) => x.id !== t.id))
    if (isReal(t.id)) updateTodo(t.id, { remove: true }).catch(() => {})
  }
  const open = (t: ApiTodo) => {
    if (!onOpenSignal) return
    const s = t.signal_id ? signals.find((x) => x.id === t.signal_id) : undefined
    if (s) onOpenSignal(s)
    else if (t.account_id) onOpenSignal({ id: t.signal_id ?? '', accountId: t.account_id })
  }

  const doneCount = todos.filter((t) => t.done).length
  const openCount = todos.length - doneCount
  const sorted = [...todos].sort((a, b) => Number(a.done) - Number(b.done))

  return (
    <div className="glass relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line p-5"
      style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 7%, var(--surface)), var(--surface) 60%)' }}>
      <div className="ai-sheen pointer-events-none absolute inset-x-0 top-0 h-[2px]" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: 'var(--accent)', boxShadow: '0 0 16px color-mix(in srgb, var(--accent) 55%, transparent)' }}>
          <ListChecks size={14} />
        </span>
        <h3 className="text-[14px] font-bold tracking-tight">My list</h3>
        {openCount > 0 && (
          <span className="ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: 'var(--accent)' }}>{openCount} to do</span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-2">Saved from suggested actions - your working queue.</p>

      {/* progress line - fills as the list gets worked through */}
      {todos.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-2">
            <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.round((100 * doneCount) / todos.length)}%`, background: 'linear-gradient(90deg, color-mix(in srgb, var(--opp) 55%, transparent), var(--opp))' }} />
          </div>
          <span className="shrink-0 text-[10.5px] font-semibold text-muted-2">{doneCount}/{todos.length} done</span>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-surface px-4 py-4 text-[12px] leading-relaxed text-muted">
          Nothing saved yet. Open any signal and hit <b className="font-semibold" style={{ color: 'var(--accent-d)' }}>+ Add to list</b> on its suggested action - it lands here so you can work through everything in one place.
        </p>
      ) : (
        <div className="mt-3 space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: 280 }}>
          {sorted.map((t, i) => {
            const acct = t.account_name ?? (t.account_id ? accountName(t.account_id) : null)
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                className={`group flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 transition-all ${t.done ? 'opacity-50' : 'hover:border-[var(--line-2)]'}`}
              >
                <button
                  onClick={() => toggle(t)}
                  aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                  className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition-all"
                  style={t.done ? { background: 'var(--opp)', borderColor: 'var(--opp)' } : { borderColor: 'var(--line-2)', background: 'var(--bg-2)' }}
                >
                  {t.done && <Check size={12} className="text-white" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-[12.5px] leading-snug ${t.done ? 'line-through' : ''}`}>{t.title}</div>
                  {acct && <div className="mt-0.5 text-[10.5px] font-semibold text-muted-2">{acct}</div>}
                </div>
                {onOpenSignal && (t.signal_id || t.account_id) && (
                  <button onClick={() => open(t)} title="Open the signal behind this" className="shrink-0 rounded-md p-1 text-muted-2 opacity-0 transition-opacity hover:text-[var(--accent-d)] group-hover:opacity-100">
                    <ArrowRight size={13} />
                  </button>
                )}
                <button onClick={() => remove(t)} title="Remove from the list" className="shrink-0 rounded-md p-1 text-muted-2 opacity-0 transition-opacity hover:text-[var(--risk)] group-hover:opacity-100">
                  <X size={13} />
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
