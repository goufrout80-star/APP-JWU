/* ════════════════════════════════════════════════════════════════
   Shared submission schema — the SAME shapes the marketing site
   captures and writes. Keep this file in sync with the main site's
   src/lib/submissionTypes.ts (they describe one contract).
   ════════════════════════════════════════════════════════════════ */

export type Audience = 'creator' | 'brand'

/** Everything we learn about the visitor at submit time. */
export interface VisitorMeta {
  country: string | null      // "Germany"
  countryCode: string | null  // "DE" (ISO-3166 alpha-2, used for the flag)
  city: string | null
  timezone: string | null
  device: 'Desktop' | 'Mobile' | 'Tablet'
  os: string                  // "macOS", "Windows", "iOS"…
  browser: string             // "Chrome", "Safari"…
  referrer: string            // referring URL or "Direct"
  landingPath: string         // first page of the session
  submitPath: string          // page the form was submitted from
  timeOnSiteSec: number       // seconds on the site BEFORE submitting
  pageViews: number           // pages viewed this session
  sessionId: string
  userAgent: string
}

export type ContactStatus = 'new' | 'read' | 'replied' | 'archived'
export type ApplicationStatus = 'new' | 'reviewing' | 'accepted' | 'rejected'

export interface ContactSubmission {
  id: string
  kind: 'contact'
  createdAt: string           // ISO timestamp
  audience: Audience          // which tab they used
  name: string
  email: string
  subject: string
  message: string
  status: ContactStatus
  meta: VisitorMeta
}

export interface CreatorApplication {
  id: string
  kind: 'application'
  appType: 'creator'
  createdAt: string
  name: string
  email: string
  handle: string | null
  platform: string | null
  niche: string | null
  audienceSize: string | null
  contentLink: string | null
  status: ApplicationStatus
  meta: VisitorMeta
}

export interface BrandApplication {
  id: string
  kind: 'application'
  appType: 'brand'
  createdAt: string
  company: string
  email: string
  niche: string | null
  budgetRange: string | null
  campaignGoal: string | null
  website: string | null
  status: ApplicationStatus
  meta: VisitorMeta
}

export type Application = CreatorApplication | BrandApplication
export type Submission = ContactSubmission | Application
