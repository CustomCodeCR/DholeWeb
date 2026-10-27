<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { Search } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  label: string
  validationError?: string
  catalogGroupSlug: string
  modelValue: string
  valueKind?: 'id' | 'code' | 'value'
}>(), { valueKind: 'id' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const items = ref<CatalogItemSelectDto[]>([])
const query = ref('')
const loading = ref(false)
const error = ref('')

function optionValue(item: CatalogItemSelectDto): string {
  if (props.valueKind === 'id') return item.id
  if (props.valueKind === 'value') {
    // Currencies in Config may use generated internal codes; persist the ISO value.
    const iso = [item.value, item.label, item.code, item.slug]
      .map(x => String(x ?? '').trim())
      .find(x => /^[A-Za-z]{3}$/.test(x))
    return iso?.toUpperCase() ?? String(item.value || item.code)
  }
  return item.code
}

const options = computed(() => {
  const list = items.value.filter(item => item.isActive !== false)
    .map(item => ({
      label: item.label || item.value || item.code,
      value: optionValue(item),
    }))
  if (props.modelValue && !list.some(x => x.value === props.modelValue)) {
    list.unshift({ value: props.modelValue, label: 'Seleccionado: ' + props.modelValue })
  }
  return [{label: 'Sin seleccionar', value: ''}, ...list]
})

async function reload() {
  loading.value = true
  error.value = ''
  try {
    // Same shared Config catalog endpoint as Dhole Pricing agents, POL, POE, POD.
    items.value = await CatalogItemsService.select({
      catalogGroupSlug: props.catalogGroupSlug, search: query.value.trim() || undefined,
    })
  } catch {
    error.value = 'No se pudo obtener el catálogo de Config.'
    items.value = []
  } finally { loading.value = false }
}

watch(() => props.catalogGroupSlug, () => { query.value = ''; void reload() }, {immediate: true})
</script>

<template>
  <section class="space-y-2">
    <div class="flex items-center justify-between">
      <p class="text-xs font-black uppercase tracking-[.12em] text-[var(--dh-text-muted)]">{{ label }}</p>
      <span class="text-[11px] text-[var(--dh-text-muted)]">Config</span>
    </div>
    <div class="flex items-center gap-2">
      <DhInput class="min-w-0 flex-1" :model-value="query" :placeholder="'Buscar ' + label.toLowerCase()"
        @update:model-value="query = $event" @keyup.enter.prevent="reload" />
      <DhButton :icon="Search" label="Buscar" variant="secondary" size="sm" :loading="loading" @click="reload" />
    </div>
    <DhSelect :error="props.validationError" :model-value="modelValue" :options="options" placeholder=""
      @update:model-value="emit('update:modelValue', String($event))" />
    <p v-if="error" role="alert" class="text-xs text-red-500">{{ error }}</p>
  </section>
</template>
