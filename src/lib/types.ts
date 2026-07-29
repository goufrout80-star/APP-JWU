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
  preferredContactChannels: string[]
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
  email: string
  role: AdminRole
  active: boolean
  displayName: string | null
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
