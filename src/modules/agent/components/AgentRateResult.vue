<script setup lang="ts">
import { computed } from 'vue'
import { DhBadge } from '@/shared/components/atoms'
import AgentJsonViewer from './AgentJsonViewer.vue'

const props = defineProps<{
  value: string | unknown | null | undefined
  extractedAt?: string | null
}>()

type Row = {
  key: string
  status: string
  route: string
  equipment: string
  products: string
  oceanFreight: number | null
  allIn: number | null
  currency: string
  cargoCutoff: unknown
  etd: unknown
  eta: unknown
  transitDays: number | null
  vessel: string
  voyage: string
  error: string
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function get(obj: Record<string, unknown> | null, ...keys: string[]) {
  if (!obj) return null

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
    const match = Object.keys(obj).find(
      (candidate) => candidate.toLowerCase() === key.toLowerCase(),
    )
    if (match && obj[match] !== undefined && obj[match] !== null) return obj[match]
  }

  return null
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function moneyParts(value: unknown) {
  const object = readObject(value)
  if (!object) return { amount: null as number | null, currency: '' }

  return {
    amount: asNumber(get(object, 'amount', 'value')),
    currency: asText(get(object, 'currency', 'unit', 'currencyCode')),
  }
}

function formatMoney(value: number | null, currency: string) {
  if (value == null) return '—'

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency || 'USD'} ${value.toFixed(2)}`
  }
}

function formatDateTime(value: unknown) {
  if (!value) return '—'
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return String(value)

  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function formatExtractionTime(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'America/Costa_Rica',
  }).format(parsed)
}

function routeLabel(route: Record<string, unknown> | null) {
  const values = [
    get(route, 'polName', 'polCode'),
    get(route, 'poeName', 'poeCode'),
    get(route, 'podName', 'podCode'),
  ]
    .map(asText)
    .filter(Boolean)

  return [...new Set(values)].join(' → ') || '—'
}

function equipmentLabel(equipment: Record<string, unknown> | null) {
  const name = asText(get(equipment, 'name'))
  const code = asText(get(equipment, 'code'))

  if (name && code && name.toLowerCase() !== code.toLowerCase()) return `${name} · ${code}`
  return name || code || '—'
}

const parsed = computed<unknown>(() => {
  if (typeof props.value !== 'string') return props.value

  try {
    return JSON.parse(props.value)
  } catch {
    return null
  }
})

const root = computed(() => readObject(parsed.value))
const extractionData = computed(() => {
  const object = root.value
  if (!object) return null
  return readObject(object.data) ?? object
})

const results = computed(() => {
  const data = extractionData.value
  if (!data || !Array.isArray(data.results)) return []

  return data.results
    .map((item) => readObject(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
})

const rows = computed<Row[]>(() =>
  results.value.flatMap((result, resultIndex) => {
    const route = readObject(get(result, 'route'))
    const equipment = readObject(get(result, 'equipment'))
    const fields = readObject(get(result, 'fields'))
    const status = asText(get(result, 'status')) || 'Unknown'
    const offers = Array.isArray(get(result, 'offers'))
      ? (get(result, 'offers') as unknown[])
          .map((item) => readObject(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
      : []

    const base = {
      status,
      route: routeLabel(route),
      equipment: equipmentLabel(equipment),
      error: asText(get(result, 'error')),
    }

    if (!offers.length) {
      return [
        {
          key: `${asText(get(result, 'routeId'))}-${asText(get(result, 'equipmentId'))}-${resultIndex}`,
          ...base,
          products: '',
          oceanFreight: asNumber(
            get(fields, 'totalBasicFreightAmount', 'oceanFreight', 'price'),
          ),
          allIn: asNumber(get(fields, 'allIn')),
          currency: asText(get(fields, 'currency')) || 'USD',
          cargoCutoff: get(fields, 'cargoCutoff', 'ccc', 'etd'),
          etd: get(fields, 'scheduleEtd', 'sailingEtd'),
          eta: get(fields, 'eta'),
          transitDays: asNumber(get(fields, 'transitDays', 'transitTime')),
          vessel: asText(get(fields, 'vessel')),
          voyage: asText(get(fields, 'voyage')),
        },
      ]
    }

    return offers.map((offer, offerIndex) => {
      const freight = moneyParts(get(offer, 'oceanFreight'))
      const allIn = moneyParts(get(offer, 'allIn'))
      const products = Array.isArray(get(offer, 'products'))
        ? (get(offer, 'products') as unknown[]).map(asText).filter(Boolean).join(', ')
        : ''

      return {
        key: `${asText(get(offer, 'externalRouteId')) || resultIndex}-${offerIndex}`,
        ...base,
        products,
        oceanFreight:
          freight.amount ??
          asNumber(get(fields, 'totalBasicFreightAmount', 'oceanFreight', 'price')),
        allIn: allIn.amount ?? asNumber(get(fields, 'allIn')),
        currency:
          freight.currency ||
          allIn.currency ||
          asText(get(fields, 'currency')) ||
          'USD',
        cargoCutoff: get(offer, 'cargoCutoff') ?? get(fields, 'cargoCutoff', 'ccc', 'etd'),
        etd: get(offer, 'etd') ?? get(fields, 'scheduleEtd', 'sailingEtd'),
        eta: get(offer, 'eta') ?? get(fields, 'eta'),
        transitDays:
          asNumber(get(offer, 'transitDays')) ??
          asNumber(get(fields, 'transitDays', 'transitTime')),
        vessel: asText(get(offer, 'vessel') ?? get(fields, 'vessel')),
        voyage: asText(get(offer, 'voyage') ?? get(fields, 'voyage')),
      }
    })
  }),
)

const summary = computed(() => {
  const object = root.value
  return {
    provider: asText(get(object, 'providerName', 'provider')) || '—',
    planned: asNumber(get(object, 'plannedSearchCount')),
    completed: asNumber(get(object, 'completedSearchCount')),
    available: asNumber(get(object, 'availableSearchCount')),
    failed: asNumber(get(object, 'failedSearchCount')),
  }
})

function statusVariant(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  const normalized = status.toLowerCase()
  if (normalized === 'available') return 'success'
  if (normalized === 'error') return 'danger'
  if (normalized === 'unavailable') return 'warning'
  return 'neutral'
}
</script>

<template>
  <div v-if="rows.length" class="space-y-4">
    <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--dh-text-muted)]">
      <DhBadge :label="summary.provider" variant="neutral" />
      <span v-if="summary.completed != null">
        {{ summary.completed }}/{{ summary.planned ?? summary.completed }} búsquedas completadas
      </span>
      <span v-if="summary.available != null">· {{ summary.available }} disponibles</span>
      <span v-if="summary.failed">· {{ summary.failed }} con error</span>
      <span>· Extraído {{ formatExtractionTime(extractedAt) }}</span>
    </div>

    <div class="overflow-hidden rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div class="overflow-x-auto">
        <table class="min-w-[1500px] w-full text-sm">
          <thead class="border-b border-[var(--dh-border)] bg-black/[0.025] dark:bg-white/[0.025]">
            <tr class="text-left text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
              <th class="px-3 py-3">Estado</th>
              <th class="px-3 py-3">Ruta</th>
              <th class="px-3 py-3">Equipo</th>
              <th class="px-3 py-3">Producto</th>
              <th class="px-3 py-3 text-right">Flete</th>
              <th class="px-3 py-3 text-right">All-in</th>
              <th class="px-3 py-3">CCC</th>
              <th class="px-3 py-3">ETD</th>
              <th class="px-3 py-3">ETA</th>
              <th class="px-3 py-3 text-center">Tránsito</th>
              <th class="px-3 py-3">Buque / Viaje</th>
              <th class="px-3 py-3">Extraído</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.key"
              class="border-b border-[var(--dh-border)] last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
            >
              <td class="px-3 py-3 align-top">
                <DhBadge :label="row.status" :variant="statusVariant(row.status)" />
                <p v-if="row.error" class="mt-1 max-w-[220px] text-[11px] font-semibold text-red-600">
                  {{ row.error }}
                </p>
              </td>
              <td class="min-w-[240px] px-3 py-3 align-top font-bold text-[var(--dh-text)]">
                {{ row.route }}
              </td>
              <td class="whitespace-nowrap px-3 py-3 align-top font-semibold">
                {{ row.equipment }}
              </td>
              <td class="min-w-[180px] px-3 py-3 align-top text-xs font-semibold">
                {{ row.products || '—' }}
              </td>
              <td class="whitespace-nowrap px-3 py-3 text-right align-top font-black">
                {{ formatMoney(row.oceanFreight, row.currency) }}
              </td>
              <td class="whitespace-nowrap px-3 py-3 text-right align-top font-black">
                {{ formatMoney(row.allIn, row.currency) }}
              </td>
              <td class="whitespace-nowrap px-3 py-3 align-top text-xs font-semibold">
                {{ formatDateTime(row.cargoCutoff) }}
              </td>
              <td class="whitespace-nowrap px-3 py-3 align-top text-xs font-semibold">
                {{ formatDateTime(row.etd) }}
              </td>
              <td class="whitespace-nowrap px-3 py-3 align-top text-xs font-semibold">
                {{ formatDateTime(row.eta) }}
              </td>
              <td class="whitespace-nowrap px-3 py-3 text-center align-top font-black">
                {{ row.transitDays == null ? '—' : `${Math.ceil(row.transitDays)} días` }}
              </td>
              <td class="min-w-[170px] px-3 py-3 align-top">
                <p class="font-bold">{{ row.vessel || '—' }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">{{ row.voyage || '—' }}</p>
              </td>
              <td class="whitespace-nowrap px-3 py-3 align-top text-xs font-semibold">
                {{ formatExtractionTime(extractedAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <AgentJsonViewer v-else :value="value" />
</template>
