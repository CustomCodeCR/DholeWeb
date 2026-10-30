<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { StorageService } from '@/core/services/storageService'
import { useToastStore } from '@/core/stores/toastStore'
import type { RateRevisionDto } from '@/core/interfaces/pricing'

type JsonRecord = Record<string, unknown>

const props = defineProps<{ revision: RateRevisionDto }>()
const toast = useToastStore()

interface HistoricalFile { id: string; name: string; size: number; available: boolean }
const historicalFiles = ref<HistoricalFile[]>([])
const filesLoading = ref(false)
let fileLoadSequence = 0

watch(() => props.revision.snapshotJson, async (json) => {
  const sequence = ++fileLoadSequence
  let snapshot: JsonRecord = {}
  try { snapshot = asRecord(JSON.parse(json || '{}')) } catch { /* Revisión antigua sin JSON válido */ }
  const rawIds = pick(snapshot, 'FinalBackupStorageIds', 'finalBackupStorageIds')
  const ids = Array.isArray(rawIds)
    ? [...new Set(rawIds.filter((item): item is string => typeof item === 'string' && !!item.trim()))]
    : []
  historicalFiles.value = []
  filesLoading.value = ids.length > 0
  const resolved = await Promise.all(ids.map(async (id): Promise<HistoricalFile> => {
    try {
      const file = await StorageService.getFile(id)
      return { id, name: file.originalFileName, size: file.sizeInBytes, available: true }
    } catch {
      return { id, name: 'Respaldo histórico no disponible en Storage', size: 0, available: false }
    }
  }))
  if (sequence === fileLoadSequence) {
    historicalFiles.value = resolved
    filesLoading.value = false
  }
}, { immediate: true })

async function downloadHistorical(file: HistoricalFile) {
  if (!file.available) return
  try {
    await StorageService.downloadFile({ id: file.id, fileName: file.name, sizeInBytes: file.size })
  } catch (error) {
    toast.backendError(error, 'No se pudo descargar el respaldo histórico.')
  }
}

function storedNumber(value: unknown, decimals = 2): string {
  if (value === null || value === undefined || value === '') return '—'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('es-CR', { maximumFractionDigits: decimals }) : '—'
}

function lineCurrency(detail: JsonRecord) {
  return normalizeCurrency(pick(detail, 'CurrencyName', 'currencyName', 'CurrencyCode', 'currencyCode'))
}
function lineQuantity(detail: JsonRecord) {
  const quantity = numberValue(pick(detail, 'Quantity', 'quantity'))
  return quantity > 0 ? quantity : 1
}
function lineSubtotal(detail: JsonRecord) {
  return numberValue(pick(detail, 'SaleAmount', 'saleAmount')) * lineQuantity(detail)
}
function lineTax(detail: JsonRecord) {
  return numberValue(pick(detail, 'DestinationTaxAmount', 'destinationTaxAmount'))
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function pick(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return null
}

function textValue(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeCurrency(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase()
  if (raw.includes('CRC')) return 'CRC'
  if (raw.includes('EUR')) return 'EUR'
  return 'USD'
}

function money(value: unknown, currency: unknown = 'USD') {
  const iso = normalizeCurrency(currency)
  return new Intl.NumberFormat(iso === 'CRC' ? 'es-CR' : 'en-US', {
    style: 'currency',
    currency: iso,
    minimumFractionDigits: 2,
  }).format(numberValue(value))
}

function dateValue(value: unknown) {
  if (!value) return '—'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('es-CR')
}

function lines(value: unknown) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function cleanHistoricalCargoDescription(value: unknown) {
  return String(value ?? '')
    .split(/\s+·\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !/^Recolecci[oó]n\s*:/i.test(segment))
    .filter((segment) => !/^WHS\s+(?:FCA|FOB)\s*:/i.test(segment))
    .join(' · ')
    .trim()
}

const snapshot = computed<JsonRecord>(() => {
  try {
    return asRecord(JSON.parse(props.revision.snapshotJson || '{}'))
  } catch {
    return {}
  }
})

const details = computed(() => {
  const value = pick(snapshot.value, 'Details', 'details')
  return Array.isArray(value) ? value.map(asRecord) : []
})

const historicalTotals = computed(() => {
  const exchangeRate = numberValue(
    pick(snapshot.value, 'ExchangeRateApplied', 'exchangeRateApplied')
      ?? pick(snapshot.value, 'ExchangeRateSale', 'exchangeRateSale'),
  )

  let costUsd = 0
  let saleUsd = 0
  let costCrc = 0
  let saleCrc = 0

  details.value.forEach((detail) => {
    const quantity = Math.max(0, numberValue(pick(detail, 'Quantity', 'quantity')) || 1)
    const cost = numberValue(pick(detail, 'CostAmount', 'costAmount')) * quantity
    const sale = numberValue(pick(detail, 'SaleAmount', 'saleAmount')) * quantity
    const currency = normalizeCurrency(
      pick(detail, 'CurrencyName', 'currencyName')
        ?? pick(detail, 'CurrencyCode', 'currencyCode'),
    )

    if (currency === 'CRC') {
      costCrc += cost
      saleCrc += sale
      if (exchangeRate > 0) {
        costUsd += cost / exchangeRate
        saleUsd += sale / exchangeRate
      }
      return
    }

    costUsd += cost
    saleUsd += sale
    if (exchangeRate > 0) {
      costCrc += cost * exchangeRate
      saleCrc += sale * exchangeRate
    }
  })

  const persistedCostUsd = numberValue(pick(snapshot.value, 'TotalCostUsd', 'totalCostUsd'))
  const persistedSaleUsd = numberValue(pick(snapshot.value, 'TotalSaleUsd', 'totalSaleUsd'))
  const persistedCostCrc = numberValue(pick(snapshot.value, 'TotalCostCrc', 'totalCostCrc'))
  const persistedSaleCrc = numberValue(pick(snapshot.value, 'TotalSaleCrc', 'totalSaleCrc'))

  // Revisiones antiguas pueden tener los encabezados totales en cero aunque el snapshot
  // sí conserve todas las líneas. En ese caso reconstruimos los totales desde Details.
  const useDerived = details.value.length > 0 && (
    (persistedCostUsd === 0 && persistedSaleUsd === 0)
    || (persistedCostCrc === 0 && persistedSaleCrc === 0)
  )

  const finalCostUsd = useDerived ? costUsd : persistedCostUsd
  const finalSaleUsd = useDerived ? saleUsd : persistedSaleUsd
  const finalCostCrc = useDerived ? costCrc : persistedCostCrc
  const finalSaleCrc = useDerived ? saleCrc : persistedSaleCrc
  const utilityUsd = finalSaleUsd - finalCostUsd
  const utilityCrc = finalSaleCrc - finalCostCrc
  const margin = finalSaleUsd > 0 ? (utilityUsd / finalSaleUsd) * 100 : 0

  return {
    costUsd: finalCostUsd,
    saleUsd: finalSaleUsd,
    utilityUsd,
    costCrc: finalCostCrc,
    saleCrc: finalSaleCrc,
    utilityCrc,
    margin,
    reconstructed: useDerived,
  }
})

const containers = computed(() => {
  const value = pick(snapshot.value, 'Containers', 'containers')
  return Array.isArray(value) ? value.map(asRecord) : []
})

const services = computed(() => {
  const value = pick(snapshot.value, 'Services', 'services')
  return Array.isArray(value) ? value.map(asRecord) : []
})

const cargoLines = computed(() => {
  const raw = pick(snapshot.value, 'CargoLinesJson', 'cargoLinesJson')
  if (Array.isArray(raw)) return raw.map(asRecord)
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(asRecord) : []
  } catch {
    return []
  }
})

const route = computed(() => {
  const pol = textValue(pick(snapshot.value, 'PolName', 'polName'))
  const poe = textValue(pick(snapshot.value, 'PoeName', 'poeName'))
  const pod = textValue(pick(snapshot.value, 'PodName', 'podName'))
  return [pol, poe, pod].filter((value, index, list) => value !== '—' && list.indexOf(value) === index).join(' → ') || '—'
})

const pickupLabel = computed(() => {
  const incoterm = textValue(pick(snapshot.value, 'IncotermName', 'incotermName', 'IncotermCode', 'incotermCode'), '')
    .toUpperCase()
  if (incoterm.includes('EXW')) return 'Recolección EXW'
  if (incoterm.includes('FOB')) return 'WHS FOB'
  if (incoterm.includes('FCA')) return 'WHS FCA'
  return 'WHS / dirección'
})

const includes = computed(() => lines(pick(snapshot.value, 'Includes', 'includes')))
const subjectTo = computed(() => lines(pick(snapshot.value, 'SubjectTo', 'subjectTo')))
const excludes = computed(() => lines(pick(snapshot.value, 'Excludes', 'excludes')))
const cargoAndOperation = computed(() => [
  { label: 'Modalidad', value: textValue(pick(snapshot.value, 'ShipmentMode', 'shipmentMode')) },
  { label: 'Operación', value: textValue(pick(snapshot.value, 'OperationType', 'operationType')) },
  { label: 'Tipo de tarifa', value: textValue(pick(snapshot.value, 'RateType', 'rateType')) },
  { label: 'Moneda', value: textValue(pick(snapshot.value, 'CurrencyName', 'currencyName', 'CurrencyCode', 'currencyCode')) },
  { label: 'Tiempo de tránsito', value: textValue(pick(snapshot.value, 'TransitTime', 'transitTime')) },
  { label: 'Bultos', value: storedNumber(pick(snapshot.value, 'TotalPackages', 'totalPackages'), 0) },
  { label: 'Tarimas', value: storedNumber(pick(snapshot.value, 'TotalPallets', 'totalPallets'), 0) },
  { label: 'Peso', value: storedNumber(pick(snapshot.value, 'TotalWeightKg', 'totalWeightKg')) + ' kg' },
  { label: 'Volumen', value: storedNumber(pick(snapshot.value, 'TotalVolumeCbm', 'totalVolumeCbm'), 3) + ' CBM' },
  { label: 'Cantidad cobrable', value: storedNumber(pick(snapshot.value, 'ChargeableQuantity', 'chargeableQuantity'), 3) },
  { label: 'Kg por CBM', value: storedNumber(pick(snapshot.value, 'KgPerCbm', 'kgPerCbm'), 3) },
  { label: 'Requiere aprobación', value: pick(snapshot.value, 'RequiredApproval', 'requiredApproval') === true ? 'Sí' : 'No' },
])
</script>

<template>
  <div class="min-w-0 space-y-5 text-sm">
    <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <DhBadge :label="`Revisión ${revision.revisionNumber}`" variant="primary" />
            <DhBadge :label="revision.status" variant="neutral" />
          </div>
          <p class="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Vista completa de la cotización histórica · Pantalla 9</p>
          <h3 class="mt-1 text-base font-black">{{ revision.rateName }}</h3>
          <p class="mt-1 text-xs font-bold text-[var(--dh-text-muted)]">
            {{ revision.idtraNumber || 'Sin IDTRA' }} · {{ revision.quoNumber || 'Sin QUO' }}
          </p>
        </div>
        <div class="text-right text-xs text-[var(--dh-text-muted)]">
          <p class="font-black">Guardada</p>
          <p>{{ dateValue(revision.createdAtUtc) }}</p>
        </div>
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Cliente</p>
        <p class="mt-1 font-black">{{ textValue(pick(snapshot, 'ClientName', 'clientName')) }}</p>
        <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Ejecutivo: {{ textValue(pick(snapshot, 'ExecutiveName', 'executiveName')) }}</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Ruta</p>
        <p class="mt-1 font-black">{{ route }}</p>
        <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ textValue(pick(snapshot, 'ShipmentMode', 'shipmentMode')) }} · {{ textValue(pick(snapshot, 'OperationType', 'operationType')) }}</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Proveedor</p>
        <p class="mt-1 font-black">{{ textValue(pick(snapshot, 'CarrierName', 'carrierName')) }}</p>
        <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Agente: {{ textValue(pick(snapshot, 'AgentName', 'agentName')) }}</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Incoterm / equipo</p>
        <p class="mt-1 font-black">{{ textValue(pick(snapshot, 'IncotermName', 'incotermName')) }}</p>
        <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ textValue(pick(snapshot, 'ContainerTypeName', 'containerTypeName')) }} · {{ numberValue(pick(snapshot, 'ContainerQuantity', 'containerQuantity')) }} unidad(es)</p>
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Venta</p>
        <p class="mt-1 text-lg font-black">{{ money(historicalTotals.saleUsd, 'USD') }}</p>
        <p class="text-xs text-[var(--dh-text-muted)]">{{ money(historicalTotals.saleCrc, 'CRC') }}</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Costo</p>
        <p class="mt-1 text-lg font-black">{{ money(historicalTotals.costUsd, 'USD') }}</p>
        <p class="text-xs text-[var(--dh-text-muted)]">{{ money(historicalTotals.costCrc, 'CRC') }}</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Utilidad</p>
        <p class="mt-1 text-lg font-black">{{ money(historicalTotals.utilityUsd, 'USD') }}</p>
        <p class="text-xs text-[var(--dh-text-muted)]">{{ money(historicalTotals.utilityCrc, 'CRC') }}</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Margen</p>
        <p class="mt-1 text-lg font-black">{{ historicalTotals.margin.toFixed(2) }}%</p>
        <p class="text-xs text-[var(--dh-text-muted)]">Días libres: {{ numberValue(pick(snapshot, 'FreeDays', 'freeDays')) }}</p>
        <p v-if="historicalTotals.reconstructed" class="mt-1 text-[10px] font-bold text-[var(--dh-text-muted)]">Totales reconstruidos desde las líneas guardadas de esta revisión.</p>
      </div>
    </section>

    <section class="rounded-2xl border border-[var(--dh-border)] p-4">
      <h4 class="text-xs font-black uppercase tracking-[0.12em]">Carga y datos de la operación</h4>
      <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="item in cargoAndOperation" :key="item.label" class="rounded-xl bg-[var(--dh-card)] p-3">
          <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">{{ item.label }}</p>
          <p class="mt-1 break-words text-xs font-bold">{{ item.value }}</p>
        </div>
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-2">
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em]">Vigencia y tipo de cambio</p>
        <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <dt class="text-[var(--dh-text-muted)]">Desde</dt><dd class="font-bold">{{ dateValue(pick(snapshot, 'ValidFrom', 'validFrom')) }}</dd>
          <dt class="text-[var(--dh-text-muted)]">Hasta</dt><dd class="font-bold">{{ dateValue(pick(snapshot, 'ValidTo', 'validTo')) }}</dd>
          <dt class="text-[var(--dh-text-muted)]">Compra</dt><dd class="font-bold">{{ numberValue(pick(snapshot, 'ExchangeRatePurchase', 'exchangeRatePurchase')).toFixed(2) }}</dd>
          <dt class="text-[var(--dh-text-muted)]">Venta</dt><dd class="font-bold">{{ numberValue(pick(snapshot, 'ExchangeRateSale', 'exchangeRateSale')).toFixed(2) }}</dd>
        </dl>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em]">{{ pickupLabel }}</p>
        <p class="mt-3 font-bold">{{ textValue(pick(snapshot, 'PickupAddress', 'pickupAddress'), 'Sin WHS / dirección guardada') }}</p>
        <p class="mt-2 text-xs text-[var(--dh-text-muted)]">
          {{ textValue(pick(snapshot, 'PickupLatitude', 'pickupLatitude')) }},
          {{ textValue(pick(snapshot, 'PickupLongitude', 'pickupLongitude')) }}
        </p>
      </div>
    </section>

    <section v-if="containers.length || services.length" class="grid gap-3 md:grid-cols-2">
      <div v-if="containers.length" class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em]">Contenedores</p>
        <div class="mt-3 space-y-2">
          <div v-for="(container, index) in containers" :key="index" class="flex items-center justify-between rounded-xl bg-[var(--dh-card)] px-3 py-2">
            <span class="font-bold">{{ textValue(pick(container, 'ContainerTypeName', 'containerTypeName')) }}</span>
            <span class="text-xs font-black">x {{ numberValue(pick(container, 'Quantity', 'quantity')) }}</span>
          </div>
        </div>
      </div>
      <div v-if="services.length" class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em]">Servicios</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="(service, index) in services" :key="index" class="rounded-full border border-[var(--dh-border)] px-3 py-1 text-xs font-bold">
            {{ textValue(pick(service, 'ServiceName', 'serviceName')) }}
          </span>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-[var(--dh-border)] p-4">
      <h4 class="text-xs font-black uppercase tracking-[0.12em]">Archivos adjuntos guardados con esta versión</h4>
      <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Solo los respaldos finales conservados en la instantánea; no se consultan adjuntos de revisiones posteriores.</p>
      <p v-if="filesLoading" class="mt-2 text-xs text-[var(--dh-text-muted)]">Cargando respaldos históricos…</p>
      <div v-if="historicalFiles.length" class="mt-3 grid gap-2 md:grid-cols-2">
        <div v-for="file in historicalFiles" :key="file.id" class="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-[var(--dh-card)] p-3">
          <div class="min-w-0">
            <p class="break-all text-xs font-bold">{{ file.name }}</p>
            <p v-if="file.available" class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ storedNumber(file.size / 1024, 1) }} KB</p>
          </div>
          <DhButton v-if="file.available" variant="secondary" size="sm" @click="downloadHistorical(file)">Descargar</DhButton>
        </div>
      </div>
      <p v-else-if="!filesLoading" class="mt-2 text-xs text-[var(--dh-text-muted)]">No hay respaldos finales registrados en esta revisión.</p>
    </section>

    <section v-if="cargoLines.length" class="rounded-2xl border border-[var(--dh-border)] p-4">
      <p class="text-xs font-black uppercase tracking-[0.12em]">Detalle de carga original</p>
      <div class="mt-3 space-y-3">
        <div v-for="(cargo, index) in cargoLines" :key="index" class="rounded-xl bg-[var(--dh-card)] p-3">
          <p class="font-bold">{{ cleanHistoricalCargoDescription(pick(cargo, 'Description', 'description')) || 'Carga sin descripción' }}</p>
          <p class="mt-2 text-xs text-[var(--dh-text-muted)]">
            Peso {{ numberValue(pick(cargo, 'WeightKg', 'weightKg')) }} kg ·
            Pallets {{ numberValue(pick(cargo, 'Pallets', 'pallets')) }} ·
            Volumen {{ numberValue(pick(cargo, 'VolumeCbm', 'volumeCbm')).toFixed(3) }} CBM
          </p>
        </div>
      </div>
    </section>

    <section class="grid gap-3 xl:grid-cols-3">
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em]">Incluye</p>
        <ul v-if="includes.length" class="mt-3 space-y-1 text-xs">
          <li v-for="item in includes" :key="item">• {{ item }}</li>
        </ul>
        <p v-else class="mt-3 text-xs text-[var(--dh-text-muted)]">Sin elementos.</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em]">Sujeto a</p>
        <ul v-if="subjectTo.length" class="mt-3 space-y-1 text-xs">
          <li v-for="item in subjectTo" :key="item">• {{ item }}</li>
        </ul>
        <p v-else class="mt-3 text-xs text-[var(--dh-text-muted)]">Sin elementos.</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-xs font-black uppercase tracking-[0.12em]">No incluye</p>
        <ul v-if="excludes.length" class="mt-3 space-y-1 text-xs">
          <li v-for="item in excludes" :key="item">• {{ item }}</li>
        </ul>
        <p v-else class="mt-3 text-xs text-[var(--dh-text-muted)]">Sin elementos.</p>
      </div>
    </section>

    <section class="overflow-hidden rounded-2xl border border-[var(--dh-border)]">
      <div class="border-b border-[var(--dh-border)] px-4 py-3">
        <p class="text-xs font-black uppercase tracking-[0.12em]">Líneas completas de la tarifa · {{ details.length }}</p>
      </div>
      <div v-if="details.length" class="overflow-x-auto">
        <table class="min-w-[1250px] w-full text-left text-xs">
          <thead class="bg-[var(--dh-card)] text-[var(--dh-text-muted)]">
            <tr>
              <th class="px-3 py-2">Rubro</th>
              <th class="px-3 py-2">Base</th>
              <th class="px-3 py-2">Tipo</th>
              <th class="px-3 py-2">Moneda</th>
              <th class="px-3 py-2 text-right">Cant.</th>
              <th class="px-3 py-2 text-right">Costo unit.</th>
              <th class="px-3 py-2 text-right">Venta unit.</th>
              <th class="px-3 py-2 text-right">Venta subtotal</th>
              <th class="px-3 py-2 text-right">IVA</th>
              <th class="px-3 py-2 text-right">Venta total</th>
              <th class="px-3 py-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(detail, index) in details" :key="String(pick(detail, 'Id', 'id') ?? index)" class="border-t border-[var(--dh-border)]">
              <td class="px-3 py-2 font-bold">{{ textValue(pick(detail, 'Name', 'name')) }}</td>
              <td class="px-3 py-2">{{ textValue(pick(detail, 'ChargeBasis', 'chargeBasis')) }}</td>
              <td class="px-3 py-2">{{ textValue(pick(detail, 'CostDetailType', 'costDetailType', 'CostType', 'costType')) }}</td>
              <td class="px-3 py-2">{{ lineCurrency(detail) }}</td>
              <td class="px-3 py-2 text-right">{{ storedNumber(pick(detail, 'Quantity', 'quantity'), 3) }}</td>
              <td class="px-3 py-2 text-right">{{ money(pick(detail, 'CostAmount', 'costAmount'), lineCurrency(detail)) }}</td>
              <td class="px-3 py-2 text-right">{{ money(pick(detail, 'SaleAmount', 'saleAmount'), lineCurrency(detail)) }}</td>
              <td class="px-3 py-2 text-right">{{ money(lineSubtotal(detail), lineCurrency(detail)) }}</td>
              <td class="px-3 py-2 text-right">{{ money(lineTax(detail), lineCurrency(detail)) }}</td>
              <td class="px-3 py-2 text-right font-bold">{{ money(lineSubtotal(detail) + lineTax(detail), lineCurrency(detail)) }}</td>
              <td class="max-w-[320px] whitespace-pre-wrap px-3 py-2 text-[var(--dh-text-muted)]">{{ textValue(pick(detail, 'Notes', 'notes'), '') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="p-4 text-xs text-[var(--dh-text-muted)]">Esta revisión no contiene líneas de costo en la instantánea.</p>
      <p v-if="details.length" class="border-t border-[var(--dh-border)] p-3 text-[10px] text-[var(--dh-text-muted)]">Los subtotales visibles de cada línea se obtienen de los montos unitarios, cantidades e IVA conservados en esta versión; no modifican la cotización.</p>
    </section>
  </div>
</template>
