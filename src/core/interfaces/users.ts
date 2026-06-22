export type UserType = 'Internal' | 'External'

export interface UserDto {
  id: string
  userName: string
  email: string
  displayName: string
  userType: UserType
  isActive: boolean
  isLocked: boolean
  lastLoginAt: string | null
}

export interface UserRoleDto {
  userId: string
  roleId: string
  roleName: string
}

export interface UserScopeDto {
  userId: string
  scopeId: string
  scopeCode: string
  scopeName: string
}

export interface UserPermissionsDto {
  userId: string
  roles: UserRoleDto[]
  directScopes: UserScopeDto[]
  effectiveScopes: UserScopeDto[]
}

export interface CreateUserRequest {
  userName: string
  email: string
  displayName: string
  userType: UserType
  password: string
}

export interface UpdateUserRequest {
  userName: string
  email: string
  displayName: string
}

export interface ChangeUserPasswordRequest {
  password: string
}

export interface SetUserActiveRequest {
  isActive: boolean
}

export interface SetUserLockedRequest {
  isLocked: boolean
  reason?: string | null
}

export interface AssignRolesToUserRequest {
  roleIds: string[]
}

export interface RevokeRolesFromUserRequest {
  roleIds: string[]
}

export interface AssignScopesToUserRequest {
  scopeIds: string[]
}

export interface RevokeScopesFromUserRequest {
  scopeIds: string[]
}

export interface BrowseUsersQuery {
  pageNumber?: number
  pageSize?: number
  search?: string
  isActive?: boolean | null
  isLocked?: boolean | null
}
