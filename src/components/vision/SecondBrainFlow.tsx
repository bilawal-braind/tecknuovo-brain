import { useEffect, useRef } from 'react'
import {
  Video, Kanban, FileSignature, Repeat, MessageSquareText, FileText, PhoneCall, Landmark, BrainCircuit,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TnMark } from '../common/Brand'

// ── Layout (normalised 0..1; shared by the canvas geometry AND the HTML labels) ──
const HEAD_X = 0.055
const DAM_X = 0.6
const BASE_Y = 0.5
const AMP = 0.02

type Trib = { label: string; sub: string; side: 'top' | 'bottom'; mx: number; icon: LucideIcon }
const TRIBUTARIES: Trib[] = [
  { label: 'Monday.com', sub: 'status & cadence', side: 'top', mx: 0.15, icon: Kanban },
  { label: 'Statement of Work', sub: 'scope & value', side: 'bottom', mx: 0.225, icon: FileSignature },
  { label: 'Call cadences', sub: 'standups & check-ins', side: 'top', mx: 0.3, icon: Repeat },
  { label: 'Call one-liners', sub: 'quick summaries', side: 'bottom', mx: 0.375, icon: MessageSquareText },
  { label: 'SharePoint weekly reports', sub: 'delivery docs', side: 'top', mx: 0.45, icon: FileText },
  { label: 'Client Partner calls', sub: 'internal & external', side: 'bottom', mx: 0.525, icon: PhoneCall },
  { label: 'Monthly governance', sub: 'board & sponsors', side: 'top', mx: 0.585, icon: Landmark },
]

type Out = { label: string; color: string; to: string; y: number; emoji: string }
const OUTPUTS: Out[] = [
  { label: 'Opportunity', color: '#22c55e', to: 'Client Partner · Leadership', y: 0.17, emoji: '🟢' },
  { label: 'Risk', color: '#f0464d', to: 'Client Partner · Delivery', y: 0.39, emoji: '🔴' },
  { label: 'Update', color: '#3b82f6', to: 'Delivery dashboard', y: 0.61, emoji: '🔵' },
  { label: 'People', color: '#f59e0b', to: 'Talent · Delivery', y: 0.83, emoji: '🟡' },
]

const TRUNK_COLOR = '#23d6c0'
const TRIB_COLOR = '#56b6ff'
const DAM_COLOR = '#b07bff'

// cubic bezier point
function cubic(t: number, p0: P, c1: P, c2: P, c3: P): P {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return { x: a * p0.x + b * c1.x + c * c2.x + d * c3.x, y: a * p0.y + b * c1.y + c * c2.y + d * c3.y }
}
type P = { x: number; y: number }

function trunkNorm(t: number): P {
  const x = HEAD_X + (DAM_X - HEAD_X) * t
  const y = BASE_Y + AMP * Math.sin(((x - HEAD_X) * Math.PI * 2 * 1.3) / (DAM_X - HEAD_X))
  return { x, y }
}
function tribNorm(i: number, t: number): P {
  const tb = TRIBUTARIES[i]
  const Sx = tb.mx, Sy = tb.side === 'top' ? 0.205 : 0.795
  const Mt = (tb.mx - HEAD_X) / (DAM_X - HEAD_X)
  const M = trunkNorm(Mt)
  const C1 = { x: Sx + 0.025, y: Sy + (M.y - Sy) * 0.35 }
  const C2 = { x: M.x - 0.05, y: M.y }
  return cubic(t, { x: Sx, y: Sy }, C1, C2, M)
}
function outNorm(j: number, t: number): P {
  const E = { x: 0.905, y: OUTPUTS[j].y }
  const D = { x: DAM_X + 0.005, y: BASE_Y }
  const C1 = { x: DAM_X + 0.11, y: BASE_Y }
  const C2 = { x: 0.8, y: E.y }
  return cubic(t, D, C1, C2, E)
}

export function SecondBrainFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0, H = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 1.3)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // pre-rendered glow sprites (cheap drawImage instead of costly per-particle shadowBlur)
    const sprites = new Map<string, HTMLCanvasElement>()
    function sprite(color: string) {
      let s = sprites.get(color)
      if (s) return s
      s = document.createElement('canvas')
      s.width = 64; s.height = 64
      const sc = s.getContext('2d')!
      const g = sc.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, color)
      g.addColorStop(0.28, color)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      sc.fillStyle = g
      sc.fillRect(0, 0, 64, 64)
      sprites.set(color, s)
      return s
    }

    const cv = canvas
    const parent = cv.parentElement!
    function resize() {
      W = parent.clientWidth
      H = parent.clientHeight
      cv.width = W * dpr
      cv.height = H * dpr
      cv.style.width = W + 'px'
      cv.style.height = H + 'px'
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    const px = (n: P): P => ({ x: n.x * W, y: n.y * H })

    // ── particles ──
    type Particle = { t: number; speed: number; r: number; lane: number }
    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    const trunk: Particle[] = Array.from({ length: 42 }, () => ({ t: Math.random(), speed: rand(0.0011, 0.0019), r: rand(1.1, 2.6), lane: rand(-1, 1) }))
    const tribs: Particle[] = []
    TRIBUTARIES.forEach((_, i) => {
      for (let k = 0; k < 6; k++) tribs.push({ t: Math.random(), speed: rand(0.004, 0.0065), r: rand(0.9, 2), lane: i })
    })
    const outs: Particle[] = []
    OUTPUTS.forEach((_, j) => {
      for (let k = 0; k < 12; k++) outs.push({ t: Math.random(), speed: rand(0.0024, 0.0042), r: rand(1, 2.4), lane: j })
    })

    // hero "packet" - one call travelling the whole journey, then surfacing as Risk
    let comet = 0 // 0..2  (0..1 trunk, 1..2 risk output)

    function perp(fn: (t: number) => P, t: number): P {
      const a = fn(Math.max(0, t - 0.01)), b = fn(Math.min(1, t + 0.01))
      const dx = b.x - a.x, dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      return { x: -dy / len, y: dx / len }
    }

    function strokeChannel(fn: (t: number) => P, width: number, color: string, alpha: number) {
      ctx!.beginPath()
      const steps = 36
      for (let s = 0; s <= steps; s++) {
        const p = px(fn(s / steps))
        if (s === 0) ctx!.moveTo(p.x, p.y)
        else ctx!.lineTo(p.x, p.y)
      }
      ctx!.lineWidth = width
      ctx!.lineCap = 'round'
      ctx!.strokeStyle = color
      ctx!.globalAlpha = alpha
      ctx!.stroke()
      ctx!.globalAlpha = 1
    }

    function glowDot(p: P, r: number, color: string, alpha: number, blur: number) {
      const size = (r * 2 + blur) * 1.7
      ctx!.globalAlpha = alpha
      ctx!.drawImage(sprite(color), p.x - size / 2, p.y - size / 2, size, size)
      ctx!.globalAlpha = 1
    }

    function drawChannels() {
      ctx!.globalCompositeOperation = 'source-over'
      // river bed (thick, soft)
      strokeChannel((t) => trunkNorm(t), Math.max(10, H * 0.05), TRUNK_COLOR, 0.06)
      strokeChannel((t) => trunkNorm(t), Math.max(4, H * 0.02), TRUNK_COLOR, 0.05)
      TRIBUTARIES.forEach((_, i) => strokeChannel((t) => tribNorm(i, t), Math.max(3, H * 0.012), TRIB_COLOR, 0.05))
      OUTPUTS.forEach((o, j) => strokeChannel((t) => outNorm(j, t), Math.max(5, H * 0.022), o.color, 0.06))
    }

    function drawDam() {
      const d = px({ x: DAM_X, y: BASE_Y })
      const h = H * 0.2
      ctx!.globalCompositeOperation = 'lighter'
      const grd = ctx!.createLinearGradient(d.x, d.y - h, d.x, d.y + h)
      grd.addColorStop(0, 'rgba(176,123,255,0)')
      grd.addColorStop(0.5, DAM_COLOR)
      grd.addColorStop(1, 'rgba(176,123,255,0)')
      ctx!.fillStyle = grd
      const w = 7
      ctx!.fillRect(d.x - w / 2, d.y - h, w, h * 2)
      const hs = h * 1.7
      ctx!.globalAlpha = 0.45 + 0.18 * Math.sin(performance.now() / 360)
      ctx!.drawImage(sprite(DAM_COLOR), d.x - hs / 2, d.y - hs / 2, hs, hs)
      ctx!.globalAlpha = 1
      ctx!.globalCompositeOperation = 'source-over'
    }

    function frame() {
      // fade for trailing flow
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.fillStyle = 'rgba(5,13,13,0.30)'
      ctx!.fillRect(0, 0, W, H)

      drawChannels()

      ctx!.globalCompositeOperation = 'lighter'

      // tributaries (context joining the river)
      tribs.forEach((p) => {
        const n = tribNorm(p.lane, p.t)
        const pt = px(n)
        const a = Math.sin(p.t * Math.PI) * 0.85 + 0.05
        glowDot(pt, p.r, TRIB_COLOR, a, 8)
        if (!reduce) {
          p.t += p.speed
          if (p.t >= 1) p.t = 0
        }
      })

      // main river (the transcript), brightening downstream
      trunk.forEach((p) => {
        const n = trunkNorm(p.t)
        const off = perp((t) => trunkNorm(t), p.t)
        const spread = H * 0.018 * p.lane
        const pt = { x: n.x * W + off.x * spread, y: n.y * H + off.y * spread }
        const a = 0.35 + 0.55 * p.t
        glowDot(pt, p.r, TRUNK_COLOR, a, 9)
        if (!reduce) {
          p.t += p.speed
          if (p.t >= 1) p.t = 0
        }
      })

      // outputs (the four signals)
      outs.forEach((p) => {
        const n = outNorm(p.lane, p.t)
        const pt = px(n)
        const a = 0.85 - 0.35 * p.t
        glowDot(pt, p.r, OUTPUTS[p.lane].color, a, 9)
        if (!reduce) {
          p.t += p.speed
          if (p.t >= 1) p.t = 0
        }
      })

      drawDam()

      // hero packet
      ctx!.globalCompositeOperation = 'lighter'
      let cp: P, ccol: string
      if (comet < 1) {
        cp = px(trunkNorm(comet))
        ccol = '#ffffff'
      } else {
        cp = px(outNorm(1, comet - 1))
        ccol = OUTPUTS[1].color
      }
      glowDot(cp, 4.5, ccol, 1, 22)
      glowDot(cp, 2, '#ffffff', 1, 10)
      if (!reduce) {
        comet += 0.0016
        if (comet >= 2) comet = 0
      }

      ctx!.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(frame)
    }

    let raf = requestAnimationFrame(frame)
    if (reduce) {
      // single settled frame
      cancelAnimationFrame(raf)
      for (let i = 0; i < 400; i++) {
        trunk.forEach((p) => { p.t = (p.t + p.speed) % 1 })
        tribs.forEach((p) => { p.t = (p.t + p.speed) % 1 })
        outs.forEach((p) => { p.t = (p.t + p.speed) % 1 })
      }
      ctx.fillStyle = 'rgba(5,13,13,1)'
      ctx.fillRect(0, 0, W, H)
      frame()
      cancelAnimationFrame(raf)
    }

    function onVis() {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduce) raf = requestAnimationFrame(frame)
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className="brain-canvas relative h-screen w-screen overflow-hidden text-white">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* header */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <TnMark size={30} color="#ffffff" />
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">Tecknuovo <span className="font-medium text-white/55">× BraindAI</span></div>
            <div className="text-[11px] text-white/55">Second Brain</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brain-teal)]">How it works</div>
          <div className="text-[13px] text-white/70">One call, enriched and routed - in a single flow</div>
        </div>
      </div>

      {/* title */}
      <div className="pointer-events-none absolute left-1/2 top-[13%] z-10 -translate-x-1/2 text-center">
        <h1 className="text-[26px] font-bold tracking-tight">How a single call becomes intelligence</h1>
      </div>

      {/* river head */}
      <Node x={2} y={50} anchor="left">
        <Chip icon={Video} title="Client call transcript" sub="the river starts here" tone="head" />
      </Node>

      {/* tributaries */}
      {TRIBUTARIES.map((t) => (
        <Node key={t.label} x={t.mx * 100} y={t.side === 'top' ? 20.5 : 79.5}>
          <Chip icon={t.icon} title={t.label} sub={t.sub} tone="ctx" />
        </Node>
      ))}

      {/* classifier */}
      <Node x={DAM_X * 100} y={29}>
        <Chip icon={BrainCircuit} title="AI Classifier" sub="reads it with full account context" tone="ai" />
      </Node>

      {/* outputs */}
      {OUTPUTS.map((o) => (
        <div key={o.label} className="absolute z-10 -translate-y-1/2" style={{ right: '2.5%', top: `${o.y * 100}%` }}>
          <div className="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.06] px-3.5 py-2.5 backdrop-blur-md" style={{ boxShadow: `0 0 0 1px ${o.color}22, 0 10px 30px -12px ${o.color}66` }}>
            <span className="grid h-7 w-7 place-items-center rounded-full text-[13px]" style={{ background: `${o.color}22`, boxShadow: `0 0 12px ${o.color}88` }}>{o.emoji}</span>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold" style={{ color: o.color }}>{o.label}</div>
              <div className="text-[10.5px] text-white/60">{o.to}</div>
            </div>
          </div>
        </div>
      ))}

      {/* footer caption */}
      <div className="absolute bottom-5 left-1/2 z-10 w-[min(900px,92%)] -translate-x-1/2 text-center">
        <p className="text-[12.5px] leading-relaxed text-white/70">
          One call flows in. Every relevant source - Monday, the SOW, cadences, weekly reports, governance - sticks to it as it travels. The AI classifier reads the enriched call with full account context, then splits it into the four signals, each routed to the right person on the right dashboard.
        </p>
      </div>
    </div>
  )
}

function Node({ x, y, anchor = 'center', children }: { x: number; y: number; anchor?: 'center' | 'left'; children: React.ReactNode }) {
  return (
    <div
      className="absolute z-10"
      style={{ left: `${x}%`, top: `${y}%`, transform: anchor === 'left' ? 'translateY(-50%)' : 'translate(-50%,-50%)' }}
    >
      {children}
    </div>
  )
}

const TONE: Record<string, { ring: string; glow: string; iconBg: string }> = {
  head: { ring: 'rgba(35,214,192,0.5)', glow: 'rgba(35,214,192,0.45)', iconBg: 'rgba(35,214,192,0.16)' },
  ctx: { ring: 'rgba(86,182,255,0.35)', glow: 'rgba(86,182,255,0.3)', iconBg: 'rgba(86,182,255,0.16)' },
  ai: { ring: 'rgba(176,123,255,0.5)', glow: 'rgba(176,123,255,0.5)', iconBg: 'rgba(176,123,255,0.18)' },
}
function Chip({ icon: Icon, title, sub, tone }: { icon: LucideIcon; title: string; sub: string; tone: 'head' | 'ctx' | 'ai' }) {
  const t = TONE[tone]
  return (
    <div
      className="flex items-center gap-2.5 whitespace-nowrap rounded-2xl border border-white/10 bg-white/[0.055] px-3.5 py-2.5 backdrop-blur-md"
      style={{ boxShadow: `0 0 0 1px ${t.ring}, 0 12px 34px -16px ${t.glow}` }}
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: t.iconBg, boxShadow: `0 0 16px ${t.glow}` }}>
        <Icon size={16} className="text-white" />
      </span>
      <div className="leading-tight">
        <div className="text-[13px] font-semibold">{title}</div>
        <div className="text-[10.5px] text-white/55">{sub}</div>
      </div>
    </div>
  )
}
