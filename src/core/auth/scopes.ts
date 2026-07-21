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

export const CONFIG_SCOPES = {
  catalogGroups: {
    create: 'config.catalog-groups.create',
    view: 'config.catalog-groups.view',
    update: 'config.catalog-groups.update',
    delete: 'config.catalog-groups.delete',
    setActive: 'config.catalog-groups.set-active',
  },

  catalogItems: {
    create: 'config.catalog-items.create',
    view: 'config.catalog-items.view',
    update: 'config.catalog-items.update',
    delete: 'config.catalog-items.delete',
    setActive: 'config.catalog-items.set-active',
    changeSortOrder: 'config.catalog-items.change-sort-order',
    validate: 'config.catalog-items.validate',
  },

  catalogSelects: {
    view: 'config.catalog-selects.view',
  },
} as const

export const AUDITLOGS_SCOPES = {
  events: {
    view: 'auditlogs.events.view',
    export: 'auditlogs.events.export',
  },
  entityHistory: {
    view: 'auditlogs.entity-history.view',
  },
  userHistory: {
    view: 'auditlogs.user-history.view',
  },
} as const

export const PRICING_SCOPES = {
  costs: {
    create: 'pricing.cost.create',
    view: 'pricing.cost.view',
    update: 'pricing.cost.update',
    delete: 'pricing.cost.delete',
    setActive: 'pricing.cost.set-active',
    select: 'pricing.cost.select',
  },

  importFclRates: {
    create: 'pricing.import-fcl-rate.create',
    view: 'pricing.import-fcl-rate.view',
    approve: 'pricing.import-fcl-rate.approve',
    reject: 'pricing.import-fcl-rate.reject',
    delete: 'pricing.import-fcl-rate.delete',
    createAsRate: 'pricing.import-fcl-rate.create-as-rate',
  },

  rates: {
    create: 'pricing.rate.create',
    view: 'pricing.rate.view',
    update: 'pricing.rate.update',
    delete: 'pricing.rate.delete',
    setActive: 'pricing.rate.set-active',
    select: 'pricing.rate.select',
    approveLowMargin: 'pricing.rate.approve-low-margin',
    approveFreight: 'pricing.rate.approve-freight',
  },

  fclRateDetails: {
    create: 'pricing.fcl-rate-detail.create',
    update: 'pricing.fcl-rate-detail.update',
    delete: 'pricing.fcl-rate-detail.delete',
  },

  rateCostDetails: {
    create: 'pricing.rate-cost-detail.create',
    update: 'pricing.rate-cost-detail.update',
    delete: 'pricing.rate-cost-detail.delete',
  },

  fclDecisions: {
    create: 'pricing.fcl-decisions.create',
    view: 'pricing.fcl-decisions.view',
    delete: 'pricing.fcl-decisions.delete',
  },

  // Backward-compatible aliases for older UI code.
  fclRateImports: {
    create: 'pricing.import-fcl-rate.create',
    view: 'pricing.import-fcl-rate.view',
    approve: 'pricing.import-fcl-rate.approve',
    reject: 'pricing.import-fcl-rate.reject',
    delete: 'pricing.import-fcl-rate.delete',
  },

  fclRates: {
    create: 'pricing.rate.create',
    view: 'pricing.rate.view',
    update: 'pricing.rate.update',
    delete: 'pricing.rate.delete',
    setActive: 'pricing.rate.set-active',
    expire: 'pricing.rate.update',
    validate: 'pricing.rate.view',
  },

  dashboard: {
    view: 'pricing.rate.view',
  },

  selects: {
    view: 'pricing.rate.select',
  },
} as const


export const AI_SCOPES = {
  connections: {
    create: 'ai.connection.create',
    view: 'ai.connection.view',
    update: 'ai.connection.update',
    delete: 'ai.connection.delete',
    setActive: 'ai.connection.set-active',
    test: 'ai.connection.test',
    discoverModels: 'ai.connection.discover-models',
  },
  models: {
    create: 'ai.model.create',
    view: 'ai.model.view',
    update: 'ai.model.update',
    delete: 'ai.model.delete',
    setActive: 'ai.model.set-active',
  },
  profiles: {
    create: 'ai.profile.create',
    view: 'ai.profile.view',
    update: 'ai.profile.update',
    delete: 'ai.profile.delete',
    setActive: 'ai.profile.set-active',
    configureModels: 'ai.profile.configure-models',
  },
  promptTemplates: {
    create: 'ai.prompt-template.create',
    view: 'ai.prompt-template.view',
    update: 'ai.prompt-template.update',
    delete: 'ai.prompt-template.delete',
    setActive: 'ai.prompt-template.set-active',
  },
  executions: {
    view: 'ai.execution.view',
    execute: 'ai.execution.execute',
    cancel: 'ai.execution.cancel',
  },
} as const

export const VIEW_SCOPES = {
  users: AUTH_SCOPES.users.view,
  roles: AUTH_SCOPES.roles.view,
  scopes: AUTH_SCOPES.scopes.view,
  sessions: AUTH_SCOPES.sessions.view,

  catalogs: CONFIG_SCOPES.catalogGroups.view,

  auditLogs: AUDITLOGS_SCOPES.events.view,

  pricing: PRICING_SCOPES.rates.view,
  pricingRates: PRICING_SCOPES.rates.view,
  pricingImports: PRICING_SCOPES.importFclRates.view,
  pricingDecisions: PRICING_SCOPES.fclDecisions.view,
  pricingCompetition: PRICING_SCOPES.rates.view,
  pricingCosts: PRICING_SCOPES.costs.view,

  aiConnections: AI_SCOPES.connections.view,
  aiModels: AI_SCOPES.models.view,
  aiProfiles: AI_SCOPES.profiles.view,
  aiPromptTemplates: AI_SCOPES.promptTemplates.view,
  aiExecutions: AI_SCOPES.executions.view,
  aiAssistant: AI_SCOPES.executions.execute,
} as const
