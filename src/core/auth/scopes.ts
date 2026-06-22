export const AUTH_SCOPES = {
  users: {
    create: 'auth.users.create',
    view: 'auth.users.view',
    update: 'auth.users.update',
    delete: 'auth.users.delete',
    setActive: 'auth.users.set-active',
    setLocked: 'auth.users.set-locked',
    changePassword: 'auth.users.change-password',
    rolesAssign: 'auth.users.roles.assign',
    rolesRevoke: 'auth.users.roles.revoke',
    scopesAssign: 'auth.users.scopes.assign',
    scopesRevoke: 'auth.users.scopes.revoke',
  },
  roles: {
    create: 'auth.roles.create',
    view: 'auth.roles.view',
    update: 'auth.roles.update',
    delete: 'auth.roles.delete',
    setActive: 'auth.roles.set-active',
    scopesAssign: 'auth.roles.scopes.assign',
    scopesRevoke: 'auth.roles.scopes.revoke',
  },
  scopes: {
    view: 'auth.scopes.view',
    setActive: 'auth.scopes.set-active',
  },
  sessions: {
    view: 'auth.sessions.view',
    revoke: 'auth.sessions.revoke',
    revokeAll: 'auth.sessions.revoke-all',
  },
} as const

export const VIEW_SCOPES = {
  users: AUTH_SCOPES.users.view,
  roles: AUTH_SCOPES.roles.view,
  scopes: AUTH_SCOPES.scopes.view,
  sessions: AUTH_SCOPES.sessions.view,
} as const

export type ViewScope = (typeof VIEW_SCOPES)[keyof typeof VIEW_SCOPES]
