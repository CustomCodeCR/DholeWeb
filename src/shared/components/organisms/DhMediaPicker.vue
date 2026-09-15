<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileImage, Upload } from 'lucide-vue-next'
import DhModal from '@/shared/components/organisms/DhModal.vue'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhInput from '@/shared/components/atoms/DhInput.vue'
import DhSelect, { type DhSelectOption } from '@/shared/components/atoms/DhSelect.vue'
import DhEmptyState from '@/shared/components/atoms/DhEmptyState.vue'
import DhSkeleton from '@/shared/components/atoms/DhSkeleton.vue'

export type DhMediaKind = 'image' | 'video' | 'document' | 'other'

export interface DhMediaPickerItem {
  id: string
  name: string
  kind?: DhMediaKind
  url?: string
  thumbnailUrl?: string
  meta?: string
}

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    items: DhMediaPickerItem[]
    modelValue: string | null
    searchPlaceholder?: string
    emptyTitle?: string
    emptyDescription?: string
    confirmLabel?: string
    cancelLabel?: string
    loading?: boolean
    selectOnClick?: boolean
    filterValue?: string | number | null
    filterOptions?: DhSelectOption[]
    filterPlaceholder?: string
    uploadLabel?: string
    uploadDisabled?: boolean
    uploading?: boolean
    autoClose?: boolean
  }>(),
  {
    loading: false,
    selectOnClick: false,
    filterValue: null,
    filterOptions: () => [],
    uploadDisabled: false,
    uploading: false,
    autoClose: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'update:filterValue': [value: string | number]
  select: [item: DhMediaPickerItem]
  upload: []
  close: []
}>()

const search = ref('')
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.items
  return props.items.filter((item) => [item.name, item.meta ?? '', item.kind ?? ''].some((value) => value.toLowerCase().includes(query)))
})
const selected = computed(() => props.items.find((item) => item.id === props.modelValue) ?? null)

function choose(item: DhMediaPickerItem) {
  emit('update:modelValue', item.id)
  if (props.selectOnClick) {
    emit('select', item)
    if (props.autoClose) emit('close')
  }
}

function confirm() {
  if (!selected.value) return
  emit('select', selected.value)
  if (props.autoClose) emit('close')
}
</script>

<template>
  <DhModal :open="open" :title="title" size="xl" @close="emit('close')">
    <div class="flex max-h-[calc(90dvh-8rem)] min-h-0 min-w-0 flex-col gap-4 overflow-hidden">
      <div class="grid min-w-0 shrink-0 gap-2" :class="filterOptions.length || uploadLabel ? 'md:grid-cols-[minmax(0,1fr)_180px_auto]' : ''">
        <DhInput
          v-if="searchPlaceholder"
          v-model="search"
          type="search"
          :placeholder="searchPlaceholder"
        />
        <DhSelect
          v-if="filterOptions.length"
          :model-value="filterValue"
          :options="filterOptions"
          :placeholder="filterPlaceholder ?? ''"
          @update:model-value="emit('update:filterValue', $event)"
        />
        <DhButton
          v-if="uploadLabel"
          :label="uploadLabel"
          :icon="Upload"
          variant="secondary"
          :loading="uploading"
          :disabled="uploadDisabled"
          @click="emit('upload')"
        />
      </div>

      <div class="dh-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <DhSkeleton v-for="index in 8" :key="index" height="9rem" rounded="lg" />
        </div>

        <div v-else-if="filtered.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <button
            v-for="item in filtered"
            :key="item.id"
            type="button"
            class="min-w-0 overflow-hidden rounded-[var(--dh-radius-xl)] border text-left transition"
            :class="
              modelValue === item.id
                ? 'border-[var(--dh-primary)] dh-bg-primary-soft ring-2 ring-[var(--dh-primary)]/20'
                : 'border-[var(--dh-border)] bg-[var(--dh-input)] hover:bg-[var(--dh-card-hover)]'
            "
            @click="choose(item)"
          >
            <div class="grid aspect-[4/3] place-items-center overflow-hidden bg-black/[0.04] dark:bg-white/[0.05]">
              <img
                v-if="item.thumbnailUrl || (item.kind === 'image' && item.url)"
                :src="item.thumbnailUrl || item.url"
                :alt="item.name"
                class="h-full w-full object-cover"
              />
              <FileImage v-else class="h-8 w-8 text-[var(--dh-text-muted)]" />
            </div>
            <div class="min-w-0 p-3">
              <div class="truncate text-sm font-bold text-[var(--dh-text)]">{{ item.name }}</div>
              <div v-if="item.meta" class="mt-1 truncate text-xs text-[var(--dh-text-muted)]">{{ item.meta }}</div>
            </div>
          </button>
        </div>

        <DhEmptyState
          v-else-if="emptyTitle"
          :title="emptyTitle"
          :description="emptyDescription"
        />

        <div v-if="selected" class="mt-4 min-w-0">
          <slot name="details" :item="selected" />
        </div>
      </div>

      <footer v-if="cancelLabel || confirmLabel" class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--dh-border)] pt-4">
        <DhButton v-if="cancelLabel" :label="cancelLabel" variant="ghost" @click="emit('close')" />
        <DhButton v-if="confirmLabel" :label="confirmLabel" :disabled="!selected" @click="confirm" />
      </footer>
    </div>
  </DhModal>
</template>
