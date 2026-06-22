<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
const props = withDefaults(defineProps<{ page: number; pageSize: number; total: number }>(), { pageSize: 10 })
const emit = defineEmits<{ 'update:page': [value: number]; 'update:pageSize': [value: number] }>()
function totalPages() { return Math.max(1, Math.ceil(props.total / props.pageSize)) }
function go(page: number) { if (page < 1 || page > totalPages()) return; emit('update:page', page) }
</script>
<template>
  <div class="flex items-center justify-between gap-4 text-sm">
    <p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ total }} registros</p>
    <div class="flex items-center gap-2">
      <button class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 hover:bg-[var(--dh-card-hover)] disabled:opacity-40" :disabled="page <= 1" @click="go(page - 1)"><ChevronLeft class="h-4 w-4" /></button>
      <span class="text-xs font-black text-[var(--dh-text-soft)]">{{ page }} / {{ totalPages() }}</span>
      <button class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 hover:bg-[var(--dh-card-hover)] disabled:opacity-40" :disabled="page >= totalPages()" @click="go(page + 1)"><ChevronRight class="h-4 w-4" /></button>
      <select :value="pageSize" class="h-9 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-2 text-xs font-bold" @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))">
        <option :value="10">10</option><option :value="25">25</option><option :value="50">50</option>
      </select>
    </div>
  </div>
</template>
