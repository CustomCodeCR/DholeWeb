<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'

export interface PricingMultiSelectOption {
  value: string
  label: string
  description?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: PricingMultiSelectOption[]
    label?: string
    placeholder?: string
    emptyText?: string
  }>(),
  { placeholder: 'Seleccione una o varias opciones', emptyText: 'No hay opciones disponibles.' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const search = ref('')

const selected = computed(() =>
  props.options.filter((option) => props.modelValue.includes(option.value)),
)
const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return props.options
  return props.options.filter((option) =>
    `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(query),
  )
})

function toggle(value: string) {
  emit(
    'update:modelValue',
    props.modelValue.includes(value)
      ? props.modelValue.filter((item) => item !== value)
      : [...props.modelValue, value],
  )
}
</script>

<template>
  <label class="block">
    <span
      v-if="label"
      class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
      >{{ label }}</span
    >
    <details class="group relative">
      <summary
        class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-sm font-semibold text-[var(--dh-text)] shadow-[var(--dh-shadow-sm)] dh-focus-primary"
      >
        <span :class="selected.length ? 'text-[var(--dh-text)]' : 'text-[var(--dh-text-muted)]'">
          {{
            selected.length
              ? `${selected.length} seleccionado${selected.length === 1 ? '' : 's'}`
              : placeholder
          }}
        </span>
        <ChevronDown
          class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)] transition group-open:rotate-180"
        />
      </summary>

      <div
        class="absolute z-40 mt-2 w-full min-w-[320px] rounded-[22px] border border-[var(--dh-border-strong)] bg-[var(--dh-shell-strong)] p-3 shadow-[var(--dh-shadow-lg)] backdrop-blur-2xl"
      >
        <div
          class="mb-2 flex h-10 items-center gap-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3"
        >
          <Search class="h-4 w-4 text-[var(--dh-text-muted)]" />
          <input
            v-model="search"
            type="search"
            placeholder="Buscar costo..."
            class="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--dh-text-muted)]"
          />
        </div>
        <div class="max-h-64 space-y-1 overflow-y-auto dh-scrollbar">
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
            <span>
              <span class="block text-sm font-bold text-[var(--dh-text)]">{{ option.label }}</span>
              <span
                v-if="option.description"
                class="mt-0.5 block text-xs font-medium text-[var(--dh-text-muted)]"
                >{{ option.description }}</span
              >
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
    </details>

    <div v-if="selected.length" class="mt-2 flex flex-wrap gap-1.5">
      <button
        v-for="option in selected"
        :key="option.value"
        type="button"
        class="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-xs font-bold text-[var(--dh-text-soft)] dark:bg-white/10"
        @click="toggle(option.value)"
      >
        {{ option.label }} <X class="h-3 w-3" />
      </button>
    </div>
  </label>
</template>
