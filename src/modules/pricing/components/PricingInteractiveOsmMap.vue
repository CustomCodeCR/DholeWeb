<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'

interface PricingMapMarker {
  id: string
  label: string
  latitude: number
  longitude: number
  selected?: boolean
}

type LeafletLatLng = { lat: number; lng: number }
type LeafletMap = {
  setView: (latlng: [number, number], zoom?: number, options?: Record<string, unknown>) => LeafletMap
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => LeafletMap
  invalidateSize: (options?: Record<string, unknown>) => LeafletMap
  getZoom: () => number
  on: (event: string, handler: (event: any) => void) => LeafletMap
  off: () => LeafletMap
  remove: () => void
}
type LeafletMarker = {
  setLatLng: (latlng: [number, number]) => LeafletMarker
  getLatLng: () => LeafletLatLng
  bindTooltip: (text: string, options?: Record<string, unknown>) => LeafletMarker
  on: (event: string, handler: (event: any) => void) => LeafletMarker
  remove: () => void
}
type LeafletApi = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap
  tileLayer: (url: string, options?: Record<string, unknown>) => { addTo: (map: LeafletMap) => unknown }
  marker: (latlng: [number, number], options?: Record<string, unknown>) => LeafletMarker & { addTo: (map: LeafletMap) => LeafletMarker }
  latLngBounds: (points: Array<[number, number]>) => unknown
  divIcon: (options: Record<string, unknown>) => unknown
}

declare global {
  interface Window {
    L?: LeafletApi
    __dholeLeafletLoader?: Promise<LeafletApi>
  }
}

const props = withDefaults(
  defineProps<{
    latitude?: number | null
    longitude?: number | null
    markers?: PricingMapMarker[]
    interactiveSelection?: boolean
    initialZoom?: number
    selectionZoom?: number
    minZoom?: number
    maxZoom?: number
    fitMarkers?: boolean
    hint?: string
  }>(),
  {
    latitude: null,
    longitude: null,
    markers: () => [],
    interactiveSelection: false,
    initialZoom: 11,
    selectionZoom: 11,
    minZoom: 2,
    maxZoom: 19,
    fitMarkers: false,
    hint: '',
  },
)

const emit = defineEmits<{
  'select-point': [point: { latitude: number; longitude: number }]
  'select-marker': [id: string]
}>()

const mapElement = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const loadError = ref('')
let map: LeafletMap | null = null
let selectedMarker: LeafletMarker | null = null
let catalogMarkers: Array<{ id: string; marker: LeafletMarker }> = []
let resizeObserver: ResizeObserver | null = null

function isLatitude(value: unknown): value is number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= -90 && parsed <= 90
}

function isLongitude(value: unknown): value is number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= -180 && parsed <= 180
}

function clampZoom(value: number) {
  return Math.min(props.maxZoom, Math.max(props.minZoom, Math.round(Number(value) || props.initialZoom)))
}

function loadLeaflet(): Promise<LeafletApi> {
  if (window.L) return Promise.resolve(window.L)
  if (window.__dholeLeafletLoader) return window.__dholeLeafletLoader

  window.__dholeLeafletLoader = new Promise<LeafletApi>((resolve, reject) => {
    const cssId = 'dhole-leaflet-css'
    if (!document.getElementById(cssId)) {
      const css = document.createElement('link')
      css.id = cssId
      css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      css.crossOrigin = ''
      document.head.appendChild(css)
    }

    const existing = document.getElementById('dhole-leaflet-js') as HTMLScriptElement | null
    if (existing) {
      if (window.L) resolve(window.L)
      else {
        existing.addEventListener('load', () => (window.L ? resolve(window.L) : reject(new Error('Leaflet no quedó disponible.'))), { once: true })
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar Leaflet.')), { once: true })
      }
      return
    }

    const script = document.createElement('script')
    script.id = 'dhole-leaflet-js'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.crossOrigin = ''
    script.async = true
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet no quedó disponible.')))
    script.onerror = () => reject(new Error('No se pudo cargar Leaflet.'))
    document.head.appendChild(script)
  })

  return window.__dholeLeafletLoader
}

function selectedPoint(): [number, number] | null {
  if (!isLatitude(props.latitude) || !isLongitude(props.longitude)) return null
  return [Number(props.latitude), Number(props.longitude)]
}

function selectedIcon(L: LeafletApi) {
  return L.divIcon({
    className: 'dhole-leaflet-selected-icon',
    html: '<span class="dhole-leaflet-pin"><span></span></span>',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  })
}

function catalogIcon(L: LeafletApi, selected: boolean) {
  return L.divIcon({
    className: selected ? 'dhole-leaflet-catalog-icon is-selected' : 'dhole-leaflet-catalog-icon',
    html: '<span class="dhole-leaflet-dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function syncSelectedMarker(recenter = false) {
  if (!map || !window.L) return
  const point = selectedPoint()
  if (!point) {
    selectedMarker?.remove()
    selectedMarker = null
    return
  }

  if (!selectedMarker) {
    selectedMarker = window.L.marker(point, {
      draggable: props.interactiveSelection,
      icon: selectedIcon(window.L),
      keyboard: true,
      zIndexOffset: 1000,
    }).addTo(map)

    if (props.interactiveSelection) {
      selectedMarker.on('dragend', () => {
        const position = selectedMarker?.getLatLng()
        if (!position) return
        emit('select-point', { latitude: position.lat, longitude: position.lng })
      })
    }
  } else {
    selectedMarker.setLatLng(point)
  }

  if (recenter) map.setView(point, clampZoom(Math.max(map.getZoom(), props.selectionZoom)), { animate: true })
}

function syncCatalogMarkers() {
  if (!map || !window.L) return
  for (const entry of catalogMarkers) entry.marker.remove()
  catalogMarkers = []

  for (const item of props.markers) {
    if (!isLatitude(item.latitude) || !isLongitude(item.longitude)) continue
    const marker = window.L.marker([Number(item.latitude), Number(item.longitude)], {
      icon: catalogIcon(window.L, Boolean(item.selected)),
      keyboard: true,
      title: item.label,
    }).addTo(map)
    marker.bindTooltip(item.label, { direction: 'top', offset: [0, -10] })
    marker.on('click', () => emit('select-marker', item.id))
    catalogMarkers.push({ id: item.id, marker })
  }
}

function fitVisiblePoints() {
  if (!map || !window.L) return
  const points: Array<[number, number]> = props.markers
    .filter((item) => isLatitude(item.latitude) && isLongitude(item.longitude))
    .map((item) => [Number(item.latitude), Number(item.longitude)])
  const selected = selectedPoint()
  if (selected) points.push(selected)

  if (!points.length) return void map.setView([9.7489, -83.7534], clampZoom(props.initialZoom))
  if (points.length === 1) return void map.setView(points[0], clampZoom(props.selectionZoom))
  map.fitBounds(window.L.latLngBounds(points), { padding: [48, 48], maxZoom: clampZoom(props.selectionZoom) })
}

async function initializeMap() {
  const element = mapElement.value
  if (!element) return

  try {
    loading.value = true
    loadError.value = ''
    const L = await loadLeaflet()
    if (!mapElement.value || map) return

    const point = selectedPoint()
    map = L.map(mapElement.value, {
      zoomControl: true,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      attributionControl: true,
      preferCanvas: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: props.maxZoom,
      minZoom: props.minZoom,
    }).addTo(map)
    map.setView(point ?? [9.7489, -83.7534], clampZoom(point ? props.selectionZoom : props.initialZoom))
    map.on('click', (event: { latlng?: LeafletLatLng }) => {
      if (!props.interactiveSelection || !event.latlng) return
      emit('select-point', { latitude: event.latlng.lat, longitude: event.latlng.lng })
    })

    syncSelectedMarker(false)
    syncCatalogMarkers()
    if (props.fitMarkers && props.markers.length) fitVisiblePoints()
    await nextTick()
    setTimeout(() => map?.invalidateSize({ animate: false }), 0)
    resizeObserver = new ResizeObserver(() => map?.invalidateSize({ animate: false }))
    resizeObserver.observe(mapElement.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'No se pudo cargar el mapa Leaflet.'
  } finally {
    loading.value = false
  }
}

watch(() => [props.latitude, props.longitude] as const, ([latitude, longitude], previous) => {
  if (latitude === previous?.[0] && longitude === previous?.[1]) return
  syncSelectedMarker(true)
})

watch(() => props.markers.map((item) => `${item.id}:${item.latitude}:${item.longitude}:${item.selected ? 1 : 0}`).join('|'), () => {
  syncCatalogMarkers()
  if (props.fitMarkers) fitVisiblePoints()
})

onMounted(() => void initializeMap())
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  for (const entry of catalogMarkers) entry.marker.remove()
  catalogMarkers = []
  selectedMarker?.remove()
  selectedMarker = null
  map?.off()
  map?.remove()
  map = null
})
</script>

<template>
  <div class="pricing-map-shell">
    <div class="pricing-map-toolbar">
      <p class="pricing-map-hint">{{ hint || (interactiveSelection ? 'Arrastre para explorar y haga clic en el punto exacto de recolección.' : 'Explore el mapa y seleccione un marcador.') }}</p>
    </div>
    <div class="pricing-map-stage">
      <div ref="mapElement" class="pricing-map-viewport" />
      <div v-if="loading" class="pricing-map-state"><span class="pricing-map-spinner" /><span>Cargando Leaflet…</span></div>
      <div v-else-if="loadError" class="pricing-map-state pricing-map-state--error"><AlertTriangle class="h-5 w-5" /><span>{{ loadError }}</span></div>
    </div>
  </div>
</template>

<style scoped>
.pricing-map-shell { overflow: hidden; border: 1px solid var(--dh-border); border-radius: 20px; background: var(--dh-card); }
.pricing-map-toolbar { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .65rem .85rem; border-bottom: 1px solid var(--dh-border); background: color-mix(in srgb, var(--dh-card) 96%, transparent); }
.pricing-map-hint { min-width: 0; font-size: .74rem; line-height: 1.4; font-weight: 750; color: var(--dh-text-muted); }
.pricing-map-stage { position: relative; }
.pricing-map-viewport { width: 100%; min-height: 390px; height: clamp(390px, 48vh, 590px); background: color-mix(in srgb, var(--dh-card) 88%, var(--dh-primary) 12%); }
.pricing-map-state { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: .65rem; padding: 1rem; background: color-mix(in srgb, var(--dh-card) 88%, transparent); color: var(--dh-text-muted); font-size: .82rem; font-weight: 800; backdrop-filter: blur(6px); }
.pricing-map-state--error { color: #dc2626; }
.pricing-map-spinner { width: 1.1rem; height: 1.1rem; border: 2px solid color-mix(in srgb, var(--dh-primary) 25%, transparent); border-top-color: var(--dh-primary); border-radius: 999px; animation: map-spin .8s linear infinite; }
@keyframes map-spin { to { transform: rotate(360deg); } }
:deep(.leaflet-container) { font-family: inherit; cursor: grab; }
:deep(.leaflet-container:active) { cursor: grabbing; }
:deep(.leaflet-control-zoom a) { color: var(--dh-text); background: color-mix(in srgb, var(--dh-card) 94%, transparent); border-color: var(--dh-border); }
:deep(.leaflet-control-attribution) { background: color-mix(in srgb, var(--dh-card) 88%, transparent); color: var(--dh-text-muted); }
:deep(.leaflet-control-attribution a) { color: var(--dh-primary); }
:deep(.dhole-leaflet-selected-icon), :deep(.dhole-leaflet-catalog-icon) { background: transparent !important; border: 0 !important; }
:deep(.dhole-leaflet-pin) { position: relative; display: block; width: 28px; height: 28px; transform: rotate(45deg); border: 3px solid #fff; border-radius: 50% 50% 50% 8%; background: var(--dh-primary); box-shadow: 0 5px 16px rgb(0 0 0 / 30%); }
:deep(.dhole-leaflet-pin > span) { position: absolute; top: 7px; left: 7px; width: 8px; height: 8px; border-radius: 999px; background: #fff; }
:deep(.dhole-leaflet-dot) { display: block; width: 18px; height: 18px; border: 3px solid #fff; border-radius: 999px; background: #64748b; box-shadow: 0 3px 10px rgb(0 0 0 / 28%); }
:deep(.dhole-leaflet-catalog-icon.is-selected .dhole-leaflet-dot) { width: 20px; height: 20px; background: var(--dh-primary); }
@media (max-width: 640px) { .pricing-map-viewport { min-height: 340px; height: 52vh; } }
</style>
