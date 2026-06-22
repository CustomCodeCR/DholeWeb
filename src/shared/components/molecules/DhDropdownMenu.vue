<script setup lang="ts">
import type { Component } from 'vue'
import { ref } from 'vue'

export interface DhDropdownItem {
  label: string
  icon?: Component
  danger?: boolean
  disabled?: boolean
  action: string
}

defineProps<{
  items: DhDropdownItem[]
}>()

const emit = defineEmits<{
  select: [action: string]
}>()

const open = ref(false)

function select(item: DhDropdownItem) {
  if (item.disabled) return
  emit('select', item.action)
  open.value = false
}
</script>

<template>
  <div class="relative inline-flex">
    <div @click="open = !open">
      <slot />
    </div>

    <Transition name="dropdown">
      <div
        v-if="open"
        class="dh-glass-strong absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl p-2"
      >
        <button
          v-for="item in items"
          :key="item.action"
          type="button"
          :disabled="item.disabled"
          class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition disabled:opacity-40"
          :class="[
            item.danger
              ? 'text-red-500 hover:bg-red-500/10'
              : 'text-[var(--dh-text-soft)] hover:bg-black/5 dark:hover:bg-white/10',
          ]"
          @click="select(item)"
        >
          <component :is="item.icon" v-if="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 160ms ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
