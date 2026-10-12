<script setup lang="ts">
import type { Component } from 'vue'
import { computed, nextTick, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import DhModal from './DhModal.vue'

export interface CommandItem {
  id: string
  title: string
  description?: string
  icon?: Component
  category?: string
  kind?: 'record' | 'navigation'
}

const props = defineProps<{
  open: boolean
  query: string
  items: CommandItem[]
  loading?: boolean
  failedSources?: number
}>()

const emit = defineEmits<{
  close: []
  'update:query': [value: string]
  select: [item: CommandItem]
}>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)
const recordItems = computed(() => props.items.filter((item) => item.kind === 'record'))
const navigationItems = computed(() => props.items.filter((item) => item.kind !== 'record'))

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

      <div class="max-h-[55vh] space-y-3 overflow-y-auto pr-1 dh-scrollbar" aria-live="polite">
        <div v-if="loading" class="px-4 py-2 text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ t('topbar.searchingRecords') }}
        </div>

        <section v-if="recordItems.length > 0">
          <h3 class="px-4 py-1 text-[11px] font-black uppercase tracking-widest text-[var(--dh-text-muted)]">
            {{ t('topbar.records') }}
          </h3>
          <button
            v-for="item in recordItems"
            :key="item.id"
            type="button"
            class="flex w-full items-center gap-3 rounded-[20px] border border-transparent px-4 py-3 text-left transition hover:border-[var(--dh-border)] hover:bg-[var(--dh-card-hover)]"
            @click="emit('select', item)"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] dh-bg-primary-soft text-[var(--dh-primary)]">
              <component :is="item.icon" v-if="item.icon" class="h-5 w-5" />
            </div>
            <span class="min-w-0 flex-1">
              <span class="block text-[10px] font-extrabold uppercase tracking-wide text-[var(--dh-primary)]">{{ item.category }}</span>
              <span class="block truncate text-sm font-black text-[var(--dh-text)]">{{ item.title }}</span>
              <span v-if="item.description" class="block truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ item.description }}</span>
            </span>
          </button>
        </section>

        <section v-if="navigationItems.length > 0">
          <h3 class="px-4 py-1 text-[11px] font-black uppercase tracking-widest text-[var(--dh-text-muted)]">
            {{ t('topbar.navigationResults') }}
          </h3>
          <button
            v-for="item in navigationItems"
            :key="item.id"
            type="button"
            class="flex w-full items-center gap-3 rounded-[20px] border border-transparent px-4 py-3 text-left transition hover:border-[var(--dh-border)] hover:bg-[var(--dh-card-hover)]"
            @click="emit('select', item)"
          >
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] dh-bg-primary-soft text-[var(--dh-primary)]">
              <component :is="item.icon" v-if="item.icon" class="h-5 w-5" />
            </div>
            <span class="min-w-0">
              <span class="block truncate text-sm font-black text-[var(--dh-text)]">{{ item.title }}</span>
              <span v-if="item.description" class="block truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ item.description }}</span>
            </span>
          </button>
        </section>

        <div v-if="!loading && items.length === 0" class="rounded-[20px] border border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
          {{ t('topbar.noSearchResults') }}
        </div>
        <p v-if="failedSources" class="px-4 text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ t('topbar.partialSearchResults') }}
        </p>
      </div>
    </div>
  </DhModal>
</template>
