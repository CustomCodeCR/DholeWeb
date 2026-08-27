<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'

export interface PricingCrystalMultiSelectOption {
  value: string
  label: string
  description?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: PricingCrystalMultiSelectOption[]
    label?: string
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
  }>(),
  {
    placeholder: 'Seleccione una o varias opciones',
    searchPlaceholder: 'Buscar...',
    emptyText: 'No hay opciones disponibles.',
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const search = ref('')
const detailsRef = ref<HTMLDetailsElement | null>(null)

function handleToggle() {
  const current = detailsRef.value
  if (!current?.open) return
  document.querySelectorAll<HTMLDetailsElement>('details[data-dh-dropdown="true"][open]').forEach((item) => {
    if (item !== current) item.removeAttribute('open')
  })
}

function handleOutsidePointer(event: PointerEvent) {
  const current = detailsRef.value
  const target = event.target
  if (!current?.open || !(target instanceof Node) || current.contains(target)) return
  current.removeAttribute('open')
}

onMounted(() => document.addEventListener('pointerdown', handleOutsidePointer, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsidePointer, true))

const selected = computed(() => props.options.filter((item) => props.modelValue.includes(item.value)))
const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return props.options
  return props.options.filter((item) => `${item.label} ${item.description ?? ''}`.toLocaleLowerCase().includes(query))
})

function toggle(value: string) {
  const next = props.modelValue.includes(value)
    ? props.modelValue.filter((item) => item !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
      {{ label }}
    </span>

    <details ref="detailsRef" data-dh-dropdown="true" class="crystal-multi group relative" @toggle="handleToggle">
      <summary class="crystal-multi__trigger">
        <span class="min-w-0 flex-1 truncate" :class="selected.length ? 'text-[var(--dh-text)]' : 'text-[var(--dh-text-muted)]'">
          {{ selected.length ? selected.map((item) => item.label).join(', ') : placeholder }}
        </span>
        <span v-if="selected.length" class="crystal-multi__count">{{ selected.length }}</span>
        <ChevronDown class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)] transition duration-200 group-open:rotate-180" />
      </summary>

      <div class="crystal-multi__menu">
        <div class="crystal-multi__search">
          <Search class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
          <input
            v-model="search"
            type="search"
            :placeholder="searchPlaceholder"
            class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-muted)]"
          />
        </div>

        <div class="max-h-72 space-y-1 overflow-y-auto pr-1 dh-scrollbar">
          <button
            v-for="option in filtered"
            :key="option.value"
            type="button"
            class="crystal-multi__option"
            :class="modelValue.includes(option.value) ? 'crystal-multi__option--selected' : ''"
            @click="toggle(option.value)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-bold">{{ option.label }}</span>
              <span v-if="option.description" class="mt-0.5 block text-xs font-medium text-[var(--dh-text-muted)]">
                {{ option.description }}
              </span>
            </span>
            <Check v-if="modelValue.includes(option.value)" class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
          </button>

          <p v-if="!filtered.length" class="px-3 py-7 text-center text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ emptyText }}
          </p>
        </div>
      </div>
    </details>

    <div v-if="selected.length" class="mt-2 flex flex-wrap gap-1.5">
      <button
        v-for="option in selected"
        :key="option.value"
        type="button"
        class="crystal-multi__chip"
        @click="toggle(option.value)"
      >
        <span>{{ option.label }}</span>
        <X class="h-3 w-3" />
      </button>
    </div>
  </label>
</template>

<style scoped>
.crystal-multi {
  position: relative;
  z-index: 0;
  min-width: 0;
  isolation: isolate;
}

.crystal-multi[open] {
  z-index: 1000;
}

.crystal-multi__trigger {
  display: flex;
  min-height: 44px;
  cursor: pointer;
  list-style: none;
  align-items: center;
  gap: 0.65rem;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--dh-border-strong) 70%, transparent);
  background: color-mix(in srgb, var(--dh-input) 68%, transparent);
  padding: 0.65rem 0.8rem;
  font-size: 0.875rem;
  font-weight: 700;
  box-shadow: 0 10px 30px rgb(15 23 42 / 0.06), inset 0 1px 0 rgb(255 255 255 / 0.28);
  backdrop-filter: blur(22px) saturate(145%);
  -webkit-backdrop-filter: blur(22px) saturate(145%);
}

.crystal-multi__trigger::-webkit-details-marker {
  display: none;
}

.crystal-multi__count {
  display: grid;
  height: 22px;
  min-width: 22px;
  place-items: center;
  border-radius: 999px;
  background: rgb(var(--dh-primary-rgb) / 0.13);
  padding-inline: 0.35rem;
  font-size: 0.7rem;
  font-weight: 900;
  color: var(--dh-primary);
}

.crystal-multi__menu {
  position: absolute;
  z-index: 1001;
  top: calc(100% + 0.55rem);
  inset-inline-start: 0;
  width: 100%;
  min-width: min(360px, 86vw);
  max-width: min(520px, calc(100vw - 2rem));
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--dh-border-strong) 70%, transparent);
  background-color: var(--dh-bg-2);
  padding: 0.7rem;
  box-shadow: 0 26px 70px rgb(15 23 42 / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.34);
  backdrop-filter: blur(32px) saturate(155%);
  -webkit-backdrop-filter: blur(32px) saturate(155%);
}

:global(.dark) .crystal-multi__menu {
  background-color: #111114;
  color: #ffffff;
}

@supports (-webkit-touch-callout: none) {
  .crystal-multi__menu {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.crystal-multi__search {
  margin-bottom: 0.55rem;
  display: flex;
  height: 40px;
  align-items: center;
  gap: 0.5rem;
  border-radius: 15px;
  border: 1px solid color-mix(in srgb, var(--dh-border) 74%, transparent);
  background: color-mix(in srgb, var(--dh-input) 70%, transparent);
  padding-inline: 0.75rem;
}

.crystal-multi__option {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  border-radius: 15px;
  padding: 0.65rem 0.75rem;
  text-align: left;
  color: var(--dh-text);
  transition: 160ms ease;
}

.crystal-multi__option:hover {
  background: color-mix(in srgb, var(--dh-card-hover) 78%, transparent);
}

.crystal-multi__option--selected {
  background: rgb(var(--dh-primary-rgb) / 0.1);
  box-shadow: inset 0 0 0 1px rgb(var(--dh-primary-rgb) / 0.16);
}

.crystal-multi__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 999px;
  border: 1px solid rgb(var(--dh-primary-rgb) / 0.16);
  background: rgb(var(--dh-primary-rgb) / 0.08);
  padding: 0.3rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--dh-text-soft);
  backdrop-filter: blur(14px);
}
</style>
