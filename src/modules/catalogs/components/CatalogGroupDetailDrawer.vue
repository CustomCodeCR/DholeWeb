<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Ban,
  CheckCircle2,
  GripVertical,
  PackagePlus,
  Pencil,
  RefreshCcw,
  Tag,
  Trash2,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { CONFIG_SCOPES } from '@/core/auth/scopes'
import { CatalogGroupsService } from '@/core/services/catalogGroupsService'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type {
  CatalogGroupDetailDto,
  CatalogGroupDto,
  CatalogItemDto,
} from '@/core/interfaces/catalogs'
import CatalogGroupFormDrawer from '@/modules/catalogs/components/CatalogGroupFormDrawer.vue'
import CatalogItemFormDrawer from '@/modules/catalogs/components/CatalogItemFormDrawer.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'

const props = defineProps<{
  group: CatalogGroupDto
  onSaved?: () => Promise<void> | void
}>()

const { t } = useI18n()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const authStore = useAuthStore()

const loading = ref(false)
const savingOrder = ref(false)
const detail = ref<CatalogGroupDetailDto | null>(null)
const items = ref<CatalogItemDto[]>([])
const draggingIndex = ref<number | null>(null)

const localGroup = computed<CatalogGroupDto>(() => detail.value ?? props.group)

const canUpdateGroup = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.update))
const canDeleteGroup = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.delete))
const canSetGroupActive = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.setActive))

const canCreateItem = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.create))
const canUpdateItem = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.update))
const canDeleteItem = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.delete))
const canSetItemActive = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.setActive))
const canChangeItemOrder = computed(() =>
  authStore.hasScope(CONFIG_SCOPES.catalogItems.changeSortOrder),
)

const showGroupActions = computed(
  () => canUpdateGroup.value || canDeleteGroup.value || canSetGroupActive.value,
)

const showItemActions = computed(
  () => canUpdateItem.value || canDeleteItem.value || canSetItemActive.value,
)

function formatMetadata(metadataJson?: string | null): { key: string; value: string }[] {
  if (!metadataJson) return []

  try {
    const parsed = JSON.parse(metadataJson) as Record<string, unknown>

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return []

    return Object.entries(parsed).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }))
  } catch {
    return []
  }
}

function sortItems(values: CatalogItemDto[]): CatalogItemDto[] {
  return [...values].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

async function loadDetail() {
  try {
    loading.value = true

    const groupResult = await CatalogGroupsService.getById(props.group.id)
    detail.value = groupResult

    const groupSlug = groupResult.slug || props.group.slug

    if (!groupSlug) {
      items.value = []
      return
    }

    const itemResult = await CatalogItemsService.getByGroupSlug(groupSlug)
    items.value = sortItems(itemResult)
  } catch (error) {
    toastStore.backendError(error, t('catalogs.detailLoadError'))
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  await loadDetail()
  await props.onSaved?.()
}

function openEditGroup() {
  if (!canUpdateGroup.value) return

  drawerStore.open({
    title: t('catalogs.edit'),
    component: CatalogGroupFormDrawer,
    size: 'lg',
    props: {
      group: localGroup.value,
      onSaved: refreshAll,
    },
  })
}

async function setGroupActive(isActive: boolean) {
  if (!canSetGroupActive.value) return

  try {
    await CatalogGroupsService.setActive(localGroup.value.id, { isActive })
    toastStore.success(isActive ? t('catalogs.catalogActivated') : t('catalogs.catalogInactivated'))
    await refreshAll()
  } catch (error) {
    toastStore.backendError(error, t('catalogs.changeStatusError'))
  }
}

function confirmDeleteGroup() {
  if (!canDeleteGroup.value) return

  modalStore.open({
    title: t('catalogs.delete'),
    component: DhConfirmDialog,
    size: 'md',
    props: {
      title: t('catalogs.delete'),
      message: t('catalogs.deleteConfirm', { name: localGroup.value.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
      onConfirm: async () => {
        await CatalogGroupsService.delete(localGroup.value.id)
        modalStore.close()
        drawerStore.close()
        toastStore.success(t('catalogs.catalogDeleted'))
        await props.onSaved?.()
      },
      onCancel: () => modalStore.close(),
    },
  })
}

function openCreateItem() {
  if (!canCreateItem.value) return

  const maxSortOrder = items.value.reduce((max, item) => Math.max(max, item.sortOrder), 0)

  drawerStore.open({
    title: t('catalogs.newItem'),
    component: CatalogItemFormDrawer,
    size: 'lg',
    props: {
      group: localGroup.value,
      nextSortOrder: maxSortOrder + 1,
      onSaved: refreshAll,
    },
  })
}

function openEditItem(item: CatalogItemDto) {
  if (!canUpdateItem.value) return

  drawerStore.open({
    title: t('catalogs.editItem'),
    component: CatalogItemFormDrawer,
    size: 'lg',
    props: {
      group: localGroup.value,
      item,
      onSaved: refreshAll,
    },
  })
}

async function setItemActive(item: CatalogItemDto, isActive: boolean) {
  if (!canSetItemActive.value) return

  try {
    await CatalogItemsService.setActive(item.id, { isActive })
    toastStore.success(isActive ? t('catalogs.itemActivated') : t('catalogs.itemInactivated'))
    await refreshAll()
  } catch (error) {
    toastStore.backendError(error, t('catalogs.changeStatusError'))
  }
}

function confirmDeleteItem(item: CatalogItemDto) {
  if (!canDeleteItem.value) return

  modalStore.open({
    title: t('catalogs.deleteItem'),
    component: DhConfirmDialog,
    size: 'md',
    props: {
      title: t('catalogs.deleteItem'),
      message: t('catalogs.deleteItemConfirm', { name: item.name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      danger: true,
      onConfirm: async () => {
        await CatalogItemsService.delete(item.id)
        modalStore.close()
        toastStore.success(t('catalogs.itemDeleted'))
        await refreshAll()
      },
      onCancel: () => modalStore.close(),
    },
  })
}

function onDragStart(index: number) {
  if (!canChangeItemOrder.value) return
  draggingIndex.value = index
}

async function onDrop(dropIndex: number) {
  if (!canChangeItemOrder.value || draggingIndex.value === null) return

  const fromIndex = draggingIndex.value
  draggingIndex.value = null

  if (fromIndex === dropIndex) return

  const nextItems = [...items.value]
  const [moved] = nextItems.splice(fromIndex, 1)

  if (!moved) return

  nextItems.splice(dropIndex, 0, moved)

  items.value = nextItems.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }))

  await saveOrder()
}

async function saveOrder() {
  if (!canChangeItemOrder.value) return

  try {
    savingOrder.value = true

    for (const item of items.value) {
      await CatalogItemsService.changeSortOrder(item.id, {
        sortOrder: item.sortOrder,
      })
    }

    toastStore.success(t('catalogs.orderUpdated'))
    await refreshAll()
  } catch (error) {
    toastStore.backendError(error, t('catalogs.orderError'))
    await loadDetail()
  } finally {
    savingOrder.value = false
  }
}

onMounted(loadDetail)
</script>

<template>
  <section class="space-y-5">
    <div class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <Tag class="h-5 w-5 text-[var(--dh-primary)]" />
            <h3 class="truncate text-xl font-black text-[var(--dh-text)]">
              {{ localGroup.name }}
            </h3>
          </div>

          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ localGroup.description || t('catalogs.withoutDescription') }}
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <DhBadge :label="localGroup.code" variant="neutral" />
            <DhBadge :label="localGroup.slug" variant="primary" />
            <DhBadge
              :label="localGroup.isSystem ? t('common.system') : t('common.administrable')"
              :variant="localGroup.isSystem ? 'primary' : 'neutral'"
            />
            <DhBadge
              :label="localGroup.isActive ? t('common.active') : t('common.inactive')"
              :variant="localGroup.isActive ? 'success' : 'neutral'"
            />
          </div>
        </div>
      </div>

      <div v-if="showGroupActions" class="mt-5 grid gap-2 md:grid-cols-4">
        <DhButton
          v-if="canUpdateGroup"
          :icon="Pencil"
          :label="t('common.edit')"
          variant="secondary"
          @click="openEditGroup"
        />

        <DhButton
          v-if="canSetGroupActive && localGroup.isActive"
          :icon="Ban"
          :label="t('common.inactivate')"
          variant="secondary"
          @click="setGroupActive(false)"
        />

        <DhButton
          v-else-if="canSetGroupActive"
          :icon="CheckCircle2"
          :label="t('common.activate')"
          @click="setGroupActive(true)"
        />

        <DhButton
          v-if="canDeleteGroup"
          :icon="Trash2"
          :label="t('common.delete')"
          variant="danger"
          @click="confirmDeleteGroup"
        />
      </div>
    </div>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h4 class="text-sm font-black text-[var(--dh-text)]">
            {{ t('catalogs.catalogMetadata') }}
          </h4>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ t('catalogs.metadataDisplayHint') }}
          </p>
        </div>
      </div>

      <div
        v-if="formatMetadata(localGroup.metadataJson).length === 0"
        class="text-sm font-bold text-[var(--dh-text-muted)]"
      >
        {{ t('catalogs.withoutMetadata') }}
      </div>

      <div v-else class="grid gap-2 md:grid-cols-2">
        <div
          v-for="field in formatMetadata(localGroup.metadataJson)"
          :key="field.key"
          class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3"
        >
          <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
            {{ field.key }}
          </p>
          <p class="mt-1 break-all text-sm font-bold text-[var(--dh-text)]">
            {{ field.value }}
          </p>
        </div>
      </div>
    </section>

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 class="text-lg font-black text-[var(--dh-text)]">
            {{ t('catalogs.itemsTitle') }}
          </h4>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ t('catalogs.itemsSubtitle') }}
          </p>
        </div>

        <div class="flex gap-2">
          <DhButton
            :icon="RefreshCcw"
            :label="t('common.refresh')"
            variant="secondary"
            :loading="loading"
            @click="loadDetail"
          />

          <DhButton
            v-if="canCreateItem"
            :icon="PackagePlus"
            :label="t('catalogs.newItem')"
            @click="openCreateItem"
          />
        </div>
      </div>

      <div
        v-if="loading"
        class="rounded-[24px] border border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]"
      >
        {{ t('common.loading') }}
      </div>

      <div
        v-else-if="items.length === 0"
        class="rounded-[24px] border border-dashed border-[var(--dh-border)] p-8 text-center"
      >
        <p class="text-sm font-black text-[var(--dh-text)]">
          {{ t('catalogs.emptyItems') }}
        </p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ t('catalogs.emptyItemsHint') }}
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          :draggable="canChangeItemOrder"
          class="group rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--dh-shadow-sm)]"
          :class="{ 'cursor-grab active:cursor-grabbing': canChangeItemOrder }"
          @dragstart="onDragStart(index)"
          @dragover.prevent
          @drop="onDrop(index)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 gap-3">
              <div
                class="mt-1 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2 text-[var(--dh-text-muted)]"
                :class="{ 'opacity-40': !canChangeItemOrder }"
                :title="t('catalogs.dragToSort')"
              >
                <GripVertical class="h-4 w-4" />
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-sm font-black text-[var(--dh-text)]">
                    {{ item.name }}
                  </p>

                  <DhBadge :label="`#${item.sortOrder}`" variant="neutral" />

                  <DhBadge
                    :label="item.isActive ? t('common.active') : t('common.inactive')"
                    :variant="item.isActive ? 'success' : 'neutral'"
                  />

                  <DhBadge v-if="item.isSystem" :label="t('common.system')" variant="primary" />
                </div>

                <p class="mt-1 text-xs font-bold text-[var(--dh-primary)]">
                  {{ item.slug }}
                </p>

                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ item.description || t('catalogs.withoutDescription') }}
                </p>

                <div class="mt-2 flex flex-wrap gap-2">
                  <span
                    class="rounded-full bg-[var(--dh-card)] px-3 py-1 text-xs font-black text-[var(--dh-text)]"
                  >
                    {{ t('common.code') }}: {{ item.code }}
                  </span>

                  <span
                    class="rounded-full bg-[var(--dh-card)] px-3 py-1 text-xs font-black text-[var(--dh-text)]"
                  >
                    {{ t('common.value') }}: {{ item.value || '—' }}
                  </span>
                </div>

                <div
                  v-if="formatMetadata(item.metadataJson).length > 0"
                  class="mt-3 grid gap-2 md:grid-cols-2"
                >
                  <div
                    v-for="field in formatMetadata(item.metadataJson)"
                    :key="field.key"
                    class="rounded-[16px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-2"
                  >
                    <p
                      class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]"
                    >
                      {{ field.key }}
                    </p>
                    <p class="mt-1 break-all text-xs font-bold text-[var(--dh-text)]">
                      {{ field.value }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="showItemActions" class="flex shrink-0 items-center gap-1">
              <button
                v-if="canUpdateItem"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                :title="t('common.edit')"
                @click.stop="openEditItem(item)"
              >
                <Pencil class="h-4 w-4" />
              </button>

              <button
                v-if="canSetItemActive && item.isActive"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                :title="t('common.inactivate')"
                @click.stop="setItemActive(item, false)"
              >
                <Ban class="h-4 w-4" />
              </button>

              <button
                v-else-if="canSetItemActive"
                class="rounded-2xl p-2 text-emerald-500 hover:bg-emerald-500/10"
                :title="t('common.activate')"
                @click.stop="setItemActive(item, true)"
              >
                <CheckCircle2 class="h-4 w-4" />
              </button>

              <button
                v-if="canDeleteItem"
                class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10"
                :title="t('common.delete')"
                @click.stop="confirmDeleteItem(item)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="savingOrder"
          class="rounded-[20px] border border-[var(--dh-border)] p-3 text-center text-xs font-black text-[var(--dh-text-muted)]"
        >
          {{ t('catalogs.savingOrder') }}
        </div>
      </div>
    </section>
  </section>
</template>
