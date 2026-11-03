<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DhSelect from '@/shared/components/atoms/DhSelect.vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

const props = defineProps<{
  modelValue: string[]
  label: string
  catalogGroupSlugs: string[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const catalog = ref<CatalogItemSelectDto[]>([])
const error = ref('')
let generation = 0
const selectedCode = computed(() => props.modelValue[0] ?? '')
const options = computed(() => catalog.value
  .filter(item => item.isActive !== false)
  .map(item => ({ value: item.code, label: item.label || item.value || item.code })))
async function loadCatalog() {
  const request = ++generation
  error.value = ''
  try {
    const lists = await Promise.all(props.catalogGroupSlugs.map(slug =>
      CatalogItemsService.select({ catalogGroupSlug: slug })))
    if (request !== generation) return
    catalog.value = [...new Map(lists.flat().map(item => [item.code, item])).values()]
      .sort((a, b) => (a.label || a.code).localeCompare(b.label || b.code, 'es'))
  } catch {
    if (request === generation) error.value = 'No se pudieron consultar los equipos de Config.'
  }
}
function updateSelection(code: string | number) {
  emit('update:modelValue', code ? [String(code)] : [])
}
watch(() => props.catalogGroupSlugs.join('|'), () => void loadCatalog())
onMounted(() => void loadCatalog())
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <DhSelect :model-value="selectedCode" :label="label" :options="options"
    placeholder="Seleccione un equipo" :error="error"
    @update:model-value="updateSelection" />
</template>
