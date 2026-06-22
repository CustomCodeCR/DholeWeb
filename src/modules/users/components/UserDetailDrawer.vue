<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Ban, CheckCircle2, KeyRound, Lock, MonitorCheck, RefreshCcw, Shield, ShieldMinus, ShieldPlus, Unlock, UserCog } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhTabs, type DhTabItem } from '@/shared/components/molecules'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { AUTH_SCOPES } from '@/core/auth/scopes'
import { UsersService } from '@/core/services/usersService'
import { RolesService } from '@/core/services/rolesService'
import { ScopesService } from '@/core/services/scopesService'
import { SessionsService } from '@/core/services/sessionsService'
import { AuthService } from '@/core/services/authService'
import type { UserDto, UserPermissionsDto, UserRoleDto, UserScopeDto } from '@/core/interfaces/users'
import type { RoleSelectDto } from '@/core/interfaces/roles'
import type { ScopeSelectDto } from '@/core/interfaces/scopes'
import type { SessionDto } from '@/core/interfaces/sessions'
import AuthMultiSelectModal from '@/modules/auth/components/AuthMultiSelectModal.vue'
import AuthReasonModal from '@/modules/auth/components/AuthReasonModal.vue'
import UserPasswordModal from '@/modules/users/components/UserPasswordModal.vue'

const props = defineProps<{
  user: UserDto
  onSaved?: () => Promise<void> | void
}>()

const { t } = useI18n()
const modalStore = useModalStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const localUser = ref<UserDto>({ ...props.user })
const activeTab = ref('summary')
const loading = ref(false)
const roles = ref<UserRoleDto[]>([])
const directScopes = ref<UserScopeDto[]>([])
const permissions = ref<UserPermissionsDto | null>(null)
const sessions = ref<SessionDto[]>([])
const availableRoles = ref<RoleSelectDto[]>([])
const availableScopes = ref<ScopeSelectDto[]>([])

interface AuthMultiSelectItem { id: string; label: string; description?: string; badge?: string }

const canSetActive = computed(() => authStore.hasScope(AUTH_SCOPES.users.setActive))
const canSetLocked = computed(() => authStore.hasScope(AUTH_SCOPES.users.setLocked))
const canChangePassword = computed(() => authStore.hasScope(AUTH_SCOPES.users.changePassword))
const canViewRoles = computed(() => authStore.hasScope(AUTH_SCOPES.roles.view))
const canViewScopes = computed(() => authStore.hasScope(AUTH_SCOPES.scopes.view))
const canAssignRoles = computed(() => authStore.hasScope(AUTH_SCOPES.users.rolesAssign) && canViewRoles.value)
const canRevokeRoles = computed(() => authStore.hasScope(AUTH_SCOPES.users.rolesRevoke))
const canAssignScopes = computed(() => authStore.hasScope(AUTH_SCOPES.users.scopesAssign) && canViewScopes.value)
const canRevokeScopes = computed(() => authStore.hasScope(AUTH_SCOPES.users.scopesRevoke))
const canViewSessions = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.view))
const canRevokeSessions = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.revoke))
const canRevokeAllSessions = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.revokeAll))
const canRefreshCurrentToken = computed(() => localUser.value.id === authStore.userId)
const showAccountActions = computed(() => canSetActive.value || canSetLocked.value || canChangePassword.value)
const showRoleActions = computed(() => canAssignRoles.value || canRevokeRoles.value)
const showScopeActions = computed(() => canAssignScopes.value || canRevokeScopes.value)
const showSessionActions = computed(() => canRefreshCurrentToken.value || canRevokeAllSessions.value)

const tabs = computed<DhTabItem[]>(() => {
  const items: DhTabItem[] = [
    { key: 'summary', label: 'Resumen' },
    { key: 'roles', label: `${t('users.roles')} (${roles.value.length})` },
    { key: 'scopes', label: `${t('users.scopes')} (${directScopes.value.length})` },
    { key: 'permissions', label: t('users.permissions') },
  ]

  if (canViewSessions.value) {
    items.push({ key: 'sessions', label: `${t('users.sessions')} (${sessions.value.length})` })
  }

  return items
})

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

async function loadRelated() {
  loading.value = true
  try {
    const [userRoles, userScopes, userPermissions, userSessions, roleOptions, scopeOptions] = await Promise.all([
      UsersService.getRoles(localUser.value.id),
      UsersService.getScopes(localUser.value.id),
      UsersService.getPermissions(localUser.value.id),
      canViewSessions.value ? SessionsService.getByUser(localUser.value.id, { pageNumber: 1, pageSize: 50 }) : Promise.resolve([]),
      canAssignRoles.value ? RolesService.select() : Promise.resolve([]),
      canAssignScopes.value ? ScopesService.select() : Promise.resolve([]),
    ])

    roles.value = userRoles
    directScopes.value = userScopes
    permissions.value = userPermissions
    sessions.value = userSessions
    availableRoles.value = roleOptions
    availableScopes.value = scopeOptions
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el detalle del usuario.')
  } finally {
    loading.value = false
  }
}

async function refreshParent() {
  await props.onSaved?.()
}

async function activate() {
  if (!canSetActive.value) return
  await UsersService.activate(localUser.value.id)
  localUser.value.isActive = true
  toastStore.success('Usuario activado')
  await refreshParent()
}

async function inactivate() {
  if (!canSetActive.value) return
  await UsersService.inactivate(localUser.value.id)
  localUser.value.isActive = false
  toastStore.success('Usuario inactivado')
  await refreshParent()
}

function openBlockModal() {
  if (!canSetLocked.value) return

  modalStore.open({
    title: t('common.block'),
    component: AuthReasonModal,
    size: 'md',
    props: {
      title: 'Bloquear usuario',
      message: `Bloquear a ${localUser.value.displayName || localUser.value.userName}`,
      confirmLabel: t('common.block'),
      danger: true,
      onConfirm: async (reason: string | null) => {
        await UsersService.block(localUser.value.id, reason)
        localUser.value.isLocked = true
        toastStore.success('Usuario bloqueado')
        await refreshParent()
      },
    },
  })
}

async function unblock() {
  if (!canSetLocked.value) return
  await UsersService.unblock(localUser.value.id)
  localUser.value.isLocked = false
  toastStore.success('Usuario desbloqueado')
  await refreshParent()
}

function openPasswordModal() {
  if (!canChangePassword.value) return

  modalStore.open({
    title: t('users.changePassword'),
    component: UserPasswordModal,
    size: 'md',
    props: { userId: localUser.value.id },
  })
}

function roleItems(items: RoleSelectDto[]): AuthMultiSelectItem[] {
  return items.map((role) => ({ id: role.id, label: role.name, badge: 'Rol' }))
}

function scopeItems(items: ScopeSelectDto[]): AuthMultiSelectItem[] {
  return items.map((scope) => ({ id: scope.id, label: scope.name, description: scope.code, badge: 'Scope' }))
}

function openAssignRoles() {
  if (!canAssignRoles.value) return

  const selected = roles.value.map((role) => role.roleId)
  modalStore.open({
    title: t('users.assignRoles'),
    component: AuthMultiSelectModal,
    size: 'lg',
    props: {
      title: t('users.assignRoles'),
      description: 'Seleccione los roles que desea asignar al usuario.',
      items: roleItems(availableRoles.value),
      initiallySelectedIds: selected,
      confirmLabel: t('common.assign'),
      onConfirm: async (ids: string[]) => {
        const toAssign = ids.filter((id) => !selected.includes(id))
        if (toAssign.length > 0) await UsersService.assignRoles(localUser.value.id, { roleIds: toAssign })
        toastStore.success('Roles asignados')
        await loadRelated()
        await refreshParent()
      },
    },
  })
}

function openRevokeRoles() {
  if (!canRevokeRoles.value || roles.value.length === 0) return

  modalStore.open({
    title: t('users.revokeRoles'),
    component: AuthMultiSelectModal,
    size: 'lg',
    props: {
      title: t('users.revokeRoles'),
      description: 'Seleccione los roles que desea quitar del usuario.',
      items: roles.value.map((role) => ({ id: role.roleId, label: role.roleName, badge: 'Rol' })),
      confirmLabel: t('common.revoke'),
      onConfirm: async (ids: string[]) => {
        if (ids.length > 0) await UsersService.revokeRoles(localUser.value.id, { roleIds: ids })
        toastStore.success('Roles revocados')
        await loadRelated()
        await refreshParent()
      },
    },
  })
}

function openAssignScopes() {
  if (!canAssignScopes.value) return

  const selected = directScopes.value.map((scope) => scope.scopeId)
  modalStore.open({
    title: t('users.assignScopes'),
    component: AuthMultiSelectModal,
    size: 'lg',
    props: {
      title: t('users.assignScopes'),
      description: 'Seleccione los scopes directos que desea asignar al usuario.',
      items: scopeItems(availableScopes.value),
      initiallySelectedIds: selected,
      confirmLabel: t('common.assign'),
      onConfirm: async (ids: string[]) => {
        const toAssign = ids.filter((id) => !selected.includes(id))
        if (toAssign.length > 0) await UsersService.assignScopes(localUser.value.id, { scopeIds: toAssign })
        toastStore.success('Scopes asignados')
        await loadRelated()
        await refreshParent()
      },
    },
  })
}

function openRevokeScopes() {
  if (!canRevokeScopes.value || directScopes.value.length === 0) return

  modalStore.open({
    title: t('users.revokeScopes'),
    component: AuthMultiSelectModal,
    size: 'lg',
    props: {
      title: t('users.revokeScopes'),
      description: 'Seleccione los scopes directos que desea quitar del usuario.',
      items: directScopes.value.map((scope) => ({ id: scope.scopeId, label: scope.scopeName, description: scope.scopeCode, badge: 'Scope' })),
      confirmLabel: t('common.revoke'),
      danger: true,
      onConfirm: async (ids: string[]) => {
        if (ids.length > 0) await UsersService.revokeScopes(localUser.value.id, { scopeIds: ids })
        toastStore.success('Scopes revocados')
        await loadRelated()
        await refreshParent()
      },
    },
  })
}

function openRevokeSession(session: SessionDto) {
  if (!canRevokeSessions.value || session.isRevoked) return

  modalStore.open({
    title: t('sessions.revoke'),
    component: AuthReasonModal,
    size: 'md',
    props: {
      title: t('sessions.revoke'),
      message: session.id,
      confirmLabel: t('common.revoke'),
      danger: true,
      onConfirm: async (reason: string | null) => {
        await SessionsService.revoke(session.id, { revokedBy: authStore.userId, reason })
        toastStore.success('Sesión revocada')
        await loadRelated()
      },
    },
  })
}

function openRevokeAllSessions() {
  if (!canRevokeAllSessions.value) return

  modalStore.open({
    title: t('common.revokeAll'),
    component: AuthReasonModal,
    size: 'md',
    props: {
      title: 'Revocar sesiones del usuario',
      message: 'Esto revoca todas las sesiones activas de este usuario.',
      confirmLabel: t('common.revokeAll'),
      danger: true,
      onConfirm: async (reason: string | null) => {
        await SessionsService.revokeByUser(localUser.value.id, { revokedBy: authStore.userId, reason })
        toastStore.success('Sesiones revocadas')
        await loadRelated()
      },
    },
  })
}

async function refreshCurrentToken() {
  if (!canRefreshCurrentToken.value || !authStore.refreshToken) return

  try {
    const response = await AuthService.refreshToken({ refreshToken: authStore.refreshToken })
    authStore.setSession(response)
    toastStore.success('Token refrescado')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo refrescar el token.')
  }
}

onMounted(loadRelated)
</script>

<template>
  <section class="space-y-5">
    <div class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-xl font-black text-[var(--dh-text)]">{{ localUser.displayName || localUser.userName }}</h3>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ localUser.email }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <DhBadge :label="localUser.userType" variant="primary" />
            <DhBadge :label="localUser.isActive ? t('common.active') : t('common.inactive')" :variant="localUser.isActive ? 'success' : 'neutral'" />
            <DhBadge :label="localUser.isLocked ? 'Bloqueado' : 'Desbloqueado'" :variant="localUser.isLocked ? 'danger' : 'success'" />
          </div>
        </div>
      </div>

      <div v-if="showAccountActions" class="mt-5 grid gap-2 md:grid-cols-3">
        <DhButton v-if="canSetActive && localUser.isActive" :icon="Ban" label="Inactivar" variant="secondary" @click="inactivate" />
        <DhButton v-else-if="canSetActive" :icon="CheckCircle2" label="Activar" @click="activate" />
        <DhButton v-if="canSetLocked && localUser.isLocked" :icon="Unlock" label="Desbloquear" variant="secondary" @click="unblock" />
        <DhButton v-else-if="canSetLocked" :icon="Lock" label="Bloquear" variant="danger" @click="openBlockModal" />
        <DhButton v-if="canChangePassword" :icon="UserCog" label="Cambiar contraseña" variant="secondary" @click="openPasswordModal" />
      </div>
    </div>

    <DhTabs v-model="activeTab" :items="tabs" />

    <div v-if="loading" class="rounded-[28px] border border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]">
      {{ t('common.loading') }}
    </div>

    <section v-else-if="activeTab === 'summary'" class="grid gap-3 md:grid-cols-2">
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">ID</p>
        <p class="mt-2 break-all text-sm font-bold text-[var(--dh-text)]">{{ localUser.id }}</p>
      </div>
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Último login</p>
        <p class="mt-2 text-sm font-bold text-[var(--dh-text)]">{{ formatDate(localUser.lastLoginAt) }}</p>
      </div>
    </section>

    <section v-else-if="activeTab === 'roles'" class="space-y-3">
      <div v-if="showRoleActions" class="flex justify-end gap-2">
        <DhButton v-if="canAssignRoles" :icon="ShieldPlus" :label="t('users.assignRoles')" @click="openAssignRoles" />
        <DhButton v-if="canRevokeRoles && roles.length > 0" :icon="ShieldMinus" :label="t('users.revokeRoles')" variant="secondary" @click="openRevokeRoles" />
      </div>
      <div class="grid gap-2 md:grid-cols-2">
        <div v-for="role in roles" :key="role.roleId" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex items-center gap-3"><Shield class="h-4 w-4 text-[var(--dh-primary)]" /><p class="font-black text-[var(--dh-text)]">{{ role.roleName }}</p></div>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'scopes'" class="space-y-3">
      <div v-if="showScopeActions" class="flex justify-end gap-2">
        <DhButton v-if="canAssignScopes" :icon="KeyRound" :label="t('users.assignScopes')" @click="openAssignScopes" />
        <DhButton v-if="canRevokeScopes && directScopes.length > 0" :icon="Ban" :label="t('users.revokeScopes')" variant="secondary" @click="openRevokeScopes" />
      </div>
      <div class="grid gap-2">
        <div v-for="scope in directScopes" :key="scope.scopeId" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="font-black text-[var(--dh-text)]">{{ scope.scopeName }}</p>
          <p class="mt-1 text-xs font-bold text-[var(--dh-primary)]">{{ scope.scopeCode }}</p>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'permissions'" class="space-y-4">
      <div>
        <h4 class="mb-2 font-black text-[var(--dh-text)]">{{ t('users.effectiveScopes') }}</h4>
        <div class="grid gap-2">
          <div v-for="scope in permissions?.effectiveScopes ?? []" :key="scope.scopeId" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
            <p class="font-black text-[var(--dh-text)]">{{ scope.scopeName }}</p>
            <p class="text-xs font-bold text-[var(--dh-primary)]">{{ scope.scopeCode }}</p>
          </div>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'sessions' && canViewSessions" class="space-y-3">
      <div v-if="showSessionActions" class="flex justify-end gap-2">
        <DhButton v-if="canRefreshCurrentToken" :icon="RefreshCcw" :label="t('common.refreshSession')" variant="secondary" @click="refreshCurrentToken" />
        <DhButton v-if="canRevokeAllSessions" :icon="Ban" :label="t('common.revokeAll')" variant="danger" @click="openRevokeAllSessions" />
      </div>
      <div class="grid gap-2">
        <div v-for="session in sessions" :key="session.id" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="break-all text-xs font-black text-[var(--dh-text)]">{{ session.id }}</p>
              <p class="mt-1 truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ session.userAgent ?? '—' }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ session.ipAddress ?? '—' }} · {{ formatDate(session.createdAt) }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <DhBadge :label="session.isRevoked ? 'Revocada' : 'Activa'" :variant="session.isRevoked ? 'danger' : 'success'" />
              <button v-if="canRevokeSessions && !session.isRevoked" class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10" title="Revocar" @click="openRevokeSession(session)"><MonitorCheck class="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
