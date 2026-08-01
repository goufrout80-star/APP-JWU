import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const APP_ORIGIN = process.env.APP_ORIGIN || 'https://app.justwhyus.com'
export const MAIL_API_URL = process.env.JWU_MAIL_API_URL || 'https://mail-api.justwhyus.com/v1/email/'
export const INVITE_LIFETIME_HOURS = 48

export function setSecurityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}

export function verifyOrigin(request) {
  const origin = String(request.headers.origin || '')
  return !origin || origin === APP_ORIGIN
}

export function parseBody(request) {
  if (request.body && typeof request.body === 'object') return request.body
  if (typeof request.body !== 'string') return {}
  try {
    return JSON.parse(request.body)
  } catch {
    return {}
  }
}

export function bearerToken(request) {
  const value = String(request.headers.authorization || '').trim()
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return {}
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return {}
  }
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254
}

export function safeText(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function roleLabel(role) {
  return role === 'super_admin' ? 'Super Admin' : 'Admin'
}

export function formatTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC')
}

export function createServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseSecret) {
    throw new Error('The server is missing Supabase environment variables.')
  }

  return createClient(supabaseUrl, supabaseSecret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

export async function requireVerifiedSuperAdmin(request) {
  const accessToken = bearerToken(request)
  if (!accessToken) {
    return { error: { status: 401, message: 'A valid admin session is required.' } }
  }

  const supabase = createServiceClient()
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
  const authUser = userData?.user

  if (userError || !authUser) {
    return { error: { status: 401, message: 'Your secure session has expired. Sign in again.' } }
  }

  const jwt = decodeJwtPayload(accessToken)
  if (jwt.aal !== 'aal2') {
    return { error: { status: 403, message: 'Verified MFA is required for team changes.' } }
  }

  const { data: admin, error: adminError } = await supabase
    .from('admins')
    .select('user_id,email,display_name,role,active')
    .eq('user_id', authUser.id)
    .eq('active', true)
    .eq('role', 'super_admin')
    .maybeSingle()

  if (adminError) throw adminError
  if (!admin?.user_id) {
    return { error: { status: 403, message: 'Active Super Admin access is required.' } }
  }

  return {
    supabase,
    accessToken,
    authUser,
    actor: {
      userId: admin.user_id,
      email: admin.email,
      name: admin.display_name || admin.email.split('@')[0],
      role: admin.role,
    },
  }
}

export async function requireAuthenticatedInviteUser(request) {
  const accessToken = bearerToken(request)
  if (!accessToken) {
    return { error: { status: 401, message: 'Open the secure invitation link again.' } }
  }

  const supabase = createServiceClient()
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
  const authUser = userData?.user

  if (userError || !authUser?.email) {
    return { error: { status: 401, message: 'Your invitation session has expired. Ask for a new invitation.' } }
  }

  return { supabase, accessToken, authUser }
}

export async function findAuthUserByEmail(supabase, email) {
  let page = 1
  const perPage = 200

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users ?? []
    const match = users.find((user) => normalizeEmail(user.email) === email)
    if (match) return match
    if (users.length < perPage) return null
    page += 1
  }

  throw new Error('Could not safely search the authentication directory.')
}

export async function createOrFindAuthUser(supabase, email, displayName, invitedByEmail) {
  const existing = await findAuthUserByEmail(supabase, email)
  if (existing) return { user: existing, created: false }

  const temporaryPassword = `JWU!${crypto.randomBytes(36).toString('base64url')}9aA`
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      invited_by: invitedByEmail,
      onboarding: 'admin_invite',
    },
  })

  if (error) throw error
  if (!data?.user) throw new Error('Supabase did not create the invited account.')
  return { user: data.user, created: true }
}

export async function generateInviteSetupLink(supabase, email, inviteId) {
  const redirectTo = `${APP_ORIGIN}/accept-invite?invite=${encodeURIComponent(inviteId)}`
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (error) throw error
  const actionLink = data?.properties?.action_link || data?.properties?.actionLink
  if (!actionLink || !String(actionLink).startsWith('https://')) {
    throw new Error('Supabase did not return a valid invitation setup link.')
  }
  return String(actionLink)
}

export async function sendTemplateEmail({ template, email, name, data, idempotencyKey }) {
  const mailApiKey = process.env.JWU_MAIL_API_KEY
  if (!mailApiKey) throw new Error('The JWU Mail API key is not configured.')

  const mailResponse = await fetch(MAIL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-JWU-API-Key': mailApiKey,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      template,
      to: { email, name },
      data,
    }),
  })

  const responseBody = await mailResponse.text()
  if (!mailResponse.ok) {
    throw new Error(`JWU Mail API returned HTTP ${mailResponse.status}: ${responseBody.slice(0, 400)}`)
  }

  return responseBody
}

export async function writeActivity(supabase, actorEmail, action, targetType, targetId, detail = {}) {
  const { error } = await supabase.from('activity_log').insert({
    actor_email: actorEmail,
    action,
    target_type: targetType,
    target_id: targetId || null,
    detail,
  })
  if (error) throw error
}

export async function createNotifications(supabase, recipientUserIds, type, title, message, detail = {}) {
  const uniqueIds = [...new Set(recipientUserIds.filter(Boolean))]
  if (uniqueIds.length === 0) return
  const rows = uniqueIds.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    type,
    title,
    message,
    detail,
  }))
  const { error } = await supabase.from('admin_notifications').insert(rows)
  if (error) throw error
}

export async function activeSuperAdmins(supabase) {
  const { data, error } = await supabase
    .from('admins')
    .select('user_id,email,display_name')
    .eq('active', true)
    .eq('role', 'super_admin')
  if (error) throw error
  return data ?? []
}

export async function notifyAdminEvent({
  supabase,
  actor,
  target,
  type,
  title,
  summary,
  includeTarget = true,
  emailTarget = true,
}) {
  const superAdmins = await activeSuperAdmins(supabase)
  const notificationIds = superAdmins.map((admin) => admin.user_id)
  if (includeTarget && target?.userId) notificationIds.push(target.userId)

  await createNotifications(supabase, notificationIds, type, title, summary, {
    target_email: target?.email || null,
    target_name: target?.name || null,
    actor_email: actor?.email || null,
    actor_name: actor?.name || null,
  })

  const emailRecipients = new Map()
  for (const admin of superAdmins) {
    if (admin.user_id !== actor?.userId) {
      emailRecipients.set(admin.email, {
        email: admin.email,
        name: admin.display_name || admin.email.split('@')[0],
      })
    }
  }
  if (emailTarget && target?.email && target.userId !== actor?.userId) {
    emailRecipients.set(target.email, { email: target.email, name: target.name || target.email.split('@')[0] })
  }

  const occurredAt = formatTimestamp()
  await Promise.allSettled([...emailRecipients.values()].map((recipient) => sendTemplateEmail({
    template: 'admin_event_notification',
    email: recipient.email,
    name: recipient.name,
    idempotencyKey: `admin-event:${type}:${target?.userId || target?.email || 'unknown'}:${Date.now()}:${recipient.email}`,
    data: {
      event_title: title,
      event_summary: summary,
      target_name: target?.name || target?.email || 'Admin account',
      target_email: target?.email || 'Not available',
      actor_name: actor?.name || actor?.email || 'JUST WHY US',
      occurred_at: occurredAt,
      dashboard_url: `${APP_ORIGIN}/admins`,
    },
  })))
}

export function publicInviteRow(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    sentCount: row.sent_count,
    lastError: row.last_error,
    invitedByEmail: row.invited_by_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
