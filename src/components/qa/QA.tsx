import { useEffect, useMemo, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { fetchQA, submitFeedback } from '../../data/api'
import type { QaData, QaAuditRow } from '../../data/api'
import { SIGNAL_META } from '../../data/types'
import { mapSignalType } from '../../data/map'

// Standalone QA & Evaluation screen. Transparent by design: every signal shows the
// exact transcript quote it came from, and a human can mark it Correct / Incorrect.
// Those reviews feed the live "human agreement" number — the trust metric.
export function QA() {
  const [data, setData] = useState<QaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verdicts, setVerdicts] = useState<Record<string, 'correct' | 'incorrect'>>({})
  const [extra, setExtra] = useState<{ reviewed: number; agreed: number }>({ reviewed: 0, agreed: 0 })

  useEffect(() => {
    fetchQA().then(setData).catch((e) => setError(String(e?.message || e)))
  }, [])

  const review = async (row: QaAuditRow, verdict: 'correct' | 'incorrect') => {
    if (verdicts[row.id]) return // one review per signal this session
    setVerdicts((v) => ({ ...v, [row.id]: verdict }))
    setExtra((x) => ({ reviewed: x.reviewed + 1, agreed: x.agreed + (verdict === 'correct' ? 1 : 0) }))
    try { await submitFeedback(row.id, verdict) } catch { /* optimistic; ignore */ }
  }

  const reviewed = (data?.totals.reviewed ?? 0) + extra.reviewed
  const agreed = (data?.totals.agreed ?? 0) + extra.agreed
  const agreementPct = reviewed ? Math.round((100 * agreed) / reviewed) : null

  const byType = useMemo(() => {
    const m: Record<string, { n: number; avg: number | null }> = {}
    for (const r of data?.byType ?? []) m[mapSignalType(r.type)] = { n: r.n, avg: r.avg_conf }
    return m
  }, [data])

  if (error) return <Shell><div style={box}>Could not reach the API: <code>{error}</code></div></Shell>
  if (!data) return <Shell><div style={{ ...box, color: 'var(--muted)' }}>Loading QA metrics…</div></Shell>

  return (
    <Shell>
      {/* headline trust metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Signals captured" value={String(data.totals.signals)} />
        <Stat label="Calls processed" value={String(data.totals.calls)} />
        <Stat label="Human agreement" value={agreementPct == null ? '—' : `${agreementPct}%`} accent />
        <Stat label="Reviewed by humans" value={String(reviewed)} sub={`of ${data.totals.signals}`} />
      </div>

      {/* by signal type */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
        {(['risk', 'opportunity', 'update', 'people'] as const).map((t) => (
          <div key={t} style={card}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{SIGNAL_META[t].emoji} {SIGNAL_META[t].label}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{byType[t]?.n ?? 0}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>avg confidence {byType[t]?.avg ?? '—'}%</div>
          </div>
        ))}
      </div>

      {/* audit trail */}
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Audit trail — every signal, with its source</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>
        Each signal is traceable to the exact words on the call. Mark any one Correct or Incorrect — it updates the agreement score live.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.audit.map((row) => {
          const t = mapSignalType(row.type)
          const v = verdicts[row.id] || row.verdict
          return (
            <div key={row.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: SIGNAL_META[t].color }}>{SIGNAL_META[t].emoji} {SIGNAL_META[t].label.toUpperCase()}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>{row.account || ''}{row.project ? ` · ${row.project}` : ''}</span>
                    {row.confidence != null && <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>· confidence {row.confidence}%</span>}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{row.summary}</div>
                  {row.quote && (
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, borderLeft: '2px solid var(--line-2)', paddingLeft: 8 }}>
                      “{row.quote}”
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 4 }}>Source: {row.call_title || 'call'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
                  {v ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: v === 'correct' ? 'var(--opp)' : 'var(--risk)' }}>
                      {v === 'correct' ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => review(row, 'correct')} style={btn('var(--opp)')}>Correct</button>
                      <button onClick={() => review(row, 'incorrect')} style={btn('var(--risk)')}>Incorrect</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted-2)' }}>Tecknuovo × BraindAI · Second Brain</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '2px 0 0' }}>QA &amp; Evaluation</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>How the AI is performing, in the open — what it captured, how sure it was, and whether humans agree.</p>
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted-2)' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent ? 'var(--accent, #16a34a)' : undefined }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{sub}</div>}
    </div>
  )
}

const card: CSSProperties = { border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 14, padding: 14 }
const box: CSSProperties = { ...card, fontSize: 13 }
const btn = (c: string): CSSProperties => ({
  fontSize: 11, fontWeight: 700, color: c, background: 'transparent',
  border: `1px solid ${c}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
})
