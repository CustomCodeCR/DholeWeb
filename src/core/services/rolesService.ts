import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { toQueryString } from '@/core/api/queryString'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import type {
  AssignScopesToRoleRequest,
  BrowseRolesQuery,
  CreateRoleRequest,
  RevokeScopesFromRoleRequest,
  RoleDto,
  RoleScopeDto,
  RoleSelectDto,
  SetRoleActiveRequest,
  UpdateRoleRequest,
} from '@/core/interfaces/roles'

type NoContent = Record<string, never>

export const RolesService = {
  async create(payload: CreateRoleRequest): Promise<string> {
    const response = await callEndpoint<string, CreateRoleRequest>(Endpoints.createRole, { body: payload })
    return unwrapApiResponse(response)
  },

  async browse(query?: BrowseRolesQuery): Promise<RoleDto[]> {
    const response = await this.browsePaged(query)
    return response.items
  },

  async browsePaged(query?: BrowseRolesQuery): Promise<PagedResponse<RoleDto>> {
    const endpointWithQuery = Endpoints.browseRoles.path + (query ? toQueryString(query as Record<string, unknown>) : '')
    const response = await callEndpoint<unknown>({ ...Endpoints.browseRoles, path: endpointWithQuery })
    return unwrapPagedResponse<RoleDto>(response)
  },

  async select(): Promise<RoleSelectDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.selectRoles)
    return unwrapListResponse<RoleSelectDto>(response)
  },

  update(roleId: string, payload: UpdateRoleRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateRoleRequest>(Endpoints.updateRole, { params: { roleId }, body: payload })
  },

  delete(roleId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteRole, { params: { roleId } })
  },

  setActive(roleId: string, payload: SetRoleActiveRequest): Promise<NoContent> {
    return callEndpoint<NoContent, SetRoleActiveRequest>(Endpoints.setRoleActive, { params: { roleId }, body: payload })
  },

  activate(roleId: string): Promise<NoContent> {
    return this.setActive(roleId, { isActive: true })
  },

  inactivate(roleId: string): Promise<NoContent> {
    return this.setActive(roleId, { isActive: false })
  },

  async getScopes(roleId: string): Promise<RoleScopeDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.getRoleScopes, { params: { roleId } })
    return unwrapListResponse<RoleScopeDto>(response)
  },

  assignScopes(roleId: string, payload: AssignScopesToRoleRequest): Promise<NoContent> {
    return callEndpoint<NoContent, AssignScopesToRoleRequest>(Endpoints.assignScopesToRole, { params: { roleId }, body: payload })
  },

  revokeScopes(roleId: string, payload: RevokeScopesFromRoleRequest): Promise<NoContent> {
    return callEndpoint<NoContent, RevokeScopesFromRoleRequest>(Endpoints.revokeScopesFromRole, { params: { roleId }, body: payload })
  },
}
