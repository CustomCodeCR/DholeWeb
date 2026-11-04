<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { DhInput, DhSelect } from '@/shared/components/atoms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { crmPath, crmRequest } from '../services/crmApi'
import { countryIso, costaRicaPostalCode, emptyAddressLocation,
  type CrmAddressLocation, type CrmGeoCountry, type CrmGeoOption, type CrmGeoResponse } from '../model/crmAddressLocation'

const props = defineProps<{ modelValue: CrmAddressLocation; defaultCountryId?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: CrmAddressLocation] }>()
const countries = ref<CatalogItemSelectDto[]>([])
const geoCountries = ref<CrmGeoCountry[]>([])
const firstOptions = ref<CrmGeoOption[]>([])
const secondOptions = ref<CrmGeoOption[]>([])
const thirdOptions = ref<CrmGeoOption[]>([])
const loading = ref(false)
const warning = ref('')
let requestVersion = 0

const countryOptions = computed(() => countries.value.map(item => ({ value: item.id, label: item.label })))
const selectedIso = computed(() => props.modelValue.countryCode)
const isCostaRica = computed(() => selectedIso.value === 'CR')
const firstLevelLabels: Record<string, string> = {
  CR: 'Provincia', PA: 'Provincia', US: 'Estado', MX: 'Estado', CO: 'Departamento',
}
const firstLabel = computed(() => firstLevelLabels[selectedIso.value] ?? 'Estado / provincia / región')
const secondLabel = computed(() => isCostaRica.value ? 'Cantón' : 'Ciudad / localidad')

function patch(values: Partial<CrmAddressLocation>) {
  emit('update:modelValue', { ...props.modelValue, ...values })
}
function optionName(options: CrmGeoOption[], code: string) {
  return options.find(item => item.code === code)?.name ?? ''
}
async function divisions(level: 1 | 2 | 3, iso: string, parent = '', grandparent = '') {
  if (!iso) return
  const generation = ++requestVersion
  loading.value = true
  warning.value = ''
  try {
    const query = new URLSearchParams({ countryCode: iso })
    if (parent) query.set('parentCode', parent)
    if (grandparent) query.set('grandparentCode', grandparent)
    const response = await crmRequest<CrmGeoResponse>(crmPath('geo/divisions') + '?' + query.toString())
    if (generation !== requestVersion) return
    if (level === 1) firstOptions.value = response.options
    if (level === 2) secondOptions.value = response.options
    if (level === 3) thirdOptions.value = response.options
    if (!response.options.length)
      warning.value = 'No hay más subdivisiones disponibles. Podés completar la dirección exacta manualmente.'
  } catch {
    if (generation === requestVersion)
      warning.value = 'No se pudo cargar el catálogo geográfico. Podés registrar la dirección manualmente.'
  } finally {
    if (generation === requestVersion) loading.value = false
  }
}
function selectCountry(id: string) {
  const item = countries.value.find(value => value.id === id)
  const iso = item ? countryIso(item, geoCountries.value) : ''
  ++requestVersion
  firstOptions.value = []; secondOptions.value = []; thirdOptions.value = []
  patch({ ...emptyAddressLocation(), countryId: id, countryCode: iso })
  if (iso) void divisions(1, iso)
  else warning.value = 'El país no tiene un código ISO2 reconocible; ingresá la dirección manualmente.'
}
function selectFirst(code: string) {
  ++requestVersion
  secondOptions.value = []; thirdOptions.value = []
  patch({ admin1Code: code, admin1Name: optionName(firstOptions.value, code),
    admin2Code: '', admin2Name: '', admin3Code: '', admin3Name: '', postalCode: '' })
  if (code) void divisions(2, selectedIso.value, code)
}
function selectSecond(code: string) {
  ++requestVersion
  thirdOptions.value = []
  patch({ admin2Code: code, admin2Name: optionName(secondOptions.value, code),
    admin3Code: '', admin3Name: '', postalCode: '' })
  if (code && isCostaRica.value)
    void divisions(3, selectedIso.value, code, props.modelValue.admin1Code)
}
function selectThird(code: string) {
  const updated = { ...props.modelValue, admin3Code: code,
    admin3Name: optionName(thirdOptions.value, code) }
  patch({ admin3Code: updated.admin3Code, admin3Name: updated.admin3Name,
    postalCode: costaRicaPostalCode(updated) })
}
watch(() => props.defaultCountryId, id => {
  if (id && !props.modelValue.countryId && countries.value.length) selectCountry(id)
})
onMounted(async () => {
  try {
    countries.value = await CatalogItemsService.select({ catalogGroupSlug: 'countries' })
  } catch {
    warning.value = 'No se cargó el catálogo de países de Config.'
    return
  }
  try {
    geoCountries.value = await crmRequest<CrmGeoCountry[]>(crmPath('geo/countries'))
  } catch {
    warning.value = 'El catálogo geográfico mundial no está disponible; se puede escribir la dirección.'
  }
  const id = props.modelValue.countryId || props.defaultCountryId || ''
  if (id) selectCountry(id)
})
</script>

<template>
  <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
    <div class="sm:col-span-2">
      <DhSelect label="País de la dirección" :model-value="modelValue.countryId"
        :options="countryOptions" placeholder="Seleccionar país"
        @update:model-value="selectCountry(String($event))" />
    </div>
    <DhSelect :label="firstLabel" :model-value="modelValue.admin1Code"
      :options="firstOptions.map(item => ({ value: item.code, label: item.name }))"
      :disabled="!selectedIso || loading && firstOptions.length === 0"
      placeholder="Seleccionar división" @update:model-value="selectFirst(String($event))" />
    <DhSelect :label="secondLabel" :model-value="modelValue.admin2Code"
      :options="secondOptions.map(item => ({ value: item.code, label: item.name }))"
      :disabled="!modelValue.admin1Code || loading && secondOptions.length === 0"
      placeholder="Seleccionar localidad" @update:model-value="selectSecond(String($event))" />
    <DhSelect v-if="isCostaRica" label="Distrito" :model-value="modelValue.admin3Code"
      :options="thirdOptions.map(item => ({ value: item.code, label: item.name }))"
      :disabled="!modelValue.admin2Code || loading && thirdOptions.length === 0"
      placeholder="Seleccionar distrito" @update:model-value="selectThird(String($event))" />
    <DhInput v-else :model-value="modelValue.admin3Name" label="Distrito / barrio / sector (opcional)"
      @update:model-value="patch({ admin3Code: '', admin3Name: String($event) })" />
    <DhInput :model-value="modelValue.postalCode" label="Código postal"
      :disabled="isCostaRica && !!costaRicaPostalCode(modelValue)"
      @update:model-value="patch({ postalCode: String($event) })" />
    <p v-if="loading" class="text-xs text-[var(--dh-text-muted)] sm:col-span-2" role="status">
      Consultando divisiones administrativas…
    </p>
    <p v-if="warning" class="text-xs text-amber-600 sm:col-span-2" role="status">{{ warning }}</p>
    <p v-if="!isCostaRica && selectedIso" class="text-xs text-[var(--dh-text-muted)] sm:col-span-2">
      Algunos países tienen niveles adicionales que no están disponibles en el catálogo público.
      Especificá condado, municipio, corregimiento y señas en la dirección exacta cuando corresponda.
    </p>
  </div>
</template>
