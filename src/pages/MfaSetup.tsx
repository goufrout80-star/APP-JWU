import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { T, SHADOW } from '../lib/theme'

export default function MfaSetup() {
  const { user, aal, mfaEnrolled, securityLoading, refreshSecurity, signOut } = useAuth()
  const navigate = useNavigate()
  const started = useRef(false)
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (securityLoading || !user) return
    if (mfaEnrolled) {
      navigate(aal === 'aal2' ? '/overview' : '/mfa/challenge', { replace: true })
      return
    }
    if (started.current) return
    started.current = true

    void (async () => {
      const client = supabase
      if (!client) return setError('The secure authentication service is unavailable.')
      try {
        const { data, error: enrollError } = await client.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `JWU Admin · ${user.email}`,
        })
        if (enrollError) throw enrollError
        setFactorId(data.id)
        setQrCode(data.totp.qr_code)
        setSecret(data.totp.secret)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start MFA setup.')
      }
    })()
  }, [aal, mfaEnrolled, navigate, securityLoading, user])

  if (!securityLoading && !user) return <Navigate to="/login" replace />

  async function verify() {
    const client = supabase
    const cleanCode = code.replace(/\s/g, '')
    if (!client || !factorId || !/^\d{6}$/.test(cleanCode)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await client.auth.mfa.verify({ factorId, challengeId: challenge.id, code: cleanCode })
      if (verifyError) throw verifyError
      await refreshSecurity()
      navigate('/overview', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The verification code was not accepted.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: T.paper, padding: 24 }}>
      <section style={{ width: 'min(520px, 100%)', background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 22, boxShadow: SHADOW.lift, padding: 'clamp(22px,5vw,36px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <img src="/favicon.svg" alt="" width={34} height={34} />
          <strong style={{ color: T.ink }}>JUST WHY US · Security setup</strong>
        </div>
        <h1 style={{ margin: '26px 0 8px', color: T.ink, fontSize: 30, letterSpacing: '-0.035em' }}>Protect your admin account</h1>
        <p style={{ margin: 0, color: T.muted, fontSize: 14, lineHeight: 1.6 }}>Scan this QR code with Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app. MFA is required before admin data can be opened.</p>

        {qrCode ? (
          <>
            <div style={{ display: 'grid', placeItems: 'center', marginTop: 24, padding: 18, borderRadius: 16, background: '#fff', border: `1px solid ${T.hairline}` }}>
              <img src={qrCode} alt="Authenticator QR code" width={220} height={220} style={{ maxWidth: '100%', height: 'auto' }} />
            </div>
            <div style={{ marginTop: 14, padding: 12, borderRadius: 11, background: T.paper, color: T.body, fontSize: 12, overflowWrap: 'anywhere' }}>
              Manual setup key: <strong>{secret}</strong>
            </div>
            <label htmlFor="mfa-code" style={{ display: 'block', marginTop: 22, marginBottom: 7, color: T.ink, fontSize: 12, fontWeight: 800 }}>6-DIGIT CODE</label>
            <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${T.hairline}`, fontSize: 20, letterSpacing: '0.28em', textAlign: 'center', color: T.ink, background: T.surface }} />
            <button type="button" onClick={verify} disabled={busy || code.length !== 6} style={{ width: '100%', marginTop: 16, padding: 14, border: 0, borderRadius: 12, background: T.tealDeep, color: '#fff', fontWeight: 800, cursor: busy ? 'wait' : 'pointer', opacity: busy || code.length !== 6 ? 0.6 : 1 }}>
              {busy ? 'Verifying…' : 'Enable MFA'}
            </button>
          </>
        ) : !error ? <p style={{ marginTop: 24, color: T.muted }}>Preparing secure setup…</p> : null}

        {error && <div role="alert" style={{ marginTop: 15, padding: 12, borderRadius: 11, background: T.tintCoral, color: T.coralInk, fontSize: 13, lineHeight: 1.5 }}>{error}</div>}
        <button type="button" onClick={signOut} style={{ marginTop: 20, border: 0, background: 'transparent', color: T.muted, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Sign out</button>
      </section>
    </main>
  )
}
