import { createClient } from '@supabase/supabase-js'

const APP_ORIGIN = process.env.APP_ORIGIN || 'https://app.justwhyus.com'
const MAIL_API_URL = process.env.JWU_MAIL_API_URL || 'https://mail-api.justwhyus.com/v1/email/'
const RESET_REDIRECT_URL = process.env.PASSWORD_RESET_REDIRECT_URL || 'https://app.justwhyus.com/reset-password'
const GENERIC_MESSAGE = 'If this email belongs to an active admin account, a secure reset link will be sent.'

function setSecurityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254
}

function safeDisplayName(admin, user, email) {
  const candidates = [
    admin?.display_name,
    user?.user_metadata?.display_name,
    user?.user_metadata?.name,
    email.split('@')[0],
  ]

  const name = candidates.find((value) => typeof value === 'string' && value.trim())
  return String(name || 'there').trim().slice(0, 160)
}

function requestBody(request) {
  if (request.body && typeof request.body === 'object') return request.body
  if (typeof request.body !== 'string') return {}

  try {
    return JSON.parse(request.body)
  } catch {
    return {}
  }
}

export default async function handler(request, response) {
  setSecurityHeaders(response)

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ ok: false, message: 'Method not allowed.' })
  }

  const origin = String(request.headers.origin || '')
  if (origin && origin !== APP_ORIGIN) {
    return response.status(403).json({ ok: false, message: 'Request origin is not allowed.' })
  }

  const email = normalizeEmail(requestBody(request).email)
  if (!validEmail(email)) {
    return response.status(422).json({ ok: false, message: 'Enter a valid email address.' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const mailApiKey = process.env.JWU_MAIL_API_KEY

  if (!supabaseUrl || !supabaseSecret || !mailApiKey) {
    console.error('Password reset service is missing one or more server environment variables.')
    return response.status(503).json({ ok: false, message: 'The password reset service is temporarily unavailable.' })
  }

  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('user_id, email, display_name, active')
      .eq('email', email)
      .eq('active', true)
      .maybeSingle()

    if (adminError) throw adminError

    // Always return the same response when the email is not an active admin.
    if (!admin?.user_id) {
      return response.status(202).json({ ok: true, message: GENERIC_MESSAGE })
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: RESET_REDIRECT_URL,
      },
    })

    if (linkError) throw linkError

    const actionLink = linkData?.properties?.action_link || linkData?.properties?.actionLink
    if (!actionLink || !String(actionLink).startsWith('https://')) {
      throw new Error('Supabase did not return a valid recovery link.')
    }

    const user = linkData?.user
    const displayName = safeDisplayName(admin, user, email)
    const minuteBucket = Math.floor(Date.now() / 60000)

    const mailResponse = await fetch(MAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-JWU-API-Key': mailApiKey,
        'Idempotency-Key': `password-reset:${admin.user_id}:${minuteBucket}`,
      },
      body: JSON.stringify({
        template: 'password_reset',
        to: {
          email,
          name: displayName,
        },
        data: {
          user_name: displayName,
          reset_url: actionLink,
          expires_minutes: 15,
        },
      }),
    })

    if (!mailResponse.ok) {
      const detail = await mailResponse.text()
      throw new Error(`JWU Mail API returned HTTP ${mailResponse.status}: ${detail.slice(0, 500)}`)
    }

    return response.status(202).json({ ok: true, message: GENERIC_MESSAGE })
  } catch (error) {
    console.error('Password reset request failed:', error instanceof Error ? error.message : error)

    // Do not expose whether the email exists or which internal service failed.
    return response.status(202).json({ ok: true, message: GENERIC_MESSAGE })
  }
}
