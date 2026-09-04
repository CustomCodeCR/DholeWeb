<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Anchor, ChevronDown, Search, Truck, Warehouse, X } from 'lucide-vue-next'

interface LocationOption {
  value: string
  label: string
  searchText?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  label: string
  placeholder?: string
  searchPlaceholder?: string
  options: LocationOption[]
  terminalType?: 'CY' | 'SD' | 'WHS'
  optional?: boolean
  disabled?: boolean
}>(), {
  placeholder: 'Seleccione una ubicación',
  searchPlaceholder: 'Buscar ciudad, puerto o país…',
  terminalType: 'CY',
  optional: false,
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const open = ref(false)
const query = ref('')
const typing = ref(false)

const selected = computed(() => props.options.find((option) => option.value === props.modelValue) ?? null)
const icon = computed(() => {
  if (props.terminalType === 'WHS') return Warehouse
  return props.terminalType === 'SD' ? Truck : Anchor
})

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const filteredOptions = computed(() => {
  const needle = normalize(query.value)
  if (!needle || (!typing.value && selected.value)) return props.options.slice(0, 80)
  const tokens = needle.split(' ').filter(Boolean)
  return props.options
    .filter((option) => {
      const haystack = normalize(`${option.label} ${option.searchText ?? ''}`)
      return tokens.every((token) => haystack.includes(token))
    })
    .slice(0, 80)
})

function selectedText() {
  return selected.value?.label ?? ''
}

function openSearch() {
  if (props.disabled) return
  open.value = true
  typing.value = false
  query.value = selectedText()
  void nextTick(() => input.value?.select())
}

function handleInput(event: Event) {
  if (props.disabled) return
  typing.value = true
  query.value = (event.target as HTMLInputElement).value
  open.value = true
}

function choose(option: LocationOption) {
  if (props.disabled) return
  emit('update:modelValue', option.value)
  query.value = option.label
  typing.value = false
  open.value = false
}

function clearSelection() {
  if (props.disabled) return
  emit('update:modelValue', '')
  query.value = ''
  typing.value = true
  open.value = true
  void nextTick(() => input.value?.focus())
}

function closeSearch() {
  open.value = false
  typing.value = false
  query.value = selectedText()
}

function onDocumentPointerDown(event: MouseEvent | TouchEvent) {
  const target = event.target as Node | null
  if (target && !root.value?.contains(target)) closeSearch()
}

watch(selected, () => {
  if (!typing.value) query.value = selectedText()
}, { immediate: true })

watch(() => props.options, () => {
  if (!typing.value) query.value = selectedText()
})

watch(() => props.disabled, (disabled) => {
  if (disabled) closeSearch()
})

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown)
  document.addEventListener('touchstart', onDocumentPointerDown, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown)
  document.removeEventListener('touchstart', onDocumentPointerDown)
})
</script>

<template>
  <div ref="root" class="relative min-w-0">
    <label class="block">
      <span class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
        {{ label }}<span v-if="optional" class="normal-case tracking-normal"> (opcional)</span>
      </span>
      <span class="relative block">
        <component
          :is="icon"
          class="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--dh-primary)]"
        />
        <input
          ref="input"
          :value="query"
          type="search"
          autocomplete="off"
          :disabled="disabled"
          class="h-11 w-full rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] pl-10 pr-24 text-sm font-semibold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] outline-none transition dh-focus-primary disabled:cursor-not-allowed disabled:opacity-70"
          :placeholder="open ? searchPlaceholder : placeholder"
          @focus="openSearch"
          @click="openSearch"
          @input="handleInput"
          @keydown.escape.prevent="closeSearch"
          @keydown.down.prevent="open = !disabled"
        />
        <span
          v-if="modelValue && selected"
          class="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-0.5 text-[10px] font-black text-[var(--dh-text-muted)]"
        >
          {{ terminalType }}
        </span>
        <button
          v-if="modelValue && !disabled"
          type="button"
          class="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[var(--dh-text-muted)] hover:bg-[rgb(var(--dh-primary-rgb)/0.08)]"
          aria-label="Limpiar selección"
          @mousedown.prevent
          @click="clearSelection"
        >
          <X class="h-4 w-4" />
        </button>
        <ChevronDown
          v-else-if="!disabled"
          class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]"
        />
      </span>
    </label>

    <div
      v-if="open && !disabled"
      class="pricing-location-menu absolute z-[120] mt-2 max-h-72 w-full min-w-[260px] overflow-auto rounded-[18px] border border-[var(--dh-border-strong)] p-1.5 shadow-2xl"
    >
      <div v-if="filteredOptions.length" class="space-y-1">
        <button
          v-for="option in filteredOptions"
          :key="option.value"
          type="button"
          class="pricing-location-option flex min-h-11 w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition"
          :class="option.value === modelValue ? 'pricing-location-option--selected' : ''"
          @mousedown.prevent
          @click="choose(option)"
        >
          <component :is="icon" class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
          <span class="min-w-0 flex-1 truncate text-sm font-bold">{{ option.label }}</span>
          <span class="shrink-0 text-[10px] font-black text-[var(--dh-text-muted)]">({{ terminalType }})</span>
        </button>
      </div>
      <div v-else class="flex min-h-20 items-center justify-center gap-2 px-4 text-center text-xs font-semibold text-[var(--dh-text-muted)]">
        <Search class="h-4 w-4" /> No hay coincidencias para “{{ query }}”.
      </div>
    </div>
  </div>
</template>

<style scoped>
.pricing-location-menu {
  background-color: #ffffff;
  color: #030202;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.pricing-location-option:hover {
  background-color: #f3f4f6;
}

.pricing-location-option--selected {
  background-color: rgb(var(--dh-primary-rgb) / 0.10);
}

:global(.dark) .pricing-location-menu {
  background-color: #18181b;
  color: #ffffff;
}

:global(.dark) .pricing-location-option:hover {
  background-color: #27272a;
}

:global(.dark) .pricing-location-option--selected {
  background-color: rgb(var(--dh-primary-rgb) / 0.16);
}
</style>