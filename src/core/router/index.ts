import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/shared/components/layouts/MainLayout.vue'
import AuthLayout from '@/shared/components/layouts/AuthLayout.vue'
import { useAuthStore } from '@/core/stores/authStore'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'
import { VIEW_SCOPES } from '@/core/auth/scopes'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    requiresAuth?: boolean
    tabTitle?: string
    closable?: boolean
    requiredScope?: string
    requiredRole?: string
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: AuthLayout,
      meta: { public: true },
      children: [
        {
          path: '',
          name: 'login',
          component: () => import('@/modules/auth/views/LoginView.vue'),
        },
      ],
    },

    {
      path: '/',
      redirect: () => {
        const authStore = useAuthStore()
        return authStore.hasValidSession() ? '/home' : '/login'
      },
    },

    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: 'home',
          name: 'dashboard',
          component: () => import('@/modules/dashboard/views/DashboardView.vue'),
          meta: {
            tabTitle: 'Dashboard',
            closable: false,
          },
        },

        {
          path: 'auth/users',
          name: 'auth-users',
          component: () => import('@/modules/users/views/UsersView.vue'),
          meta: {
            tabTitle: 'Usuarios',
            closable: true,
            requiredScope: VIEW_SCOPES.users,
          },
        },

        {
          path: 'auth/users/:id',
          name: 'auth-user-detail',
          component: () => import('@/modules/users/views/UserDetailView.vue'),
          meta: {
            tabTitle: 'Detalle usuario',
            closable: true,
            requiredScope: VIEW_SCOPES.users,
          },
        },

        {
          path: 'auth/roles',
          name: 'auth-roles',
          component: () => import('@/modules/roles/views/RolesView.vue'),
          meta: {
            tabTitle: 'Roles',
            closable: true,
            requiredScope: VIEW_SCOPES.roles,
          },
        },

        {
          path: 'auth/roles/:id',
          name: 'auth-role-detail',
          component: () => import('@/modules/roles/views/RoleDetailView.vue'),
          meta: {
            tabTitle: 'Detalle rol',
            closable: true,
            requiredScope: VIEW_SCOPES.roles,
          },
        },

        {
          path: 'auth/scopes',
          name: 'auth-scopes',
          component: () => import('@/modules/scopes/views/ScopesView.vue'),
          meta: {
            tabTitle: 'Permisos',
            closable: true,
            requiredScope: VIEW_SCOPES.scopes,
          },
        },

        {
          path: 'auth/scopes/:id',
          name: 'auth-scope-detail',
          component: () => import('@/modules/scopes/views/ScopeDetailView.vue'),
          meta: {
            tabTitle: 'Detalle permiso',
            closable: true,
            requiredScope: VIEW_SCOPES.scopes,
          },
        },

        {
          path: 'auth/sessions',
          name: 'auth-sessions',
          component: () => import('@/modules/sessions/views/SessionsView.vue'),
          meta: {
            tabTitle: 'Sesiones',
            closable: true,
            requiredScope: VIEW_SCOPES.sessions,
          },
        },

        {
          path: 'auth/sessions/:id',
          name: 'auth-session-detail',
          component: () => import('@/modules/sessions/views/SessionDetailView.vue'),
          meta: {
            tabTitle: 'Detalle sesión',
            closable: true,
            requiredScope: VIEW_SCOPES.sessions,
          },
        },

        {
          path: 'config/catalogs',
          name: 'config-catalogs',
          component: () => import('@/modules/catalogs/views/CatalogsView.vue'),
          meta: {
            tabTitle: 'Catálogos',
            closable: true,
            requiredScope: VIEW_SCOPES.catalogs,
          },
        },

        {
          path: 'pricing',
          name: 'pricing',
          component: () => import('@/modules/pricing/views/PricingView.vue'),
          meta: {
            tabTitle: 'Pricing panel',
            closable: true,
            requiredScope: VIEW_SCOPES.pricingRates,
          },
        },
        {
          path: 'pricing/imports',
          name: 'pricing-imports',
          component: () => import('@/modules/pricing/views/PricingView.vue'),
          meta: {
            tabTitle: 'Importaciones pricing',
            closable: true,
            requiredScope: VIEW_SCOPES.pricingImports,
          },
        },
        {
          path: 'pricing/rates',
          name: 'pricing-rates',
          component: () => import('@/modules/pricing/views/PricingView.vue'),
          meta: {
            tabTitle: 'Tarifas pricing',
            closable: true,
            requiredScope: VIEW_SCOPES.pricingRates,
          },
        },
        {
          path: 'pricing/costs',
          name: 'pricing-costs',
          component: () => import('@/modules/pricing/views/PricingView.vue'),
          meta: {
            tabTitle: 'Costos pricing',
            closable: true,
            requiredScope: VIEW_SCOPES.pricingCosts,
          },
        },

        {
          path: 'auditlogs/events',
          name: 'auditlogs-events',
          component: () => import('@/modules/auditlogs/views/AuditLogsView.vue'),
          meta: {
            tabTitle: 'Auditoría',
            closable: true,
            requiredScope: VIEW_SCOPES.auditLogs,
          },
        },

        {
          path: 'monitoring/services',
          name: 'monitoring-services',
          component: () => import('@/modules/monitoring/views/ServicesMonitoringView.vue'),
          meta: {
            tabTitle: 'Monitoreo',
            closable: true,
            requiredRole: 'SuperUsuario',
          },
        },

        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/modules/settings/views/SettingsView.vue'),
          meta: {
            tabTitle: 'Configuración',
            closable: true,
          },
        },

        {
          path: 'settings/appearance',
          name: 'settings-appearance',
          component: () => import('@/modules/settings/views/AppearanceSettingsView.vue'),
          meta: {
            tabTitle: 'Apariencia',
            closable: true,
          },
        },

        {
          path: 'settings/shortcuts',
          name: 'settings-shortcuts',
          component: () => import('@/modules/settings/views/ShortcutSettingsView.vue'),
          meta: {
            tabTitle: 'Atajos',
            closable: true,
          },
        },

        {
          path: 'settings/pricing-selects',
          name: 'settings-pricing-selects',
          component: () => import('@/modules/settings/views/PricingSelectSettingsView.vue'),
          meta: {
            tabTitle: 'Selects Pricing',
            closable: true,
            requiredScope: VIEW_SCOPES.catalogs,
          },
        },
      ],
    },

    {
      path: '/:pathMatch(.*)*',
      redirect: '/home',
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  await authStore.initialize()

  const isPublic = to.meta.public === true
  const hasSession = authStore.hasValidSession()

  if (to.path === '/login' && hasSession) {
    return '/home'
  }

  if (!isPublic && !hasSession) {
    return '/login'
  }

  const requiredScope = typeof to.meta.requiredScope === 'string' ? to.meta.requiredScope : null
  const requiredRole = typeof to.meta.requiredRole === 'string' ? to.meta.requiredRole : null

  if (!isPublic && requiredScope && !authStore.hasScope(requiredScope)) {
    return '/home'
  }

  if (!isPublic && requiredRole && !authStore.hasRole(requiredRole)) {
    return '/home'
  }

  return true
})

router.afterEach((to) => {
  if (to.meta.public === true || to.query.dhEmbed === '1') return

  const tabsStore = useWorkspaceTabsStore()

  tabsStore.openTab({
    key: to.fullPath,
    path: to.fullPath,
    title: String(to.meta.tabTitle ?? to.name ?? 'Vista'),
    closable: Boolean(to.meta.closable ?? true),
  })
})

export default router
