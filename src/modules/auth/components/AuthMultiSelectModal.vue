<script setup lang="ts">
import { computed, ref } from 'vue'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

interface AuthMultiSelectItem {
  id: string
  label: string
  description?: string
  badge?: string
}

const props = defineProps<{
  title: string
  description?: string
  items: AuthMultiSelectItem[]
  initiallySelectedIds?: string[]
  confirmLabel: string
  emptyText?: string
  onConfirm: (ids: string[]) => Promise<void> | void
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const query = ref('')
const selectedIds = ref<string[]>([...(props.initiallySelectedIds ?? [])])
const loading = ref(false)

const filteredItems = computed(() => {
  const value = query.value.trim().toLowerCase()
  if (!value) return props.items
  return props.items.filter((item) => `${item.label} ${item.description ?? ''} ${item.badge ?? ''}`.toLowerCase().includes(value))
})

function toggle(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}

async function confirm() {
  loading.value = true
  try {
    await props.onConfirm(selectedIds.value)
    modalStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo completar la acción.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="space-y-5">
    <div>
      <h3 class="text-lg font-black text-[var(--dh-text)]">{{ title }}</h3>
      <p v-if="description" class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ description }}</p>
    </div>

    <DhInput v-model="query" label="Buscar" placeholder="Filtrar..." />

    <div class="max-h-[420px] space-y-2 overflow-y-auto pr-1 dh-scrollbar">
      <button
        v-for="item in filteredItems"
        :key="item.id"
        type="button"
        class="flex w-full items-center justify-between gap-3 rounded-[22px] border p-3 text-left transition"
        :class="selectedIds.includes(item.id) ? 'dh-primary-selected' : 'border-[var(--dh-border)] hover:bg-[var(--dh-card-hover)]'"
        @click="toggle(item.id)"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-black text-[var(--dh-text)]">{{ item.label }}</span>
          <span v-if="item.description" class="block truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ item.description }}</span>
        </span>
        <DhBadge v-if="item.badge" :label="item.badge" variant="primary" />
      </button>

      <div v-if="filteredItems.length === 0" class="rounded-[24px] border border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
        {{ emptyText ?? 'No hay opciones.' }}
      </div>
    </div>

    <div class="flex items-center justify-between gap-3 border-t border-[var(--dh-border)] pt-4">
      <p class="text-xs font-bold text-[var(--dh-text-muted)]">Seleccionados: {{ selectedIds.length }}</p>
      <div class="flex justify-end gap-2">
        <DhButton label="Cancelar" variant="secondary" @click="modalStore.close()" />
        <DhButton :label="confirmLabel" :loading="loading" @click="confirm" />
      </div>
    </div>
  </section>
</template>
