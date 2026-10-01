<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'
import { BadgeDollarSign, Info, Save } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PricingService } from '@/core/services/pricingService'
import type {
  ChargeBasis,
  CostDetailType,
  CostDto,
  CostOperationalCondition,
  CostType,
  CreateCostRequest,
  ShipmentMode,
} from '@/core/interfaces/pricing'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import PricingMultiSelect from './PricingMultiSelect.vue'
import { formatMoney } from '@/modules/pricing/utils/pricingFormat'

type CostShipmentMode = ShipmentMode | 'Any'

function initialShipmentModes(cost?: CostDto): CostShipmentMode[] {
  const configured = cost?.shipmentModes?.filter(
    (mode): mode is ShipmentMode => Boolean(mode),
  ) ?? []

  if (configured.length > 0) return [...new Set(configured)]
  if (cost?.shipmentMode) return [cost.shipmentMode]
  return ['Any']
}

type CostRouteScope =
  | ''
  | 'Any'
  | 'Pol'
  | 'Poe'
  | 'Pod'
  | 'PolPoe'
  | 'PoePod'
  | 'PodPol'
  | 'PolPoePod'

function initialRouteScope(cost?: CostDto): CostRouteScope {
  const roles = [
    cost?.polId ? 'Pol' : '',
    cost?.poeId ? 'Poe' : '',
    cost?.podId ? 'Pod' : '',
  ].filter(Boolean)
  if (roles.length === 3) return 'PolPoePod'
  if (roles.includes('Pol') && roles.includes('Poe')) return 'PolPoe'
  if (roles.includes('Poe') && roles.includes('Pod')) return 'PoePod'
  if (roles.includes('Pod') && roles.includes('Pol')) return 'PodPol'
  if (roles.length === 1) return roles[0] as CostRouteScope
  if (cost?.portId) return (cost.portRole ?? 'Any') as CostRouteScope
  return ''
}

const props = defineProps<{ cost?: CostDto; onSaved?: () => void | Promise<void> }>()
const { locale, t } = useI18n()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

function initialChargeBasis(cost?: CostDto): ChargeBasis {
  if (!cost) return 'PerShipment'

  // Compatibility for costs created before chargeBasis existed. The old
  // isAccountant=true flag meant that the value was applied per equipment unit.
  if (cost.isAccountant && cost.chargeBasis === 'PerShipment') {
    const modes = initialShipmentModes(cost).filter(
      (mode): mode is ShipmentMode => mode !== 'Any',
    )
    return modes.length === 1 && modes[0] === 'Ftl' ? 'PerTruck' : 'PerContainer'
  }

  return cost.chargeBasis ?? 'PerShipment'
}

const form = reactive({
  name: props.cost?.name ?? '',
  costType: (props.cost?.costType ?? 'Fixed') as CostType,
  costDetailType: (props.cost?.costDetailType ?? 'DestinationCharge') as CostDetailType,
  shipmentModes: initialShipmentModes(props.cost),
  chargeBasis: initialChargeBasis(props.cost),
  minimumCostAmount: String(props.cost?.minimumCostAmount ?? ''),
  minimumSaleAmount: String(props.cost?.minimumSaleAmount ?? ''),
  kgPerCbm: String(props.cost?.kgPerCbm ?? ''),
  associationType: (props.cost?.agentId ? 'Agent' : props.cost?.carrierId ? 'Carrier' : 'None') as
    | 'None'
    | 'Agent'
    | 'Carrier',
  carrierId: props.cost?.carrierId ?? '',
  agentId: props.cost?.agentId ?? '',
  routeScope: initialRouteScope(props.cost),
  portId: props.cost?.portId ?? '',
  polId: props.cost?.polId ?? (props.cost?.portRole === 'Pol' ? (props.cost?.portId ?? '') : ''),
  poeId: props.cost?.poeId ?? (props.cost?.portRole === 'Poe' ? (props.cost?.portId ?? '') : ''),
  podId: props.cost?.podId ?? (props.cost?.portRole === 'Pod' ? (props.cost?.portId ?? '') : ''),
  incotermIds: props.cost?.incoterms?.map((item) => item.id) ?? [],
  serviceIds: props.cost?.services?.map((item) => item.id) ?? [],
  operationalConditionIds: [...(props.cost?.operationalConditions ?? [])] as CostOperationalCondition[],
  currencyId: props.cost?.currencyId ?? '',
  costAmount: String(props.cost?.costAmount ?? ''),
  saleAmount: String(props.cost?.saleAmount ?? ''),
  isAccountant: props.cost?.isAccountant ?? false,
  notes: props.cost?.notes ?? '',
  saving: false,
  submitted: false,
})

const isAgentCost = computed(() => form.associationType === 'Agent')
const isAgentSaleDisabled = computed(() => form.costDetailType === 'AgentCharge')
const isCarrierCost = computed(() => form.associationType === 'Carrier')
const isEquipmentBasis = computed(
  () => form.chargeBasis === 'PerContainer' || form.chargeBasis === 'PerTruck',
)
const shipmentModeSelection = computed<string[]>({
  get: () => form.shipmentModes,
  set: (value) => {
    const unique = [...new Set(value)] as CostShipmentMode[]
    const hadAny = form.shipmentModes.includes('Any')

    if (unique.includes('Any')) {
      form.shipmentModes =
        hadAny && unique.length > 1 ? unique.filter((mode) => mode !== 'Any') : ['Any']
      return
    }

    form.shipmentModes = unique.length > 0 ? unique : ['Any']
  },
})
const concreteShipmentModes = computed<ShipmentMode[]>(() =>
  form.shipmentModes.filter((mode): mode is ShipmentMode => mode !== 'Any'),
)
const shipmentModeSummary = computed(() =>
  concreteShipmentModes.value.length > 0
    ? concreteShipmentModes.value.map((mode) => mode.toUpperCase()).join(' / ')
    : 'TODAS',
)

function suggestedChargeBasis(modes: readonly ShipmentMode[]): ChargeBasis | null {
  if (modes.length === 1 && modes[0] === 'Fcl') return 'PerContainer'
  if (modes.length === 1 && modes[0] === 'Ftl') return 'PerTruck'
  if (modes.length > 0 && modes.every((mode) => mode === 'Lcl' || mode === 'Ltl')) {
    return 'PerChargeableCbm'
  }
  return null
}

const perServiceId = computed<string>({
  get: () => form.serviceIds[0] ?? '',
  set: (value) => {
    form.serviceIds = value ? [value] : []
  },
})
const utility = computed(() => Number(form.saleAmount || 0) - Number(form.costAmount || 0))
const anyPortOptions = computed(() =>
  [...catalogs.polOptions.value, ...catalogs.poeOptions.value, ...catalogs.podOptions.value].filter(
    (option, index, values) => values.findIndex((item) => item.value === option.value) === index,
  ),
)

function scopeIncludes(role: 'Pol' | 'Poe' | 'Pod') {
  return form.routeScope.includes(role)
}

const routeSelectionValid = computed(() => {
  if (!form.routeScope) return true
  if (form.routeScope === 'Any') return Boolean(form.portId)
  if (scopeIncludes('Pol') && !form.polId) return false
  if (scopeIncludes('Poe') && !form.poeId) return false
  if (scopeIncludes('Pod') && !form.podId) return false
  return true
})

const costTypeOptions = [
  { label: 'Fijo automático', value: 'Fixed' },
  { label: 'Opcional', value: 'Optional' },
  { label: 'Variable', value: 'Variable' },
]

const operationalConditionOptions: Array<{ label: string; value: CostOperationalCondition }> = [
  { label: 'Carga peligrosa', value: 'DangerousCargo' },
  { label: 'Sobrepeso · 3 ejes', value: 'Overweight' },
  { label: 'Merchant', value: 'MerchantHaulage' },
  { label: 'Naviera', value: 'CarrierHaulage' },
  { label: 'Retiro de vacío', value: 'EmptyReturn' },
  { label: 'Marchamo electrónico', value: 'ElectronicSeal' },
  { label: 'Anticipado', value: 'Anticipado' },
  { label: 'Redestino', value: 'Redestino' },
  { label: 'Carga fiscal', value: 'FiscalCargo' },
  { label: 'Carga nacionalizada', value: 'NationalizedCargo' },
]

const shipmentModeOptions: Array<{ label: string; value: CostShipmentMode }> = [
  { label: 'Any · Todas las modalidades', value: 'Any' },
  { label: 'FCL · Contenedor completo', value: 'Fcl' },
  { label: 'LCL · Marítimo consolidado', value: 'Lcl' },
  { label: 'FTL · Camión completo', value: 'Ftl' },
  { label: 'LTL · Terrestre consolidado', value: 'Ltl' },
]

const chargeBasisOptions: Array<{ label: string; value: ChargeBasis }> = [
  { label: 'Por embarque', value: 'PerShipment' },
  { label: 'Por recolecta', value: 'PerPickup' },
  { label: 'Por Servicio', value: 'PerService' },
  { label: 'Por contenedor', value: 'PerContainer' },
  { label: 'Por TEU', value: 'PerTeu' },
  { label: 'Por camión', value: 'PerTruck' },
  { label: 'Por CBM', value: 'PerCbm' },
  { label: 'Por CBM cobrable', value: 'PerChargeableCbm' },
  { label: 'Por KG', value: 'PerKg' },
  { label: 'Por 100 KG', value: 'Per100Kg' },
  { label: 'Por tonelada', value: 'PerTon' },
  { label: 'Por pallet', value: 'PerPallet' },
  { label: 'Por bulto', value: 'PerPackage' },
  { label: 'Por BL / documento', value: 'PerDocument' },
]

const detailTypeOptions: Array<{ label: string; value: CostDetailType }> = [
  { label: 'Flete internacional', value: 'Freight' },
  { label: 'Costo de agente', value: 'AgentCharge' },
  { label: 'Cargo en origen', value: 'OriginCharge' },
  { label: 'Cargo en destino', value: 'DestinationCharge' },
  { label: 'Cargo portuario', value: 'PortCharge' },
  { label: 'Aduana', value: 'CustomsCharge' },
  { label: 'Transporte interno', value: 'InlandTransport' },
  { label: 'Documentación', value: 'Documentation' },
  { label: 'Seguro', value: 'Insurance' },
  { label: 'Otro', value: 'Other' },
]

const routeScopeOptions: Array<{ label: string; value: CostRouteScope }> = [
  { label: 'Sin condición de ruta', value: '' },
  { label: 'Cualquier punto específico', value: 'Any' },
  { label: 'POL', value: 'Pol' },
  { label: 'POE', value: 'Poe' },
  { label: 'POD', value: 'Pod' },
  { label: 'POL + POE', value: 'PolPoe' },
  { label: 'POE + POD', value: 'PoePod' },
  { label: 'POD + POL', value: 'PodPol' },
  { label: 'POL + POE + POD', value: 'PolPoePod' },
]

const associationTypeOptions = [
  { label: 'Sin asociación', value: 'None' },
  { label: 'Naviera', value: 'Carrier' },
  { label: 'Agente', value: 'Agent' },
]

function fieldError(value: string, message: string) {
  return form.submitted && !value ? message : undefined
}

function selected<T extends { id: string }>(items: T[], id: string) {
  return items.find((item) => item.id === id)
}

watch(
  () => form.associationType,
  (associationType) => {
    if (associationType === 'Agent') {
      // Asociar el costo a un agente solo filtra su aplicabilidad.
      // No convierte automáticamente el rubro en "Costo de agente".
      form.carrierId = ''
      return
    }

    form.agentId = ''
    if (associationType === 'None') form.carrierId = ''
    if (form.costDetailType === 'AgentCharge') form.costDetailType = 'DestinationCharge'
  },
)

watch(isAgentSaleDisabled, (disabled) => {
  if (disabled) form.saleAmount = '0'
})

watch(
  () => form.costType,
  (costType) => {
    if (costType !== 'Optional') form.operationalConditionIds = []
  },
)

watch(
  () => [form.costDetailType, concreteShipmentModes.value.join('|')] as const,
  ([detailType]) => {
    if (!props.cost && detailType === 'Documentation' && form.chargeBasis === 'PerShipment') {
      form.chargeBasis = 'PerDocument'
      return
    }

    if (!['Freight', 'InlandTransport'].includes(detailType)) return
    if (form.chargeBasis !== 'PerShipment' || props.cost) return

    const suggested = suggestedChargeBasis(concreteShipmentModes.value)
    if (suggested) form.chargeBasis = suggested
  },
  { immediate: true },
)

watch(
  () => form.costDetailType,
  (detailType, previousDetailType) => {
    if (props.cost) return
    if (
      previousDetailType === 'Documentation' &&
      detailType !== 'Documentation' &&
      form.chargeBasis === 'PerDocument'
    ) {
      if (detailType === 'Freight' || detailType === 'InlandTransport') {
        form.chargeBasis = suggestedChargeBasis(concreteShipmentModes.value) ?? 'PerShipment'
      } else {
        form.chargeBasis = 'PerShipment'
      }
    }
  },
)

watch(
  () => form.chargeBasis,
  (basis) => {
    form.isAccountant = basis === 'PerContainer' || basis === 'PerTruck'
    if (basis === 'PerService' && form.serviceIds.length > 1) {
      form.serviceIds = form.serviceIds.slice(0, 1)
    }
  },
  { immediate: true },
)

watch(
  () => form.routeScope,
  (scope) => {
    if (scope !== 'Any') form.portId = ''
    if (!scope.includes('Pol')) form.polId = ''
    if (!scope.includes('Poe')) form.poeId = ''
    if (!scope.includes('Pod')) form.podId = ''
  },
)

async function submit() {
  form.submitted = true
  const carrier = selected(catalogs.carriers.value, form.carrierId)
  const agent = selected(catalogs.agents.value, form.agentId)
  const port = selected(
    [...catalogs.polPorts.value, ...catalogs.poePorts.value, ...catalogs.podPorts.value],
    form.portId,
  )
  const pol = selected(catalogs.polPorts.value, form.polId)
  const poe = selected(catalogs.poePorts.value, form.poeId)
  const pod = selected(catalogs.podPorts.value, form.podId)
  const currency = selected(catalogs.currencies.value, form.currencyId)
  const incoterms = form.incotermIds
    .map((id) => selected(catalogs.incoterms.value, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ id: item.id, name: item.name, code: item.code }))
  const services = form.serviceIds
    .map((id) => selected(catalogs.services.value, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ id: item.id, name: item.name, code: item.code }))

  if (
    !form.name.trim() ||
    !currency ||
    (isAgentCost.value && !agent) ||
    (isCarrierCost.value && !carrier) ||
    !routeSelectionValid.value ||
    (form.chargeBasis === 'PerService' && services.length !== 1) ||
    Number(form.costAmount) < 0 ||
    Number(form.saleAmount) < 0 ||
    (form.minimumCostAmount !== '' && Number(form.minimumCostAmount) < 0) ||
    (form.minimumSaleAmount !== '' && Number(form.minimumSaleAmount) < 0) ||
    (form.kgPerCbm !== '' && Number(form.kgPerCbm) <= 0)
  )
    return

  const shipmentModes = concreteShipmentModes.value

  const payload: CreateCostRequest = {
    name: form.name.trim(),
    costType: form.costType,
    costDetailType: form.costDetailType,
    carrierId: carrier?.id ?? null,
    carrierName: carrier?.name ?? null,
    carrierCode: carrier?.code ?? null,
    agentId: agent?.id ?? null,
    agentName: agent?.name ?? null,
    agentCode: agent?.code ?? null,
    portId: form.routeScope === 'Any' ? (port?.id ?? null) : null,
    portName: form.routeScope === 'Any' ? (port?.name ?? null) : null,
    portCode: form.routeScope === 'Any' ? (port?.code ?? null) : null,
    portRole: form.routeScope === 'Any' && port ? 'Any' : null,
    polId: scopeIncludes('Pol') ? (pol?.id ?? null) : null,
    polName: scopeIncludes('Pol') ? (pol?.name ?? null) : null,
    polCode: scopeIncludes('Pol') ? (pol?.code ?? null) : null,
    poeId: scopeIncludes('Poe') ? (poe?.id ?? null) : null,
    poeName: scopeIncludes('Poe') ? (poe?.name ?? null) : null,
    poeCode: scopeIncludes('Poe') ? (poe?.code ?? null) : null,
    podId: scopeIncludes('Pod') ? (pod?.id ?? null) : null,
    podName: scopeIncludes('Pod') ? (pod?.name ?? null) : null,
    podCode: scopeIncludes('Pod') ? (pod?.code ?? null) : null,
    currencyId: currency.id,
    currencyName: currency.name,
    currencyCode: currency.code,
    costAmount: Number(form.costAmount),
    saleAmount: isAgentSaleDisabled.value ? 0 : Number(form.saleAmount),
    notes: form.notes.trim() || null,
    isAccountant: isEquipmentBasis.value,
    incoterms,
    services,
    operationalConditions:
      form.costType === 'Optional' ? [...form.operationalConditionIds] : [],
    // Empty shipmentModes means "Any". Keep shipmentMode for backwards compatibility.
    shipmentMode: shipmentModes.length === 1 ? shipmentModes[0] : null,
    shipmentModes: [...shipmentModes],
    chargeBasis: form.chargeBasis,
    minimumCostAmount: form.minimumCostAmount === '' ? null : Number(form.minimumCostAmount),
    minimumSaleAmount: form.minimumSaleAmount === '' ? null : Number(form.minimumSaleAmount),
    kgPerCbm: form.kgPerCbm === '' ? null : Number(form.kgPerCbm),
  }

  try {
    form.saving = true
    if (props.cost) await PricingService.updateCost(props.cost.id, payload)
    else await PricingService.createCost(payload)
    toastStore.success(
      props.cost ? 'Costo actualizado' : 'Costo creado',
      'La matriz de costos quedó actualizada.',
    )
    drawerStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(
      error,
      props.cost ? 'No se pudo actualizar el costo.' : 'No se pudo crear el costo.',
    )
  } finally {
    form.saving = false
  }
}

onMounted(catalogs.loadAll)
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-5 flex items-start gap-3">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] dh-bg-primary-soft text-[var(--dh-primary)]"
        >
          <BadgeDollarSign class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-black text-[var(--dh-text)]">Identificación del costo</h3>
          <p class="mt-1 text-sm font-medium text-[var(--dh-text-muted)]">
            Defina cómo se aplicará este rubro al construir una tarifa.
          </p>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <DhInput
          v-model="form.name"
          label="Nombre"
          placeholder="THC, handling, BL..."
          :error="fieldError(form.name, 'Indique un nombre.')"
        />
        <DhSelect v-model="form.costType" label="Aplicación" :options="costTypeOptions" />
        <DhSelect v-model="form.costDetailType" label="Rubro" :options="detailTypeOptions" />
        <PricingMultiSelect
          v-model="shipmentModeSelection"
          label="Modalidad aplicable"
          placeholder="Seleccione una o varias modalidades"
          search-placeholder="Buscar modalidad..."
          :options="shipmentModeOptions"
        />
        <DhSelect v-model="form.chargeBasis" label="Base de cobro" :options="chargeBasisOptions" />
        <DhSelect
          v-if="form.chargeBasis === 'PerService'"
          v-model="perServiceId"
          label="Servicio de Pricing"
          placeholder="Seleccione el servicio"
          :options="catalogs.serviceOptions.value"
          :error="form.submitted && !perServiceId ? 'Seleccione el servicio de Pricing.' : undefined"
        />
        <DhSelect
          v-model="form.routeScope"
          label="Condición de ruta"
          :options="routeScopeOptions"
        />
      </div>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <h3 class="font-black text-[var(--dh-text)]">Relaciones operativas</h3>
      <p class="mb-5 mt-1 text-sm font-medium text-[var(--dh-text-muted)]">
        Los selects guardan el identificador y su snapshot para conservar el histórico.
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <DhSelect
          v-model="form.associationType"
          label="Costo asociado a"
          :options="associationTypeOptions"
        />
        <DhSelect
          v-if="isAgentCost"
          v-model="form.agentId"
          label="Agente"
          placeholder="Seleccione agente"
          :options="catalogs.agentOptions.value"
          :error="fieldError(form.agentId, 'Seleccione el agente.')"
        />
        <DhSelect
          v-else-if="isCarrierCost"
          v-model="form.carrierId"
          label="Naviera"
          placeholder="Seleccione naviera"
          :options="catalogs.carrierOptions.value"
          :error="fieldError(form.carrierId, 'Seleccione la naviera.')"
        />
        <DhSelect
          v-if="form.routeScope === 'Any'"
          v-model="form.portId"
          label="Puerto aplicable en cualquier punto"
          placeholder="Seleccione puerto"
          :options="anyPortOptions"
          :error="fieldError(form.portId, 'Seleccione el puerto.')"
        />
        <DhSelect
          v-if="scopeIncludes('Pol')"
          v-model="form.polId"
          label="POL · Puerto de origen"
          placeholder="Seleccione POL"
          :options="catalogs.polOptions.value"
          :error="fieldError(form.polId, 'Seleccione el POL.')"
        />
        <DhSelect
          v-if="scopeIncludes('Poe')"
          v-model="form.poeId"
          label="POE · Puerto de entrada"
          placeholder="Seleccione POE"
          :options="catalogs.poeOptions.value"
          :error="fieldError(form.poeId, 'Seleccione el POE.')"
        />
        <DhSelect
          v-if="scopeIncludes('Pod')"
          v-model="form.podId"
          label="POD · Destino final"
          placeholder="Seleccione POD"
          :options="catalogs.podOptions.value"
          :error="fieldError(form.podId, 'Seleccione el POD.')"
        />
        <DhSelect
          v-model="form.currencyId"
          label="Moneda"
          placeholder="Seleccione moneda"
          :options="catalogs.currencyOptions.value"
          :error="fieldError(form.currencyId, 'Seleccione la moneda.')"
        />
        <div v-if="form.chargeBasis !== 'PerService'" class="md:col-span-2">
          <PricingMultiSelect
            v-model="form.serviceIds"
            :options="catalogs.serviceOptions.value"
            label="Servicios de Pricing asociados"
            placeholder="Aplica a cualquier servicio"
            empty-text="No hay servicios activos en pricing-services."
            search-placeholder="Buscar servicio..."
          />
          <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
            Si selecciona servicios, este costo o recargo solo se ofrecerá cuando la tarifa incluya al menos uno de ellos.
          </p>
        </div>
        <div class="md:col-span-2">
          <PricingMultiSelect
            v-model="form.incotermIds"
            :options="catalogs.incotermOptions.value"
            label="Incoterms aplicables"
            placeholder="Todos los Incoterms"
            empty-text="No hay Incoterms activos en Config."
            search-placeholder="Buscar Incoterm..."
          />
          <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
            Puede seleccionar uno o varios. Si no selecciona ninguno, el costo aplica a cualquier
            Incoterm.
          </p>
        </div>
        <div v-if="form.costType === 'Optional'" class="md:col-span-2">
          <PricingMultiSelect
            v-model="form.operationalConditionIds"
            :options="operationalConditionOptions"
            label="Aplica cuando el usuario selecciona"
            placeholder="Sin condición automática"
            empty-text="No hay condiciones operativas disponibles."
            search-placeholder="Buscar condición..."
          />
          <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
            Si selecciona varias condiciones, todas deben cumplirse. Si no selecciona ninguna,
            el cargo queda disponible en Pantalla 7 pero no se marca automáticamente.
          </p>
        </div>
      </div>

      <div
        class="mt-4 flex items-start gap-2 rounded-2xl bg-blue-500/10 p-3 text-sm font-semibold text-blue-700 dark:text-blue-300"
      >
        <Info class="mt-0.5 h-4 w-4 shrink-0" />
        <p v-if="form.costType === 'Fixed'">
          El costo se agregará automáticamente únicamente cuando coincidan todas las relaciones
          configuradas. Puede usar una ruta simple o combinaciones POL + POE, POE + POD, POD + POL y
          POL + POE + POD, además de naviera/agente e Incoterm.
        </p>
        <p v-else-if="form.costType === 'Optional'">
          El rubro se ofrece únicamente cuando coincide la ruta y sus relaciones. Las condiciones
          de botones seleccionadas arriba controlan su preselección automática en Pantalla 7.
        </p>
        <p v-else>Este rubro queda disponible como plantilla ajustable para la cotización.</p>
      </div>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="grid gap-4 md:grid-cols-2">
        <DhInput
          v-model="form.costAmount"
          type="number"
          label="Costo por unidad"
          placeholder="0.00"
          :error="
            form.submitted && Number(form.costAmount) < 0
              ? 'El costo no puede ser negativo.'
              : undefined
          "
        />
        <DhInput
          v-model="form.saleAmount"
          type="number"
          label="Venta por unidad"
          placeholder="0.00"
          :disabled="isAgentSaleDisabled"
          :error="
            form.submitted && Number(form.saleAmount) < 0
              ? 'La venta no puede ser negativa.'
              : undefined
          "
        />
        <DhInput
          v-model="form.minimumCostAmount"
          type="number"
          min="0"
          label="Costo mínimo total"
          placeholder="Sin mínimo"
        />
        <DhInput
          v-model="form.minimumSaleAmount"
          type="number"
          min="0"
          label="Venta mínima total"
          placeholder="Sin mínimo"
        />
        <DhInput
          v-if="form.chargeBasis === 'PerChargeableCbm'"
          v-model="form.kgPerCbm"
          type="number"
          min="0.01"
          step="0.01"
          label="KG por CBM"
          :placeholder="concreteShipmentModes.length === 1 && concreteShipmentModes[0] === 'Ltl' ? '333' : '500'"
        />
      </div>
      <div
        class="mt-4 flex items-center justify-between rounded-2xl bg-black/[0.035] px-4 py-3 dark:bg-white/[0.05]"
      >
        <span class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
          >Utilidad del rubro</span
        >
        <span
          class="font-black"
          :class="utility >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'"
          >{{
            formatMoney(
              utility,
              catalogs.findById(catalogs.currencies.value, form.currencyId)?.code || 'USD',
              locale === 'en' ? 'en-US' : 'es-CR',
            )
          }}</span
        >
      </div>
      <div class="mt-4 rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
          Regla de cálculo
        </p>
        <p class="mt-2 text-sm font-semibold text-[var(--dh-text)]">
          {{ chargeBasisOptions.find((item) => item.value === form.chargeBasis)?.label }}
          <span> · {{ shipmentModeSummary }}</span>
        </p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Los mínimos se aplican al total del rubro después de calcular su cantidad cobrable.
        </p>
      </div>
      <p v-if="isAgentSaleDisabled" class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
        Los costos asociados a un agente no generan venta, excepto los cargos en origen.
      </p>
      <div class="mt-4">
        <DhTextarea
          v-model="form.notes"
          label="Notas"
          placeholder="Condiciones, alcance o evidencia del costo..."
        />
      </div>
    </section>

    <div
      class="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--dh-border)] bg-[var(--dh-shell-strong)] py-4 backdrop-blur-xl"
    >
      <DhButton
        label="Cancelar"
        variant="secondary"
        :disabled="form.saving"
        @click="drawerStore.close()"
      />
      <DhButton
        :label="props.cost ? t('common.save') : 'Crear costo'"
        :icon="Save"
        type="submit"
        :loading="form.saving"
      />
    </div>
  </form>
</template>