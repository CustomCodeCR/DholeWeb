<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhBadge } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import AgentJsonViewer from './AgentJsonViewer.vue'

const { t } = useI18n()

const props = defineProps<{ value: string | unknown | null | undefined }>()

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
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

const extractionResults = computed(() => {
  const data = extractionData.value
  if (!data || !Array.isArray(data.results)) return []
  return data.results
    .map((item) => readObject(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
})

const rate = computed(() => {
  const object = extractionData.value
  if (!object) return null

  const candidates = [object, readObject(object.result), readObject(object.data), readObject(object.rate)]
  return candidates.find((item) => {
    if (!item) return false
    const keys = Object.keys(item).map((key) => key.toLowerCase())
    return keys.some((key) =>
      ['etd', 'eta', 'transitdays', 'vessel', 'voyage', 'oceanfreight', 'allin', 'currency'].includes(key),
    )
  }) ?? null
})

function get(obj: Record<string, unknown> | null, ...keys: string[]) {
  if (!obj) return null
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
    const found = Object.keys(obj).find((candidate) => candidate.toLowerCase() === key.toLowerCase())
    if (found && obj[found] !== undefined && obj[found] !== null) return obj[found]
  }
  return null
}

function resultFields(item: Record<string, unknown>) {
  return readObject(item.fields)
}

function resultTitle(item: Record<string, unknown>, index: number) {
  const route = readObject(item.route)
  const equipment = readObject(item.equipment)
  const pol = get(route, 'polName', 'polCode')
  const pod = get(route, 'podName', 'podCode', 'poeName', 'poeCode')
  const equipmentCode = get(equipment, 'code', 'name')
  return [pol, pod, equipmentCode].filter(Boolean).join(' → ') || `Resultado ${index + 1}`
}

function statusVariant(item: Record<string, unknown>): 'success' | 'danger' | 'neutral' {
  const status = String(get(item, 'status') ?? '').toLowerCase()
  if (status === 'available') return 'success'
  if (status === 'error') return 'danger'
  return 'neutral'
}

const rows = computed(() => [
  ['ETD', get(rate.value, 'etd')],
  ['ETA', get(rate.value, 'eta')],
  [t('agent.rateResult.transitDays'), get(rate.value, 'transitDays', 'transitTime')],
  ['Vessel', get(rate.value, 'vessel')],
  ['Voyage', get(rate.value, 'voyage')],
  [t('agent.rateResult.oceanFreight'), get(rate.value, 'oceanFreight', 'price')],
  [t('agent.rateResult.allIn'), get(rate.value, 'allIn')],
  ['Currency', get(rate.value, 'currency')],
  [t('agent.rateResult.availability'), get(rate.value, 'availability')],
])

const legs = computed(() => {
  const value = get(rate.value, 'legs')
  return Array.isArray(value) ? value : []
})

const charges = computed(() => {
  const value = get(rate.value, 'charges', 'priceBreakdown')
  return Array.isArray(value) ? value : []
})
</script>

<template>
  <div v-if="extractionResults.length" class="grid gap-4">
    <DhCard
      v-for="(item, index) in extractionResults"
      :key="String(get(item, 'routeId') ?? '') + String(get(item, 'equipmentId') ?? '') + index"
      :title="resultTitle(item, index)"
    >
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <DhBadge
          :label="String(get(item, 'status') ?? 'Unknown')"
          :variant="statusVariant(item)"
        />
        <span
          v-if="get(item, 'error')"
          class="text-sm font-semibold text-red-700 dark:text-red-300"
        >
          {{ String(get(item, 'error')) }}
        </span>
      </div>

      <div
        v-if="resultFields(item)"
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="[key, fieldValue] in Object.entries(resultFields(item) ?? {})"
          :key="key"
          class="rounded-[18px] border border-[var(--dh-border)] p-3"
        >
          <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
            {{ key }}
          </p>
          <div class="mt-1 text-sm font-bold text-[var(--dh-text)]">
            <AgentJsonViewer
              v-if="fieldValue && typeof fieldValue === 'object'"
              :value="fieldValue"
            />
            <span v-else>{{ fieldValue ?? '—' }}</span>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <p class="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Ruta</p>
          <AgentJsonViewer :value="get(item, 'route')" />
        </div>
        <div>
          <p class="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Equipo</p>
          <AgentJsonViewer :value="get(item, 'equipment')" />
        </div>
      </div>
    </DhCard>
  </div>

  <div v-else-if="rate" class="grid gap-4">
    <DhCard :title="t('agent.rateResult.title')">
      <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="[label, value] in rows" :key="String(label)" class="rounded-[18px] border border-[var(--dh-border)] p-3">
          <dt class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</dt>
          <dd class="mt-1 break-words text-sm font-bold text-[var(--dh-text)]">{{ value ?? '—' }}</dd>
        </div>
      </dl>
    </DhCard>

    <DhCard v-if="legs.length" :title="t('agent.rateResult.legs')">
      <div class="grid gap-3">
        <div v-for="(leg, index) in legs" :key="index" class="rounded-[18px] border border-[var(--dh-border)] p-3">
          <AgentJsonViewer :value="leg" />
        </div>
      </div>
    </DhCard>

    <DhCard v-if="charges.length" :title="t('agent.rateResult.charges')">
      <div class="grid gap-2">
        <div v-for="(charge, index) in charges" :key="index" class="flex min-w-0 flex-col items-stretch gap-3 rounded-[18px] border border-[var(--dh-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <span class="min-w-0 break-words text-sm font-semibold text-[var(--dh-text)]">
            {{ get(readObject(charge), 'name', 'description', 'charge') ?? t('agent.rateResult.chargeFallback', { index: index + 1 }) }}
          </span>
          <DhBadge
            :label="String(get(readObject(charge), 'amount', 'value') ?? '—')"
            variant="neutral"
          />
        </div>
      </div>
    </DhCard>
  </div>

  <AgentJsonViewer v-else :value="value" />
</template>
