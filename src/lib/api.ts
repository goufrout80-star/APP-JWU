/* ════════════════════════════════════════════════════════════════
   Data layer — Supabase-backed. Reads protected JWU submissions,
   managed pages and page-specific contacts. Sensitive mutations use
   narrow RPCs or protected server endpoints with role and MFA checks.
   ════════════════════════════════════════════════════════════════ */
import type {
  Application, ContactSubmission, VisitorMeta,
  ContactStatus, ApplicationStatus,
  AdminRecord, AdminRole, AdminInvite, AdminNotification,
  ActivityLogEntry, SubmissionNote, AppSettings,
  ManagedPage, AdminPageAccess, PageAccessLevel, PageContact,
} from './types'
import { supabase, IS_SUPABASE_CONFIGURED } from './supabase'

export interface DataApi {
  listContacts(): Promise<ContactSubmission[]>
  listApplications(): Promise<Application[]>
  setContactStatus(id: string, status: ContactStatus): Promise<void>
  setApplicationStatus(id: string, status: ApplicationStatus): Promise<void>
  deleteSubmission(submissionType: 'contact' | 'application', id: string): Promise<void>
  listAdmins(): Promise<AdminRecord[]>
  listAdminInvites(): Promise<AdminInvite[]>
  inviteAdmin(email: string, displayName: string, role: AdminRole, pageAccess?: Record<string, PageAccessLevel>): Promise<AdminInvite>
  resendAdminInvite(inviteId: string): Promise<AdminInvite>
  revokeAdminInvite(inviteId: string): Promise<AdminInvite>
  setAdminActive(email: string, active: boolean): Promise<void>
  setAdminRole(email: string, role: AdminRole): Promise<void>
  removeAdmin(email: string): Promise<void>
  listManagedPages(): Promise<ManagedPage[]>
  listPageContacts(pageId: string): Promise<PageContact[]>
  setPageContactStatus(id: string, status: ContactStatus): Promise<void>
  deletePageContact(id: string): Promise<void>
  listAdminPageAccess(): Promise<AdminPageAccess[]>
  setAdminPageAccess(adminUserId: string, pageId: string, level: PageAccessLevel | 'none'): Promise<void>
  listNotifications(limit?: number): Promise<AdminNotification[]>
  markNotificationRead(id: string): Promise<void>
  markAllNotificationsRead(): Promise<void>
  listActivityLog(limit?: number): Promise<ActivityLogEntry[]>
  listNotes(submissionType: 'contact' | 'application', submissionId: string): Promise<SubmissionNote[]>
  addNote(submissionType: 'contact' | 'application', submissionId: string, body: string): Promise<void>
  deleteNote(id: string): Promise<void>
  getSettings(): Promise<AppSettings>
  setSetting(key: keyof AppSettings, value: string | number): Promise<void>
}

function metaFromRow(m: unknown): VisitorMeta {
  const r = (m ?? {}) as Partial<VisitorMeta>
  return {
    country: r.country ?? null,
    countryCode: r.countryCode ?? null,
    city: r.city ?? null,
    timezone: r.timezone ?? null,
    device: r.device ?? 'Desktop',
    os: r.os ?? 'Unknown',
    browser: r.browser ?? 'Unknown',
    referrer: r.referrer ?? 'Direct',
    landingPath: r.landingPath ?? '/',
    submitPath: r.submitPath ?? '/',
    timeOnSiteSec: r.timeOnSiteSec ?? 0,
    pageViews: r.pageViews ?? 1,
    sessionId: r.sessionId ?? '',
    userAgent: r.userAgent ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

class SupabaseApi implements DataApi {
  private client() {
    if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    return supabase
  }

  private async adminRequest<T>(body?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
    const client = this.client()
    const { data, error } = await client.auth.getSession()
    if (error) throw new Error(error.message)
    const accessToken = data.session?.access_token
    if (!accessToken) throw new Error('Your secure admin session has expired. Sign in again.')

    const response = await fetch('/api/admin-management', {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    })
    const payload = await response.json().catch(() => null) as { ok?: boolean; message?: string; result?: T; invites?: T } | null
    if (!response.ok || !payload?.ok) throw new Error(payload?.message || 'The team-management request failed.')
    return (method === 'GET' ? payload.invites : payload.result) as T
  }

  async listContacts(): Promise<ContactSubmission[]> {
    const { data, error } = await this.client().from('contacts').select('*').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({
      id: r.id, kind: 'contact', createdAt: r.created_at, audience: r.audience,
      name: r.name, email: r.email, subject: r.subject, message: r.message,
      status: r.status, meta: metaFromRow(r.meta),
    }))
  }

  async listApplications(): Promise<Application[]> {
    const { data, error } = await this.client().from('applications').select('*').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r): Application => {
      const preferredContactChannels = Array.isArray(r.preferred_contact_channels) ? r.preferred_contact_channels : []
      return r.app_type === 'creator'
        ? { id: r.id, kind: 'application', appType: 'creator', createdAt: r.created_at, name: r.name, email: r.email, handle: r.handle, platform: r.platform, niche: r.niche, audienceSize: r.audience_size, contentLink: r.content_link, preferredContactChannels, status: r.status, meta: metaFromRow(r.meta) }
        : { id: r.id, kind: 'application', appType: 'brand', createdAt: r.created_at, company: r.company, email: r.email, niche: r.niche, budgetRange: r.budget_range, campaignGoal: r.campaign_goal, website: r.website, preferredContactChannels, status: r.status, meta: metaFromRow(r.meta) }
    })
  }

  async setContactStatus(id: string, status: ContactStatus) {
    const { error } = await this.client().rpc('update_submission_status', { p_submission_type: 'contact', p_submission_id: id, p_status: status })
    if (error) throw new Error(error.message)
  }

  async setApplicationStatus(id: string, status: ApplicationStatus) {
    const { error } = await this.client().rpc('update_submission_status', { p_submission_type: 'application', p_submission_id: id, p_status: status })
    if (error) throw new Error(error.message)
  }

  async deleteSubmission(submissionType: 'contact' | 'application', id: string) {
    const { error } = await this.client().rpc('delete_submission', { p_submission_type: submissionType, p_submission_id: id })
    if (error) throw new Error(error.message)
  }

  async listAdmins(): Promise<AdminRecord[]> {
    const { data, error } = await this.client().from('admins').select('*').order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({ userId: r.user_id, email: r.email, role: r.role, active: r.active, displayName: r.display_name, createdAt: r.created_at, updatedAt: r.updated_at }))
  }

  async listAdminInvites(): Promise<AdminInvite[]> {
    return this.adminRequest<AdminInvite[]>(undefined, 'GET')
  }

  async inviteAdmin(email: string, displayName: string, role: AdminRole, pageAccess: Record<string, PageAccessLevel> = {}): Promise<AdminInvite> {
    return this.adminRequest<AdminInvite>({ action: 'invite', email: email.trim().toLowerCase(), displayName: displayName.trim(), role, pageAccess })
  }

  async resendAdminInvite(inviteId: string): Promise<AdminInvite> {
    return this.adminRequest<AdminInvite>({ action: 'resend_invite', inviteId })
  }

  async revokeAdminInvite(inviteId: string): Promise<AdminInvite> {
    return this.adminRequest<AdminInvite>({ action: 'revoke_invite', inviteId })
  }

  async setAdminActive(email: string, active: boolean) {
    await this.adminRequest({ action: 'set_active', email, active })
  }

  async setAdminRole(email: string, role: AdminRole) {
    await this.adminRequest({ action: 'set_role', email, role })
  }

  async removeAdmin(email: string) {
    await this.adminRequest({ action: 'remove_admin', email })
  }

  async listManagedPages(): Promise<ManagedPage[]> {
    const client = this.client()
    const { data: userData } = await client.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error('Not signed in.')

    const [{ data: pages, error: pagesError }, { data: admin, error: adminError }, { data: access, error: accessError }] = await Promise.all([
      client.from('managed_pages').select('*').eq('active', true).order('name'),
      client.from('admins').select('role').eq('user_id', userId).maybeSingle(),
      client.from('admin_page_access').select('*').eq('admin_user_id', userId),
    ])
    if (pagesError) throw new Error(pagesError.message)
    if (adminError) throw new Error(adminError.message)
    if (accessError) throw new Error(accessError.message)

    const byPage = new Map((access as Row[]).map((row) => [row.page_id, row.access_level as PageAccessLevel]))
    const superAdmin = admin?.role === 'super_admin'
    return (pages as Row[]).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      domain: r.domain,
      description: r.description,
      active: r.active,
      enabledModules: Array.isArray(r.enabled_modules) ? r.enabled_modules : [],
      accentColor: r.accent_color,
      notificationEmail: r.notification_email,
      accessLevel: superAdmin ? 'manager' : (byPage.get(r.id) ?? 'viewer'),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  async listPageContacts(pageId: string): Promise<PageContact[]> {
    const { data, error } = await this.client().from('page_contacts').select('*').eq('page_id', pageId).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({
      id: r.id,
      pageId: r.page_id,
      site: r.site,
      name: r.name,
      company: r.company,
      email: r.email,
      website: r.website,
      contactRole: r.contact_role,
      collaboration: r.collaboration,
      budget: r.budget,
      timeline: r.timeline,
      objective: r.objective,
      deliverables: Array.isArray(r.deliverables) ? r.deliverables : [],
      targetMarkets: r.target_markets,
      productStatus: r.product_status,
      message: r.message,
      status: r.status,
      details: r.details ?? {},
      consentedAt: r.consented_at,
      meta: metaFromRow(r.meta),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  async setPageContactStatus(id: string, status: ContactStatus) {
    const { error } = await this.client().rpc('update_page_contact_status', { p_contact_id: id, p_status: status })
    if (error) throw new Error(error.message)
  }

  async deletePageContact(id: string) {
    const { error } = await this.client().rpc('delete_page_contact', { p_contact_id: id })
    if (error) throw new Error(error.message)
  }

  async listAdminPageAccess(): Promise<AdminPageAccess[]> {
    const { data, error } = await this.client().from('admin_page_access').select('*').order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({
      pageId: r.page_id,
      adminUserId: r.admin_user_id,
      accessLevel: r.access_level,
      grantedBy: r.granted_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  async setAdminPageAccess(adminUserId: string, pageId: string, level: PageAccessLevel | 'none') {
    await this.adminRequest({ action: 'set_page_access', adminUserId, pageId, accessLevel: level })
  }

  async listNotifications(limit = 100): Promise<AdminNotification[]> {
    const { data, error } = await this.client().from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(limit)
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({
      id: r.id,
      recipientUserId: r.recipient_user_id,
      type: r.type,
      title: r.title,
      message: r.message,
      detail: r.detail ?? {},
      readAt: r.read_at,
      createdAt: r.created_at,
    }))
  }

  async markNotificationRead(id: string) {
    const { error } = await this.client().rpc('mark_admin_notification_read', { p_notification_id: id })
    if (error) throw new Error(error.message)
  }

  async markAllNotificationsRead() {
    const { error } = await this.client().rpc('mark_all_admin_notifications_read')
    if (error) throw new Error(error.message)
  }

  async listActivityLog(limit = 100): Promise<ActivityLogEntry[]> {
    const { data, error } = await this.client().from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit)
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({ id: r.id, actorEmail: r.actor_email, action: r.action, targetType: r.target_type, targetId: r.target_id, detail: r.detail ?? {}, createdAt: r.created_at }))
  }

  async listNotes(submissionType: 'contact' | 'application', submissionId: string): Promise<SubmissionNote[]> {
    const { data, error } = await this.client().from('submission_notes').select('*').eq('submission_type', submissionType).eq('submission_id', submissionId).order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({ id: r.id, submissionType: r.submission_type, submissionId: r.submission_id, authorEmail: r.author_email, body: r.body, createdAt: r.created_at }))
  }

  async addNote(submissionType: 'contact' | 'application', submissionId: string, body: string) {
    const { data: userData } = await this.client().auth.getUser()
    const authorEmail = userData.user?.email
    if (!authorEmail) throw new Error('Not signed in.')
    const { error } = await this.client().from('submission_notes').insert({ submission_type: submissionType, submission_id: submissionId, author_email: authorEmail, body: body.trim() })
    if (error) throw new Error(error.message)
  }

  async deleteNote(id: string) {
    const { error } = await this.client().from('submission_notes').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async getSettings(): Promise<AppSettings> {
    const { data, error } = await this.client().from('app_settings').select('*')
    if (error) throw new Error(error.message)
    const rows = data as Row[]
    const get = (key: string, fallback: unknown) => rows.find((r) => r.key === key)?.value ?? fallback
    return { orgName: get('org_name', 'JUST WHY US') as string, notifyEmail: get('notify_email', '') as string, defaultPageSize: get('default_page_size', 25) as number }
  }

  async setSetting(key: keyof AppSettings, value: string | number) {
    const dbKey = { orgName: 'org_name', notifyEmail: 'notify_email', defaultPageSize: 'default_page_size' }[key]
    const { data: userData } = await this.client().auth.getUser()
    const { error } = await this.client().from('app_settings').upsert({ key: dbKey, value, updated_at: new Date().toISOString(), updated_by: userData.user?.email ?? null })
    if (error) throw new Error(error.message)
  }
}

export { IS_SUPABASE_CONFIGURED }
export const api: DataApi = new SupabaseApi()
