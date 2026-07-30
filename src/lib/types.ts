export type Audience = 'creator' | 'brand'

export interface VisitorMeta {
  country: string | null
  countryCode: string | null
  city: string | null
  timezone: string | null
  device: 'Desktop' | 'Mobile' | 'Tablet'
  os: string
  browser: string
  referrer: string
  landingPath: string
  submitPath: string
  timeOnSiteSec: number
  pageViews: number
  sessionId: string
  userAgent: string
}

export type ContactStatus = 'new' | 'read' | 'replied' | 'archived'
export type ApplicationStatus = 'new' | 'reviewing' | 'accepted' | 'rejected'
export type PageAccessLevel = 'viewer' | 'manager'

export interface ContactSubmission {
  id: string
  kind: 'contact'
  createdAt: string
  audience: Audience
  name: string
  email: string
  subject: string
  message: string
  status: ContactStatus
  meta: VisitorMeta
}

interface ApplicationBase {
  id: string
  kind: 'application'
  createdAt: string
  email: string
  niche: string | null
  preferredContactChannels?: string[]
  status: ApplicationStatus
  meta: VisitorMeta
}

export interface CreatorApplication extends ApplicationBase {
  appType: 'creator'
  name: string
  handle: string | null
  platform: string | null
  audienceSize: string | null
  contentLink: string | null
}

export interface BrandApplication extends ApplicationBase {
  appType: 'brand'
  company: string
  budgetRange: string | null
  campaignGoal: string | null
  website: string | null
}

export type Application = CreatorApplication | BrandApplication
export type Submission = ContactSubmission | Application

export type AdminRole = 'admin' | 'super_admin'

export interface AdminRecord {
  userId: string
  email: string
  role: AdminRole
  active: boolean
  displayName: string | null
  createdAt: string
  updatedAt: string
}

export interface ManagedPage {
  id: string
  slug: string
  name: string
  domain: string
  description: string | null
  active: boolean
  enabledModules: string[]
  accentColor: string | null
  notificationEmail: string | null
  accessLevel: PageAccessLevel
  createdAt: string
  updatedAt: string
}

export interface AdminPageAccess {
  pageId: string
  adminUserId: string
  accessLevel: PageAccessLevel
  grantedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PageContact {
  id: string
  pageId: string
  site: string
  name: string
  company: string | null
  email: string
  website: string | null
  contactRole: string | null
  collaboration: string | null
  budget: string | null
  timeline: string | null
  objective: string | null
  deliverables: string[]
  targetMarkets: string | null
  productStatus: string | null
  message: string
  status: ContactStatus
  details: Record<string, unknown>
  consentedAt: string | null
  meta: VisitorMeta
  createdAt: string
  updatedAt: string
}

export interface ActivityLogEntry {
  id: string
  actorEmail: string
  action: string
  targetType: string
  targetId: string | null
  detail: Record<string, unknown>
  createdAt: string
}

export interface SubmissionNote {
  id: string
  submissionType: 'contact' | 'application'
  submissionId: string
  authorEmail: string
  body: string
  createdAt: string
}

export interface AppSettings {
  orgName: string
  notifyEmail: string
  defaultPageSize: number
}
