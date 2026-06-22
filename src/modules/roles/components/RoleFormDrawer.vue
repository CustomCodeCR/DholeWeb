<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhTextarea, DhSwitch } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { AUTH_SCOPES } from '@/core/auth/scopes'
import { RolesService } from '@/core/services/rolesService'
import { ScopesService } from '@/core/services/scopesService'
import type { RoleDto } from '@/core/interfaces/roles'
import type { ScopeSelectDto } from '@/core/interfaces/scopes'

const props = defineProps<{
  role?: RoleDto
  onSaved?: () => Promise<void> | void
}>()

const { t } = useI18n()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const loading = ref(false)
const scopes = ref<ScopeSelectDto[]>([])
const selectedScopeIds = ref<string[]>([])
const originalScopeIds = ref<string[]>([])

const form = ref({
  name: props.role?.name ?? '',
  description: props.role?.description ?? '',
  isActive: props.role?.isActive ?? true,
})

const isEdit = computed(() => Boolean(props.role))
const canCreate = computed(() => authStore.hasScope(AUTH_SCOPES.roles.create))
const canUpdate = computed(() => authStore.hasScope(AUTH_SCOPES.roles.update))
const canSetActive = computed(() => authStore.hasScope(AUTH_SCOPES.roles.setActive))
const canViewScopes = computed(() => authStore.hasScope(AUTH_SCOPES.scopes.view))
const canAssignScopes = computed(() => authStore.hasScope(AUTH_SCOPES.roles.scopesAssign) && canViewScopes.value)
const canRevokeScopes = computed(() => authStore.hasScope(AUTH_SCOPES.roles.scopesRevoke))
const canManageScopes = computed(() => canAssignScopes.value || canRevokeScopes.value)
const canSaveRole = computed(() => (isEdit.value ? canUpdate.value : canCreate.value))
const showScopeSection = computed(() => canManageScopes.value && scopes.value.length > 0)

function diffAdded(current: string[], original: string[]): string[] {
  return current.filter((id) => !original.includes(id))
}

function diffRemoved(current: string[], original: string[]): string[] {
  return original.filter((id) => !current.includes(id))
}

async function loadScopes() {
  try {
    if (!canManageScopes.value) return

    if (canAssignScopes.value) {
      scopes.value = await ScopesService.select()
    }

    if (!props.role) return

    const currentScopes = await RolesService.getScopes(props.role.id)
    originalScopeIds.value = currentScopes.map((x) => x.scopeId)
    selectedScopeIds.value = [...originalScopeIds.value]

    if (!canAssignScopes.value) {
      scopes.value = currentScopes.map((scope) => ({
        id: scope.scopeId,
        code: scope.scopeCode,
        name: scope.scopeName,
      }))
    }
  } catch (error) {
    scopes.value = []
    toastStore.backendWarning(error, 'No se pudieron cargar los permisos del rol.')
  }
}

async function syncRoleScopes(roleId: string) {
  const added = diffAdded(selectedScopeIds.value, originalScopeIds.value)
  const removed = diffRemoved(selectedScopeIds.value, originalScopeIds.value)

  if (canAssignScopes.value && added.length > 0) await RolesService.assignScopes(roleId, { scopeIds: added })
  if (canRevokeScopes.value && removed.length > 0) await RolesService.revokeScopes(roleId, { scopeIds: removed })
}

async function save() {
  if (!canSaveRole.value) {
    toastStore.warning('Sin permiso', 'No tiene permiso para guardar este rol.')
    return
  }

  try {
    loading.value = true

    if (props.role) {
      await RolesService.update(props.role.id, {
        name: form.value.name,
        description: form.value.description || null,
      })

      if (canSetActive.value && form.value.isActive !== props.role.isActive) {
        await RolesService.setActive(props.role.id, { isActive: form.value.isActive })
      }

      await syncRoleScopes(props.role.id)
    } else {
      const id = await RolesService.create({
        name: form.value.name,
        description: form.value.description || null,
        isSystemRole: false,
      })

      if (canAssignScopes.value && selectedScopeIds.value.length > 0) {
        await RolesService.assignScopes(id, { scopeIds: selectedScopeIds.value })
      }
    }

    toastStore.success('Guardado', 'Rol guardado correctamente.')
    await props.onSaved?.()
    drawerStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el rol.')
  } finally {
    loading.value = false
  }
}

onMounted(loadScopes)
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <DhInput v-model="form.name" :label="t('common.name')" :disabled="!canSaveRole" />
    <DhTextarea v-model="form.description" :label="t('common.description')" :disabled="!canSaveRole" />
    <DhSwitch v-if="role && canSetActive" v-model="form.isActive" :label="t('common.active')" />

    <section v-if="showScopeSection" class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]">
      <h3 class="mb-3 text-sm font-black text-[var(--dh-text)]">{{ t('roles.scopes') }}</h3>

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

    <div class="flex justify-end gap-2">
      <DhButton :label="t('common.cancel')" variant="secondary" @click="drawerStore.close()" />
      <DhButton type="submit" :label="t('common.save')" :loading="loading" :disabled="!canSaveRole" />
    </div>
  </form>
</template>
