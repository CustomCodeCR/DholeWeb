<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Check, CheckCircle2, MapPin, Plane, Plus, Search, Ship, Truck } from 'lucide-vue-next'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'
import { useToastStore } from '@/core/stores/toastStore'

type RouteSlug = 'pol' | 'poe' | 'pod'
type TerminalType = 'CY' | 'SD' | 'APT'
type Country = { key: string; name: string; code: string }
type RouteSource = { item: CatalogItemDto; terminalType: TerminalType; country: Country }
type RouteCatalogDraft = {
  name: string
  slug: string
  description: string
  value: string
  metadataJson: string
}

const props = defineProps<{
  catalogSlug: RouteSlug
  modelValue: RouteCatalogDraft | null
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: RouteCatalogDraft | null] }>()
const toast = useToastStore()

const routeDescription = computed(() => ({
  pol: 'El lugar donde comienza el transporte.',
  poe: 'El puerto, aeropuerto o punto donde continúa la ruta.',
  pod: 'La ciudad o punto donde se entrega la carga.',
}[props.catalogSlug]))
const terminalOptions = computed(() => props.catalogSlug === 'pod'
  ? [{ value: 'SD' as const, label: 'Ciudad o destino terrestre', helper: 'Entrega final', icon: Truck }]
  : [
    { value: 'CY' as const, label: 'Puerto', helper: 'Transporte marítimo', icon: Ship },
    { value: 'SD' as const, label: 'Ciudad', helper: 'Transporte terrestre', icon: Truck },
    { value: 'APT' as const, label: 'Aeropuerto', helper: 'Transporte aéreo', icon: Plane },
  ])

const terminalType = ref<TerminalType>(props.catalogSlug === 'pod' ? 'SD' : 'CY')
const loading = ref(true)
const failedCatalogs = ref(false)
const allItems = ref<CatalogItemDto[]>([])
const search = ref('')
const visibleCount = ref(8)
const selectedSourceId = ref('')
const manual = ref(false)
const newLocationName = ref('')
const iataCode = ref('')
const countrySearch = ref('')
const countryPickerOpen = ref(false)
const selectedCountry = ref<Country | null>(null)

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function slugify(value: string): string {
  return normalize(value).replace(/\s+/g, '-')
}
function metaOf(item: CatalogItemDto): Record<string, unknown> {
  try {
    const result: unknown = JSON.parse(item.metadataJson || '{}')
    return result && typeof result === 'object' && !Array.isArray(result)
      ? result as Record<string, unknown> : {}
  } catch {
    return {}
  }
}
function terminalOf(item: CatalogItemDto): TerminalType {
  const meta = metaOf(item)
  const type = String(meta.terminalType || '').trim().toUpperCase()
  if (type === 'CY' || type === 'SD' || type === 'APT') return type
  const code = String(item.code || '').toUpperCase()
  if (code.startsWith('SD_') || code.includes('_SD_')) return 'SD'
  if (code.startsWith('APT_') || code.includes('_APT_')) return 'APT'
  return item.catalogGroupSlug === 'pod' ? 'SD' : 'CY'
}
function rawCountry(item: CatalogItemDto): { code: string; name: string } {
  const meta = metaOf(item)
  const countryCode = String(meta.countryCode || '').trim().toUpperCase()
  const code = /^[A-Z]{2}$/.test(countryCode) ? countryCode : ''
  const fullName = String(item.value || item.name)
  const suffix = fullName.includes(',') ? fullName.split(',').at(-1)?.trim() || '' : ''
  const rawName = String(meta.countryName || meta.country || suffix || '').trim()
    .replace(/\s*\([A-Z0-9]{2,6}\)\s*$/i, '')
  return { code, name: rawName }
}
function isoName(code: string): string {
  try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) || code }
  catch { return code }
}

const activeItems = computed(() => allItems.value.filter((item) => item.isActive))
const countryAliases = computed(() => {
  const known = new Map<string, string>()
  for (const item of activeItems.value) {
    const raw = rawCountry(item)
    if (!raw.code) continue
    for (const name of [raw.name, isoName(raw.code)]) {
      if (name) known.set(normalize(name), raw.code)
    }
  }
  // Algunas ubicaciones antiguas no tienen código ISO, pero sí el nombre del país.
  const commonAliases: Record<string, string> = {
    'usa': 'US', 'us': 'US', 'united states': 'US', 'estados unidos': 'US',
    'mexico': 'MX', 'panama': 'PA', 'costa rica': 'CR', 'china': 'CN',
    'espana': 'ES', 'spain': 'ES', 'brasil': 'BR', 'brazil': 'BR',
    'el salvador': 'SV', 'guatemala': 'GT', 'honduras': 'HN',
    'colombia': 'CO', 'nicaragua': 'NI', 'canada': 'CA',
  }
  for (const [alias, code] of Object.entries(commonAliases)) {
    if (!known.has(alias)) known.set(alias, code)
  }
  return known
})
function countryOf(item: CatalogItemDto): Country {
  const raw = rawCountry(item)
  const code = raw.code || countryAliases.value.get(normalize(raw.name)) || ''
  const name = code ? isoName(code) : raw.name
  return { code, name: name || 'Sin país identificado', key: code || normalize(name) }
}
const sourceLocations = computed<RouteSource[]>(() => activeItems.value
  .filter((item) => terminalOf(item) === terminalType.value)
  .map((item) => ({
    item, terminalType: terminalOf(item), country: countryOf(item),
  }))
  .filter((source) => source.country.name !== 'Sin país identificado'))

const countries = computed<Country[]>(() => {
  const byKey = new Map<string, Country>()
  for (const item of activeItems.value) {
    const candidate = countryOf(item)
    if (candidate.name === 'Sin país identificado') continue
    if (!byKey.has(candidate.key)) byKey.set(candidate.key, candidate)
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
})
const filteredCountries = computed(() => countries.value
  .filter((country) => !normalize(countrySearch.value)
    || normalize(country.name).includes(normalize(countrySearch.value))
    || normalize(country.code).includes(normalize(countrySearch.value)))
  .slice(0, 8))

const existingItems = computed(() => allItems.value.filter((item) =>
  item.catalogGroupSlug === props.catalogSlug))

function descriptionFor(type: TerminalType): string {
  return type === 'CY' ? 'Puerto marítimo de carga internacional - Container Yard (CY).'
    : type === 'APT' ? 'Aeropuerto APT para rutas aéreas de Pricing.'
      : 'Ubicación terrestre SD para Pricing.'
}
function transportModeFor(type: TerminalType): string {
  return type === 'CY' ? 'Maritime' : type === 'APT' ? 'Air' : 'Land'
}
function buildDraft(name: string, value: string, type: TerminalType,
  country: Country, source?: CatalogItemDto): RouteCatalogDraft {
  const original = source ? metaOf(source) : {}
  const prefix = type.toLowerCase()
  const sourceName = name.trim()
  const originalSlug = source?.slug?.trim() || slugify(sourceName)
  const code = String(original.iataCode || iataCode.value).trim().toUpperCase()
  const merged = {
    ...original,
    ...(country.code ? { countryCode: country.code } : {}),
    countryName: country.name,
    ...(type === 'APT' && /^[A-Z]{3}$/.test(code)
      ? { iataCode: code, airportName: original.airportName || sourceName } : {}),
    routeRole: props.catalogSlug.toUpperCase(),
    terminalType: type,
    transportMode: transportModeFor(type),
    pricingWorkflow: true,
  }
  return {
    name: sourceName,
    slug: prefix + '-' + slugify(originalSlug),
    description: source?.description || descriptionFor(type),
    value: value.trim() || sourceName,
    metadataJson: JSON.stringify(merged),
  }
}
function alreadyExists(draft: RouteCatalogDraft): boolean {
  const other = JSON.parse(draft.metadataJson) as Record<string, unknown>
  const code = normalize(other.countryCode)
  const iata = normalize(other.iataCode)
  return existingItems.value.some((item) => {
    if (terminalOf(item) !== terminalType.value) return false
    const meta = metaOf(item)
    const otherCountry = countryOf(item)
    const samePlace = normalize(item.name) === normalize(draft.name)
      || normalize(item.value) === normalize(draft.value)
      || normalize(item.slug) === normalize(draft.slug)
      || (terminalType.value === 'APT' && Boolean(iata) && normalize(meta.iataCode) === iata)
    return samePlace && (!code || !otherCountry.code || code === normalize(otherCountry.code))
  })
}
function fromSource(source: RouteSource): RouteCatalogDraft {
  return buildDraft(source.item.name, source.item.value || source.item.name,
    source.terminalType, source.country, source.item)
}
function sourceKey(source: RouteSource): string {
  const meta = metaOf(source.item)
  return source.country.key + ':' + normalize(source.item.name)
    + ':' + normalize(meta.iataCode || '')
}
const searchResults = computed(() => {
  const query = normalize(search.value)
  const unique = new Map<string, RouteSource>()
  for (const source of sourceLocations.value) {
    const key = sourceKey(source)
    const haystack = normalize([
      source.item.name, source.item.value, source.item.slug, source.item.code,
      source.country.name, source.country.code,
      metaOf(source.item).iataCode, metaOf(source.item).city,
      metaOf(source.item).airportName,
    ].join(' '))
    if (query && !haystack.includes(query)) continue
    if (unique.has(key)) continue
    unique.set(key, source)
  }
  const values = [...unique.values()].sort((a, b) =>
    Number(alreadyExists(fromSource(a))) - Number(alreadyExists(fromSource(b)))
    || a.item.name.localeCompare(b.item.name, 'es'))
  // Sin búsqueda, priorizar sugerencias que todavía se pueden agregar.
  return query ? values : values.filter((source) => !alreadyExists(fromSource(source)))
})
const visibleLocations = computed(() => searchResults.value.slice(0, visibleCount.value))
const selectedSource = computed(() => sourceLocations.value.find(
  (source) => source.item.id === selectedSourceId.value))

const manualCountry = computed(() => selectedCountry.value)
const draft = computed<RouteCatalogDraft | null>(() => {
  if (!manual.value) {
    return selectedSource.value ? fromSource(selectedSource.value) : null
  }
  const name = newLocationName.value.trim()
  const chosenCountry = manualCountry.value
  if (!name || !chosenCountry) return null
  if (terminalType.value === 'APT' && !/^[A-Z]{3}$/.test(iataCode.value.trim().toUpperCase())) return null
  const display = normalize(name).includes(normalize(chosenCountry.name))
    ? name : name + ', ' + chosenCountry.name
  return buildDraft(display, display, terminalType.value, chosenCountry)
})
const duplicate = computed(() => draft.value !== null && alreadyExists(draft.value))
const canAdd = computed(() => draft.value !== null && !duplicate.value)
const selectedLabel = computed(() => manual.value
  ? draft.value?.name || '' : selectedSource.value?.item.name || '')

function chooseType(type: TerminalType) {
  if (props.disabled) return
  terminalType.value = type
  selectedSourceId.value = ''
  visibleCount.value = 8
  search.value = ''
  manual.value = false
  selectedCountry.value = null
  countrySearch.value = ''
  newLocationName.value = ''
  iataCode.value = ''
}
function chooseLocation(id: string) {
  if (props.disabled) return
  selectedSourceId.value = id
}
function openManual() {
  if (props.disabled) return
  manual.value = true
  newLocationName.value = search.value.trim()
  selectedSourceId.value = ''
  countrySearch.value = ''
  selectedCountry.value = null
  countryPickerOpen.value = false
}
function backToSearch() {
  manual.value = false
  selectedSourceId.value = ''
  countryPickerOpen.value = false
}
function countryInput(value: string) {
  countrySearch.value = value
  selectedCountry.value = null
  countryPickerOpen.value = true
}
function chooseCountry(country: Country) {
  selectedCountry.value = country
  countrySearch.value = country.name
  countryPickerOpen.value = false
}
function chooseCustomCountry() {
  const name = countrySearch.value.trim()
  if (name.length < 2) return
  chooseCountry({ name, key: normalize(name), code: countryAliases.value.get(normalize(name)) || '' })
}
function shortName(item: CatalogItemDto, country: Country) {
  const name = item.name.trim()
  const parts = name.split(',')
  if (parts.length > 1 && normalize(parts[parts.length - 1]) === normalize(country.name)) {
    return parts.slice(0, -1).join(',').trim()
  }
  return name
}
watch([draft, duplicate], () => emit('update:modelValue', canAdd.value ? draft.value : null), { immediate: true })
watch(search, () => {
  visibleCount.value = 8
  selectedSourceId.value = ''
})

onMounted(async () => {
  const slugs: RouteSlug[] = ['pol', 'poe', 'pod']
  try {
    const results = await Promise.allSettled(slugs.map((slug) =>
      CatalogItemsService.getByGroupSlug(slug)))
    failedCatalogs.value = results.some((result) => result.status === 'rejected')
    allItems.value = results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [])
    if (failedCatalogs.value) {
      toast.warning('Ubicaciones parcialmente disponibles',
        'No se pudieron cargar todos los catálogos. Puede agregar un lugar nuevo.')
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="space-y-8 pb-2">
    <header class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-5 sm:px-6">
      <p class="text-base font-black text-[var(--dh-text)]">¿Qué lugar desea agregar?</p>
      <p class="mt-2 text-sm font-medium leading-5 text-[var(--dh-text-muted)]">{{ routeDescription }}</p>
      <p class="mt-3 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
        Solo debe elegir el lugar. Dhole se encarga de los códigos y demás datos.
      </p>
    </header>

    <div class="space-y-4">
      <p class="text-sm font-black text-[var(--dh-text)]">
        {{ catalogSlug === 'pod' ? 'Tipo de destino' : '1. ¿Qué tipo de lugar es?' }}
      </p>
      <div class="grid gap-3" :class="terminalOptions.length === 1 ? 'grid-cols-1' : 'grid-cols-3'">
        <button v-for="option in terminalOptions" :key="option.value" type="button"
          :disabled="disabled"
          :aria-pressed="terminalType === option.value"
          class="flex min-h-[112px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-5 text-center transition disabled:opacity-50"
          :class="terminalType === option.value
            ? 'border-[var(--dh-primary)] bg-[var(--dh-primary-soft)] text-[var(--dh-text)]'
            : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text)] hover:border-[var(--dh-primary)]'"
          @click="chooseType(option.value)">
          <component :is="option.icon" class="h-6 w-6" :class="terminalType === option.value ? 'text-[var(--dh-primary)]' : 'text-[var(--dh-text-muted)]'" />
          <span class="text-sm font-black">{{ option.label }}</span>
          <span class="text-xs font-medium leading-4 text-[var(--dh-text-muted)]">{{ option.helper }}</span>
        </button>
      </div>
    </div>

    <div v-if="!manual" class="space-y-5">
      <label class="block">
        <span class="mb-3 block text-sm font-black text-[var(--dh-text)]">
          {{ catalogSlug === 'pod' ? '2. Busque el destino' : '2. Busque el lugar que necesita' }}
        </span>
        <div class="flex h-14 items-center gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 focus-within:border-[var(--dh-primary)]">
          <Search class="h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
          <input v-model="search" :disabled="disabled || loading"
            :placeholder="terminalType === 'APT' ? 'Ej. SJO, Miami, Bogotá…' : terminalType === 'CY' ? 'Ej. Moín, Shanghai, Manzanillo…' : 'Ej. San José, Ciudad de Guatemala…'"
            class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-muted)] disabled:opacity-50" />
          <button v-if="search" type="button" class="text-xs font-bold text-[var(--dh-text-muted)]"
            aria-label="Limpiar búsqueda" @click="search = ''">Limpiar</button>
        </div>
      </label>

      <div class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
        <div class="flex items-center justify-between gap-3 border-b border-[var(--dh-border)] px-4 py-3">
          <p class="text-xs font-bold text-[var(--dh-text)]">
            {{ search ? 'Resultados para su búsqueda' : 'Lugares disponibles para agregar' }}
          </p>
          <span class="text-[11px] font-semibold text-[var(--dh-text-muted)]">
            {{ loading ? 'Buscando…' : searchResults.length + ' lugares' }}
          </span>
        </div>
        <div v-if="loading" class="px-5 py-10 text-center text-xs text-[var(--dh-text-muted)]">Cargando ubicaciones…</div>
        <div v-else-if="!visibleLocations.length" class="px-5 py-10 text-center">
          <MapPin class="mx-auto h-6 w-6 text-[var(--dh-text-muted)]" />
          <p class="mt-2 text-sm font-bold text-[var(--dh-text)]">
            {{ search ? 'No encontramos ese lugar' : 'No hay lugares disponibles para agregar' }}
          </p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
            Puede crear uno nuevo con su nombre y país.
          </p>
        </div>
        <div v-else class="max-h-[310px] overflow-y-auto divide-y divide-[var(--dh-border)]">
          <button v-for="source in visibleLocations" :key="source.item.id" type="button"
            :disabled="disabled || alreadyExists(fromSource(source))"
            :aria-pressed="selectedSourceId === source.item.id"
            class="flex w-full items-center gap-4 px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
            :class="selectedSourceId === source.item.id
              ? 'bg-[var(--dh-primary-soft)]'
              : 'hover:bg-[var(--dh-input)]'"
            @click="chooseLocation(source.item.id)">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--dh-input)] text-[var(--dh-primary)]">
              <MapPin class="h-4 w-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-bold text-[var(--dh-text)]">
                {{ shortName(source.item, source.country) }}
              </span>
              <span class="block truncate text-xs text-[var(--dh-text-muted)]">
                {{ source.country.name }}
                <template v-if="terminalType === 'APT' && metaOf(source.item).iataCode">
                  · {{ metaOf(source.item).iataCode }}
                </template>
              </span>
            </span>
            <span v-if="alreadyExists(fromSource(source))" class="shrink-0 text-[10px] font-semibold text-[var(--dh-text-muted)]">Ya agregado</span>
            <span v-else-if="selectedSourceId === source.item.id" class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--dh-primary)] text-white">
              <Check class="h-4 w-4" />
            </span>
            <span v-else class="text-[11px] font-bold text-[var(--dh-primary)]">Elegir</span>
          </button>
        </div>
        <button v-if="searchResults.length > visibleLocations.length" type="button"
          class="w-full border-t border-[var(--dh-border)] px-4 py-3 text-center text-xs font-bold text-[var(--dh-primary)]"
          @click="visibleCount += 20">Mostrar más lugares</button>
      </div>

      <button type="button" :disabled="disabled" @click="openManual"
        class="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-4 text-sm font-bold text-[var(--dh-primary)] transition hover:border-[var(--dh-primary)] disabled:opacity-50">
        <Plus class="h-4 w-4" />
        ¿No aparece el lugar? Crear uno nuevo
      </button>
    </div>

    <div v-else class="space-y-5 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <button type="button" class="flex items-center gap-1 text-xs font-bold text-[var(--dh-primary)]"
        @click="backToSearch"><ArrowLeft class="h-4 w-4" /> Volver a buscar un lugar</button>
      <div>
        <p class="text-sm font-black text-[var(--dh-text)]">Crear un lugar nuevo</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Solo escriba el nombre y seleccione el país.</p>
      </div>
      <label class="block">
        <span class="mb-2 block text-xs font-black text-[var(--dh-text)]">
          {{ terminalType === 'APT' ? 'Nombre del aeropuerto' : terminalType === 'CY' ? 'Nombre del puerto' : 'Nombre de la ciudad o destino' }} *
        </span>
        <input v-model="newLocationName" :disabled="disabled" placeholder="Escriba el nombre del lugar"
          class="h-12 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-semibold text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]" />
      </label>
      <div class="relative">
        <label class="block">
          <span class="mb-2 block text-xs font-black text-[var(--dh-text)]">País *</span>
          <input :value="countrySearch" :disabled="disabled" autocomplete="off"
            placeholder="Escriba para buscar el país"
            class="h-12 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-semibold text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]"
            @input="countryInput(($event.target as HTMLInputElement).value)"
            @focus="countryPickerOpen = !selectedCountry" />
        </label>
        <div v-if="countryPickerOpen" class="mt-1 max-h-44 overflow-y-auto rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-1">
          <button v-for="option in filteredCountries" :key="option.key" type="button"
            class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-[var(--dh-text)] hover:bg-[var(--dh-input)]"
            @click="chooseCountry(option)">
            {{ option.name }} <span class="text-[var(--dh-text-muted)]">{{ option.code }}</span>
          </button>
          <button v-if="countrySearch.trim().length >= 2 && !countries.some(c => normalize(c.name) === normalize(countrySearch))"
            type="button" class="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-[var(--dh-primary)] hover:bg-[var(--dh-input)]"
            @click="chooseCustomCountry">Usar «{{ countrySearch.trim() }}» como país</button>
          <p v-if="!filteredCountries.length && countrySearch.trim().length < 2" class="px-3 py-2 text-xs text-[var(--dh-text-muted)]">Escriba el nombre del país.</p>
        </div>
        <p v-if="selectedCountry" class="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--dh-primary)]">
          <CheckCircle2 class="h-3.5 w-3.5" /> {{ selectedCountry.name }} seleccionado
        </p>
      </div>
      <label v-if="terminalType === 'APT'" class="block">
        <span class="mb-2 block text-xs font-black text-[var(--dh-text)]">Código del aeropuerto (IATA) *</span>
        <input v-model="iataCode" :disabled="disabled" maxlength="3" placeholder="Ej. SJO"
          class="h-12 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold uppercase text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]" />
        <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">Son las 3 letras que identifican el aeropuerto.</p>
      </label>
    </div>

    <p v-if="duplicate" role="alert" class="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs font-bold text-amber-600">
      Este lugar ya existe en el catálogo. No hace falta agregarlo otra vez.
    </p>
    <div v-else-if="canAdd" role="status" class="flex items-start gap-3 rounded-2xl border border-[var(--dh-primary)]/30 bg-[var(--dh-primary-soft)] p-4">
      <CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
      <div class="min-w-0">
        <p class="text-sm font-black text-[var(--dh-text)]">Listo para agregar</p>
        <p class="mt-0.5 text-sm font-semibold text-[var(--dh-text)]">{{ selectedLabel }}</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Presione «Agregar ubicación» para guardarlo.</p>
      </div>
    </div>
  </section>
</template>
