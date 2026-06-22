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
  <div class="flex gap-1 rounded-2xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      :disabled="item.disabled"
      class="rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
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
