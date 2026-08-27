<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Crosshair, MapPin, Minus, Plus, ScanSearch } from 'lucide-vue-next'

interface PricingMapMarker {
  id: string
  label: string
  latitude: number
  longitude: number
  selected?: boolean
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
    maxZoom: 17,
    fitMarkers: false,
    hint: '',
  },
)

const emit = defineEmits<{
  'select-point': [point: { latitude: number; longitude: number }]
  'select-marker': [id: string]
}>()

const TILE_SIZE = 256
const MAX_LATITUDE = 85.05112878
const viewport = ref<HTMLDivElement | null>(null)
const width = ref(640)
const height = ref(320)
const zoom = ref(clampZoom(props.initialZoom))
const centerLatitude = ref(validLatitude(props.latitude) ? Number(props.latitude) : 9.7489)
const centerLongitude = ref(validLongitude(props.longitude) ? Number(props.longitude) : -83.7534)
const dragging = ref(false)
const dragMoved = ref(false)
let resizeObserver: ResizeObserver | null = null
let dragState:
  | {
      pointerId: number
      startX: number
      startY: number
      centerX: number
      centerY: number
    }
  | null = null

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clampZoom(value: number) {
  return Math.round(clamp(Number(value) || props.initialZoom, props.minZoom, props.maxZoom))
}

function validLatitude(value: unknown): value is number {
  return Number.isFinite(Number(value)) && Math.abs(Number(value)) <= MAX_LATITUDE
}

function validLongitude(value: unknown): value is number {
  return Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 180
}

function normalizeLongitude(value: number) {
  let result = value
  while (result > 180) result -= 360
  while (result < -180) result += 360
  return result
}

function project(latitude: number, longitude: number, mapZoom: number) {
  const lat = clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE)
  const lon = normalizeLongitude(longitude)
  const scale = TILE_SIZE * 2 ** mapZoom
  const sin = Math.sin((lat * Math.PI) / 180)
  const x = ((lon + 180) / 360) * scale
  const y =
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
  return { x, y, scale }
}

function unproject(x: number, y: number, mapZoom: number) {
  const scale = TILE_SIZE * 2 ** mapZoom
  const wrappedX = ((x % scale) + scale) % scale
  const longitude = (wrappedX / scale) * 360 - 180
  const mercator = Math.PI - (2 * Math.PI * y) / scale
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(mercator))
  return {
    latitude: clamp(latitude, -MAX_LATITUDE, MAX_LATITUDE),
    longitude: normalizeLongitude(longitude),
  }
}

const centerWorld = computed(() =>
  project(centerLatitude.value, centerLongitude.value, zoom.value),
)

const tiles = computed(() => {
  const mapZoom = zoom.value
  const count = 2 ** mapZoom
  const center = centerWorld.value
  const left = center.x - width.value / 2
  const top = center.y - height.value / 2
  const minX = Math.floor(left / TILE_SIZE) - 1
  const maxX = Math.floor((left + width.value) / TILE_SIZE) + 1
  const minY = Math.max(0, Math.floor(top / TILE_SIZE) - 1)
  const maxY = Math.min(count - 1, Math.floor((top + height.value) / TILE_SIZE) + 1)
  const result: Array<{ key: string; src: string; left: number; top: number }> = []

  for (let tileX = minX; tileX <= maxX; tileX += 1) {
    const wrappedX = ((tileX % count) + count) % count
    for (let tileY = minY; tileY <= maxY; tileY += 1) {
      result.push({
        key: `${mapZoom}/${tileX}/${tileY}`,
        src: `https://tile.openstreetmap.org/${mapZoom}/${wrappedX}/${tileY}.png`,
        left: tileX * TILE_SIZE - left,
        top: tileY * TILE_SIZE - top,
      })
    }
  }

  return result
})

function relativePoint(latitude: number, longitude: number) {
  const center = centerWorld.value
  const point = project(latitude, longitude, zoom.value)
  let dx = point.x - center.x
  const worldWidth = point.scale
  if (dx > worldWidth / 2) dx -= worldWidth
  if (dx < -worldWidth / 2) dx += worldWidth
  return {
    left: width.value / 2 + dx,
    top: height.value / 2 + (point.y - center.y),
  }
}

const markerPositions = computed(() =>
  props.markers
    .filter(
      (marker) => validLatitude(marker.latitude) && validLongitude(marker.longitude),
    )
    .map((marker) => ({ marker, ...relativePoint(marker.latitude, marker.longitude) }))
    .filter(
      ({ left, top }) =>
        left >= -40 && left <= width.value + 40 && top >= -50 && top <= height.value + 50,
    ),
)

const selectedPointPosition = computed(() => {
  if (!validLatitude(props.latitude) || !validLongitude(props.longitude)) return null
  return relativePoint(Number(props.latitude), Number(props.longitude))
})

function pointFromClient(clientX: number, clientY: number) {
  const element = viewport.value
  if (!element) return null
  const rect = element.getBoundingClientRect()
  const center = centerWorld.value
  return unproject(
    center.x + (clientX - rect.left - rect.width / 2),
    center.y + (clientY - rect.top - rect.height / 2),
    zoom.value,
  )
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  const element = viewport.value
  if (!element) return
  const center = centerWorld.value
  dragging.value = true
  dragMoved.value = false
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    centerX: center.x,
    centerY: center.y,
  }
  element.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!dragState || dragState.pointerId !== event.pointerId) return
  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  if (Math.abs(dx) + Math.abs(dy) > 5) dragMoved.value = true
  if (!dragMoved.value) return

  const center = unproject(
    dragState.centerX - dx,
    dragState.centerY - dy,
    zoom.value,
  )
  centerLatitude.value = center.latitude
  centerLongitude.value = center.longitude
}

function finishPointer(event: PointerEvent) {
  if (!dragState || dragState.pointerId !== event.pointerId) return
  const element = viewport.value
  element?.releasePointerCapture?.(event.pointerId)
  const wasDrag = dragMoved.value
  dragState = null
  dragging.value = false
  dragMoved.value = false

  if (!wasDrag && props.interactiveSelection) {
    const point = pointFromClient(event.clientX, event.clientY)
    if (point) emit('select-point', point)
  }
}

function changeZoom(delta: number) {
  zoom.value = clampZoom(zoom.value + delta)
}

function centerOnSelection() {
  if (validLatitude(props.latitude) && validLongitude(props.longitude)) {
    centerLatitude.value = Number(props.latitude)
    centerLongitude.value = Number(props.longitude)
    zoom.value = clampZoom(Math.max(zoom.value, props.selectionZoom))
    return
  }
  if (props.markers.length) void fitAllMarkers()
}

async function fitAllMarkers() {
  const valid = props.markers.filter(
    (marker) => validLatitude(marker.latitude) && validLongitude(marker.longitude),
  )
  if (!valid.length) {
    centerLatitude.value = 9.7489
    centerLongitude.value = -83.7534
    zoom.value = clampZoom(props.minZoom)
    return
  }

  await nextTick()
  const availableWidth = Math.max(120, width.value - 96)
  const availableHeight = Math.max(120, height.value - 96)
  let selectedZoom = props.minZoom
  let selectedCenter = {
    latitude: valid.reduce((sum, marker) => sum + marker.latitude, 0) / valid.length,
    longitude: valid.reduce((sum, marker) => sum + marker.longitude, 0) / valid.length,
  }

  for (let candidateZoom = props.maxZoom; candidateZoom >= props.minZoom; candidateZoom -= 1) {
    const projected = valid.map((marker) =>
      project(marker.latitude, marker.longitude, candidateZoom),
    )
    const xs = projected.map((point) => point.x)
    const ys = projected.map((point) => point.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    if (maxX - minX <= availableWidth && maxY - minY <= availableHeight) {
      selectedZoom = candidateZoom
      selectedCenter = unproject((minX + maxX) / 2, (minY + maxY) / 2, candidateZoom)
      break
    }
  }

  zoom.value = clampZoom(selectedZoom)
  centerLatitude.value = selectedCenter.latitude
  centerLongitude.value = selectedCenter.longitude
}

function onMarkerClick(id: string) {
  emit('select-marker', id)
}

watch(
  () => [props.latitude, props.longitude] as const,
  ([latitude, longitude], previous) => {
    if (!validLatitude(latitude) || !validLongitude(longitude)) return
    const changed = latitude !== previous?.[0] || longitude !== previous?.[1]
    if (!changed) return
    centerLatitude.value = Number(latitude)
    centerLongitude.value = Number(longitude)
    zoom.value = clampZoom(Math.max(zoom.value, props.selectionZoom))
  },
)

watch(
  () => props.markers.map((marker) => `${marker.id}:${marker.latitude}:${marker.longitude}`).join('|'),
  () => {
    if (props.fitMarkers && !validLatitude(props.latitude) && !validLongitude(props.longitude)) {
      void fitAllMarkers()
    }
  },
)

onMounted(() => {
  const element = viewport.value
  if (element) {
    resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return
      width.value = Math.max(1, entry.contentRect.width)
      height.value = Math.max(1, entry.contentRect.height)
    })
    resizeObserver.observe(element)
  }

  if (props.fitMarkers && props.markers.length && !validLatitude(props.latitude)) {
    void fitAllMarkers()
  } else if (validLatitude(props.latitude) && validLongitude(props.longitude)) {
    centerOnSelection()
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div class="pricing-map-shell">
    <div class="pricing-map-toolbar">
      <p class="pricing-map-hint">
        {{ hint || (interactiveSelection ? 'Arrastre para mover y toque el mapa para seleccionar el punto.' : 'Arrastre para mover el mapa y seleccione un marcador.') }}
      </p>
      <div class="pricing-map-controls">
        <button type="button" class="pricing-map-control" aria-label="Alejar mapa" @click="changeZoom(-1)">
          <Minus class="h-4 w-4" />
        </button>
        <button type="button" class="pricing-map-control" aria-label="Acercar mapa" @click="changeZoom(1)">
          <Plus class="h-4 w-4" />
        </button>
        <button type="button" class="pricing-map-control" aria-label="Centrar selección" @click="centerOnSelection">
          <Crosshair class="h-4 w-4" />
        </button>
        <button v-if="markers.length > 1" type="button" class="pricing-map-control" aria-label="Ver todos los puntos" @click="fitAllMarkers">
          <ScanSearch class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div
      ref="viewport"
      class="pricing-map-viewport"
      :class="{ 'pricing-map-viewport--dragging': dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="finishPointer"
      @pointercancel="finishPointer"
    >
      <img
        v-for="tile in tiles"
        :key="tile.key"
        :src="tile.src"
        alt=""
        draggable="false"
        class="pricing-map-tile"
        :style="{ left: `${tile.left}px`, top: `${tile.top}px` }"
      />

      <button
        v-for="entry in markerPositions"
        :key="entry.marker.id"
        type="button"
        class="pricing-map-marker"
        :class="entry.marker.selected ? 'pricing-map-marker--selected' : ''"
        :style="{ left: `${entry.left}px`, top: `${entry.top}px` }"
        :title="entry.marker.label"
        :aria-label="`Seleccionar ${entry.marker.label}`"
        @pointerdown.stop
        @click.stop="onMarkerClick(entry.marker.id)"
      >
        <MapPin class="h-5 w-5" />
      </button>

      <div
        v-if="selectedPointPosition"
        class="pricing-map-selected-point"
        :style="{ left: `${selectedPointPosition.left}px`, top: `${selectedPointPosition.top}px` }"
        aria-hidden="true"
      >
        <MapPin class="h-6 w-6" />
      </div>

      <div v-if="interactiveSelection" class="pricing-map-crosshair" aria-hidden="true">
        <span />
      </div>

      <a
        class="pricing-map-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        @pointerdown.stop
        @click.stop
      >© OpenStreetMap</a>
    </div>
  </div>
</template>

<style scoped>
.pricing-map-shell {
  overflow: hidden;
  border: 1px solid var(--dh-border);
  border-radius: 20px;
  background: var(--dh-card);
}

.pricing-map-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--dh-border);
  background: color-mix(in srgb, var(--dh-card) 95%, transparent);
}

.pricing-map-hint {
  min-width: 0;
  font-size: 0.72rem;
  line-height: 1.35;
  font-weight: 750;
  color: var(--dh-text-muted);
}

.pricing-map-controls {
  display: flex;
  flex-shrink: 0;
  gap: 0.35rem;
}

.pricing-map-control {
  display: inline-flex;
  width: 2.75rem;
  height: 2.75rem;
  touch-action: manipulation;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--dh-border);
  border-radius: 14px;
  background: var(--dh-input);
  color: var(--dh-text);
  transition: 150ms ease;
}

.pricing-map-control:hover {
  border-color: rgb(var(--dh-primary-rgb) / 0.45);
  background: var(--dh-card-hover);
}

.pricing-map-viewport {
  position: relative;
  height: clamp(18rem, 42vw, 28rem);
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
  background: #d9e3ea;
}

.pricing-map-viewport--dragging {
  cursor: grabbing;
}

.pricing-map-tile {
  position: absolute;
  width: 256px;
  height: 256px;
  max-width: none;
  pointer-events: none;
  user-select: none;
}

.pricing-map-marker,
.pricing-map-selected-point {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, -100%);
  color: var(--dh-primary);
  filter: drop-shadow(0 3px 5px rgb(0 0 0 / 0.28));
}

.pricing-map-marker {
  display: inline-flex;
  width: 2.75rem;
  height: 2.75rem;
  touch-action: manipulation;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  border-radius: 999px;
  background: var(--dh-card);
  box-shadow: 0 6px 18px rgb(15 23 42 / 0.22);
}

.pricing-map-marker--selected {
  border-color: var(--dh-primary);
  background: rgb(var(--dh-primary-rgb) / 0.12);
}

.pricing-map-selected-point {
  pointer-events: none;
  z-index: 6;
}

.pricing-map-crosshair {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 3;
  width: 1.35rem;
  height: 1.35rem;
  transform: translate(-50%, -50%);
  pointer-events: none;
  border: 1px solid rgb(var(--dh-primary-rgb) / 0.25);
  border-radius: 999px;
}

.pricing-map-crosshair::before,
.pricing-map-crosshair::after,
.pricing-map-crosshair span::before,
.pricing-map-crosshair span::after {
  content: '';
  position: absolute;
  background: rgb(var(--dh-primary-rgb) / 0.55);
}

.pricing-map-crosshair::before,
.pricing-map-crosshair::after {
  left: 50%;
  width: 1px;
  height: 0.45rem;
}

.pricing-map-crosshair::before { top: -0.5rem; }
.pricing-map-crosshair::after { bottom: -0.5rem; }
.pricing-map-crosshair span::before,
.pricing-map-crosshair span::after {
  top: 50%;
  width: 0.45rem;
  height: 1px;
}
.pricing-map-crosshair span::before { left: -0.5rem; }
.pricing-map-crosshair span::after { right: -0.5rem; }

.pricing-map-attribution {
  position: absolute;
  right: 0.35rem;
  bottom: 0.35rem;
  z-index: 8;
  min-height: 1.8rem;
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
  background: rgb(255 255 255 / 0.86);
  padding: 0.15rem 0.4rem;
  font-size: 0.62rem;
  font-weight: 700;
  color: #334155;
}

@media (max-width: 640px) {
  .pricing-map-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .pricing-map-controls {
    width: 100%;
  }

  .pricing-map-control {
    flex: 1 1 0;
    min-width: 2.75rem;
  }

  .pricing-map-viewport {
    height: 20rem;
  }
}
</style>
