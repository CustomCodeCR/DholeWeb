import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { toQueryString } from '@/core/api/queryString'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import type {
  BrowseCatalogItemsQuery,
  CatalogItemDetailDto,
  CatalogItemDto,
  CatalogItemSelectDto,
  ChangeCatalogItemSortOrderRequest,
  CreateCatalogItemForGroupRequest,
  CreateCatalogItemRequest,
  SelectCatalogItemsQuery,
  SetCatalogItemActiveRequest,
  UpdateCatalogItemRequest,
  ValidateCatalogItemQuery,
  ValidateCatalogItemResponse,
} from '@/core/interfaces/catalogs'

type NoContent = Record<string, never>

import { getTransientAccessToken } from '@/core/auth/transientSession'

// Shared in-memory cache for the lookup lists used across Pricing and other modules.
// Cache is isolated by session/impersonation, bounded by TTL and invalidated on catalog writes.
const CATALOG_LOOKUP_TTL_MS = 60_000
const catalogLookupCache = new Map<string, { expiresAt: number; value: unknown }>()
const catalogLookupsInFlight = new Map<string, Promise<unknown>>()
let catalogLookupRevision = 0

function invalidateCatalogLookups(): void {
  catalogLookupRevision++
  catalogLookupCache.clear()
  catalogLookupsInFlight.clear()
}

if (typeof window !== 'undefined') {
  for (const eventName of ['dhole:auth:expired', 'dhole:auth:impersonation-expired', 'dhole:auth:refreshed']) {
    window.addEventListener(eventName, invalidateCatalogLookups)
  }
  window.addEventListener('dhole:data:changed', (event: Event) => {
    const endpoint = (event as CustomEvent<{ endpoint?: string }>).detail?.endpoint ?? ''
    if (/^\/api\/config\/catalog-(?:items|groups)(?:[/?]|$)/.test(endpoint)) {
      invalidateCatalogLookups()
    }
  })
}

function catalogLookupKey(path: string): string {
  const sessionId = typeof localStorage === 'undefined' ? '' : localStorage.getItem('auth.sessionId') ?? ''
  const userId = typeof localStorage === 'undefined' ? '' : localStorage.getItem('auth.userId') ?? ''
  const impersonation = typeof window === 'undefined' ? '' : getTransientAccessToken() ?? ''
  return [sessionId, userId, impersonation, path].join('|')
}

function loadCatalogLookup<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const scopedKey = catalogLookupKey(key)
  const cached = catalogLookupCache.get(scopedKey)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value as T)
  const pending = catalogLookupsInFlight.get(scopedKey)
  if (pending) return pending as Promise<T>

  const generation = catalogLookupRevision
  const request = Promise.resolve().then(loader).then(value => {
    if (generation === catalogLookupRevision) {
      catalogLookupCache.set(scopedKey, { expiresAt: Date.now() + CATALOG_LOOKUP_TTL_MS, value })
    }
    return value
  }).finally(() => {
    if (catalogLookupsInFlight.get(scopedKey) === request) catalogLookupsInFlight.delete(scopedKey)
  })
  catalogLookupsInFlight.set(scopedKey, request)
  return request
}

export const CatalogItemsService = {
  async create(payload: CreateCatalogItemRequest): Promise<string> {
    const response = await callEndpoint<string, CreateCatalogItemRequest>(
      Endpoints.createCatalogItem,
      { body: payload },
    )

    return unwrapApiResponse(response)
  },

  async createForGroup(
    catalogGroupId: string,
    payload: CreateCatalogItemForGroupRequest,
  ): Promise<string> {
    const response = await callEndpoint<string, CreateCatalogItemForGroupRequest>(
      Endpoints.createCatalogItemForGroup,
      {
        params: { catalogGroupId },
        body: payload,
      },
    )

    return unwrapApiResponse(response)
  },

  async browse(query?: BrowseCatalogItemsQuery): Promise<CatalogItemDto[]> {
    const response = await this.browsePaged(query)
    return response.items
  },

  async browsePaged(query?: BrowseCatalogItemsQuery): Promise<PagedResponse<CatalogItemDto>> {
    const endpointWithQuery =
      Endpoints.browseCatalogItems.path +
      (query ? toQueryString(query as Record<string, unknown>) : '')

    const response = await callEndpoint<unknown>({
      ...Endpoints.browseCatalogItems,
      path: endpointWithQuery,
    })

    return unwrapPagedResponse<CatalogItemDto>(response)
  },

  async select(query?: SelectCatalogItemsQuery): Promise<CatalogItemSelectDto[]> {
    const endpointWithQuery =
      Endpoints.selectCatalogItems.path +
      (query ? toQueryString(query as Record<string, unknown>) : '')

    const load = async () => {
      const response = await callEndpoint<unknown>({
        ...Endpoints.selectCatalogItems,
        path: endpointWithQuery,
      })
      // Preserve metadata such as contactDirectory for FCL/LCL Pricing consumers.
      return unwrapListResponse<CatalogItemSelectDto>(response)
    }
    // Search results are intentionally not cached; only stable, group-scoped lists.
    const cacheable = Boolean((query?.catalogGroupSlug || query?.catalogGroupId) && !query?.search)
    return cacheable ? loadCatalogLookup(endpointWithQuery, load) : load()
  },

  async getByGroupSlug(catalogGroupSlug: string): Promise<CatalogItemDto[]> {
    return loadCatalogLookup(`group:${catalogGroupSlug}`, async () => {
      const response = await callEndpoint<unknown>(Endpoints.getCatalogItemsByGroupSlug, {
        params: { catalogGroupSlug },
      })
      return unwrapListResponse<CatalogItemDto>(response)
    })
  },

  async getById(catalogItemId: string): Promise<CatalogItemDetailDto> {
    const response = await callEndpoint<CatalogItemDetailDto>(Endpoints.getCatalogItemById, {
      params: { catalogItemId },
    })

    return unwrapApiResponse<CatalogItemDetailDto>(response as any)
  },

  async validate(query: ValidateCatalogItemQuery): Promise<ValidateCatalogItemResponse> {
    const endpointWithQuery =
      Endpoints.validateCatalogItem.path +
      toQueryString(query as unknown as Record<string, unknown>)

    const response = await callEndpoint<ValidateCatalogItemResponse>({
      ...Endpoints.validateCatalogItem,
      path: endpointWithQuery,
    })

    return unwrapApiResponse(response)
  },

  update(catalogItemId: string, payload: UpdateCatalogItemRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateCatalogItemRequest>(Endpoints.updateCatalogItem, {
      params: { catalogItemId },
      body: payload,
    })
  },

  delete(catalogItemId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteCatalogItem, { params: { catalogItemId } })
  },

  setActive(catalogItemId: string, payload: SetCatalogItemActiveRequest): Promise<NoContent> {
    return callEndpoint<NoContent, SetCatalogItemActiveRequest>(Endpoints.setCatalogItemActive, {
      params: { catalogItemId },
      body: payload,
    })
  },

  activate(catalogItemId: string): Promise<NoContent> {
    return this.setActive(catalogItemId, { isActive: true })
  },

  inactivate(catalogItemId: string): Promise<NoContent> {
    return this.setActive(catalogItemId, { isActive: false })
  },

  changeSortOrder(
    catalogItemId: string,
    payload: ChangeCatalogItemSortOrderRequest,
  ): Promise<NoContent> {
    return callEndpoint<NoContent, ChangeCatalogItemSortOrderRequest>(
      Endpoints.changeCatalogItemSortOrder,
      {
        params: { catalogItemId },
        body: payload,
      },
    )
  },
}
