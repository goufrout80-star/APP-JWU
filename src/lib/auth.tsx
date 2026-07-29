import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, IS_SUPABASE_CONFIGURED } from './supabase'
import type { AdminRole } from './types'

export type AssuranceLevel = 'aal1' | 'aal2' | null
export interface AdminUser { email: string; name: string; role: AdminRole }

interface AuthState {
  user: AdminUser | null
  loading: boolean
  securityLoading: boolean
  isSuperAdmin: boolean
  aal: AssuranceLevel
  mfaEnrolled: boolean
  mfaFactorId: string | null
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => void
  refreshSecurity: () => Promise<void>
}

const CONFIG_ERROR = 'The admin service is not configured. Contact the system administrator.'
const AuthCtx = createContext<AuthState>({
  user: null,
  loading: true,
  securityLoading: true,
  isSuperAdmin: false,
  aal: null,
  mfaEnrolled: false,
  mfaFactorId: null,
  signIn: async () => ({ ok: false }),
  signOut: () => {},
  refreshSecurity: async () => {},
})

async function fetchRole(userId: string): Promise<AdminUser | null> {
  const client = supabase
  if (!client) return null
  const { data, error } = await client.from('admins').select('email, role, display_name, active').eq('user_id', userId).maybeSingle()
  if (error || !data || data.active === false) return null
  return { email: data.email, name: data.display_name || data.email.split('@')[0], role: data.role }
}

async function fetchSecurityState() {
  const client = supabase
  if (!client) return { aal: null as AssuranceLevel, enrolled: false, factorId: null as string | null }

  const [{ data: factors, error: factorsError }, { data: assurance, error: assuranceError }] = await Promise.all([
    client.auth.mfa.listFactors(),
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  if (factorsError) throw factorsError
  if (assuranceError) throw assuranceError

  const verified = [...(factors?.totp ?? []), ...(factors?.phone ?? [])].find((factor) => factor.status === 'verified')
  return {
    aal: (assurance?.currentLevel ?? null) as AssuranceLevel,
    enrolled: Boolean(verified),
    factorId: verified?.id ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)
  const [securityLoading, setSecurityLoading] = useState(IS_SUPABASE_CONFIGURED)
  const [aal, setAal] = useState<AssuranceLevel>(null)
  const [mfaEnrolled, setMfaEnrolled] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)

  async function applySession(sessionUserId?: string) {
    const client = supabase
    if (!client || !sessionUserId) {
      setUser(null)
      setAal(null)
      setMfaEnrolled(false)
      setMfaFactorId(null)
      setLoading(false)
      setSecurityLoading(false)
      return
    }

    setSecurityLoading(true)
    const admin = await fetchRole(sessionUserId)
    if (!admin) {
      await client.auth.signOut()
      setUser(null)
      setAal(null)
      setMfaEnrolled(false)
      setMfaFactorId(null)
      setLoading(false)
      setSecurityLoading(false)
      return
    }

    setUser(admin)
    try {
      const security = await fetchSecurityState()
      setAal(security.aal)
      setMfaEnrolled(security.enrolled)
      setMfaFactorId(security.factorId)
    } finally {
      setLoading(false)
      setSecurityLoading(false)
    }
  }

  useEffect(() => {
    const client = supabase
    if (!IS_SUPABASE_CONFIGURED || !client) {
      setLoading(false)
      setSecurityLoading(false)
      return
    }

    let active = true
    client.auth.getSession().then(({ data }) => {
      if (active) void applySession(data.session?.user.id)
    })

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (active) window.setTimeout(() => void applySession(session?.user.id), 0)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn: AuthState['signIn'] = async (email, password) => {
    const client = supabase
    if (!IS_SUPABASE_CONFIGURED || !client) return { ok: false, error: CONFIG_ERROR }
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { ok: false, error: error.message }
    const userId = data.user?.id
    const admin = userId ? await fetchRole(userId) : null
    if (!admin) {
      await client.auth.signOut()
      setUser(null)
      return { ok: false, error: 'This account does not have active admin access.' }
    }
    await applySession(userId)
    return { ok: true }
  }

  const signOut = () => {
    const client = supabase
    if (client) void client.auth.signOut()
    setUser(null)
    setAal(null)
    setMfaEnrolled(false)
    setMfaFactorId(null)
  }

  const refreshSecurity = async () => {
    const client = supabase
    if (!client) return
    const { data } = await client.auth.getSession()
    await applySession(data.session?.user.id)
  }

  return (
    <AuthCtx.Provider value={{
      user,
      loading,
      securityLoading,
      isSuperAdmin: user?.role === 'super_admin',
      aal,
      mfaEnrolled,
      mfaFactorId,
      signIn,
      signOut,
      refreshSecurity,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() { return useContext(AuthCtx) }
