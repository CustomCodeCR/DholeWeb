<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { CircleDollarSign, FileSpreadsheet, Pencil, Power, PowerOff, Trash2 } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import {
  DhCrudToolbar,
  DhDataTable,
  DhPagination,
  type DhTableColumn,
} from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapPagedResponse } from '@/core/api/apiResponse'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type {
  ChargeBasis,
  CostDetailType,
  CostDto,
  CostType,
} from '@/core/interfaces/pricing'
import PricingCostFormDrawer from '@/modules/pricing/components/PricingCostFormDrawer.vue'
import PricingMultiSelect from '@/modules/pricing/components/PricingMultiSelect.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatMoney } from '@/modules/pricing/utils/pricingFormat'

const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const displayCost = (cost: CostDto) => catalogs.resolveCostLabels(cost)

const rows = ref<CostDto[]>([])
const loading = ref(false)
const exporting = ref(false)
const filtersOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filters = reactive({
  search: '',
  costType: [] as string[],
  costDetailType: [] as string[],
  carrierId: [] as string[],
  agentId: [] as string[],
  portRole: [] as string[],
  currencyId: [] as string[],
  active: [] as string[],
})

const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.costs.create))
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.costs.update))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.costs.delete))
const canSetActive = computed(() => authStore.hasScope(PRICING_SCOPES.costs.setActive))

const columns: DhTableColumn<CostDto>[] = [
  { key: 'name', label: 'Costo', width: '170px' },
  { key: 'costType', label: 'Aplicación', width: '108px' },
  { key: 'costDetailType', label: 'Rubro', width: '120px' },
  { key: 'relation', label: 'Naviera / agente', width: '165px' },
  { key: 'portName', label: 'Ruta / puerto', width: '290px' },
  { key: 'incoterms', label: 'Incoterms', width: '130px' },
  { key: 'operationalConditions', label: 'Pantalla 4', width: '190px' },
  { key: 'costAmount', label: 'Costo', align: 'right', width: '110px' },
  { key: 'saleAmount', label: 'Venta', align: 'right', width: '110px' },
  { key: 'utilityAmount', label: 'Utilidad', align: 'right', width: '110px' },
  { key: 'chargeBasis', label: 'Base de cobro', align: 'center', width: '150px' },
  { key: 'isActive', label: 'Estado', align: 'center', width: '105px' },
  { key: 'actions', label: '', align: 'right', width: '132px' },
]

const typeOptions = [
  { label: 'Fijo automático', value: 'Fixed' },
  { label: 'Opcional', value: 'Optional' },
  { label: 'Variable', value: 'Variable' },
]
const detailOptions = [
  { label: 'Flete internacional', value: 'Freight' },
  { label: 'Costo de agente', value: 'AgentCharge' },
  { label: 'Origen', value: 'OriginCharge' },
  { label: 'Destino', value: 'DestinationCharge' },
  { label: 'Puerto', value: 'PortCharge' },
  { label: 'Aduana', value: 'CustomsCharge' },
  { label: 'Transporte interno', value: 'InlandTransport' },
  { label: 'Documentación', value: 'Documentation' },
  { label: 'Seguro', value: 'Insurance' },
  { label: 'Otro', value: 'Other' },
]
const portRoleOptions = [
  { label: 'POL', value: 'Pol' },
  { label: 'POE', value: 'Poe' },
  { label: 'POD', value: 'Pod' },
  { label: 'Cualquier punto', value: 'Any' },
]
const activeOptions = [
  { label: 'Activos', value: 'true' },
  { label: 'Inactivos', value: 'false' },
]

function typeLabel(value: CostType) {
  return (
    { Fixed: 'Fijo', Optional: 'Opcional', Variable: 'Variable' } as Record<CostType, string>
  )[value]
}

function detailLabel(value: CostDetailType) {
  return (
    {
      Freight: 'Flete',
      AgentCharge: 'Agente',
      OriginCharge: 'Origen',
      DestinationCharge: 'Destino',
      PortCharge: 'Puerto',
      CustomsCharge: 'Aduana',
      InlandTransport: 'Transporte interno',
      Documentation: 'Documentación',
      Insurance: 'Seguro',
      Other: 'Otro',
    } as Record<CostDetailType, string>
  )[value]
}

const operationalConditionLabels: Record<string, string> = {
  DangerousCargo: 'Carga peligrosa',
  Overweight: 'Sobrepeso · 3 ejes',
  MerchantHaulage: 'Merchant',
  CarrierHaulage: 'Naviera',
  EmptyReturn: 'Retiro de vacío',
  ElectronicSeal: 'Marchamo electrónico',
  Anticipado: 'Anticipado',
  Redestino: 'Redestino',
  FiscalCargo: 'Carga fiscal',
  NationalizedCargo: 'Carga nacionalizada',
}

function chargeBasisLabel(value: unknown) {
  const basis = value as ChargeBasis
  return (
    (
      {
        PerShipment: 'Por embarque',
        PerService: 'Por Servicio',
        PerContainer: 'Por contenedor',
        PerTeu: 'Por TEU',
        PerPickup: 'Por recolecta',
        PerTruck: 'Por camión',
        PerCbm: 'Por CBM',
        PerChargeableCbm: 'Por CBM cobrable',
        PerCft: 'Por CFT',
        PerChargeableCft: 'Por CFT cobrable',
        PerKg: 'Por KG',
        Per100Kg: 'Por 100 KG',
        PerTon: 'Por tonelada',
        PerPallet: 'Por pallet',
        PerPackage: 'Por bulto',
        PerDocument: 'Por BL / documento',
      } as Record<ChargeBasis, string>
    )[basis] ?? String(value ?? '—')
  )
}

function effectiveChargeBasis(cost: CostDto): ChargeBasis {
  if (cost.isAccountant && cost.chargeBasis === 'PerShipment') {
    const modes =
      cost.shipmentModes?.length ? cost.shipmentModes : cost.shipmentMode ? [cost.shipmentMode] : []
    return modes.length === 1 && modes[0] === 'Ftl' ? 'PerTruck' : 'PerContainer'
  }

  return cost.chargeBasis
}

function routeDisplay(cost: CostDto) {
  const current = displayCost(cost)

  const build = (
    role: 'POL' | 'POE' | 'POD',
    relations: CostDto['pols'],
    legacyId?: string | null,
    legacyName?: string | null,
    legacyCode?: string | null,
  ) => {
    const names = (relations ?? [])
      .map((item) => item.name || item.code)
      .filter((value): value is string => Boolean(value))

    const resolved = names.length
      ? names
      : legacyId
        ? [legacyName || legacyCode || '—']
        : []

    if (!resolved.length) return null

    return {
      role,
      preview: resolved.slice(0, 2).join(', '),
      remaining: Math.max(0, resolved.length - 2),
      full: resolved.join(', '),
    }
  }

  const routes = [
    build('POL', current.pols, current.polId, current.polName, current.polCode),
    build('POE', current.poes, current.poeId, current.poeName, current.poeCode),
    build('POD', current.pods, current.podId, current.podName, current.podCode),
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  if (routes.length) return routes

  if (current.portId) {
    return [{
      role: (current.portRole || 'ANY').toUpperCase(),
      preview: current.portName || current.portCode || '—',
      remaining: 0,
      full: current.portName || current.portCode || '—',
    }]
  }

  return [{
    role: 'RUTA',
    preview: 'Sin condición de ruta',
    remaining: 0,
    full: 'Sin condición de ruta',
  }]
}

function relationSummary(cost: CostDto) {
  const current = displayCost(cost)
  const agentNames = (current.agents ?? [])
    .map((item) => item.name || item.code)
    .filter((value): value is string => Boolean(value))
  if (agentNames.length > 0) return { names: agentNames, type: 'Agente' }

  const carrierNames = (current.carriers ?? [])
    .map((item) => item.name || item.code)
    .filter((value): value is string => Boolean(value))
  if (carrierNames.length > 0) return { names: carrierNames, type: 'Naviera' }

  const legacyName = current.agentName || current.carrierName
  return {
    names: legacyName ? [legacyName] : [],
    type: current.agentId ? 'Agente' : current.carrierId ? 'Naviera' : 'Sin relación',
  }
}

function buildCostsQueryString() {
  const params = new URLSearchParams()
  const appendMany = (key: string, values: readonly string[]) => {
    values.forEach((value) => {
      const normalized = value.trim()
      if (normalized) params.append(key, normalized)
    })
  }

  params.set('pageNumber', String(page.value))
  params.set('pageSize', String(pageSize.value))
  if (filters.search.trim()) params.set('search', filters.search.trim())
  appendMany('costType', filters.costType)
  appendMany('costDetailType', filters.costDetailType)
  appendMany('carrierId', filters.carrierId)
  appendMany('agentId', filters.agentId)
  appendMany('portRole', filters.portRole)
  appendMany('currencyId', filters.currencyId)
  appendMany('isActive', filters.active)

  return `?${params.toString()}`
}

async function exportExcel() {
  try {
    exporting.value = true
    await PricingService.exportActiveCostsExcel()
    toastStore.success(
      'Excel generado',
      'DholeReports exportó todos los costos activos disponibles.',
    )
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron exportar los costos activos.')
  } finally {
    exporting.value = false
  }
}

async function load() {
  try {
    loading.value = true
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/costs' + buildCostsQueryString(),
      headers: { Accept: 'application/json' },
    })
    const result = unwrapPagedResponse<CostDto>(response)
    rows.value = result.items
    total.value = result.totalCount ?? result.items.length
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los costos.')
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
    costType: [],
    costDetailType: [],
    carrierId: [],
    agentId: [],
    portRole: [],
    currencyId: [],
    active: [],
  })
  applyFilters()
}

function openForm(cost?: CostDto) {
  drawerStore.open({
    title: cost ? 'Editar costo' : 'Nuevo costo',
    component: PricingCostFormDrawer,
    size: 'lg',
    props: { cost, onSaved: load },
  })
}

async function toggleActive(cost: CostDto) {
  try {
    await PricingService.setCostActive(cost.id, { isActive: !cost.isActive })
    toastStore.success(cost.isActive ? 'Costo inactivado' : 'Costo activado')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado del costo.')
  }
}

function confirmDelete(cost: CostDto) {
  modalStore.open({
    title: 'Eliminar costo',
    component: DhConfirmDialog,
    props: {
      title: 'Eliminar costo',
      message: `¿Desea eliminar “${cost.name}”? Las tarifas existentes conservarán su histórico.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        await PricingService.deleteCost(cost.id)
        modalStore.close()
        toastStore.success('Costo eliminado')
        await load()
      },
      onCancel: modalStore.close,
    },
  })
}

watch([page, pageSize], load)
useViewShortcuts({
  create: () => {
    if (canCreate.value) openForm()
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
      title="Costos"
      subtitle="Matriz maestra de costos fijos, opcionales y variables por naviera, agente y puerto."
      :icon="CircleDollarSign"
    >
      <template #actions>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <DhButton
            label="Exportar Excel"
            :icon="FileSpreadsheet"
            variant="secondary"
            :loading="exporting"
            :disabled="exporting"
            @click="exportExcel"
          />
          <DhButton v-if="canCreate" label="Nuevo costo" @click="openForm()" />
        </div>
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[24px] p-3 sm:rounded-[32px] sm:p-5">
      <DhCrudToolbar
        v-model:search="filters.search"
        title="Matriz de costos"
        create-label="Nuevo costo"
        :show-create="canCreate"
        @create="openForm()"
        @refresh="load"
        @search="applyFilters"
        @filter="filtersOpen = !filtersOpen"
      >
        <template #description
          ><p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ total }} rubros registrados. Los fijos coincidentes se aplican automáticamente.
          </p></template
        >
      </DhCrudToolbar>

      <div
        v-if="filtersOpen"
        class="mt-5 rounded-[26px] border border-[var(--dh-border)] bg-black/[0.025] p-4 dark:bg-white/[0.04]"
      >
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PricingMultiSelect
            v-model="filters.costType"
            label="Aplicación"
            :options="typeOptions"
            placeholder="Todas"
            search-placeholder="Buscar aplicación..."
          />
          <PricingMultiSelect
            v-model="filters.costDetailType"
            label="Rubro"
            :options="detailOptions"
            placeholder="Todos"
            search-placeholder="Buscar rubro..."
          />
          <PricingMultiSelect
            v-model="filters.carrierId"
            label="Naviera"
            :options="catalogs.carrierOptions.value"
            placeholder="Todas"
            search-placeholder="Buscar naviera..."
          />
          <PricingMultiSelect
            v-model="filters.agentId"
            label="Agente"
            :options="catalogs.agentOptions.value"
            placeholder="Todos"
            search-placeholder="Buscar agente..."
          />
          <PricingMultiSelect
            v-model="filters.portRole"
            label="Punto"
            :options="portRoleOptions"
            placeholder="Todos"
            search-placeholder="Buscar punto..."
          />
          <PricingMultiSelect
            v-model="filters.currencyId"
            label="Moneda"
            :options="catalogs.currencyOptions.value"
            placeholder="Todas"
            search-placeholder="Buscar moneda..."
          />
          <PricingMultiSelect
            v-model="filters.active"
            label="Estado"
            :options="activeOptions"
            placeholder="Todos"
            search-placeholder="Buscar estado..."
          />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <DhButton label="Limpiar" variant="ghost" size="sm" @click="clearFilters" /><DhButton
            label="Aplicar filtros"
            size="sm"
            @click="applyFilters"
          />
        </div>
      </div>

      <div class="mt-5">
        <DhDataTable
          :columns="columns"
          :rows="rows"
          :loading="loading"
          empty-text="No hay costos que coincidan con los filtros."
          @row-click="(row) => canUpdate && openForm(row)"
        >
          <template #cell-costType="{ value }"
            ><DhBadge
              :label="typeLabel(value as CostType)"
              :variant="
                value === 'Optional' ? 'primary' : value === 'Fixed' ? 'neutral' : 'warning'
              "
          /></template>
          <template #cell-costDetailType="{ value }"
            ><span class="font-bold text-[var(--dh-text-soft)]">{{
              detailLabel(value as CostDetailType)
            }}</span></template
          >
          <template #cell-relation="{ row }">
            <div class="max-w-[165px]">
              <p
                class="truncate font-black text-[var(--dh-text)]"
                :title="relationSummary(row).names.join(', ')"
              >
                {{ relationSummary(row).names.slice(0, 2).join(', ') || '—' }}
              </p>
              <div class="mt-1 flex flex-wrap items-center gap-1">
                <span class="text-[11px] font-semibold text-[var(--dh-text-muted)]">
                  {{ relationSummary(row).type }}
                </span>
                <DhBadge
                  v-if="relationSummary(row).names.length > 2"
                  :label="`+${relationSummary(row).names.length - 2}`"
                  variant="neutral"
                />
              </div>
            </div>
          </template>
          <template #cell-portName="{ row }">
            <div class="max-w-[290px] space-y-1.5">
              <div
                v-for="route in routeDisplay(row)"
                :key="`${route.role}:${route.full}`"
                class="grid min-w-0 grid-cols-[2.4rem_minmax(0,1fr)] items-start gap-1.5"
                :title="route.full"
              >
                <span class="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-center text-[9px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)] dark:bg-white/[0.06]">
                  {{ route.role }}
                </span>
                <p class="min-w-0 text-xs font-bold leading-4 text-[var(--dh-text-soft)]">
                  <span>{{ route.preview }}</span>
                  <span
                    v-if="route.remaining"
                    class="ml-1 whitespace-nowrap font-black text-[var(--dh-primary)]"
                  >
                    +{{ route.remaining }} más
                  </span>
                </p>
              </div>
            </div>
          </template>
          <template #cell-incoterms="{ row }">
            <div class="flex max-w-[130px] flex-wrap gap-1">
              <DhBadge v-if="!displayCost(row).incoterms?.length" label="Todos" variant="neutral" />
              <template v-else>
                <DhBadge
                  v-for="incoterm in displayCost(row).incoterms.slice(0, 3)"
                  :key="incoterm.id"
                  :label="incoterm.name || incoterm.code"
                  variant="primary"
                />
                <DhBadge
                  v-if="displayCost(row).incoterms.length > 3"
                  :label="`+${displayCost(row).incoterms.length - 3}`"
                  variant="neutral"
                />
              </template>
            </div>
          </template>
          <template #cell-operationalConditions="{ row }">
            <div class="flex max-w-[190px] flex-wrap gap-1">
              <DhBadge
                v-if="row.costType !== 'Optional' || !row.operationalConditions?.length"
                :label="row.costType === 'Optional' ? 'Manual' : '—'"
                variant="neutral"
              />
              <template v-else>
                <DhBadge
                  v-for="condition in (row.operationalConditions ?? []).slice(0, 2)"
                  :key="condition"
                  :label="operationalConditionLabels[condition] ?? condition"
                  variant="primary"
                />
                <DhBadge
                  v-if="(row.operationalConditions?.length ?? 0) > 2"
                  :label="`+${(row.operationalConditions?.length ?? 0) - 2}`"
                  variant="neutral"
                />
              </template>
            </div>
          </template>
          <template #cell-costAmount="{ row }"
            ><span class="whitespace-nowrap font-black">{{
              formatMoney(row.costAmount, displayCost(row).currencyName)
            }}</span></template
          >
          <template #cell-saleAmount="{ row }"
            ><span class="whitespace-nowrap font-black">{{
              formatMoney(row.saleAmount, displayCost(row).currencyName)
            }}</span></template
          >
          <template #cell-utilityAmount="{ row }"
            ><span
              class="whitespace-nowrap font-black"
              :class="
                row.utilityAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
              "
              >{{ formatMoney(row.utilityAmount, displayCost(row).currencyName) }}</span
            ></template
          >
          <template #cell-chargeBasis="{ row }"
            ><DhBadge
              :label="chargeBasisLabel(effectiveChargeBasis(row))"
              :variant="
                effectiveChargeBasis(row) === 'PerContainer' ||
                effectiveChargeBasis(row) === 'PerTruck'
                  ? 'primary'
                  : 'neutral'
              "
          /></template>
          <template #cell-isActive="{ value }"
            ><DhBadge
              :label="value ? 'Activo' : 'Inactivo'"
              :variant="value ? 'success' : 'neutral'"
          /></template>
          <template #cell-actions="{ row }">
            <div class="flex items-center justify-end gap-1">
              <button
                v-if="canUpdate"
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-black/[0.025] text-[var(--dh-text-soft)] transition hover:bg-black/[0.07] hover:text-[var(--dh-text)] dark:bg-white/[0.05] dark:hover:bg-white/[0.12]"
                aria-label="Editar costo"
                title="Editar"
                @click.stop="openForm(row)"
              >
                <Pencil class="h-[18px] w-[18px] shrink-0" />
              </button>
              <button
                v-if="canSetActive"
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-black/[0.025] transition hover:bg-black/[0.07] dark:bg-white/[0.05] dark:hover:bg-white/[0.12]"
                :aria-label="row.isActive ? 'Inactivar costo' : 'Activar costo'"
                :title="row.isActive ? 'Inactivar' : 'Activar'"
                @click.stop="toggleActive(row)"
              >
                <PowerOff v-if="row.isActive" class="h-[18px] w-[18px] shrink-0 text-amber-500" />
                <Power v-else class="h-[18px] w-[18px] shrink-0 text-emerald-500" />
              </button>
              <button
                v-if="canDelete"
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/[0.06] text-red-500 transition hover:bg-red-500/[0.14]"
                aria-label="Eliminar costo"
                title="Eliminar"
                @click.stop="confirmDelete(row)"
              >
                <Trash2 class="h-[18px] w-[18px] shrink-0" />
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