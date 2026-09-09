<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'

defineProps<{ modelValue: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; search: [value: string]; clear: [] }>()

function clear() {
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<template>
  <div class="flex h-11 min-w-0 items-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl transition dh-focus-primary">
    <Search class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
    <input
      :value="modelValue"
      type="search"
      :placeholder="placeholder ?? 'Buscar...'"
      class="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:font-medium placeholder:text-[var(--dh-text-muted)]"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown.enter="emit('search', modelValue)"
    />
    <button
      v-if="modelValue"
      type="button"
      aria-label="Limpiar búsqueda"
      class="inline-flex min-h-9 min-w-9 shrink-0 touch-manipulation items-center justify-center rounded-xl p-1.5 text-[var(--dh-text-muted)] hover:bg-black/5 dark:hover:bg-white/10 max-sm:min-h-11 max-sm:min-w-11"
      @click="clear"
    >
      <X class="h-4 w-4" />
    </button>
  </div>
</template>
