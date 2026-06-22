export interface RoleDto {
  id: string
  name: string
  description: string | null
  isSystemRole: boolean
  isActive: boolean
}

export interface RoleSelectDto {
  id: string
  name: string
}

export interface RoleScopeDto {
  roleId: string
  scopeId: string
  scopeCode: string
  scopeName: string
}

export interface CreateRoleRequest {
  name: string
  description?: string | null
  isSystemRole: boolean
}

export interface UpdateRoleRequest {
  name: string
  description?: string | null
}

export interface SetRoleActiveRequest {
  isActive: boolean
}

export interface AssignScopesToRoleRequest {
  scopeIds: string[]
}

export interface RevokeScopesFromRoleRequest {
  scopeIds: string[]
}

export interface BrowseRolesQuery {
  pageNumber?: number
  pageSize?: number
  search?: string
  isActive?: boolean | null
}
