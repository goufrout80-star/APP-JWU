import {
  createServiceClient,
  notifyAdminEvent,
  normalizeEmail,
  parseBody,
  safeText,
  setSecurityHeaders,
  verifyOrigin,
  writeActivity,
} from '../server/admin-service.js'

function errorResponse(response, status, message) {
  return response.status(status).json({ ok: false, message })
}

function validPassword(password) {
  return typeof password === 'string'
    && password.length >= 12
    && password.length <= 200
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
}

function validInviteId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export default async function handler(request, response) {
  setSecurityHeaders(response)

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return errorResponse(response, 405, 'Method not allowed.')
  }
  if (!verifyOrigin(request)) return errorResponse(response, 403, 'Request origin is not allowed.')

  try {
    const supabase = createServiceClient()
    const body = parseBody(request)
    const inviteId = safeText(body.inviteId || body.invite_id, 80)
    const password = typeof body.password === 'string' ? body.password : ''

    if (!validInviteId(inviteId)) return errorResponse(response, 422, 'This invitation link is not valid.')
    if (!validPassword(password)) {
      return errorResponse(response, 422, 'Use at least 12 characters with uppercase, lowercase, a number and a symbol.')
    }

    const { data: invite, error: inviteError } = await supabase
      .from('admin_invites')
      .select('*')
      .eq('id', inviteId)
      .maybeSingle()
    if (inviteError) throw inviteError
    if (!invite) return errorResponse(response, 404, 'This invitation is not valid.')
    if (invite.status === 'accepted') return errorResponse(response, 409, 'This invitation has already been accepted.')
    if (invite.status === 'revoked') return errorResponse(response, 410, 'This invitation was revoked. Ask AuraX for a new invitation.')
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      await supabase.from('admin_invites').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', invite.id)
      return errorResponse(response, 410, 'This invitation has expired. Ask AuraX to resend it.')
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(invite.auth_user_id)
    const authUser = userData?.user
    if (userError || !authUser?.id || !authUser.email) {
      return errorResponse(response, 410, 'The invited account is no longer available. Ask AuraX for a new invitation.')
    }

    const userEmail = normalizeEmail(authUser.email)
    if (invite.auth_user_id !== authUser.id || normalizeEmail(invite.email) !== userEmail) {
      return errorResponse(response, 403, 'This invitation does not match the invited account.')
    }

    const displayName = invite.display_name || userEmail.split('@')[0]
    const { error: passwordError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(authUser.user_metadata || {}),
        display_name: displayName,
        onboarding: 'admin_invite_accepted',
      },
    })
    if (passwordError) throw passwordError

    const acceptedAt = new Date().toISOString()

    const { error: adminError } = await supabase.from('admins').upsert({
      email: userEmail,
      user_id: authUser.id,
      role: invite.role,
      active: true,
      display_name: displayName,
      updated_at: acceptedAt,
    }, { onConflict: 'email' })
    if (adminError) throw adminError

    const requestedAccess = invite.requested_page_access && typeof invite.requested_page_access === 'object'
      ? invite.requested_page_access
      : {}

    for (const [pageId, accessLevel] of Object.entries(requestedAccess)) {
      if (!['viewer', 'manager'].includes(String(accessLevel))) continue
      const { error: accessError } = await supabase.from('admin_page_access').upsert({
        page_id: pageId,
        admin_user_id: authUser.id,
        access_level: accessLevel,
        granted_by: invite.invited_by,
        updated_at: acceptedAt,
      }, { onConflict: 'page_id,admin_user_id' })
      if (accessError) throw accessError
    }

    const { error: updateInviteError } = await supabase
      .from('admin_invites')
      .update({
        status: 'accepted',
        accepted_at: acceptedAt,
        last_error: null,
        updated_at: acceptedAt,
      })
      .eq('id', invite.id)
      .in('status', ['pending', 'failed'])
    if (updateInviteError) throw updateInviteError

    const actor = {
      userId: authUser.id,
      email: userEmail,
      name: displayName,
      role: invite.role,
    }
    const target = {
      userId: authUser.id,
      email: userEmail,
      name: displayName,
      role: invite.role,
      active: true,
    }

    await writeActivity(supabase, userEmail, 'admin_invite_accepted', 'admin_invite', invite.id, {
      email: userEmail,
      role: invite.role,
      invited_by_email: invite.invited_by_email,
    })

    await notifyAdminEvent({
      supabase,
      actor,
      target,
      type: 'admin_invite_accepted',
      title: 'Admin invitation accepted',
      summary: `${displayName} created their admin account. Authenticator MFA is required before dashboard access.`,
      includeTarget: true,
      emailTarget: false,
    })

    return response.status(200).json({
      ok: true,
      email: userEmail,
      message: 'Your admin account is ready. Complete authenticator setup next.',
      next: '/mfa/setup',
    })
  } catch (error) {
    console.error('Admin invitation acceptance failed:', error instanceof Error ? error.message : error)
    return errorResponse(response, 500, 'Could not complete this invitation. Ask AuraX to resend it.')
  }
}
