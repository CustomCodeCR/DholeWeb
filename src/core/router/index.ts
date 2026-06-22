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
          meta: { tabTitle: 'Dashboard', closable: false },
        },
        {
          path: 'auth/users',
          name: 'auth-users',
          component: () => import('@/modules/users/views/UsersView.vue'),
          meta: { tabTitle: 'Usuarios', closable: true, requiredScope: VIEW_SCOPES.users },
        },
        {
          path: 'auth/users/:id',
          name: 'auth-user-detail',
          component: () => import('@/modules/users/views/UserDetailView.vue'),
          meta: { tabTitle: 'Detalle usuario', closable: true, requiredScope: VIEW_SCOPES.users },
        },
        {
          path: 'auth/roles',
          name: 'auth-roles',
          component: () => import('@/modules/roles/views/RolesView.vue'),
          meta: { tabTitle: 'Roles', closable: true, requiredScope: VIEW_SCOPES.roles },
        },
        {
          path: 'auth/roles/:id',
          name: 'auth-role-detail',
          component: () => import('@/modules/roles/views/RoleDetailView.vue'),
          meta: { tabTitle: 'Detalle rol', closable: true, requiredScope: VIEW_SCOPES.roles },
        },
        {
          path: 'auth/scopes',
          name: 'auth-scopes',
          component: () => import('@/modules/scopes/views/ScopesView.vue'),
          meta: { tabTitle: 'Permisos', closable: true, requiredScope: VIEW_SCOPES.scopes },
        },
        {
          path: 'auth/scopes/:id',
          name: 'auth-scope-detail',
          component: () => import('@/modules/scopes/views/ScopeDetailView.vue'),
          meta: { tabTitle: 'Detalle permiso', closable: true, requiredScope: VIEW_SCOPES.scopes },
        },
        {
          path: 'auth/sessions',
          name: 'auth-sessions',
          component: () => import('@/modules/sessions/views/SessionsView.vue'),
          meta: { tabTitle: 'Sesiones', closable: true, requiredScope: VIEW_SCOPES.sessions },
        },
        {
          path: 'auth/sessions/:id',
          name: 'auth-session-detail',
          component: () => import('@/modules/sessions/views/SessionDetailView.vue'),
          meta: { tabTitle: 'Detalle sesión', closable: true, requiredScope: VIEW_SCOPES.sessions },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/modules/settings/views/SettingsView.vue'),
          meta: { tabTitle: 'Configuración', closable: true },
        },
        {
          path: 'settings/appearance',
          name: 'settings-appearance',
          component: () => import('@/modules/settings/views/AppearanceSettingsView.vue'),
          meta: { tabTitle: 'Apariencia', closable: true },
        },
        {
          path: 'settings/shortcuts',
          name: 'settings-shortcuts',
          component: () => import('@/modules/settings/views/ShortcutSettingsView.vue'),
          meta: { tabTitle: 'Atajos', closable: true },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/home' },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.initialize()

  const isPublic = to.meta.public === true
  const hasSession = authStore.hasValidSession()

  if (to.path === '/login' && hasSession) return '/home'
  if (!isPublic && !hasSession) return '/login'

  const requiredScope = typeof to.meta.requiredScope === 'string' ? to.meta.requiredScope : null

  if (!isPublic && requiredScope && !authStore.hasScope(requiredScope)) {
    return '/home'
  }

  return true
})

router.afterEach((to) => {
  if (to.meta.public === true) return

  const tabsStore = useWorkspaceTabsStore()
  tabsStore.openTab({
    key: to.fullPath,
    path: to.fullPath,
    title: String(to.meta.tabTitle ?? to.name ?? 'Vista'),
    closable: Boolean(to.meta.closable ?? true),
  })
})

export default router
