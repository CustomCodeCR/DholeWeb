<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { createUuid } from '@/core/utils/id'

const props = defineProps<{
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

type MetadataType = 'string' | 'number' | 'boolean' | 'json'

interface MetadataRow {
  id: string
  key: string
  value: string
  type: MetadataType
}

const rows = ref<MetadataRow[]>([])
const internalUpdate = ref(false)

const hasRows = computed(() => rows.value.length > 0)

function createId() {
  return createUuid()
}

function detectType(value: unknown): MetadataType {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'object' && value !== null) return 'json'
  return 'string'
}

function toInputValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  if (value === null || value === undefined) return ''
  return String(value)
}

function parseValue(row: MetadataRow): unknown {
  const value = row.value.trim()

  if (row.type === 'number') {
    const numberValue = Number(value)
    return Number.isNaN(numberValue) ? 0 : numberValue
  }

  if (row.type === 'boolean') {
    return (
      value === 'true' ||
      value === '1' ||
      value.toLowerCase() === 'sí' ||
      value.toLowerCase() === 'si'
    )
  }

  if (row.type === 'json') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  return row.value
}

function syncFromModel(value?: string | null) {
  if (!value) {
    rows.value = []
    return
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      rows.value = []
      return
    }

    rows.value = Object.entries(parsed).map(([key, itemValue]) => ({
      id: createId(),
      key,
      value: toInputValue(itemValue),
      type: detectType(itemValue),
    }))
  } catch {
    rows.value = []
  }
}

function emitJson() {
  internalUpdate.value = true

  const metadata = rows.value
    .filter((row) => row.key.trim())
    .reduce<Record<string, unknown>>((acc, row) => {
      acc[row.key.trim()] = parseValue(row)
      return acc
    }, {})

  const value = Object.keys(metadata).length === 0 ? null : JSON.stringify(metadata)

  emit('update:modelValue', value)

  queueMicrotask(() => {
    internalUpdate.value = false
  })
}

function addRow() {
  rows.value.push({
    id: createId(),
    key: '',
    value: '',
    type: 'string',
  })

  emitJson()
}

function removeRow(id: string) {
  rows.value = rows.value.filter((row) => row.id !== id)
  emitJson()
}

watch(
  () => props.modelValue,
  (value) => {
    if (!internalUpdate.value) syncFromModel(value)
  },
  { immediate: true },
)

watch(
  rows,
  () => {
    emitJson()
  },
  { deep: true },
)
</script>

<template>
  <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-black text-[var(--dh-text)]">Metadata</h3>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
          Se guarda como JSON, pero se llena con campos normales.
        </p>
      </div>

      <DhButton :icon="Plus" label="Campo" size="sm" variant="secondary" @click="addRow" />
    </div>

    <div
      v-if="!hasRows"
      class="rounded-[20px] border border-dashed border-[var(--dh-border)] p-4 text-center text-sm font-bold text-[var(--dh-text-muted)]"
    >
      Sin metadata.
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="row in rows"
        :key="row.id"
        class="grid gap-2 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 md:grid-cols-[1fr_130px_1.4fr_auto]"
      >
        <DhInput v-model="row.key" label="Campo" placeholder="category" />

        <label class="block">
          <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">Tipo</span>
          <select
            v-model="row.type"
            class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 text-sm font-bold text-[var(--dh-text)] outline-none"
          >
            <option value="string">Texto</option>
            <option value="number">Número</option>
            <option value="boolean">Sí / No</option>
            <option value="json">JSON</option>
          </select>
        </label>

        <DhInput v-model="row.value" label="Valor" placeholder="trade_terms" />

        <button
          type="button"
          class="mt-6 rounded-2xl p-2 text-red-500 hover:bg-red-500/10"
          title="Eliminar campo"
          @click="removeRow(row.id)"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </div>
    </div>
  </section>
</template>
