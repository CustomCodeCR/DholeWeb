<script setup lang="ts">
defineProps<{
  routes: number
  equipment: number
  captures: number
  fields: number
}>()
</script>

<template>
  <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
      <dt class="text-xs font-bold text-[var(--dh-text-muted)]">Rutas</dt>
      <dd class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ routes }}</dd>
    </div>
    <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
      <dt class="text-xs font-bold text-[var(--dh-text-muted)]">Equipos</dt>
      <dd class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ equipment }}</dd>
    </div>
    <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
      <dt class="text-xs font-bold text-[var(--dh-text-muted)]">Endpoints</dt>
      <dd class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ captures }}</dd>
    </div>
    <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
      <dt class="text-xs font-bold text-[var(--dh-text-muted)]">Campos</dt>
      <dd class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ fields }}</dd>
    </div>
  </dl>
</template>
