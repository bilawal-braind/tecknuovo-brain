import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { TnMark } from './common/Brand'

// Branded sign-in screen. Kicks off the Microsoft (Entra) redirect flow.
export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="app-bg relative grid min-h-screen place-items-center overflow-hidden px-6">
      {/* soft accent glow behind the card */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-20%] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)', filter: 'blur(60px)' }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[400px] rounded-3xl border border-line bg-surface p-8 text-center"
        style={{ boxShadow: '0 24px 60px -20px rgba(0,0,0,0.25)' }}
      >
        <div className="flex items-center justify-center gap-2.5">
          <TnMark size={34} />
          <div className="text-left leading-tight">
            <div className="text-[15px] font-bold tracking-tight">Tecknuovo <span className="font-medium text-muted-2">× BraindAI</span></div>
            <div className="text-[11px] text-muted-2">Second Brain</div>
          </div>
        </div>

        <h1 className="mt-7 text-[22px] font-bold tracking-tight">Sign in</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">Use your Tecknuovo Microsoft account to access the dashboards.</p>

        <button
          onClick={onLogin}
          className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5"
          style={{ background: 'var(--accent)' }}
        >
          <span className="inline-grid grid-cols-2 gap-[2px]">
            <span className="h-2 w-2" style={{ background: 'rgba(255,255,255,0.95)' }} />
            <span className="h-2 w-2" style={{ background: 'rgba(255,255,255,0.7)' }} />
            <span className="h-2 w-2" style={{ background: 'rgba(255,255,255,0.7)' }} />
            <span className="h-2 w-2" style={{ background: 'rgba(255,255,255,0.95)' }} />
          </span>
          Sign in with Microsoft
        </button>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted-2">
          <ShieldCheck size={12} /> Only Tecknuovo accounts can access this.
        </div>
      </motion.div>

      <div className="absolute bottom-6 text-[11px] text-muted-2">Tecknuovo × BraindAI · Second Brain</div>
    </div>
  )
}
