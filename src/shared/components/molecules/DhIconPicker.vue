<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Component } from 'vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhEmptyState from '@/shared/components/atoms/DhEmptyState.vue'

export interface DhIconOption {
  key: string
  label: string
  icon?: Component
  keywords?: string[]
}

const props = withDefaults(
  defineProps<{
    modelValue: string | null
    options: DhIconOption[]
    label?: string
    searchPlaceholder?: string
    emptyTitle?: string
    emptyDescription?: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [option: DhIconOption]
}>()

const search = ref('')
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.options

  return props.options.filter((option) =>
    [option.label, option.key, ...(option.keywords ?? [])].some((value) => value.toLowerCase().includes(query)),
  )
})

function select(option: DhIconOption) {
  if (props.disabled) return
  emit('update:modelValue', option.key)
  emit('select', option)
}
</script>

<template>
  <fieldset class="min-w-0" :disabled="disabled">
    <legend
      v-if="label"
      class="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
    >
      {{ label }}
    </legend>

    <DhInput
      v-if="searchPlaceholder"
      v-model="search"
      type="search"
      :placeholder="searchPlaceholder"
      :disabled="disabled"
    />

    <div v-if="filtered.length" class="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
      <button
        v-for="option in filtered"
        :key="option.key"
        type="button"
        :disabled="disabled"
        class="flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center transition disabled:cursor-not-allowed disabled:opacity-50"
        :class="
          modelValue === option.key
            ? 'border-[var(--dh-primary)] dh-bg-primary-soft text-[var(--dh-primary)]'
            : 'border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text-soft)] hover:bg-[var(--dh-card-hover)]'
        "
        :title="option.label"
        @click="select(option)"
      >
        <component :is="option.icon" v-if="option.icon" class="h-5 w-5 shrink-0" />
        <span class="w-full truncate text-[11px] font-semibold">{{ option.label }}</span>
      </button>
    </div>

    <DhEmptyState
      v-else-if="emptyTitle"
      class="mt-3"
      :title="emptyTitle"
      :description="emptyDescription"
    />
  </fieldset>
</template>
