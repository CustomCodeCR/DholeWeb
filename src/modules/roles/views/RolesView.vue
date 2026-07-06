<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Pencil, Shield, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhCrudToolbar, DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { RolesService } from '@/core/services/rolesService'
import type { RoleDto } from '@/core/interfaces/roles'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { AUTH_SCOPES } from '@/core/auth/scopes'
import RoleFormDrawer from '@/modules/roles/components/RoleFormDrawer.vue'
import RoleDetailDrawer from '@/modules/roles/components/RoleDetailDrawer.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

const { t } = useI18n()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const roles = ref<RoleDto[]>([])

const canCreate = computed(() => authStore.hasScope(AUTH_SCOPES.roles.create))
const canUpdate = computed(() => authStore.hasScope(AUTH_SCOPES.roles.update))
const canDelete = computed(() => authStore.hasScope(AUTH_SCOPES.roles.delete))
const showRowActions = computed(() => canUpdate.value || canDelete.value)

const columns = computed<DhTableColumn<RoleDto>[]>(() => {
  const base: DhTableColumn<RoleDto>[] = [
    { key: 'name', label: t('common.name') },
    { key: 'description', label: t('common.description') },
    { key: 'isSystemRole', label: t('roles.systemRole'), align: 'center' },
    { key: 'isActive', label: t('common.status'), align: 'center' },
  ]

  if (showRowActions.value) {
    base.push({ key: 'actions', label: '', align: 'right' })
  }

  return base
})

async function loadRoles() {
  try {
    loading.value = true
    const result = await RolesService.browsePaged({ pageNumber: page.value, pageSize: pageSize.value, search: search.value || undefined })
    roles.value = result.items
    total.value = result.totalCount ?? result.items.length
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los roles.')
  } finally {
    loading.value = false
  }
}

function createRole() {
  if (!canCreate.value) return
  drawerStore.open({ title: t('roles.new'), component: RoleFormDrawer, size: 'lg', props: { onSaved: loadRoles } })
}

function editRole(role: RoleDto) {
  if (!canUpdate.value) return
  drawerStore.open({ title: t('common.edit'), component: RoleFormDrawer, size: 'lg', props: { role, onSaved: loadRoles } })
}

function detailRole(role: RoleDto) {
  drawerStore.open({ title: role.name, component: RoleDetailDrawer, size: 'xl', props: { role, onSaved: loadRoles } })
}

function confirmDelete(role: RoleDto) {
  if (!canDelete.value || role.isSystemRole) return

  modalStore.open({
    title: t('common.delete'),
    component: DhConfirmDialog,
    size: 'md',
    props: {
      title: t('common.delete'),
      message: `¿Eliminar ${role.name}?`,
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
      onConfirm: async () => {
        await RolesService.delete(role.id)
        modalStore.close()
        toastStore.success('Rol eliminado')
        await loadRoles()
      },
      onCancel: () => modalStore.close(),
    },
  })
}

watch([page, pageSize], loadRoles)

useViewShortcuts({
  create: () => {
    if (canCreate.value) createRole()
  },
  save: loadRoles,
  refresh: loadRoles,
})

onMounted(loadRoles)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('roles.title')" :subtitle="t('roles.subtitle')" :icon="Shield">
      <template v-if="canCreate" #actions><DhButton :label="t('roles.new')" @click="createRole" /></template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="search"
        :title="t('roles.title')"
        :create-label="t('roles.new')"
        :show-create="canCreate"
        @create="createRole"
        @refresh="loadRoles"
        @filter="loadRoles"
        @search="loadRoles"
      />

      <div class="mt-5">
        <DhDataTable :columns="columns" :rows="roles" :loading="loading" :empty-text="t('roles.empty')" @row-click="detailRole">
          <template #cell-isSystemRole="{ value }"><div class="flex justify-center"><DhBadge :label="value ? t('common.yes') : t('common.no')" :variant="value ? 'primary' : 'neutral'" /></div></template>
          <template #cell-isActive="{ value }"><div class="flex justify-center"><DhBadge :label="value ? t('common.active') : t('common.inactive')" :variant="value ? 'success' : 'neutral'" /></div></template>
          <template v-if="showRowActions" #cell-actions="{ row }">
            <div class="flex justify-end gap-1">
              <button v-if="canUpdate" class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" title="Editar" @click.stop="editRole(row)"><Pencil class="h-4 w-4" /></button>
              <button v-if="canDelete && !row.isSystemRole" class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10" title="Eliminar" @click.stop="confirmDelete(row)"><Trash2 class="h-4 w-4" /></button>
            </div>
          </template>
        </DhDataTable>
      </div>

      <div class="mt-5"><DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" /></div>
    </section>
  </section>
</template>
