<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'
import { Route, Save, Truck } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import {
  FtlTariffService,
  type CreateLandTariffItem,
  type FtlTariffDto,
  type LandCommercialProfile,
  type LandShipmentMode,
  type LtlChargeItemDto,
} from '@/core/services/ftlTariffService'
import {
  usePricingCatalogs,
  type PricingCatalogItem,
} from '@/modules/pricing/composables/usePricingCatalogs'
import PricingMultiSelect from './PricingMultiSelect.vue'

const props = defineProps<{ tariff?: FtlTariffDto; lockedMode?: LandShipmentMode; onSaved?: () => void | Promise<void> }>()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const LEGACY_ORIGIN = '__legacy_origin__'
const LEGACY_DESTINATION = '__legacy_destination__'

interface EditableLtlVariableCharge {
  key: string
  name: string
  costDetailType: string
  chargeBasis: string
  section: string
  costAmount: string
  saleAmount: string
  isFlat: false
}

const LTL_VARIABLE_CHARGES: ReadonlyArray<Omit<EditableLtlVariableCharge, 'costAmount' | 'saleAmount'>> = [
  { key: 'seguro', name: 'Seguro', costDetailType: 'Insurance', chargeBasis: 'PerShipment', section: 'origin_charges', isFlat: false },
  { key: 'recolecta', name: 'Recolecta', costDetailType: 'OriginCharge', chargeBasis: 'PerShipment', section: 'pickup_origin', isFlat: false },
  { key: 'reembarque', name: 'Reembarque', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'origin_charges', isFlat: false },
  { key: 'inspeccion', name: 'Inspección', costDetailType: 'CustomsCharge', chargeBasis: 'PerShipment', section: 'origin_charges', isFlat: false },
  { key: 'tramite-aduanas-destino', name: 'Trámite Aduanas Destino', costDetailType: 'CustomsCharge', chargeBasis: 'PerShipment', section: 'destination_charges', isFlat: false },
  { key: 'entrega-destino', name: 'Entrega en Destino', costDetailType: 'InlandTransport', chargeBasis: 'PerShipment', section: 'delivery_destination', isFlat: false },
  { key: 'otros', name: 'Otros', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'destination_charges', isFlat: false },
  { key: 'duca-f', name: 'DUCA-F', costDetailType: 'Documentation', chargeBasis: 'PerDocument', section: 'international_freight', isFlat: false },
  { key: 'impuesto-exportacion', name: 'Impuesto Exportación', costDetailType: 'CustomsCharge', chargeBasis: 'PerShipment', section: 'origin_charges', isFlat: false },
  { key: 'recepcion-destino', name: 'Recepción en Destino', costDetailType: 'DestinationCharge', chargeBasis: 'PerShipment', section: 'destination_charges', isFlat: false },
  { key: 'carga-peligrosa', name: 'Carga Peligrosa', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'origin_charges', isFlat: false },
  { key: 'sobrepeso', name: 'Sobrepeso', costDetailType: 'Other', chargeBasis: 'PerShipment', section: 'origin_charges', isFlat: false },
]

function hydrateLtlVariableCharges(source?: LtlChargeItemDto[] | null): EditableLtlVariableCharge[] {
  const byKey = new Map(
    (source ?? [])
      .filter((item) => !item.isFlat)
      .map((item) => [item.key.toLowerCase(), item]),
  )

  return LTL_VARIABLE_CHARGES.map((item) => {
    const saved = byKey.get(item.key.toLowerCase())
    return {
      ...item,
      costAmount: saved?.costAmount == null ? '' : String(saved.costAmount),
      saleAmount: saved?.saleAmount == null ? '' : String(saved.saleAmount),
    }
  })
}

function equipmentKey(item: PricingCatalogItem) {
  return String(item.code || item.value || item.slug || item.id).trim()
}

const modeOptions: Array<{ label: string; value: LandShipmentMode }> = [
  { label: 'Completo · FTL', value: 'Ftl' },
  { label: 'Consolidado · LTL', value: 'Ltl' },
]
const commercialProfileOptions: Array<{ label: string; value: LandCommercialProfile }> = [
  { label: 'Cliente final', value: 'FinalClient' },
  { label: 'NVOCC', value: 'Nvocc' },
]
const initialClasses = props.tariff?.applicableEquipmentClasses?.length
  ? props.tariff.applicableEquipmentClasses
  : props.tariff?.equipmentClass ? [props.tariff.equipmentClass] : []
const initialOriginIds = props.tariff?.applicableOriginIds?.length
  ? [...props.tariff.applicableOriginIds]
  : props.tariff?.originId
    ? [props.tariff.originId]
    : props.tariff
      ? [LEGACY_ORIGIN]
      : []
const initialDestinationIds = props.tariff?.applicableDestinationIds?.length
  ? [...props.tariff.applicableDestinationIds]
  : props.tariff?.destinationId
    ? [props.tariff.destinationId]
    : props.tariff
      ? [LEGACY_DESTINATION]
      : []

const form = reactive({
  shipmentMode: (props.lockedMode || props.tariff?.shipmentMode || 'Ftl') as LandShipmentMode,
  commercialProfile: (props.tariff?.commercialProfile === 'Nvocc' ? 'Nvocc' : 'FinalClient') as LandCommercialProfile,
  originId: initialOriginIds[0] || '',
  destinationId: initialDestinationIds[0] || '',
  originIds: initialOriginIds,
  destinationIds: initialDestinationIds,
  equipmentClasses: initialClasses.filter((value) => value && value !== 'LTL_CBM'),
  currencyId: props.tariff?.currencyId || '',
  priceAmount: props.tariff ? String(props.tariff.priceAmount) : '',
  minimumAmount: props.tariff?.minimumAmount == null ? '' : String(props.tariff.minimumAmount),
  costPerCbm: props.tariff?.costPerCbm == null ? '' : String(props.tariff.costPerCbm),
  weightKgPerCbm: String(props.tariff?.weightKgPerCbm ?? 333.33),
  duaCost: String(props.tariff?.duaCost ?? 50),
  ducaTCost: String(props.tariff?.ducaTCost ?? 30),
  stuffingCostPerCbm: String(props.tariff?.stuffingCostPerCbm ?? (550 / 60)),
  stuffingSalePerCbm: String(props.tariff?.stuffingSalePerCbm ?? 10),
  panamaCostSurchargePerCbm: String(props.tariff?.panamaCostSurchargePerCbm ?? 9),
  ltlVariableCharges: hydrateLtlVariableCharges(props.tariff?.ltlChargeItems),
  transitDays: props.tariff?.transitDays == null ? '' : String(props.tariff.transitDays),
  warehouseName: props.tariff?.warehouseName || '',
  source: props.tariff?.source || '',
  notes: props.tariff?.notes || '',
  validFrom: props.tariff?.validFrom?.slice(0, 10) || '',
  validTo: props.tariff?.validTo?.slice(0, 10) || '',
  isActive: props.tariff?.isActive ?? true,
  submitted: false,
  saving: false,
})

function routeTerminalType(item: PricingCatalogItem, fallback: 'CY' | 'SD' = 'CY') {
  if (item.metadataJson) {
    try {
      const metadata = JSON.parse(item.metadataJson) as Record<string, unknown>
      const configured = String(metadata.terminalType ?? '').trim().toUpperCase()
      if (configured === 'CY' || configured === 'SD') return configured as 'CY' | 'SD'
    } catch {
      // Fall through to the catalog code convention.
    }
  }

  const code = String(item.code || '').trim().toUpperCase()
  if (code.startsWith('SD_') || code.endsWith('_SD') || code.includes('_SD_')) return 'SD'
  if (code.startsWith('CY_') || code.endsWith('_CY') || code.includes('_CY_')) return 'CY'
  return fallback
}

const landOrigins = computed(() =>
  catalogs.polPorts.value.filter((item) => routeTerminalType(item, 'CY') === 'SD'),
)
const landDestinations = computed(() =>
  catalogs.poePorts.value.filter((item) => routeTerminalType(item, 'CY') === 'SD'),
)

const originOptions = computed(() => {
  const options = landOrigins.value
    .map((item) => ({ value: item.id, label: item.name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  if (props.tariff && !props.tariff.originId) {
    options.unshift({ value: LEGACY_ORIGIN, label: props.tariff.originName + ' · ruta actual' })
  }
  return options
})

const destinationOptions = computed(() => {
  const options = landDestinations.value
    .map((item) => ({ value: item.id, label: item.name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  if (props.tariff && !props.tariff.destinationId) {
    options.unshift({ value: LEGACY_DESTINATION, label: props.tariff.destinationName + ' · ruta actual' })
  }
  return options
})

const equipmentOptions = computed(() => {
  const labels = new Map<string, string>()
  catalogs.landEquipmentSizes.value.forEach((item) => {
    const key = equipmentKey(item)
    if (key && !labels.has(key)) labels.set(key, item.name)
  })
  form.equipmentClasses.forEach((value) => {
    if (!labels.has(value)) labels.set(value, value)
  })
  return [...labels].map(([value, label]) => ({ value, label }))
})

const isLtl = computed(() => form.shipmentMode === 'Ltl')

function allRouteItems() {
  const result = new Map<string, PricingCatalogItem>()
  ;[...landOrigins.value, ...landDestinations.value].forEach((item) => result.set(item.id, item))
  return result
}

function routeSnapshot(value: string, role: 'origin' | 'destination') {
  if (value === LEGACY_ORIGIN && role === 'origin' && props.tariff) {
    return { id: null, name: props.tariff.originName, code: props.tariff.originCode }
  }
  if (value === LEGACY_DESTINATION && role === 'destination' && props.tariff) {
    return { id: null, name: props.tariff.destinationName, code: props.tariff.destinationCode }
  }
  const item = allRouteItems().get(value)
  return item ? { id: item.id, name: item.name, code: item.code } : null
}

function selectedRouteSnapshots(values: string[], role: 'origin' | 'destination') {
  const result: Array<{ id: string | null; name: string; code: string | null }> = []
  ;[...new Set(values.filter(Boolean))].forEach((value) => {
    const snapshot = routeSnapshot(value, role)
    if (snapshot) {
      result.push({
        id: snapshot.id,
        name: snapshot.name,
        code: snapshot.code || null,
      })
    }
  })
  return result
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function buildPayload(): CreateLandTariffItem | null {
  form.submitted = true
  const origins = selectedRouteSnapshots(isLtl.value ? [form.originId] : form.originIds, 'origin')
  const destinations = selectedRouteSnapshots(isLtl.value ? [form.destinationId] : form.destinationIds, 'destination')
  const origin = origins[0] || null
  const destination = destinations[0] || null
  const currency = catalogs.currencies.value.find((item) => item.id === form.currencyId)
  const priceAmount = numberOrNull(form.priceAmount)
  const minimumAmount = numberOrNull(form.minimumAmount)
  const costPerCbm = isLtl.value ? numberOrNull(form.costPerCbm) : null
  const weightKgPerCbm = isLtl.value ? numberOrNull(form.weightKgPerCbm) : null
  const duaCost = isLtl.value ? numberOrNull(form.duaCost) : null
  const ducaTCost = isLtl.value ? numberOrNull(form.ducaTCost) : null
  const stuffingCostPerCbm = isLtl.value ? numberOrNull(form.stuffingCostPerCbm) : null
  const stuffingSalePerCbm = isLtl.value ? numberOrNull(form.stuffingSalePerCbm) : null
  const panamaCostSurchargePerCbm = isLtl.value ? numberOrNull(form.panamaCostSurchargePerCbm) : null
  const ltlChargeItems = isLtl.value
    ? form.ltlVariableCharges.map((charge) => ({
        key: charge.key,
        name: charge.name,
        costDetailType: charge.costDetailType,
        chargeBasis: charge.chargeBasis,
        section: charge.section,
        costAmount: numberOrNull(charge.costAmount),
        saleAmount: numberOrNull(charge.saleAmount),
        isFlat: false,
      } satisfies LtlChargeItemDto))
    : null
  const invalidLtlVariableCharge = isLtl.value && form.ltlVariableCharges.some((charge, index) => {
    const parsed = ltlChargeItems?.[index]
    if (!parsed) return false
    return (
      (charge.costAmount.trim() !== '' && (parsed.costAmount == null || !Number.isFinite(parsed.costAmount) || parsed.costAmount < 0))
      || (charge.saleAmount.trim() !== '' && (parsed.saleAmount == null || !Number.isFinite(parsed.saleAmount) || parsed.saleAmount < 0))
    )
  })
  const transitDays = numberOrNull(form.transitDays)
  const classes = isLtl.value ? ['LTL_CBM'] : [...new Set(form.equipmentClasses)]
  if (
    !origin || !destination || !currency || priceAmount == null ||
    !Number.isFinite(priceAmount) || priceAmount < 0 ||
    (!isLtl.value && classes.length === 0) ||
    (minimumAmount != null && (!Number.isFinite(minimumAmount) || minimumAmount < 0)) ||
    (isLtl.value && (costPerCbm == null || !Number.isFinite(costPerCbm) || costPerCbm < 0)) ||
    (isLtl.value && (weightKgPerCbm == null || !Number.isFinite(weightKgPerCbm) || weightKgPerCbm <= 0)) ||
    (isLtl.value && [duaCost, ducaTCost, stuffingCostPerCbm, stuffingSalePerCbm, panamaCostSurchargePerCbm]
      .some((value) => value == null || !Number.isFinite(value) || value < 0)) ||
    invalidLtlVariableCharge ||
    (transitDays != null && (!Number.isInteger(transitDays) || transitDays < 0)) ||
    (form.validFrom && form.validTo && form.validFrom > form.validTo)
  ) return null

  const labels = new Map(equipmentOptions.value.map((option) => [option.value, option.label]))
  return {
    originId: origin.id,
    originName: origin.name,
    originCode: origin.code || null,
    applicableOriginIds: origins.map((item) => item.id).filter((id): id is string => Boolean(id)),
    destinationId: destination.id,
    destinationName: destination.name,
    destinationCode: destination.code || null,
    applicableDestinationIds: destinations.map((item) => item.id).filter((id): id is string => Boolean(id)),
    shipmentMode: form.shipmentMode,
    commercialProfile: isLtl.value ? form.commercialProfile : 'General',
    equipmentClass: classes[0]!,
    equipmentLabel: isLtl.value ? 'LTL · Consolidado' : classes.map((value) => labels.get(value) || value).join(' + '),
    applicableEquipmentClasses: classes,
    currencyId: currency.id,
    currencyName: currency.name,
    currencyCode: currency.code || currency.value || currency.name,
    priceAmount,
    rateBasis: isLtl.value ? 'PerCbm' : 'PerTruck',
    minimumAmount: isLtl.value ? minimumAmount : null,
    costPerCbm: isLtl.value ? costPerCbm : null,
    weightKgPerCbm: isLtl.value ? weightKgPerCbm : null,
    duaCost: isLtl.value ? duaCost : null,
    ducaTCost: isLtl.value ? ducaTCost : null,
    stuffingCostPerCbm: isLtl.value ? stuffingCostPerCbm : null,
    stuffingSalePerCbm: isLtl.value ? stuffingSalePerCbm : null,
    panamaCostSurchargePerCbm: isLtl.value ? panamaCostSurchargePerCbm : null,
    ltlChargeItems: isLtl.value ? ltlChargeItems : null,
    transitDays,
    warehouseName: form.warehouseName.trim() || null,
    source: form.source.trim() || null,
    notes: form.notes.trim() || null,
    validFrom: form.validFrom || null,
    validTo: form.validTo || null,
    isActive: form.isActive,
  }
}

async function submit() {
  const payload = buildPayload()
  if (!payload) {
    toastStore.error(
      'Revise la tarifa',
      isLtl.value
        ? 'Seleccione la ruta, moneda y complete los valores requeridos.'
        : 'Seleccione al menos un POL y un POE, un equipo aplicable, moneda y complete los valores requeridos.',
    )
    return
  }
  form.saving = true
  try {
    if (props.tariff) await FtlTariffService.update(props.tariff.id, payload)
    else await FtlTariffService.create(payload)
    toastStore.success(
      props.tariff ? 'Tarifa actualizada' : 'Tarifa creada',
      payload.originName + ' → ' + payload.destinationName + ' quedó configurada como ' +
        (payload.shipmentMode === 'Ftl' ? 'completo.' : 'consolidado.'),
    )
    drawerStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, props.tariff ? 'No se pudo actualizar la tarifa.' : 'No se pudo crear la tarifa.')
  } finally {
    form.saving = false
  }
}

watch(() => form.shipmentMode, (mode) => {
  if (props.lockedMode && mode !== props.lockedMode) {
    form.shipmentMode = props.lockedMode
    return
  }
  if (mode === 'Ltl') {
    if (!form.originId && form.originIds.length) form.originId = form.originIds[0]!
    if (!form.destinationId && form.destinationIds.length) form.destinationId = form.destinationIds[0]!
    form.equipmentClasses = []
    if (!form.weightKgPerCbm) form.weightKgPerCbm = '330'
    if (!form.duaCost) form.duaCost = '50'
    if (!form.ducaTCost) form.ducaTCost = '30'
    if (!form.stuffingCostPerCbm) form.stuffingCostPerCbm = String(550 / 60)
    if (!form.stuffingSalePerCbm) form.stuffingSalePerCbm = '10'
    if (!form.panamaCostSurchargePerCbm) form.panamaCostSurchargePerCbm = '9'
  } else {
    if (!form.originIds.length && form.originId) form.originIds = [form.originId]
    if (!form.destinationIds.length && form.destinationId) form.destinationIds = [form.destinationId]
    form.minimumAmount = ''
  }
})

onMounted(catalogs.loadAll)
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-5 flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] dh-bg-primary-soft text-[var(--dh-primary)]">
          <Route class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-black text-[var(--dh-text)]">{{ props.tariff ? 'Editar tarifa terrestre' : 'Nueva tarifa terrestre' }}</h3>
          <p class="mt-1 text-sm font-medium text-[var(--dh-text-muted)]">
            Defina la ruta y si corresponde a un movimiento completo o consolidado.
          </p>
        </div>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <DhSelect v-if="!props.lockedMode" v-model="form.shipmentMode" label="Tipo de carga" :options="modeOptions" />
        <div v-else class="rounded-2xl border border-[var(--dh-border)] bg-black/[0.025] px-4 py-3 dark:bg-white/[0.04]">
          <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Modalidad</p>
          <p class="mt-1 text-sm font-black text-[var(--dh-text)]">{{ props.lockedMode === 'Ltl' ? 'LTL · Consolidado propio' : 'FTL · Completo' }}</p>
        </div>
        <DhSelect v-if="isLtl" v-model="form.commercialProfile" label="Perfil comercial" :options="commercialProfileOptions" />
        <template v-if="!isLtl">
          <div>
            <PricingMultiSelect
              v-model="form.originIds"
              label="POL / orígenes aplicables"
              :options="originOptions"
              placeholder="Seleccione uno o varios POL"
              search-placeholder="Buscar POL..."
              empty-text="No hay orígenes terrestres configurados."
            />
            <p v-if="form.submitted && !form.originIds.length" class="mt-2 text-xs font-bold text-red-500">
              Seleccione al menos un POL.
            </p>
          </div>
          <div>
            <PricingMultiSelect
              v-model="form.destinationIds"
              label="POE / destinos aplicables"
              :options="destinationOptions"
              placeholder="Seleccione uno o varios POE"
              search-placeholder="Buscar POE..."
              empty-text="No hay destinos terrestres configurados."
            />
            <p v-if="form.submitted && !form.destinationIds.length" class="mt-2 text-xs font-bold text-red-500">
              Seleccione al menos un POE.
            </p>
          </div>
        </template>
        <template v-else>
          <DhSelect
            v-model="form.originId"
            label="Origen de la ruta"
            placeholder="Seleccione origen"
            :options="originOptions"
            :error="form.submitted && !form.originId ? 'Seleccione el origen.' : undefined"
          />
          <DhSelect
            v-model="form.destinationId"
            label="Destino de la ruta"
            placeholder="Seleccione destino"
            :options="destinationOptions"
            :error="form.submitted && !form.destinationId ? 'Seleccione el destino.' : undefined"
          />
        </template>
      </div>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-5 flex items-start gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] dh-bg-primary-soft text-[var(--dh-primary)]">
          <Truck class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-black text-[var(--dh-text)]">Aplicación de la tarifa</h3>
          <p class="mt-1 text-sm font-medium text-[var(--dh-text-muted)]">
            Los completos pueden aplicar a varios equipos. Los consolidados no requieren contenedor.
          </p>
        </div>
      </div>

      <div v-if="!isLtl" class="mb-4">
        <PricingMultiSelect
          v-model="form.equipmentClasses"
          label="Furgones aplicables"
          :options="equipmentOptions"
          placeholder="Seleccione uno o varios furgones"
          search-placeholder="Buscar furgón..."
          empty-text="No hay furgones configurados en land-equipment-sizes."
        />
        <p v-if="form.submitted && !form.equipmentClasses.length" class="mt-2 text-xs font-bold text-red-500">
          Seleccione al menos un furgón para una tarifa FTL.
        </p>
      </div>
      <div v-else class="mb-4 rounded-2xl border border-[var(--dh-border)] bg-black/[0.025] px-4 py-3 dark:bg-white/[0.04]">
        <p class="text-sm font-black text-[var(--dh-text)]">Consolidado LTL</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Se aplica por CBM y no solicita contenedor.</p>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DhSelect
          v-model="form.currencyId"
          label="Moneda"
          placeholder="Seleccione moneda"
          :options="catalogs.currencyOptions.value"
          :error="form.submitted && !form.currencyId ? 'Seleccione la moneda.' : undefined"
        />
        <DhInput v-model="form.priceAmount" type="number" min="0" step="0.01" :label="isLtl ? 'Venta / CBM' : 'Tarifa por completo'" />
        <DhInput v-if="isLtl" v-model="form.minimumAmount" type="number" min="0" step="0.01" label="Venta mínima" />
        <DhInput v-if="isLtl" v-model="form.costPerCbm" type="number" min="0" step="0.000001" label="Costo base / CBM" />
        <DhInput v-if="isLtl" v-model="form.weightKgPerCbm" type="number" min="0.01" step="0.01" label="Peso kg por CBM" />
        <DhInput v-if="isLtl" v-model="form.duaCost" type="number" min="0" step="0.01" label="DUA · costo" />
        <DhInput v-if="isLtl" v-model="form.ducaTCost" type="number" min="0" step="0.01" label="DUCA-T · costo" />
        <DhInput v-if="isLtl" v-model="form.stuffingCostPerCbm" type="number" min="0" step="0.000001" label="Stuffing · costo / CBM" />
        <DhInput v-if="isLtl" v-model="form.stuffingSalePerCbm" type="number" min="0" step="0.01" label="Stuffing · venta / CBM" />
        <DhInput v-if="isLtl" v-model="form.panamaCostSurchargePerCbm" type="number" min="0" step="0.01" label="Recargo costo desde Panamá / CBM" />
        <DhInput v-model="form.transitDays" type="number" min="0" step="1" label="Días de tránsito" />
        <DhInput v-model="form.validFrom" type="date" label="Vigencia desde" />
        <DhInput v-model="form.validTo" type="date" label="Vigencia hasta" />
        <DhInput v-if="isLtl" v-model="form.warehouseName" label="Almacén de ingreso" placeholder="Opcional" />
        <DhInput v-model="form.source" label="Fuente / proveedor" placeholder="Opcional" />
      </div>
      <div v-if="isLtl" class="mt-4 rounded-2xl border border-[var(--dh-primary)]/25 bg-[var(--dh-primary)]/5 px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]">
        CBM por peso = kg ÷ {{ form.weightKgPerCbm || 330 }}. Se usa el mayor entre CBM dimensional y CBM por peso. En rutas con origen Panamá, al costo base/CBM se suma el recargo configurado. Stuffing conserva la base LCL (USD 550 ÷ 60 CBM) y la venta/CBM es editable.
      </div>

      <div v-if="isLtl" class="mt-5 rounded-[22px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Cargos variables LTL</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Estos conceptos no tienen costo ni venta fija. Se muestran siempre y puede dejar los campos vacíos cuando no apliquen.
          </p>
        </div>

        <div class="mt-4 space-y-2">
          <div
            v-for="charge in form.ltlVariableCharges"
            :key="charge.key"
            class="grid gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 md:grid-cols-[minmax(220px,1fr)_160px_160px]"
          >
            <div class="self-center">
              <p class="font-black text-[var(--dh-text)]">{{ charge.name }}</p>
              <p class="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
                Variable · sin monto fijo
              </p>
            </div>
            <DhInput
              v-model="charge.costAmount"
              type="number"
              min="0"
              step="0.01"
              label="Costo"
              placeholder="Variable"
            />
            <DhInput
              v-model="charge.saleAmount"
              type="number"
              min="0"
              step="0.01"
              label="Venta"
              placeholder="Variable"
            />
          </div>
        </div>
      </div>

      <div class="mt-4"><DhTextarea v-model="form.notes" label="Notas" :rows="3" /></div>
      <label class="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--dh-border)] px-4 py-3">
        <input v-model="form.isActive" type="checkbox" class="h-4 w-4" />
        <span>
          <strong class="block text-sm text-[var(--dh-text)]">Tarifa activa</strong>
          <span class="text-xs font-semibold text-[var(--dh-text-muted)]">Disponible para resolver cotizaciones.</span>
        </span>
      </label>
    </section>

    <div class="flex justify-end gap-2">
      <DhButton type="button" variant="secondary" label="Cancelar" @click="drawerStore.close()" />
      <DhButton type="submit" :icon="Save" :loading="form.saving" :label="form.saving ? 'Guardando…' : 'Guardar tarifa'" />
    </div>
  </form>
</template>
