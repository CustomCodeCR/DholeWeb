<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Anchor, Check, ChevronDown, Package, Search, Truck, X } from 'lucide-vue-next'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { isCompatibleBenefitLocation, type BenefitMode, type RouteRole } from '../utils/crmBenefitRouteCatalog'

const props = withDefaults(defineProps<{
  modelValue: string[]
  label: string
  catalogGroupSlugs: string[]
  routeMode?: BenefitMode
  routeRole?: RouteRole
  placeholder?: string
  single?: boolean
}>(), {
  placeholder: 'Buscar o seleccionar una opción',
  single: false,
})
const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'resolved-label': [item: { value: string; label: string }]
}>()
const root = ref<HTMLElement | null>(null)
const open = ref(false)
const query = ref('')
const loading = ref(false)
const error = ref('')
const options = ref<CatalogItemSelectDto[]>([])
const savedLabels = ref<Record<string, string>>({})
let generation = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const selectedOptions = computed(() => props.modelValue.map(value => ({
  value,
  label: savedLabels.value[value] ?? options.value.find(x => x.code === value)?.label ?? value,
})))
const selectedLabel = computed(() => props.single
  ? selectedOptions.value[0]?.label ?? ''
  : selectedOptions.value.map(x => x.label).join(', '))
const routeIcon = computed(() => !props.routeRole ? Package :
  props.routeMode === 'FTL' || props.routeMode === 'LTL' || props.routeRole === 'pod' ? Truck : Anchor)
const filtered = computed(() => options.value.filter(item => item.isActive !== false &&
  (!props.routeMode || !props.routeRole ||
    isCompatibleBenefitLocation(item, props.routeMode, props.routeRole))))
const summary = computed(() => props.modelValue.length
  ? props.single ? selectedLabel.value :
    props.modelValue.length === 1 ? selectedLabel.value :
      `${props.modelValue.length} seleccionados`
  : props.placeholder)

function toggle(value: string) {
  if (!value) return
  const item = options.value.find(x => x.code === value)
  if (item) {
    const label = String(item.label || item.value || value)
    savedLabels.value = { ...savedLabels.value, [value]: label }
    emit('resolved-label', { value, label })
  }
  if (props.single) {
    emit('update:modelValue', [value])
    open.value = false
    query.value = ''
    return
  }
  emit('update:modelValue', props.modelValue.includes(value)
    ? props.modelValue.filter(x => x !== value)
    : [...props.modelValue, value])
}
function clearSelection() {
  emit('update:modelValue', [])
  query.value = ''
}
async function reload() {
  const id = ++generation
  if (!props.catalogGroupSlugs.length) {
    options.value = []
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const values = await Promise.all(props.catalogGroupSlugs.map(async slug => {
      try {
        return await CatalogItemsService.select({
          catalogGroupSlug: slug, search: query.value.trim() || undefined,
        })
      } catch {
        return [] as CatalogItemSelectDto[]
      }
    }))
    if (id !== generation) return
    options.value = [...new Map(values.flat().map(item => [item.code, item])).values()]
      .filter(item => item.isActive !== false)
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'es'))
    const labels = { ...savedLabels.value }
    for (const item of options.value) {
      if (item.code) labels[item.code] = item.label || item.value || item.code
    }
    savedLabels.value = labels
    if (!options.value.length && !query.value.trim())
      error.value = 'No hay opciones disponibles en Config.'
  } catch {
    if (id === generation) error.value = 'No se pudieron consultar las opciones.'
  } finally {
    if (id === generation) loading.value = false
  }
}
function openPicker() {
  if (open.value) {
    open.value = false
    return
  }
  open.value = true
  query.value = ''
  void reload()
}
function search(value: string) {
  query.value = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void reload(), 250)
}
function outsidePointer(event: PointerEvent) {
  if (open.value && event.target instanceof Node && !root.value?.contains(event.target))
    open.value = false
}
function onEscape() {
  open.value = false
}
watch(() => [props.catalogGroupSlugs.join('|'), props.routeMode, props.routeRole], () => {
  open.value = false
  generation++
  options.value = []
  query.value = ''
})
function onCatalogChanged() { if (open.value) void reload() }
onMounted(() => {
  document.addEventListener('pointerdown', outsidePointer, true)
  window.addEventListener('dhole:catalog:changed', onCatalogChanged)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outsidePointer, true)
  window.removeEventListener('dhole:catalog:changed', onCatalogChanged)
  if (searchTimer) clearTimeout(searchTimer)
  generation++
})
</script>

<template>
  <div ref="root" class="crm-catalog-picker relative min-w-0" :class="{ 'crm-catalog-picker--open': open }"
    data-crm-multi-catalog @keydown.esc.stop.prevent="onEscape">
    <label class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
      {{ label }}
    </label>
    <div class="relative">
      <component :is="routeIcon"
        class="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--dh-primary)]" />
      <button type="button" :aria-expanded="open" aria-haspopup="listbox"
        :aria-label="label" class="crm-catalog-trigger dh-focus-primary"
        @click="openPicker">
        <span class="min-w-0 flex-1 truncate text-left"
          :class="!modelValue.length && 'text-[var(--dh-text-muted)]'">{{ summary }}</span>
        <ChevronDown class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)] transition-transform"
          :class="open ? 'rotate-180' : ''" />
      </button>
    </div>

    <div v-if="open" class="crm-catalog-menu absolute left-0 top-[calc(100%+0.5rem)] z-[102] w-full min-w-[min(320px,86vw)] rounded-[18px] border border-[var(--dh-border-strong)] p-2 shadow-2xl"
      role="listbox" :aria-label="label + ' opciones'" :aria-multiselectable="!single">
      <div class="mb-2 flex h-10 items-center gap-2 rounded-[14px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3">
        <Search class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
        <input :value="query" type="search" :aria-label="'Buscar '+label"
          class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-muted)]"
          placeholder="Buscar por nombre o código…" @input="search(($event.target as HTMLInputElement).value)" />
      </div>
      <p v-if="loading" role="status" class="px-3 py-4 text-xs font-semibold text-[var(--dh-text-muted)]">
        Consultando opciones…
      </p>
      <p v-else-if="error" role="status" class="px-3 py-3 text-xs font-semibold text-amber-500">{{ error }}</p>
      <div class="dh-scrollbar max-h-64 space-y-1 overflow-y-auto">
        <button v-for="option in filtered" :key="option.code" type="button" role="option"
          :aria-selected="modelValue.includes(option.code)"
          class="crm-catalog-option flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition"
          :class="modelValue.includes(option.code) && 'crm-catalog-option--selected'"
          @click="toggle(option.code)">
          <component :is="routeIcon" class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
          <span class="min-w-0 flex-1 break-words text-sm font-bold">
            {{ option.label || option.value || option.code }}
          </span>
          <Check v-if="modelValue.includes(option.code)" class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
        </button>
        <p v-if="!loading && !error && !filtered.length" class="px-3 py-5 text-center text-xs font-semibold text-[var(--dh-text-muted)]">
          No hay coincidencias. Probá buscar por ciudad, puerto, país o código.
        </p>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2 border-t border-[var(--dh-border)] pt-2">
        <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--dh-text-muted)] hover:bg-[var(--dh-card-hover)]"
          :disabled="!modelValue.length" @click="clearSelection">Limpiar selección</button>
        <button type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-1.5 text-xs font-bold text-[var(--dh-text)]"
          @click="open=false">Listo</button>
      </div>
    </div>

    <div v-if="!single && selectedOptions.length" class="mt-2 flex flex-wrap gap-1.5">
      <button v-for="item in selectedOptions" :key="item.value" type="button"
        class="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--dh-primary-rgb)/0.16)] bg-[rgb(var(--dh-primary-rgb)/0.08)] px-2.5 py-1 text-xs font-bold text-[var(--dh-text-soft)]"
        :title="'Quitar '+item.label" @click="toggle(item.value)">
        {{ item.label }} <X class="h-3 w-3" />
      </button>
    </div>
    <p v-if="!single && !selectedOptions.length" class="mt-1 text-[11px] text-[var(--dh-text-muted)]">
      Sin selección = aplica a todos.
    </p>
  </div>
</template>

<style scoped>
.crm-catalog-picker--open{z-index:110}
.crm-catalog-trigger{
  display:flex;min-height:44px;width:100%;align-items:center;gap:12px;
  border:1px solid var(--dh-border);border-radius:18px;background:var(--dh-input);
  padding:8px 12px 8px 40px;color:var(--dh-text);font-size:14px;font-weight:600;
  box-shadow:var(--dh-shadow-sm);outline:none;transition:border-color .15s;
}
.crm-catalog-trigger:hover{border-color:var(--dh-primary)}
.crm-catalog-menu{background:var(--dh-card-solid,#fff);color:var(--dh-text);backdrop-filter:none}
.crm-catalog-option:hover{background:var(--dh-card-hover)}
.crm-catalog-option--selected{background:rgb(var(--dh-primary-rgb)/.10)}
:global(.dark) .crm-catalog-menu{background:var(--dh-card-solid,#18181b)}
</style>
