<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { BadgeDollarSign, Pencil, Power, PowerOff, Trash2 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms'
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
import type { CostDetailType, CostDto, CostPortRole, CostType } from '@/core/interfaces/pricing'
import PricingCostFormDrawer from '@/modules/pricing/components/PricingCostFormDrawer.vue'
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
const filtersOpen = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filters = reactive({
  search: '',
  costType: '' as CostType | '',
  costDetailType: '' as CostDetailType | '',
  carrierId: '',
  agentId: '',
  portRole: '' as CostPortRole | '',
  currencyId: '',
  active: '',
})

const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.costs.create))
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.costs.update))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.costs.delete))
const canSetActive = computed(() => authStore.hasScope(PRICING_SCOPES.costs.setActive))

const columns: DhTableColumn<CostDto>[] = [
  { key: 'name', label: 'Costo' },
  { key: 'costType', label: 'Aplicación' },
  { key: 'costDetailType', label: 'Rubro' },
  { key: 'relation', label: 'Naviera / agente' },
  { key: 'portName', label: 'Puerto' },
  { key: 'costAmount', label: 'Costo', align: 'right' },
  { key: 'saleAmount', label: 'Venta', align: 'right' },
  { key: 'utilityAmount', label: 'Utilidad', align: 'right' },
  { key: 'isAccountant', label: 'Contable', align: 'center' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right', width: '120px' },
]

const typeOptions = [
  { label: 'Todos', value: '' },
  { label: 'Fijo automático', value: 'Fixed' },
  { label: 'Opcional', value: 'Optional' },
  { label: 'Variable', value: 'Variable' },
]
const detailOptions = [
  { label: 'Todos', value: '' },
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
  { label: 'Todos', value: '' },
  { label: 'POL', value: 'Pol' },
  { label: 'POE', value: 'Poe' },
  { label: 'POD', value: 'Pod' },
  { label: 'Cualquier punto', value: 'Any' },
]
const activeOptions = [
  { label: 'Todos', value: '' },
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

async function load() {
  try {
    loading.value = true
    const result = await PricingService.browseCosts({
      pageNumber: page.value,
      pageSize: pageSize.value,
      search: filters.search || undefined,
      costType: filters.costType || undefined,
      costDetailType: filters.costDetailType || undefined,
      carrierId: filters.carrierId || undefined,
      agentId: filters.agentId || undefined,
      portRole: filters.portRole || undefined,
      currencyId: filters.currencyId || undefined,
      isActive: filters.active === '' ? undefined : filters.active === 'true',
    })
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
    costType: '',
    costDetailType: '',
    carrierId: '',
    agentId: '',
    portRole: '',
    currencyId: '',
    active: '',
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
      :icon="BadgeDollarSign"
    >
      <template v-if="canCreate" #actions
        ><DhButton label="Nuevo costo" @click="openForm()"
      /></template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
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
          <DhSelect
            v-model="filters.costType"
            label="Aplicación"
            :options="typeOptions"
            placeholder=""
          />
          <DhSelect
            v-model="filters.costDetailType"
            label="Rubro"
            :options="detailOptions"
            placeholder=""
          />
          <DhSelect
            v-model="filters.carrierId"
            label="Naviera"
            :options="[{ label: 'Todas', value: '' }, ...catalogs.carrierOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.agentId"
            label="Agente"
            :options="[{ label: 'Todos', value: '' }, ...catalogs.agentOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.portRole"
            label="Punto"
            :options="portRoleOptions"
            placeholder=""
          />
          <DhSelect
            v-model="filters.currencyId"
            label="Moneda"
            :options="[{ label: 'Todas', value: '' }, ...catalogs.currencyOptions.value]"
            placeholder=""
          />
          <DhSelect
            v-model="filters.active"
            label="Estado"
            :options="activeOptions"
            placeholder=""
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
          <template #cell-relation="{ row }"
            ><div>
              <p class="font-bold text-[var(--dh-text)]">
                {{ displayCost(row).agentName || displayCost(row).carrierName || '—' }}
              </p>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ row.agentId ? 'Agente' : row.carrierId ? 'Naviera' : 'Sin relación' }}
              </p>
            </div></template
          >
          <template #cell-portName="{ row }"
            ><div>
              <p class="font-bold">{{ displayCost(row).portName || 'Sin puerto específico' }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">
                {{ row.portRole || 'Cualquier punto' }}
              </p>
            </div></template
          >
          <template #cell-costAmount="{ row }"
            ><span class="font-bold">{{
              formatMoney(row.costAmount, displayCost(row).currencyName)
            }}</span></template
          >
          <template #cell-saleAmount="{ row }"
            ><span class="font-bold">{{
              formatMoney(row.saleAmount, displayCost(row).currencyName)
            }}</span></template
          >
          <template #cell-utilityAmount="{ row }"
            ><span
              class="font-black"
              :class="
                row.utilityAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
              "
              >{{ formatMoney(row.utilityAmount, displayCost(row).currencyName) }}</span
            ></template
          >
          <template #cell-isAccountant="{ value, row }"
            ><DhBadge
              :label="
                value || ['Freight', 'InlandTransport'].includes(row.costDetailType)
                  ? 'Por contenedor'
                  : 'Único'
              "
              :variant="
                value || ['Freight', 'InlandTransport'].includes(row.costDetailType)
                  ? 'primary'
                  : 'neutral'
              "
          /></template>
          <template #cell-isActive="{ value }"
            ><DhBadge
              :label="value ? 'Activo' : 'Inactivo'"
              :variant="value ? 'success' : 'neutral'"
          /></template>
          <template #cell-actions="{ row }"
            ><div class="flex justify-end gap-1">
              <button
                v-if="canUpdate"
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                title="Editar"
                @click.stop="openForm(row)"
              >
                <Pencil class="h-4 w-4" /></button
              ><button
                v-if="canSetActive"
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                :title="row.isActive ? 'Inactivar' : 'Activar'"
                @click.stop="toggleActive(row)"
              >
                <PowerOff v-if="row.isActive" class="h-4 w-4 text-amber-600" /><Power
                  v-else
                  class="h-4 w-4 text-emerald-600"
                /></button
              ><button
                v-if="canDelete"
                type="button"
                class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10"
                title="Eliminar"
                @click.stop="confirmDelete(row)"
              >
                <Trash2 class="h-4 w-4" />
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
