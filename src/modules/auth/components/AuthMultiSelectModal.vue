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
  group?: string
}

const props = defineProps<{
  title: string
  description?: string
  items: AuthMultiSelectItem[]
  initiallySelectedIds?: string[]
  confirmLabel: string
  emptyText?: string
  danger?: boolean
  onConfirm: (ids: string[]) => Promise<void> | void
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const query = ref('')
const selectedModule = ref('all')
const selectedIds = ref<string[]>([...(props.initiallySelectedIds ?? [])])
const loading = ref(false)

const modules = computed(() => Array.from(new Set(
  props.items.map((item) => item.group).filter((group): group is string => Boolean(group)),
)).sort((a, b) => a.localeCompare(b, 'es')))

const filteredItems = computed(() => {
  const value = query.value.trim().toLowerCase()
  return props.items.filter((item) => {
    if (selectedModule.value !== 'all' && item.group !== selectedModule.value) return false
    return !value || [item.label, item.description, item.badge, item.group]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(value)
  })
})

const groupedItems = computed(() => {
  const groups = new Map<string, AuthMultiSelectItem[]>()
  for (const item of filteredItems.value) {
    const name = item.group || 'Otros'
    const list = groups.get(name) ?? []
    list.push(item)
    groups.set(name, list)
  }
  return Array.from(groups, ([name, items]) => ({ name, items }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
})

const selectedVisibleCount = computed(() => filteredItems.value.filter((item) => selectedIds.value.includes(item.id)).length)

function selectVisible() {
  selectedIds.value = Array.from(new Set([...selectedIds.value, ...filteredItems.value.map((item) => item.id)]))
}

function clearVisible() {
  const visibleIds = new Set(filteredItems.value.map((item) => item.id))
  selectedIds.value = selectedIds.value.filter((id) => !visibleIds.has(id))
}

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

    <div class="grid gap-3 sm:grid-cols-2">
      <DhInput v-model="query" label="Buscar" placeholder="Nombre o código de permiso..." />
      <label v-if="modules.length" class="flex flex-col gap-1 text-xs font-semibold text-[var(--dh-text-muted)]">
        Módulo
        <select v-model="selectedModule" class="min-w-0 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-sm text-[var(--dh-text)]">
          <option value="all">Todos los módulos ({{ props.items.length }})</option>
          <option v-for="moduleName in modules" :key="moduleName" :value="moduleName">
            {{ moduleName }} ({{ props.items.filter((item) => item.group === moduleName).length }})
          </option>
        </select>
      </label>
    </div>
    <div v-if="modules.length" class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
        {{ filteredItems.length }} visibles · {{ selectedVisibleCount }} seleccionados en este filtro
      </p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="text-xs font-bold text-[var(--dh-primary)] hover:underline disabled:opacity-50" :disabled="!filteredItems.length" @click="selectVisible">Seleccionar visibles</button>
        <button type="button" class="text-xs font-bold text-[var(--dh-text-muted)] hover:underline disabled:opacity-50" :disabled="!selectedVisibleCount" @click="clearVisible">Quitar selección visible</button>
      </div>
    </div>
    <div class="max-h-[420px] space-y-3 overflow-y-auto pr-1 dh-scrollbar">
      <section v-for="group in groupedItems" :key="group.name" class="space-y-2">
        <div v-if="modules.length" class="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-2">
          <h4 class="text-xs font-black text-[var(--dh-text)]">{{ group.name }}</h4>
          <span class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ group.items.length }} permisos</span>
        </div>
        <button
          v-for="item in group.items"
          :key="item.id"
          type="button"
          :aria-pressed="selectedIds.includes(item.id)"
          class="flex w-full items-center justify-between gap-3 rounded-[18px] border p-3 text-left transition"
          :class="selectedIds.includes(item.id) ? 'dh-primary-selected' : 'border-[var(--dh-border)] hover:bg-[var(--dh-card-hover)]'"
          @click="toggle(item.id)"
        >
          <span class="min-w-0">
            <span class="block break-words text-sm font-black text-[var(--dh-text)]">{{ item.label }}</span>
            <span v-if="item.description" class="block break-all text-xs font-semibold text-[var(--dh-text-muted)]">{{ item.description }}</span>
          </span>
          <DhBadge v-if="item.badge" :label="item.badge" variant="primary" />
        </button>
      </section>
      <div v-if="filteredItems.length === 0" class="rounded-[24px] border border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
        {{ emptyText ?? 'No hay opciones para ese filtro.' }}
      </div>
    </div>

    <div class="flex items-center justify-between gap-3 border-t border-[var(--dh-border)] pt-4">
      <p class="text-xs font-bold text-[var(--dh-text-muted)]">Seleccionados: {{ selectedIds.length }}</p>
      <div class="flex justify-end gap-2">
        <DhButton label="Cancelar" variant="secondary" @click="modalStore.close()" />
        <DhButton :label="confirmLabel" :variant="danger ? 'danger' : 'primary'" :loading="loading" @click="confirm" />
      </div>
    </div>
  </section>
</template>
