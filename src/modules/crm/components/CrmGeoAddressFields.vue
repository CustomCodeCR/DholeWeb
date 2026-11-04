<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { DhInput, DhSelect } from '@/shared/components/atoms'
import { crmRequest } from '../services/crmApi'

export interface GeoAddressValue {
  countryCode: string
  admin1Code: string
  admin1Name: string
  admin2Code: string
  admin2Name: string
  admin3Code: string
  admin3Name: string
  postalCode: string
}
type Option = { code: string; name: string }
const props = defineProps<{ modelValue: GeoAddressValue }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: GeoAddressValue): void }>()
const countries = ref<Option[]>([])
const first = ref<Option[]>([])
const second = ref<Option[]>([])
const third = ref<Option[]>([])
const loading = ref(false)
const warning = ref('')
const selectedCountry = computed(() => countries.value.find(x => x.code === props.modelValue.countryCode))
const levels = computed(() => props.modelValue.countryCode === 'CR'
  ? ['Provincia', 'Cantón', 'Distrito']
  : ['Estado / provincia / región', 'Ciudad / municipio', 'Localidad (si aplica)'])
const options = (items: Option[]) => items.map(x => ({ value: x.code, label: x.name }))
function update(patch: Partial<GeoAddressValue>) { emit('update:modelValue', { ...props.modelValue, ...patch }) }
async function request(parentCode?: string, grandparentCode?: string): Promise<Option[]> {
  if (!props.modelValue.countryCode) return []
  const query = new URLSearchParams({ countryCode: props.modelValue.countryCode })
  if (parentCode) query.set('parentCode', parentCode)
  if (grandparentCode) query.set('grandparentCode', grandparentCode)
  const response = await crmRequest<{ options: Option[] }>('/api/crm/geo/divisions?' + query)
  return Array.isArray(response.options) ? response.options : []
}
async function loadFirst() {
  first.value = []; second.value = []; third.value = []
  if (!props.modelValue.countryCode) return
  loading.value = true; warning.value = ''
  try { first.value = await request() }
  catch { warning.value = 'No se pudo consultar el catálogo. Puede registrar la dirección manualmente.' }
  finally { loading.value = false }
}
async function loadSecond() {
  second.value = []; third.value = []
  if (!props.modelValue.admin1Code) return
  loading.value = true; warning.value = ''
  try { second.value = await request(props.modelValue.admin1Code) }
  catch { warning.value = 'No se pudo consultar las subdivisiones. La dirección exacta sigue disponible.' }
  finally { loading.value = false }
}
async function loadThird() {
  third.value = []
  if (!props.modelValue.admin2Code || props.modelValue.countryCode !== 'CR') return
  loading.value = true; warning.value = ''
  try { third.value = await request(props.modelValue.admin2Code, props.modelValue.admin1Code) }
  catch { warning.value = 'No se pudieron consultar los distritos.' }
  finally { loading.value = false }
}
function changeCountry(code: string) {
  update({ countryCode: code, admin1Code: '', admin1Name: '', admin2Code: '', admin2Name: '',
    admin3Code: '', admin3Name: '', postalCode: '' })
}
function changeFirst(code: string) {
  update({ admin1Code: code, admin1Name: first.value.find(x=>x.code===code)?.name || '',
    admin2Code: '', admin2Name: '', admin3Code: '', admin3Name: '', postalCode: '' })
}
function changeSecond(code: string) {
  update({ admin2Code: code, admin2Name: second.value.find(x=>x.code===code)?.name || '',
    admin3Code: '', admin3Name: '', postalCode: '' })
}
function changeThird(code: string) {
  const value = props.modelValue
  const postal = value.countryCode === 'CR' && value.admin1Code && value.admin2Code && code
    ? value.admin1Code.padStart(1,'0') + value.admin2Code.padStart(2,'0') + code.padStart(2,'0') : ''
  update({ admin3Code: code, admin3Name: third.value.find(x=>x.code===code)?.name || '',
    postalCode: postal })
}
onMounted(async () => {
  try { countries.value = await crmRequest<Option[]>('/api/crm/geo/countries') }
  catch { warning.value = 'Catálogo de países temporalmente no disponible.' }
})
watch(() => props.modelValue.countryCode, () => { void loadFirst() }, { immediate: true })
watch(() => props.modelValue.admin1Code, () => { void loadSecond() }, { immediate: true })
watch(() => props.modelValue.admin2Code, () => { void loadThird() }, { immediate: true })
</script>
<template>
  <div class="grid gap-3 md:grid-cols-2">
    <DhSelect label="País" :model-value="modelValue.countryCode" placeholder="Seleccionar país"
      :options="options(countries)" @update:model-value="changeCountry(String($event))" />
    <DhSelect :label="levels[0]" :disabled="!modelValue.countryCode || loading"
      :model-value="modelValue.admin1Code" :options="options(first)" placeholder="Seleccionar"
      @update:model-value="changeFirst(String($event))" />
    <DhSelect :label="levels[1]" :disabled="!modelValue.admin1Code || loading"
      :model-value="modelValue.admin2Code" :options="options(second)" placeholder="Seleccionar"
      @update:model-value="changeSecond(String($event))" />
    <DhSelect v-if="modelValue.countryCode==='CR'" :label="levels[2]"
      :disabled="!modelValue.admin2Code || loading" :model-value="modelValue.admin3Code"
      :options="options(third)" placeholder="Seleccionar"
      @update:model-value="changeThird(String($event))" />
    <DhInput :model-value="modelValue.postalCode" label="Código postal"
      @update:model-value="update({ postalCode: String($event ?? '') })" />
    <p v-if="warning" role="status" class="text-xs text-amber-600 md:col-span-2">{{ warning }}</p>
  </div>
</template>
