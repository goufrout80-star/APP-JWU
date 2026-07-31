import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase, IS_SUPABASE_CONFIGURED } from '../lib/supabase'
import { T } from '../lib/theme'

const EASE = [0.22, 1, 0.36, 1] as const
const INVALID_LINK_MESSAGE = 'This reset link is invalid or has expired. Request a new reset email from the login page.'

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function clearRecoveryTokensFromUrl() {
  window.history.replaceState({}, document.title, window.location.pathname)
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [linkError, setLinkError] = useState('')
  const [success, setSuccess] = useState(false)
  const [focus, setFocus] = useState('')

  useEffect(() => {
    const client = supabase
    if (!IS_SUPABASE_CONFIGURED || !client) {
      setLinkError('The secure authentication service is unavailable.')
      setChecking(false)
      return
    }

    let active = true

    function acceptRecoverySession() {
      if (!active) return
      clearRecoveryTokensFromUrl()
      setReady(true)
      setLinkError('')
      setChecking(false)
    }

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!active || !session) return
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        acceptRecoverySession()
      }
    })

    void (async () => {
      try {
        const url = new URL(window.location.href)
        const query = url.searchParams
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
        const authError = hash.get('error_description') || query.get('error_description')

        if (authError) {
          throw new Error(authError)
        }

        const accessToken = hash.get('access_token')
        const refreshToken = hash.get('refresh_token')
        const authorizationCode = query.get('code')

        if (accessToken && refreshToken) {
          const { error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) throw sessionError
        } else if (authorizationCode) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(authorizationCode)
          if (exchangeError) throw exchangeError
        }

        let sessionFound = false
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { data, error: sessionError } = await client.auth.getSession()
          if (sessionError) throw sessionError
          if (data.session) {
            sessionFound = true
            break
          }
          await wait(250)
        }

        if (!sessionFound) {
          throw new Error(INVALID_LINK_MESSAGE)
        }

        const { data: userData, error: userError } = await client.auth.getUser()
        if (userError || !userData.user) {
          throw userError || new Error(INVALID_LINK_MESSAGE)
        }

        acceptRecoverySession()
      } catch (recoveryError) {
        if (!active) return
        const message = recoveryError instanceof Error ? recoveryError.message : INVALID_LINK_MESSAGE
        setLinkError(message.toLowerCase().includes('expired') || message.toLowerCase().includes('invalid') ? INVALID_LINK_MESSAGE : message)
        setChecking(false)
      }
    })()

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const client = supabase
    setError('')

    if (!client || !ready) {
      setError(INVALID_LINK_MESSAGE)
      return
    }
    if (password.length < 12) {
      setError('Use at least 12 characters for the new password.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    const { error: updateError } = await client.auth.updateUser({ password })
    setBusy(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    window.setTimeout(async () => {
      await client.auth.signOut()
      navigate('/login', { replace: true })
    }, 1800)
  }

  const field = (name: string): React.CSSProperties => ({
    width: '100%',
    padding: '14px 16px',
    fontSize: 15,
    color: T.ink,
    background: T.surface,
    border: `1.5px solid ${focus === name ? T.tealDeep : T.hairline}`,
    borderRadius: 13,
    outline: 'none',
    boxShadow: focus === name ? `0 0 0 4px ${T.teal}26` : 'none',
    boxSizing: 'border-box',
    transition: 'border-color .18s, box-shadow .18s',
  })

  return (
    <div style={{ minHeight: '100dvh', background: T.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}
        style={{ width: '100%', maxWidth: 420, background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 22, padding: '30px 28px', boxShadow: '0 20px 70px rgba(13,26,20,0.10)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 26 }}>
          <img src="/favicon.svg" alt="JUST WHY US" width={34} height={34} style={{ borderRadius: 9 }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: T.ink }}>JUST WHY US <span style={{ color: T.tealDeep }}>· Admin</span></span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 7px', color: T.ink }}>Set a new password</h1>
        <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.55, margin: '0 0 25px' }}>Choose a strong password for your approved admin account.</p>

        {checking ? (
          <div style={{ padding: '22px 0', color: T.muted, fontSize: 14 }}>Checking your secure reset link…</div>
        ) : success ? (
          <div style={{ padding: '15px 16px', borderRadius: 13, background: T.tintTeal, color: T.tealInk, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
            Password updated. Redirecting you to sign in…
          </div>
        ) : ready ? (
          <form onSubmit={submit}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 8 }}>NEW PASSWORD</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocus('password')} onBlur={() => setFocus('')}
              placeholder="At least 12 characters" style={{ ...field('password'), marginBottom: 18 }} autoComplete="new-password" autoFocus />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 8 }}>CONFIRM PASSWORD</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onFocus={() => setFocus('confirm')} onBlur={() => setFocus('')}
              placeholder="Repeat your new password" style={field('confirm')} autoComplete="new-password" />

            {error && <p style={{ fontSize: 13, color: T.coral, margin: '12px 0 0', fontWeight: 600 }}>{error}</p>}
            <button type="submit" disabled={busy} style={{ width: '100%', marginTop: 24, padding: '15px', borderRadius: 13, border: 'none', background: busy ? T.muted : T.tealDeep, color: '#fff', fontSize: 15, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Updating password…' : 'Update password →'}
            </button>
          </form>
        ) : (
          <div>
            <div style={{ padding: '14px 15px', borderRadius: 13, background: T.tintCoral, color: T.coralInk, fontSize: 13.5, lineHeight: 1.55 }}>
              {linkError || INVALID_LINK_MESSAGE}
            </div>
            <button type="button" onClick={() => navigate('/login')} style={{ width: '100%', marginTop: 18, padding: '13px', borderRadius: 13, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Back to sign in
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
