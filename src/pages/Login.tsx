import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth'
import { IS_SUPABASE_CONFIGURED } from '../lib/supabase'
import { T } from '../lib/theme'

const EASE = [0.22, 1, 0.36, 1] as const

/* floating preview chip for the brand panel */
function PreviewChip({ tag, name, country, delay, style }: { tag: string; name: string; country: string; delay: number; style: React.CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, ease: EASE }}
      style={{
        position: 'absolute', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 15px', borderRadius: 14,
        background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 18px 40px -20px rgba(0,0,0,0.6)', whiteSpace: 'nowrap', ...style,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: tag === 'CONTACT' ? T.teal : '#FF8E72', background: tag === 'CONTACT' ? 'rgba(43,219,164,0.16)' : 'rgba(255,92,56,0.18)', padding: '4px 8px', borderRadius: 999 }}>{tag}</span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{name}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{country}</span>
      </span>
    </motion.div>
  )
}

export default function Login() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState('')

  if (user) navigate('/', { replace: true })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setBusy(true)
    const res = await signIn(email, password)
    setBusy(false)
    if (res.ok) navigate('/', { replace: true })
    else setError(res.error || 'Sign in failed.')
  }

  const field = (name: string): React.CSSProperties => ({
    width: '100%', padding: '14px 16px', fontSize: 15, color: T.ink, background: T.surface,
    border: `1.5px solid ${focus === name ? T.tealDeep : T.hairline}`, borderRadius: 13, outline: 'none',
    boxShadow: focus === name ? `0 0 0 4px ${T.teal}26` : 'none', boxSizing: 'border-box', transition: 'border-color .18s, box-shadow .18s',
  })

  return (
    <div className="login-grid" style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)' }}>
      {/* ── LEFT: brand panel ── */}
      <div className="login-brand" style={{ position: 'relative', overflow: 'hidden', background: `radial-gradient(60% 50% at 18% 12%, rgba(43,219,164,0.22), transparent 60%), radial-gradient(55% 50% at 90% 88%, rgba(255,92,56,0.20), transparent 60%), linear-gradient(150deg, #0D1A14, #08120E)`, padding: 'clamp(36px,4vw,64px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* grid texture */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '32px 32px', maskImage: 'radial-gradient(120% 100% at 30% 20%, #000, transparent 75%)', WebkitMaskImage: 'radial-gradient(120% 100% at 30% 20%, #000, transparent 75%)' }} />

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
          <img src="/favicon.svg" alt="JUST WHY US" width={34} height={34} style={{ borderRadius: 9, display: 'block' }} />
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.02em', color: '#fff' }}>JUST WHY US <span style={{ color: T.teal }}>· Admin</span></span>
        </motion.div>

        <div style={{ position: 'relative' }}>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.6, ease: EASE }}
            style={{ fontSize: 'clamp(34px,3.6vw,52px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#fff', margin: 0, maxWidth: 460 }}>
            Every contact.<br />Every application.<br /><span style={{ color: T.teal }}>One inbox.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}
            style={{ fontSize: 15.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', maxWidth: 380, marginTop: 18 }}>
            See who's reaching out, where they're from, and how long they explored before they hit send.
          </motion.p>

          {/* floating preview chips */}
          <div style={{ position: 'relative', height: 150, marginTop: 30 }}>
            <PreviewChip tag="CONTACT" name="New message" country="🌍 Country · time on site" delay={0.5} style={{ top: 0, left: 0 }} />
            <PreviewChip tag="APPLY" name="New application" country="🌍 Country · creator or brand" delay={0.7} style={{ top: 64, left: 60 }} />
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ position: 'relative', fontSize: 12.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
          app.justwhyus.com
        </motion.div>
      </div>

      {/* ── RIGHT: form ── */}
      <div style={{ background: T.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px,4vw,48px)' }}>
        <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
          onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 6px', color: T.ink }}>Welcome back</h2>
          <p style={{ fontSize: 14.5, color: T.muted, margin: '0 0 30px' }}>Sign in to the admin dashboard.</p>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocus('email')} onBlur={() => setFocus('')} placeholder="you@justwhyus.com" style={{ ...field('email'), marginBottom: 18 }} autoFocus />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocus('password')} onBlur={() => setFocus('')} placeholder="••••••••" style={field('password')} />

          {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 13, color: T.coral, margin: '12px 0 0', fontWeight: 600 }}>{error}</motion.p>}

          <motion.button type="submit" disabled={busy} whileHover={busy ? undefined : { y: -2 }} whileTap={busy ? undefined : { scale: 0.985 }}
            style={{ width: '100%', marginTop: 26, padding: '15px', borderRadius: 13, border: 'none', background: busy ? T.muted : T.tealDeep, color: '#fff', fontSize: 15, fontWeight: 800, cursor: busy ? 'default' : 'pointer', boxShadow: busy ? 'none' : `0 14px 30px -12px ${T.tealDeep}99`, transition: 'background .2s' }}>
            {busy ? 'Signing in…' : 'Sign in →'}
          </motion.button>

          {!IS_SUPABASE_CONFIGURED && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, padding: '11px 14px', borderRadius: 11, background: T.tintSun, border: `1px solid #F3E6C8` }}>
              <span style={{ fontSize: 14 }}>🔑</span>
              <span style={{ fontSize: 12.5, color: '#8A6A1E', lineHeight: 1.5 }}>Supabase isn't configured — using a local mock session (any valid email + 6+ char password).</span>
            </div>
          )}
        </motion.form>
      </div>
    </div>
  )
}
