<script setup lang="ts">
export interface DhTabItem {
  key: string
  label: string
  disabled?: boolean
}

defineProps<{
  modelValue: string
  items: DhTabItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [key: string]
}>()
</script>

<template>
  <div
    role="tablist"
    class="dh-responsive-tabs dh-scrollbar flex max-w-full min-w-0 gap-1 overflow-x-auto rounded-2xl bg-black/[0.04] p-1 dark:bg-white/[0.06]"
  >
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      role="tab"
      :aria-selected="modelValue === item.key"
      :disabled="item.disabled"
      class="min-h-11 shrink-0 touch-manipulation snap-start whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-40 sm:min-h-0 sm:px-4"
      :class="
        modelValue === item.key
          ? 'bg-[var(--dh-surface-strong)] text-[var(--dh-text)] shadow-sm'
          : 'text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]'
      "
      @click="emit('update:modelValue', item.key)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
