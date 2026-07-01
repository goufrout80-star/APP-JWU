/* ════════════════════════════════════════════════════════════════
   Supabase client — admin app. Authenticated usage: sign-in, then
   read + update contacts/applications (gated by RLS `is_admin()`
   policies). Safe-init: falls back to mock data/auth if unset.

   Security notes:
   - Only the ANON key ships here (public by design). The real data
     boundary is Row Level Security on the server (see supabase/migrations).
   - PKCE auth flow (no implicit tokens in the URL).
   - SQL injection is not possible via the query builder — all values are
     sent as parameters, never string-concatenated into SQL.
   ════════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const IS_SUPABASE_CONFIGURED = !!url && !!anonKey

export const supabase = IS_SUPABASE_CONFIGURED
  ? createClient(url as string, anonKey as string, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'jwu-admin-auth',
      },
    })
  : null
