<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { isCompatibleBenefitLocation, terminalForBenefitMode, type BenefitMode, type RouteRole } from '../utils/crmBenefitRouteCatalog'

const props = defineProps<{
  modelValue: string[]
  label: string
  placeholder: string
  catalogGroupSlugs: string[]
  routeMode: BenefitMode
  routeRole: RouteRole
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const catalog = ref<CatalogItemSelectDto[]>([])
const error = ref('')
let generation = 0

const selectedCode = computed(() => props.modelValue[0] ?? '')
const terminalType = computed(() =>
  props.routeRole === 'pod' ? 'SD' : terminalForBenefitMode(props.routeMode))
const options = computed(() => catalog.value
  .filter(item => item.isActive !== false &&
    isCompatibleBenefitLocation(item, props.routeMode, props.routeRole))
  .map(item => ({
    value: item.code,
    label: item.label || item.value || item.code,
    searchText: [item.code, item.slug, item.value].filter(Boolean).join(' '),
  })))

async function loadCatalog() {
  const request = ++generation
  error.value = ''
  try {
    const lists = await Promise.all(props.catalogGroupSlugs.map(slug =>
      CatalogItemsService.select({ catalogGroupSlug: slug })))
    if (request !== generation) return
    catalog.value = [...new Map(lists.flat().map(item => [item.code, item])).values()]
      .sort((a, b) => (a.label || a.code).localeCompare(b.label || b.code, 'es')))
  } catch {
    if (request === generation) {
      error.value = 'No se pudieron consultar las ubicaciones de Config.'
    }
  }
}
function updateSelection(code: string) {
  emit('update:modelValue', code ? [code] : [])
}
watch(() => [props.catalogGroupSlugs.join('|'), props.routeMode, props.routeRole],
  () => void loadCatalog())
onMounted(() => void loadCatalog())
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <PricingLocationSearchSelect
    :model-value="selectedCode"
    :label="label"
    :placeholder="placeholder"
    search-placeholder="Buscar puerto, ciudad o país…"
    :options="options"
    :terminal-type="terminalType"
    :error="error"
    @update:model-value="updateSelection"
    @open="loadCatalog"
  />
</template>
