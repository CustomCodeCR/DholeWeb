<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Copy, Edit3, Eye, Plus, ReceiptText, Trash2 } from 'lucide-vue-next'
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
import type { RateDto, RateStatus } from '@/core/interfaces/pricing'
import PricingRateFormDrawer from '@/modules/pricing/components/PricingRateFormDrawer.vue'
import PricingRateDetailDrawer from '@/modules/pricing/components/PricingRateDetailDrawer.vue'
import PricingDuplicateRateModal from '@/modules/pricing/components/PricingDuplicateRateModal.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import {
  formatDate,
  formatMoney,
  marginTone,
  routeLabel,
  statusTone,
} from '@/modules/pricing/utils/pricingFormat'

const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const displayRate = (rate: RateDto) => catalogs.resolveRateLabels(rate)

const rows = ref<RateDto[]>([])
const selectedIds = ref<string[]>([])
const loading = ref(false)
const filtersOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filters = reactive({
  search: '',
  status: '' as RateStatus | '',
  approval: '',
  agentId: '',
  carrierId: '',
  polId: '',
  poeId: '',
  podId: '',
  containerTypeId: '',
  currencyId: '',
  quoteDate: '',
  validFrom: '',
  validTo: '',
})

const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create))
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.update))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.rates.delete))

const columns: DhTableColumn<RateDto>[] = [
  { key: 'selected', label: '', width: '48px', align: 'center' },
  { key: 'route', label: 'Ruta' },
  { key: 'agentName', label: 'Agente' },
  { key: 'carrierName', label: 'Naviera / contenedor' },
  { key: 'totalCostAmount', label: 'Costo', align: 'right' },
  { key: 'totalSaleAmount', label: 'Venta', align: 'right' },
  { key: 'totalUtilityAmount', label: 'Utilidad', align: 'right' },
  { key: 'marginPercentage', label: 'Margen', align: 'right' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right', width: '130px' },
]

const statusOptions = [
  { label: 'Todos', value: '' },
  { label: 'Aprobadas', value: 'Approved' },
  { label: 'Pendientes de autorización', value: 'PendingApproval' },
  { label: 'Borradores', value: 'Draft' },
  { label: 'Rechazadas', value: 'Rejected' },
  { label: 'Enviadas', value: 'Send' },
]
const approvalOptions = [
  { label: 'Todas', value: '' },
  { label: 'Requieren aprobación', value: 'true' },
  { label: 'Sin aprobación pendiente', value: 'false' },
]

function statusLabel(status: string) {
  return (
    (
      {
        Approved: 'Aprobada',
        PendingApproval: 'Pendiente',
        Draft: 'Borrador',
        Rejected: 'Rechazada',
        Send: 'Enviada',
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
      requiredApproval: filters.approval === '' ? undefined : filters.approval === 'true',
      agentId: filters.agentId || undefined,
      carrierId: filters.carrierId || undefined,
      polId: filters.polId || undefined,
      poeId: filters.poeId || undefined,
      podId: filters.podId || undefined,
      containerTypeId: filters.containerTypeId || undefined,
      currencyId: filters.currencyId || undefined,
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
    status: '',
    approval: '',
    agentId: '',
    carrierId: '',
    polId: '',
    poeId: '',
    podId: '',
    containerTypeId: '',
    currencyId: '',
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

function openCreate() {
  drawerStore.open({
    title: 'Crear tarifa manual',
    component: PricingRateFormDrawer,
    size: 'full',
    props: { onSaved: load },
  })
}

function openDetail(rate: RateDto) {
  drawerStore.open({
    title: `Tarifa · ${routeLabel(displayRate(rate))}`,
    component: PricingRateDetailDrawer,
    size: 'xl',
    props: { rate, onSaved: load },
  })
}

function openEdit(rate: RateDto) {
  drawerStore.open({
    title: 'Editar tarifa',
    component: PricingRateFormDrawer,
    size: 'full',
    props: { rate, onSaved: load },
  })
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
useViewShortcuts({
  create: () => {
    if (canCreate.value) openCreate()
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
      title="Tarifas"
      subtitle="Construya y revise tarifas FCL con costo, venta, utilidad y margen en una sola vista."
      :icon="ReceiptText"
    >
      <template v-if="canCreate" #actions
        ><DhButton label="Crear tarifa manual" :icon="Plus" @click="openCreate"
      /></template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="filters.search"
        title="Tarifas oficiales"
        create-label="Crear tarifa"
        :show-create="canCreate"
        @create="openCreate"
        @refresh="load"
        @search="applyFilters"
        @filter="filtersOpen = !filtersOpen"
      >
        <template #description
          ><p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ total }} tarifas · Margen esperado 12%.
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
            v-model="filters.approval"
            label="Aprobación"
            :options="approvalOptions"
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
          <template #cell-route="{ row }"
            ><div>
              <p class="font-black text-[var(--dh-text)]">{{ routeLabel(displayRate(row)) }}</p>
              <p class="mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ formatDate(row.validFrom) }} – {{ formatDate(row.validTo) }} ·
                {{ row.freeDays }} días libres
              </p>
            </div></template
          >
          <template #cell-agentName="{ row }"
            ><span class="font-bold">{{ displayRate(row).agentName || '—' }}</span></template
          >
          <template #cell-carrierName="{ row }"
            ><div>
              <p class="font-bold">{{ displayRate(row).carrierName }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">{{ displayRate(row).containerTypeName }}</p>
            </div></template
          >
          <template #cell-totalCostAmount="{ row }"
            ><span class="font-bold">{{
              formatMoney(row.totalCostAmount, displayRate(row).currencyName)
            }}</span></template
          >
          <template #cell-totalSaleAmount="{ row }"
            ><span class="font-black">{{
              formatMoney(row.totalSaleAmount, displayRate(row).currencyName)
            }}</span></template
          >
          <template #cell-totalUtilityAmount="{ row }"
            ><span
              class="font-black"
              :class="
                row.totalUtilityAmount >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500'
              "
              >{{ formatMoney(row.totalUtilityAmount, displayRate(row).currencyName) }}</span
            ></template
          >
          <template #cell-marginPercentage="{ row }"
            ><div class="flex items-center justify-end gap-2">
              <span class="font-black">{{ row.marginPercentage.toFixed(2) }}%</span
              ><DhBadge
                :label="row.marginPercentage >= 12 ? 'OK' : 'Bajo'"
                :variant="marginTone(row.marginPercentage)"
              /></div
          ></template>
          <template #cell-status="{ row }"
            ><DhBadge :label="statusLabel(row.status)" :variant="statusTone(row.status)"
          /></template>
          <template #cell-actions="{ row }"
            ><div class="flex justify-end gap-1">
              <button
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                title="Ver detalle"
                @click.stop="openDetail(row)"
              >
                <Eye class="h-4 w-4" /></button
              ><button
                v-if="canUpdate"
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                title="Editar"
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
