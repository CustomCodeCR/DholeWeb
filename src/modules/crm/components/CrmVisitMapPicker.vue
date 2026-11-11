<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MapPin, Search, X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { crmPath, crmRequest } from '../services/crmApi'

type VisitLocation = { address: string; latitude: number | null; longitude: number | null }
type Suggestion = { formatted?: string; name?: string; address_line1?: string; address_line2?: string; lat: number; lon: number }
interface RegisteredVisitLocation {
  id: string
  addressText: string
  addressType?: string | null
  location?: string | null
  countryCode?: string | null
  admin1Name?: string | null
  admin2Name?: string | null
  admin3Name?: string | null
  postalCode?: string | null
  locationLatitude?: number | null
  locationLongitude?: number | null
}
const props = withDefaults(defineProps<{
  modelValue: VisitLocation; readonly?: boolean; accountId?: string; leadId?: string
}>(), { readonly: false, accountId: '', leadId: '' })
const emit = defineEmits<{ 'update:modelValue': [value: VisitLocation] }>()

// Browser-exposed Geoapify keys must be restricted to allowed HTTP referrers in Geoapify.
const apiKey = '8710d7d3f6994e2ab06d4d28377f97d4'
const searchText = ref(props.modelValue.address || '')
const searchMode = ref<'address' | 'amenity'>('address')
const suggestions = ref<Suggestion[]>([])
const searching = ref(false)
const searchError = ref('')
const searchAttempted = ref(false)
const mapError = ref('')
const registeredLocations = ref<RegisteredVisitLocation[]>([])
const registeredLoading = ref(false)
const registeredError = ref('')
let registeredGeneration = 0
const center = ref({ latitude: 9.935, longitude: -84.08 })
const zoom = ref(12)
const mapRef = ref<HTMLElement | null>(null)
const viewport = ref({ width: 640, height: 345 })
const tileSize = 256
let resizeObserver: ResizeObserver | null = null
let debounce: ReturnType<typeof setTimeout> | null = null
let searchAbort: AbortController | null = null
let reverseAbort: AbortController | null = null
let registeredGeocodeAbort: AbortController | null = null
let generation = 0
let pointGeneration = 0
let drag: { x: number; y: number; px: number; py: number; moved: boolean } | null = null

function isCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
}
function project(latitude: number, longitude: number, level: number) {
  const total = tileSize * 2 ** level
  const phi = Math.max(-85.051128, Math.min(85.051128, latitude)) * Math.PI / 180
  const sin = Math.sin(phi)
  return { x: (longitude + 180) / 360 * total, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * total }
}
function unproject(x: number, y: number, level: number) {
  const total = tileSize * 2 ** level
  const longitude = (((x / total * 360) % 360) + 360) % 360 - 180
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * Math.max(0, Math.min(total, y)) / total))) * 180 / Math.PI
  return { latitude, longitude }
}
const tiles = computed(() => {
  if (!apiKey) return []
  const level = zoom.value
  const count = 2 ** level
  const point = project(center.value.latitude, center.value.longitude, level)
  const startX = point.x - viewport.value.width / 2
  const startY = point.y - viewport.value.height / 2
  const result: Array<{ id: string; src: string; left: number; top: number }> = []
  const fromX = Math.floor(startX / tileSize)
  const toX = Math.ceil((startX + viewport.value.width) / tileSize)
  const fromY = Math.floor(startY / tileSize)
  const toY = Math.ceil((startY + viewport.value.height) / tileSize)
  for (let x = fromX; x <= toX; x++) {
    for (let y = fromY; y <= toY; y++) {
      if (y < 0 || y >= count) continue
      const tileX = ((x % count) + count) % count
      result.push({
        id: level + ':' + x + ':' + y,
        src: 'https://maps.geoapify.com/v1/tile/osm-carto/' + level + '/' + tileX + '/' + y + '.png?apiKey=' + encodeURIComponent(apiKey),
        left: x * tileSize - startX, top: y * tileSize - startY,
      })
    }
  }
  return result
})
const marker = computed(() => {
  const latitude = props.modelValue.latitude
  const longitude = props.modelValue.longitude
  if (!isCoordinate(latitude, longitude)) return null
  const point = project(latitude, longitude!, zoom.value)
  const base = project(center.value.latitude, center.value.longitude, zoom.value)
  const total = tileSize * 2 ** zoom.value
  let dx = point.x - base.x
  if (dx > total / 2) dx -= total
  if (dx < -total / 2) dx += total
  return { left: viewport.value.width / 2 + dx, top: viewport.value.height / 2 + point.y - base.y }
})
watch(() => [props.modelValue.latitude, props.modelValue.longitude], ([latitude, longitude]) => {
  if (!isCoordinate(latitude, longitude)) return
  center.value = { latitude, longitude: longitude! }
}, { immediate: true })
watch(() => props.modelValue.address, address => { if (address !== searchText.value) searchText.value = address || '' })
const clientLocationsVisible = computed(() => !props.readonly && Boolean(props.accountId || props.leadId))
watch([() => props.accountId, () => props.leadId], () => { void loadRegisteredLocations() }, { immediate: true })
async function loadRegisteredLocations() {
  const id = ++registeredGeneration
  const accountId = props.accountId?.trim()
  const leadId = props.leadId?.trim()
  registeredLocations.value = []
  registeredError.value = ''
  registeredLoading.value = false
  registeredGeocodeAbort?.abort()
  if (!accountId && !leadId) return
  registeredLoading.value = true
  try {
    const path = accountId
      ? crmPath('accounts', accountId, 'addresses')
      : crmPath('leads', leadId, 'addresses')
    const items = await crmRequest<RegisteredVisitLocation[]>(path)
    if (id === registeredGeneration)
      registeredLocations.value = Array.isArray(items) ? items.filter(x => Boolean(x.addressText?.trim())) : []
  } catch {
    if (id === registeredGeneration)
      registeredError.value = 'No fue posible cargar las ubicaciones registradas de este cliente o prospecto.'
  } finally {
    if (id === registeredGeneration) registeredLoading.value = false
  }
}
function registeredLabel(item: RegisteredVisitLocation) {
  const type = item.addressType ?? 'OTHER'
  return type === 'WORK' ? 'Oficina / trabajo' : type === 'WAREHOUSE' ? 'Bodega'
    : type === 'BILLING' ? 'Facturación' : 'Otra ubicación'
}
function registeredDescription(item: RegisteredVisitLocation) {
  return [item.admin3Name, item.admin2Name, item.admin1Name, item.countryCode]
    .map(s => String(s || '').trim()).filter(Boolean).join(', ')
}
function registeredSearchText(item: RegisteredVisitLocation) {
  return [item.addressText, registeredDescription(item)].filter(Boolean).join(', ')
}
async function selectRegisteredLocation(item: RegisteredVisitLocation) {
  if (props.readonly) return
  const currentGeneration = registeredGeneration
  const address = registeredSearchText(item)
  pointGeneration++
  generation++
  if (debounce) clearTimeout(debounce)
  searchAbort?.abort()
  reverseAbort?.abort()
  registeredGeocodeAbort?.abort()
  registeredGeocodeAbort = new AbortController()
  searchText.value = address
  searchError.value = ''
  mapError.value = ''
  suggestions.value = []
  searchAttempted.value = false
  const lat = item.locationLatitude == null ? null : Number(item.locationLatitude)
  const lon = item.locationLongitude == null ? null : Number(item.locationLongitude)
  if (isCoordinate(lat, lon)) {
    center.value = { latitude: lat, longitude: lon! }
    zoom.value = Math.max(zoom.value, 16)
    emitPoint(lat, lon!, address)
    return
  }
  // Historical CRM addresses are often descriptive and have no stored coordinates.
  // Keep the registered address selected even if geocoding cannot find a precise point.
  emit('update:modelValue', { address, latitude: null, longitude: null })
  try {
    const params = geoParams(address)
    const matches = await queryGeocoder('search', params, registeredGeocodeAbort.signal)
    if (registeredGeneration !== currentGeneration ||
        searchText.value !== address || registeredGeocodeAbort.signal.aborted) return
    const found = matches.find(entry => isCoordinate(entry.lat, entry.lon))
    if (found) {
      center.value = { latitude: found.lat, longitude: found.lon }
      zoom.value = Math.max(zoom.value, 15)
      emitPoint(found.lat, found.lon, address)
    } else {
      mapError.value = 'Se seleccionó la ubicación guardada en CRM. Marcá el punto exacto en el mapa si es necesario.'
    }
  } catch (cause) {
    if (registeredGeneration === currentGeneration && (cause as Error).name !== 'AbortError')
      mapError.value = 'Se seleccionó la dirección de CRM. Podés marcar el punto en el mapa manualmente.'
  }
}

function emitPoint(latitude: number, longitude: number, address: string) {
  emit('update:modelValue', { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)), address })
}
function suggestionLabel(item: Suggestion) {
  return item.formatted || [item.name || item.address_line1, item.address_line2].filter(Boolean).join(', ') || 'Ubicación seleccionada'
}
function chooseSuggestion(item: Suggestion) {
  if (!isCoordinate(item.lat, item.lon)) return
  pointGeneration++
  reverseAbort?.abort()
  suggestions.value = []
  searchText.value = suggestionLabel(item)
  searchError.value = ''
  center.value = { latitude: item.lat, longitude: item.lon }
  zoom.value = Math.max(zoom.value, 16)
  emitPoint(item.lat, item.lon, searchText.value)
}
async function reverseGeocode(latitude: number, longitude: number) {
  const id = ++pointGeneration
  reverseAbort?.abort()
  reverseAbort = new AbortController()
  const fallback = latitude.toFixed(6) + ', ' + longitude.toFixed(6)
  emitPoint(latitude, longitude, fallback)
  try {
    const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), lang: 'es', format: 'json', apiKey })
    const response = await fetch('https://api.geoapify.com/v1/geocode/reverse?' + params, { signal: reverseAbort.signal })
    if (!response.ok) throw new Error(geoHttpError(response.status))
    const result = await response.json() as { results?: Array<{ formatted?: string }> }
    if (id !== pointGeneration) return
    const address = result.results?.[0]?.formatted?.trim() || fallback
    searchText.value = address
    emitPoint(latitude, longitude, address)
  } catch (cause) {
    if ((cause as Error).name !== 'AbortError') mapError.value = 'Se guardarán las coordenadas; no se encontró la dirección exacta.'
  }
}
function geoParams(text: string) {
  return new URLSearchParams({
    text: text.trim(), format: 'json', limit: '8', lang: 'es',
    bias: 'proximity:' + center.value.longitude + ',' + center.value.latitude,
    apiKey,
  })
}
function geoHttpError(status: number) {
  if (status === 401 || status === 403)
    return 'Geoapify no autorizó la búsqueda (HTTP ' + status + '). Verificá que la clave tenga habilitada la API de geocodificación y el dominio permitido.'
  if (status === 429)
    return 'Geoapify alcanzó el límite de consultas (HTTP 429). Intentá nuevamente.'
  if (status === 400) return 'Geoapify rechazó los parámetros de búsqueda (HTTP 400).'
  return 'La búsqueda de Geoapify falló (HTTP ' + status + ').'
}
async function queryGeocoder(kind: 'autocomplete' | 'search', params: URLSearchParams, signal: AbortSignal): Promise<Suggestion[]> {
  const response = await fetch('https://api.geoapify.com/v1/geocode/' + kind + '?' + params,
    { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(geoHttpError(response.status))
  const data = await response.json() as {
    results?: Suggestion[]
    features?: Array<{ properties: Suggestion; geometry?: { coordinates?: number[] } }>
  }
  const results = Array.isArray(data.results) ? data.results
    : (data.features ?? []).map(feature => ({
        ...feature.properties,
        lat: feature.properties.lat ?? feature.geometry?.coordinates?.[1] ?? NaN,
        lon: feature.properties.lon ?? feature.geometry?.coordinates?.[0] ?? NaN,
      }))
  return results.filter(item => isCoordinate(item.lat, item.lon))
}
async function searchNow(preferFullSearch = false) {
  if (props.readonly) return
  if (debounce) { clearTimeout(debounce); debounce = null }
  const query = searchText.value.trim()
  ++generation
  const id = generation
  searchAbort?.abort()
  registeredGeocodeAbort?.abort()
  suggestions.value = []
  searchError.value = ''
  searchAttempted.value = query.length >= 3
  searching.value = false
  if (query.length < 3) {
    if (query.length) searchError.value = 'Escribí al menos tres caracteres para buscar.'
    return
  }
  searchAbort = new AbortController()
  const signal = searchAbort.signal
  searching.value = true
  const params = geoParams(query)
  // Full-text geocoding supports business names and descriptive addresses.
  // Autocomplete remains a fast-first path for partial street addresses.
  const paths: Array<'autocomplete' | 'search'> =
    preferFullSearch || searchMode.value === 'amenity'
      ? ['search', 'autocomplete'] : ['autocomplete', 'search']
  let failed: Error | null = null
  try {
    for (const kind of paths) {
      if (signal.aborted || id !== generation) return
      try {
        const results = await queryGeocoder(kind, params, signal)
        if (signal.aborted || id !== generation) return
        if (results.length) {
          suggestions.value = results
          searchError.value = ''
          return
        }
      } catch (cause) {
        if ((cause as Error).name === 'AbortError') return
        failed = cause as Error
      }
    }
    if (id !== generation || signal.aborted) return
    searchError.value = failed?.message ??
      'No encontramos coincidencias. Probá con una dirección más específica o marcá el punto en el mapa.'
  } finally {
    if (id === generation) searching.value = false
  }
}
function updateSearch() {
  if (props.readonly) return
  const address = searchText.value
  pointGeneration++
  reverseAbort?.abort()
  registeredGeocodeAbort?.abort()
  emit('update:modelValue', { address, latitude: null, longitude: null })
  searchError.value = ''
  searchAttempted.value = false
  suggestions.value = []
  ++generation
  searchAbort?.abort()
  searching.value = false
  if (debounce) clearTimeout(debounce)
  if (address.trim().length < 3) return
  debounce = setTimeout(() => { void searchNow() }, 350)
}
function zoomBy(delta: number) { zoom.value = Math.min(19, Math.max(2, zoom.value + delta)) }
function onWheel(event: WheelEvent) { if (!props.readonly) zoomBy(event.deltaY < 0 ? 1 : -1) }
function onPointerDown(event: PointerEvent) {
  if (props.readonly || !apiKey || event.button !== 0) return
  const point = project(center.value.latitude, center.value.longitude, zoom.value)
  drag = { x: event.clientX, y: event.clientY, px: point.x, py: point.y, moved: false }
  mapRef.value?.setPointerCapture(event.pointerId)
}
function onPointerMove(event: PointerEvent) {
  if (!drag || props.readonly) return
  const dx = event.clientX - drag.x
  const dy = event.clientY - drag.y
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true
  if (drag.moved) center.value = unproject(drag.px - dx, drag.py - dy, zoom.value)
}
function onPointerUp(event: PointerEvent) {
  if (!drag) return
  const wasClick = !drag.moved
  drag = null
  if (mapRef.value?.hasPointerCapture(event.pointerId)) mapRef.value.releasePointerCapture(event.pointerId)
  if (!wasClick || props.readonly || !apiKey || !mapRef.value) return
  const bounds = mapRef.value.getBoundingClientRect()
  const base = project(center.value.latitude, center.value.longitude, zoom.value)
  const selected = unproject(base.x + event.clientX - bounds.left - bounds.width / 2,
    base.y + event.clientY - bounds.top - bounds.height / 2, zoom.value)
  mapError.value = ''
  void reverseGeocode(selected.latitude, selected.longitude)
}
function clearLocation() {
  pointGeneration++
  reverseAbort?.abort()
  generation++
  searchAbort?.abort()
  searchText.value = ''
  suggestions.value = []
  emit('update:modelValue', { address: '', latitude: null, longitude: null })
}
onMounted(() => {
  if (!mapRef.value) return
  resizeObserver = new ResizeObserver(entries => {
    const rect = entries[0]?.contentRect
    if (rect) viewport.value = { width: rect.width, height: rect.height }
  })
  resizeObserver.observe(mapRef.value)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (debounce) clearTimeout(debounce)
  searchAbort?.abort()
  reverseAbort?.abort()
  registeredGeocodeAbort?.abort()
  registeredGeneration++
})
</script>

<template>
  <section class="visit-picker space-y-2" aria-label="Ubicación de la visita" data-crm-geoapify-visit>
    <div v-if="clientLocationsVisible" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 space-y-2"
      data-crm-registered-locations>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-extrabold">Ubicaciones registradas {{ accountId ? 'del cliente' : 'del prospecto' }}</p>
        <span v-if="registeredLocations.length" class="text-xs text-[var(--dh-text-muted)]">{{ registeredLocations.length }}</span>
      </div>
      <p v-if="registeredLoading" role="status" class="text-xs text-[var(--dh-text-muted)]">Cargando direcciones registradas…</p>
      <p v-else-if="registeredError" role="alert" class="text-xs text-amber-600">{{ registeredError }}</p>
      <div v-else-if="registeredLocations.length" class="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
        <button v-for="item in registeredLocations" :key="item.id" type="button"
          class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-left text-xs transition hover:border-[var(--dh-primary)] hover:bg-[var(--dh-card-hover)]"
          @click="selectRegisteredLocation(item)">
          <span class="block font-bold">{{ registeredLabel(item) }} · {{ item.addressText }}</span>
          <span v-if="registeredDescription(item)" class="mt-1 block text-[var(--dh-text-muted)]">{{ registeredDescription(item) }}</span>
        </button>
      </div>
      <p v-else class="text-xs text-[var(--dh-text-muted)]">
        No hay direcciones registradas. Podés buscar cualquier dirección o elegir un punto en el mapa.
      </p>
    </div>
    <div v-if="!readonly" class="relative space-y-2">
      <label class="block text-xs font-bold text-[var(--dh-text-muted)]" for="visit-location-search">Dirección o lugar de la visita</label>
      <div class="flex flex-wrap gap-2">
        <div class="relative min-w-[180px] flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]" />
          <input id="visit-location-search" v-model="searchText" type="search" autocomplete="off"
            maxlength="2000" class="visit-input w-full pl-9 pr-9"
            placeholder="Buscar dirección, negocio o punto de interés…" @input="updateSearch"
            @keydown.enter.prevent="searchNow(true)" @keydown.esc="suggestions=[]" />
          <button v-if="searchText" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 p-1"
            aria-label="Borrar ubicación" @click="clearLocation"><X class="h-4 w-4" /></button>
        </div>
        <select v-model="searchMode" aria-label="Tipo de búsqueda" class="visit-input w-36" @change="updateSearch">
          <option value="address">Direcciones</option>
          <option value="amenity">Lugares y negocios</option>
        </select>
        <button type="button" class="visit-search-btn" :disabled="searching || searchText.trim().length < 3"
          @click="searchNow(true)"><Search class="h-4 w-4" /> {{ searching ? 'Buscando…' : 'Buscar' }}</button>
      </div>
      <p v-if="searching" role="status" class="text-xs text-[var(--dh-text-muted)]">Buscando lugares…</p>
      <p v-if="searchError" role="alert" class="text-xs text-amber-600">{{ searchError }}</p>
      <p v-else-if="searchAttempted && !searching && !suggestions.length" role="status"
        class="text-xs text-[var(--dh-text-muted)]">Podés probar con otra dirección o seleccionar un punto directamente en el mapa.</p>
      <div v-if="suggestions.length" role="listbox" aria-label="Sugerencias de Geoapify"
        class="relative z-20 max-h-56 overflow-y-auto rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-lg">
        <button v-for="(item, index) in suggestions" :key="index" type="button" role="option"
          :aria-selected="false" class="block w-full border-b border-[var(--dh-border)] px-3 py-2 text-left text-sm hover:bg-[var(--dh-card-hover)]"
          @click="chooseSuggestion(item)">{{ suggestionLabel(item) }}</button>
      </div>
    </div>
    <div v-if="!apiKey" class="rounded-xl border border-amber-500/40 p-4 text-sm text-amber-600" role="alert">
      No fue posible cargar Geoapify. Podés registrar la dirección manualmente.
    </div>
    <div v-else ref="mapRef" class="visit-map relative h-[345px] w-full overflow-hidden rounded-xl border border-[var(--dh-border)]"
      :class="{ 'cursor-grab': !readonly }" role="group" aria-label="Mapa interactivo de Geoapify"
      @pointerdown="onPointerDown" @pointermove="onPointerMove"
      @pointerup="onPointerUp" @pointercancel="drag=null" @wheel.prevent="onWheel">
      <img v-for="tile in tiles" :key="tile.id" :src="tile.src" alt="" draggable="false"
        class="pointer-events-none absolute h-64 w-64 max-w-none select-none"
        :style="{ left: tile.left + 'px', top: tile.top + 'px' }" />
      <div v-if="marker" class="visit-marker pointer-events-none absolute z-10"
        :style="{ left: marker.left + 'px', top: marker.top + 'px' }">
        <MapPin class="h-9 w-9 fill-emerald-600 text-white drop-shadow-lg" :stroke-width="2.1" />
      </div>
      <div class="absolute right-3 top-3 z-10 flex flex-col rounded-lg bg-white shadow-md"
        @pointerdown.stop @pointerup.stop>
        <button type="button" class="visit-zoom" aria-label="Acercar mapa" @click.stop="zoomBy(1)"><ZoomIn class="h-5 w-5" /></button>
        <button type="button" class="visit-zoom border-t border-slate-200" aria-label="Alejar mapa" @click.stop="zoomBy(-1)"><ZoomOut class="h-5 w-5" /></button>
      </div>
      <div class="absolute bottom-0 left-0 right-0 z-10 bg-white/90 px-2 py-1 text-right text-[10px] text-slate-700">
        <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> ·
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>
      </div>
    </div>
    <p v-if="mapError" role="status" class="text-xs text-amber-600">{{ mapError }}</p>
    <div v-if="marker" class="flex flex-wrap items-center gap-2 text-xs text-[var(--dh-text-muted)]">
      <MapPin class="h-4 w-4 shrink-0 text-emerald-600" />
      <span class="min-w-0 flex-1">{{ modelValue.address || 'Punto seleccionado' }}</span>
      <span class="font-mono">{{ modelValue.latitude?.toFixed(6) }}, {{ modelValue.longitude?.toFixed(6) }}</span>
    </div>
    <p v-if="!readonly" class="text-xs text-[var(--dh-text-muted)]">
      Buscá un sitio y elegí una sugerencia, o mové el mapa y hacé clic para marcar la ubicación exacta.
    </p>
  </section>
</template>

<style scoped>
.visit-input { min-height: 42px; border: 1px solid var(--dh-border); border-radius: .7rem; padding: .65rem .7rem; color: var(--dh-text); background: var(--dh-input); font-size: .83rem; }
.visit-input:focus { outline: 2px solid var(--dh-primary); outline-offset: 1px; }
.visit-search-btn { display: inline-flex; align-items: center; justify-content: center; gap: .4rem; border-radius: .7rem; min-height: 42px; padding: .55rem .9rem; background: var(--dh-primary); color: white; font-size: .82rem; font-weight: 750; }
.visit-search-btn:disabled { opacity: .55; cursor: not-allowed; }
.visit-map { background: #e5e7eb; touch-action: none; }
.visit-marker { transform: translate(-50%, -100%); }
.visit-zoom { display: grid; width: 39px; height: 39px; place-items: center; color: #334155; }
.visit-zoom:hover { background: #f1f5f9; }
</style>
