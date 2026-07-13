export type EmailMessageStatus =
  | 'Received'
  | 'Queued'
  | 'Processing'
  | 'Extracted'
  | 'NeedsReview'
  | 'Ignored'
  | 'Duplicated'
  | 'Failed'

export type EmailExtractionJobStatus =
  | 'Pending'
  | 'Processing'
  | 'SentToPricing'
  | 'NeedsReview'
  | 'Failed'
  | 'Ignored'

export interface BrowseEmailAccountsQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string
  isActive?: boolean
}

export interface BrowseEmailMessagesQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string
  status?: EmailMessageStatus
  accountId?: string
}

export interface BrowseEmailExtractionJobsQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  status?: EmailExtractionJobStatus
  emailMessageId?: string
}

export interface EmailAccountDto extends Record<string, unknown> {
  id: string
  name: string
  emailAddress: string
  providerType: string
  host: string
  port: number
  useSsl: boolean
  username: string
  secretReference: string
  folderName: string
  pollingIntervalMinutes: number
  autoProcess: boolean
  autoSendToPricing: boolean
  autoSendMinConfidence: number
  processBodyWhenNoSupportedAttachments: boolean
  processBodyEvenWithAttachments: boolean
  allowedSenders?: string | null
  isActive: boolean
  lastProcessedUid?: number | null
  lastSyncAt?: string | null
  lastSyncError?: string | null
}

export interface EmailMessageDto extends Record<string, unknown> {
  id: string
  emailIngestionAccountId: string
  fromName?: string | null
  fromAddress: string
  subject: string
  receivedAt: string
  hasAttachments: boolean
  status: EmailMessageStatus
  classificationConfidence?: number | null
  classificationReason?: string | null
  errorMessage?: string | null
}

export interface EmailAttachmentDto extends Record<string, unknown> {
  id: string
  fileName: string
  contentType?: string | null
  fileExtension?: string | null
  sizeBytes: number
  fileHash: string
  sourceFileType: string
  status: string
  errorMessage?: string | null
  storagePath: string
}

export interface EmailExtractionJobDto extends Record<string, unknown> {
  id: string
  emailMessageId: string
  emailAttachmentId?: string | null
  sourceType: string
  provisionalPricingImportId: string
  extractionExecutionId?: string | null
  pricingImportBatchId?: string | null
  status: EmailExtractionJobStatus
  confidenceScore?: number | null
  errorMessage?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}

export interface EmailMessageDetailDto extends EmailMessageDto {
  externalMessageId: string
  uid?: number | null
  messageIdHeader?: string | null
  toAddresses?: string | null
  ccAddresses?: string | null
  bodyText?: string | null
  bodyHtml?: string | null
  rawEmailStoragePath?: string | null
  attachments: EmailAttachmentDto[]
  jobs: EmailExtractionJobDto[]
}
