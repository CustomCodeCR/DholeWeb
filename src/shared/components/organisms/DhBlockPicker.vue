<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Component } from 'vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhEmptyState from '@/shared/components/atoms/DhEmptyState.vue'
import DhBlockCard from '@/shared/components/molecules/DhBlockCard.vue'
import type { DhBlockCardItem } from '@/shared/components/molecules/DhBlockCard.vue'

export interface DhBlockPickerCategory {
  key: string
  label: string
}

export interface DhBlockPickerItem extends DhBlockCardItem {
  category: string
  icon?: Component
  keywords?: string[]
}

const props = defineProps<{
  modelValue: string | null
  categories: DhBlockPickerCategory[]
  items: DhBlockPickerItem[]
  searchPlaceholder?: string
  emptyTitle?: string
  emptyDescription?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [item: DhBlockPickerItem]
  dragstart: [event: DragEvent, item: DhBlockPickerItem]
}>()

const search = ref('')
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.items
  return props.items.filter((item) =>
    [item.title, item.description ?? '', item.category, ...(item.keywords ?? [])].some((value) => value.toLowerCase().includes(query)),
  )
})

const groups = computed(() =>
  props.categories
    .map((category) => ({
      ...category,
      items: filtered.value.filter((item) => item.category === category.key),
    }))
    .filter((group) => group.items.length > 0),
)

function choose(item: DhBlockPickerItem) {
  emit('update:modelValue', item.id)
  emit('select', item)
}
</script>

<template>
  <section class="flex max-h-[min(64dvh,36rem)] min-h-0 min-w-0 flex-col overflow-hidden">
    <div v-if="searchPlaceholder" class="shrink-0">
      <DhInput
        v-model="search"
        type="search"
        :placeholder="searchPlaceholder"
      />
    </div>

    <div v-if="groups.length" class="dh-scrollbar mt-3 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1">
      <section v-for="group in groups" :key="group.key" class="min-w-0">
        <h3 class="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
          {{ group.label }}
        </h3>
        <div class="space-y-2">
          <DhBlockCard
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            :selected="modelValue === item.id"
            draggable
            @select="choose(item as DhBlockPickerItem)"
            @dragstart="(event, block) => emit('dragstart', event, block as DhBlockPickerItem)"
          />
        </div>
      </section>
    </div>

    <DhEmptyState
      v-else-if="emptyTitle"
      class="mt-3 min-h-0 overflow-y-auto"
      :title="emptyTitle"
      :description="emptyDescription"
    />
  </section>
</template>
