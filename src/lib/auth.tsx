import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, IS_SUPABASE_CONFIGURED } from './supabase'
import type { AdminRole } from './types'

export interface AdminUser {
  email: string
  name: string
  role: AdminRole
}

interface AuthState {
  user: AdminUser | null
  loading: boolean
  isSuperAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => void
}

const CONFIG_ERROR = 'The admin service is not configured. Contact the system administrator.'
const AuthCtx = createContext<AuthState>({ user: null, loading: true, isSuperAdmin: false, signIn: async () => ({ ok: false }), signOut: () => {} })

async function fetchRole(email: string): Promise<AdminUser | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('admins')
    .select('role, display_name, active')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (error || !data || data.active === false) return null
  return { email, name: data.display_name || email.split('@')[0], role: data.role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED || !supabase) {
      setLoading(false)
      return
    }

    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      const email = data.session?.user.email
      const admin = email ? await fetchRole(email) : null
      if (!active) return
      if (email && !admin) await supabase.auth.signOut()
      setUser(admin)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const email = session?.user.email
      const admin = email ? await fetchRole(email) : null
      if (!active) return
      if (email && !admin) await supabase.auth.signOut()
      setUser(admin)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn: AuthState['signIn'] = async (email, password) => {
    if (!IS_SUPABASE_CONFIGURED || !supabase) return { ok: false, error: CONFIG_ERROR }

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { ok: false, error: error.message }

    const userEmail = data.user?.email
    const admin = userEmail ? await fetchRole(userEmail) : null
    if (!admin) {
      await supabase.auth.signOut()
      setUser(null)
      return { ok: false, error: 'This account does not have active admin access.' }
    }

    setUser(admin)
    return { ok: true }
  }

  const signOut = () => {
    if (supabase) void supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, isSuperAdmin: user?.role === 'super_admin', signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}
