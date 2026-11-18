<script setup lang="ts">
import { computed, ref } from 'vue'
import { MapPin, Waypoints, Pencil, Trash2 } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import type { RateOperationType } from '@/core/interfaces/pricing'
import { inlandBillingParty, incotermOperationExplanation } from '@/modules/pricing/utils/pricingIncotermPerspective'
import PricingInteractiveOsmMap from '@/modules/pricing/components/PricingInteractiveOsmMap.vue'

interface InlandServiceLocation {
  address: string
  latitude: number | null
  longitude: number | null
  cargoCondition?: 'FiscalCargo' | 'NationalizedCargo' | null
  billingParty?: 'Exporter' | 'Importer' | 'Both' | 'ByAgreement' | null
}

const props = defineProps<{
  modelValue: InlandServiceLocation
  kind: 'pickup' | 'delivery'
  locations?: InlandServiceLocation[]
  operationType?: RateOperationType
  incotermCode?: string
  error?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: InlandServiceLocation]
  'update:locations': [value: InlandServiceLocation[]]
}>()
const emptyLocation = (): InlandServiceLocation => ({ address: '', latitude: null, longitude: null })
const draft = ref<InlandServiceLocation>(emptyLocation())
const editingIndex = ref<number | null>(null)
const cargoCondition = ref<'FiscalCargo' | 'NationalizedCargo' | ''>('')
const billingParty = ref<'Exporter' | 'Importer' | 'Both' | 'ByAgreement' | ''>('')
const savedPoints = computed(() => props.locations?.length
  ? props.locations
  : props.modelValue?.address?.trim() ? [props.modelValue] : [])
const payerOptions = [
  { value: 'Exporter', label: 'Exportador / vendedor' },
  { value: 'Importer', label: 'Importador / comprador' },
  { value: 'Both', label: 'Ambos (tránsito doméstico)' },
  { value: 'ByAgreement', label: 'Según acuerdo comercial' },
]
const cargoOptions = [
  { value: 'FiscalCargo', label: 'Carga fiscal' },
  { value: 'NationalizedCargo', label: 'Carga nacionalizada' },
]
const payerContext = computed(() => incotermOperationExplanation(
  props.operationType ?? 'TransitDomestic', props.incotermCode ?? '',
))
function editPoint(index: number) {
  const point = savedPoints.value[index]
  if (!point) return
  editingIndex.value = index
  draft.value = { ...point }
  cargoCondition.value = point.cargoCondition ?? ''
  billingParty.value = point.billingParty ?? inlandBillingParty(
    props.operationType ?? 'TransitDomestic', props.incotermCode ?? '')
  error.value = ''
}
function removePoint(index: number) {
  const next = savedPoints.value.filter((_, i) => i !== index)
  emit('update:locations', next)
  emit('update:modelValue', next[0] ?? emptyLocation())
  draft.value = emptyLocation()
  editingIndex.value = null
  cargoCondition.value = ''
  billingParty.value = ''
  confirmedAddress.value = ''
}
function resetEditor() {
  draft.value = emptyLocation()
  editingIndex.value = null
  cargoCondition.value = ''
  billingParty.value = ''
}
const locating = ref(false)
const error = ref('')
const confirmedAddress = ref('')

const isPickup = computed(() => props.kind === 'pickup')
const title = computed(() => isPickup.value ? 'Ubicación de recolección' : 'Ubicación de entrega')
const address = computed({
  get: () => draft.value.address,
  set: (value: string) => {
    error.value = ''
    confirmedAddress.value = ''
    draft.value = { ...draft.value, address: value, latitude: null, longitude: null }
  },
})
const point = computed(() => draft.value.latitude != null && draft.value.longitude != null
  ? { latitude: draft.value.latitude, longitude: draft.value.longitude }
  : null,
)

function updateLocation(value: InlandServiceLocation) {
  draft.value = { ...draft.value, ...value }
}

function saveLocation() {
  const writtenAddress = address.value.trim()
  if (!writtenAddress) {
    error.value = 'Escriba una dirección antes de guardar el punto.'
    return
  }
  if (!cargoCondition.value) {
    error.value = 'Seleccione el tipo de carga (fiscal o nacionalizada) para este punto.'
    return
  }
  const current = savedPoints.value.map(item => ({ ...item }))
  const nextPoint: InlandServiceLocation = {
    ...draft.value,
    address: writtenAddress,
    cargoCondition: cargoCondition.value,
    billingParty: billingParty.value || inlandBillingParty(
      props.operationType ?? 'TransitDomestic', props.incotermCode ?? ''),
  }
  if (editingIndex.value == null) current.push(nextPoint)
  else current.splice(editingIndex.value, 1, nextPoint)
  emit('update:locations', current)
  emit('update:modelValue', current[0])
  confirmedAddress.value = writtenAddress
  error.value = ''
  resetEditor()
}

type GeocodeResult = { lat?: string; lon?: string; display_name?: string }

async function locateAddress() {
  const requested = address.value.trim()
  if (!requested || locating.value) return
  locating.value = true
  error.value = ''
  try {
    // Buscar primero la dirección completa y después una zona aproximada.
    // La dirección comercial escrita por el usuario nunca se reemplaza por el resultado geográfico.
    const terms = requested.split(',').map(term => term.trim()).filter(Boolean)
    const queries = [requested, ...(terms.length > 2 ? [terms.slice(-3).join(', ')] : [])]
    let found: { latitude: number; longitude: number } | null = null
    for (const query of [...new Set(queries)]) {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es&q='
        + encodeURIComponent(query)
      const response = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('No se pudo consultar el mapa.')
      const results = await response.json() as GeocodeResult[]
      const first = results[0]
      if (!first) continue
      const latitude = Number(first.lat)
      const longitude = Number(first.lon)
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        found = { latitude, longitude }
        break
      }
    }
    // Evitar sobreescribir una dirección que el usuario cambió durante la búsqueda.
    if (address.value.trim() !== requested) return
    if (!found) {
      error.value = 'No se encontró el punto en el mapa. Puede continuar usando únicamente la dirección escrita.'
      return
    }
    updateLocation({ address: requested, ...found })
  } catch {
    error.value = 'No se pudo consultar OpenStreetMap. Puede continuar usando únicamente la dirección escrita.'
  } finally {
    locating.value = false
  }
}

async function selectPoint(selected: { latitude: number; longitude: number }) {
  if (locating.value) return
  const originalAddress = address.value.trim()
  const coordinateText = `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}`
  updateLocation({ address: originalAddress || coordinateText, ...selected })
  if (originalAddress) return // Mantener intacta la dirección exacta ya digitada.
  try {
    locating.value = true
    const url = 'https://nominatim.openstreetmap.org/reverse?format=json&accept-language=es&lat='
      + selected.latitude + '&lon=' + selected.longitude
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return
    const result = await response.json() as GeocodeResult
    if (draft.value.latitude === selected.latitude
      && draft.value.longitude === selected.longitude
      && draft.value.address === coordinateText) {
      updateLocation({ address: result.display_name?.trim() || coordinateText, ...selected })
    }
  } catch {
    // El punto elegido sigue siendo válido aunque falle la geocodificación inversa.
  } finally {
    locating.value = false
  }
}
</script>

<template>
  <section class="crystal-soft space-y-4 p-4 md:p-5">
    <div class="flex items-start gap-2">
      <MapPin class="mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
      <div>
        <h3 class="font-black">{{ title }}</h3>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          {{ isPickup ? 'Indique dónde se recogerá la carga.' : 'Indique dónde se entregará la carga.' }}
          La dirección es obligatoria para continuar; ubicar el punto en el mapa es opcional.
        </p>
      </div>
    </div>
    <p class="text-xs text-[var(--dh-text-muted)]">{{ payerContext }}</p>
    <div v-if="savedPoints.length" class="space-y-2" data-inland-stops>
      <div v-for="(saved, index) in savedPoints" :key="index" class="flex items-start justify-between gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
        <div class="min-w-0">
          <p class="text-xs font-black">Punto {{ index + 1 }} · {{ saved.cargoCondition === 'FiscalCargo' ? 'Carga fiscal' : saved.cargoCondition === 'NationalizedCargo' ? 'Carga nacionalizada' : 'Tipo de carga pendiente' }}</p>
          <p class="break-words text-sm">{{ saved.address }}</p>
          <p class="text-xs text-[var(--dh-text-muted)]">{{ payerOptions.find(option => option.value === saved.billingParty)?.label ?? 'Responsable según Incoterm' }}</p>
        </div>
        <div class="flex shrink-0 gap-1">
          <DhButton variant="ghost" @click="editPoint(index)"><Pencil class="h-4 w-4" /> Editar</DhButton>
          <DhButton variant="ghost" @click="removePoint(index)"><Trash2 class="h-4 w-4" /> Quitar</DhButton>
        </div>
      </div>
    </div>
    <p class="text-xs font-semibold"> {{ editingIndex == null ? 'Agregar otro punto' : `Modificar punto ${editingIndex + 1}` }} </p>
    <DhSelect v-model="cargoCondition" label="Tipo de carga *" :options="cargoOptions" placeholder="Seleccione carga fiscal o nacionalizada" />
    <DhSelect v-model="billingParty" label="Responsable del costo" :options="payerOptions" placeholder="Automático según operación e Incoterm" />
    <DhInput v-model="address" :error="props.error" :label="isPickup ? 'Dirección de recolección *' : 'Dirección de entrega *'"
      placeholder="Calle, ciudad, provincia/estado y país" />
    <div class="flex flex-wrap items-center gap-3">
      <DhButton variant="secondary" :disabled="!address.trim()" @click="saveLocation">
        {{ editingIndex == null ? (isPickup ? 'Guardar punto de recolección' : 'Guardar punto de entrega') : 'Actualizar punto' }}
      </DhButton>
      <p v-if="confirmedAddress && confirmedAddress === address.trim()" role="status" class="text-xs font-semibold text-[var(--dh-primary)]">
        Punto agregado a la lista. Se conservará al guardar la tarifa.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <DhButton variant="secondary" :disabled="locating || !address.trim()" @click="locateAddress">
        <Waypoints class="h-4 w-4" /> {{ locating ? 'Ubicando…' : 'Ubicar en mapa (opcional)' }}
      </DhButton>
      <p v-if="point" class="text-xs font-semibold text-[var(--dh-text-muted)]">
        {{ point.latitude.toFixed(6) }}, {{ point.longitude.toFixed(6) }}
      </p>
    </div>
    <p v-if="error" role="status" class="text-xs font-bold text-amber-600 dark:text-amber-400">{{ error }}</p>
    <PricingInteractiveOsmMap
      :latitude="draft.latitude"
      :longitude="draft.longitude"
      :interactive-selection="true"
      :initial-zoom="11"
      :selection-zoom="13"
      hint="Opcional: toque el mapa para señalar el punto exacto de recolección o entrega."
      @select-point="selectPoint"
    />
    <a
      v-if="point"
      :href="`https://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=13/${point.latitude}/${point.longitude}`"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex min-h-11 items-center text-xs font-black text-[var(--dh-primary)]"
    >Ver ubicación en OpenStreetMap</a>
  </section>
</template>
