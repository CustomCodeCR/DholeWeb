export type MarketingResourceKind =
  | 'placements'
  | 'collections'
  | 'redirects'
  | 'forms'
  | 'submissions'
  | 'leads'
  | 'meeting-types'
  | 'meeting-requests'
  | 'meeting-agenda'
  | 'campaigns'
  | 'sites'
  | 'content-calendar'
  | 'content-pending'
  | 'content-scheduled'
  | 'content-history'

export interface MarketingFormDto {
  id: string
  siteKey: string
  formKey: string
  name: string
  purpose: string
  status: string
  successMessage?: string | null
  notificationTemplateKey?: string | null
  settingsJson?: string | null
  version: number
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface MarketingSubmissionDto {
  id: string
  formId: string
  contentId?: string | null
  campaignId?: string | null
  submittedAtUtc: string
  status: string
  sourceUrl: string
  referrerUrl?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  payloadJson: string
  ipHash?: string | null
  userAgent?: string | null
  correlationId: string
}

export interface MarketingLeadDto {
  id: string
  siteKey: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  jobTitle?: string | null
  country?: string | null
  source?: string | null
  status: string
  ownerUserId?: string | null
  firstTouchAtUtc: string
  lastTouchAtUtc: string
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface MeetingTypeDto {
  id: string
  siteKey: string
  name: string
  slug: string
  description?: string | null
  durationMinutes: number
  bufferMinutes: number
  meetingMode: string
  assignedUserId?: string | null
  assignedTeamKey?: string | null
  settingsJson?: string | null
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface MeetingRequestDto {
  id: string
  meetingTypeId: string
  leadId?: string | null
  submissionId?: string | null
  requestedStartUtc: string
  requestedEndUtc: string
  timeZone: string
  subject: string
  message?: string | null
  status: string
  assignedUserId?: string | null
  confirmedStartUtc?: string | null
  confirmedEndUtc?: string | null
  externalProvider?: string | null
  externalEventId?: string | null
  meetingUrl?: string | null
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface MarketingCampaignDto {
  id: string
  siteKey: string
  name: string
  slug: string
  status: string
  startsAtUtc?: string | null
  endsAtUtc?: string | null
  landingContentId?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  goalType: string
  settingsJson?: string | null
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface PlacementDto {
  id: string
  siteKey: string
  code: string
  name: string
  allowedTypesJson: string
  maxItems: number
  settingsJson?: string | null
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface ContentCollectionDto {
  id: string
  siteKey: string
  code: string
  name: string
  settingsJson?: string | null
  isActive: boolean
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface ContentRedirectDto {
  id: string
  siteKey: string
  sourcePath: string
  targetUrl: string
  statusCode: number
  isActive: boolean
  validFromUtc?: string | null
  validToUtc?: string | null
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface SiteDto {
  id: string
  siteKey: string
  name: string
  primaryDomain: string
  defaultLocale: string
  timeZone: string
  logoMediaId?: string | null
  faviconMediaId?: string | null
  defaultOpenGraphMediaId?: string | null
  status: string
  createdAtUtc: string
  updatedAtUtc?: string | null
}
