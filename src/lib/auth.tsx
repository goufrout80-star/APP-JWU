/* ════════════════════════════════════════════════════════════════
   Auth — Supabase session when configured; falls back to a mock
   sessionStorage session otherwise so the dashboard is still
   click-through-able with no backend.
   ════════════════════════════════════════════════════════════════ */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, IS_SUPABASE_CONFIGURED } from './supabase'

export interface AdminUser {
  email: string
  name: string
  role: 'admin' | 'super_admin'
}

interface AuthState {
  user: AdminUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => void
}

const MOCK_KEY = 'jwu_admin_session'
const AuthCtx = createContext<AuthState>({ user: null, loading: true, signIn: async () => ({ ok: false }), signOut: () => {} })

function toAdminUser(email: string): AdminUser {
  return { email, name: email.split('@')[0], role: 'super_admin' }
}

function readMockSession(): AdminUser | null {
  try {
    const raw = sessionStorage.getItem(MOCK_KEY)
    return raw ? (JSON.parse(raw) as AdminUser) : null
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(IS_SUPABASE_CONFIGURED ? null : readMockSession)
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED || !supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user.email ? toAdminUser(data.session.user.email) : null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user.email ? toAdminUser(session.user.email) : null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn: AuthState['signIn'] = async (email, password) => {
    if (IS_SUPABASE_CONFIGURED && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return { ok: false, error: error.message }
      setUser(data.user?.email ? toAdminUser(data.user.email) : null)
      return { ok: true }
    }

    // MOCK fallback: accept any well-formed email + non-trivial password.
    await new Promise((r) => setTimeout(r, 400))
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    if (!validEmail) return { ok: false, error: 'Enter a valid email address.' }
    if (password.trim().length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    const u = toAdminUser(email.trim())
    sessionStorage.setItem(MOCK_KEY, JSON.stringify(u))
    setUser(u)
    return { ok: true }
  }

  const signOut = () => {
    if (IS_SUPABASE_CONFIGURED && supabase) supabase.auth.signOut()
    else sessionStorage.removeItem(MOCK_KEY)
    setUser(null)
  }

  return <AuthCtx.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
