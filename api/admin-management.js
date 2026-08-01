import {
  APP_ORIGIN,
  INVITE_LIFETIME_HOURS,
  createNotifications,
  createOrFindAuthUser,
  findAuthUserByEmail,
  generateInviteSetupLink,
  normalizeEmail,
  notifyAdminEvent,
  parseBody,
  publicInviteRow,
  requireVerifiedSuperAdmin,
  roleLabel,
  safeText,
  sendTemplateEmail,
  setSecurityHeaders,
  validEmail,
  verifyOrigin,
  writeActivity,
} from '../server/admin-service.js'

const VALID_ROLES = new Set(['admin', 'super_admin'])
const VALID_ACCESS = new Set(['none', 'viewer', 'manager'])

function errorResponse(response, status, message) {
  return response.status(status).json({ ok: false, message })
}

async function validatedRequestedAccess(supabase, role, value) {
  if (role === 'super_admin' || !value || typeof value !== 'object' || Array.isArray(value)) return {}

  const requested = {}
  for (const [pageId, level] of Object.entries(value)) {
    const cleanPageId = safeText(pageId, 80)
    const cleanLevel = safeText(level, 20)
    if (cleanPageId && ['viewer', 'manager'].includes(cleanLevel)) requested[cleanPageId] = cleanLevel
  }

  const pageIds = Object.keys(requested)
  if (pageIds.length === 0) return {}
  if (pageIds.length > 25) throw Object.assign(new Error('Too many managed-page permissions were selected.'), { status: 422 })

  const { data: pages, error } = await supabase
    .from('managed_pages')
    .select('id')
    .in('id', pageIds)
    .eq('active', true)
  if (error) throw error
  if ((pages ?? []).length !== pageIds.length) {
    throw Object.assign(new Error('One or more managed-page permissions are no longer available.'), { status: 422 })
  }
  return requested
}

function accessSummary(role, requestedAccess) {
  if (role === 'super_admin') return 'Full access to all JWU admin tools and managed pages.'
  const count = Object.keys(requestedAccess).length
  if (count === 0) return 'Core admin access. Managed-page permissions can be added later.'
  return `${count} managed page${count === 1 ? '' : 's'} included in the invitation.`
}

async function listInvites(supabase) {
  const now = new Date().toISOString()
  const { error: expiryError } = await supabase
    .from('admin_invites')
    .update({ status: 'expired', updated_at: now })
    .in('status', ['pending', 'failed'])
    .lt('expires_at', now)
  if (expiryError) throw expiryError

  const { data, error } = await supabase
    .from('admin_invites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data ?? []).map(publicInviteRow)
}

async function inviteAdmin({ supabase, actor, body }) {
  const email = normalizeEmail(body.email)
  const displayName = safeText(body.displayName || body.display_name || email.split('@')[0], 120)
  const role = safeText(body.role, 40)

  if (!validEmail(email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 422 })
  if (!displayName || displayName.length < 2) throw Object.assign(new Error('Enter the team member’s name.'), { status: 422 })
  if (!VALID_ROLES.has(role)) throw Object.assign(new Error('Choose a valid admin role.'), { status: 422 })
  if (email === normalizeEmail(actor.email)) throw Object.assign(new Error('You cannot invite your own account.'), { status: 409 })
  const requestedAccess = await validatedRequestedAccess(supabase, role, body.pageAccess || body.page_access)

  const { data: existingAdmin, error: existingAdminError } = await supabase
    .from('admins')
    .select('user_id,email,active,role')
    .eq('email', email)
    .maybeSingle()
  if (existingAdminError) throw existingAdminError
  if (existingAdmin?.active) throw Object.assign(new Error('This email already has active admin access.'), { status: 409 })

  const expiryCheckAt = new Date().toISOString()
  const { error: expiryError } = await supabase
    .from('admin_invites')
    .update({ status: 'expired', updated_at: expiryCheckAt })
    .eq('email', email)
    .in('status', ['pending', 'failed'])
    .lt('expires_at', expiryCheckAt)
  if (expiryError) throw expiryError

  const { data: unresolvedInvite, error: unresolvedError } = await supabase
    .from('admin_invites')
    .select('id,status')
    .eq('email', email)
    .in('status', ['pending', 'failed'])
    .maybeSingle()
  if (unresolvedError) throw unresolvedError
  if (unresolvedInvite) {
    throw Object.assign(new Error('A pending invitation already exists. Use Resend instead.'), { status: 409 })
  }

  const { user, created } = await createOrFindAuthUser(supabase, email, displayName, actor.email)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITE_LIFETIME_HOURS * 60 * 60 * 1000).toISOString()

  const { data: invite, error: inviteError } = await supabase
    .from('admin_invites')
    .insert({
      email,
      auth_user_id: user.id,
      display_name: displayName,
      role,
      requested_page_access: requestedAccess,
      status: 'pending',
      invited_by: actor.userId,
      invited_by_email: actor.email,
      expires_at: expiresAt,
      sent_count: 0,
      last_error: null,
    })
    .select('*')
    .single()
  if (inviteError) throw inviteError

  try {
    const inviteUrl = await generateInviteSetupLink(supabase, email, invite.id)
    await sendTemplateEmail({
      template: 'admin_invite',
      email,
      name: displayName,
      idempotencyKey: `admin-invite:${invite.id}:1`,
      data: {
        user_name: displayName,
        invited_by_name: actor.name,
        role_name: roleLabel(role),
        invite_email: email,
        invite_url: inviteUrl,
        expires_hours: INVITE_LIFETIME_HOURS,
        access_summary: accessSummary(role, requestedAccess),
      },
    })

    const sentAt = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('admin_invites')
      .update({ sent_at: sentAt, sent_count: 1, status: 'pending', last_error: null, failed_at: null, updated_at: sentAt })
      .eq('id', invite.id)
      .select('*')
      .single()
    if (updateError) throw updateError

    await writeActivity(supabase, actor.email, 'admin_invite_sent', 'admin_invite', invite.id, {
      email,
      display_name: displayName,
      role,
      auth_user_created: created,
      requested_page_access: requestedAccess,
    })
    await createNotifications(
      supabase,
      [actor.userId],
      'admin_invite_sent',
      'Admin invitation sent',
      `A secure ${roleLabel(role)} invitation was sent to ${displayName} at ${email}.`,
      { invite_id: invite.id, email, role },
    )

    return publicInviteRow(updated)
  } catch (error) {
    const failedAt = new Date().toISOString()
    await supabase
      .from('admin_invites')
      .update({
        status: 'failed',
        failed_at: failedAt,
        last_error: 'The invitation email could not be delivered.',
        updated_at: failedAt,
      })
      .eq('id', invite.id)
    throw error
  }
}

async function resendInvite({ supabase, actor, body }) {
  const inviteId = safeText(body.inviteId || body.invite_id, 80)
  if (!inviteId) throw Object.assign(new Error('Invitation ID is required.'), { status: 422 })

  const { data: invite, error } = await supabase.from('admin_invites').select('*').eq('id', inviteId).maybeSingle()
  if (error) throw error
  if (!invite) throw Object.assign(new Error('Invitation not found.'), { status: 404 })
  if (invite.status === 'accepted') throw Object.assign(new Error('This invitation has already been accepted.'), { status: 409 })
  if (invite.status === 'revoked') throw Object.assign(new Error('This invitation was revoked. Create a new invitation.'), { status: 409 })

  const authUser = await findAuthUserByEmail(supabase, normalizeEmail(invite.email))
  if (!authUser || authUser.id !== invite.auth_user_id) {
    throw Object.assign(new Error('The invited authentication account could not be found.'), { status: 409 })
  }

  const nextCount = Number(invite.sent_count || 0) + 1
  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_HOURS * 60 * 60 * 1000).toISOString()
  const inviteUrl = await generateInviteSetupLink(supabase, invite.email, invite.id)

  try {
    await sendTemplateEmail({
      template: 'admin_invite',
      email: invite.email,
      name: invite.display_name || invite.email.split('@')[0],
      idempotencyKey: `admin-invite:${invite.id}:${nextCount}`,
      data: {
        user_name: invite.display_name || invite.email.split('@')[0],
        invited_by_name: actor.name,
        role_name: roleLabel(invite.role),
        invite_email: invite.email,
        invite_url: inviteUrl,
        expires_hours: INVITE_LIFETIME_HOURS,
        access_summary: accessSummary(invite.role, invite.requested_page_access || {}),
      },
    })
  } catch (mailError) {
    const failedAt = new Date().toISOString()
    await supabase.from('admin_invites').update({
      status: 'failed',
      failed_at: failedAt,
      last_error: 'The invitation email could not be delivered.',
      updated_at: failedAt,
    }).eq('id', invite.id)
    throw mailError
  }

  const sentAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('admin_invites')
    .update({
      status: 'pending',
      expires_at: expiresAt,
      sent_at: sentAt,
      sent_count: nextCount,
      failed_at: null,
      last_error: null,
      updated_at: sentAt,
    })
    .eq('id', invite.id)
    .select('*')
    .single()
  if (updateError) throw updateError

  await writeActivity(supabase, actor.email, 'admin_invite_resent', 'admin_invite', invite.id, {
    email: invite.email,
    role: invite.role,
    sent_count: nextCount,
  })
  await createNotifications(
    supabase,
    [actor.userId],
    'admin_invite_resent',
    'Admin invitation resent',
    `A new secure invitation link was sent to ${invite.display_name || invite.email}.`,
    { invite_id: invite.id, email: invite.email, sent_count: nextCount },
  )

  return publicInviteRow(updated)
}

async function revokeInvite({ supabase, actor, body }) {
  const inviteId = safeText(body.inviteId || body.invite_id, 80)
  if (!inviteId) throw Object.assign(new Error('Invitation ID is required.'), { status: 422 })

  const { data: invite, error } = await supabase.from('admin_invites').select('*').eq('id', inviteId).maybeSingle()
  if (error) throw error
  if (!invite) throw Object.assign(new Error('Invitation not found.'), { status: 404 })
  if (invite.status === 'accepted') throw Object.assign(new Error('Accepted invitations cannot be revoked. Deactivate the admin instead.'), { status: 409 })
  if (invite.status === 'revoked') return publicInviteRow(invite)

  const revokedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('admin_invites')
    .update({ status: 'revoked', revoked_at: revokedAt, updated_at: revokedAt, last_error: null })
    .eq('id', invite.id)
    .select('*')
    .single()
  if (updateError) throw updateError

  await writeActivity(supabase, actor.email, 'admin_invite_revoked', 'admin_invite', invite.id, {
    email: invite.email,
    role: invite.role,
  })
  await createNotifications(
    supabase,
    [actor.userId],
    'admin_invite_revoked',
    'Admin invitation revoked',
    `The invitation for ${invite.display_name || invite.email} can no longer activate admin access.`,
    { invite_id: invite.id, email: invite.email },
  )

  return publicInviteRow(updated)
}

async function getTargetAdmin(supabase, email) {
  const normalized = normalizeEmail(email)
  const { data, error } = await supabase
    .from('admins')
    .select('user_id,email,display_name,role,active')
    .eq('email', normalized)
    .maybeSingle()
  if (error) throw error
  if (!data) throw Object.assign(new Error('Admin account not found.'), { status: 404 })
  return {
    userId: data.user_id,
    email: data.email,
    name: data.display_name || data.email.split('@')[0],
    role: data.role,
    active: data.active,
  }
}

async function protectLastSuperAdmin(supabase, target) {
  if (target.role !== 'super_admin' || !target.active) return
  const { count, error } = await supabase
    .from('admins')
    .select('user_id', { count: 'exact', head: true })
    .eq('active', true)
    .eq('role', 'super_admin')
  if (error) throw error
  if ((count ?? 0) <= 1) {
    throw Object.assign(new Error('The final active Super Admin cannot be removed or demoted.'), { status: 409 })
  }
}

async function setRole({ supabase, actor, body }) {
  const target = await getTargetAdmin(supabase, body.email)
  const nextRole = safeText(body.role, 40)
  if (!VALID_ROLES.has(nextRole)) throw Object.assign(new Error('Choose a valid admin role.'), { status: 422 })
  if (target.userId === actor.userId) throw Object.assign(new Error('You cannot change your own role.'), { status: 409 })
  if (target.role === nextRole) return { target, changed: false }
  if (target.role === 'super_admin' && nextRole !== 'super_admin') await protectLastSuperAdmin(supabase, target)

  const { error } = await supabase.from('admins').update({ role: nextRole, updated_at: new Date().toISOString() }).eq('email', target.email)
  if (error) throw error

  const previousRole = target.role
  target.role = nextRole
  const title = nextRole === 'super_admin' ? 'Admin promoted to Super Admin' : 'Super Admin changed to Admin'
  const summary = `${target.name}’s role changed from ${roleLabel(previousRole)} to ${roleLabel(nextRole)}.`
  await writeActivity(supabase, actor.email, 'admin_role_changed', 'admin', target.userId, {
    email: target.email,
    previous_role: previousRole,
    new_role: nextRole,
  })
  await notifyAdminEvent({ supabase, actor, target, type: 'admin_role_changed', title, summary })
  return { target, changed: true }
}

async function setActive({ supabase, actor, body }) {
  const target = await getTargetAdmin(supabase, body.email)
  const active = body.active === true
  if (target.userId === actor.userId) throw Object.assign(new Error('You cannot deactivate your own account.'), { status: 409 })
  if (target.active === active) return { target, changed: false }
  if (!active) await protectLastSuperAdmin(supabase, target)

  const { error } = await supabase.from('admins').update({ active, updated_at: new Date().toISOString() }).eq('email', target.email)
  if (error) throw error
  target.active = active

  const title = active ? 'Admin access reactivated' : 'Admin access deactivated'
  const summary = active
    ? `${target.name} can sign in again. MFA remains required.`
    : `${target.name} no longer has access to the JWU admin workspace.`
  await writeActivity(supabase, actor.email, active ? 'admin_reactivated' : 'admin_deactivated', 'admin', target.userId, { email: target.email })
  await notifyAdminEvent({ supabase, actor, target, type: active ? 'admin_reactivated' : 'admin_deactivated', title, summary })
  return { target, changed: true }
}

async function removeAdmin({ supabase, actor, body }) {
  const target = await getTargetAdmin(supabase, body.email)
  if (target.userId === actor.userId) throw Object.assign(new Error('You cannot remove your own account.'), { status: 409 })
  await protectLastSuperAdmin(supabase, target)

  await notifyAdminEvent({
    supabase,
    actor,
    target,
    type: 'admin_removed',
    title: 'Admin access removed',
    summary: `${target.name} was removed from the JWU admin team.`,
  })

  const { error: accessError } = await supabase.from('admin_page_access').delete().eq('admin_user_id', target.userId)
  if (accessError) throw accessError
  const { error: deleteError } = await supabase.from('admins').delete().eq('email', target.email)
  if (deleteError) throw deleteError
  await writeActivity(supabase, actor.email, 'admin_removed', 'admin', target.userId, { email: target.email, role: target.role })
  return { target, removed: true }
}

async function setPageAccess({ supabase, actor, body }) {
  const adminUserId = safeText(body.adminUserId || body.admin_user_id, 80)
  const pageId = safeText(body.pageId || body.page_id, 80)
  const accessLevel = safeText(body.accessLevel || body.access_level || 'none', 20)
  if (!adminUserId || !pageId || !VALID_ACCESS.has(accessLevel)) {
    throw Object.assign(new Error('Choose a valid admin, managed page and access level.'), { status: 422 })
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('admins')
    .select('user_id,email,display_name,role,active')
    .eq('user_id', adminUserId)
    .maybeSingle()
  if (adminError) throw adminError
  if (!adminRow?.active) throw Object.assign(new Error('Active admin account not found.'), { status: 404 })
  if (adminRow.role === 'super_admin') throw Object.assign(new Error('Super Admins already have full managed-page access.'), { status: 409 })

  const { data: page, error: pageError } = await supabase
    .from('managed_pages')
    .select('id,name,active')
    .eq('id', pageId)
    .eq('active', true)
    .maybeSingle()
  if (pageError) throw pageError
  if (!page) throw Object.assign(new Error('Managed page not found.'), { status: 404 })

  const target = {
    userId: adminRow.user_id,
    email: adminRow.email,
    name: adminRow.display_name || adminRow.email.split('@')[0],
    role: adminRow.role,
    active: adminRow.active,
  }

  if (accessLevel === 'none') {
    const { error } = await supabase.from('admin_page_access').delete().eq('admin_user_id', adminUserId).eq('page_id', pageId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('admin_page_access').upsert({
      page_id: pageId,
      admin_user_id: adminUserId,
      access_level: accessLevel,
      granted_by: actor.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'page_id,admin_user_id' })
    if (error) throw error
  }

  const granted = accessLevel !== 'none'
  const title = granted ? 'Managed-page access updated' : 'Managed-page access removed'
  const summary = granted
    ? `${target.name} now has ${accessLevel} access to ${page.name}.`
    : `${target.name} no longer has access to ${page.name}.`
  await writeActivity(supabase, actor.email, granted ? 'page_access_granted' : 'page_access_revoked', 'managed_page', pageId, {
    admin_email: target.email,
    page_name: page.name,
    access_level: accessLevel,
  })
  await notifyAdminEvent({ supabase, actor, target, type: granted ? 'page_access_granted' : 'page_access_revoked', title, summary })
  return { target, page: { id: page.id, name: page.name }, accessLevel }
}

export default async function handler(request, response) {
  setSecurityHeaders(response)

  if (!verifyOrigin(request)) return errorResponse(response, 403, 'Request origin is not allowed.')
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST')
    return errorResponse(response, 405, 'Method not allowed.')
  }

  try {
    const context = await requireVerifiedSuperAdmin(request)
    if (context.error) return errorResponse(response, context.error.status, context.error.message)
    const { supabase, actor } = context

    if (request.method === 'GET') {
      return response.status(200).json({ ok: true, invites: await listInvites(supabase) })
    }

    const body = parseBody(request)
    const action = safeText(body.action || 'invite', 60)
    let result

    if (action === 'invite') result = await inviteAdmin({ supabase, actor, body })
    else if (action === 'resend_invite') result = await resendInvite({ supabase, actor, body })
    else if (action === 'revoke_invite') result = await revokeInvite({ supabase, actor, body })
    else if (action === 'set_role') result = await setRole({ supabase, actor, body })
    else if (action === 'set_active') result = await setActive({ supabase, actor, body })
    else if (action === 'remove_admin') result = await removeAdmin({ supabase, actor, body })
    else if (action === 'set_page_access') result = await setPageAccess({ supabase, actor, body })
    else return errorResponse(response, 422, 'Unknown team-management action.')

    return response.status(200).json({ ok: true, result, dashboardUrl: `${APP_ORIGIN}/admins` })
  } catch (error) {
    const status = Number(error?.status) || 500
    const message = status >= 500 ? 'The team-management service could not complete this action.' : error.message
    console.error('Admin management failed:', error instanceof Error ? error.message : error)
    return errorResponse(response, status, message)
  }
}
