/* ════════════════════════════════════════════════════════════════
   Data layer — Supabase-backed. Reads/updates the real `contacts`
   and `applications` tables (RLS: authenticated only). No mock data —
   if Supabase isn't configured, calls fail loudly instead of showing
   fabricated rows.
   ════════════════════════════════════════════════════════════════ */
import type {
  Application, ContactSubmission, VisitorMeta,
  ContactStatus, ApplicationStatus,
} from './types'
import { supabase, IS_SUPABASE_CONFIGURED } from './supabase'

export interface DataApi {
  listContacts(): Promise<ContactSubmission[]>
  listApplications(): Promise<Application[]>
  setContactStatus(id: string, status: ContactStatus): Promise<void>
  setApplicationStatus(id: string, status: ApplicationStatus): Promise<void>
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
}

export { IS_SUPABASE_CONFIGURED }
export const api: DataApi = new SupabaseApi()
