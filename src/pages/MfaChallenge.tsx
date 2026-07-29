import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { T, SHADOW } from '../lib/theme'

export default function MfaChallenge() {
  const { user, aal, mfaEnrolled, mfaFactorId, securityLoading, refreshSecurity, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!securityLoading && !user) return <Navigate to="/login" replace />
  if (!securityLoading && !mfaEnrolled) return <Navigate to="/mfa/setup" replace />
  if (!securityLoading && aal === 'aal2') return <Navigate to="/overview" replace />

  async function verify() {
    const client = supabase
    const cleanCode = code.replace(/\s/g, '')
    if (!client || !mfaFactorId || !/^\d{6}$/.test(cleanCode)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: mfaFactorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await client.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: cleanCode })
      if (verifyError) throw verifyError
      await refreshSecurity()
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/overview'
      navigate(from, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The verification code was not accepted.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: T.paper, padding: 24 }}>
      <section style={{ width: 'min(430px, 100%)', background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 22, boxShadow: SHADOW.lift, padding: 'clamp(22px,5vw,36px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <img src="/favicon.svg" alt="" width={34} height={34} />
          <strong style={{ color: T.ink }}>JUST WHY US · Secure sign-in</strong>
        </div>
        <h1 style={{ margin: '26px 0 8px', color: T.ink, fontSize: 30, letterSpacing: '-0.035em' }}>Enter your security code</h1>
        <p style={{ margin: 0, color: T.muted, fontSize: 14, lineHeight: 1.6 }}>Open your authenticator app and enter the current 6-digit code for {user?.email}.</p>

        <label htmlFor="mfa-code" style={{ display: 'block', marginTop: 25, marginBottom: 7, color: T.ink, fontSize: 12, fontWeight: 800 }}>AUTHENTICATOR CODE</label>
        <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => { if (e.key === 'Enter') void verify() }}
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${T.hairline}`, fontSize: 20, letterSpacing: '0.28em', textAlign: 'center', color: T.ink, background: T.surface }} />
        <button type="button" onClick={verify} disabled={busy || code.length !== 6} style={{ width: '100%', marginTop: 16, padding: 14, border: 0, borderRadius: 12, background: T.tealDeep, color: '#fff', fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy || code.length !== 6 ? 0.6 : 1 }}>
          {busy ? 'Verifying…' : 'Verify and continue'}
        </button>

        {error && <div role="alert" style={{ marginTop: 15, padding: 12, borderRadius: 11, background: T.tintCoral, color: T.coralInk, fontSize: 13, lineHeight: 1.5 }}>{error}</div>}
        <button type="button" onClick={signOut} style={{ marginTop: 20, border: 0, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Sign out</button>
      </section>
    </main>
  )
}
