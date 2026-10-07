<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhBadge } from '@/shared/components/atoms'
import AgentJsonViewer from './AgentJsonViewer.vue'

const { t, locale } = useI18n()

const props = defineProps<{
  value: string | unknown | null | undefined
  extractedAt?: string | null
}>()

type Row = {
  key: string
  status: string
  route: string
  externalRouteId: string
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

  return new Intl.DateTimeFormat(locale.value === 'es' ? 'es-CR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function formatExtractionTime(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat(locale.value === 'es' ? 'es-CR' : 'en-US', {
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

    const availableOffers = offers.filter((offer) => {
      const value = get(offer, 'available')
      return value === true || asText(value).toLowerCase() === 'true'
    })

    if (!availableOffers.length) {
      return [
        {
          key: `${asText(get(result, 'routeId'))}-${asText(get(result, 'equipmentId'))}-${resultIndex}`,
          ...base,
          status: status.toLowerCase() === 'error' ? status : 'Unavailable',
          externalRouteId: '',
          products: '',
          oceanFreight: null,
          allIn: null,
          currency: asText(get(fields, 'currency')) || 'USD',
          cargoCutoff: null,
          etd: null,
          eta: null,
          transitDays: null,
          vessel: '',
          voyage: '',
        },
      ]
    }

    return availableOffers.map((offer, offerIndex) => {
      const freight = moneyParts(get(offer, 'oceanFreight'))
      const allIn = moneyParts(get(offer, 'allIn'))
      const products = Array.isArray(get(offer, 'products'))
        ? (get(offer, 'products') as unknown[]).map(asText).filter(Boolean).join(', ')
        : ''

      const availableValue = get(offer, 'available')
      const offerStatus =
        availableValue === true || asText(availableValue).toLowerCase() === 'true'
          ? 'Available'
          : availableValue === false || asText(availableValue).toLowerCase() === 'false'
            ? 'Unavailable'
            : status

      return {
        key: `${asText(get(offer, 'externalRouteId')) || resultIndex}-${offerIndex}`,
        ...base,
        status: offerStatus,
        externalRouteId: asText(get(offer, 'externalRouteId')),
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
    returnedOffers: rows.value.filter((row) => row.externalRouteId).length,
    availableOffers: rows.value.filter(
      (row) => row.externalRouteId && row.status.toLowerCase() === 'available',
    ).length,
  }
})

function displayStatus(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'available') return t('agent.rateResult.available')
  if (normalized === 'unavailable') return t('agent.rateResult.unavailable')
  if (normalized === 'error') return t('agent.rateResult.error')
  if (normalized === 'unknown') return t('agent.rateResult.unknown')
  return status
}

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
    <div>
      <h3 class="text-base font-black text-[var(--dh-text)]">{{ t('agent.rateResult.titleExtracted') }}</h3>
      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
        {{ t('agent.rateResult.subtitleExtracted') }}
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--dh-text-muted)]">
      <DhBadge :label="summary.provider" variant="neutral" />
      <span v-if="summary.completed != null">
        {{ t('agent.rateResult.searchesCompleted', { completed: summary.completed, planned: summary.planned ?? summary.completed }) }}
      </span>
      <span v-if="summary.returnedOffers">
        · {{ t('agent.rateResult.returnedOffers', { count: summary.returnedOffers }) }}
      </span>
      <span v-if="summary.returnedOffers">· {{ t('agent.rateResult.availableCount', { count: summary.availableOffers }) }}</span>
      <span v-else-if="summary.available != null">· {{ t('agent.rateResult.availableCount', { count: summary.available }) }}</span>
      <span v-if="summary.failed">· {{ t('agent.rateResult.errorCount', { count: summary.failed }) }}</span>
      <span>· {{ t('agent.rateResult.extractedAt', { date: formatExtractionTime(extractedAt) }) }}</span>
    </div>

    <div data-agent-rate-mobile class="grid gap-3 md:hidden">
      <article
        v-for="row in rows"
        :key="`mobile:${row.key}`"
        class="min-w-0 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]"
      >
        <div class="flex min-w-0 items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="break-words font-black text-[var(--dh-text)]">{{ row.route }}</p>
            <p v-if="row.externalRouteId" class="mt-1 break-all text-[10px] font-semibold text-[var(--dh-text-muted)]">{{ row.externalRouteId }}</p>
          </div>
          <DhBadge :label="displayStatus(row.status)" :variant="statusVariant(row.status)" />
        </div>
        <p v-if="row.error" class="mt-2 break-words text-xs font-semibold text-red-600">{{ row.error }}</p>

        <dl class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.04]">
            <dt class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('agent.rateResult.equipment') }}</dt>
            <dd class="mt-1 break-words font-bold text-[var(--dh-text)]">{{ row.equipment }}</dd>
          </div>
          <div class="rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.04]">
            <dt class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('agent.rateResult.transitDays') }}</dt>
            <dd class="mt-1 font-bold text-[var(--dh-text)]">{{ row.transitDays == null ? '—' : t('agent.rateResult.days', { count: Math.ceil(row.transitDays) }) }}</dd>
          </div>
          <div class="rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.04]">
            <dt class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('agent.rateResult.oceanFreight') }}</dt>
            <dd class="mt-1 font-black text-[var(--dh-text)]">{{ formatMoney(row.oceanFreight, row.currency) }}</dd>
          </div>
          <div class="rounded-xl bg-black/[0.035] p-3 dark:bg-white/[0.04]">
            <dt class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('agent.rateResult.allIn') }}</dt>
            <dd class="mt-1 font-black text-[var(--dh-text)]">{{ formatMoney(row.allIn, row.currency) }}</dd>
          </div>
        </dl>

        <div v-if="row.products" class="mt-3 rounded-xl border border-[var(--dh-border)] p-3 text-xs">
          <span class="font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ t('agent.rateResult.product') }}</span>
          <p class="mt-1 break-words font-semibold">{{ row.products }}</p>
        </div>

        <dl class="mt-3 grid gap-2 text-xs">
          <div class="flex items-center justify-between gap-3"><dt class="font-black text-[var(--dh-text-muted)]">{{ t('agent.rateResult.cargoCutoff') }}</dt><dd class="text-right font-semibold">{{ formatDateTime(row.cargoCutoff) }}</dd></div>
          <div class="flex items-center justify-between gap-3"><dt class="font-black text-[var(--dh-text-muted)]">{{ t('agent.rateResult.etd') }}</dt><dd class="text-right font-semibold">{{ formatDateTime(row.etd) }}</dd></div>
          <div class="flex items-center justify-between gap-3"><dt class="font-black text-[var(--dh-text-muted)]">{{ t('agent.rateResult.eta') }}</dt><dd class="text-right font-semibold">{{ formatDateTime(row.eta) }}</dd></div>
          <div class="flex items-start justify-between gap-3"><dt class="font-black text-[var(--dh-text-muted)]">{{ t('agent.rateResult.vesselVoyage') }}</dt><dd class="min-w-0 text-right font-semibold"><span class="block break-words">{{ row.vessel || '—' }}</span><span class="block break-words text-[var(--dh-text-muted)]">{{ row.voyage || '—' }}</span></dd></div>
        </dl>
      </article>
    </div>

    <div class="hidden overflow-hidden rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] md:block">
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
                <DhBadge :label="displayStatus(row.status)" :variant="statusVariant(row.status)" />
                <p v-if="row.error" class="mt-1 max-w-[220px] text-[11px] font-semibold text-red-600">
                  {{ row.error }}
                </p>
              </td>
              <td class="min-w-[260px] px-3 py-3 align-top font-bold text-[var(--dh-text)]">
                <p>{{ row.route }}</p>
                <p
                  v-if="row.externalRouteId"
                  class="mt-1 break-all text-[10px] font-semibold text-[var(--dh-text-muted)]"
                >
                  {{ row.externalRouteId }}
                </p>
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
                {{ row.transitDays == null ? '—' : t('agent.rateResult.days', { count: Math.ceil(row.transitDays) }) }}
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
