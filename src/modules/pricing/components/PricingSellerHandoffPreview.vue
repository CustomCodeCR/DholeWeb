<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowRight, Box, CalendarDays, ChevronDown, ClipboardList, Download,
  FileText, Flag, MapPin, MessageSquareText, Package, Paperclip, Route,
  Ruler, Truck, UserRound, Warehouse, Weight,
} from 'lucide-vue-next'

interface SalesDocument {
  id: string
  categoryLabel: string
  fileName: string
  sizeInBytes: number
}

interface SalesSnapshot {
  form: Record<string, unknown>
  context: Record<string, unknown>
  sellerContext: Record<string, unknown>
  pickupLocations: unknown[]
  documents: SalesDocument[]
  clientName: string
  executiveName: string
  originName: string
  destinationName: string
  poeName: string
  podName: string
  priority: string
}

const props = defineProps<{
  snapshot: SalesSnapshot
  equipmentLabel: string
  serviceLabels: string
  originLabel: string
  destinationLabel: string
  podLabel: string
  incotermLabel: string
  isLand: boolean
  title?: string
  subtitle?: string
}>()
const emit = defineEmits<{ download: [document: SalesDocument] }>()

const raw = (key: string): unknown =>
  props.snapshot.form[key] ?? props.snapshot.context[key] ?? props.snapshot.sellerContext[key]

function label(key: string): string {
  const value = raw(key)
  if (value === null || value === undefined || value === '') return 'No indicado'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(', ') || 'No indicado'
  if (typeof value === 'object') return 'No indicado'
  return String(value)
}

function firstProvided(...values: Array<string | null | undefined>): string {
  return values.find((value) => value?.trim() && value !== 'No indicado') || 'No indicado'
}

const modality = computed(() => {
  const value = label('modality')
  if (value === 'Land') return 'Terrestre'
  if (value === 'Ocean') return 'Marítimo'
  if (value === 'Air') return 'Aéreo'
  return value
})

const clientType = computed(() => {
  // Respetar la clasificación elegida al solicitar la tarifa, sin asumir
  // un tipo por defecto ni deducirlo del nombre del cliente.
  const value = [
    'clientType', 'customerType', 'clientCategory', 'miamiCommercialPlan', 'commercialPlan',
  ].map((key) => raw(key)).find((item) => typeof item === 'string' && item.trim())
  if (typeof value !== 'string') return 'No indicado'
  const selected = value.trim()
  const labels: Record<string, string> = {
    A: 'Cliente A', B: 'Cliente B', C: 'Cliente C', D: 'Cliente D',
    'NVOCC-A': 'Cliente NVOCC-A', 'NVOCC-B': 'Cliente NVOCC-B',
    LITTLE: 'CARGAS LITTLE', FINALCLIENT: 'Cliente final', NVOCC: 'NVOCC',
  }
  return labels[selected.toUpperCase()] ?? selected
})

const shipment = computed(() => label('shipmentMode'))
const priorityText = computed(() => ({
  Red: 'Urgente', Yellow: 'Prioritario', Green: 'Regular',
} as Record<string, string>)[props.snapshot.priority] || props.snapshot.priority || 'No indicada')
const priorityClasses = computed(() => ({
  Red: 'border-red-500/40 bg-red-500/12 text-red-600 dark:text-red-300',
  Yellow: 'border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300',
  Green: 'border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
} as Record<string, string>)[props.snapshot.priority] || 'border-[var(--dh-border)] text-[var(--dh-text-muted)]')

const fromName = computed(() => firstProvided(props.snapshot.originName, props.originLabel))
const toName = computed(() => firstProvided(props.snapshot.poeName, props.snapshot.destinationName, props.destinationLabel))
const finalDestinationName = computed(() => firstProvided(props.snapshot.podName, props.podLabel))
const readyDate = computed(() => firstProvided(label('cargoReadyDate'), label('loadDate')))
const remarks = computed(() => label('cargoObservations'))
const description = computed(() => label('cargoDescription'))
const notes = computed(() => firstProvided(label('notes'), label('comments')))
const portHandling = computed(() => {
  const selected = props.snapshot.sellerContext.portHandlingMode
  const value = typeof selected === 'string' && selected.trim() ? selected : raw('portHandlingMode')
  return value === 'Anticipado' || value === 'Redestino' ? value : ''
})
const selectedCargoOptions = computed(() => ([
  { key: 'dangerousCargo', name: 'Carga peligrosa' },
  { key: 'overweight', name: 'Sobrepeso' },
  { key: 'nonStackable', name: 'No estibable' },
  { key: 'emptyReturn', name: 'Retiro de vacío' },
  { key: 'electronicSeal', name: 'Marchamo electrónico' },
  { key: 'merchantHaulage', name: 'Merchant' },
  { key: 'carrierHaulage', name: 'Naviera' },
]).filter((option) => raw(option.key) === true))

// Las líneas originales son la fuente para solicitudes LCL/LTL con múltiples bultos.
// Los totales persistidos evitan volver a calcular el volumen con solo la primera línea.
const cargoVolume = computed(() => {
  if (!isConsolidated.value) return null
  const context = props.snapshot.sellerContext
  // Compatibilidad con solicitudes anteriores que no guardaban la unidad de volumen.
  const origin = [
    props.snapshot.originName,
    props.originLabel,
    props.snapshot.context.originCountryName,
    props.snapshot.context.originCountryCode,
  ].filter((value) => typeof value === 'string').join(' ')
  const legacyUsOrigin = /\b(miami|usa|united states|estados unidos)\b/i.test(origin)
  const unit = context.cargoVolumeUnit === 'CFT' || (!context.cargoVolumeUnit && legacyUsOrigin)
    ? 'CFT' : 'CBM'
  const factor = unit === 'CFT' ? 35.31466672148859 : 1
  const positive = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : 0
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }
  const lines = Array.isArray(context.consolidatedCargoLines) ? context.consolidatedCargoLines : []
  // La unidad mostrada (CBM/CFT) no siempre coincide con la unidad interna de medidas.
  // En Miami se pueden mostrar CBM aunque las líneas se almacenen en pulgadas.
  const inchToCm = context.cargoDimensionStorageUnit === 'in'
    || (!context.cargoDimensionStorageUnit && legacyUsOrigin) ? 2.54 : 1
  let physicalCbm = 0
  let billableCbm = 0
  if (lines.length) {
    for (const item of lines) {
      if (!item || typeof item !== 'object') continue
      const line = item as Record<string, unknown>
      const quantity = Math.max(1, Math.trunc(positive(line.quantity)))
      const length = positive(line.length) * inchToCm
      const width = positive(line.width) * inchToCm
      const height = positive(line.height) * inchToCm
      if (!length || !width || !height) continue
      physicalCbm += quantity * length * width * height / 1_000_000
      const stackable = line.isStackable !== false && height < 177.8
      billableCbm += quantity * length * width * (stackable ? height : Math.max(266, height)) / 1_000_000
    }
  } else {
    const length = positive(raw('cargoLengthCm'))
    const width = positive(raw('cargoWidthCm'))
    const height = positive(raw('cargoHeightCm'))
    const quantity = Math.max(1, Math.trunc(positive(raw('cargoPallets'))))
    physicalCbm = quantity * length * width * height / 1_000_000
    billableCbm = physicalCbm
  }
  physicalCbm = positive(context.physicalVolumeCbm) || physicalCbm
  billableCbm = positive(context.billableVolumeCbm) || billableCbm
  const weightCbm = positive(raw('cargoWeightKg')) / (shipmentMode.value === 'LTL' ? 330 : 500)
  const chargeableCbm = positive(context.chargeableVolumeCbm)
    || (Math.max(billableCbm, weightCbm) > 0 ? Math.max(1, billableCbm, weightCbm) : 0)
  const format = (cbm: number) => cbm > 0
    ? (cbm * factor).toLocaleString('es-CR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' ' + unit
    : 'No indicado'
  return { physical: format(physicalCbm), chargeable: format(chargeableCbm) }
})
const shipmentMode = computed(() => shipment.value.trim().toUpperCase())
const isConsolidated = computed(() => ['LCL', 'LTL'].includes(shipmentMode.value))
const equipment = computed(() =>
  isConsolidated.value ? 'Carga consolidada' : firstProvided(props.equipmentLabel, label('equipmentType')),
)
const equipmentSize = computed(() => {
  const candidates = [label('equipmentSize'), label('equipmentType'), props.equipmentLabel]
  if (props.isLand) {
    for (const candidate of candidates) {
      const match = String(candidate ?? '').match(/(?:^|[^\d])(?:1\s*[x×]\s*)?(24|26|48|53)(?:\s*(?:pies|ft|feet))?(?=\D|$)/i)
      if (match) return match[1] + ' pies'
    }
  }
  return firstProvided(...candidates)
})
const isExw = computed(() =>
  /^EXW(?:$|\W)/.test(firstProvided(label('incotermCode'), props.incotermLabel).toUpperCase().trim()),
)
const cargoCondition = computed(() => {
  const format = (value: unknown) => value === 'FiscalCargo' ? 'Carga fiscal'
    : value === 'NationalizedCargo' ? 'Carga nacionalizada' : ''
  const pickups = props.snapshot.pickupLocations.map((item) => {
    const point = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return format(point.cargoCondition)
  }).filter(Boolean)
  const conditions = [...new Set(pickups)]
  return conditions.length ? conditions.join(' / ') : format(raw('cargoCondition')) || 'No indicada'
})
const serviceList = computed(() => {
  const names = props.serviceLabels.split(',').map((v) => v.trim()).filter(Boolean)
  return names.length ? names : []
})
function inlandLocation(kind: 'pickup' | 'delivery') {
  const enabled = serviceList.value.some(name => kind === 'pickup'
    ? /transporte.*recole|recole.*transporte|pickup/i.test(name)
    : /transporte.*entrega|entrega.*transporte|delivery/i.test(name))
  if (!enabled) return null
  const saved = raw(kind === 'pickup' ? 'inlandPickupLocation' : 'inlandDeliveryLocation')
  if (!saved || typeof saved !== 'object') return null
  const location = saved as Record<string, unknown>
  const address = String(location.address ?? '').trim()
  if (!address) return null
  const latitude = typeof location.latitude === 'number' && Number.isFinite(location.latitude)
    ? location.latitude : null
  const longitude = typeof location.longitude === 'number' && Number.isFinite(location.longitude)
    ? location.longitude : null
  return {
    address,
    coordinates: latitude != null && longitude != null ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : '',
  }
}
const inlandPickup = computed(() => inlandLocation('pickup'))
const inlandDelivery = computed(() => inlandLocation('delivery'))
// Las magnitudes del formulario se conservan normalizadas para los cálculos,
 // pero Ventas debe ver las unidades elegidas al registrar la solicitud.
const cargoWeightUnit = computed(() => {
  if (!isConsolidated.value) return 'kg'
  const saved = props.snapshot.sellerContext.cargoWeightInputUnit
    ?? props.snapshot.form.miamiWeightInputUnit
  return saved === 'lb' ? 'lb' : 'kg'
})
const cargoDimensionInputUnit = computed(() => {
  if (!isConsolidated.value) return 'cm'
  const saved = props.snapshot.sellerContext.cargoDimensionInputUnit
    ?? props.snapshot.form.miamiDimensionInputUnit
  return saved === 'mm' || saved === 'm' || saved === 'in' ? saved : 'cm'
})
function cargoNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}
function cargoDisplayNumber(value: number): string {
  return value.toLocaleString('es-CR', { maximumFractionDigits: 4 })
}
const cargoWeight = computed(() => {
  const weightKg = cargoNumericValue(raw('cargoWeightKg'))
  if (weightKg === null) return 'No indicado'
  const value = cargoWeightUnit.value === 'lb' ? weightKg * 2.2046226218 : weightKg
  return cargoDisplayNumber(value) + ' ' + cargoWeightUnit.value
})
const measurements = computed(() => {
  const valuesCm = ['cargoLengthCm', 'cargoWidthCm', 'cargoHeightCm']
    .map((key) => cargoNumericValue(raw(key)))
  if (valuesCm.some((value) => value === null)) return 'No indicado'
  const unit = cargoDimensionInputUnit.value
  const convert = (cm: number) => unit === 'in' ? cm / 2.54
    : unit === 'm' ? cm / 100 : unit === 'mm' ? cm * 10 : cm
  return valuesCm.map((value) => cargoDisplayNumber(convert(value!))).join(' × ') + ' ' + unit
})
const pickupCards = computed(() => props.snapshot.pickupLocations.map((item, index) => {
  const point = item && typeof item === 'object' ? item as Record<string, unknown> : {}
  const condition = String(point.cargoCondition ?? '')
  const latitude = typeof point.latitude === 'number' && Number.isFinite(point.latitude) ? point.latitude : null
  const longitude = typeof point.longitude === 'number' && Number.isFinite(point.longitude) ? point.longitude : null
  return {
    index: index + 1,
    address: String(point.address || 'Punto de recolecta ' + (index + 1)),
    condition: condition === 'FiscalCargo' ? 'Carga fiscal'
      : condition === 'NationalizedCargo' ? 'Carga nacionalizada' : 'Condición no indicada',
    coordinates: latitude !== null && longitude !== null
      ? latitude.toFixed(5) + ', ' + longitude.toFixed(5) : '',
  }
}))

function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 ** 2).toFixed(1) + ' MB'
}
function fileKind(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'PDF'
  if (['xlsx', 'xls', 'xlsm', 'xlsb'].includes(ext)) return 'Excel'
  if (['docx', 'doc'].includes(ext)) return 'Word'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'Imagen'
  return 'Archivo'
}
</script>

<template>
  <details open data-sales-handoff-preview class="group rounded-[26px] border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[var(--dh-card)] shadow-[var(--dh-shadow)]">
    <summary class="flex cursor-pointer list-none items-center gap-3 px-4 py-4 marker:hidden sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
      <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
        <ClipboardList class="h-5 w-5" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-base font-black text-[var(--dh-text)] sm:text-lg">{{ title || 'Información proporcionada por Ventas' }}</span>
        <span class="mt-1 block text-xs font-medium text-[var(--dh-text-muted)]">{{ subtitle || 'Resumen original de las pantallas 1–4 · consulta sin edición' }}</span>
      </span>
      <span class="hidden rounded-full border border-[var(--dh-border)] px-3 py-1 text-[11px] font-bold text-[var(--dh-text-muted)] md:inline-flex">Solo lectura</span>
      <ChevronDown class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)] transition group-open:rotate-180" />
    </summary>

    <div class="space-y-4 border-t border-[var(--dh-border)] px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
      <div class="grid gap-4 xl:grid-cols-2">
        <section class="overflow-hidden rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40">
          <div class="flex items-center gap-2 border-b border-[var(--dh-border)] px-4 py-3">
            <Box class="h-4 w-4 text-[var(--dh-primary)]" />
            <h3 class="text-sm font-black">01 · Modalidad y cliente</h3>
          </div>
          <dl class="grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Modalidad</dt><dd class="font-bold">{{ modality }}</dd></div>
            <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Tipo de embarque</dt><dd><span class="inline-flex rounded-lg border border-[var(--dh-border)] px-2 py-0.5 text-xs font-black">{{ shipment }}</span></dd></div>
            <div class="sm:col-span-2"><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Cliente</dt><dd class="break-words font-bold">{{ snapshot.clientName || 'No indicado' }}</dd></div>
            <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Tipo de cliente</dt><dd class="font-bold">{{ clientType }}</dd></div>
            <div><dt class="mb-1 flex items-center gap-1 text-xs font-semibold text-[var(--dh-text-muted)]"><UserRound class="h-3.5 w-3.5" /> Ejecutivo</dt><dd class="font-bold">{{ snapshot.executiveName || 'No indicado' }}</dd></div>
            <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Prioridad</dt><dd><span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black" :class="priorityClasses"><Flag class="h-3.5 w-3.5" />{{ priorityText }}</span></dd></div>
          </dl>
        </section>

        <section class="overflow-hidden rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40">
          <div class="flex items-center gap-2 border-b border-[var(--dh-border)] px-4 py-3">
            <Truck class="h-4 w-4 text-[var(--dh-primary)]" />
            <h3 class="text-sm font-black">02 · Datos del embarque</h3>
          </div>
          <dl class="grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Tipo de carga</dt><dd class="font-bold">{{ shipment }}</dd></div>
            <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ isConsolidated ? 'Operación' : 'Equipo' }}</dt><dd class="font-bold">{{ equipment }}</dd></div>
            <div v-if="!isConsolidated"><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ isLand ? 'Tamaño de furgón' : 'Tamaño de contenedor' }}</dt><dd class="font-bold">{{ equipmentSize }}</dd></div>
            <div v-if="!isConsolidated"><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Cantidad</dt><dd class="font-bold">{{ label('equipmentQuantity') }}</dd></div>
            <div v-if="isExw" class="sm:col-span-2"><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Condición aduanera de la carga</dt><dd class="font-bold text-[var(--dh-text)]">{{ cargoCondition }}</dd></div>
            <div class="sm:col-span-2"><dt class="mb-2 text-xs font-semibold text-[var(--dh-text-muted)]">Servicios solicitados</dt><dd class="flex flex-wrap gap-2"><span v-for="service in serviceList" :key="service" class="rounded-full border border-[rgb(var(--dh-primary-rgb)/0.2)] bg-[rgb(var(--dh-primary-rgb)/0.06)] px-3 py-1 text-xs font-bold">{{ service }}</span><span v-if="!serviceList.length" class="text-xs text-[var(--dh-text-muted)]">No indicados</span></dd></div>
          </dl>
        </section>

        <section class="overflow-hidden rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40">
          <div class="flex items-center gap-2 border-b border-[var(--dh-border)] px-4 py-3">
            <Route class="h-4 w-4 text-[var(--dh-primary)]" />
            <h3 class="text-sm font-black">03 · Ruta e Incoterm</h3>
          </div>
          <div class="m-4 flex flex-col gap-3 sm:flex-row sm:items-start rounded-xl border border-[rgb(var(--dh-primary-rgb)/0.18)] bg-[rgb(var(--dh-primary-rgb)/0.04)] p-3">
            <div class="min-w-0 flex-1"><div class="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--dh-text-muted)]">{{ isLand ? 'Origen' : 'Origen · POL' }}</div><p class="flex items-start gap-1 text-sm font-black"><MapPin class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" /><span>{{ fromName }}</span></p></div>
            <ArrowRight class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
            <div class="min-w-0 flex-1"><div class="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--dh-text-muted)]">{{ isLand ? 'Destino' : 'Entrada · POE' }}</div><p class="flex items-start gap-1 text-sm font-black"><MapPin class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" /><span>{{ toName }}</span></p></div>
            <template v-if="!isLand && finalDestinationName !== 'No indicado'"><ArrowRight class="h-4 w-4 shrink-0 self-center text-[var(--dh-primary)]" /><div class="min-w-0 flex-1"><div class="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--dh-text-muted)]">Destino final · POD</div><p class="flex items-start gap-1 text-sm font-black"><MapPin class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" /><span>{{ finalDestinationName }}</span></p></div></template>
          </div>
          <dl class="grid gap-3 px-4 pb-4 text-sm sm:grid-cols-2">
            <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Incoterm</dt><dd class="font-bold">{{ incotermLabel || label('incotermCode') }}</dd></div>
            <div><dt class="mb-1 flex items-center gap-1 text-xs font-semibold text-[var(--dh-text-muted)]"><CalendarDays class="h-3.5 w-3.5" /> Carga lista</dt><dd class="font-bold">{{ readyDate }}</dd></div>
            <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Dirección de recolecta EXW / FCA</dt><dd class="break-words font-semibold">{{ label('pickupAddress') }}</dd></div>
            <div v-if="inlandPickup"><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Transporte de recolección · Ubicación</dt><dd class="break-words font-semibold">{{ inlandPickup.address }}<span v-if="inlandPickup.coordinates" class="mt-1 block text-xs text-[var(--dh-text-muted)]">{{ inlandPickup.coordinates }}</span></dd></div>
            <div v-if="inlandDelivery"><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Transporte de entrega · Ubicación</dt><dd class="break-words font-semibold">{{ inlandDelivery.address }}<span v-if="inlandDelivery.coordinates" class="mt-1 block text-xs text-[var(--dh-text-muted)]">{{ inlandDelivery.coordinates }}</span></dd></div>
            <div><dt class="mb-1 flex items-center gap-1 text-xs font-semibold text-[var(--dh-text-muted)]"><Warehouse class="h-3.5 w-3.5" /> Almacén / WHS</dt><dd class="font-semibold">{{ firstProvided(label('warehouseName'), label('warehouseLabel')) }}</dd></div>
            <div v-if="!isLand"><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Destino final (POD)</dt><dd class="font-semibold">{{ firstProvided(snapshot.podName, podLabel) }}</dd></div>
            <div v-if="!isLand"><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Muellaje</dt><dd class="font-semibold">{{ portHandling || 'No indicado' }}</dd></div>
          </dl>
        </section>

        <section class="overflow-hidden rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40">
          <div class="flex items-center gap-2 border-b border-[var(--dh-border)] px-4 py-3">
            <MessageSquareText class="h-4 w-4 text-[var(--dh-primary)]" />
            <h3 class="text-sm font-black">04 · Carga y comentarios</h3>
          </div>
          <div class="space-y-3 p-4">
            <div class="rounded-xl border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.055)] p-3">
              <div class="mb-1 flex items-center gap-2 text-xs font-black text-[var(--dh-primary)]"><MessageSquareText class="h-3.5 w-3.5" /> Observaciones del vendedor</div>
              <p class="whitespace-pre-wrap break-words text-sm leading-relaxed">{{ remarks }}</p>
            </div>
            <p v-if="description !== 'No indicado'" class="text-sm"><span class="font-black">Descripción: </span>{{ description }}</p>
            <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
              <p class="mb-2 text-xs font-black text-[var(--dh-text)]">Opciones seleccionadas en Pantalla 4</p>
              <div v-if="portHandling || selectedCargoOptions.length" class="flex flex-wrap gap-2">
                <span v-if="portHandling" class="rounded-full border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.08)] px-3 py-1 text-xs font-bold text-[var(--dh-primary)]">{{ portHandling }}</span>
                <span v-for="option in selectedCargoOptions" :key="option.key" class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-1 text-xs font-semibold">{{ option.name }}</span>
              </div>
              <p v-else class="text-xs text-[var(--dh-text-muted)]">Sin opciones adicionales seleccionadas.</p>
            </div>
            <dl class="grid gap-3 rounded-xl border border-[var(--dh-border)] p-3 text-sm sm:grid-cols-2">
              <div><dt class="mb-1 flex items-center gap-1 text-xs text-[var(--dh-text-muted)]"><Package class="h-3.5 w-3.5" /> Bultos</dt><dd class="font-bold">{{ label('cargoPackages') }}</dd></div>
              <div><dt class="mb-1 text-xs text-[var(--dh-text-muted)]">Tarimas</dt><dd class="font-bold">{{ label('cargoPallets') }}</dd></div>
              <template v-if="isConsolidated && cargoVolume">
                <div><dt class="mb-1 text-xs text-[var(--dh-text-muted)]">Volumen físico</dt><dd class="font-black text-[var(--dh-text)]">{{ cargoVolume.physical }}</dd></div>
                <div><dt class="mb-1 text-xs text-[var(--dh-text-muted)]">Volumen cobrable</dt><dd class="font-black text-[var(--dh-primary)]">{{ cargoVolume.chargeable }}</dd></div>
              </template>
              <div><dt class="mb-1 flex items-center gap-1 text-xs text-[var(--dh-text-muted)]"><Weight class="h-3.5 w-3.5" /> Peso</dt><dd class="font-bold">{{ cargoWeight }}</dd></div>
              <div><dt class="mb-1 flex items-center gap-1 text-xs text-[var(--dh-text-muted)]"><Ruler class="h-3.5 w-3.5" /> Medidas</dt><dd class="font-bold">{{ measurements }}</dd></div>
              <div><dt class="mb-1 text-xs text-[var(--dh-text-muted)]">Valor de la carga</dt><dd class="font-semibold">{{ label('cargoValue') }}</dd></div>
              <div><dt class="mb-1 text-xs text-[var(--dh-text-muted)]">CABYS</dt><dd class="font-semibold">{{ label('cabysCode') }}</dd></div>
              <div><dt class="mb-1 text-xs text-[var(--dh-text-muted)]">Peligrosa / sobrepeso</dt><dd class="font-semibold">{{ label('dangerousCargo') }} / {{ label('overweight') }}</dd></div>
              <div><dt class="mb-1 text-xs text-[var(--dh-text-muted)]">No estibable / almacenaje</dt><dd class="font-semibold">{{ label('nonStackable') }} / {{ label('storageDays') }} días</dd></div>
            </dl>
            <div v-if="notes !== 'No indicado' && notes !== remarks" class="rounded-xl border border-[var(--dh-border)] p-3 text-xs"><p class="mb-1 font-black">Notas adicionales</p><p class="whitespace-pre-wrap break-words leading-relaxed">{{ notes }}</p></div>
          </div>
        </section>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <section v-if="isExw" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4">
          <div class="mb-3 flex items-center gap-2"><MapPin class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Puntos de recolecta</h3><span class="rounded-full bg-[var(--dh-card)] px-2 py-0.5 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ pickupCards.length }}</span></div>
          <div v-if="pickupCards.length" class="grid gap-2 md:grid-cols-2">
            <div v-for="pickup in pickupCards" :key="pickup.index" class="min-w-0 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
              <div class="mb-2 flex items-center gap-2"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[rgb(var(--dh-primary-rgb)/0.12)] text-xs font-black text-[var(--dh-primary)]">{{ pickup.index }}</span><span class="min-w-0 break-words text-xs font-black">{{ pickup.address }}</span></div>
              <p class="text-[11px] font-bold text-[var(--dh-primary)]">{{ pickup.condition }}</p>
              <p v-if="pickup.coordinates" class="mt-1 text-[11px] text-[var(--dh-text-muted)]">Coordenadas: {{ pickup.coordinates }}</p>
            </div>
          </div>
          <p v-else class="text-xs text-[var(--dh-text-muted)]">No se indicaron puntos adicionales de recolecta.</p>
        </section>

        <section class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4">
          <div class="mb-3 flex items-center gap-2"><Paperclip class="h-4 w-4 text-[var(--dh-primary)]" /><h3 class="text-sm font-black">Adjuntos originales de Ventas</h3><span class="rounded-full bg-[var(--dh-card)] px-2 py-0.5 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ snapshot.documents.length }}</span></div>
          <div v-if="snapshot.documents.length" class="space-y-2">
            <div v-for="document in snapshot.documents" :key="document.id" class="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.09)] text-[var(--dh-primary)]"><FileText class="h-5 w-5" /></span>
              <div class="min-w-0 flex-1"><p class="break-all text-xs font-black">{{ document.fileName }}</p><p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">{{ document.categoryLabel }} · {{ fileKind(document.fileName) }}<span v-if="fileSize(document.sizeInBytes)"> · {{ fileSize(document.sizeInBytes) }}</span></p></div>
              <button type="button" class="inline-flex items-center gap-1.5 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-black transition hover:border-[var(--dh-primary)] hover:text-[var(--dh-primary)]" :aria-label="'Descargar ' + document.fileName" @click="emit('download', document)"><Download class="h-4 w-4" />Descargar</button>
            </div>
          </div>
          <p v-else class="text-xs text-[var(--dh-text-muted)]">Ventas no adjuntó documentos a esta solicitud.</p>
        </section>
      </div>
    </div>
  </details>
</template>
