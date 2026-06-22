<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhPasswordInput, DhSelect, DhSwitch } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { AUTH_SCOPES } from '@/core/auth/scopes'
import { UsersService } from '@/core/services/usersService'
import { RolesService } from '@/core/services/rolesService'
import { ScopesService } from '@/core/services/scopesService'
import type { UserDto, UserRoleDto, UserScopeDto, UserType } from '@/core/interfaces/users'
import type { RoleSelectDto } from '@/core/interfaces/roles'
import type { ScopeSelectDto } from '@/core/interfaces/scopes'
import RoleQuickCreateModal from '@/modules/roles/components/RoleQuickCreateModal.vue'

const props = defineProps<{
  user?: UserDto
  onSaved?: () => Promise<void> | void
}>()

const { t } = useI18n()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const loading = ref(false)
const roles = ref<RoleSelectDto[]>([])
const scopes = ref<ScopeSelectDto[]>([])
const selectedRoleIds = ref<string[]>([])
const selectedScopeIds = ref<string[]>([])
const originalRoleIds = ref<string[]>([])
const originalScopeIds = ref<string[]>([])

const form = ref({
  userName: props.user?.userName ?? '',
  displayName: props.user?.displayName ?? '',
  email: props.user?.email ?? '',
  password: '',
  userType: (props.user?.userType ?? 'Internal') as UserType,
  isActive: props.user?.isActive ?? true,
  isLocked: props.user?.isLocked ?? false,
})

const isEdit = computed(() => Boolean(props.user))
const canCreateUser = computed(() => authStore.hasScope(AUTH_SCOPES.users.create))
const canUpdateUser = computed(() => authStore.hasScope(AUTH_SCOPES.users.update))
const canSetActive = computed(() => authStore.hasScope(AUTH_SCOPES.users.setActive))
const canSetLocked = computed(() => authStore.hasScope(AUTH_SCOPES.users.setLocked))
const canViewRoles = computed(() => authStore.hasScope(AUTH_SCOPES.roles.view))
const canViewScopes = computed(() => authStore.hasScope(AUTH_SCOPES.scopes.view))
const canCreateRole = computed(() => authStore.hasScope(AUTH_SCOPES.roles.create))
const canAssignRoles = computed(() => authStore.hasScope(AUTH_SCOPES.users.rolesAssign) && canViewRoles.value)
const canRevokeRoles = computed(() => authStore.hasScope(AUTH_SCOPES.users.rolesRevoke))
const canAssignScopes = computed(() => authStore.hasScope(AUTH_SCOPES.users.scopesAssign) && canViewScopes.value)
const canRevokeScopes = computed(() => authStore.hasScope(AUTH_SCOPES.users.scopesRevoke))
const canSaveCore = computed(() => (isEdit.value ? canUpdateUser.value : canCreateUser.value))
const canManageRoles = computed(() => canAssignRoles.value || canRevokeRoles.value)
const canManageScopes = computed(() => canAssignScopes.value || canRevokeScopes.value)
const showRoleSection = computed(() => canManageRoles.value && roles.value.length > 0)
const showScopeSection = computed(() => canManageScopes.value && scopes.value.length > 0)
const showStatusSection = computed(() => Boolean(props.user) && (canSetActive.value || canSetLocked.value))

function diffAdded(current: string[], original: string[]): string[] {
  return current.filter((id) => !original.includes(id))
}

function diffRemoved(current: string[], original: string[]): string[] {
  return original.filter((id) => !current.includes(id))
}

function mergeRoleOptions(existing: RoleSelectDto[], assigned: UserRoleDto[]): RoleSelectDto[] {
  const map = new Map(existing.map((role) => [role.id, role]))
  assigned.forEach((role) => {
    if (!map.has(role.roleId)) {
      map.set(role.roleId, { id: role.roleId, name: role.roleName })
    }
  })
  return [...map.values()]
}

function mergeScopeOptions(existing: ScopeSelectDto[], assigned: UserScopeDto[]): ScopeSelectDto[] {
  const map = new Map(existing.map((scope) => [scope.id, scope]))
  assigned.forEach((scope) => {
    if (!map.has(scope.scopeId)) {
      map.set(scope.scopeId, { id: scope.scopeId, code: scope.scopeCode, name: scope.scopeName })
    }
  })
  return [...map.values()]
}

async function loadAccessData() {
  try {
    const [roleOptions, scopeOptions, userRoles, userScopes] = await Promise.all([
      canAssignRoles.value ? RolesService.select() : Promise.resolve([]),
      canAssignScopes.value ? ScopesService.select() : Promise.resolve([]),
      props.user && canManageRoles.value ? UsersService.getRoles(props.user.id) : Promise.resolve([]),
      props.user && canManageScopes.value ? UsersService.getScopes(props.user.id) : Promise.resolve([]),
    ])

    originalRoleIds.value = userRoles.map((x) => x.roleId)
    originalScopeIds.value = userScopes.map((x) => x.scopeId)
    selectedRoleIds.value = [...originalRoleIds.value]
    selectedScopeIds.value = [...originalScopeIds.value]
    roles.value = mergeRoleOptions(roleOptions, userRoles)
    scopes.value = mergeScopeOptions(scopeOptions, userScopes)
  } catch (error) {
    toastStore.backendWarning(error, 'No se pudieron cargar roles o permisos.')
  }
}

function openCreateRoleModal() {
  if (!canCreateRole.value) return

  modalStore.open({
    title: t('roles.new'),
    component: RoleQuickCreateModal,
    size: 'md',
    props: {
      onSaved: async () => {
        await loadAccessData()
      },
    },
  })
}

async function syncUserRoles(userId: string) {
  const added = diffAdded(selectedRoleIds.value, originalRoleIds.value)
  const removed = diffRemoved(selectedRoleIds.value, originalRoleIds.value)

  if (canAssignRoles.value && added.length > 0) await UsersService.assignRoles(userId, { roleIds: added })
  if (canRevokeRoles.value && removed.length > 0) await UsersService.revokeRoles(userId, { roleIds: removed })
}

async function syncUserScopes(userId: string) {
  const added = diffAdded(selectedScopeIds.value, originalScopeIds.value)
  const removed = diffRemoved(selectedScopeIds.value, originalScopeIds.value)

  if (canAssignScopes.value && added.length > 0) await UsersService.assignScopes(userId, { scopeIds: added })
  if (canRevokeScopes.value && removed.length > 0) await UsersService.revokeScopes(userId, { scopeIds: removed })
}

async function save() {
  if (!canSaveCore.value) {
    toastStore.warning('Sin permiso', 'No tiene permiso para guardar este usuario.')
    return
  }

  try {
    loading.value = true

    if (props.user) {
      await UsersService.update(props.user.id, {
        userName: form.value.userName,
        displayName: form.value.displayName,
        email: form.value.email,
      })

      if (canSetActive.value && form.value.isActive !== props.user.isActive) {
        await UsersService.setActive(props.user.id, { isActive: form.value.isActive })
      }

      if (canSetLocked.value && form.value.isLocked !== props.user.isLocked) {
        await UsersService.setLocked(props.user.id, { isLocked: form.value.isLocked })
      }

      await syncUserRoles(props.user.id)
      await syncUserScopes(props.user.id)
    } else {
      const userId = await UsersService.create({
        userName: form.value.userName,
        displayName: form.value.displayName,
        email: form.value.email,
        password: form.value.password,
        userType: form.value.userType,
      })

      if (canAssignRoles.value && selectedRoleIds.value.length > 0) {
        await UsersService.assignRoles(userId, { roleIds: selectedRoleIds.value })
      }

      if (canAssignScopes.value && selectedScopeIds.value.length > 0) {
        await UsersService.assignScopes(userId, { scopeIds: selectedScopeIds.value })
      }
    }

    toastStore.success('Guardado', 'Usuario guardado correctamente.')
    await props.onSaved?.()
    drawerStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el usuario.')
  } finally {
    loading.value = false
  }
}

onMounted(loadAccessData)
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="form.userName" :label="t('users.userName')" placeholder="mlopez" :disabled="!canSaveCore" />
      <DhInput
        v-model="form.displayName"
        :label="t('users.displayName')"
        placeholder="Maurice López"
        :disabled="!canSaveCore"
      />
      <DhInput
        v-model="form.email"
        :label="t('users.email')"
        placeholder="usuario@empresa.com"
        type="email"
        :disabled="!canSaveCore"
      />

      <DhSelect
        v-model="form.userType"
        :label="t('users.type')"
        :disabled="Boolean(user) || !canSaveCore"
        :options="[
          { label: 'Internal', value: 'Internal' },
          { label: 'External', value: 'External' },
        ]"
      />

      <DhPasswordInput v-if="!user" v-model="form.password" :label="t('users.password')" />
    </div>

    <section
      v-if="showRoleSection"
      class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]"
    >
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-black text-[var(--dh-text)]">{{ t('users.roles') }}</h3>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            Solo se muestran las acciones permitidas por sus scopes.
          </p>
        </div>

        <DhButton
          v-if="canCreateRole"
          :icon="Plus"
          :label="t('roles.new')"
          variant="secondary"
          size="sm"
          @click="openCreateRoleModal"
        />
      </div>

      <div class="grid gap-2 md:grid-cols-2">
        <label
          v-for="role in roles"
          :key="role.id"
          class="flex items-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-bold"
        >
          <input
            v-model="selectedRoleIds"
            type="checkbox"
            :value="role.id"
            :disabled="(!originalRoleIds.includes(role.id) && !canAssignRoles) || (originalRoleIds.includes(role.id) && !canRevokeRoles && isEdit)"
            class="accent-[var(--dh-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          />
          {{ role.name }}
        </label>
      </div>
    </section>

    <section
      v-if="showScopeSection"
      class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]"
    >
      <div class="mb-3">
        <h3 class="text-sm font-black text-[var(--dh-text)]">{{ t('users.directScopes') }}</h3>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
          Solo se puede asignar o revocar según los scopes del usuario actual.
        </p>
      </div>

      <div class="grid gap-2 md:grid-cols-2">
        <label
          v-for="scope in scopes"
          :key="scope.id"
          class="flex items-start gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-bold"
        >
          <input
            v-model="selectedScopeIds"
            type="checkbox"
            :value="scope.id"
            :disabled="(!originalScopeIds.includes(scope.id) && !canAssignScopes) || (originalScopeIds.includes(scope.id) && !canRevokeScopes && isEdit)"
            class="mt-1 accent-[var(--dh-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          />
          <span>
            <span class="block text-[var(--dh-text)]">{{ scope.code }}</span>
            <span class="block text-xs text-[var(--dh-text-muted)]">{{ scope.name }}</span>
          </span>
        </label>
      </div>
    </section>

    <div v-if="showStatusSection" class="grid gap-4 md:grid-cols-2">
      <DhSwitch v-if="canSetActive" v-model="form.isActive" :label="t('common.active')" />
      <DhSwitch v-if="canSetLocked" v-model="form.isLocked" :label="t('users.locked')" />
    </div>

    <div class="flex justify-end gap-2">
      <DhButton :label="t('common.cancel')" variant="secondary" @click="drawerStore.close()" />
      <DhButton type="submit" :label="t('common.save')" :loading="loading" :disabled="!canSaveCore" />
    </div>
  </form>
</template>
