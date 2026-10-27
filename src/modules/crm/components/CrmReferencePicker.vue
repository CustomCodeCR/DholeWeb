<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { crmGet, crmList, crmError, type CrmRow } from '../services/crmApi'

type CrmReferenceResource = 'accounts' | 'leads' | 'opportunities'

const props = defineProps<{
  modelValue: string
  label: string
  validationError?: string
  resource: CrmReferenceResource
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const search = ref('')
const results = ref<CrmRow[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

function rowLabel(item: CrmRow): string {
  return String(item.displayName ?? item.companyName ?? item.title ?? item.name ?? item.legalName ?? item.id)
}

const options = computed(() => {
  const found = results.value.map(item => ({ value: item.id, label: rowLabel(item) }))
  if (props.modelValue && !found.some(option => option.value === props.modelValue)) {
    found.unshift({ value: props.modelValue, label: 'Registro seleccionado · ' + props.modelValue })
  }
  return [{ value: '', label: 'Sin vincular' }, ...found]
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await crmList(props.resource, { q: search.value.trim(), page: 1, pageSize: 50 })
    const items = response.items
    total.value = response.total
    if (props.modelValue && !items.some(item => item.id === props.modelValue)) {
      try {
        const selected = await crmGet(props.resource, props.modelValue)
        items.unshift(selected)
      } catch {
        // A removed or inaccessible historic reference is preserved, not replaced by a different row.
      }
    }
    results.value = items
  } catch (e) {
    error.value = crmError(e)
    results.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

watch(() => props.resource, () => { search.value = ''; void load() })
onMounted(() => void load())
</script>

<template>
  <section class="space-y-2">
    <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ label }}</p>
    <div class="flex items-end gap-2">
      <DhInput class="min-w-0 flex-1" :model-value="search" :placeholder="'Buscar ' + label.toLowerCase()"
        @update:model-value="search = $event" @keyup.enter.prevent="load" />
      <DhButton :icon="Search" label="Buscar" variant="secondary" size="sm" :loading="loading" @click="load" />
    </div>
    <DhSelect :error="props.validationError" :model-value="modelValue" :options="options" placeholder=""
      :disabled="loading && results.length === 0" @update:model-value="emit('update:modelValue', String($event))" />
    <p v-if="error" role="alert" class="text-xs text-red-500">{{ error }}</p>
    <p v-else-if="total > 50" class="text-xs text-[var(--dh-text-muted)]">
      Mostrando hasta 50 resultados. Utilice la búsqueda para localizar otro registro.
    </p>
  </section>
</template>
