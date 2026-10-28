<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCircle2, Plane, Ship, Truck } from 'lucide-vue-next'

type RouteSlug = 'pol' | 'poe' | 'pod'
type TerminalType = 'CY' | 'SD' | 'APT'
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

// Local ISO-3166 list: opening the drawer never requests POL, POE or POD catalogs.
// Intl.DisplayNames provides localized names from the browser, without an API call.
const ISO_COUNTRIES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN
BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI
GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA
MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG
NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU
RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH
TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE
YT ZA ZM ZW
`.trim().split(/\s+/)

const COMMON_COUNTRIES = ['CR', 'PA', 'US', 'MX', 'CN', 'SV', 'GT', 'HN', 'NI', 'CO']
const countryNames = new Intl.DisplayNames(['es'], { type: 'region' })
const countryName = (code: string) => countryNames.of(code) || code
const countryOptions = ISO_COUNTRIES
  .map((code) => ({ code, name: countryName(code) }))
  .sort((a, b) => {
    const first = COMMON_COUNTRIES.indexOf(a.code)
    const second = COMMON_COUNTRIES.indexOf(b.code)
    if (first !== -1 || second !== -1) {
      if (first === -1) return 1
      if (second === -1) return -1
      return first - second
    }
    return a.name.localeCompare(b.name, 'es')
  })

const routeDescription = computed(() => ({
  pol: 'Indique el lugar donde comienza el transporte.',
  poe: 'Indique el lugar por el que ingresa o continúa la ruta.',
  pod: 'Indique el lugar de entrega final.',
}[props.catalogSlug]))

const terminalOptions = computed(() => props.catalogSlug === 'pod'
  ? [{ value: 'SD' as const, label: 'Ciudad o destino terrestre', detail: 'Entrega final', icon: Truck }]
  : [
    { value: 'CY' as const, label: 'Puerto', detail: 'Marítimo', icon: Ship },
    { value: 'SD' as const, label: 'Ciudad', detail: 'Terrestre', icon: Truck },
    { value: 'APT' as const, label: 'Aeropuerto', detail: 'Aéreo', icon: Plane },
  ])

const terminalType = ref<TerminalType>(props.catalogSlug === 'pod' ? 'SD' : 'CY')
const locationName = ref('')
const countryCode = ref('')
const iataCode = ref('')

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const draft = computed<RouteCatalogDraft | null>(() => {
  const place = locationName.value.trim()
  const code = countryCode.value
  if (!place || !code) return null
  const country = countryName(code)
  const label = normalize(place).endsWith(normalize(country)) ? place : `${place}, ${country}`
  const modality = terminalType.value === 'CY' ? 'Maritime' : terminalType.value === 'APT' ? 'Air' : 'Land'
  const airportCode = iataCode.value.trim().toUpperCase()
  const metadata: Record<string, unknown> = {
    routeRole: props.catalogSlug.toUpperCase(),
    terminalType: terminalType.value,
    transportMode: modality,
    pricingWorkflow: true,
    countryCode: code,
    countryName: country,
  }
  if (terminalType.value === 'APT') {
    metadata.airportName = place
    if (/^[A-Z]{3}$/.test(airportCode)) metadata.iataCode = airportCode
  }
  if (terminalType.value === 'SD') metadata.city = place

  return {
    name: label,
    slug: `${terminalType.value.toLowerCase()}-${normalize(place)}-${code.toLowerCase()}`,
    description: terminalType.value === 'CY'
      ? 'Puerto marítimo de carga internacional - Container Yard (CY).'
      : terminalType.value === 'APT' ? 'Aeropuerto APT para rutas aéreas de Pricing.'
        : 'Ubicación terrestre SD para Pricing.',
    value: label,
    metadataJson: JSON.stringify(metadata),
  }
})

watch(draft, (value) => emit('update:modelValue', value), { immediate: true })
</script>

<template>
  <section class="space-y-8 pb-2">
    <header class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-5 sm:px-6">
      <p class="text-base font-black text-[var(--dh-text)]">Agregar ubicación</p>
      <p class="mt-2 text-sm font-medium leading-5 text-[var(--dh-text-muted)]">{{ routeDescription }}</p>
      <p class="mt-3 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
        Escriba los datos y guarde. No tiene que buscar ni esperar a que carguen puertos.
      </p>
    </header>

    <div class="space-y-4">
      <p class="text-sm font-black text-[var(--dh-text)]">1. ¿Qué tipo de lugar es?</p>
      <div class="grid gap-3" :class="terminalOptions.length === 1 ? 'grid-cols-1' : 'grid-cols-3'">
        <button
          v-for="option in terminalOptions"
          :key="option.value"
          type="button"
          :disabled="disabled"
          :aria-pressed="terminalType === option.value"
          class="flex min-h-[106px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center transition disabled:opacity-50"
          :class="terminalType === option.value
            ? 'border-[var(--dh-primary)] bg-[var(--dh-primary-soft)] text-[var(--dh-text)]'
            : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text)] hover:border-[var(--dh-primary)]'"
          @click="terminalType = option.value"
        >
          <component :is="option.icon" class="h-6 w-6" :class="terminalType === option.value ? 'text-[var(--dh-primary)]' : 'text-[var(--dh-text-muted)]'" />
          <span class="text-sm font-black">{{ option.label }}</span>
          <span class="text-xs font-medium text-[var(--dh-text-muted)]">{{ option.detail }}</span>
        </button>
      </div>
    </div>

    <div class="space-y-5">
      <p class="text-sm font-black text-[var(--dh-text)]">2. Ingrese los datos del lugar</p>
      <label class="block">
        <span class="mb-2 block text-xs font-bold text-[var(--dh-text)]">
          {{ terminalType === 'CY' ? 'Nombre del puerto' : terminalType === 'APT' ? 'Nombre del aeropuerto' : 'Nombre de la ciudad o ubicación' }} *
        </span>
        <input
          v-model="locationName"
          :disabled="disabled"
          autocomplete="off"
          :placeholder="terminalType === 'CY' ? 'Ej. Puerto Moín' : terminalType === 'APT' ? 'Ej. Juan Santamaría' : 'Ej. San José'"
          class="h-12 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 text-sm font-semibold text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)] disabled:opacity-50"
        />
      </label>
      <label class="block">
        <span class="mb-2 block text-xs font-bold text-[var(--dh-text)]">País *</span>
        <select
          v-model="countryCode"
          :disabled="disabled"
          class="h-12 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 text-sm font-semibold text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)] disabled:opacity-50"
        >
          <option value="">Seleccione el país</option>
          <option v-for="country in countryOptions" :key="country.code" :value="country.code">{{ country.name }}</option>
        </select>
      </label>
      <label v-if="terminalType === 'APT'" class="block">
        <span class="mb-2 block text-xs font-bold text-[var(--dh-text)]">Código IATA (opcional)</span>
        <input
          v-model="iataCode"
          :disabled="disabled"
          maxlength="3"
          placeholder="Ej. SJO"
          class="h-12 w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 text-sm font-bold uppercase text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)] disabled:opacity-50"
        />
        <p class="mt-2 text-xs font-medium text-[var(--dh-text-muted)]">
          Si conoce el código de tres letras, puede indicarlo. No hace falta para crear el lugar.
        </p>
      </label>
    </div>

    <div v-if="draft" role="status" class="flex items-start gap-3 rounded-2xl border border-[var(--dh-primary)]/30 bg-[var(--dh-primary-soft)] p-4">
      <CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
      <div>
        <p class="text-sm font-black text-[var(--dh-text)]">Listo para agregar</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text)]">{{ draft.name }}</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Presione «Agregar ubicación» para guardarlo.</p>
      </div>
    </div>
  </section>
</template>
