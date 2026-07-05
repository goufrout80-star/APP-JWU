/* ════════════════════════════════════════════════════════════════
   Auth — Supabase session when configured; falls back to a mock
   sessionStorage session otherwise so the dashboard is still
   click-through-able with no backend.

   Role is read from the `admins` table (source of truth is RLS on
   the server — this client-side role only drives what UI renders,
   never what data can actually be read/written).
   ════════════════════════════════════════════════════════════════ */
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

const MOCK_KEY = 'jwu_admin_session'
const AuthCtx = createContext<AuthState>({ user: null, loading: true, isSuperAdmin: false, signIn: async () => ({ ok: false }), signOut: () => {} })

function mockAdminUser(email: string): AdminUser {
  return { email, name: email.split('@')[0], role: 'super_admin' }
}

function readMockSession(): AdminUser | null {
  try {
    const raw = sessionStorage.getItem(MOCK_KEY)
    return raw ? (JSON.parse(raw) as AdminUser) : null
  } catch { return null }
}

async function fetchRole(email: string): Promise<AdminUser> {
  if (!supabase) return mockAdminUser(email)
  const { data } = await supabase.from('admins').select('role, display_name, active').eq('email', email.toLowerCase()).maybeSingle()
  if (!data || data.active === false) {
    // Not (or no longer) an admin — RLS will block all real data reads
    // regardless; role here just decides what nav items render.
    return { email, name: email.split('@')[0], role: 'admin' }
  }
  return { email, name: data.display_name || email.split('@')[0], role: data.role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(IS_SUPABASE_CONFIGURED ? null : readMockSession)
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED || !supabase) return

    supabase.auth.getSession().then(async ({ data }) => {
      const email = data.session?.user.email
      setUser(email ? await fetchRole(email) : null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const email = session?.user.email
      setUser(email ? await fetchRole(email) : null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn: AuthState['signIn'] = async (email, password) => {
    if (IS_SUPABASE_CONFIGURED && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return { ok: false, error: error.message }
      const userEmail = data.user?.email
      setUser(userEmail ? await fetchRole(userEmail) : null)
      return { ok: true }
    }

    // MOCK fallback: accept any well-formed email + non-trivial password.
    await new Promise((r) => setTimeout(r, 400))
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    if (!validEmail) return { ok: false, error: 'Enter a valid email address.' }
    if (password.trim().length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    const u = mockAdminUser(email.trim())
    sessionStorage.setItem(MOCK_KEY, JSON.stringify(u))
    setUser(u)
    return { ok: true }
  }

  const signOut = () => {
    if (IS_SUPABASE_CONFIGURED && supabase) supabase.auth.signOut()
    else sessionStorage.removeItem(MOCK_KEY)
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
