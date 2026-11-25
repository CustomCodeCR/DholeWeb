<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'

export interface DhMultiSelectOption {
  value: string
  label: string
  description?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: DhMultiSelectOption[]
    label?: string
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    disabled?: boolean
    single?: boolean
    showSelectedLabels?: boolean
    error?: string
  }>(),
  {
    placeholder: 'Seleccione una o varias opciones',
    searchPlaceholder: 'Buscar...',
    emptyText: 'No hay opciones disponibles.',
    disabled: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const search = ref('')
const detailsRef = ref<HTMLDetailsElement | null>(null)
const menuRef = ref<HTMLDivElement | null>(null)
const isOpen = ref(false)
const menuStyle = ref<Record<string, string>>({})

// Portaled menus do not inherit their parent card's backdrop-filter stacking
// context. Use the fully opaque Dhole card background in both themes.
function positionMenu() {
  if (!isOpen.value || !detailsRef.value) return
  const anchor = detailsRef.value.getBoundingClientRect()
  const width = Math.min(anchor.width, Math.max(0, window.innerWidth - 24))
  const left = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))
  const below = window.innerHeight - anchor.bottom - 12
  const above = anchor.top - 12
  const openAbove = below < 300 && above > below
  const available = Math.max(100, openAbove ? above : below)
  menuStyle.value = {
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${Math.min(360, available)}px`,
    ...(openAbove
      ? { bottom: `${window.innerHeight - anchor.top + 8}px`, top: 'auto' }
      : { top: `${anchor.bottom + 8}px`, bottom: 'auto' }),
  }
}

function closeMenu() {
  if (detailsRef.value) detailsRef.value.open = false
  isOpen.value = false
}

function handleViewportChange() {
  positionMenu()
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    closeMenu()
    detailsRef.value?.querySelector('summary')?.focus()
  }
}

const selected = computed(() =>
  props.options.filter((option) => props.modelValue.includes(option.value)),
)

const filtered = computed(() => {
  const value = search.value.trim().toLocaleLowerCase()
  if (!value) return props.options
  return props.options.filter((option) =>
    `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(value),
  )
})

function toggle(value: string) {
  if (props.disabled) return
  if (props.single) {
    emit('update:modelValue', props.modelValue.includes(value) ? [] : [value])
    closeMenu()
    detailsRef.value?.querySelector('summary')?.focus()
    return
  }
  emit(
    'update:modelValue',
    props.modelValue.includes(value)
      ? props.modelValue.filter((item) => item !== value)
      : [...props.modelValue, value],
  )
}

async function handleToggle() {
  const current = detailsRef.value
  isOpen.value = Boolean(current?.open)
  if (!current?.open) return
  document
    .querySelectorAll<HTMLDetailsElement>('details[data-dh-dropdown="true"][open]')
    .forEach(item => {
      if (item !== current) item.removeAttribute('open')
    })
  await nextTick()
  positionMenu()
}

function handleOutsidePointer(event: PointerEvent) {
  const target = event.target
  if (!isOpen.value || !(target instanceof Node)) return
  if (detailsRef.value?.contains(target) || menuRef.value?.contains(target)) return
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointer, true)
  document.addEventListener('keydown', handleEscape)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointer, true)
  document.removeEventListener('keydown', handleEscape)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<template>
  <label class="dh-multi-root relative block">
    <span
      v-if="label"
      class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
    >
      {{ label }}
    </span>

    <details
      ref="detailsRef"
      data-dh-dropdown="true"
      class="dh-multi group relative"
      :class="disabled && 'pointer-events-none opacity-50'"
      @toggle="handleToggle"
    >
      <summary
         :aria-invalid="Boolean(error)"
        :class="error && '!border-red-500 ring-2 ring-red-500/20'"
        class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-sm font-semibold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] backdrop-blur-xl dh-focus-primary"
      >
        <span
          class="min-w-0 flex-1 truncate"
          :class="selected.length ? 'text-[var(--dh-text)]' : 'text-[var(--dh-text-muted)]'"
        >
          {{
            selected.length
              ? (single || showSelectedLabels ? selected.map(option => option.label).join(', ') : `${selected.length} seleccionado${selected.length === 1 ? '' : 's'}`)
              : placeholder
          }}
        </span>
        <span
          v-if="selected.length && !single"
          class="grid h-6 min-w-6 place-items-center rounded-full bg-[rgb(var(--dh-primary-rgb)/0.12)] px-1.5 text-[11px] font-black text-[var(--dh-primary)]"
        >
          {{ selected.length }}
        </span>
        <ChevronDown class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)] transition group-open:rotate-180" />
      </summary>

    </details>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuRef"
        :style="menuStyle"
        class="dh-multi-popover fixed z-[120] flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[var(--dh-border-strong)] bg-[var(--dh-card-solid)] p-3 text-[var(--dh-text)] shadow-[var(--dh-shadow-lg)]"
      >
        <div
          class="mb-2 flex h-10 items-center gap-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3"
        >
          <Search class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
          <input
            v-model="search"
            type="search"
            :placeholder="searchPlaceholder"
            class="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--dh-text-muted)]"
          />
        </div>

        <div class="dh-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto">
          <button
            v-for="option in filtered"
            :key="option.value"
            type="button"
            class="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-[var(--dh-card-hover)]"
            @click="toggle(option.value)"
          >
            <span
              class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
              :class="
                modelValue.includes(option.value)
                  ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                  : 'border-[var(--dh-border-strong)]'
              "
            >
              <Check v-if="modelValue.includes(option.value)" class="h-3.5 w-3.5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-bold">{{ option.label }}</span>
              <span
                v-if="option.description"
                class="mt-0.5 block text-xs font-medium text-[var(--dh-text-muted)]"
              >
                {{ option.description }}
              </span>
            </span>
          </button>

          <p
            v-if="filtered.length === 0"
            class="px-3 py-6 text-center text-xs font-semibold text-[var(--dh-text-muted)]"
          >
            {{ emptyText }}
          </p>
        </div>
      </div>
    </Teleport>

    <div v-if="selected.length && !single" class="mt-2 flex flex-wrap gap-1.5">
      <button
        v-for="option in selected"
        :key="option.value"
        type="button"
        class="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--dh-primary-rgb)/0.16)] bg-[rgb(var(--dh-primary-rgb)/0.08)] px-2.5 py-1 text-xs font-bold text-[var(--dh-text-soft)]"
        :disabled="disabled"
        @click="toggle(option.value)"
      >
        {{ option.label }}
        <X class="h-3 w-3" />
      </button>
    </div>
    <span v-if="error" class="mt-1 block text-xs font-semibold text-red-500">{{ error }}</span>
  </label>
</template>

<style scoped>
.dh-multi-popover {
  /* The theme's glass card/input colors are translucent by design.
     The dropdown must be an opaque top-level surface instead. */
  background-color: var(--dh-card-solid);
  isolation: isolate;
}

.dh-multi > summary::-webkit-details-marker {
  display: none;
}
</style>
