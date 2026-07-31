import { createClient } from '@supabase/supabase-js'

const APP_ORIGIN = process.env.APP_ORIGIN || 'https://app.justwhyus.com'

function setSecurityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}

function bearerToken(request) {
  const value = String(request.headers.authorization || '').trim()
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
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

  const accessToken = bearerToken(request)
  if (!accessToken) {
    return response.status(401).json({ ok: false, message: 'A valid admin session is required.' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseSecret) {
    console.error('MFA preparation service is missing server environment variables.')
    return response.status(503).json({ ok: false, message: 'The security setup service is temporarily unavailable.' })
  }

  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
    const authUser = userData?.user

    if (userError || !authUser) {
      return response.status(401).json({ ok: false, message: 'Your secure session has expired. Sign in again.' })
    }

    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('user_id, active')
      .eq('user_id', authUser.id)
      .eq('active', true)
      .maybeSingle()

    if (adminError) throw adminError
    if (!admin?.user_id) {
      return response.status(403).json({ ok: false, message: 'This account does not have active admin access.' })
    }

    const { data: factorData, error: factorsError } = await supabase.auth.admin.mfa.listFactors({
      userId: authUser.id,
    })
    if (factorsError) throw factorsError

    const factors = factorData?.factors ?? []
    const verifiedFactor = factors.find(
      (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
    )

    if (verifiedFactor) {
      return response.status(200).json({
        ok: true,
        has_verified_factor: true,
        cleaned: 0,
      })
    }

    const staleFactors = factors.filter(
      (factor) => factor.factor_type === 'totp' && factor.status === 'unverified',
    )

    for (const factor of staleFactors) {
      const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({
        userId: authUser.id,
        id: factor.id,
      })
      if (deleteError) throw deleteError
    }

    return response.status(200).json({
      ok: true,
      has_verified_factor: false,
      cleaned: staleFactors.length,
    })
  } catch (error) {
    console.error('MFA preparation failed:', error instanceof Error ? error.message : error)
    return response.status(500).json({ ok: false, message: 'Could not prepare a fresh authenticator setup. Try again.' })
  }
}
