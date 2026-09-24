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
} from '@/core/services/ftlTariffService'
import {
  usePricingCatalogs,
  type PricingCatalogItem,
} from '@/modules/pricing/composables/usePricingCatalogs'
import PricingMultiSelect from './PricingMultiSelect.vue'

const props = defineProps<{ tariff?: FtlTariffDto; onSaved?: () => void | Promise<void> }>()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const LEGACY_ORIGIN = '__legacy_origin__'
const LEGACY_DESTINATION = '__legacy_destination__'

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function classifyEquipment(item: PricingCatalogItem) {
  const text = normalize([item.code, item.name, item.value, item.slug, item.metadataJson || ''].join(' '))
  if (/(^|[^0-9])(48|53)([^0-9]|$)/.test(text)) return '48_53'
  if (/(^|[^0-9])(5|6|7)([^0-9]|$).*(ton|tons|tonelada|toneladas)/.test(text)) return '5_7_TON'
  if (/(ton|tons|tonelada|toneladas).*(^|[^0-9])(5|6|7)([^0-9]|$)/.test(text)) return '5_7_TON'
  if (/5\s*(a|-|\/)\s*7/.test(text)) return '5_7_TON'
  return ''
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

const form = reactive({
  shipmentMode: (props.tariff?.shipmentMode || 'Ftl') as LandShipmentMode,
  commercialProfile: (props.tariff?.commercialProfile === 'Nvocc' ? 'Nvocc' : 'FinalClient') as LandCommercialProfile,
  originId: props.tariff?.originId || (props.tariff ? LEGACY_ORIGIN : ''),
  destinationId: props.tariff?.destinationId || (props.tariff ? LEGACY_DESTINATION : ''),
  equipmentClasses: initialClasses.filter((value) => value && value !== 'LTL_CBM'),
  currencyId: props.tariff?.currencyId || '',
  priceAmount: props.tariff ? String(props.tariff.priceAmount) : '',
  minimumAmount: props.tariff?.minimumAmount == null ? '' : String(props.tariff.minimumAmount),
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

const routeOptions = computed(() => {
  const values = new Map<string, { label: string; value: string }>()
  const add = (item: PricingCatalogItem, role: string) => {
    if (!values.has(item.id)) values.set(item.id, { value: item.id, label: item.name + ' · ' + role })
  }
  catalogs.polPorts.value.forEach((item) => add(item, 'POL'))
  catalogs.poePorts.value.forEach((item) => add(item, 'POE'))
  catalogs.podPorts.value.forEach((item) => add(item, 'POD'))
  const options = [...values.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  if (props.tariff && !props.tariff.originId) {
    options.unshift({ value: LEGACY_ORIGIN, label: props.tariff.originName + ' · ruta actual' })
  }
  if (props.tariff && !props.tariff.destinationId) {
    options.unshift({ value: LEGACY_DESTINATION, label: props.tariff.destinationName + ' · ruta actual' })
  }
  return options
})

const equipmentOptions = computed(() => {
  const labels = new Map<string, string>()
  catalogs.landEquipmentTypes.value.forEach((item) => {
    const equipmentClass = classifyEquipment(item)
    if (equipmentClass && !labels.has(equipmentClass)) labels.set(equipmentClass, item.name)
  })
  if (!labels.has('48_53')) labels.set('48_53', 'Equipo 48/53 pies')
  if (!labels.has('5_7_TON')) labels.set('5_7_TON', 'Equipo 5 a 7 toneladas')
  form.equipmentClasses.forEach((value) => {
    if (!labels.has(value)) labels.set(value, value)
  })
  return [...labels].map(([value, label]) => ({ value, label }))
})

const isLtl = computed(() => form.shipmentMode === 'Ltl')

function allRouteItems() {
  const result = new Map<string, PricingCatalogItem>()
  ;[...catalogs.polPorts.value, ...catalogs.poePorts.value, ...catalogs.podPorts.value]
    .forEach((item) => result.set(item.id, item))
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

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function buildPayload(): CreateLandTariffItem | null {
  form.submitted = true
  const origin = routeSnapshot(form.originId, 'origin')
  const destination = routeSnapshot(form.destinationId, 'destination')
  const currency = catalogs.currencies.value.find((item) => item.id === form.currencyId)
  const priceAmount = numberOrNull(form.priceAmount)
  const minimumAmount = numberOrNull(form.minimumAmount)
  const transitDays = numberOrNull(form.transitDays)
  const classes = isLtl.value ? ['LTL_CBM'] : [...new Set(form.equipmentClasses)]
  if (
    !origin || !destination || !currency || priceAmount == null ||
    !Number.isFinite(priceAmount) || priceAmount < 0 ||
    (!isLtl.value && classes.length === 0) ||
    (minimumAmount != null && (!Number.isFinite(minimumAmount) || minimumAmount < 0)) ||
    (transitDays != null && (!Number.isInteger(transitDays) || transitDays < 0)) ||
    (form.validFrom && form.validTo && form.validFrom > form.validTo)
  ) return null

  const labels = new Map(equipmentOptions.value.map((option) => [option.value, option.label]))
  return {
    originId: origin.id,
    originName: origin.name,
    originCode: origin.code || null,
    destinationId: destination.id,
    destinationName: destination.name,
    destinationCode: destination.code || null,
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
        : 'Seleccione la ruta, al menos un equipo aplicable, moneda y complete los valores requeridos.',
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
  if (mode === 'Ltl') form.equipmentClasses = []
  else form.minimumAmount = ''
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
          <h3 class="font-black text-[var(--dh-text)]">{{ tariff ? 'Editar tarifa terrestre' : 'Nueva tarifa terrestre' }}</h3>
          <p class="mt-1 text-sm font-medium text-[var(--dh-text-muted)]">
            Defina la ruta y si corresponde a un movimiento completo o consolidado.
          </p>
        </div>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <DhSelect v-model="form.shipmentMode" label="Tipo de carga" :options="modeOptions" />
        <DhSelect v-if="isLtl" v-model="form.commercialProfile" label="Perfil comercial" :options="commercialProfileOptions" />
        <DhSelect
          v-model="form.originId"
          label="Origen de la ruta"
          placeholder="Seleccione origen"
          :options="routeOptions"
          :error="form.submitted && !form.originId ? 'Seleccione el origen.' : undefined"
        />
        <DhSelect
          v-model="form.destinationId"
          label="Destino de la ruta"
          placeholder="Seleccione destino"
          :options="routeOptions"
          :error="form.submitted && !form.destinationId ? 'Seleccione el destino.' : undefined"
        />
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
          label="Equipos / contenedores aplicables"
          :options="equipmentOptions"
          placeholder="Seleccione uno o varios equipos"
          search-placeholder="Buscar equipo..."
          empty-text="No hay equipos terrestres configurados."
        />
        <p v-if="form.submitted && !form.equipmentClasses.length" class="mt-2 text-xs font-bold text-red-500">
          Seleccione al menos un equipo para una tarifa completa.
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
        <DhInput v-model="form.priceAmount" type="number" min="0" step="0.01" :label="isLtl ? 'Tarifa por CBM' : 'Tarifa por completo'" />
        <DhInput v-if="isLtl" v-model="form.minimumAmount" type="number" min="0" step="0.01" label="Mínimo" />
        <DhInput v-model="form.transitDays" type="number" min="0" step="1" label="Días de tránsito" />
        <DhInput v-model="form.validFrom" type="date" label="Vigencia desde" />
        <DhInput v-model="form.validTo" type="date" label="Vigencia hasta" />
        <DhInput v-if="isLtl" v-model="form.warehouseName" label="Almacén de ingreso" placeholder="Opcional" />
        <DhInput v-model="form.source" label="Fuente / proveedor" placeholder="Opcional" />
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
