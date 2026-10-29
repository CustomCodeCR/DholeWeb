<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronDown, Check, Search, X } from 'lucide-vue-next'
import { DhInput } from '@/shared/components/atoms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

const props = withDefaults(defineProps<{
  label: string
  validationError?: string
  catalogGroupSlug: string
  modelValue: string
  valueKind?: 'id' | 'code' | 'value'
}>(), { valueKind: 'id' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const items = ref<CatalogItemSelectDto[]>([])
const query = ref('')
const open = ref(false)
const loading = ref(false)
const error = ref('')
const selectedLabel = ref('')
let generation = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

function optionValue(item: CatalogItemSelectDto): string {
  if (props.valueKind === 'id') return item.id
  if (props.valueKind === 'value') {
    const iso = [item.value, item.label, item.code, item.slug]
      .map(x => String(x ?? '').trim()).find(x => /^[A-Za-z]{3}$/.test(x))
    return iso?.toUpperCase() ?? String(item.value || item.code)
  }
  return item.code
}
function labelFor(item: CatalogItemSelectDto) {
  return String(item.label || item.value || item.code || '')
}
const options = computed(() => items.value.filter(item => item.isActive !== false))
const displayedValue = computed(() =>
  selectedLabel.value || (props.modelValue ? options.value.find(x => optionValue(x) === props.modelValue)?.label ||
    props.modelValue : ''))
async function reload() {
  const id = ++generation
  loading.value = true
  error.value = ''
  try {
    // Config is authoritative: search remotely so catalogs are not limited to initial options.
    const result = await CatalogItemsService.select({
      catalogGroupSlug: props.catalogGroupSlug, search: query.value.trim() || undefined,
    })
    if (id !== generation) return
    items.value = result
    const selected = result.find(x => optionValue(x) === props.modelValue)
    if (selected) selectedLabel.value = labelFor(selected)
  } catch {
    if (id !== generation) return
    error.value = 'No se pudo consultar el catálogo de Config. Reintentá la búsqueda.'
    items.value = []
  } finally { if (id === generation) loading.value = false }
}
function toggleOpen() {
  open.value = !open.value
  if (open.value && !items.value.length) void reload()
}
function onSearch(value: string) {
  query.value = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void reload() }, 230)
}
function select(item: CatalogItemSelectDto) {
  selectedLabel.value = labelFor(item)
  emit('update:modelValue', optionValue(item))
  query.value = ''
  open.value = false
}
function clear() {
  selectedLabel.value = ''
  query.value = ''
  emit('update:modelValue', '')
  open.value = false
  void reload()
}
watch(() => props.catalogGroupSlug, () => {
  selectedLabel.value = ''; query.value = ''; void reload()
}, { immediate: true })
watch(() => props.modelValue, value => {
  if (!value) selectedLabel.value = ''
  else {
    const found = options.value.find(x => optionValue(x) === value)
    selectedLabel.value = found ? labelFor(found) : ''
  }
})
onBeforeUnmount(() => { generation++; if (searchTimer) clearTimeout(searchTimer) })
</script>

<template>
  <div class="relative min-w-0 space-y-1.5" data-crm-catalog-picker>
    <div class="flex items-center justify-between gap-2">
      <label class="text-xs font-bold text-[var(--dh-text-muted)]">{{ label }}</label>
      <span class="text-[10px] text-[var(--dh-text-muted)]">Config</span>
    </div>
    <div class="flex min-w-0 items-center gap-1.5">
      <button type="button" :aria-expanded="open" :aria-label="label" aria-haspopup="listbox"
        :class="props.validationError ? 'border-red-500' : 'border-[var(--dh-border)]'"
        class="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border bg-[var(--dh-input)] px-3 py-2 text-left text-sm"
        @click="toggleOpen">
        <span class="min-w-0 flex-1 truncate" :class="!modelValue && 'text-[var(--dh-text-muted)]'">{{ displayedValue || 'Seleccionar · ' + label }}</span>
        <ChevronDown class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
      </button>
      <button v-if="modelValue" type="button" :aria-label="'Quitar ' + label" title="Limpiar selección"
        class="rounded-lg border border-[var(--dh-border)] p-2.5 hover:text-[var(--dh-primary)]" @click="clear"><X class="h-4 w-4" /></button>
    </div>
    <p v-if="props.validationError" class="text-xs text-red-500">{{ props.validationError }}</p>
    <div v-if="open" class="relative z-30 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2 shadow-xl">
      <div class="flex items-center gap-2">
        <Search class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
        <DhInput :model-value="query" class="min-w-0 flex-1" :placeholder="'Buscar en ' + label.toLowerCase()"
          @update:model-value="onSearch" @keyup.enter.prevent="reload" />
      </div>
      <p v-if="loading" class="py-2 text-xs text-[var(--dh-text-muted)]">Buscando en Config…</p>
      <p v-if="error" role="alert" class="py-2 text-xs text-red-500">{{ error }}</p>
      <div role="listbox" :aria-label="label" class="mt-2 max-h-56 space-y-1 overflow-y-auto">
        <button v-for="item in options" :key="item.id" type="button" role="option"
          :aria-selected="optionValue(item)===modelValue"
          class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--dh-card-hover)]"
          @click="select(item)">
          <span class="min-w-0 truncate">{{ labelFor(item) }}</span>
          <Check v-if="optionValue(item)===modelValue" class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
        </button>
        <p v-if="!options.length && !loading" class="p-3 text-xs text-[var(--dh-text-muted)]">Sin coincidencias. Escribí un país, puerto o código para buscar.</p>
      </div>
    </div>
  </div>
</template>
