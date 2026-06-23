import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { toQueryString } from '@/core/api/queryString'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import type {
  BrowseCatalogGroupsQuery,
  CatalogGroupDetailDto,
  CatalogGroupDto,
  CatalogGroupSelectDto,
  CreateCatalogGroupRequest,
  SelectCatalogGroupsQuery,
  SetCatalogGroupActiveRequest,
  UpdateCatalogGroupRequest,
} from '@/core/interfaces/catalogs'

type NoContent = Record<string, never>

export const CatalogGroupsService = {
  async create(payload: CreateCatalogGroupRequest): Promise<string> {
    const response = await callEndpoint<string, CreateCatalogGroupRequest>(
      Endpoints.createCatalogGroup,
      { body: payload },
    )

    return unwrapApiResponse(response)
  },

  async browse(query?: BrowseCatalogGroupsQuery): Promise<CatalogGroupDto[]> {
    const response = await this.browsePaged(query)
    return response.items
  },

  async browsePaged(query?: BrowseCatalogGroupsQuery): Promise<PagedResponse<CatalogGroupDto>> {
    const endpointWithQuery =
      Endpoints.browseCatalogGroups.path +
      (query ? toQueryString(query as Record<string, unknown>) : '')

    const response = await callEndpoint<unknown>({
      ...Endpoints.browseCatalogGroups,
      path: endpointWithQuery,
    })

    return unwrapPagedResponse<CatalogGroupDto>(response)
  },

  async select(query?: SelectCatalogGroupsQuery): Promise<CatalogGroupSelectDto[]> {
    const endpointWithQuery =
      Endpoints.selectCatalogGroups.path +
      (query ? toQueryString(query as Record<string, unknown>) : '')

    const response = await callEndpoint<unknown>({
      ...Endpoints.selectCatalogGroups,
      path: endpointWithQuery,
    })

    return unwrapListResponse<CatalogGroupSelectDto>(response)
  },

  async getById(catalogGroupId: string): Promise<CatalogGroupDetailDto> {
    const response = await callEndpoint<CatalogGroupDetailDto>(Endpoints.getCatalogGroupById, {
      params: { catalogGroupId },
    })

    return unwrapApiResponse(response)
  },

  update(catalogGroupId: string, payload: UpdateCatalogGroupRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateCatalogGroupRequest>(Endpoints.updateCatalogGroup, {
      params: { catalogGroupId },
      body: payload,
    })
  },

  delete(catalogGroupId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteCatalogGroup, { params: { catalogGroupId } })
  },

  setActive(catalogGroupId: string, payload: SetCatalogGroupActiveRequest): Promise<NoContent> {
    return callEndpoint<NoContent, SetCatalogGroupActiveRequest>(Endpoints.setCatalogGroupActive, {
      params: { catalogGroupId },
      body: payload,
    })
  },

  activate(catalogGroupId: string): Promise<NoContent> {
    return this.setActive(catalogGroupId, { isActive: true })
  },

  inactivate(catalogGroupId: string): Promise<NoContent> {
    return this.setActive(catalogGroupId, { isActive: false })
  },
}
