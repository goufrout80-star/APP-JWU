import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/auth'
import { IS_SUPABASE_CONFIGURED } from '../lib/supabase'
import { T } from '../lib/theme'

const EASE = [0.22, 1, 0.36, 1] as const

function PreviewChip({ tag, name, country, delay, style }: { tag: string; name: string; country: string; delay: number; style: React.CSSProperties }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay, duration: 0.6, ease: EASE }}
      style={{ position: 'absolute', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 15px', borderRadius: 14, background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.12)', whiteSpace: 'nowrap', ...style }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: tag === 'CONTACT' ? T.teal : '#FF8E72', background: tag === 'CONTACT' ? 'rgba(43,219,164,0.16)' : 'rgba(255,92,56,0.18)', padding: '4px 8px', borderRadius: 999 }}>{tag}</span>
      <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{name}</span><span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{country}</span></span>
    </motion.div>
  )
}

export default function Login() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState('')

  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/overview'
      navigate(from, { replace: true })
    }
  }, [user, navigate, location.state])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!IS_SUPABASE_CONFIGURED) return
    setError('')
    setBusy(true)
    const res = await signIn(email, password)
    setBusy(false)
    if (!res.ok) setError(res.error || 'Sign in failed.')
  }

  const field = (name: string): React.CSSProperties => ({ width: '100%', padding: '14px 16px', fontSize: 15, color: T.ink, background: T.surface, border: `1.5px solid ${focus === name ? T.tealDeep : T.hairline}`, borderRadius: 13, outline: 'none', boxShadow: focus === name ? `0 0 0 4px ${T.teal}26` : 'none', boxSizing: 'border-box', transition: 'border-color .18s, box-shadow .18s' })
  const disabled = busy || !IS_SUPABASE_CONFIGURED

  return (
    <div className="login-grid" style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)' }}>
      <div className="login-brand" style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(60% 50% at 18% 12%, rgba(43,219,164,0.22), transparent 60%), radial-gradient(55% 50% at 90% 88%, rgba(255,92,56,0.20), transparent 60%), linear-gradient(150deg, #0D1A14, #08120E)', padding: 'clamp(36px,4vw,64px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}><img src="/favicon.svg" alt="JUST WHY US" width={34} height={34} style={{ borderRadius: 9 }} /><span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>JUST WHY US <span style={{ color: T.teal }}>· Admin</span></span></div>
        <div style={{ position: 'relative' }}>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} style={{ fontSize: 'clamp(34px,3.6vw,52px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#fff', margin: 0, maxWidth: 460 }}>Every contact.<br />Every application.<br /><span style={{ color: T.teal }}>One inbox.</span></motion.h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', maxWidth: 380, marginTop: 18 }}>Manage the leads submitted through justwhyus.com from one secure workspace.</p>
          <div style={{ position: 'relative', height: 150, marginTop: 30 }}><PreviewChip tag="CONTACT" name="New message" country="Live from justwhyus.com" delay={0.3} style={{ top: 0, left: 0 }} /><PreviewChip tag="APPLY" name="New application" country="Creator or brand" delay={0.5} style={{ top: 64, left: 60 }} /></div>
        </div>
        <a href="https://www.justwhyus.com/" style={{ position: 'relative', fontSize: 12.5, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Visit justwhyus.com ↗</a>
      </div>

      <div style={{ background: T.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(24px,4vw,48px)' }}>
        <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 6px', color: T.ink }}>Welcome back</h2>
          <p style={{ fontSize: 14.5, color: T.muted, margin: '0 0 30px' }}>Sign in with an approved admin account.</p>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 8 }}>EMAIL</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocus('email')} onBlur={() => setFocus('')} placeholder="you@justwhyus.com" style={{ ...field('email'), marginBottom: 18 }} autoComplete="email" autoFocus />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 8 }}>PASSWORD</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocus('password')} onBlur={() => setFocus('')} placeholder="••••••••" style={field('password')} autoComplete="current-password" />
          {error && <p style={{ fontSize: 13, color: T.coral, margin: '12px 0 0', fontWeight: 600 }}>{error}</p>}
          <button type="submit" disabled={disabled} style={{ width: '100%', marginTop: 26, padding: '15px', borderRadius: 13, border: 'none', background: disabled ? T.muted : T.tealDeep, color: '#fff', fontSize: 15, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer' }}>{busy ? 'Signing in…' : 'Sign in →'}</button>
          {!IS_SUPABASE_CONFIGURED && <div style={{ marginTop: 24, padding: '12px 14px', borderRadius: 11, background: T.tintSun, border: '1px solid #F3E6C8', fontSize: 12.5, color: '#8A6A1E', lineHeight: 1.5 }}>The secure admin service is not configured. Sign-in is disabled until the Vercel environment variables are restored.</div>}
        </motion.form>
      </div>
    </div>
  )
}
