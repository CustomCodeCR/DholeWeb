<script setup lang="ts">
import { computed, ref } from 'vue'
import { MapPin, Waypoints } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import PricingInteractiveOsmMap from '@/modules/pricing/components/PricingInteractiveOsmMap.vue'

interface InlandServiceLocation {
  address: string
  latitude: number | null
  longitude: number | null
}

const props = defineProps<{
  modelValue: InlandServiceLocation
  kind: 'pickup' | 'delivery'
}>()
const emit = defineEmits<{ 'update:modelValue': [value: InlandServiceLocation] }>()
const locating = ref(false)
const error = ref('')

const isPickup = computed(() => props.kind === 'pickup')
const title = computed(() => isPickup.value ? 'Ubicación de recolección' : 'Ubicación de entrega')
const address = computed({
  get: () => props.modelValue?.address ?? '',
  set: (value: string) => {
    error.value = ''
    emit('update:modelValue', { address: value, latitude: null, longitude: null })
  },
})
const point = computed(() => props.modelValue?.latitude != null && props.modelValue?.longitude != null
  ? { latitude: props.modelValue.latitude, longitude: props.modelValue.longitude }
  : null,
)

function updateLocation(value: InlandServiceLocation) {
  emit('update:modelValue', value)
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
    if (props.modelValue?.latitude === selected.latitude
      && props.modelValue?.longitude === selected.longitude
      && props.modelValue?.address === coordinateText) {
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
    <DhInput v-model="address" :label="isPickup ? 'Dirección de recolección *' : 'Dirección de entrega *'"
      placeholder="Calle, ciudad, provincia/estado y país" />
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
      :latitude="modelValue.latitude"
      :longitude="modelValue.longitude"
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
