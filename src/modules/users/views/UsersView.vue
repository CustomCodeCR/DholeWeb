<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Pencil, Trash2, Users } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhCrudToolbar, DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useToastStore } from '@/core/stores/toastStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useAuthStore } from '@/core/stores/authStore'
import { AUTH_SCOPES } from '@/core/auth/scopes'
import { UsersService } from '@/core/services/usersService'
import type { UserDto } from '@/core/interfaces/users'
import UserFormDrawer from '@/modules/users/components/UserFormDrawer.vue'
import UserDetailDrawer from '@/modules/users/components/UserDetailDrawer.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'

const { t } = useI18n()
const toastStore = useToastStore()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const authStore = useAuthStore()

const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const users = ref<UserDto[]>([])

const canCreate = computed(() => authStore.hasScope(AUTH_SCOPES.users.create))
const canUpdate = computed(() => authStore.hasScope(AUTH_SCOPES.users.update))
const canDelete = computed(() => authStore.hasScope(AUTH_SCOPES.users.delete))
const showRowActions = computed(() => canUpdate.value || canDelete.value)

const columns = computed<DhTableColumn<UserDto>[]>(() => {
  const base: DhTableColumn<UserDto>[] = [
    { key: 'userName', label: t('users.userName') },
    { key: 'displayName', label: t('users.displayName') },
    { key: 'email', label: t('users.email') },
    { key: 'userType', label: t('users.type') },
    { key: 'isLocked', label: t('users.locked'), align: 'center' },
    { key: 'isActive', label: t('users.status'), align: 'center' },
  ]

  if (showRowActions.value) {
    base.push({ key: 'actions', label: '', align: 'right' })
  }

  return base
})

async function loadUsers() {
  try {
    loading.value = true
    const result = await UsersService.browsePaged({
      pageNumber: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
    })
    users.value = result.items
    total.value = result.totalCount ?? result.items.length
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los usuarios.')
  } finally {
    loading.value = false
  }
}

function openCreateDrawer() {
  if (!canCreate.value) return
  drawerStore.open({ title: t('users.new'), component: UserFormDrawer, size: 'lg', props: { onSaved: loadUsers } })
}

function openEditDrawer(user: UserDto) {
  if (!canUpdate.value) return
  drawerStore.open({ title: t('common.edit'), component: UserFormDrawer, size: 'lg', props: { user, onSaved: loadUsers } })
}

function openDetailDrawer(user: UserDto) {
  drawerStore.open({
    title: user.displayName || user.userName,
    component: UserDetailDrawer,
    size: 'xl',
    props: { user, onSaved: loadUsers },
  })
}

function confirmDelete(user: UserDto) {
  if (!canDelete.value) return

  modalStore.open({
    title: t('common.delete'),
    component: DhConfirmDialog,
    size: 'md',
    props: {
      title: t('common.delete'),
      message: `¿Eliminar ${user.displayName || user.userName}?`,
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
      onConfirm: async () => {
        await UsersService.delete(user.id)
        modalStore.close()
        toastStore.success('Usuario eliminado')
        await loadUsers()
      },
      onCancel: () => modalStore.close(),
    },
  })
}

watch([page, pageSize], loadUsers)

const handleCreateShortcut = () => {
  if (canCreate.value) openCreateDrawer()
}
const handleSaveShortcut = () => loadUsers()

onMounted(() => {
  loadUsers()
  window.addEventListener('dhole:create', handleCreateShortcut)
  window.addEventListener('dhole:save', handleSaveShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('dhole:create', handleCreateShortcut)
  window.removeEventListener('dhole:save', handleSaveShortcut)
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('users.title')" :subtitle="t('users.subtitle')" :icon="Users">
      <template v-if="canCreate" #actions><DhButton :label="t('users.new')" @click="openCreateDrawer" /></template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="search"
        :title="t('users.title')"
        :create-label="t('users.new')"
        :show-create="canCreate"
        @create="openCreateDrawer"
        @refresh="loadUsers"
        @filter="loadUsers"
        @search="loadUsers"
      />

      <div class="mt-5">
        <DhDataTable :columns="columns" :rows="users" :loading="loading" :empty-text="t('users.empty')" @row-click="openDetailDrawer">
          <template #cell-isLocked="{ value }"><div class="flex justify-center"><DhBadge :label="value ? t('common.yes') : t('common.no')" :variant="value ? 'danger' : 'neutral'" /></div></template>
          <template #cell-isActive="{ value }"><div class="flex justify-center"><DhBadge :label="value ? t('common.active') : t('common.inactive')" :variant="value ? 'success' : 'neutral'" /></div></template>
          <template v-if="showRowActions" #cell-actions="{ row }">
            <div class="flex justify-end gap-1">
              <button v-if="canUpdate" class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" title="Editar" @click.stop="openEditDrawer(row)"><Pencil class="h-4 w-4" /></button>
              <button v-if="canDelete" class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10" title="Eliminar" @click.stop="confirmDelete(row)"><Trash2 class="h-4 w-4" /></button>
            </div>
          </template>
        </DhDataTable>
      </div>

      <div class="mt-5"><DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" /></div>
    </section>
  </section>
</template>
