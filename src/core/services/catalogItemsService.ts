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

type ContactDirectoryEntry = {
  name?: unknown
  email?: unknown
  phone?: unknown
  isPrimary?: unknown
  isActive?: unknown
}

function contactText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueContactValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function preferContactDirectory(item: CatalogItemSelectDto): CatalogItemSelectDto {
  if (!item.metadataJson) return item

  try {
    const parsed = JSON.parse(item.metadataJson) as Record<string, unknown>
    if (!Array.isArray(parsed.contactDirectory)) return item

    const directory = parsed.contactDirectory
      .filter((entry): entry is ContactDirectoryEntry => Boolean(entry) && typeof entry === 'object')
      .filter((entry) => entry.isActive !== false)
      .sort((left, right) => Number(right.isPrimary === true) - Number(left.isPrimary === true))

    // contactDirectory is the source of truth for WHS contacts. The legacy
    // contacts/email/phone fields are kept only for old records that do not have
    // a directory at all. If a directory exists, never leak stale legacy values.
    const contacts = uniqueContactValues(directory.map((entry) => contactText(entry.name)))
    const emails = uniqueContactValues(directory.map((entry) => contactText(entry.email)))
    const phones = uniqueContactValues(directory.map((entry) => contactText(entry.phone)))

    return {
      ...item,
      metadataJson: JSON.stringify({
        ...parsed,
        contacts: contacts.join(' / '),
        email: emails.join(' / '),
        phone: phones.join(' / '),
      }),
    }
  } catch {
    return item
  }
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

    const response = await callEndpoint<unknown>({
      ...Endpoints.selectCatalogItems,
      path: endpointWithQuery,
    })

    return unwrapListResponse<CatalogItemSelectDto>(response).map(preferContactDirectory)
  },

  async getByGroupSlug(catalogGroupSlug: string): Promise<CatalogItemDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.getCatalogItemsByGroupSlug, {
      params: { catalogGroupSlug },
    })

    return unwrapListResponse<CatalogItemDto>(response)
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
