export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface Endpoint {
  method: HttpMethod
  path: string
  headers?: Record<string, string>
}

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const acceptJson = {
  Accept: 'application/json',
}

export const AuthEndpoints = {
  login: { method: 'POST', path: '/api/auth/login', headers: jsonHeaders },
  refreshToken: { method: 'POST', path: '/api/auth/refresh', headers: jsonHeaders },
} satisfies Record<string, Endpoint>

export const UserEndpoints = {
  createUser: { method: 'POST', path: '/api/auth/users', headers: jsonHeaders },
  browseUsers: { method: 'GET', path: '/api/auth/users', headers: acceptJson },
  updateUser: { method: 'PUT', path: '/api/auth/users/{{userId}}', headers: jsonHeaders },
  deleteUser: { method: 'DELETE', path: '/api/auth/users/{{userId}}', headers: acceptJson },
  changeUserPassword: {
    method: 'PATCH',
    path: '/api/auth/users/{{userId}}/password',
    headers: jsonHeaders,
  },
  setUserActive: {
    method: 'PATCH',
    path: '/api/auth/users/{{userId}}/active',
    headers: jsonHeaders,
  },
  setUserLocked: {
    method: 'PATCH',
    path: '/api/auth/users/{{userId}}/locked',
    headers: jsonHeaders,
  },
  getUserRoles: { method: 'GET', path: '/api/auth/users/{{userId}}/roles', headers: acceptJson },
  assignRolesToUser: {
    method: 'POST',
    path: '/api/auth/users/{{userId}}/roles',
    headers: jsonHeaders,
  },
  revokeRolesFromUser: {
    method: 'POST',
    path: '/api/auth/users/{{userId}}/roles/revoke',
    headers: jsonHeaders,
  },
  getUserScopes: { method: 'GET', path: '/api/auth/users/{{userId}}/scopes', headers: acceptJson },
  assignScopesToUser: {
    method: 'POST',
    path: '/api/auth/users/{{userId}}/scopes',
    headers: jsonHeaders,
  },
  revokeScopesFromUser: {
    method: 'POST',
    path: '/api/auth/users/{{userId}}/scopes/revoke',
    headers: jsonHeaders,
  },
  getUserPermissions: {
    method: 'GET',
    path: '/api/auth/users/{{userId}}/permissions',
    headers: acceptJson,
  },
} satisfies Record<string, Endpoint>

export const RoleEndpoints = {
  createRole: { method: 'POST', path: '/api/auth/roles', headers: jsonHeaders },
  browseRoles: { method: 'GET', path: '/api/auth/roles', headers: acceptJson },
  selectRoles: { method: 'GET', path: '/api/auth/roles/select', headers: acceptJson },
  updateRole: { method: 'PUT', path: '/api/auth/roles/{{roleId}}', headers: jsonHeaders },
  deleteRole: { method: 'DELETE', path: '/api/auth/roles/{{roleId}}', headers: acceptJson },
  setRoleActive: {
    method: 'PATCH',
    path: '/api/auth/roles/{{roleId}}/active',
    headers: jsonHeaders,
  },
  getRoleScopes: { method: 'GET', path: '/api/auth/roles/{{roleId}}/scopes', headers: acceptJson },
  assignScopesToRole: {
    method: 'POST',
    path: '/api/auth/roles/{{roleId}}/scopes',
    headers: jsonHeaders,
  },
  revokeScopesFromRole: {
    method: 'POST',
    path: '/api/auth/roles/{{roleId}}/scopes/revoke',
    headers: jsonHeaders,
  },
} satisfies Record<string, Endpoint>

export const ScopeEndpoints = {
  // AuthService expone esto como /api/scopes/select, no /api/auth/scopes/select.
  selectScopes: { method: 'GET', path: '/api/auth/scopes/select', headers: acceptJson },
} satisfies Record<string, Endpoint>

export const SessionEndpoints = {
  // AuthService expone esto como /api/sessions, no /api/auth/sessions.
  getUserSessions: {
    method: 'GET',
    path: '/api/auth/sessions/users/{{userId}}',
    headers: acceptJson,
  },
  getActiveUserSessions: {
    method: 'GET',
    path: '/api/auth/sessions/users/{{userId}}/active',
    headers: acceptJson,
  },
  revokeSession: {
    method: 'PATCH',
    path: '/api/auth/sessions/{{sessionId}}/revoke',
    headers: jsonHeaders,
  },
  revokeUserSessions: {
    method: 'PATCH',
    path: '/api/auth/sessions/users/{{userId}}/revoke',
    headers: jsonHeaders,
  },
} satisfies Record<string, Endpoint>

export const Endpoints = {
  ...AuthEndpoints,
  ...UserEndpoints,
  ...RoleEndpoints,
  ...ScopeEndpoints,
  ...SessionEndpoints,
} satisfies Record<string, Endpoint>
