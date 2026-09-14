<script setup lang="ts">
import { computed } from 'vue'
import DhTabs from '@/shared/components/molecules/DhTabs.vue'
import type { DhTabItem } from '@/shared/components/molecules/DhTabs.vue'

export interface DhPropertySection extends DhTabItem {
  description?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    sections: DhPropertySection[]
    title?: string
    description?: string
    sticky?: boolean
  }>(),
  {
    sticky: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const activeSection = computed(() => props.sections.find((section) => section.key === props.modelValue) ?? null)
</script>

<template>
  <aside
    class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--dh-radius-xl)] border border-[var(--dh-border)] bg-[var(--dh-surface)] shadow-[var(--dh-shadow-sm)]"
    :class="sticky && 'sticky top-0 max-h-[calc(100dvh-1rem)]'"
  >
    <header v-if="title || description" class="shrink-0 border-b border-[var(--dh-border)] p-4">
      <h2 v-if="title" class="text-base font-bold text-[var(--dh-text)]">{{ title }}</h2>
      <p v-if="description" class="mt-1 text-sm leading-6 text-[var(--dh-text-muted)]">{{ description }}</p>
    </header>

    <div class="shrink-0 p-3 pb-0">
      <DhTabs
        :model-value="modelValue"
        :items="sections"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>

    <div class="dh-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
      <slot :section="activeSection" :active-key="modelValue" />
    </div>
  </aside>
</template>
