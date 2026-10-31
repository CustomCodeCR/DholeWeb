<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

const props = withDefaults(defineProps<{
  modelValue: string[]
  label: string
  catalogGroupSlugs: string[]
  placeholder?: string
}>(), { placeholder: 'Todas las opciones (sin restricción)' })
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const open = ref(false)
const query = ref('')
const loading = ref(false)
const error = ref('')
const options = ref<CatalogItemSelectDto[]>([])
const savedLabels = ref<Record<string, string>>({})
let generation = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined
const selectedOptions = computed(() => props.modelValue.map(value => ({
  value, label: savedLabels.value[value] ?? options.value.find(x => x.code === value)?.label ?? value,
})))
const filtered = computed(() => options.value.filter(x => x.isActive !== false))
function toggle(value: string) {
  if (!value) return
  emit('update:modelValue', props.modelValue.includes(value)
    ? props.modelValue.filter(x => x !== value)
    : [...props.modelValue, value])
}
async function reload() {
  const id = ++generation
  if (!props.catalogGroupSlugs.length) { options.value = []; return }
  loading.value = true
  error.value = ''
  try {
    const values = await Promise.all(props.catalogGroupSlugs.map(async slug => {
      try { return await CatalogItemsService.select({
        catalogGroupSlug: slug, search: query.value.trim() || undefined,
      }) } catch { return [] as CatalogItemSelectDto[] }
    }))
    if (id !== generation) return
    options.value = [...new Map(values.flat().map(item => [item.code, item])).values()]
      .filter(x => x.isActive !== false)
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'es'))
    const labels = { ...savedLabels.value }
    for (const item of options.value) if (item.code) labels[item.code] = item.label || item.value || item.code
    savedLabels.value = labels
    if (!options.value.length && !query.value.trim()) error.value = 'No hay opciones disponibles en Config para esta selección.'
  } finally { if (id === generation) loading.value = false }
}
function openPicker() {
  open.value = !open.value
  if (open.value) void reload()
}
function search(value: string) {
  query.value = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void reload(), 250)
}
watch(() => props.catalogGroupSlugs.join('|'), () => {
  generation++
  options.value = []
  query.value = ''
  if (open.value) void reload()
})
</script>

<template>
  <div class="min-w-0 space-y-2" data-crm-multi-catalog>
    <label class="block text-xs font-bold text-[var(--dh-text-muted)]">{{ label }}</label>
    <div class="relative">
      <button type="button" :aria-expanded="open" :aria-label="label"
        class="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-left text-sm"
        @click="openPicker">
        <span>{{ modelValue.length ? modelValue.length + ' seleccionados' : placeholder }}</span>
        <ChevronDown class="h-4 w-4" />
      </button>
      <div v-if="open" class="absolute left-0 right-0 top-full z-40 mt-1 min-w-[250px] rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2 shadow-xl">
        <div class="flex items-center gap-2 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] p-2">
          <Search class="h-4 w-4 shrink-0" />
          <input :value="query" type="search" class="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Buscar por nombre o código…" @input="search(($event.target as HTMLInputElement).value)" />
        </div>
        <p v-if="loading" role="status" class="p-2 text-xs">Consultando Config…</p>
        <p v-else-if="error" role="status" class="p-2 text-xs text-amber-500">{{ error }}</p>
        <div class="max-h-56 space-y-1 overflow-auto py-2">
          <button v-for="option in filtered" :key="option.code" type="button"
            class="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs hover:bg-[var(--dh-shell)]"
            :aria-pressed="modelValue.includes(option.code)" @click="toggle(option.code)">
            <span class="flex h-4 w-4 items-center justify-center rounded border border-[var(--dh-border)]">
              <Check v-if="modelValue.includes(option.code)" class="h-3 w-3 text-[var(--dh-primary)]" />
            </span>
            <span class="flex-1">{{ option.label || option.value || option.code }}</span>
          </button>
        </div>
        <div class="flex justify-end border-t border-[var(--dh-border)] pt-2">
          <button type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-1.5 text-xs"
            @click="open=false">Listo</button>
        </div>
      </div>
    </div>
    <div v-if="selectedOptions.length" class="flex flex-wrap gap-1.5">
      <button v-for="item in selectedOptions" :key="item.value" type="button" :title="'Quitar '+item.label"
        class="flex items-center gap-1 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-shell)] px-2 py-1 text-xs"
        @click="toggle(item.value)">{{ item.label }} <X class="h-3 w-3" /></button>
    </div>
    <p v-else class="text-[11px] text-[var(--dh-text-muted)]">Sin selección = aplica a todos.</p>
  </div>
</template>
