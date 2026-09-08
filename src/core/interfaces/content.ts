export type ContentType =
  | 'Page'
  | 'News'
  | 'Post'
  | 'Announcement'
  | 'Banner'
  | 'Video'
  | 'ReusableBlock'

export type ContentStatus = 'Draft' | 'PendingReview' | 'Scheduled' | 'Published' | 'Archived'

export interface SeoDto {
  title?: string | null
  description?: string | null
  keywords?: string | null
  canonicalUrl?: string | null
  robots?: string | null
  openGraphMediaId?: string | null
  structuredDataJson?: string | null
}

export type SeoWriteRequest = SeoDto

export interface ContentItemListDto {
  id: string
  siteKey: string
  type: ContentType | string
  status: ContentStatus | string
  title: string
  slug: string
  excerpt?: string | null
  featuredMediaId?: string | null
  locale: string
  isFeatured: boolean
  publishedAtUtc?: string | null
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface ContentItemDto extends ContentItemListDto {
  blocksJson: string
  renderedHtml?: string | null
  authorUserId?: string | null
  sortOrder: number
  seo: SeoDto
  scheduledAtUtc?: string | null
}

export interface ContentRevisionDto {
  id: string
  revisionNumber: number
  title: string
  slug: string
  reason?: string | null
  createdBy?: string | null
  createdAtUtc: string
}

export interface ContentWriteRequest {
  type?: ContentType | string
  title: string
  slug?: string | null
  excerpt?: string | null
  blocksJson?: string | null
  renderedHtml?: string | null
  featuredMediaId?: string | null
  authorUserId?: string | null
  locale?: string | null
  sortOrder: number
  isFeatured: boolean
  taxonomyTermIds?: string[] | null
  seo?: SeoWriteRequest | null
  siteKey?: string | null
}

export interface ContentBrowseQuery {
  pageNumber?: number
  pageSize?: number
  siteKey?: string
  type?: string
  status?: string
  search?: string
  locale?: string
}

export interface EditorSeoRequest {
  title?: string | null
  description?: string | null
  keywords?: string | null
  canonicalUrl?: string | null
  openGraphMediaId?: string | null
}

export interface EditorContentRequest {
  type: ContentType | string
  title: string
  contentHtml?: string | null
  slug?: string | null
  excerpt?: string | null
  featuredMediaId?: string | null
  locale?: string | null
  sortOrder?: number | null
  isFeatured?: boolean | null
  categoryIds?: string[] | null
  seo?: EditorSeoRequest | null
  siteKey?: string | null
}

export interface EditorDashboardDto {
  pages: number
  news: number
  banners: number
  media: number
  drafts: number
  pendingReview: number
  scheduled: number
  published: number
}

export interface EditorOptionDto {
  value: string
  label: string
}

export interface EditorOptionsDto {
  contentTypes: EditorOptionDto[]
  statuses: EditorOptionDto[]
  defaultLocale: string
  defaultSiteKey: string
}

export interface MediaDto {
  id: string
  storageFileId: string
  fileName: string
  contentType: string
  altText?: string | null
  caption?: string | null
  metadataJson?: string | null
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface MediaBrowseQuery {
  pageNumber?: number
  pageSize?: number
  search?: string
  contentType?: string
}

export interface UpdateMediaMetadataRequest {
  altText?: string | null
  caption?: string | null
  metadataJson?: string | null
}

export interface TaxonomyTermDto {
  id: string
  siteKey: string
  kind: string
  name: string
  slug: string
  description?: string | null
  parentId?: string | null
  sortOrder: number
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface TaxonomyBrowseQuery {
  pageNumber?: number
  pageSize?: number
  siteKey?: string
  kind?: string
  search?: string
}

export interface TaxonomyWriteRequest {
  kind: string
  name: string
  slug?: string | null
  description?: string | null
  parentId?: string | null
  sortOrder: number
  siteKey?: string | null
}

export interface NavigationMenuItemDto {
  id: string
  parentId?: string | null
  label: string
  url?: string | null
  contentId?: string | null
  target: string
  sortOrder: number
  isVisible: boolean
}

export interface NavigationMenuDto {
  id: string
  siteKey: string
  name: string
  location: string
  isActive: boolean
  items: NavigationMenuItemDto[]
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface NavigationMenuItemWriteRequest {
  label: string
  url?: string | null
  contentId?: string | null
  parentId?: string | null
  sortOrder: number
  target?: string | null
}

export interface UpsertNavigationMenuRequest {
  name: string
  location: string
  siteKey?: string | null
  items: NavigationMenuItemWriteRequest[]
}

export interface SiteSettingDto {
  id: string
  siteKey: string
  key: string
  valueJson: string
  isPublic: boolean
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export interface UpsertSiteSettingRequest {
  key: string
  valueJson: string
  isPublic: boolean
  siteKey?: string | null
}
