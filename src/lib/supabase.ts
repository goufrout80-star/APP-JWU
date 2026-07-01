/* ════════════════════════════════════════════════════════════════
   Supabase client — admin app. Authenticated usage: sign-in, then
   read + update contacts/applications (gated by RLS `authenticated`
   policies). Safe-init: falls back to mock data/auth if unset.
   ════════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const IS_SUPABASE_CONFIGURED = !!url && !!anonKey

export const supabase = IS_SUPABASE_CONFIGURED ? createClient(url as string, anonKey as string) : null
