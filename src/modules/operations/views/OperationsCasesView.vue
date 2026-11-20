<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen, RefreshCw, ClipboardList, Layers3 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhEmptyState, DhSelect } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { operationsApi, type OperationsCaseRow, type OperationsCaseDetail } from '../services/operationsApi'

const { t, locale } = useI18n()
const page = ref(1)
const total = ref(0)
const rows = ref<OperationsCaseRow[]>([])
const selected = ref<OperationsCaseDetail | null>(null)
const search = ref('')
const status = ref('')
const loading = ref(false)
const loadingDetail = ref(false)
const error = ref('')
const pages = computed(() => Math.max(1, Math.ceil(total.value / 25)))
const columns = computed<DhTableColumn<OperationsCaseRow>[]>(() => [
  { key: 'idtra', label: t('operations.casesView.caseNumber') },
  { key: 'apertureType', label: 'Apertura' },
  { key: 'sourceQuoteId', label: 'QUO' },
  { key: 'modalityCode', label: t('operations.casesView.modality') },
  { key: 'status', label: t('operations.casesView.status') },
  { key: 'updatedAtUtc', label: t('operations.casesView.updated') },
  { key: 'actions', label: '', align: 'right' },
])
const statusOptions = computed(() => [
  { label: t('operations.casesView.allStatus'), value: '' },
  ...['DRAFT', 'PENDING_VALIDATION', 'APERTURA_VALIDADA', 'APERTURA_REQUIERE_CAMBIOS', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']
    .map(value => ({ label: value.replaceAll('_', ' '), value })),
])
const typeFilter = ref('')
const typeOptions = [
  { label: 'Todas las aperturas', value: '' },
  { label: 'Manuales', value: 'MANUAL' },
  { label: 'Automáticas desde Pricing', value: 'AUTOMATIC' },
]
const filtered = computed(() => rows.value)
const tabs = ['RESUMEN', 'QUO', 'COORDINACION_ORIGEN', 'DOCUMENTACION', 'TRANSITO', 'PANAMA', 'COSTA_RICA', 'FINANZAS'] as const
type TabCode = typeof tabs[number]
const selectedTab = ref<TabCode>('RESUMEN')
const tabName = (code: TabCode) => code === 'RESUMEN' ? 'Resumen'
  : code === 'QUO' ? 'QUO' : stageName(code)
const currentStage = computed(() => selected.value?.stages.find(s => s.departmentCode === selectedTab.value))
function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value === 'es' ? 'es-CR' : 'en-US')
}
function stageName(code: string) {
  const labels = ['APERTURAS', 'COORDINACION_ORIGEN', 'DOCUMENTACION', 'TRANSITO', 'PANAMA', 'COSTA_RICA', 'FINANZAS']
  return labels.includes(code) ? t('operations.departments.' + code) : code.replaceAll('_', ' ')
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await operationsApi.cases(page.value, {
      q: search.value, status: status.value, apertureType: typeFilter.value,
    })
    rows.value = result.items
    total.value = result.total
  } catch (value) {
    error.value = value instanceof Error ? value.message : t('operations.casesView.error')
  } finally { loading.value = false }
}
async function openCase(id: string) {
  loadingDetail.value = true
  error.value = ''
  try { selected.value = await operationsApi.caseDetail(id); selectedTab.value = 'RESUMEN' }
  catch (value) { error.value = value instanceof Error ? value.message : t('operations.casesView.error') }
  finally { loadingDetail.value = false }
}
async function changePage(next: number) {
  page.value = Math.max(1, Math.min(pages.value, next))
  await load()
}
let filterTimer: ReturnType<typeof setTimeout> | undefined
watch([search, status, typeFilter], () => {
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => { page.value = 1; void load() }, 250)
})
onMounted(load)
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <DhPageHeader :title="t('operations.casesView.title')" :subtitle="t('operations.casesView.subtitle')" :icon="FolderOpen" :hide-excel-export="true">
      <template #actions>
        <RouterLink to="/operations/apertures"><DhButton variant="secondary" :icon="ClipboardList" :label="t('operations.casesView.openings')" /></RouterLink>
        <DhButton variant="secondary" :icon="RefreshCw" :label="t('operations.casesView.update')" :loading="loading" @click="load" />
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{{ error }}</div>
    <DhCard :title="t('operations.casesView.directory')" :subtitle="t('operations.casesView.directoryHint')" :icon="FolderOpen">
      <div class="mb-4 flex flex-wrap gap-3">
        <div class="min-w-[230px] flex-1"><DhSearchInput v-model="search" placeholder="Buscar IDTRA" /></div>
        <div class="min-w-[180px]"><DhSelect v-model="typeFilter" :options="typeOptions" /></div>
        <div class="min-w-[200px]"><DhSelect v-model="status" :options="statusOptions" /></div>
      </div>
      <DhDataTable :columns="columns" :rows="filtered" :loading="loading" :empty-text="t('operations.casesView.empty')" @row-click="openCase($event.id)">
        <template #cell-idtra="{ row }"><strong class="text-[var(--dh-text)]">{{ row.idtra }}</strong></template>
        <template #cell-apertureType="{ row }"><DhBadge :variant="row.apertureType === 'AUTOMATIC' ? 'primary' : 'neutral'">{{ row.apertureType === 'AUTOMATIC' ? 'Pricing' : 'Manual' }}</DhBadge></template>
        <template #cell-sourceQuoteId="{ row }"><RouterLink v-if="row.sourceQuoteId" :to="`/pricing/rates/${row.sourceQuoteId}/wizard?mode=view`" class="font-semibold text-[var(--dh-primary)] hover:underline" @click.stop>Ver QUO</RouterLink><span v-else class="text-[var(--dh-text-muted)]">Sin QUO</span></template>
        <template #cell-modalityCode="{ row }"><DhBadge variant="neutral">{{ row.modalityCode }}</DhBadge></template>
        <template #cell-status="{ row }"><DhBadge variant="primary">{{ row.status.replaceAll('_', ' ') }}</DhBadge></template>
        <template #cell-updatedAtUtc="{ row }">{{ formatDate(row.updatedAtUtc) }}</template>
        <template #cell-actions="{ row }"><DhButton variant="secondary" size="sm" :label="t('operations.casesView.action')" @click="openCase(row.id)" /></template>
      </DhDataTable>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('operations.casesView.page', { page, pages, total }) }}</p>
        <div class="flex gap-2">
          <DhButton variant="secondary" size="sm" :label="t('operations.casesView.previous')" :disabled="page <= 1 || loading" @click="changePage(page - 1)" />
          <DhButton variant="secondary" size="sm" :label="t('operations.casesView.next')" :disabled="page >= pages || loading" @click="changePage(page + 1)" />
        </div>
      </div>
    </DhCard>
    <DhCard v-if="selected" :title="t('operations.casesView.detail') + ' · ' + selected.idtra" :subtitle="t('operations.casesView.detailHint')" :icon="Layers3">
      <template #actions><DhButton variant="ghost" size="sm" :label="t('operations.casesView.close')" @click="selected = null" /></template>
      <div class="mb-4 flex flex-wrap gap-2 border-b border-[var(--dh-border)] pb-4" role="tablist" aria-label="Expediente operativo">
        <button v-for="tab in tabs" :key="tab" type="button" role="tab" :aria-selected="selectedTab === tab"
          class="rounded-xl border px-3 py-2 text-xs font-bold transition-colors"
          :class="selectedTab === tab ? 'border-[var(--dh-primary)] bg-[var(--dh-input)] text-[var(--dh-primary)]' : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'"
          @click="selectedTab = tab">{{ tabName(tab) }}</button>
      </div>
      <div v-if="selectedTab === 'RESUMEN'" class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl bg-[var(--dh-input)] p-4"><p class="text-xs text-[var(--dh-text-muted)]">{{ t('operations.casesView.modality') }}</p><p class="mt-1 font-bold text-[var(--dh-text)]">{{ selected.modalityCode }}</p></div>
        <div class="rounded-xl bg-[var(--dh-input)] p-4"><p class="text-xs text-[var(--dh-text-muted)]">{{ t('operations.casesView.status') }}</p><p class="mt-1 font-bold text-[var(--dh-text)]">{{ selected.status.replaceAll('_', ' ') }}</p></div>
        <div class="rounded-xl bg-[var(--dh-input)] p-4"><p class="text-xs text-[var(--dh-text-muted)]">{{ t('operations.casesView.updated') }}</p><p class="mt-1 font-bold text-[var(--dh-text)]">{{ formatDate(selected.updatedAtUtc) }}</p></div>
      </div>
      <div v-if="selectedTab === 'RESUMEN'" class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl bg-[var(--dh-input)] p-4"><p class="text-xs text-[var(--dh-text-muted)]">Tipo de apertura</p><p class="mt-1 font-bold">{{ selected.apertureType === 'AUTOMATIC' ? 'Automática · Pricing' : 'Manual' }}</p></div>
        <div class="rounded-xl bg-[var(--dh-input)] p-4"><p class="text-xs text-[var(--dh-text-muted)]">Cliente en CRM</p><p class="mt-1 break-all text-xs">{{ selected.accountId }}</p></div>
        <div class="rounded-xl bg-[var(--dh-input)] p-4"><p class="text-xs text-[var(--dh-text-muted)]">Ejecutivo comercial</p><p class="mt-1 break-all text-xs">{{ selected.executiveUserId }}</p></div>
      </div>
      <div v-if="selectedTab === 'QUO'" class="rounded-xl border border-[var(--dh-border)] p-4">
        <RouterLink v-if="selected.sourceQuoteId" :to="`/pricing/rates/${selected.sourceQuoteId}/wizard?mode=view`" class="font-bold text-[var(--dh-primary)] hover:underline">Abrir cotización aceptada en Pricing</RouterLink>
        <p v-else class="text-sm text-[var(--dh-text-muted)]">Apertura sin QUO. No se generan costos ni ventas ficticias.</p>
      </div>
      <div v-if="selectedTab !== 'RESUMEN' && selectedTab !== 'QUO'" class="rounded-xl border border-[var(--dh-border)] p-4 text-sm text-[var(--dh-text-muted)]">
        <p v-if="currentStage">Etapa {{ currentStage.status.replaceAll('_', ' ') }}. La edición requiere autorización del backend.</p>
        <p v-else>Esta etapa todavía no está habilitada para este expediente.</p>
      </div>
      <h3 v-if="selectedTab === 'RESUMEN'" class="mt-5 mb-3 text-sm font-black text-[var(--dh-text)]">{{ t('operations.casesView.stages') }}</h3>
      <p v-if="selectedTab === 'RESUMEN' && !selected.stages.length" class="text-sm text-[var(--dh-text-muted)]">{{ t('operations.casesView.stageEmpty') }}</p>
      <div v-else-if="selectedTab === 'RESUMEN'" class="flex flex-wrap gap-2">
        <div v-for="stage in selected.stages" :key="stage.id" class="rounded-xl border border-[var(--dh-border)] p-3 text-xs text-[var(--dh-text)]">
          <strong>{{ stageName(stage.departmentCode) }}</strong>
          <span class="ml-2 text-[var(--dh-text-muted)]">{{ stage.status.replaceAll('_', ' ') }}</span>
        </div>
      </div>
      <p v-if="selectedTab === 'RESUMEN'" class="mt-4 text-xs text-[var(--dh-text-muted)]">{{ t('operations.casesView.openingHint') }}</p>
    </DhCard>
    <DhEmptyState v-else-if="!loadingDetail" :icon="FolderOpen" :title="t('operations.casesView.detail')" :description="t('operations.casesView.details')" />
  </div>
</template>
