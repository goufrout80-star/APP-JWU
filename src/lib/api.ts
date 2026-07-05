/* ════════════════════════════════════════════════════════════════
   Data layer — Supabase-backed. Reads/updates the real `contacts`
   and `applications` tables (RLS: authenticated only). No mock data —
   if Supabase isn't configured, calls fail loudly instead of showing
   fabricated rows.
   ════════════════════════════════════════════════════════════════ */
import type {
  Application, ContactSubmission, VisitorMeta,
  ContactStatus, ApplicationStatus,
  AdminRecord, AdminRole, ActivityLogEntry, SubmissionNote, AppSettings,
} from './types'
import { supabase, IS_SUPABASE_CONFIGURED } from './supabase'

export interface DataApi {
  listContacts(): Promise<ContactSubmission[]>
  listApplications(): Promise<Application[]>
  setContactStatus(id: string, status: ContactStatus): Promise<void>
  setApplicationStatus(id: string, status: ApplicationStatus): Promise<void>

  listAdmins(): Promise<AdminRecord[]>
  addAdmin(email: string, role: AdminRole): Promise<void>
  setAdminActive(email: string, active: boolean): Promise<void>
  setAdminRole(email: string, role: AdminRole): Promise<void>
  removeAdmin(email: string): Promise<void>

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
    if (!supabase) throw new Error('Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    return supabase
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
    return (data as Row[]).map((r): Application =>
      r.app_type === 'creator'
        ? { id: r.id, kind: 'application', appType: 'creator', createdAt: r.created_at, name: r.name, email: r.email, handle: r.handle, platform: r.platform, niche: r.niche, audienceSize: r.audience_size, contentLink: r.content_link, status: r.status, meta: metaFromRow(r.meta) }
        : { id: r.id, kind: 'application', appType: 'brand', createdAt: r.created_at, company: r.company, email: r.email, niche: r.niche, budgetRange: r.budget_range, campaignGoal: r.campaign_goal, website: r.website, status: r.status, meta: metaFromRow(r.meta) },
    )
  }

  async setContactStatus(id: string, status: ContactStatus) {
    const { error } = await this.client().from('contacts').update({ status }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async setApplicationStatus(id: string, status: ApplicationStatus) {
    const { error } = await this.client().from('applications').update({ status }).eq('id', id)
    if (error) throw new Error(error.message)
  }

  async listAdmins(): Promise<AdminRecord[]> {
    const { data, error } = await this.client().from('admins').select('*').order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({
      email: r.email, role: r.role, active: r.active,
      displayName: r.display_name, createdAt: r.created_at, updatedAt: r.updated_at,
    }))
  }

  async addAdmin(email: string, role: AdminRole) {
    const { error } = await this.client().from('admins').insert({ email: email.trim().toLowerCase(), role })
    if (error) throw new Error(error.message)
  }

  async setAdminActive(email: string, active: boolean) {
    const { error } = await this.client().from('admins').update({ active, updated_at: new Date().toISOString() }).eq('email', email)
    if (error) throw new Error(error.message)
  }

  async setAdminRole(email: string, role: AdminRole) {
    const { error } = await this.client().from('admins').update({ role, updated_at: new Date().toISOString() }).eq('email', email)
    if (error) throw new Error(error.message)
  }

  async removeAdmin(email: string) {
    const { error } = await this.client().from('admins').delete().eq('email', email)
    if (error) throw new Error(error.message)
  }

  async listActivityLog(limit = 100): Promise<ActivityLogEntry[]> {
    const { data, error } = await this.client().from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit)
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({
      id: r.id, actorEmail: r.actor_email, action: r.action,
      targetType: r.target_type, targetId: r.target_id, detail: r.detail ?? {}, createdAt: r.created_at,
    }))
  }

  async listNotes(submissionType: 'contact' | 'application', submissionId: string): Promise<SubmissionNote[]> {
    const { data, error } = await this.client().from('submission_notes').select('*')
      .eq('submission_type', submissionType).eq('submission_id', submissionId).order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data as Row[]).map((r) => ({
      id: r.id, submissionType: r.submission_type, submissionId: r.submission_id,
      authorEmail: r.author_email, body: r.body, createdAt: r.created_at,
    }))
  }

  async addNote(submissionType: 'contact' | 'application', submissionId: string, body: string) {
    const { data: userData } = await this.client().auth.getUser()
    const authorEmail = userData.user?.email
    if (!authorEmail) throw new Error('Not signed in.')
    const { error } = await this.client().from('submission_notes').insert({
      submission_type: submissionType, submission_id: submissionId, author_email: authorEmail, body: body.trim(),
    })
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
    return {
      orgName: get('org_name', 'JUST WHY US') as string,
      notifyEmail: get('notify_email', '') as string,
      defaultPageSize: get('default_page_size', 25) as number,
    }
  }

  async setSetting(key: keyof AppSettings, value: string | number) {
    const dbKey = { orgName: 'org_name', notifyEmail: 'notify_email', defaultPageSize: 'default_page_size' }[key]
    const { data: userData } = await this.client().auth.getUser()
    const { error } = await this.client().from('app_settings').upsert({
      key: dbKey, value, updated_at: new Date().toISOString(), updated_by: userData.user?.email ?? null,
    })
    if (error) throw new Error(error.message)
  }
}

export { IS_SUPABASE_CONFIGURED }
export const api: DataApi = new SupabaseApi()
