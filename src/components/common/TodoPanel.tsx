import { useEffect, useState } from 'react'
import { ListChecks, Check, X, ArrowRight } from 'lucide-react'
import { fetchTodos, updateTodo } from '../../data/api'
import type { ApiTodo } from '../../data/api'
import { signals } from '../../data/signals'
import { accountName } from '../../data/org'
import { isLive } from '../../data/source'

// Kiera's to-do list (25 Jul call): every "Add to list" on a suggested action
// lands here, on her dashboard home - tick things off, or jump back to the
// signal each item came from. Per-user (login email) in live mode; mock mode
// keeps items in the browser for the demo.
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

  const openCount = todos.filter((t) => !t.done).length
  const sorted = [...todos].sort((a, b) => Number(a.done) - Number(b.done))

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <ListChecks size={15} style={{ color: 'var(--accent)' }} />
        <h3 className="text-[14px] font-semibold">My list</h3>
        <span className="text-[11px] text-muted-2">saved from suggested actions</span>
        {openCount > 0 && (
          <span className="ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: 'var(--accent)' }}>{openCount} to do</span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 rounded-xl bg-bg-2 px-4 py-3.5 text-[12.5px] text-muted">
          Nothing saved yet. Open any signal and hit <b className="font-semibold text-text">Add to list</b> on its suggested action - it lands here so you can work through everything in one place.
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {sorted.map((t) => {
            const acct = t.account_name ?? (t.account_id ? accountName(t.account_id) : null)
            return (
              <div key={t.id} className={`group flex items-center gap-2.5 rounded-xl border border-line bg-bg-2 px-3 py-2.5 transition-opacity ${t.done ? 'opacity-55' : ''}`}>
                <button
                  onClick={() => toggle(t)}
                  aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                  className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition-colors"
                  style={t.done ? { background: 'var(--opp)', borderColor: 'var(--opp)' } : { borderColor: 'var(--line-2)', background: 'var(--surface)' }}
                >
                  {t.done && <Check size={12} className="text-white" />}
                </button>
                <span className={`min-w-0 flex-1 text-[12.5px] leading-snug ${t.done ? 'line-through' : ''}`}>{t.title}</span>
                {acct && <span className="hidden shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted sm:inline">{acct}</span>}
                {onOpenSignal && (t.signal_id || t.account_id) && (
                  <button onClick={() => open(t)} title="Open the signal behind this" className="shrink-0 rounded-md p-1 text-muted-2 opacity-0 transition-opacity hover:text-text group-hover:opacity-100">
                    <ArrowRight size={13} />
                  </button>
                )}
                <button onClick={() => remove(t)} title="Remove from the list" className="shrink-0 rounded-md p-1 text-muted-2 opacity-0 transition-opacity hover:text-[var(--risk)] group-hover:opacity-100">
                  <X size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
