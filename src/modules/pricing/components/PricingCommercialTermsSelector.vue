<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertTriangle, RefreshCcw } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import type { RateTermItemDto } from '@/core/interfaces/pricing'
import PricingTermDragBoard, { type PricingTermBoardColumn } from './PricingTermDragBoard.vue'

export interface CommercialTermsSelection {
  includes: string[]
  subjectTo: string[]
  excludes: string[]
}

const props = withDefaults(
  defineProps<{
    modelValue: CommercialTermsSelection
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: CommercialTermsSelection]
}>()

const loading = ref(false)
const error = ref('')
const catalogItems = ref<RateTermItemDto[]>([])
const board = ref<Record<string, string[]>>({ Includes: [], SubjectTo: [], Excludes: [] })

const columns: PricingTermBoardColumn[] = [
  { key: 'Includes', label: 'Tarifa incluye', hint: 'Conceptos incluidos comercialmente.' },
  { key: 'SubjectTo', label: 'Sujeta a', hint: 'Condiciones y cargos sujetos a confirmación.' },
  { key: 'Excludes', label: 'Tarifa no incluye', hint: 'Conceptos excluidos de la oferta.' },
]

function key(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function unique(values: string[]) {
  const seen = new Set<string>()
  return values.map((x) => x.trim()).filter((x) => {
    const normalized = key(x)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function ensureLegacyItems(values: string[]) {
  const existing = new Set(catalogItems.value.map((item) => key(item.text)))
  for (const text of unique(values)) {
    if (existing.has(key(text))) continue
    const safeId = `legacy-${key(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    catalogItems.value.push({ id: safeId || `legacy-${catalogItems.value.length + 1}`, text, sortOrder: 99999, isActive: false })
    existing.add(key(text))
  }
}

function syncFromProps() {
  const all = [...props.modelValue.includes, ...props.modelValue.subjectTo, ...props.modelValue.excludes]
  ensureLegacyItems(all)
  const byText = new Map(catalogItems.value.map((item) => [key(item.text), item.id]))
  const used = new Set<string>()
  const ids = (values: string[]) => unique(values)
    .map((text) => byText.get(key(text)))
    .filter((id): id is string => Boolean(id))
    .filter((id) => {
      if (used.has(id)) return false
      used.add(id)
      return true
    })
  board.value = {
    Includes: ids(props.modelValue.includes),
    SubjectTo: ids(props.modelValue.subjectTo),
    Excludes: ids(props.modelValue.excludes),
  }
}

function emitBoard(value: Record<string, string[]>) {
  board.value = value
  const byId = new Map(catalogItems.value.map((item) => [item.id, item.text]))
  const texts = (column: string) => (value[column] ?? [])
    .map((id) => byId.get(id) ?? '')
    .filter(Boolean)
  emit('update:modelValue', {
    includes: texts('Includes'),
    subjectTo: texts('SubjectTo'),
    excludes: texts('Excludes'),
  })
}

async function load() {
  try {
    loading.value = true
    error.value = ''
    catalogItems.value = await PricingService.browseRateTermItems()
    syncFromProps()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No fue posible cargar el catálogo de términos.'
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, syncFromProps, { deep: true })
onMounted(load)

const activeCount = computed(() => catalogItems.value.filter((item) => item.isActive).length)
const commaPreview = computed(() => ({
  includes: unique(props.modelValue.includes).join(', '),
  subjectTo: unique(props.modelValue.subjectTo).join(', '),
  excludes: unique(props.modelValue.excludes).join(', '),
}))
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Condiciones comerciales</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Seleccione o arrastre términos del catálogo. No se permite texto libre ni duplicar conceptos entre categorías.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-full border border-[var(--dh-border)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
          {{ activeCount }} disponibles
        </span>
        <DhButton label="Recargar" :icon="RefreshCcw" variant="secondary" size="sm" :loading="loading" :disabled="disabled" @click="load" />
      </div>
    </div>

    <div v-if="error" class="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-300">
      <AlertTriangle class="h-4 w-4 shrink-0" />
      {{ error }}
    </div>

    <PricingTermDragBoard
      v-else
      :items="catalogItems"
      :columns="columns"
      :model-value="board"
      :disabled="disabled || loading"
      available-label="Términos disponibles"
      available-hint="Busque y arrastre únicamente términos aprobados del catálogo."
      @update:model-value="emitBoard"
    />

    <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4 text-xs leading-6 text-[var(--dh-text)]">
      <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">Vista de oferta</p>
      <p class="mt-2"><strong>Tarifa incluye:</strong> {{ commaPreview.includes || '—' }}</p>
      <p><strong>Sujeta a:</strong> {{ commaPreview.subjectTo || '—' }}</p>
      <p><strong>Tarifa no incluye:</strong> {{ commaPreview.excludes || '—' }}</p>
    </div>
  </section>
</template>
