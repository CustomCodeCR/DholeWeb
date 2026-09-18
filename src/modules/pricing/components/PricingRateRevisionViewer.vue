<script setup lang="ts">
import { computed } from 'vue'
import { DhBadge } from '@/shared/components/atoms'
import type { RateRevisionDto } from '@/core/interfaces/pricing'

type JsonRecord = Record<string, unknown>

const props = defineProps<{ revision: RateRevisionDto }>()

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

const includes = computed(() => lines(pick(snapshot.value, 'Includes', 'includes')))
const subjectTo = computed(() => lines(pick(snapshot.value, 'SubjectTo', 'subjectTo')))
const excludes = computed(() => lines(pick(snapshot.value, 'Excludes', 'excludes')))
</script>

<template>
  <div class="space-y-5 text-sm">
    <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <DhBadge :label="`Revisión ${revision.revisionNumber}`" variant="primary" />
            <DhBadge :label="revision.status" variant="neutral" />
          </div>
          <h3 class="mt-3 text-base font-black">{{ revision.rateName }}</h3>
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
        <p class="mt-1 text-lg font-black">{{ money(pick(snapshot, 'TotalSaleUsd', 'totalSaleUsd'), 'USD') }}</p>
        <p class="text-xs text-[var(--dh-text-muted)]">{{ money(pick(snapshot, 'TotalSaleCrc', 'totalSaleCrc'), 'CRC') }}</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Costo</p>
        <p class="mt-1 text-lg font-black">{{ money(pick(snapshot, 'TotalCostUsd', 'totalCostUsd'), 'USD') }}</p>
        <p class="text-xs text-[var(--dh-text-muted)]">{{ money(pick(snapshot, 'TotalCostCrc', 'totalCostCrc'), 'CRC') }}</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Utilidad</p>
        <p class="mt-1 text-lg font-black">{{ money(pick(snapshot, 'TotalUtilityUsd', 'totalUtilityUsd'), 'USD') }}</p>
        <p class="text-xs text-[var(--dh-text-muted)]">{{ money(pick(snapshot, 'TotalUtilityCrc', 'totalUtilityCrc'), 'CRC') }}</p>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--dh-text-muted)]">Margen</p>
        <p class="mt-1 text-lg font-black">{{ numberValue(pick(snapshot, 'MarginPercentage', 'marginPercentage')).toFixed(2) }}%</p>
        <p class="text-xs text-[var(--dh-text-muted)]">Días libres: {{ numberValue(pick(snapshot, 'FreeDays', 'freeDays')) }}</p>
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
        <p class="text-xs font-black uppercase tracking-[0.12em]">WHS / recolección</p>
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

    <section v-if="cargoLines.length" class="rounded-2xl border border-[var(--dh-border)] p-4">
      <p class="text-xs font-black uppercase tracking-[0.12em]">Carga</p>
      <div class="mt-3 space-y-3">
        <div v-for="(cargo, index) in cargoLines" :key="index" class="rounded-xl bg-[var(--dh-card)] p-3">
          <p class="font-bold">{{ textValue(pick(cargo, 'Description', 'description'), 'Carga sin descripción') }}</p>
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
        <p class="text-xs font-black uppercase tracking-[0.12em]">Detalle completo de costos y recargos · {{ details.length }}</p>
      </div>
      <div v-if="details.length" class="overflow-x-auto">
        <table class="min-w-[980px] w-full text-left text-xs">
          <thead class="bg-[var(--dh-card)] text-[var(--dh-text-muted)]">
            <tr>
              <th class="px-3 py-2">Concepto</th>
              <th class="px-3 py-2">Tipo</th>
              <th class="px-3 py-2">Moneda</th>
              <th class="px-3 py-2 text-right">Cantidad</th>
              <th class="px-3 py-2 text-right">Costo</th>
              <th class="px-3 py-2 text-right">Venta</th>
              <th class="px-3 py-2 text-right">Utilidad</th>
              <th class="px-3 py-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(detail, index) in details" :key="String(pick(detail, 'Id', 'id') ?? index)" class="border-t border-[var(--dh-border)]">
              <td class="px-3 py-2 font-bold">{{ textValue(pick(detail, 'Name', 'name')) }}</td>
              <td class="px-3 py-2">{{ textValue(pick(detail, 'CostType', 'costType')) }}</td>
              <td class="px-3 py-2">{{ textValue(pick(detail, 'CurrencyName', 'currencyName')) }}</td>
              <td class="px-3 py-2 text-right">{{ numberValue(pick(detail, 'Quantity', 'quantity')) }}</td>
              <td class="px-3 py-2 text-right">{{ money(pick(detail, 'CostAmount', 'costAmount'), textValue(pick(detail, 'CurrencyCode', 'currencyCode'), 'USD')) }}</td>
              <td class="px-3 py-2 text-right">{{ money(pick(detail, 'SaleAmount', 'saleAmount'), textValue(pick(detail, 'CurrencyCode', 'currencyCode'), 'USD')) }}</td>
              <td class="px-3 py-2 text-right">{{ money(pick(detail, 'UtilityAmount', 'utilityAmount'), textValue(pick(detail, 'CurrencyCode', 'currencyCode'), 'USD')) }}</td>
              <td class="max-w-[320px] whitespace-pre-wrap px-3 py-2 text-[var(--dh-text-muted)]">{{ textValue(pick(detail, 'Notes', 'notes'), '') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="p-4 text-xs text-[var(--dh-text-muted)]">Esta revisión no contiene líneas de costo en la instantánea.</p>
    </section>
  </div>
</template>
