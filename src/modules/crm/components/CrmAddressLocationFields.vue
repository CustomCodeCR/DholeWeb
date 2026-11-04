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
const isPanama = computed(() => selectedIso.value === 'PA')
const hasThirdLevel = computed(() => isCostaRica.value || isPanama.value)
const firstLevelLabels: Record<string, string> = {
  CR: 'Provincia', PA: 'Provincia / comarca', US: 'Estado', MX: 'Estado', CO: 'Departamento',
}
const firstLabel = computed(() => firstLevelLabels[selectedIso.value] ?? 'Estado / provincia / región')
const secondLabel = computed(() => isCostaRica.value ? 'Cantón' : isPanama.value ? 'Distrito' : 'Ciudad / localidad')
const thirdLabel = computed(() => isPanama.value ? 'Corregimiento' : 'Distrito')

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
  // Account identity country is authoritative for its registered addresses.
  if (props.defaultCountryId && id !== props.defaultCountryId) return
  const item = countries.value.find(value => value.id === id)
  const iso = item ? countryIso(item, geoCountries.value) : ''
  if (props.modelValue.countryId === id && props.modelValue.countryCode === iso) return
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
  if (code && hasThirdLevel.value)
    void divisions(3, selectedIso.value, code, props.modelValue.admin1Code)
}
function selectThird(code: string) {
  const updated = { ...props.modelValue, admin3Code: code,
    admin3Name: optionName(thirdOptions.value, code) }
  patch({ admin3Code: updated.admin3Code, admin3Name: updated.admin3Name,
    postalCode: costaRicaPostalCode(updated) })
}
watch(() => props.defaultCountryId, id => {
  if (id && id !== props.modelValue.countryId && countries.value.length) selectCountry(id)
})
onMounted(async () => {
  try {
    countries.value = await CatalogItemsService.select({ catalogGroupSlug: 'countries' })
  } catch {
    warning.value = 'No se cargó el catálogo de países de Config.'
    return
  }
  const id = props.defaultCountryId || props.modelValue.countryId || ''
  if (id && (props.modelValue.countryId !== id || !props.modelValue.countryCode)) {
    // Do this BEFORE calling the optional worldwide API: the country of the
    // account and the Costa Rica registry must work even without that service.
    selectCountry(id)
  } else if (props.modelValue.countryCode) {
    const value = props.modelValue
    await divisions(1, value.countryCode)
    if (value.admin1Code) await divisions(2, value.countryCode, value.admin1Code)
    if ((value.countryCode === 'CR' || value.countryCode === 'PA') && value.admin2Code)
      await divisions(3, value.countryCode, value.admin2Code, value.admin1Code)
  }
  // World countries only enhances spelling/ISO matching; never block address UI.
  try {
    geoCountries.value = await crmRequest<CrmGeoCountry[]>(crmPath('geo/countries'))
    if (id && !props.modelValue.countryCode) selectCountry(id)
  } catch { /* Built-in Intl ISO labels remain available. */ }
})
</script>

<template>
  <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
    <div class="sm:col-span-2">
      <DhSelect label="País de la dirección" :model-value="modelValue.countryId"
        :options="countryOptions" placeholder="Seleccionar país"
        :disabled="Boolean(defaultCountryId)"
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
    <DhSelect v-if="hasThirdLevel" :label="thirdLabel" :model-value="modelValue.admin3Code"
      :options="thirdOptions.map(item => ({ value: item.code, label: item.name }))"
      :disabled="!modelValue.admin2Code || loading && thirdOptions.length === 0"
      :placeholder="isPanama ? 'Seleccionar corregimiento' : 'Seleccionar distrito'"
      @update:model-value="selectThird(String($event))" />
    <DhInput v-if="hasThirdLevel && modelValue.admin2Code && warning && !thirdOptions.length"
      :model-value="modelValue.admin3Name" :label="isPanama ? 'Corregimiento (manual)' : 'Distrito (manual)'"
      @update:model-value="patch({ admin3Code: '', admin3Name: String($event) })" />
    <DhInput v-if="!hasThirdLevel" :model-value="modelValue.admin3Name" label="Distrito / barrio / sector (opcional)"
      @update:model-value="patch({ admin3Code: '', admin3Name: String($event) })" />
    <DhInput :model-value="modelValue.postalCode" label="Código postal"
      :disabled="isCostaRica && !!costaRicaPostalCode(modelValue)"
      @update:model-value="patch({ postalCode: String($event) })" />
    <p v-if="loading" class="text-xs text-[var(--dh-text-muted)] sm:col-span-2" role="status">
      Consultando divisiones administrativas…
    </p>
    <p v-if="warning" class="text-xs text-amber-600 sm:col-span-2" role="status">{{ warning }}</p>
    <p v-if="!hasThirdLevel && selectedIso" class="text-xs text-[var(--dh-text-muted)] sm:col-span-2">
      Algunos países tienen niveles adicionales que no están disponibles en el catálogo público.
      Especificá los niveles adicionales y señas en la dirección exacta cuando corresponda.
    </p>
  </div>
</template>
