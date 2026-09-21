<script setup lang="ts">
import { computed } from 'vue'
import { DhBadge } from '@/shared/components/atoms'
import { DhCard } from '@/shared/components/molecules'
import AgentJsonViewer from './AgentJsonViewer.vue'

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
const rate = computed(() => {
  const object = root.value
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

const rows = computed(() => [
  ['ETD', get(rate.value, 'etd')],
  ['ETA', get(rate.value, 'eta')],
  ['Transit Days', get(rate.value, 'transitDays', 'transitTime')],
  ['Vessel', get(rate.value, 'vessel')],
  ['Voyage', get(rate.value, 'voyage')],
  ['Ocean Freight', get(rate.value, 'oceanFreight', 'price')],
  ['All In', get(rate.value, 'allIn')],
  ['Currency', get(rate.value, 'currency')],
  ['Availability', get(rate.value, 'availability')],
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
  <div v-if="rate" class="grid gap-4">
    <DhCard title="Resultado Ocean Freight">
      <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="[label, value] in rows" :key="String(label)" class="rounded-[18px] border border-[var(--dh-border)] p-3">
          <dt class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</dt>
          <dd class="mt-1 break-words text-sm font-bold text-[var(--dh-text)]">{{ value ?? '—' }}</dd>
        </div>
      </dl>
    </DhCard>

    <DhCard v-if="legs.length" title="Legs">
      <div class="grid gap-3">
        <div v-for="(leg, index) in legs" :key="index" class="rounded-[18px] border border-[var(--dh-border)] p-3">
          <AgentJsonViewer :value="leg" />
        </div>
      </div>
    </DhCard>

    <DhCard v-if="charges.length" title="Charges">
      <div class="grid gap-2">
        <div v-for="(charge, index) in charges" :key="index" class="flex min-w-0 items-center justify-between gap-3 rounded-[18px] border border-[var(--dh-border)] p-3">
          <span class="min-w-0 break-words text-sm font-semibold text-[var(--dh-text)]">
            {{ get(readObject(charge), 'name', 'description', 'charge') ?? `Cargo ${index + 1}` }}
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
