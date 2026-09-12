export interface ContentRouteDto {
  id: string
  siteKey: string
  contentId: string
  locale: string
  path: string
  isPrimary: boolean
  isActive: boolean
}

export interface CreateContentRouteRequest {
  siteKey: string
  contentId: string
  locale: string
  path: string
  isPrimary: boolean
  isActive: boolean
}

export interface UpdateContentRouteRequest {
  siteKey: string
  locale: string
  path: string
  isPrimary: boolean
  isActive: boolean
  createPermanentRedirect?: boolean
}
