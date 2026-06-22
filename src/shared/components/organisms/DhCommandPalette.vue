<script setup lang="ts">
import type { Component } from 'vue'
import { nextTick, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import DhModal from './DhModal.vue'

export interface CommandItem {
  id: string
  title: string
  description?: string
  icon?: Component
}

const props = defineProps<{
  open: boolean
  query: string
  items: CommandItem[]
}>()

const emit = defineEmits<{
  close: []
  'update:query': [value: string]
  select: [item: CommandItem]
}>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    inputRef.value?.focus()
  },
)

function handleEnter() {
  const first = props.items[0]
  if (first) emit('select', first)
}
</script>

<template>
  <DhModal :open="open" :title="t('common.search')" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <div
        class="flex h-14 items-center gap-3 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 shadow-[var(--dh-shadow-sm)]"
      >
        <Search class="h-5 w-5 text-[var(--dh-primary)]" />

        <input
          ref="inputRef"
          :value="query"
          :placeholder="t('topbar.searchPlaceholder')"
          class="h-full flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-muted)]"
          @input="emit('update:query', ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="handleEnter"
          @keydown.esc.prevent="emit('close')"
        />
      </div>

      <div class="max-h-[55vh] space-y-2 overflow-y-auto pr-1 dh-scrollbar">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="flex w-full items-center gap-3 rounded-[24px] border border-transparent px-4 py-3 text-left transition hover:border-[var(--dh-border)] hover:bg-[var(--dh-card-hover)]"
          @click="emit('select', item)"
        >
          <div
            class="flex h-11 w-11 items-center justify-center rounded-[18px] bg-red-500/10 text-[var(--dh-primary)]"
          >
            <component :is="item.icon" v-if="item.icon" class="h-5 w-5" />
          </div>

          <span class="min-w-0">
            <span class="block truncate text-sm font-black text-[var(--dh-text)]">
              {{ item.title }}
            </span>
            <span
              v-if="item.description"
              class="block truncate text-xs font-semibold text-[var(--dh-text-muted)]"
            >
              {{ item.description }}
            </span>
          </span>
        </button>

        <div v-if="items.length === 0" class="rounded-[24px] border border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
          {{ t('common.noData') }}
        </div>
      </div>
    </div>
  </DhModal>
</template>
