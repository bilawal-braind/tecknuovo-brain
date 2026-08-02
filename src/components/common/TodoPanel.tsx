import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { ListChecks, Check, X, ArrowRight, Pencil, Plus } from 'lucide-react'
import { fetchTodos, addTodo, updateTodo } from '../../data/api'
import type { ApiTodo } from '../../data/api'
import { signals } from '../../data/signals'
import { accountName } from '../../data/org'
import { isLive } from '../../data/source'

// Kiera's to-do list (25 Jul call), living in the sidebar's bottom-left space.
// Items arrive two ways: "Add to list" on any signal's suggested action, or
// typed straight in. Everything is editable in place - rename, tick off, remove.
// Per-user (login email) in live mode; mock mode keeps items in the browser.
const isReal = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)
const localId = () => `local-${Math.random().toString(36).slice(2, 10)}`

export function TodoPanel({ onOpenSignal, onOpenAccount, variant = 'panel' }: {
  onOpenSignal?: (s: { id: string; accountId: string; projectId?: string }) => void
  onOpenAccount?: (accountId: string) => void
  variant?: 'panel' | 'rail'
}) {
  const [todos, setTodos] = useState<ApiTodo[]>([])
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const reload = () => fetchTodos().then(setTodos)
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

  const addOwn = () => {
    const title = draft.trim().slice(0, 300)
    if (!title) return
    setDraft('')
    if (isLive) addTodo(title).then(reload).catch(() => {})
    else setTodos((p) => [{ id: localId(), signal_id: null, title, account_id: null, done: false, created_at: '' }, ...p])
  }
  const toggle = (t: ApiTodo) => {
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)))
    if (isReal(t.id)) updateTodo(t.id, { done: !t.done }).catch(() => {})
  }
  const remove = (t: ApiTodo) => {
    setTodos((p) => p.filter((x) => x.id !== t.id))
    if (isReal(t.id)) updateTodo(t.id, { remove: true }).catch(() => {})
  }
  const startEdit = (t: ApiTodo) => { setEditing(t.id); setEditText(t.title) }
  const saveEdit = (t: ApiTodo) => {
    const title = editText.trim().slice(0, 300)
    setEditing(null)
    if (!title || title === t.title) return
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, title } : x)))
    if (isReal(t.id)) updateTodo(t.id, { title }).catch(() => {})
  }
  const onEditKey = (e: KeyboardEvent<HTMLInputElement>, t: ApiTodo) => {
    if (e.key === 'Enter') saveEdit(t)
    if (e.key === 'Escape') setEditing(null)
  }
  const open = (t: ApiTodo) => {
    const s = t.signal_id ? signals.find((x) => x.id === t.signal_id) : undefined
    if (s && onOpenSignal) return onOpenSignal(s)
    if (t.account_id && onOpenAccount) return onOpenAccount(t.account_id)
    if (t.account_id && onOpenSignal) onOpenSignal({ id: t.signal_id ?? '', accountId: t.account_id })
  }

  const doneCount = todos.filter((t) => t.done).length
  const openCount = todos.length - doneCount
  const sorted = [...todos].sort((a, b) => Number(a.done) - Number(b.done))
  const rail = variant === 'rail'

  return (
    <div className={rail
      ? 'flex min-h-0 flex-shrink-0 flex-col border-t border-line px-3 pb-2 pt-3'
      : 'glass relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line p-5'}
      style={rail ? undefined : { background: 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 7%, var(--surface)), var(--surface) 60%)' }}>
      {!rail && <div className="ai-sheen pointer-events-none absolute inset-x-0 top-0 h-[2px]" />}

      <div className="flex items-center gap-2 px-1">
        <span className={`grid place-items-center rounded-lg text-white ${rail ? 'h-6 w-6' : 'h-7 w-7'}`}
          style={{ background: 'var(--accent)', boxShadow: '0 0 14px color-mix(in srgb, var(--accent) 50%, transparent)' }}>
          <ListChecks size={rail ? 12 : 14} />
        </span>
        <h3 className={`font-bold tracking-tight ${rail ? 'text-[12.5px]' : 'text-[14px]'}`}>My list</h3>
        {openCount > 0 && (
          <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--accent)' }}>{openCount}</span>
        )}
      </div>

      {todos.length > 0 && (
        <div className="mt-2 flex items-center gap-2 px-1">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-2">
            <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.round((100 * doneCount) / todos.length)}%`, background: 'linear-gradient(90deg, color-mix(in srgb, var(--opp) 55%, transparent), var(--opp))' }} />
          </div>
          <span className="shrink-0 text-[9.5px] font-semibold text-muted-2">{doneCount}/{todos.length}</span>
        </div>
      )}

      <div className={`mt-2 space-y-1 overflow-y-auto pr-0.5 ${rail ? 'max-h-[26vh]' : ''}`} style={rail ? undefined : { maxHeight: 280 }}>
        {sorted.length === 0 && (
          <p className={`rounded-lg border border-dashed border-line bg-bg-2 px-2.5 py-2.5 leading-relaxed text-muted-2 ${rail ? 'text-[10.5px]' : 'text-[12px]'}`}>
            Save any signal's suggested action with <b className="font-semibold" style={{ color: 'var(--accent-d)' }}>+ Add to list</b>, or type your own below.
          </p>
        )}
        {sorted.map((t, i) => {
          const acct = t.account_name ?? (t.account_id ? accountName(t.account_id) : null)
          const canOpen = !!(t.signal_id || t.account_id) && !!(onOpenSignal || onOpenAccount)
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.25) }}
              className={`group flex items-start gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 transition-all ${t.done ? 'opacity-50' : 'hover:border-[var(--line-2)]'}`}
            >
              <button
                onClick={() => toggle(t)}
                aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                className="mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded border transition-all"
                style={t.done ? { background: 'var(--opp)', borderColor: 'var(--opp)' } : { borderColor: 'var(--line-2)', background: 'var(--bg-2)' }}
              >
                {t.done && <Check size={10} className="text-white" />}
              </button>
              <div className="min-w-0 flex-1">
                {editing === t.id ? (
                  <input
                    autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => onEditKey(e, t)} onBlur={() => saveEdit(t)}
                    className="w-full rounded border border-line bg-bg-2 px-1.5 py-0.5 text-[11px] text-text outline-none focus:border-[var(--accent)]"
                  />
                ) : (
                  <div className={`text-[11px] leading-snug ${t.done ? 'line-through' : ''}`}>{t.title}</div>
                )}
                {acct && <div className="mt-0.5 text-[9.5px] font-semibold text-muted-2">{acct}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {editing !== t.id && (
                  <button onClick={() => startEdit(t)} title="Edit" className="rounded p-0.5 text-muted-2 hover:text-text"><Pencil size={11} /></button>
                )}
                {canOpen && (
                  <button onClick={() => open(t)} title="Open where this came from" className="rounded p-0.5 text-muted-2 hover:text-[var(--accent-d)]"><ArrowRight size={11} /></button>
                )}
                <button onClick={() => remove(t)} title="Remove" className="rounded p-0.5 text-muted-2 hover:text-[var(--risk)]"><X size={11} /></button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* customisable: type a task of your own - not everything comes from a signal */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addOwn() }}
          placeholder="Add a task…"
          className={`min-w-0 flex-1 rounded-lg border border-line bg-bg-2 px-2.5 text-text outline-none placeholder:text-muted-2 focus:border-[var(--accent)] ${rail ? 'py-1.5 text-[11px]' : 'py-2 text-[12px]'}`}
        />
        <button onClick={addOwn} disabled={!draft.trim()} aria-label="Add task"
          className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-white transition-transform hover:scale-105 disabled:opacity-40"
          style={{ background: 'var(--accent)' }}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}
