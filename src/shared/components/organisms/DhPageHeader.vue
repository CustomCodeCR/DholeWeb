<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { FileSpreadsheet } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { downloadVisibleTablesAsExcel, hasVisibleExcelTables } from '@/core/utils/excel'

const props = defineProps<{ title: string; subtitle?: string; icon?: Component }>()
const hasExcelTables = ref(false)
let observer: MutationObserver | null = null
let refreshFrame = 0

function refreshExcelAvailability() {
  window.cancelAnimationFrame(refreshFrame)
  refreshFrame = window.requestAnimationFrame(() => {
    hasExcelTables.value = hasVisibleExcelTables()
  })
}

function exportExcel() {
  downloadVisibleTablesAsExcel(props.title)
}

onMounted(async () => {
  await nextTick()
  refreshExcelAvailability()
  observer = new MutationObserver(refreshExcelAvailability)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden'],
  })
  window.addEventListener('resize', refreshExcelAvailability)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  window.cancelAnimationFrame(refreshFrame)
  window.removeEventListener('resize', refreshExcelAvailability)
})
</script>

<template>
  <header class="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex min-w-0 items-center gap-3 sm:gap-4">
      <div v-if="icon" class="dh-glass dh-liquid flex h-12 w-12 shrink-0 sm:h-14 sm:w-14 items-center justify-center rounded-[24px] text-[var(--dh-primary)] shadow-[var(--dh-glow)]"><component :is="icon" class="h-6 w-6" /></div>
      <div>
        <h1 class="break-words text-2xl font-black sm:text-3xl tracking-tight text-[var(--dh-text)]">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1 max-w-3xl text-sm font-semibold text-[var(--dh-text-muted)]">{{ subtitle }}</p>
      </div>
    </div>
    <div v-if="$slots.actions || hasExcelTables" class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      <DhButton
        v-if="hasExcelTables"
        label="Exportar Excel"
        :icon="FileSpreadsheet"
        variant="secondary"
        size="sm"
        @click="exportExcel"
      />
      <slot name="actions" />
    </div>
  </header>
</template>
