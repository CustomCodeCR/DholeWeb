import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { toQueryString } from '@/core/api/queryString'
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse'
import type { PagedResponse } from '@/core/api/apiResponse'
import type {
  AssignRolesToUserRequest,
  AssignScopesToUserRequest,
  BrowseUsersQuery,
  ChangeUserPasswordRequest,
  CreateUserRequest,
  RevokeRolesFromUserRequest,
  RevokeScopesFromUserRequest,
  SetUserActiveRequest,
  SetUserLockedRequest,
  UpdateUserRequest,
  UserDto,
  UserPermissionsDto,
  UserRoleDto,
  UserScopeDto,
} from '@/core/interfaces/users'

type NoContent = Record<string, never>

export const UsersService = {
  async create(payload: CreateUserRequest): Promise<string> {
    const response = await callEndpoint<string, CreateUserRequest>(Endpoints.createUser, { body: payload })
    return unwrapApiResponse(response)
  },

  async browse(query?: BrowseUsersQuery): Promise<UserDto[]> {
    const response = await this.browsePaged(query)
    return response.items
  },

  async browsePaged(query?: BrowseUsersQuery): Promise<PagedResponse<UserDto>> {
    const endpointWithQuery = Endpoints.browseUsers.path + (query ? toQueryString(query as Record<string, unknown>) : '')
    const response = await callEndpoint<unknown>({ ...Endpoints.browseUsers, path: endpointWithQuery })
    return unwrapPagedResponse<UserDto>(response)
  },

  update(userId: string, payload: UpdateUserRequest): Promise<NoContent> {
    return callEndpoint<NoContent, UpdateUserRequest>(Endpoints.updateUser, { params: { userId }, body: payload })
  },

  delete(userId: string): Promise<NoContent> {
    return callEndpoint<NoContent>(Endpoints.deleteUser, { params: { userId } })
  },

  changePassword(userId: string, payload: ChangeUserPasswordRequest): Promise<NoContent> {
    return callEndpoint<NoContent, ChangeUserPasswordRequest>(Endpoints.changeUserPassword, { params: { userId }, body: payload })
  },

  setActive(userId: string, payload: SetUserActiveRequest): Promise<NoContent> {
    return callEndpoint<NoContent, SetUserActiveRequest>(Endpoints.setUserActive, { params: { userId }, body: payload })
  },

  activate(userId: string): Promise<NoContent> {
    return this.setActive(userId, { isActive: true })
  },

  inactivate(userId: string): Promise<NoContent> {
    return this.setActive(userId, { isActive: false })
  },

  setLocked(userId: string, payload: SetUserLockedRequest): Promise<NoContent> {
    return callEndpoint<NoContent, SetUserLockedRequest>(Endpoints.setUserLocked, { params: { userId }, body: payload })
  },

  block(userId: string, reason?: string | null): Promise<NoContent> {
    return this.setLocked(userId, { isLocked: true, reason: reason ?? null })
  },

  unblock(userId: string): Promise<NoContent> {
    return this.setLocked(userId, { isLocked: false, reason: null })
  },

  async getRoles(userId: string): Promise<UserRoleDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.getUserRoles, { params: { userId } })
    return unwrapListResponse<UserRoleDto>(response)
  },

  assignRoles(userId: string, payload: AssignRolesToUserRequest): Promise<NoContent> {
    return callEndpoint<NoContent, AssignRolesToUserRequest>(Endpoints.assignRolesToUser, { params: { userId }, body: payload })
  },

  revokeRoles(userId: string, payload: RevokeRolesFromUserRequest): Promise<NoContent> {
    return callEndpoint<NoContent, RevokeRolesFromUserRequest>(Endpoints.revokeRolesFromUser, { params: { userId }, body: payload })
  },

  async getScopes(userId: string): Promise<UserScopeDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.getUserScopes, { params: { userId } })
    return unwrapListResponse<UserScopeDto>(response)
  },

  assignScopes(userId: string, payload: AssignScopesToUserRequest): Promise<NoContent> {
    return callEndpoint<NoContent, AssignScopesToUserRequest>(Endpoints.assignScopesToUser, { params: { userId }, body: payload })
  },

  revokeScopes(userId: string, payload: RevokeScopesFromUserRequest): Promise<NoContent> {
    return callEndpoint<NoContent, RevokeScopesFromUserRequest>(Endpoints.revokeScopesFromUser, { params: { userId }, body: payload })
  },

  async getPermissions(userId: string): Promise<UserPermissionsDto> {
    const response = await callEndpoint<UserPermissionsDto>(Endpoints.getUserPermissions, { params: { userId } })
    return unwrapApiResponse(response)
  },
}
