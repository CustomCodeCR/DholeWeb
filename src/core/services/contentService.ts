import { fetchClient } from '@/core/api/fetchConfig'
import { toQueryString } from '@/core/api/queryString'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import type {
  ContentBrowseQuery,
  ContentItemDto,
  ContentItemListDto,
  ContentRevisionDto,
  ContentWriteRequest,
  MediaBrowseQuery,
  MediaDto,
  NavigationMenuDto,
  SiteSettingDto,
  TaxonomyBrowseQuery,
  TaxonomyTermDto,
  TaxonomyWriteRequest,
  UpdateMediaMetadataRequest,
  UpsertNavigationMenuRequest,
  UpsertSiteSettingRequest,
} from '@/core/interfaces/content'

type EmptyResponse = Record<string, never>

function query(path: string, values?: Record<string, unknown>) {
  return path + (values ? toQueryString(values) : '')
}

function get<T>(path: string) {
  return fetchClient<T>(path, { method: 'GET' })
}

function post<T, TBody = unknown>(path: string, body?: TBody) {
  return fetchClient<T>(path, { method: 'POST', ...(body !== undefined ? { body } : {}) })
}

function put<T, TBody = unknown>(path: string, body?: TBody) {
  return fetchClient<T>(path, { method: 'PUT', ...(body !== undefined ? { body } : {}) })
}

function patch<T, TBody = unknown>(path: string, body?: TBody) {
  return fetchClient<T>(path, { method: 'PATCH', ...(body !== undefined ? { body } : {}) })
}

function remove<T>(path: string) {
  return fetchClient<T>(path, { method: 'DELETE' })
}

export const ContentService = {
  async browseContent(values?: ContentBrowseQuery): Promise<PagedResponse<ContentItemListDto>> {
    const response = await get<unknown>(query('/api/content/items', values as Record<string, unknown>))
    return unwrapPagedResponse<ContentItemListDto>(response)
  },

  async getContent(id: string): Promise<ContentItemDto> {
    return unwrapApiResponse<ContentItemDto>(await get<unknown>(`/api/content/items/${id}`) as any)
  },

  async createContent(payload: ContentWriteRequest): Promise<string> {
    const response = await post<unknown, ContentWriteRequest>('/api/content/items', payload)
    return unwrapApiResponse<string>(response as any)
  },

  updateContent(id: string, payload: Omit<ContentWriteRequest, 'type' | 'authorUserId' | 'siteKey'>) {
    return put<EmptyResponse, typeof payload>(`/api/content/items/${id}`, payload)
  },

  submitForReview(id: string) {
    return post<EmptyResponse>(`/api/content/items/${id}/review`)
  },

  publish(id: string) {
    return post<EmptyResponse>(`/api/content/items/${id}/publish`)
  },

  schedule(id: string, scheduledAtUtc: string) {
    return post<EmptyResponse, { scheduledAtUtc: string }>(`/api/content/items/${id}/schedule`, {
      scheduledAtUtc,
    })
  },

  unpublish(id: string) {
    return post<EmptyResponse>(`/api/content/items/${id}/unpublish`)
  },

  archive(id: string) {
    return post<EmptyResponse>(`/api/content/items/${id}/archive`)
  },

  deleteContent(id: string) {
    return remove<EmptyResponse>(`/api/content/items/${id}`)
  },

  async getRevisions(id: string): Promise<ContentRevisionDto[]> {
    return unwrapListResponse<ContentRevisionDto>(await get<unknown>(`/api/content/items/${id}/revisions`))
  },

  restoreRevision(id: string, revisionId: string, reason?: string | null) {
    return post<EmptyResponse, { reason?: string | null }>(
      `/api/content/items/${id}/revisions/${revisionId}/restore`,
      { reason: reason || null },
    )
  },

  async browseMedia(values?: MediaBrowseQuery): Promise<PagedResponse<MediaDto>> {
    return unwrapPagedResponse<MediaDto>(
      await get<unknown>(query('/api/content/media', values as Record<string, unknown>)),
    )
  },

  async uploadMedia(file: File, altText?: string, caption?: string, metadataJson?: string): Promise<MediaDto> {
    const form = new FormData()
    form.append('file', file)
    if (altText?.trim()) form.append('altText', altText.trim())
    if (caption?.trim()) form.append('caption', caption.trim())
    if (metadataJson?.trim()) form.append('metadataJson', metadataJson.trim())

    const response = await fetchClient<unknown>('/api/content/media/upload', {
      method: 'POST',
      body: form,
      isFormData: true,
    })
    return unwrapApiResponse<MediaDto>(response as any)
  },

  updateMedia(id: string, payload: UpdateMediaMetadataRequest) {
    return patch<EmptyResponse, UpdateMediaMetadataRequest>(`/api/content/media/${id}`, payload)
  },

  deleteMedia(id: string) {
    return remove<EmptyResponse>(`/api/content/media/${id}`)
  },

  async browseTaxonomies(values?: TaxonomyBrowseQuery): Promise<PagedResponse<TaxonomyTermDto>> {
    return unwrapPagedResponse<TaxonomyTermDto>(
      await get<unknown>(query('/api/content/taxonomies', values as Record<string, unknown>)),
    )
  },

  async createTaxonomy(payload: TaxonomyWriteRequest): Promise<string> {
    return unwrapApiResponse<string>(await post<unknown, TaxonomyWriteRequest>('/api/content/taxonomies', payload) as any)
  },

  updateTaxonomy(id: string, payload: TaxonomyWriteRequest) {
    return put<EmptyResponse, TaxonomyWriteRequest>(`/api/content/taxonomies/${id}`, payload)
  },

  deleteTaxonomy(id: string) {
    return remove<EmptyResponse>(`/api/content/taxonomies/${id}`)
  },

  async getMenu(location: string, siteKey = 'main'): Promise<NavigationMenuDto | null> {
    const response = await get<unknown>(
      query(`/api/content/menus/${encodeURIComponent(location)}`, { siteKey }),
    )
    return unwrapApiResponse<NavigationMenuDto | null>(response as any)
  },

  async upsertMenu(location: string, payload: UpsertNavigationMenuRequest): Promise<string> {
    return unwrapApiResponse<string>(
      await put<unknown, UpsertNavigationMenuRequest>(
        `/api/content/menus/${encodeURIComponent(location)}`,
        payload,
      ) as any,
    )
  },

  setMenuActive(id: string, isActive: boolean) {
    return patch<EmptyResponse>(`/api/content/menus/${id}/active?isActive=${isActive}`)
  },

  async getSettings(siteKey = 'main'): Promise<SiteSettingDto[]> {
    return unwrapListResponse<SiteSettingDto>(
      await get<unknown>(query('/api/content/settings', { siteKey })),
    )
  },

  upsertSetting(key: string, payload: UpsertSiteSettingRequest) {
    return put<EmptyResponse, UpsertSiteSettingRequest>(
      `/api/content/settings/${encodeURIComponent(key)}`,
      payload,
    )
  },

  deleteSetting(id: string) {
    return remove<EmptyResponse>(`/api/content/settings/${id}`)
  },
}
