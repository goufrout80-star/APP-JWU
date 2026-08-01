import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Session } from '@supabase/supabase-js'
import { supabase, IS_SUPABASE_CONFIGURED } from '../lib/supabase'
import { T } from '../lib/theme'

const EASE = [0.22, 1, 0.36, 1] as const
const INVALID_INVITE = 'This invitation is invalid, expired or revoked. Ask AuraX to resend it.'

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function passwordIssues(password: string) {
  const issues: string[] = []
  if (password.length < 12) issues.push('12+ characters')
  if (!/[A-Z]/.test(password)) issues.push('uppercase letter')
  if (!/[a-z]/.test(password)) issues.push('lowercase letter')
  if (!/\d/.test(password)) issues.push('number')
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('symbol')
  return issues
}

export default function AcceptInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteId = searchParams.get('invite') || ''
  const inviteTokenRef = useRef('')
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [accountEmail, setAccountEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [linkError, setLinkError] = useState('')
  const [focus, setFocus] = useState('')

  const issues = useMemo(() => passwordIssues(password), [password])

  useEffect(() => {
    const client = supabase
    if (!IS_SUPABASE_CONFIGURED || !client) {
      setLinkError('The secure authentication service is unavailable.')
      setChecking(false)
      return
    }
    if (!inviteId) {
      setLinkError(INVALID_INVITE)
      setChecking(false)
      return
    }

    let active = true

    function acceptSession(session: Session) {
      const email = session.user?.email
      const accessToken = session.access_token
      if (!active || !email || !accessToken) return

      // Keep the recovery token in memory until the account activation request
      // finishes. Supabase recovery callbacks can notify listeners before the
      // refreshed session has fully persisted to storage.
      inviteTokenRef.current = accessToken
      setAccountEmail(email)
      setReady(true)
      setLinkError('')
      setChecking(false)

      // Remove sensitive callback parameters only after the token has been
      // captured. The invite ID remains so refreshes can still show a clear state.
      window.setTimeout(() => {
        if (active) {
          window.history.replaceState({}, document.title, `/accept-invite?invite=${encodeURIComponent(inviteId)}`)
        }
      }, 0)
    }

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email && session.access_token) acceptSession(session)
    })

    void (async () => {
      try {
        const url = new URL(window.location.href)
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
        const authError = hash.get('error_description') || url.searchParams.get('error_description')
        if (authError) throw new Error(authError)

        const accessToken = hash.get('access_token')
        const refreshToken = hash.get('refresh_token')
        const authorizationCode = url.searchParams.get('code')
        let establishedSession: Session | null = null

        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) throw sessionError
          establishedSession = data.session
        } else if (authorizationCode) {
          const { data, error: exchangeError } = await client.auth.exchangeCodeForSession(authorizationCode)
          if (exchangeError) throw exchangeError
          establishedSession = data.session
        }

        if (establishedSession?.user?.email && establishedSession.access_token) {
          acceptSession(establishedSession)
          return
        }

        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { data, error: sessionError } = await client.auth.getSession()
          if (sessionError) throw sessionError
          if (data.session?.user?.email && data.session.access_token) {
            acceptSession(data.session)
            return
          }
          await wait(250)
        }

        throw new Error(INVALID_INVITE)
      } catch (sessionError) {
        if (!active) return
        const message = sessionError instanceof Error ? sessionError.message : INVALID_INVITE
        setLinkError(message.toLowerCase().includes('expired') || message.toLowerCase().includes('invalid') ? INVALID_INVITE : message)
        setChecking(false)
      }
    })()

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [inviteId])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const client = supabase
    setError('')

    if (!client || !ready || !inviteId) {
      setError(INVALID_INVITE)
      return
    }
    if (issues.length > 0) {
      setError(`Your password still needs: ${issues.join(', ')}.`)
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    try {
      let accessToken = inviteTokenRef.current
      const { data, error: sessionError } = await client.auth.getSession()
      if (sessionError) throw sessionError
      if (data.session?.access_token) {
        accessToken = data.session.access_token
        inviteTokenRef.current = accessToken
      }
      if (!accessToken) throw new Error(INVALID_INVITE)

      const response = await fetch('/api/accept-admin-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ inviteId, password }),
      })
      const payload = await response.json().catch(() => null) as { ok?: boolean; message?: string; next?: string } | null
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'Could not create the admin account.')

      inviteTokenRef.current = ''
      setSuccess(true)
      window.setTimeout(() => window.location.replace(payload.next || '/mfa/setup'), 1000)
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Could not create the admin account.')
    } finally {
      setBusy(false)
    }
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
        style={{ width: '100%', maxWidth: 460, background: T.surface, border: `1px solid ${T.hairline}`, borderRadius: 22, padding: '30px 28px', boxShadow: '0 20px 70px rgba(13,26,20,0.10)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 26 }}>
          <img src="/favicon.svg" alt="JUST WHY US" width={36} height={36} style={{ borderRadius: 10 }} />
          <span style={{ fontWeight: 800, fontSize: 15, color: T.ink }}>JUST WHY US <span style={{ color: T.tealDeep }}>· Team invite</span></span>
        </div>

        <h1 style={{ fontSize: 29, fontWeight: 900, letterSpacing: '-0.035em', margin: '0 0 8px', color: T.ink }}>Create your admin account</h1>
        <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.6, margin: '0 0 24px' }}>Choose your private password. Authenticator MFA will be required on the next screen before dashboard access.</p>

        {checking ? (
          <div style={{ padding: '22px 0', color: T.muted, fontSize: 14 }}>Checking your secure invitation…</div>
        ) : success ? (
          <div style={{ padding: '15px 16px', borderRadius: 13, background: T.tintTeal, color: T.tealInk, fontSize: 14, fontWeight: 700, lineHeight: 1.5 }}>
            Account created. Opening authenticator setup…
          </div>
        ) : ready ? (
          <form onSubmit={submit}>
            <div style={{ padding: '11px 13px', marginBottom: 20, borderRadius: 11, background: T.tintTeal, color: T.tealInk, fontSize: 12.5, fontWeight: 700 }}>
              Invitation account: {accountEmail}
            </div>

            <label htmlFor="invite-password" style={{ display: 'block', fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 8 }}>CREATE PASSWORD</label>
            <input id="invite-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setFocus('password')} onBlur={() => setFocus('')}
              placeholder="12+ characters" style={{ ...field('password'), marginBottom: 11 }} autoComplete="new-password" autoFocus />
            <p style={{ margin: '0 0 18px', color: issues.length ? T.muted : T.tealInk, fontSize: 11.5, lineHeight: 1.5 }}>
              {issues.length ? `Needed: ${issues.join(', ')}` : 'Strong password requirements met.'}
            </p>

            <label htmlFor="invite-confirm" style={{ display: 'block', fontSize: 12, fontWeight: 800, color: T.muted, marginBottom: 8 }}>CONFIRM PASSWORD</label>
            <input id="invite-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onFocus={() => setFocus('confirm')} onBlur={() => setFocus('')}
              placeholder="Repeat your password" style={field('confirm')} autoComplete="new-password" />

            {error && <p role="alert" style={{ fontSize: 13, color: T.coral, margin: '12px 0 0', fontWeight: 650, lineHeight: 1.5 }}>{error}</p>}
            <button type="submit" disabled={busy} style={{ width: '100%', marginTop: 24, padding: '15px', borderRadius: 13, border: 'none', background: busy ? T.muted : T.tealDeep, color: '#fff', fontSize: 15, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Creating secure account…' : 'Create account and continue →'}
            </button>
          </form>
        ) : (
          <div>
            <div style={{ padding: '14px 15px', borderRadius: 13, background: T.tintCoral, color: T.coralInk, fontSize: 13.5, lineHeight: 1.55 }}>
              {linkError || INVALID_INVITE}
            </div>
            <button type="button" onClick={() => navigate('/login')} style={{ width: '100%', marginTop: 18, padding: '13px', borderRadius: 13, border: `1px solid ${T.hairline}`, background: T.surface, color: T.ink, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Go to sign in
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
