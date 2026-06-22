<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Ban, CheckCircle2, KeyRound, Shield, ShieldMinus, ShieldPlus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhTabs, type DhTabItem } from '@/shared/components/molecules'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { AUTH_SCOPES } from '@/core/auth/scopes'
import { RolesService } from '@/core/services/rolesService'
import { ScopesService } from '@/core/services/scopesService'
import type { RoleDto, RoleScopeDto } from '@/core/interfaces/roles'
import type { ScopeSelectDto } from '@/core/interfaces/scopes'
import AuthMultiSelectModal from '@/modules/auth/components/AuthMultiSelectModal.vue'

const props = defineProps<{ role: RoleDto; onSaved?: () => Promise<void> | void }>()
const { t } = useI18n()
const modalStore = useModalStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const localRole = ref<RoleDto>({ ...props.role })
const activeTab = ref('summary')
const loading = ref(false)
const roleScopes = ref<RoleScopeDto[]>([])
const availableScopes = ref<ScopeSelectDto[]>([])

const canSetActive = computed(() => authStore.hasScope(AUTH_SCOPES.roles.setActive))
const canViewScopes = computed(() => authStore.hasScope(AUTH_SCOPES.scopes.view))
const canAssignScopes = computed(() => authStore.hasScope(AUTH_SCOPES.roles.scopesAssign) && canViewScopes.value)
const canRevokeScopes = computed(() => authStore.hasScope(AUTH_SCOPES.roles.scopesRevoke))
const showRoleActions = computed(() => canSetActive.value)
const showScopeActions = computed(() => canAssignScopes.value || canRevokeScopes.value)

const tabs = computed<DhTabItem[]>(() => [
  { key: 'summary', label: 'Resumen' },
  { key: 'scopes', label: `${t('roles.assignedScopes')} (${roleScopes.value.length})` },
])

async function loadRelated() {
  loading.value = true
  try {
    const [assigned, scopes] = await Promise.all([
      RolesService.getScopes(localRole.value.id),
      canAssignScopes.value ? ScopesService.select() : Promise.resolve([]),
    ])
    roleScopes.value = assigned
    availableScopes.value = scopes
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los permisos del rol.')
  } finally {
    loading.value = false
  }
}

async function refreshParent() {
  await props.onSaved?.()
}

async function activate() {
  if (!canSetActive.value) return
  await RolesService.activate(localRole.value.id)
  localRole.value.isActive = true
  toastStore.success('Rol activado')
  await refreshParent()
}

async function inactivate() {
  if (!canSetActive.value) return
  await RolesService.inactivate(localRole.value.id)
  localRole.value.isActive = false
  toastStore.success('Rol inactivado')
  await refreshParent()
}

function openAssignScopes() {
  if (!canAssignScopes.value) return

  const selected = roleScopes.value.map((scope) => scope.scopeId)
  modalStore.open({
    title: t('roles.assignScopes'),
    component: AuthMultiSelectModal,
    size: 'lg',
    props: {
      title: t('roles.assignScopes'),
      description: 'Seleccione los scopes que desea agregar al rol.',
      items: availableScopes.value.map((scope) => ({ id: scope.id, label: scope.name, description: scope.code, badge: 'Scope' })),
      initiallySelectedIds: selected,
      confirmLabel: t('common.assign'),
      onConfirm: async (ids: string[]) => {
        const toAssign = ids.filter((id) => !selected.includes(id))
        if (toAssign.length > 0) await RolesService.assignScopes(localRole.value.id, { scopeIds: toAssign })
        toastStore.success('Scopes asignados al rol')
        await loadRelated()
        await refreshParent()
      },
    },
  })
}

function openRevokeScopes() {
  if (!canRevokeScopes.value || roleScopes.value.length === 0) return

  modalStore.open({
    title: t('roles.revokeScopes'),
    component: AuthMultiSelectModal,
    size: 'lg',
    props: {
      title: t('roles.revokeScopes'),
      description: 'Seleccione los scopes que desea quitar del rol.',
      items: roleScopes.value.map((scope) => ({ id: scope.scopeId, label: scope.scopeName, description: scope.scopeCode, badge: 'Scope' })),
      confirmLabel: t('common.revoke'),
      onConfirm: async (ids: string[]) => {
        if (ids.length > 0) await RolesService.revokeScopes(localRole.value.id, { scopeIds: ids })
        toastStore.success('Scopes revocados del rol')
        await loadRelated()
        await refreshParent()
      },
    },
  })
}

onMounted(loadRelated)
</script>

<template>
  <section class="space-y-5">
    <div class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-xl font-black text-[var(--dh-text)]">{{ localRole.name }}</h3>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ localRole.description ?? 'Sin descripción' }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <DhBadge :label="localRole.isSystemRole ? t('roles.system') : t('roles.custom')" variant="primary" />
            <DhBadge :label="localRole.isActive ? t('common.active') : t('common.inactive')" :variant="localRole.isActive ? 'success' : 'neutral'" />
          </div>
        </div>
        <Shield class="h-8 w-8 text-[var(--dh-primary)]" />
      </div>

      <div v-if="showRoleActions" class="mt-5 grid gap-2 md:grid-cols-2">
        <DhButton v-if="localRole.isActive" :icon="Ban" label="Inactivar" variant="secondary" @click="inactivate" />
        <DhButton v-else :icon="CheckCircle2" label="Activar" @click="activate" />
      </div>
    </div>

    <DhTabs v-model="activeTab" :items="tabs" />

    <div v-if="loading" class="rounded-[28px] border border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]">
      {{ t('common.loading') }}
    </div>

    <section v-else-if="activeTab === 'summary'" class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">ID</p>
      <p class="mt-2 break-all text-sm font-bold text-[var(--dh-text)]">{{ localRole.id }}</p>
    </section>

    <section v-else class="space-y-3">
      <div v-if="showScopeActions" class="flex justify-end gap-2">
        <DhButton v-if="canAssignScopes" :icon="ShieldPlus" :label="t('roles.assignScopes')" @click="openAssignScopes" />
        <DhButton v-if="canRevokeScopes && roleScopes.length > 0" :icon="ShieldMinus" :label="t('roles.revokeScopes')" variant="secondary" @click="openRevokeScopes" />
      </div>

      <div class="grid gap-2">
        <div v-for="scope in roleScopes" :key="scope.scopeId" class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex items-center gap-3">
            <KeyRound class="h-4 w-4 text-[var(--dh-primary)]" />
            <div>
              <p class="font-black text-[var(--dh-text)]">{{ scope.scopeName }}</p>
              <p class="text-xs font-bold text-[var(--dh-primary)]">{{ scope.scopeCode }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
