<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-vue-next'
import { DhButton, DhEmptyState, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhSearchInput } from '@/shared/components/molecules'
import { DhModal, DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { REPORTS_SCOPES } from '@/core/auth/scopes'
import { ReportsService } from '@/core/services/reportsService'
import type { ReportFormat, ReportTemplateListDto } from '@/core/interfaces/reports'

const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const toastStore = useToastStore()

const loading = ref(false)
const templates = ref<ReportTemplateListDto[]>([])
const search = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = 24

const generateTarget = ref<ReportTemplateListDto | null>(null)
const generating = ref(false)
const format = ref<ReportFormat>('pdf')
const fileName = ref('')
const sheetName = ref('Report')
const companyVariableExample = '{{company.name}}'
const eachItemsExample = '{{#each items}}'
const dataJson = ref(
  locale.value === 'es'
    ? `{
  "company": { "name": "Dhole Logistics", "taxId": "3-101-000000" },
  "title": "Reporte de ejemplo",
  "date": "2026-08-04",
  "items": [
    { "description": "Flete marítimo", "quantity": 1, "amount": 6300 },
    { "description": "Recargo", "quantity": 1, "amount": 65 }
  ]
}`
    : `{
  "company": { "name": "Dhole Logistics", "taxId": "3-101-000000" },
  "title": "Sample report",
  "date": "2026-08-04",
  "items": [
    { "description": "Ocean freight", "quantity": 1, "amount": 6300 },
    { "description": "Surcharge", "quantity": 1, "amount": 65 }
  ]
}`,
)

const canCreate = computed(() => authStore.hasScope(REPORTS_SCOPES.templates.create))
const canUpdate = computed(() => authStore.hasScope(REPORTS_SCOPES.templates.update))
const canDelete = computed(() => authStore.hasScope(REPORTS_SCOPES.templates.delete))
const canGenerate = computed(() => authStore.hasScope(REPORTS_SCOPES.reports.generate))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const formatOptions = computed(() => [
  { value: 'pdf', label: t('reports.pdfFromHtml') },
  { value: 'xlsx', label: t('reports.excelXlsx') },
  { value: 'csv', label: t('reports.csv') },
])

async function load() {
  loading.value = true
  try {
    const response = await ReportsService.browse({
      pageNumber: page.value,
      pageSize,
      search: search.value.trim() || undefined,
    })
    templates.value = response.items
    total.value = response.totalCount ?? response.items.length
  } catch (error) {
    toastStore.backendError(error, t('reports.toasts.loadError'))
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  await load()
}

function createTemplate() {
  void router.push('/reports/templates/new')
}

function openTemplate(template: ReportTemplateListDto) {
  void router.push(`/reports/templates/${template.id}`)
}

async function preview(template: ReportTemplateListDto) {
  try {
    await ReportsService.openPreview(template.id)
  } catch (error) {
    toastStore.backendError(error, t('reports.toasts.previewError'))
  }
}

async function remove(template: ReportTemplateListDto) {
  if (!canDelete.value || !window.confirm(t('reports.deleteConfirm', { name: template.name }))) return

  try {
    await ReportsService.delete(template.id)
    toastStore.success(t('reports.toasts.deletedTitle'), template.name)
    await load()
  } catch (error) {
    toastStore.backendError(error, t('reports.toasts.deleteError'))
  }
}

function openGenerate(template: ReportTemplateListDto) {
  generateTarget.value = template
  fileName.value = template.name.replace(/\s+/g, '-').toLowerCase()
  sheetName.value = locale.value === 'es' ? 'Reporte' : 'Report'
  format.value = 'pdf'
}

function closeGenerate() {
  if (!generating.value) generateTarget.value = null
}

async function generate() {
  if (!generateTarget.value) return

  try {
    JSON.parse(dataJson.value)
  } catch {
    toastStore.warning(t('reports.toasts.invalidJsonTitle'), t('reports.toasts.invalidJsonMessage'))
    return
  }

  generating.value = true
  try {
    await ReportsService.generate(generateTarget.value.id, {
      format: format.value,
      dataJson: dataJson.value,
      fileName: fileName.value,
      sheetName: sheetName.value,
    })
    toastStore.success(
      t('reports.toasts.generatedTitle'),
      t('reports.toasts.generatedMessage', { format: format.value.toUpperCase() }),
    )
    generateTarget.value = null
  } catch (error) {
    toastStore.backendError(error, t('reports.toasts.generateError'))
  } finally {
    generating.value = false
  }
}

function applySearch() {
  page.value = 1
  void load()
}

function clearSearch() {
  search.value = ''
  page.value = 1
  void load()
}

function changePage(next: number) {
  page.value = Math.min(Math.max(1, next), totalPages.value)
  void load()
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

onMounted(load)
</script>

<template>
  <section class="space-y-5 sm:space-y-6">
    <DhPageHeader
      :title="t('reports.templatesTitle')"
      :subtitle="t('reports.templatesSubtitle')"
      :icon="FileText"
    >
      <template #actions>
        <DhButton
          :icon="RefreshCw"
          :label="t('common.refresh')"
          variant="secondary"
          :loading="loading"
          @click="refreshAll"
        />
        <DhButton
          v-if="canCreate"
          :icon="Plus"
          :label="t('reports.newTemplate')"
          @click="createTemplate"
        />
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-3 sm:p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <DhSearchInput
          v-model="search"
          :placeholder="t('reports.searchPlaceholder')"
          @search="applySearch"
          @clear="clearSearch"
        />
        <DhButton
          class="w-full md:w-auto"
          :icon="Search"
          :label="t('common.search')"
          variant="secondary"
          @click="applySearch"
        />
      </div>
    </section>

    <section
      v-if="loading && templates.length === 0"
      class="dh-glass dh-liquid flex min-h-64 items-center justify-center rounded-[32px] p-8 text-sm font-bold text-[var(--dh-text-muted)]"
    >
      <RefreshCw class="mr-2 h-5 w-5 animate-spin text-[var(--dh-primary)]" />
      {{ t('reports.loadingTemplates') }}
    </section>

    <DhEmptyState
      v-else-if="templates.length === 0"
      :icon="FileText"
      :title="t('reports.emptyTitle')"
      :description="t('reports.emptyDescription')"
      :action-label="canCreate ? t('reports.newTemplate') : undefined"
      @action="createTemplate"
    />

    <div v-else class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      <article
        v-for="template in templates"
        :key="template.id"
        class="dh-glass dh-liquid group flex min-w-0 flex-col overflow-hidden rounded-[32px] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--dh-shadow-lg)]"
      >
        <div class="relative flex min-h-32 items-center justify-center overflow-hidden dh-bg-primary-soft sm:min-h-36">
          <div class="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_top_right,var(--dh-primary),transparent_55%)]" />
          <div class="relative flex h-16 w-16 items-center justify-center rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-primary)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl">
            <FileText class="h-8 w-8" />
          </div>
        </div>

        <div class="flex flex-1 flex-col gap-4 p-4 sm:p-5">
          <div class="min-w-0">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h2 class="min-w-0 break-words text-lg font-black text-[var(--dh-text)]">
                {{ template.name }}
              </h2>
              <DhBadge variant="primary">
                {{ template.pageSize }} ·
                {{ template.orientation === 'Landscape' ? t('reports.landscape') : t('reports.portrait') }}
              </DhBadge>
            </div>
            <p class="mt-2 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[var(--dh-text-muted)]">
              {{ template.description || t('reports.noDescription') }}
            </p>
          </div>

          <div class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-xs font-bold text-[var(--dh-text-muted)]">
            {{ t('reports.previewUpdated', { date: formatDate(template.previewGeneratedAtUtc) }) }}
          </div>

          <div class="mt-auto grid grid-cols-2 gap-2 border-t border-[var(--dh-border)] pt-4 sm:flex sm:flex-wrap">
            <DhButton size="sm" variant="secondary" :icon="Eye" label="PDF" @click="preview(template)" />
            <DhButton
              v-if="canGenerate"
              size="sm"
              :icon="Download"
              :label="t('reports.generate')"
              @click="openGenerate(template)"
            />
            <DhButton
              size="sm"
              variant="secondary"
              :icon="canUpdate ? Pencil : Eye"
              :label="canUpdate ? t('common.edit') : t('reports.viewDesign')"
              @click="openTemplate(template)"
            />
            <DhButton
              v-if="canDelete"
              class="sm:ml-auto"
              size="sm"
              variant="danger"
              :icon="Trash2"
              :label="t('common.delete')"
              @click="remove(template)"
            />
          </div>
        </div>
      </article>
    </div>

    <section
      v-if="totalPages > 1"
      class="dh-glass dh-liquid flex flex-col gap-3 rounded-[26px] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
    >
      <p class="text-center text-xs font-black text-[var(--dh-text-muted)] sm:text-left">
        {{ t('reports.paginationSummary', { page, totalPages, total }) }}
      </p>
      <div class="grid grid-cols-2 gap-2 sm:flex">
        <DhButton
          variant="secondary"
          :label="t('common.previous')"
          :disabled="page <= 1"
          @click="changePage(page - 1)"
        />
        <DhButton
          variant="secondary"
          :label="t('common.next')"
          :disabled="page >= totalPages"
          @click="changePage(page + 1)"
        />
      </div>
    </section>

    <DhModal
      :open="Boolean(generateTarget)"
      :title="generateTarget ? t('reports.generateTitle', { name: generateTarget.name }) : ''"
      size="lg"
      @close="closeGenerate"
    >
      <div class="space-y-5">
        <p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('reports.generateSubtitle') }}</p>

        <div class="grid gap-4 sm:grid-cols-3">
          <DhSelect
            v-model="format"
            :label="t('reports.format')"
            :options="formatOptions"
            placeholder=""
          />
          <DhInput
            v-model="fileName"
            class="sm:col-span-2"
            :label="t('reports.fileName')"
          />
        </div>

        <DhInput
          v-if="format === 'xlsx'"
          v-model="sheetName"
          :label="t('reports.sheetName')"
        />

        <div>
          <DhTextarea
            v-model="dataJson"
            :label="t('reports.jsonData')"
            :rows="15"
          />
          <p class="mt-2 overflow-x-auto rounded-[18px] bg-slate-950 p-3 font-mono text-xs leading-5 text-emerald-300">
            {{ t('reports.jsonEditorHint') }}
          </p>
        </div>

        <div class="rounded-[22px] border dh-border-primary-soft dh-bg-primary-soft p-4 text-xs font-semibold leading-5 text-[var(--dh-primary)]">
          {{
            t('reports.generationHelp', {
              variable: companyVariableExample,
              each: eachItemsExample,
            })
          }}
        </div>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DhButton
            class="w-full sm:w-auto"
            variant="secondary"
            :label="t('common.cancel')"
            :disabled="generating"
            @click="closeGenerate"
          />
          <DhButton
            class="w-full sm:w-auto"
            :icon="format === 'pdf' ? FileText : FileSpreadsheet"
            :label="generating ? t('reports.generating') : t('reports.generateDownload')"
            :loading="generating"
            @click="generate"
          />
        </div>
      </div>
    </DhModal>
  </section>
</template>
