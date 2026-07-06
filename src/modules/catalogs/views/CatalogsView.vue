<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BookOpen, Pencil, Trash2 } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import {
  DhCrudToolbar,
  DhDataTable,
  DhPagination,
  type DhTableColumn,
} from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useToastStore } from '@/core/stores/toastStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useAuthStore } from '@/core/stores/authStore'
import { CONFIG_SCOPES } from '@/core/auth/scopes'
import { CatalogGroupsService } from '@/core/services/catalogGroupsService'
import type { CatalogGroupDto } from '@/core/interfaces/catalogs'
import CatalogGroupFormDrawer from '@/modules/catalogs/components/CatalogGroupFormDrawer.vue'
import CatalogGroupDetailDrawer from '@/modules/catalogs/components/CatalogGroupDetailDrawer.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

const toastStore = useToastStore()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const authStore = useAuthStore()

const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const groups = ref<CatalogGroupDto[]>([])

const canCreate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.create))
const canUpdate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.update))
const canDelete = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.delete))
const showRowActions = computed(() => canUpdate.value || canDelete.value)

const columns = computed<DhTableColumn<CatalogGroupDto>[]>(() => {
  const base: DhTableColumn<CatalogGroupDto>[] = [
    { key: 'name', label: 'Catálogo' },
    { key: 'slug', label: 'Slug' },
    { key: 'code', label: 'Código' },
    { key: 'isSystem', label: 'Tipo', align: 'center' },
    { key: 'isActive', label: 'Estado', align: 'center' },
  ]

  if (showRowActions.value) {
    base.push({ key: 'actions', label: '', align: 'right' })
  }

  return base
})

async function loadCatalogGroups() {
  try {
    loading.value = true

    const result = await CatalogGroupsService.browsePaged({
      pageNumber: page.value,
      pageSize: pageSize.value,
      search: search.value || undefined,
    })

    groups.value = result.items
    total.value = result.totalCount ?? result.items.length
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los catálogos.')
  } finally {
    loading.value = false
  }
}

function openCreateDrawer() {
  if (!canCreate.value) return

  drawerStore.open({
    title: 'Nuevo catálogo',
    component: CatalogGroupFormDrawer,
    size: 'lg',
    props: {
      onSaved: loadCatalogGroups,
    },
  })
}

function openEditDrawer(group: CatalogGroupDto) {
  if (!canUpdate.value) return

  drawerStore.open({
    title: 'Editar catálogo',
    component: CatalogGroupFormDrawer,
    size: 'lg',
    props: {
      group,
      onSaved: loadCatalogGroups,
    },
  })
}

function openDetailDrawer(group: CatalogGroupDto) {
  drawerStore.open({
    title: group.name,
    component: CatalogGroupDetailDrawer,
    size: 'xl',
    props: {
      group,
      onSaved: loadCatalogGroups,
    },
  })
}

function confirmDelete(group: CatalogGroupDto) {
  if (!canDelete.value) return

  modalStore.open({
    title: 'Eliminar catálogo',
    component: DhConfirmDialog,
    size: 'md',
    props: {
      title: 'Eliminar catálogo',
      message: `¿Eliminar ${group.name}?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        await CatalogGroupsService.delete(group.id)
        modalStore.close()
        toastStore.success('Catálogo eliminado')
        await loadCatalogGroups()
      },
      onCancel: () => modalStore.close(),
    },
  })
}

watch([page, pageSize], loadCatalogGroups)

useViewShortcuts({
  create: () => {
    if (canCreate.value) openCreateDrawer()
  },
  save: loadCatalogGroups,
  refresh: loadCatalogGroups,
})

onMounted(loadCatalogGroups)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Catálogos"
      subtitle="Administre catálogos y sus items desde una sola vista."
      :icon="BookOpen"
    >
      <template v-if="canCreate" #actions>
        <DhButton label="Nuevo catálogo" @click="openCreateDrawer" />
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="search"
        title="Catálogos"
        create-label="Nuevo catálogo"
        :show-create="canCreate"
        @create="openCreateDrawer"
        @refresh="loadCatalogGroups"
        @filter="loadCatalogGroups"
        @search="loadCatalogGroups"
      />

      <div class="mt-5">
        <DhDataTable
          :columns="columns"
          :rows="groups"
          :loading="loading"
          empty-text="No hay catálogos registrados."
          @row-click="openDetailDrawer"
        >
          <template #cell-slug="{ value }">
            <span
              class="rounded-full bg-[var(--dh-primary-soft)] px-3 py-1 text-xs font-black text-[var(--dh-primary)]"
            >
              {{ value }}
            </span>
          </template>

          <template #cell-isSystem="{ value }">
            <div class="flex justify-center">
              <DhBadge
                :label="value ? 'Sistema' : 'Administrable'"
                :variant="value ? 'primary' : 'neutral'"
              />
            </div>
          </template>

          <template #cell-isActive="{ value }">
            <div class="flex justify-center">
              <DhBadge
                :label="value ? 'Activo' : 'Inactivo'"
                :variant="value ? 'success' : 'neutral'"
              />
            </div>
          </template>

          <template v-if="showRowActions" #cell-actions="{ row }">
            <div class="flex justify-end gap-1">
              <button
                v-if="canUpdate"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                title="Editar"
                @click.stop="openEditDrawer(row)"
              >
                <Pencil class="h-4 w-4" />
              </button>

              <button
                v-if="canDelete"
                class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10"
                title="Eliminar"
                @click.stop="confirmDelete(row)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </template>
        </DhDataTable>
      </div>

      <div class="mt-5">
        <DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </section>
  </section>
</template>
