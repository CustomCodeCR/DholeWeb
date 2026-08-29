<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Copy, Edit3, Eye, ReceiptText, Trash2 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import {
  DhCrudToolbar,
  DhDataTable,
  DhPagination,
  type DhTableColumn,
} from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type { RateDto, RateStatus } from '@/core/interfaces/pricing'
import PricingDuplicateRateModal from '@/modules/pricing/components/PricingDuplicateRateModal.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import {
  formatDate,
  formatMoney,
  marginTone,
  rateDisplayName,
  routeLabel,
  statusTone,
} from '@/modules/pricing/utils/pricingFormat'

type CommercialRateStatus = 'Open' | 'Sent' | 'Expired' | 'AcceptedByClient' | 'RejectedByClient'

const commercialStatuses = new Set<CommercialRateStatus>([
  'Open',
  'Sent',
  'Expired',
  'AcceptedByClient',
  'RejectedByClient',
])

function normalizeCommercialStatus(value: unknown): CommercialRateStatus {
  const status = typeof value === 'string' ? value : ''
  if (commercialStatuses.has(status as CommercialRateStatus)) return status as CommercialRateStatus
  if (status === 'RejectedByClient' || status === 'Closed') return 'RejectedByClient'
  if (status === 'Sent') return 'Sent'
  if (status === 'Expired') return 'Expired'
  if (status === 'AcceptedByClient') return 'AcceptedByClient'
  return 'Open'
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const displayRate = (rate: RateDto) => catalogs.resolveRateLabels(rate)
const displayRateName = (rate: RateDto) => rateDisplayName(displayRate(rate))

function containerSummary(rate: RateDto) {
  if (rate.shipmentMode === 'Lcl' || rate.shipmentMode === 'Ltl') {
    return `${rate.shipmentMode.toUpperCase()} · ${Number(rate.chargeableQuantity || 0).toFixed(3)} CBM`
  }
  if (rate.shipmentMode === 'Ftl') return `${rate.containerQuantity} × FTL`
  const allocations = rate.containers?.filter((item) => item.quantity > 0) ?? []
  if (allocations.length === 0) return `${rate.containerQuantity} × ${rate.containerTypeName}`
  return allocations.map((item) => `${item.quantity} × ${item.containerTypeName}`).join(' + ')
}

function canonicalRateCurrency(code?: string | null, name?: string | null) {
  const value = `${code ?? ''} ${name ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()

  if (value.includes('CRC') || value.includes('COLON')) return 'CRC'
  if (value.includes('USD') || value.includes('DOLAR') || value.includes('DOLLAR')) return 'USD'
  return ''
}

function rateFinancialSummary(rate: RatoDto) {
  const exchangeRate = Number(rate.exchangeRateApplied || rate.exchangeRateSale || 0)
  let costUsd = 0
  let saleUsd = 0
  let costCrc = 0
  let saleCrc = 0
  let taxUsd = 0
  let taxCrc = 0
  let recognizedDetails = false

  for (const detail of rate.rateDetails ?? []) {
    const quantity = Number(detail.quantity) > 0 ? Number(detail.quantity) : 1
    const cost = Number(detail.costAmount || 0) * quantity
    const sale = Number(detail.saleAmount || 0) * quantity
    const tax = Number(detail.destinationTaxAmount || 0) * quantity
    const code = canonicalRateCurrency(detail.currencyCode, detail.currencyName)

    if (code === 'USD') {
      recognizedDetails = true
      costUsd += cost
      saleUsd += sale
      taxUsd += tax
      if (exchangeRate > 0) {
        costCrc += cost * exchangeRate
        saleCrc += sale * exchangeRate
        taxCrc += tax * exchangeRate
      }
    } else if (code === 'CRC') {
      recognizedDetails = true
      costCrc += cost
      saleCrc += sale
      taxCrc += tax
      if (exchangeRate > 0) {
        costUsd += cost / exchangeRate
        saleUsd += sale / exchangeRate
        taxUsd += tax / exchangeRate
      }
    }
  }

  const detailValues = Math.abs(costUsd) + Math.abs(saleUsd) + Math.abs(costCrc) + Math.abs(saleCrc)

  if (!recognizedDetails || detailValues === 0) {
    costUsd = Number(rate.totalCostUsd || 0)
    saleUsd = Number(rate.totalSaleUsd || 0)
    costCrc = Number(rate.totalCostCrc || 0)
    saleCrc = Number(rate.totalSaleCrc || 0)
    taxUsd = Number((rate as RateDto & { totalTaxUsd?: number }).totalTaxUsd || 0)
    taxCrc = Number((rate as RateDto & { totalTaxCrc?: number }).totalTaxCrc || 0)

    const dualValues = Math.abs(costUsd) + Math.abs(saleUsd) + Math.abs(costCrc) + Math.abs(saleCrc)

    if (dualValues === 0) {
      const nativeCost = Number(rate.totalCostAmount || 0)
      const nativeSale = Number(rate.totalSaleAmount || 0)
      const nativeCode = canonicalRateCurrency(rate.currencyCode, rate.currencyName) || 'USD'

      if (nativeCode === 'CRC') {
        costCrc = nativeCost
        saleCrc = nativeSale
        if (exchangeRate > 0) {
          costUsd = nativeCost / exchangeRate
          saleUsd = nativeSale / exchangeRate
        }
      } else {
        costUsd = nativeCost
        saleUsd = nativeSale
        if (exchangeRate > 0) {
          costCrc = nativeCost * exchangeRate
          saleCrc = nativeSale * exchangeRate
        }
      }
    }
  }

  if (exchangeRate > 0) {
    if ((costUsd !== 0 || saleUsd !== 0) && costCrc === 0 && saleCrc === 0) {
      costCrc = costUsd * exchangeRate
      saleCrc = saleUsd * exchangeRate
    } else if ((costCrc !== 0 || saleCrc !== 0) && costUsd === 0 && saleUsd === 0) {
      costUsd = costCrc / exchangeRate
      saleUsd = saleCrc / exchangeRate
    }

    if (taxUsd !== 0 && taxCrc === 0) taxCrc = taxUsd * exchangeRate
    if (taxCrc !== 0 && taxUsd === 0) taxUsd = taxCrc / exchangeRate
  }

  const utilityUsd = saleUsd - costUsd
  const utilityCrc = saleCrc - costCrc
  const margin = saleUsd > 0
    ? (utilityUsd / saleUsd) * 100
    : saleCrc > 0
      ? (utilityCrc / saleCrc) * 100
      : Number(rate.marginPercentage || 0)

  return {
    costUsd,
    costCrc,
    saleUsd,
    saleCrc,
    subtotalUsd: saleUsd,
    subtotalCrc: saleCrc,
    taxUsd,
    taxCrc,
    totalUsd: saleUsd + taxUsd,
    totalCrc: saleCrc + taxCrc,
    utilityUsd,
    utilityCrc,
    margin,
  }
}

const rows = ref<RateDto[]>([])
const selectedIds = ref<string[]>([])
const loading = ref(false)
const filtersOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filters = reactive({
  search: '',
  status: normalizeCommercialStatus(route.query.status),
  agentId: '',
  carrierId: '',
  polId: '',
  poeId: '',
  podId: '',
  containerTypeId: '',
  currencyId: '',
  idtraNumber: '',
  quoNumber: '',
  quoteDate: '',
  validFrom: '',
  validTo: '',
})

const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create))
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.rates.delete))

const columns: DhTableColumn<RateDto>[] = [
  { key: 'selected', label: '', width: '48px', align: 'center' },
  { key: 'rate', label: 'Tarifa' },
  { key: 'logistics', label: 'Operación' },
  { key: 'commercial', label: 'Resumen comercial', align: 'right' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right', width: '130px' },
]

const statusOptions: Array<{ label: string; value: CommercialRateStatus }> = [
  { label: 'Abiertas', value: 'Open' },
  { label: 'Enviadas', value: 'Sent' },
  { label: 'Vencidas', value: 'Expired' },
  { label: 'Aceptadas', value: 'AcceptedByClient' },
  { label: 'No aceptadas', value: 'RejectedByClient' },
]

const quickStatusOptions = statusOptions

const activeFiltersCount = computed(
  () =>
    Object.entries(filters).filter(([key, value]) => !['search', 'status'].includes(key) && String(value || '').trim())
      .length + (filters.search.trim() ? 1 : 0),
)

function applyQuickStatus(status: CommercialRateStatus) {
  filters.status = status
  applyFilters()
}

function statusLabel(status: string) {
  return (
    (
      {
        Open: 'Abierta',
        PendingApproval: 'Abierta',
        ApprovedByManagement: 'Abierta',
        RejectedByManagement: 'Abierta',
        Sent: 'Enviada',
        RequestedByClient: 'Abierta',
        AcceptedByClient: 'Aceptada',
        RejectedByClient: 'No aceptada',
        Closed: 'No aceptada',
        Expired: 'Vencida',
      } as Record<string, string>
    )[status] ?? status
  )
}

async function load() {
  try {
    loading.value = true
    const result = await PricingService.browseRates({
      pageNumber: page.value,
      pageSize: pageSize.value,
      search: filters.search || undefined,
      status: filters.status || undefined,
      agentId: filters.agentId || undefined,
      carrierId: filters.carrierId || undefined,
      polId: filters.polId || undefined,
      poeId: filters.poeId || undefined,
      podId: filters.podId || undefined,
      containerTypeId: filters.containerTypeId || undefined,
      currencyId: filters.currencyId || undefined,
      idtraNumber: filters.idtraNumber || undefined,
      quoNumber: filters.quoNumber || undefined,
      quoteDate: filters.quoteDate || undefined,
      validFrom: filters.validFrom || undefined,
      validTo: filters.validTo || undefined,
    })
    rows.value = result.items
    total.value = result.totalCount ?? result.items.length
    selectedIds.value = selectedIds.value.filter((id) => result.items.some((row) => row.id === id))
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las tarifas.')
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
    status: 'Open',
    agentId: '',
    carrierId: '',
    polId: '',
    poeId: '',
    podId: '',
    containerTypeId: '',
    currencyId: '',
    idtraNumber: '',
    quoNumber: '',
    quoteDate: '',
    validFrom: '',
    validTo: '',
  })
  applyFilters()
}

function toggleSelection(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}

function openDetail(rate: RateDto) {
  router.push({ name: 'pricing-rate-wizard', params: { rateId: rate.id }, query: { mode: 'view' } })
}

function openEdit(rate: RateDto) {
  router.push({ name: 'pricing-rate-wizard', params: { rateId: rate.id }, query: { mode: 'edit' } })
}

function duplicate(rate: RateDto) {
  modalStore.open({
    title: 'Duplicar tarifa',
    component: PricingDuplicateRateModal,
    props: { rate, onSaved: load },
  })
}

function confirmDelete() {
  if (!selectedIds.value.length) return
  modalStore.open({
    title: 'Eliminar tarifas',
    component: DhConfirmDialog,
    props: {
      title: 'Eliminar tarifas',
      message: `¿Desea eliminar ${selectedIds.value.length} tarifa${selectedIds.value.length === 1 ? '' : 's'}? Esta acción conserva la trazabilidad de auditoría.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        await PricingService.deleteRates(selectedIds.value)
        selectedIds.value = []
        modalStore.close()
        toastStore.success('Tarifas eliminadas')
        await load()
      },
      onCancel: modalStore.close,
    },
  })
}

watch([page, pageSize], load)
async function openRequestedRate() {
  const rateId = typeof route.query.rateId === 'string' ? route.query.rateId.trim() : ''
  if (!rateId) return

  try {
    const rate = await PricingService.getRate(rateId)
    openDetail(rate)
  } catch (error) {
    toastStore.backendError(error, 'La tarifa fue creada, pero no se pudo abrir su detalle.')
  }
}

useViewShortcuts({
  save: load,
  refresh: load,
})

watch(
  () => route.query.rateId,
  async (rateId, previousRateId) => {
    if (rateId && rateId !== previousRateId) await openRequestedRate()
  },
)

onMounted(async () => {
  await catalogs.loadAll()
  await load()
  await openRequestedRate()
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Tarifas oficiales"
      subtitle="Seguimiento comercial únicamente por Abiertas, Enviadas, Vencidas, Aceptadas y No aceptadas."
      :icon="ReceiptText"
    />

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="filters.search"
        title="Tarifas oficiales"
        :show-create="false"
        @refresh="load"
        @search="applyFilters"
        @filter="filtersOpen = !filtersOpen"
      >
        <template #description
          ><p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ total }} tarifas · Margen esperado 12%
            <span v-if="activeFiltersCount">
              · {{ activeFiltersCount }} filtro{{ activeFiltersCount === 1 ? '' : 's' }} activo{{
                activeFiltersCount === 1 ? '' : 's'
              }}</span
            >.
          </p></template
        >
      </DhCrudToolbar>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <span
          class="mr-1 text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]"
        >
          Categorías
        </span>
        <button
          v-for="option in quickStatusOptions"
          :key="option.value"
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-black transition"
          :class="
            filters.status === option.value
              ? 'border-[var(--dh-primary)] dh-bg-primary-soft text-[var(--dh-primary)]'
              : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-soft)] hover:border-[var(--dh-primary)]/50'
          "
          @click="applyQuickStatus(option.value)"
        >
          {{ option.label }}
        </button>
        <button
          v-if="activeFiltersCount"
          type="button"
          class="ml-auto text-xs font-black text-[var(--dh-primary)] hover:underline"
          @click="clearFilters"
        >
          Limpiar filtros
        </button>
      </div>

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
            v-model="filters.agentId"
            label="Agente"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.agentOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.carrierId"
            label="Naviera"
            :options="[{ label: 'Todas', value: '' }, ...catalogs.carrierOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.polId"
            label="POL"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.polOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.poeId"
            label="POE"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.poeOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.podId"
            label="POD"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.podOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.containerTypeId"
            label="Contenedor"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.containerOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.currencyId"
            label="Moneda"
            :options="[{ label: 'Todas', value: '' }, ...catalogs.currencyOptions.value]"
            placeholder=""
          />
          <DhInput v-model="filters.idtraNumber" label="Número IDTRA" placeholder="Buscar IDTRA" />
          <DhInput v-model="filters.quoNumber" label="Número QUO" placeholder="Buscar QUO" />
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
          empty-text="No hay tarifas que coincidan con los filtros."
          @row-click="openDetail"
        >
          <template #cell-selected="{ row }"
            ><div class="flex justify-center" @click.stop>
              <DhCheckbox
                :model-value="selectedIds.includes(row.id)"
                @update:model-value="toggleSelection(row.id)"
              /></div
          ></template>
          <template #cell-rate="{ row }">
            <div class="min-w-[320px]">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full dh-bg-primary-soft px-2.5 py-1 text-[11px] font-black text-[var(--dh-primary)]"
                >
                  {{ row.rateCode }}
                </span>
                <DhBadge :label="`REV ${row.revisionNumber || 1}`" variant="primary" />
                <DhBadge
                  :label="row.rateType === 'Spot' ? 'SPOT' : 'TARIFARIO'"
                  :variant="row.rateType === 'Spot' ? 'warning' : 'neutral'"
                />
                <span v-if="row.clientName" class="text-xs font-bold text-[var(--dh-text-soft)]">
                  {{ row.clientName }}
                </span>
              </div>
              <p class="mt-2 font-black text-[var(--dh-text)]">
                {{ routeLabel(displayRate(row)) }}
              </p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{
                  displayRate(row).incotermName || displayRate(row).incotermCode || 'Sin Incoterm'
                }}
                <span v-if="row.idtraNumber" class="font-black text-[var(--dh-primary)]"> · IDTRA {{ row.idtraNumber }}</span>
                <span v-if="row.quoNumber"> · {{ row.quoNumber }}</span>
              </p>
            </div>
          </template>
          <template #cell-logistics="{ row }">
            <div class="min-w-[210px]">
              <p class="font-black text-[var(--dh-text)]">
                {{ displayRate(row).carrierName || 'Sin naviera' }}
              </p>
              <p class="mt-1 text-sm font-bold text-[var(--dh-text-soft)]">
                {{ containerSummary(displayRate(row)) }}
              </p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                Agente: {{ displayRate(row).agentName || '—' }}
              </p>
            </div>
          </template>
          <template #cell-commercial="{ row }">
            <div class="min-w-[300px] text-right">
              <p class="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Costo / Venta / Margen</p>
              <div class="mt-1 grid grid-cols-[auto_auto] justify-end gap-x-2 gap-y-1 text-xs">
                <span class="font-semibold text-[var(--dh-text-muted)]">Costo</span>
                <strong>{{ formatMoney(rateFinancialSummary(row).costUsd, 'USD') }} / {{ formatMoney(rateFinancialSummary(row).costCrc, 'CRC') }}</strong>
                <span class="font-semibold text-[var(--dh-text-muted)]">Venta</span>
                <strong class="text-[var(--dh-primary)]">{{ formatMoney(rateFinancialSummary(row).saleUsd, 'USD') }} / {{ formatMoney(rateFinancialSummary(row).saleCrc, 'CRC') }}</strong>
                <span class="font-semibold text-[var(--dh-text-muted)]">Margen</span>
                <span class="flex justify-end">
                  <DhBadge :label="`${rateFinancialSummary(row).margin.toFixed(2)}%`" :variant="marginTone(rateFinancialSummary(row).margin)" />
                </span>
              </div>
            </div>
          </template>
          <template #cell-validity="{ row }">
            <div class="min-w-[155px]">
              <p class="text-sm font-black text-[var(--dh-text)]">
                {{ formatDate(row.validFrom) }}
              </p>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                hasta {{ formatDate(row.validTo) }}
              </p>
              <p class="mt-1 text-xs font-bold text-[var(--dh-text-soft)]">
                {{ row.freeDays }} días libres
              </p>
            </div>
          </template>
          <template #cell-status="{ row }"
            ><DhBadge :label="statusLabel(row.status)" :variant="statusTone(row.status)"
          /></template>
          <template #cell-actions="{ row }"
            ><div class="flex justify-end gap-1">
              <button
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                title="Ver en wizard"
                @click.stop="openDetail(row)"
              >
                <Eye class="h-4 w-4" /></button
              ><button
                v-if="canUpdate"
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                title="Editar en wizard"
                @click.stop="openEdit(row)"
              >
                <Edit3 class="h-4 w-4" /></button
              ><button
                v-if="canCreate"
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                title="Duplicar"
                @click.stop="duplicate(row)"
              >
                <Copy class="h-4 w-4" />
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
