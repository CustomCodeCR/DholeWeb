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

    return unwrapListResponse<CatalogItemSelectDto>(response)
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
