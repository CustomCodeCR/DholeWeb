<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AlertTriangle, RefreshCcw } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { PricingService } from '@/core/services/pricingService'
import type { RateTermItemDto } from '@/core/interfaces/pricing'
import {
  clearPricingRateComment,
  hydratePricingRateComment,
  setPricingRateComment,
} from '@/modules/pricing/services/pricingRateCommentState'
import PricingTermDragBoard, { type PricingTermBoardColumn } from './PricingTermDragBoard.vue'

export interface CommercialTermsSelection {
  includes: string[]
  subjectTo: string[]
  excludes: string[]
}

type CommercialTermColumn = 'Includes' | 'SubjectTo' | 'Excludes'

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
const commentError = ref('')
const catalogItems = ref<RateTermItemDto[]>([])
const board = ref<Record<string, string[]>>({ Includes: [], SubjectTo: [], Excludes: [] })
const manualText = ref('')
const manualCategory = ref<CommercialTermColumn>('Includes')
const manualError = ref('')
const rateComments = ref('')

const columns: PricingTermBoardColumn[] = [
  { key: 'Includes', label: 'Tarifa incluye', hint: 'Conceptos incluidos comercialmente.' },
  { key: 'SubjectTo', label: 'Sujeta a', hint: 'Condiciones y cargos sujetos a confirmación.' },
  { key: 'Excludes', label: 'Tarifa no incluye', hint: 'Conceptos excluidos de la oferta.' },
]

const manualCategoryOptions: Array<{ value: CommercialTermColumn; label: string }> = [
  { value: 'Includes', label: 'Tarifa incluye' },
  { value: 'SubjectTo', label: 'Sujeta a' },
  { value: 'Excludes', label: 'Tarifa no incluye' },
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

function addManualTerm() {
  const text = manualText.value.trim()
  manualError.value = ''

  if (!text) {
    manualError.value = 'Escriba el concepto que desea agregar.'
    return
  }

  const currentTerms = [
    ...props.modelValue.includes,
    ...props.modelValue.subjectTo,
    ...props.modelValue.excludes,
  ]
  if (currentTerms.some((item) => key(item) === key(text))) {
    manualError.value = 'Este concepto ya está incluido en una categoría.'
    return
  }

  const id = `manual-${crypto.randomUUID()}`
  catalogItems.value.push({ id, text, sortOrder: 99999, isActive: false })
  emitBoard({
    ...board.value,
    [manualCategory.value]: [...(board.value[manualCategory.value] ?? []), id],
  })
  manualText.value = ''
}

function currentRateId() {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(
    /\/pricing\/rates\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/|$)/i,
  )
  return match?.[1] ?? ''
}

async function loadRateComments() {
  const rateId = currentRateId()
  commentError.value = ''

  if (!rateId) {
    rateComments.value = ''
    clearPricingRateComment()
    return
  }

  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: `/api/pricing/rates/${rateId}/comments`,
    })
    const value = unwrapApiResponse<{ comments?: string | null }>(response as never)
    rateComments.value = value?.comments?.trim() ?? ''
    hydratePricingRateComment(rateComments.value)
  } catch (e) {
    commentError.value = e instanceof Error
      ? e.message
      : 'No fue posible cargar los comentarios de la tarifa.'
  }
}

function onRateCommentInput() {
  if (rateComments.value.length > 4000) rateComments.value = rateComments.value.slice(0, 4000)
  setPricingRateComment(rateComments.value)
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
onMounted(() => {
  void load()
  void loadRateComments()
})

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
          Seleccione o arrastre términos del catálogo, o agregue conceptos manualmente. No se permiten duplicados entre categorías.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-full border border-[var(--dh-border)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
          {{ activeCount }} disponibles
        </span>
        <DhButton label="Recargar" :icon="RefreshCcw" variant="secondary" size="sm" :loading="loading" :disabled="disabled" @click="load" />
      </div>
    </div>

    <div v-if="!disabled" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
      <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">Añadir condición manual</p>
      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
        Use esta opción cuando el concepto no exista todavía en el catálogo de condiciones comerciales.
      </p>
      <div class="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
        <label class="block">
          <span class="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Concepto</span>
          <input
            v-model="manualText"
            type="text"
            maxlength="500"
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--dh-text)] outline-none transition focus:border-[var(--dh-primary)]"
            placeholder="Ej. Gastos extraordinarios previa aprobación del cliente"
            @keyup.enter.prevent="addManualTerm"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Categoría</span>
          <select
            v-model="manualCategory"
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--dh-text)] outline-none transition focus:border-[var(--dh-primary)]"
          >
            <option v-for="option in manualCategoryOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <DhButton label="Añadir" size="sm" @click="addManualTerm" />
      </div>
      <p v-if="manualError" class="mt-2 text-xs font-bold text-rose-600 dark:text-rose-300">{{ manualError }}</p>
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
      available-hint="Busque y arrastre términos aprobados del catálogo o agregue conceptos manuales arriba."
      @update:model-value="emitBoard"
    />

    <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">Comentarios de la tarifa</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Estos comentarios se guardan con la tarifa y se muestran también en el PDF de la cotización.
          </p>
        </div>
        <span class="text-[10px] font-bold text-[var(--dh-text-muted)]">{{ rateComments.length }}/4000</span>
      </div>
      <textarea
        v-model="rateComments"
        rows="4"
        maxlength="4000"
        :disabled="disabled"
        class="mt-3 w-full resize-y rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] px-3 py-2.5 text-sm text-[var(--dh-text)] outline-none transition focus:border-[var(--dh-primary)] disabled:cursor-not-allowed disabled:opacity-70"
        placeholder="Agregue observaciones comerciales, aclaraciones o comentarios específicos de esta tarifa..."
        @input="onRateCommentInput"
      />
      <p v-if="commentError" class="mt-2 flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
        <AlertTriangle class="h-4 w-4 shrink-0" />
        {{ commentError }}
      </p>
    </div>

    <div class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4 text-xs leading-6 text-[var(--dh-text)]">
      <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">Vista de oferta</p>
      <p class="mt-2"><strong>Tarifa incluye:</strong> {{ commaPreview.includes || '—' }}</p>
      <p><strong>Sujeta a:</strong> {{ commaPreview.subjectTo || '—' }}</p>
      <p><strong>Tarifa no incluye:</strong> {{ commaPreview.excludes || '—' }}</p>
    </div>
  </section>
</template>
