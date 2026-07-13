<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Check, FileSpreadsheet, Import, Ship, Trash2, X } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import {
  DhCrudToolbar,
  DhDataTable,
  DhPagination,
  type DhTableColumn,
} from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type { ImportRateDto, ImportSourceType, ImportStatus } from '@/core/interfaces/pricing'
import PricingUploadDrawer from '@/modules/pricing/components/PricingUploadDrawer.vue'
import PricingRateFormDrawer from '@/modules/pricing/components/PricingRateFormDrawer.vue'
import PricingReasonModal from '@/modules/pricing/components/PricingReasonModal.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatDate, formatMoney, statusTone } from '@/modules/pricing/utils/pricingFormat'

const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const rows = ref<ImportRateDto[]>([])
const selectedIds = ref<string[]>([])
const loading = ref(false)
const filtersOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filters = reactive({
  search: '',
  status: '' as ImportStatus | '',
  sourceType: '' as ImportSourceType | '',
  pol: '',
  pod: '',
  carrier: '',
  containerType: '',
  currency: '',
  quoteDate: '',
  validFrom: '',
  validTo: '',
})

const canUpload = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.create))
const canApprove = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.approve))
const canReject = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.reject))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.delete))
const canCreateRate = computed(
  () =>
    authStore.hasScope(PRICING_SCOPES.rates.create) &&
    authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate),
)
const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((row) => selectedIds.value.includes(row.id)),
)

const columns: DhTableColumn<ImportRateDto>[] = [
  { key: 'selected', label: '', width: '48px', align: 'center' },
  { key: 'carrier', label: 'Naviera' },
  { key: 'route', label: 'Ruta' },
  { key: 'containerType', label: 'Contenedor' },
  { key: 'freight', label: 'Flete', align: 'right' },
  { key: 'freeDays', label: 'Días libres', align: 'center' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'usedAsRateCount', label: 'Uso', align: 'center' },
  { key: 'actions', label: '', align: 'right', width: '150px' },
]

const statusOptions = [
  { label: 'Todos', value: '' },
  { label: 'Pendientes', value: 'Pending' },
  { label: 'Aprobadas', value: 'Approved' },
  { label: 'Rechazadas', value: 'Rejected' },
  { label: 'Creadas', value: 'Created' },
]
const sourceOptions = [
  { label: 'Todos', value: '' },
  { label: 'Correo', value: 'Email' },
  { label: 'PDF', value: 'Pdf' },
  { label: 'Excel', value: 'Excel' },
  { label: 'CSV', value: 'Csv' },
  { label: 'Imagen', value: 'Image' },
]

function statusLabel(status: string) {
  return (
    (
      {
        Pending: 'Pendiente',
        Approved: 'Aprobada',
        Rejected: 'Rechazada',
        Created: 'Creada',
      } as Record<string, string>
    )[status] ?? status
  )
}

async function load() {
  try {
    loading.value = true
    const result = await PricingService.browseImportRates({
      pageNumber: page.value,
      pageSize: pageSize.value,
      search: filters.search || undefined,
      status: filters.status || undefined,
      sourceType: filters.sourceType || undefined,
      pol: filters.pol || undefined,
      pod: filters.pod || undefined,
      carrier: filters.carrier || undefined,
      containerType: filters.containerType || undefined,
      currency: filters.currency || undefined,
      quoteDate: filters.quoteDate || undefined,
      validFrom: filters.validFrom || undefined,
      validTo: filters.validTo || undefined,
    })
    rows.value = result.items
    total.value = result.totalCount ?? result.items.length
    selectedIds.value = selectedIds.value.filter((id) => result.items.some((row) => row.id === id))
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las tarifas importadas.')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}
function clearFilters() {
  Object.assign(filters, {
    search: '',
    status: '',
    sourceType: '',
    pol: '',
    pod: '',
    carrier: '',
    containerType: '',
    currency: '',
    quoteDate: '',
    validFrom: '',
    validTo: '',
  })
  applyFilters()
}

function toggleSelection(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((value) => value !== id)
    : [...selectedIds.value, id]
}

function toggleAll() {
  selectedIds.value = allSelected.value ? [] : rows.value.map((row) => row.id)
}

function openUpload() {
  drawerStore.open({
    title: 'Importar tarifario',
    component: PricingUploadDrawer,
    size: 'lg',
    props: { onSaved: load },
  })
}

function openConvert(row: ImportRateDto) {
  if (!canCreateRate.value || row.usedAsRateCount > 0 || row.status === 'Rejected') return
  if (row.status === 'Pending' && !canApprove.value) {
    toastStore.warning(
      'Aprobación requerida',
      'Apruebe la importación antes de convertirla en tarifa.',
    )
    return
  }
  drawerStore.open({
    title: 'Crear tarifa desde importación',
    component: PricingRateFormDrawer,
    size: 'full',
    props: { sourceImport: row, onSaved: load },
  })
}

async function approve(row: ImportRateDto) {
  try {
    await PricingService.approveImportRate(row.id)
    toastStore.success('Importación aprobada')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aprobar la importación.')
  }
}

function reject(row: ImportRateDto) {
  modalStore.open({
    title: 'Rechazar importación',
    component: PricingReasonModal,
    props: { target: 'import', id: row.id, onSaved: load },
  })
}

function confirmDelete() {
  if (!selectedIds.value.length) return
  modalStore.open({
    title: 'Eliminar importaciones',
    component: DhConfirmDialog,
    props: {
      title: 'Eliminar importaciones',
      message: `¿Desea eliminar ${selectedIds.value.length} tarifa${selectedIds.value.length === 1 ? '' : 's'} importada${selectedIds.value.length === 1 ? '' : 's'}?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        await PricingService.deleteImportRates(selectedIds.value)
        selectedIds.value = []
        modalStore.close()
        toastStore.success('Importaciones eliminadas')
        await load()
      },
      onCancel: modalStore.close,
    },
  })
}

watch([page, pageSize], load)
useViewShortcuts({
  create: () => {
    if (canUpload.value) openUpload()
  },
  save: load,
  refresh: load,
})
onMounted(async () => {
  await catalogs.loadAll()
  await load()
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Tarifas importadas"
      subtitle="Revise, apruebe y convierta los tarifarios extraídos en tarifas oficiales."
      :icon="Import"
    >
      <template v-if="canUpload" #actions
        ><DhButton label="Importar tarifario" :icon="FileSpreadsheet" @click="openUpload"
      /></template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="filters.search"
        title="Bandeja de revisión"
        create-label="Importar tarifario"
        :show-create="canUpload"
        @create="openUpload"
        @refresh="load"
        @search="applyFilters"
        @filter="filtersOpen = !filtersOpen"
      >
        <template #description
          ><p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ total }} registros · Los pendientes requieren revisión antes de convertirse.
          </p></template
        >
      </DhCrudToolbar>

      <div
        v-if="filtersOpen"
        class="mt-5 rounded-[26px] border border-[var(--dh-border)] bg-black/[0.025] p-4 dark:bg-white/[0.04]"
      >
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DhSelect
            v-model="filters.status"
            label="Estado"
            :options="statusOptions"
            placeholder=""
          />
          <DhSelect
            v-model="filters.sourceType"
            label="Origen"
            :options="sourceOptions"
            placeholder=""
          />
          <DhSelect
            v-model="filters.carrier"
            label="Naviera"
            :options="[
              { label: 'Todas', value: '' },
              ...catalogs.carriers.value.map((item) => ({ label: item.name, value: item.code })),
            ]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.containerType"
            label="Contenedor"
            :options="[
              { label: 'Todos', value: '' },
              ...catalogs.containerTypes.value.map((item) => ({
                label: item.name,
                value: item.code,
              })),
            ]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.pol"
            label="POL"
            :options="[
              { label: 'Todos', value: '' },
              ...catalogs.polPorts.value.map((item) => ({ label: item.name, value: item.code })),
            ]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.pod"
            label="POD"
            :options="[
              { label: 'Todos', value: '' },
              ...catalogs.podPorts.value.map((item) => ({ label: item.name, value: item.code })),
            ]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.currency"
            label="Moneda"
            :options="[
              { label: 'Todas', value: '' },
              ...catalogs.currencies.value.map((item) => ({ label: item.name, value: item.code })),
            ]"
            placeholder=""
          />
          <DhInput v-model="filters.quoteDate" type="date" label="Fecha de cotización" />
          <DhInput v-model="filters.validFrom" type="date" label="Vigente desde" />
          <DhInput v-model="filters.validTo" type="date" label="Vigente hasta" />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <DhButton label="Limpiar" variant="ghost" size="sm" @click="clearFilters" /><DhButton
            label="Aplicar filtros"
            size="sm"
            @click="applyFilters"
          />
        </div>
      </div>

      <div
        v-if="selectedIds.length"
        class="mt-5 flex items-center justify-between rounded-[22px] dh-bg-primary-soft px-4 py-3"
      >
        <p class="text-sm font-black text-[var(--dh-primary)]">
          {{ selectedIds.length }} seleccionada{{ selectedIds.length === 1 ? '' : 's' }}
        </p>
        <DhButton
          v-if="canDelete"
          label="Eliminar seleccionadas"
          :icon="Trash2"
          variant="danger"
          size="sm"
          @click="confirmDelete"
        />
      </div>

      <div class="mt-5">
        <DhDataTable
          :columns="columns"
          :rows="rows"
          :loading="loading"
          empty-text="No hay tarifas importadas que coincidan con los filtros."
          @row-click="openConvert"
        >
          <template #cell-selected="{ row }"
            ><div class="flex justify-center" @click.stop>
              <DhCheckbox
                :model-value="selectedIds.includes(row.id)"
                @update:model-value="toggleSelection(row.id)"
              /></div
          ></template>
          <template #cell-carrier="{ row }"
            ><div>
              <p class="font-black text-[var(--dh-text)]">{{ row.carrier }}</p>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.sourceType }}</p>
            </div></template
          >
          <template #cell-route="{ row }"
            ><p class="font-black">{{ row.pol }} → {{ row.pod }}</p></template
          >
          <template #cell-containerType="{ row }"
            ><DhBadge :label="row.containerType" variant="neutral"
          /></template>
          <template #cell-freight="{ row }"
            ><span class="font-black">{{ formatMoney(row.freight, row.currency) }}</span></template
          >
          <template #cell-freeDays="{ row }"
            ><span class="font-black">{{ row.freeDays }}</span></template
          >
          <template #cell-validity="{ row }"
            ><div class="text-xs font-semibold">
              <p>{{ formatDate(row.validFrom) }}</p>
              <p class="text-[var(--dh-text-muted)]">hasta {{ formatDate(row.validTo) }}</p>
            </div></template
          >
          <template #cell-status="{ row }"
            ><DhBadge :label="statusLabel(row.status)" :variant="statusTone(row.status)"
          /></template>
          <template #cell-usedAsRateCount="{ row }"
            ><DhBadge
              :label="row.usedAsRateCount ? `Convertida · ${row.usedAsRateCount}` : 'Disponible'"
              :variant="row.usedAsRateCount ? 'neutral' : 'success'"
          /></template>
          <template #cell-actions="{ row }"
            ><div class="flex justify-end gap-1">
              <button
                v-if="canApprove && row.status === 'Pending'"
                type="button"
                class="rounded-2xl p-2 text-emerald-600 hover:bg-emerald-500/10"
                title="Aprobar"
                @click.stop="approve(row)"
              >
                <Check class="h-4 w-4" /></button
              ><button
                v-if="canReject && row.status === 'Pending'"
                type="button"
                class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10"
                title="Rechazar"
                @click.stop="reject(row)"
              >
                <X class="h-4 w-4" /></button
              ><button
                v-if="canCreateRate && row.status !== 'Rejected' && row.usedAsRateCount === 0"
                type="button"
                class="rounded-2xl p-2 text-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.1)]"
                title="Crear tarifa"
                @click.stop="openConvert(row)"
              >
                <Ship class="h-4 w-4" />
              </button></div
          ></template>
        </DhDataTable>
      </div>
      <div class="mt-5">
        <DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </section>
  </section>
</template>
