from pathlib import Path


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


map_path = Path("src/modules/pricing/components/PricingInteractiveOsmMap.vue")
map_text = map_path.read_text(encoding="utf-8-sig")
map_text = once(
    map_text,
    "export interface PricingMapMarker {",
    "interface PricingMapMarker {",
    "map interface export",
)
map_path.write_text(map_text, encoding="utf-8")

wizard_path = Path("src/modules/pricing/components/PricingAlternativeWizardCrystal.vue")
text = wizard_path.read_text(encoding="utf-8-sig")

text = once(
    text,
    "  Search,\n  Ship,\n  Truck,",
    "  Search,\n  Ship,\n  Sparkles,\n  Truck,",
    "Sparkles icon import",
)
text = once(
    text,
    "import PricingCrystalMultiSelect from '@/modules/pricing/components/PricingCrystalMultiSelect.vue'\n",
    "import PricingCrystalMultiSelect from '@/modules/pricing/components/PricingCrystalMultiSelect.vue'\n"
    "import PricingInteractiveOsmMap from '@/modules/pricing/components/PricingInteractiveOsmMap.vue'\n",
    "interactive map component import",
)

location_start = text.index("const collectionMapUrl = computed(() => {")
location_end = text.index("const selectedServices = computed", location_start)
location_block = """const warehouseMapMarkers = computed(() =>
  catalogs.warehouses.flatMap((warehouse) => {
    let latitude = metadataNumber(warehouse, 'latitude', 'lat')
    let longitude = metadataNumber(warehouse, 'longitude', 'lng')

    if (warehouse.id === form.warehouseId) {
      latitude ??= form.pickupLatitude
      longitude ??= form.pickupLongitude
    }

    if (latitude == null || longitude == null) return []
    return [{
      id: warehouse.id,
      label: warehouse.label || displayValue(warehouse) || warehouse.code,
      latitude,
      longitude,
      selected: warehouse.id === form.warehouseId,
    }]
  }),
)
const exwLocationReady = computed(() =>
  selectedIncotermCode.value !== 'EXW' ||
  Boolean(form.pickupAddress.trim() && pickupCoordinates.value),
)
const fcaLocationReady = computed(() =>
  selectedIncotermCode.value !== 'FCA' ||
  (catalogs.warehouses.length
    ? Boolean(form.warehouseId)
    : Boolean(form.pickupAddress.trim() && pickupCoordinates.value)),
)
"""
text = text[:location_start] + location_block + text[location_end:]

parse_anchor = "function parseNearestPortResponse(content: string) {"
parse_index = text.index(parse_anchor)
helpers = """async function reverseGeocodePickup(latitude: number, longitude: number) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    { headers: { Accept: 'application/json', 'Accept-Language': 'es' } },
  )
  if (!response.ok) throw new Error(`Nominatim ${response.status}`)
  const location = await response.json() as { display_name?: string }
  return location.display_name?.trim() || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

async function selectPickupFromMap(point: { latitude: number; longitude: number }) {
  form.pickupLatitude = point.latitude
  form.pickupLongitude = point.longitude
  nearestPortRecommendations.value = []

  try {
    locatingPickup.value = true
    form.pickupAddress = await reverseGeocodePickup(point.latitude, point.longitude)
  } catch {
    form.pickupAddress = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`
  } finally {
    locatingPickup.value = false
  }

  if (selectedIncotermCode.value === 'EXW') await recommendNearestPorts()
}

function selectWarehouseFromMap(warehouseId: string) {
  if (catalogs.warehouses.some((warehouse) => warehouse.id === warehouseId)) {
    form.warehouseId = warehouseId
  }
}

"""
text = text[:parse_index] + helpers + text[parse_index:]

current_start = text.index("async function useCurrentLocation() {")
current_end = text.index("function selectRecommendedPort", current_start)
current_function = """async function useCurrentLocation() {
  if (!navigator.geolocation) {
    toastStore.warning('Ubicación no disponible', 'El navegador no permite obtener la ubicación actual.')
    return
  }

  try {
    locatingPickup.value = true
    const position = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }),
    )
    await selectPickupFromMap({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo obtener la ubicación actual.')
  } finally {
    locatingPickup.value = false
  }
}

"""
text = text[:current_start] + current_function + text[current_end:]

exw_section = text.index(
    "<div v-if=\"selectedIncotermCode === 'EXW' || selectedIncotermCode === 'FCA'\""
)
map_start_marker = (
    '            <div class="overflow-hidden rounded-[20px] border '
    'border-[var(--dh-border)] bg-[var(--dh-card)]">'
)
map_start = text.index(map_start_marker, exw_section)
coords_start = text.index('            <p v-if="pickupCoordinates"', map_start)
interactive_map = """            <PricingInteractiveOsmMap
              v-if="selectedIncotermCode === 'EXW'"
              :latitude="form.pickupLatitude"
              :longitude="form.pickupLongitude"
              :interactive-selection="true"
              :initial-zoom="11"
              :selection-zoom="13"
              hint="Arrastre para explorar y toque el mapa para fijar el punto exacto de recolección."
              @select-point="selectPickupFromMap"
            />
            <PricingInteractiveOsmMap
              v-else
              :latitude="form.pickupLatitude"
              :longitude="form.pickupLongitude"
              :markers="warehouseMapMarkers"
              :interactive-selection="false"
              :fit-markers="true"
              :initial-zoom="3"
              :selection-zoom="10"
              hint="Los marcadores corresponden a los WHS globales configurados en Dhole. Toque uno para seleccionarlo."
              @select-marker="selectWarehouseFromMap"
            />
            <p
              v-if="selectedIncotermCode === 'FCA' && warehouseOptions.length > warehouseMapMarkers.length"
              class="text-[11px] font-bold text-amber-600"
            >
              Algunos WHS todavía no tienen coordenadas configuradas; siguen disponibles en la lista y se ubican al seleccionarlos.
            </p>
"""
text = text[:map_start] + interactive_map + text[coords_start:]

old_header = """.crystal-lines-header {
  position: sticky;
  top: 0.5rem;
  z-index: 20;
  border: 1px solid var(--dh-border);
  border-radius: 20px;
  padding: 0.8rem;
  background: color-mix(in srgb, var(--dh-card) 94%, transparent);
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: blur(22px);
}"""
new_header = """.crystal-lines-header {
  position: sticky;
  top: 6.25rem;
  z-index: 25;
  border: 1px solid var(--dh-border);
  border-radius: 20px;
  padding: 0.8rem;
  background: color-mix(in srgb, var(--dh-card) 97%, transparent);
  box-shadow: var(--dh-shadow-md);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}"""
text = once(text, old_header, new_header, "screen 7 sticky totals")

old_mobile = """  .crystal-lines-header {
    top: 0.25rem;
  }
  .crystal-panel {"""
new_mobile = """  .crystal-lines-header {
    top: 5rem;
    gap: 0.5rem;
    padding: 0.65rem;
  }

  .crystal-lines-header .crystal-kicker,
  .crystal-lines-header .crystal-description {
    display: none;
  }

  .crystal-lines-header .crystal-title {
    margin-top: 0;
    font-size: 1rem;
  }

  .crystal-lines-header .crystal-total-card {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
    padding: 0.4rem;
  }

  .crystal-lines-header .crystal-total-card__metric {
    min-width: 0;
    justify-content: space-between;
    border-radius: 12px;
    padding: 0.4rem 0.5rem;
  }

  .crystal-panel {"""
text = once(text, old_mobile, new_mobile, "mobile sticky totals")
wizard_path.write_text(text, encoding="utf-8")

sidebar_path = Path("src/shared/components/organisms/DhSidebar.vue")
sidebar = sidebar_path.read_text(encoding="utf-8-sig")
sidebar = once(
    sidebar,
    'class="rounded-2xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)] lg:hidden"',
    'class="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-2xl p-2 text-[var(--dh-text-muted)] transition hover:bg-[var(--dh-card-hover)] hover:text-[var(--dh-text)] lg:hidden"',
    "mobile sidebar close button",
)
old_link = 'class="flex items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]"'
if sidebar.count(old_link) != 2:
    raise SystemExit(f"sidebar links: expected 2 occurrences, found {sidebar.count(old_link)}")
sidebar = sidebar.replace(
    old_link,
    'class="flex min-h-11 touch-manipulation items-center rounded-[20px] px-3 py-2.5 text-sm font-black text-[var(--dh-text-soft)] transition hover:bg-[var(--dh-card-hover)]"',
)
sidebar_path.write_text(sidebar, encoding="utf-8")
