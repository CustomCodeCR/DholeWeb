<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'
import { useToastStore } from '@/core/stores/toastStore'

type RouteSlug = 'pol' | 'poe' | 'pod'
type TerminalType = 'CY' | 'SD' | 'APT'
type RouteSource = { item: CatalogItemDto; terminalType: TerminalType; country: Country }
type Country = { key: string; name: string; code: string }

interface RouteCatalogDraft {
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
const loading = ref(true)
const allItems = ref<CatalogItemDto[]>([])
const terminalType = ref<TerminalType>(props.catalogSlug === 'pod' ? 'SD' : 'CY')
const selectedCountry = ref('')
const selectedSourceId = ref('')
const search = ref('')
const manual = ref(false)
const placeName = ref('')
const airportCode = ref('')
const customCountryName = ref('')

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function slugify(value: string): string {
  return normalize(value).replace(/\s+/g, '-')
}

function metadata(item: CatalogItemDto): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(item.metadataJson || '{}')
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function locationType(item: CatalogItemDto): TerminalType {
  const meta = metadata(item)
  const configured = String(meta.terminalType ?? '').toUpperCase()
  if (configured === 'CY' || configured === 'SD' || configured === 'APT') return configured
  const code = String(item.code || '').toUpperCase()
  if (code.startsWith('SD_') || code.includes('_SD_')) return 'SD'
  if (code.startsWith('APT_') || code.includes('_APT_')) return 'APT'
  if (item.catalogGroupSlug === 'pod') return 'SD'
  return 'CY'
}

function countryOf(item: CatalogItemDto): Country {
  const meta = metadata(item)
  const code = String(meta.countryCode ?? '').trim().toUpperCase()
  const nameFromLabel = String(item.value || item.name).split(',').slice(-1)[0]?.trim() || ''
  const name = String(meta.countryName || meta.country || nameFromLabel || code || 'Sin país').trim()
  return { key: code || normalize(name), name, code: /^[A-Z]{2}$/.test(code) ? code : '' }
}

const sources = computed<RouteSource[]>(() => allItems.value
  .filter((item) => item.isActive)
  .map((item) => ({ item, terminalType: locationType(item), country: countryOf(item) })))

const countries = computed(() => {
  const values = new Map<string, Country>()
  for (const source of sources.value.filter((item) => item.terminalType === terminalType.value)) {
    const { country } = source
    if (!country.key || country.name === 'Sin país') continue
    const current = values.get(country.key)
    if (!current || (country.code && !current.code)) values.set(country.key, country)
  }
  return [...values.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
})

const country = computed<Country | null>(() => selectedCountry.value === '__other'
  ? customCountryName.value.trim()
    ? { key: '__other', name: customCountryName.value.trim(), code: '' } : null
  : countries.value.find((item) => item.key === selectedCountry.value) || null)

const existingItems = computed(() => allItems.value.filter((item) => item.catalogGroupSlug === props.catalogSlug))

function alreadyExists(draft: RouteCatalogDraft): boolean {
  const target = normalize(draft.name)
  const newMeta = JSON.parse(draft.metadataJson) as Record<string, unknown>
  const countryCode = normalize(newMeta.countryCode)
  return existingItems.value.some((item) => {
    if (locationType(item) !== terminalType.value) return false
    const otherMeta = metadata(item)
    const sameSlug = Boolean(draft.slug) && normalize(item.slug) === normalize(draft.slug)
    const sameName = normalize(item.name) === target || normalize(item.value) === normalize(draft.value)
    const iataCode = normalize(newMeta.iataCode)
    const sameAirport = terminalType.value === 'APT' && Boolean(iataCode)
      && normalize(otherMeta.iataCode) === iataCode
    if (!sameSlug && !sameName && !sameAirport) return false
    const existingCode = normalize(otherMeta.countryCode)
    return !existingCode || !countryCode || existingCode === countryCode
  })
}

const availableLocations = computed(() => {
  const countryKey = selectedCountry.value
  if (!countryKey || countryKey === '__other') return []
  const unique = new Map<string, RouteSource>()
  for (const source of sources.value) {
    if (source.terminalType !== terminalType.value || source.country.key !== countryKey) continue
    const key = normalize(source.item.name) + ':' + normalize(source.item.value)
    if (unique.has(key)) continue
    const draft = draftFromSource(source)
    if (!alreadyExists(draft)) unique.set(key, source)
  }
  return [...unique.values()].sort((a, b) => a.item.name.localeCompare(b.item.name, 'es'))
})

const matchingLocations = computed(() => {
  const query = normalize(search.value)
  return availableLocations.value.filter((source) => !query
    || normalize([source.item.name, source.item.value, source.item.code, source.item.slug,
      metadata(source.item).iataCode, metadata(source.item).city].join(' ')).includes(query))
})

const locationOptions = computed(() => matchingLocations.value.slice(0, 100))
const selectedSource = computed(() => sources.value.find((source) => source.item.id === selectedSourceId.value))

function draftFromSource(source: RouteSource): RouteCatalogDraft {
  const meta = metadata(source.item)
  const country = source.country
  return {
    name: source.item.name.trim(),
    slug: source.item.slug?.trim() || slugify(source.item.name),
    description: source.item.description || descriptionFor(source.terminalType),
    value: source.item.value?.trim() || source.item.name.trim(),
    metadataJson: JSON.stringify({
      ...meta,
      ...(country.code ? { countryCode: country.code } : {}),
      ...(country.name !== 'Sin país' ? { countryName: country.name } : {}),
      routeRole: props.catalogSlug.toUpperCase(),
      terminalType: source.terminalType,
      transportMode: transportModeFor(source.terminalType),
      pricingWorkflow: true,
    }),
  }
}

function transportModeFor(type: TerminalType) {
  return type === 'CY' ? 'Maritime' : type === 'APT' ? 'Air' : 'Land'
}

function descriptionFor(type: TerminalType) {
  return type === 'CY'
    ? 'Puerto marítimo de carga internacional - Container Yard (CY).'
    : type === 'APT' ? 'Aeropuerto APT para rutas aéreas de Pricing.'
      : 'Ubicación terrestre SD para Pricing.'
}

const draft = computed<RouteCatalogDraft | null>(() => {
  if (!country.value) return null
  if (!manual.value) {
    if (!selectedSource.value || selectedSource.value.terminalType !== terminalType.value
      || selectedSource.value.country.key !== selectedCountry.value) return null
    return draftFromSource(selectedSource.value)
  }
  const name = placeName.value.trim()
  const iata = airportCode.value.trim().toUpperCase()
  if (!name || (terminalType.value === 'APT' && !/^[A-Z]{3}$/.test(iata))) return null
  const displayName = normalize(name).includes(normalize(country.value.name))
    ? name : name + ', ' + country.value.name
  return {
    name: displayName,
    slug: slugify(displayName),
    description: descriptionFor(terminalType.value),
    value: displayName,
    metadataJson: JSON.stringify({
      ...(country.value.code ? { countryCode: country.value.code } : {}),
      countryName: country.value.name,
      ...(terminalType.value === 'APT' ? { iataCode: iata, airportName: name } : {}),
      routeRole: props.catalogSlug.toUpperCase(),
      terminalType: terminalType.value,
      transportMode: transportModeFor(terminalType.value),
      pricingWorkflow: true,
    }),
  }
})

const duplicate = computed(() => draft.value !== null && alreadyExists(draft.value))

watch(terminalType, () => {
  selectedCountry.value = ''
  selectedSourceId.value = ''
  manual.value = false
  search.value = ''
})
watch(selectedCountry, () => {
  selectedSourceId.value = ''
  search.value = ''
})
watch([draft, duplicate], () => {
  emit('update:modelValue', !duplicate.value ? draft.value : null)
}, { immediate: true })

onMounted(async () => {
  const slugs: RouteSlug[] = ['pol', 'poe', 'pod']
  try {
    const results = await Promise.allSettled(slugs.map((slug) => CatalogItemsService.getByGroupSlug(slug)))
    allItems.value = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    if (!allItems.value.length) {
      toast.warning('Catálogos no disponibles', 'No se pudieron consultar las ubicaciones. Puede crear una nueva manualmente.')
    }
  } catch {
    toast.warning('Catálogos no disponibles', 'Puede ingresar una ubicación nueva.')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="space-y-4 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
    <div>
      <h3 class="text-base font-black text-[var(--dh-text)]">Agregar ubicación a {{ catalogSlug.toUpperCase() }}</h3>
      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
        Seleccione el tipo, país y lugar. El código, nombre, valor y datos de Pricing se completan solos.
      </p>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">Tipo de ubicación *</span>
        <select v-model="terminalType" :disabled="disabled" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)]">
          <option value="CY" v-if="catalogSlug !== 'pod'">Puerto marítimo (CY)</option>
          <option value="SD">Ciudad / ubicación terrestre (SD)</option>
          <option value="APT" v-if="catalogSlug !== 'pod'">Aeropuerto (APT)</option>
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">País *</span>
        <select v-model="selectedCountry" :disabled="disabled || loading" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)]">
          <option value="">Seleccione un país</option>
          <option v-for="option in countries" :key="option.key" :value="option.key">{{ option.name }}</option>
          <option value="__other">Otro país (no aparece en la lista)</option>
        </select>
      </label>
    </div>

    <label v-if="selectedCountry === '__other'" class="block">
      <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">Nombre del país *</span>
      <input v-model="customCountryName" :disabled="disabled" placeholder="Ej. Costa Rica" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)]" />
    </label>

    <div v-if="country && !manual" class="space-y-3">
      <label class="block">
        <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">Buscar {{ terminalType === 'APT' ? 'aeropuerto o código IATA' : 'ciudad, puerto o ubicación' }}</span>
        <input v-model="search" :disabled="disabled" placeholder="Escriba para filtrar las ubicaciones disponibles" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)]" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">Ubicación *</span>
        <select v-model="selectedSourceId" :disabled="disabled || loading" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)]">
          <option value="">{{ loading ? 'Cargando lugares…' : 'Seleccione una ubicación' }}</option>
          <option v-for="source in locationOptions" :key="source.item.id" :value="source.item.id">
            {{ source.item.name }} {{ metadata(source.item).iataCode ? '(' + metadata(source.item).iataCode + ')' : '' }}
          </option>
        </select>
        <span class="mt-1 block text-xs text-[var(--dh-text-muted)]">
          {{ matchingLocations.length }} disponibles{{ matchingLocations.length > locationOptions.length ? ' · Escriba para encontrar más' : '' }}. Los lugares ya registrados en este catálogo no se duplican.
        </span>
      </label>
    </div>

    <button v-if="country" type="button" :disabled="disabled"
      class="text-left text-sm font-bold text-[var(--dh-primary)] disabled:opacity-50"
      @click="manual = !manual; selectedSourceId = ''">
      {{ manual ? 'Volver a elegir de la lista' : '¿El lugar no está en la lista? Agregar ubicación nueva' }}
    </button>

    <div v-if="country && manual" class="grid gap-3 md:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">Nombre {{ terminalType === 'APT' ? 'del aeropuerto' : 'de la ciudad o puerto' }} *</span>
        <input v-model="placeName" :disabled="disabled" placeholder="Ej. Manzanillo" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold text-[var(--dh-text)]" />
      </label>
      <label v-if="terminalType === 'APT'" class="block">
        <span class="mb-1 block text-xs font-black text-[var(--dh-text-muted)]">Código IATA (3 letras) *</span>
        <input v-model="airportCode" :disabled="disabled" maxlength="3" placeholder="Ej. SJO" class="h-11 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-bold uppercase text-[var(--dh-text)]" />
      </label>
    </div>

    <p v-if="duplicate" role="alert" class="rounded-xl border border-amber-500/40 p-3 text-xs font-bold text-amber-600">
      Este lugar ya está registrado en {{ catalogSlug.toUpperCase() }} para ese tipo de ubicación. No se creará un duplicado.
    </p>
    <div v-else-if="draft" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
      <p class="text-xs font-black text-[var(--dh-text-muted)]">Vista previa: listo para guardar</p>
      <p class="mt-1 text-sm font-black text-[var(--dh-text)]">{{ draft.name }}</p>
      <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
        {{ terminalType === 'CY' ? 'Marítimo' : terminalType === 'SD' ? 'Terrestre' : 'Aéreo' }}
        · {{ catalogSlug.toUpperCase() }} · Los datos técnicos se completarán automáticamente.
      </p>
    </div>
    <p v-else class="text-xs font-semibold text-[var(--dh-text-muted)]">Seleccione los campos obligatorios para continuar.</p>
  </section>
</template>
