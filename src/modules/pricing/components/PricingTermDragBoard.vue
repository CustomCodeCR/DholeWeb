<script setup lang="ts">
import { computed, ref } from 'vue'
import { GripVertical, Search, X } from 'lucide-vue-next'
import type { RateTermItemDto } from '@/core/interfaces/pricing'

export interface PricingTermBoardColumn {
  key: string
  label: string
  hint?: string
}

const AVAILABLE_KEY = '__available__'

const props = withDefaults(
  defineProps<{
    items: RateTermItemDto[]
    columns: PricingTermBoardColumn[]
    modelValue: Record<string, string[]>
    disabled?: boolean
    availableLabel?: string
    availableHint?: string
  }>(),
  {
    disabled: false,
    availableLabel: 'Disponibles',
    availableHint: 'Arrastre desde aquí para agregar un ítem.',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string[]>]
}>()

const draggingId = ref<string | null>(null)
const dragTarget = ref<string | null>(null)
const search = ref('')

const modelAssignedIds = computed(() => {
  const result = new Set<string>()
  for (const column of props.columns) {
    for (const id of props.modelValue[column.key] ?? []) result.add(id)
  }
  return result
})

const sortedItems = computed(() =>
  props.items
    // Los inactivos no aparecen como disponibles, pero si ya pertenecen al bloque se
    // conservan visibles para que editar/guardar no borre accidentalmente la asociación.
    .filter((item) => item.isActive || modelAssignedIds.value.has(item.id))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.text.localeCompare(b.text)),
)

const itemMap = computed(() => new Map(sortedItems.value.map((item) => [item.id, item])))

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

const normalizedSearch = computed(() => normalizeSearchText(search.value))
const hasSearch = computed(() => Boolean(normalizedSearch.value))

function matchesSearch(item: RateTermItemDto) {
  if (!normalizedSearch.value) return true
  return normalizeSearchText(item.text).includes(normalizedSearch.value)
}

const filteredTotal = computed(() => sortedItems.value.filter(matchesSearch).length)

function uniqueIds(values: string[] | undefined) {
  return [...new Set(values ?? [])].filter((id) => itemMap.value.has(id))
}

function normalizedModel() {
  const result: Record<string, string[]> = {}
  const used = new Set<string>()

  for (const column of props.columns) {
    result[column.key] = uniqueIds(props.modelValue[column.key]).filter((id) => {
      if (used.has(id)) return false
      used.add(id)
      return true
    })
  }

  return result
}

const assignedIds = computed(() => {
  const assigned = new Set<string>()
  const model = normalizedModel()
  for (const column of props.columns) {
    for (const id of model[column.key] ?? []) assigned.add(id)
  }
  return assigned
})

const allAvailableItems = computed(() =>
  sortedItems.value.filter((item) => item.isActive && !assignedIds.value.has(item.id)),
)

const availableItems = computed(() => allAvailableItems.value.filter(matchesSearch))

function allItemsFor(columnKey: string) {
  const ids = normalizedModel()[columnKey] ?? []
  return ids
    .map((id) => itemMap.value.get(id))
    .filter((item): item is RateTermItemDto => Boolean(item))
}

function itemsFor(columnKey: string) {
  return allItemsFor(columnKey).filter(matchesSearch)
}

function dropIndexForItem(columnKey: string, itemId: string) {
  const items = allItemsFor(columnKey)
  const index = items.findIndex((item) => item.id === itemId)
  return index < 0 ? items.length : index
}

function currentColumn(id: string) {
  for (const column of props.columns) {
    if ((props.modelValue[column.key] ?? []).includes(id)) return column.key
  }
  return AVAILABLE_KEY
}

function moveItem(id: string, targetColumn: string, targetIndex?: number) {
  if (props.disabled || !itemMap.value.has(id)) return

  const next = normalizedModel()
  for (const column of props.columns) {
    next[column.key] = (next[column.key] ?? []).filter((itemId) => itemId !== id)
  }

  if (targetColumn !== AVAILABLE_KEY) {
    const target = next[targetColumn]
    if (!target) return
    const index = Math.max(0, Math.min(targetIndex ?? target.length, target.length))
    target.splice(index, 0, id)
  }

  emit('update:modelValue', next)
}

function onDragStart(event: DragEvent, id: string) {
  if (props.disabled) return
  draggingId.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }
}

function onDragEnd() {
  draggingId.value = null
  dragTarget.value = null
}

function draggedId(event: DragEvent) {
  return event.dataTransfer?.getData('text/plain') || draggingId.value || ''
}

function dropOnColumn(event: DragEvent, columnKey: string) {
  event.preventDefault()
  event.stopPropagation()
  const id = draggedId(event)
  if (id) moveItem(id, columnKey)
  onDragEnd()
}

function dropBefore(event: DragEvent, columnKey: string, index: number) {
  event.preventDefault()
  event.stopPropagation()
  const id = draggedId(event)
  if (id) moveItem(id, columnKey, index)
  onDragEnd()
}

function mobileMove(event: Event, id: string) {
  const select = event.target as HTMLSelectElement
  moveItem(id, select.value)
}

function labelForColumn(key: string) {
  if (key === AVAILABLE_KEY) return props.availableLabel
  return props.columns.find((column) => column.key === key)?.label ?? key
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
        Arrastre los ítems entre columnas. Un ítem solo puede estar en una categoría.
      </p>
      <span
        class="rounded-full border border-[var(--dh-border)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
      >
        {{ hasSearch ? `${filteredTotal}/${sortedItems.length}` : sortedItems.length }} ítems
      </span>
    </div>

    <div class="relative">
      <Search
        class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]"
      />
      <input
        v-model="search"
        type="search"
        autocomplete="off"
        placeholder="Buscar ítem por nombre..."
        class="w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] py-3 pl-11 pr-11 text-sm font-semibold text-[var(--dh-text)] outline-none transition placeholder:text-[var(--dh-text-muted)] focus:border-[var(--dh-primary)] focus:ring-2 focus:ring-[var(--dh-primary)]/15"
      />
      <button
        v-if="search"
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-[var(--dh-text-muted)] transition hover:bg-black/5 hover:text-[var(--dh-text)] dark:hover:bg-white/10"
        aria-label="Limpiar búsqueda"
        @click="search = ''"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <div class="grid gap-3" :class="columns.length >= 3 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'">
      <section
        class="min-h-[250px] rounded-[24px] border border-dashed p-3 transition"
        :class="
          dragTarget === AVAILABLE_KEY
            ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10'
            : 'border-[var(--dh-border)] bg-black/[0.02] dark:bg-white/[0.025]'
        "
        @dragenter.prevent="dragTarget = AVAILABLE_KEY"
        @dragover.prevent="dragTarget = AVAILABLE_KEY"
        @dragleave="dragTarget === AVAILABLE_KEY && (dragTarget = null)"
        @drop="dropOnColumn($event, AVAILABLE_KEY)"
      >
        <header class="mb-3">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-sm font-black text-[var(--dh-text)]">{{ availableLabel }}</h4>
            <span class="text-xs font-black text-[var(--dh-text-muted)]">{{
              hasSearch
                ? `${availableItems.length}/${allAvailableItems.length}`
                : allAvailableItems.length
            }}</span>
          </div>
          <p class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">
            {{ availableHint }}
          </p>
        </header>

        <div class="space-y-2">
          <article
            v-for="item in availableItems"
            :key="item.id"
            :draggable="!disabled"
            class="group cursor-grab rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--dh-primary)]/40 active:cursor-grabbing"
            :class="draggingId === item.id && 'opacity-40'"
            @dragstart="onDragStart($event, item.id)"
            @dragend="onDragEnd"
          >
            <div class="flex items-start gap-2">
              <GripVertical class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
              <p class="min-w-0 flex-1 text-xs font-bold leading-5 text-[var(--dh-text)]">
                {{ item.text }}
              </p>
            </div>
            <select
              class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 text-xs font-semibold text-[var(--dh-text)] md:hidden"
              :value="currentColumn(item.id)"
              :disabled="disabled"
              @change="mobileMove($event, item.id)"
            >
              <option :value="AVAILABLE_KEY">{{ availableLabel }}</option>
              <option v-for="column in columns" :key="column.key" :value="column.key">
                {{ column.label }}
              </option>
            </select>
          </article>
          <div
            v-if="!availableItems.length"
            class="rounded-2xl border border-dashed border-[var(--dh-border)] p-5 text-center text-xs font-semibold text-[var(--dh-text-muted)]"
          >
            {{
              hasSearch
                ? 'No hay ítems disponibles que coincidan con la búsqueda.'
                : 'Todos los ítems están asignados.'
            }}
          </div>
        </div>
      </section>

      <section
        v-for="column in columns"
        :key="column.key"
        class="min-h-[250px] rounded-[24px] border p-3 transition"
        :class="
          dragTarget === column.key
            ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10'
            : 'border-[var(--dh-border)] bg-black/[0.02] dark:bg-white/[0.025]'
        "
        @dragenter.prevent="dragTarget = column.key"
        @dragover.prevent="dragTarget = column.key"
        @dragleave="dragTarget === column.key && (dragTarget = null)"
        @drop="dropOnColumn($event, column.key)"
      >
        <header class="mb-3">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-sm font-black text-[var(--dh-text)]">{{ column.label }}</h4>
            <span class="text-xs font-black text-[var(--dh-text-muted)]">{{
              hasSearch
                ? `${itemsFor(column.key).length}/${allItemsFor(column.key).length}`
                : allItemsFor(column.key).length
            }}</span>
          </div>
          <p v-if="column.hint" class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">
            {{ column.hint }}
          </p>
        </header>

        <div class="space-y-2">
          <article
            v-for="(item, index) in itemsFor(column.key)"
            :key="item.id"
            :draggable="!disabled"
            class="group cursor-grab rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--dh-primary)]/40 active:cursor-grabbing"
            :class="draggingId === item.id && 'opacity-40'"
            @dragstart="onDragStart($event, item.id)"
            @dragend="onDragEnd"
            @dragover.prevent
            @drop="dropBefore($event, column.key, dropIndexForItem(column.key, item.id))"
          >
            <div class="flex items-start gap-2">
              <GripVertical class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
              <p class="min-w-0 flex-1 text-xs font-bold leading-5 text-[var(--dh-text)]">
                {{ item.text }}
              </p>
            </div>
            <select
              class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 text-xs font-semibold text-[var(--dh-text)] md:hidden"
              :value="currentColumn(item.id)"
              :disabled="disabled"
              @change="mobileMove($event, item.id)"
            >
              <option :value="AVAILABLE_KEY">{{ availableLabel }}</option>
              <option v-for="target in columns" :key="target.key" :value="target.key">
                {{ target.label }}
              </option>
            </select>
          </article>

          <div
            v-if="!itemsFor(column.key).length"
            class="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-[var(--dh-border)] p-4 text-center text-xs font-semibold text-[var(--dh-text-muted)]"
          >
            {{
              hasSearch && allItemsFor(column.key).length
                ? 'No hay coincidencias en esta categoría.'
                : 'Arrastre ítems aquí'
            }}
          </div>
        </div>
      </section>
    </div>

    <p class="text-[10px] font-semibold text-[var(--dh-text-muted)] md:hidden">
      En móvil puede usar el selector de cada ítem para moverlo entre categorías.
    </p>
  </div>
</template>
