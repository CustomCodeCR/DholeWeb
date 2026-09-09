<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ page: number; pageSize: number; total: number }>(), { pageSize: 10 })
const emit = defineEmits<{ 'update:page': [value: number]; 'update:pageSize': [value: number] }>()

function totalPages() {
  return Math.max(1, Math.ceil(props.total / props.pageSize))
}

function go(page: number) {
  if (page < 1 || page > totalPages()) return
  emit('update:page', page)
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
    <p class="text-center text-xs font-bold text-[var(--dh-text-muted)] sm:text-left">{{ total }} registros</p>

    <div class="grid w-full min-w-0 grid-cols-[44px_minmax(0,1fr)_44px_minmax(72px,auto)] items-center gap-2 sm:flex sm:w-auto sm:justify-start">
      <button
        class="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 hover:bg-[var(--dh-card-hover)] disabled:opacity-40 sm:min-h-9 sm:min-w-9"
        :disabled="page <= 1"
        aria-label="Página anterior"
        @click="go(page - 1)"
      >
        <ChevronLeft class="h-4 w-4" />
      </button>

      <span class="min-w-0 text-center text-xs font-black text-[var(--dh-text-soft)] sm:shrink-0">
        {{ page }} / {{ totalPages() }}
      </span>

      <button
        class="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 hover:bg-[var(--dh-card-hover)] disabled:opacity-40 sm:min-h-9 sm:min-w-9"
        :disabled="page >= totalPages()"
        aria-label="Página siguiente"
        @click="go(page + 1)"
      >
        <ChevronRight class="h-4 w-4" />
      </button>

      <select
        :value="pageSize"
        class="h-11 min-w-0 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-2 text-base font-bold sm:h-9 sm:min-w-[4.5rem] sm:text-xs"
        aria-label="Registros por página"
        @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
      >
        <option :value="10">10</option>
        <option :value="25">25</option>
        <option :value="50">50</option>
      </select>
    </div>
  </div>
</template>
