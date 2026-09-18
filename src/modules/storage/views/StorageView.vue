<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Database,
  Download,
  Eye,
  FileArchive,
  FileImage,
  FileText,
  HardDrive,
  RefreshCw,
  Search,
  Server,
  Trash2,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge, DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import {
  DhCard,
  DhConfirmDialog,
  DhDataTable,
  DhPagination,
  type DhTableColumn,
} from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { STORAGE_SCOPES } from '@/core/auth/scopes'
import { StorageService, storagePreviewKind } from '@/core/services/storageService'
import type {
  StorageFileListItemDto,
  StorageProviderDto,
  StorageSummaryDto,
} from '@/core/interfaces/storage'
import StorageFileViewer from '@/modules/storage/components/StorageFileViewer.vue'

const authStore = useAuthStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const { t, locale } = useI18n()

const loading = ref(false)
const rows = ref<StorageFileListItemDto[]>([])
const providers = ref<StorageProviderDto[]>([])
const summary = ref<StorageSummaryDto>({
  totalFiles: 0,
  totalSizeInBytes: 0,
  imageFiles: 0,
  pdfFiles: 0,
  downloadOnlyFiles: 0,
  providerCount: 0,
  activeProviderCount: 0,
})
const total = ref(0)
const page = ref(1)
const pageSize = ref(25)
const search = ref('')
const contentType = ref('')
const providerId = ref('')

const canDownload = computed(() => authStore.hasScope(STORAGE_SCOPES.files.download))
const canDelete = computed(() => authStore.hasScope(STORAGE_SCOPES.files.delete))

const columns = computed<DhTableColumn<StorageFileListItemDto>[]>(() => [
  { key: 'originalFileName', label: t('storage.file') },
  { key: 'contentType', label: t('storage.type') },
  { key: 'sourceService', label: t('storage.source') },
  { key: 'providerName', label: t('storage.provider') },
  { key: 'sizeInBytes', label: t('storage.size'), align: 'right' },
  { key: 'createdAt', label: t('storage.date') },
  { key: 'actions', label: '', align: 'right' },
])

const providerOptions = computed(() => [
  { label: t('storage.allProviders'), value: '' },
  ...providers.value.map((provider) => ({
    label: `${provider.name}${provider.isDefault ? ` · ${t('storage.defaultProvider')}` : ''}`,
    value: provider.id,
  })),
])

const contentOptions = computed(() => [
  { label: t('storage.allFormats'), value: '' },
  { label: t('storage.images'), value: 'image/' },
  { label: t('storage.pdf'), value: 'application/pdf' },
  { label: t('storage.textAndEmail'), value: 'text/' },
])

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale.value === 'es' ? 'es-CR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function typeLabel(row: StorageFileListItemDto) {
  const kind = storagePreviewKind({
    id: row.id,
    fileName: row.originalFileName,
    contentType: row.contentType,
    extension: row.extension,
  })

  if (kind === 'image') return t('storage.image')
  if (kind === 'pdf') return t('storage.pdf')
  if (kind === 'text') return t('storage.text')
  if (kind === 'download') return t('storage.download')
  return row.extension?.replace('.', '').toUpperCase() || t('storage.file')
}

function typeIcon(row: StorageFileListItemDto) {
  const kind = storagePreviewKind({
    id: row.id,
    fileName: row.originalFileName,
    contentType: row.contentType,
    extension: row.extension,
  })
  if (kind === 'image') return FileImage
  if (kind === 'pdf' || kind === 'text') return FileText
  return FileArchive
}

async function load() {
  loading.value = true
  try {
    const [pageResult, summaryResult, providerResult] = await Promise.all([
      StorageService.browse({
        pageNumber: page.value,
        pageSize: pageSize.value,
        search: search.value,
        contentType: contentType.value,
        providerId: providerId.value,
      }),
      StorageService.getSummary(),
      StorageService.getProviders(),
    ])

    rows.value = pageResult.items
    total.value = pageResult.totalCount ?? pageResult.items.length
    summary.value = summaryResult
    providers.value = providerResult
  } catch (error) {
    toastStore.backendError(error, t('storage.loadError'))
  } finally {
    loading.value = false
  }
}

async function openFile(row: StorageFileListItemDto) {
  if (!canDownload.value) {
    toastStore.warning(t('storage.permissionTitle'), t('storage.permissionMessage'))
    return
  }

  const descriptor = {
    id: row.id,
    fileName: row.originalFileName,
    contentType: row.contentType,
    extension: row.extension,
    sizeInBytes: row.sizeInBytes,
  }

  if (storagePreviewKind(descriptor) === 'download') {
    try {
      await StorageService.downloadFile(descriptor)
    } catch (error) {
      toastStore.backendError(error, t('storage.downloadError'))
    }
    return
  }

  modalStore.open({
    title: row.originalFileName,
    component: StorageFileViewer,
    props: descriptor,
    size: 'xl',
  })
}

async function performDelete(row: StorageFileListItemDto) {
  try {
    await StorageService.deleteFile(row.id)
    toastStore.success(t('storage.deletedTitle'), row.originalFileName)
    modalStore.close()
    await load()
  } catch (error) {
    toastStore.backendError(error, t('storage.deleteError'))
  }
}

function deleteFile(row: StorageFileListItemDto) {
  if (!canDelete.value) return

  modalStore.open({
    title: t('storage.deleteTitle'),
    component: DhConfirmDialog,
    props: {
      title: t('storage.deleteTitle'),
      message: t('storage.deleteMessage', { name: row.originalFileName }),
      confirmLabel: t('storage.deleteConfirm'),
      cancelLabel: t('common.cancel'),
      danger: true,
      onConfirm: () => performDelete(row),
      onCancel: () => modalStore.close(),
    },
    size: 'sm',
  })
}

function applyFilters() {
  page.value = 1
  void load()
}

function updatePage(value: number) {
  page.value = value
  void load()
}

function updatePageSize(value: number) {
  pageSize.value = value
  page.value = 1
  void load()
}

onMounted(load)
</script>

<template>
  <section class="space-y-4 sm:space-y-6">
    <DhPageHeader
      :title="t('storage.title')"
      :subtitle="t('storage.subtitle')"
      :icon="HardDrive"
    >
      <template #actions>
        <DhButton
          :label="t('storage.refresh')"
          :icon="RefreshCw"
          variant="secondary"
          :loading="loading"
          @click="load"
        />
      </template>
    </DhPageHeader>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DhCard padding="sm">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('storage.files') }}</p>
          <Database class="h-5 w-5 text-[var(--dh-primary)]" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.totalFiles }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ t('storage.stored', { size: formatSize(summary.totalSizeInBytes) }) }}
        </p>
      </DhCard>

      <DhCard padding="sm">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('storage.images') }}</p>
          <FileImage class="h-5 w-5 text-[var(--dh-primary)]" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.imageFiles }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('storage.integratedPreview') }}</p>
      </DhCard>

      <DhCard padding="sm">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('storage.pdf') }}</p>
          <FileText class="h-5 w-5 text-[var(--dh-primary)]" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ summary.pdfFiles }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('storage.openInsideDhole') }}</p>
      </DhCard>

      <DhCard padding="sm">
        <div class="flex items-center justify-between">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ t('storage.providers') }}</p>
          <Server class="h-5 w-5 text-[var(--dh-primary)]" />
        </div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">
          {{ summary.activeProviderCount }}/{{ summary.providerCount }}
        </p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('storage.activeConfigured') }}</p>
      </DhCard>
    </div>

    <DhCard padding="sm">
      <form class="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_260px_auto]" @submit.prevent="applyFilters">
        <DhInput v-model="search" type="search" :placeholder="t('storage.searchPlaceholder')" :icon="Search" />
        <DhSelect v-model="contentType" :options="contentOptions" placeholder="" />
        <DhSelect v-model="providerId" :options="providerOptions" placeholder="" />
        <DhButton :label="t('common.search')" :icon="Search" type="submit" />
      </form>
    </DhCard>

    <DhDataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :empty-text="t('storage.empty')"
      @row-click="openFile"
    >
      <template #cell-originalFileName="{ row }">
        <div class="flex min-w-0 items-center gap-3">
          <component :is="typeIcon(row)" class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
          <div class="min-w-0">
            <p class="max-w-[340px] truncate font-black text-[var(--dh-text)]">{{ row.originalFileName }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ t('storage.references', { version: row.currentVersionNumber, count: row.referenceCount }) }}
            </p>
          </div>
        </div>
      </template>
      <template #cell-contentType="{ row }"><DhBadge :label="typeLabel(row)" variant="neutral" /></template>
      <template #cell-sourceService="{ row }">
        <div>
          <p class="font-bold text-[var(--dh-text)]">{{ row.sourceService || '—' }}</p>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.entityType || '—' }}</p>
        </div>
      </template>
      <template #cell-providerName="{ row }">
        <div>
          <p class="font-bold text-[var(--dh-text)]">{{ row.providerName }}</p>
          <p class="text-xs text-[var(--dh-text-muted)]">{{ row.providerType }}</p>
        </div>
      </template>
      <template #cell-sizeInBytes="{ row }">{{ formatSize(row.sizeInBytes) }}</template>
      <template #cell-createdAt="{ row }">{{ formatDate(row.createdAt) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1" @click.stop>
          <DhButton
            v-if="canDownload"
            :label="storagePreviewKind({ id: row.id, fileName: row.originalFileName, contentType: row.contentType, extension: row.extension }) === 'download' ? t('storage.download') : t('storage.view')"
            :icon="storagePreviewKind({ id: row.id, fileName: row.originalFileName, contentType: row.contentType, extension: row.extension }) === 'download' ? Download : Eye"
            size="sm"
            variant="secondary"
            @click="openFile(row)"
          />
          <DhButton
            v-if="canDelete"
            :icon="Trash2"
            size="sm"
            variant="danger"
            :aria-label="t('storage.deleteTitle')"
            @click="deleteFile(row)"
          />
        </div>
      </template>
    </DhDataTable>

    <DhPagination
      :page="page"
      :page-size="pageSize"
      :total="total"
      @update:page="updatePage"
      @update:page-size="updatePageSize"
    />
  </section>
</template>
