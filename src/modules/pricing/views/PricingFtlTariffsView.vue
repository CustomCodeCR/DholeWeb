<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Download, Pencil, RefreshCw, Truck, Upload } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhCrudToolbar, DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import {
  FtlTariffService,
  type CreateLandTariffItem,
  type FtlTariffDto,
  type LandCommercialProfile,
  type LandShipmentMode,
} from '@/core/services/ftlTariffService'
import PricingFtlTariffFormDrawer from '@/modules/pricing/components/PricingFtlTariffFormDrawer.vue'
import PricingMultiSelect from '@/modules/pricing/components/PricingMultiSelect.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { formatMoney } from '@/modules/pricing/utils/pricingFormat'

const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()
const rows = ref<FtlTariffDto[]>([])
const loading = ref(false)
const importing = ref(false)
const seedingDefaults = ref(false)
const selectedLtlMatrixProfile = ref<'FinalClient' | 'Nvocc'>('FinalClient')
const filtersOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const page = ref(1)
const pageSize = ref(10)
const filters = reactive({
  search: '',
  shipmentMode: [] as string[],
  commercialProfile: [] as string[],
  equipmentClasses: [] as string[],
  active: [] as string[],
})
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.costs.update))

const columns: DhTableColumn<FtlTariffDto>[] = [
  { key: 'route', label: 'Ruta' },
  { key: 'shipmentMode', label: 'Tipo' },
  { key: 'equipment', label: 'Equipos / contenedores' },
  { key: 'transitDays', label: 'Tránsito', align: 'center' },
  { key: 'priceAmount', label: 'Tarifa', align: 'right' },
  { key: 'minimumAmount', label: 'Mínimo', align: 'right' },
  { key: 'validity', label: 'Vigencia' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right', width: '72px' },
]
const modeFilterOptions = [
  { label: 'Completo · FTL', value: 'Ftl' },
  { label: 'Consolidado · LTL', value: 'Ltl' },
]
const profileFilterOptions = [
  { label: 'Cliente final', value: 'FinalClient' },
  { label: 'NVOCC', value: 'Nvocc' },
]
const activeOptions = [
  { label: 'Activas', value: 'true' },
  { label: 'Inactivas', value: 'false' },
]
function equipmentCatalogKey(item: { id: string; code: string; value: string; slug: string }) {
  return String(item.code || item.value || item.slug || item.id).trim()
}
const equipmentFilterOptions = computed(() =>
  catalogs.landEquipmentSizes.value.map((item) => ({
    label: item.name,
    value: equipmentCatalogKey(item).toUpperCase(),
  })),
)

function applicableClasses(row: FtlTariffDto) {
  const values = row.applicableEquipmentClasses?.length
    ? row.applicableEquipmentClasses
    : row.equipmentClass ? [row.equipmentClass] : []
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))]
}
function equipmentClassLabel(value: string) {
  if (value === 'LTL_CBM') return 'Consolidado'
  const target = value.trim().toUpperCase()
  const item = catalogs.landEquipmentSizes.value.find(
    (candidate) => equipmentCatalogKey(candidate).toUpperCase() === target,
  )
  return item?.name || value
}
function profileLabel(value: string) {
  if (value === 'Nvocc') return 'NVOCC'
  if (value === 'FinalClient') return 'Cliente final'
  return value
}
function searchable(row: FtlTariffDto) {
  return [
    row.originName, row.originCode, row.destinationName, row.destinationCode,
    row.shipmentMode, row.commercialProfile, row.source, row.notes, ...applicableClasses(row),
  ].filter(Boolean).join(' ').toLocaleLowerCase()
}

const filteredRows = computed(() => {
  const search = filters.search.trim().toLocaleLowerCase()
  return rows.value.filter((row) => {
    if (search && !searchable(row).includes(search)) return false
    if (filters.shipmentMode.length && !filters.shipmentMode.includes(row.shipmentMode)) return false
    if (filters.commercialProfile.length && !filters.commercialProfile.includes(row.commercialProfile)) return false
    if (filters.equipmentClasses.length && !filters.equipmentClasses.some((value) => applicableClasses(row).includes(value))) return false
    if (filters.active.length && !filters.active.includes(String(Boolean(row.isActive)))) return false
    return true
  })
})
const total = computed(() => filteredRows.value.length)
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

const ltlMatrixRows = computed(() =>
  rows.value.filter(
    (row) =>
      row.shipmentMode === 'Ltl' &&
      row.commercialProfile === selectedLtlMatrixProfile.value,
  ),
)
const ltlMatrixOrigins = computed(() =>
  [...new Set(ltlMatrixRows.value.map((row) => row.originName))]
    .sort((a, b) => a.localeCompare(b, 'es')),
)
const ltlMatrixDestinations = computed(() =>
  [...new Set(ltlMatrixRows.value.map((row) => row.destinationName))]
    .sort((a, b) => a.localeCompare(b, 'es')),
)

function ltlMatrixTariff(originName: string, destinationName: string) {
  return ltlMatrixRows.value.find(
    (row) =>
      row.originName === originName &&
      row.destinationName === destinationName,
  )
}

watch(() => [filters.search, filters.shipmentMode, filters.commercialProfile, filters.equipmentClasses, filters.active], () => {
  page.value = 1
}, { deep: true })
watch(pageSize, () => { page.value = 1 })

async function load() {
  loading.value = true
  try {
    rows.value = await FtlTariffService.browse()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el tarifario terrestre.')
  } finally {
    loading.value = false
  }
}
function openForm(tariff?: FtlTariffDto) {
  drawerStore.open({
    title: tariff ? 'Editar tarifa terrestre' : 'Nueva tarifa terrestre',
    component: PricingFtlTariffFormDrawer,
    size: 'lg',
    props: { tariff, onSaved: load },
  })
}
function clearFilters() {
  Object.assign(filters, { search: '', shipmentMode: [], commercialProfile: [], equipmentClasses: [], active: [] })
  page.value = 1
}
async function seedDefaults() {
  if (!canUpdate.value || seedingDefaults.value) return
  seedingDefaults.value = true
  try {
    const result = await FtlTariffService.seedDefaults()
    toastStore.success(
      'Matriz LTL verificada',
      result.ltlFinalClient + ' tarifas Cliente final y ' + result.ltlNvocc + ' tarifas NVOCC disponibles. FTL permanece para carga manual.',
    )
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo verificar la matriz LTL GCF.')
  } finally {
    seedingDefaults.value = false
  }
}

function currencyByCode(code?: string | null) {
  const target = String(code || 'USD').trim().toUpperCase()
  return catalogs.currencies.value.find((item) =>
    [item.code, item.value, item.name].some((value) => String(value).trim().toUpperCase() === target),
  ) || catalogs.currencies.value[0]
}
function currencyDisplayValue(row: Pick<FtlTariffDto, 'currencyId' | 'currencyName' | 'currencyCode'>) {
  const catalogCurrency = catalogs.currencies.value.find((item) => item.id === row.currencyId)
  const catalogValue = String(catalogCurrency?.value || '').trim()
  if (catalogValue) return /^[a-z]{3}$/i.test(catalogValue) ? catalogValue.toUpperCase() : catalogValue

  const fallbackIso = [row.currencyName, row.currencyCode]
    .map((value) => String(value || '').trim())
    .find((value) => /^[a-z]{3}$/i.test(value))
  if (fallbackIso) return fallbackIso.toUpperCase()

  return String(row.currencyName || row.currencyCode || 'USD').trim() || 'USD'
}
function parsedMode(value: unknown): LandShipmentMode {
  return String(value || '').trim().toLowerCase() === 'ltl' ? 'Ltl' : 'Ftl'
}
function parsedProfile(value: unknown, mode: LandShipmentMode): LandCommercialProfile {
  if (mode === 'Ftl') return 'General'
  const normalized = String(value || '').trim().toLowerCase()
  return normalized.includes('nvocc') || normalized === 'nvo' ? 'Nvocc' : 'FinalClient'
}
function parseEquipmentClasses(value: unknown, mode: LandShipmentMode) {
  if (mode === 'Ltl') return ['LTL_CBM']
  const values = Array.isArray(value) ? value : String(value || '').split(/[|;,]+/)
  const normalized = values.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
  return [...new Set(normalized)]
}
function importItem(input: Record<string, unknown>): CreateLandTariffItem | null {
  const mode = parsedMode(input.shipmentMode ?? input.modalidad ?? input.mode)
  const profile = parsedProfile(input.commercialProfile ?? input.perfil ?? input.profile, mode)
  const originName = String(input.origin ?? input.origen ?? input.originName ?? '').trim()
  const destinationName = String(input.destination ?? input.destino ?? input.destinationName ?? '').trim()
  const priceAmount = Number(input.price ?? input.precio ?? input.priceAmount ?? input.tarifa)
  const minimumRaw = input.minimum ?? input.minimo ?? input.minimumAmount
  const transitRaw = input.transitDays ?? input.diasTransito ?? input.transito
  const minimumAmount = minimumRaw == null || String(minimumRaw).trim() === '' ? null : Number(minimumRaw)
  const transitDays = transitRaw == null || String(transitRaw).trim() === '' ? null : Number(transitRaw)
  const currency = currencyByCode(String(input.currency ?? input.moneda ?? input.currencyCode ?? 'USD'))
  const classes = parseEquipmentClasses(input.applicableEquipmentClasses ?? input.equipmentClasses ?? input.equipmentClass ?? input.equipo, mode)
  if (
    !originName || !destinationName || !currency || !Number.isFinite(priceAmount) || priceAmount < 0 ||
    (minimumAmount != null && (!Number.isFinite(minimumAmount) || minimumAmount < 0)) ||
    (transitDays != null && (!Number.isInteger(transitDays) || transitDays < 0))
  ) return null

  return {
    originId: null,
    originName,
    originCode: String(input.originCode ?? input.codigoOrigen ?? '').trim() || null,
    destinationId: null,
    destinationName,
    destinationCode: String(input.destinationCode ?? input.codigoDestino ?? '').trim() || null,
    shipmentMode: mode,
    commercialProfile: profile,
    equipmentClass: classes[0]!,
    equipmentLabel: mode === 'Ltl' ? 'LTL · Consolidado' : classes.map(equipmentClassLabel).join(' + '),
    applicableEquipmentClasses: classes,
    currencyId: currency.id,
    currencyName: currency.name,
    currencyCode: currency.value || currency.code || currency.name,
    priceAmount,
    rateBasis: mode === 'Ltl' ? 'PerCbm' : 'PerTruck',
    minimumAmount,
    transitDays,
    warehouseName: String(input.warehouse ?? input.almacen ?? input.warehouseName ?? '').trim() || null,
    source: String(input.source ?? input.fuente ?? '').trim() || null,
    notes: String(input.notes ?? input.notas ?? input.comentarios ?? '').trim() || null,
    validFrom: String(input.validFrom ?? input.vigenciaDesde ?? '').trim() || null,
    validTo: String(input.validTo ?? input.vigenciaHasta ?? '').trim() || null,
    isActive: !['false', '0', 'no', 'inactivo'].includes(String(input.isActive ?? input.activo ?? 'true').trim().toLowerCase()),
  }
}
function parseCsvRow(line: string) {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1 }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { values.push(current.trim()); current = '' }
    else current += char
  }
  values.push(current.trim())
  return values
}
function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
const aliases: Record<string, string> = {
  modalidad: 'shipmentMode', shipmentmode: 'shipmentMode',
  perfil: 'commercialProfile', commercialprofile: 'commercialProfile',
  origen: 'origin', origin: 'origin', destino: 'destination', destination: 'destination',
  codigoorigen: 'originCode', origincode: 'originCode',
  codigodestino: 'destinationCode', destinationcode: 'destinationCode',
  equipos: 'equipmentClasses', equipmentclasses: 'equipmentClasses',
  equipo: 'equipmentClass', equipmentclass: 'equipmentClass',
  precio: 'price', price: 'price', tarifa: 'price',
  minimo: 'minimum', minimum: 'minimum',
  transitodias: 'transitDays', transitdays: 'transitDays', diastransito: 'transitDays',
  almacen: 'warehouse', warehouse: 'warehouse',
  fuente: 'source', source: 'source', notas: 'notes', notes: 'notes',
  vigenciadesde: 'validFrom', validfrom: 'validFrom', vigenciahasta: 'validTo', validto: 'validTo',
  activo: 'isActive', isactive: 'isActive', moneda: 'currency', currency: 'currency',
}
function parseCsv(text: string) {
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim())
  if (lines.length < 2) return [] as CreateLandTariffItem[]
  const headers = parseCsvRow(lines[0]!).map((header) => aliases[normalizeHeader(header)] || header)
  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line)
    const record: Record<string, unknown> = {}
    headers.forEach((header, index) => { record[header] = values[index] || '' })
    return importItem(record)
  }).filter((item): item is CreateLandTariffItem => Boolean(item))
}
const gcfLtlRoutes = [
  ['San José, Costa Rica', 'Managua, Nicaragua', 'sj_man_rate', 'sj_man_min', 3, 'Almacén Fiscal Premier 6117'],
  ['San José, Costa Rica', 'San Pedro Sula, Honduras', 'sj_sps_rate', 'sj_sps_min', 6, 'Sicarga'],
  ['San José, Costa Rica', 'San Salvador, El Salvador', 'sj_ss_rate', 'sj_ss_min', 5, 'Central Logistics SA De C.V.'],
  ['San José, Costa Rica', 'Ciudad Guatemala, Guatemala', 'sj_gua_rate', 'sj_gua_min', 7, 'Almacenadora Integrada'],
  ['CFZ Panamá', 'Managua, Nicaragua', 'cfz_man_rate', 'cfz_man_min', 4, 'Almacén Fiscal Premier 6117'],
  ['CFZ Panamá', 'San Pedro Sula, Honduras', 'cfz_sps_rate', 'cfz_sps_min', 5, 'Sicarga'],
  ['CFZ Panamá', 'San Salvador, El Salvador', 'cfz_ss_rate', 'cfz_ss_min', 5, 'Central Logistics SA De C.V.'],
  ['CFZ Panamá', 'Ciudad Guatemala, Guatemala', 'cfz_gua_rate', 'cfz_gua_min', 6, 'Almacenadora Integrada'],
] as const
function gcfItemsFromMap(
  tariffs: Record<string, unknown>,
  profile: LandCommercialProfile,
  source: string,
) {
  return gcfLtlRoutes.map(([origin, destination, rateId, minimumId, transitDays, warehouse]) => importItem({
    shipmentMode: 'Ltl',
    commercialProfile: profile,
    origin,
    destination,
    price: tariffs[rateId],
    minimum: tariffs[minimumId],
    transitDays,
    warehouse,
    source,
  })).filter((item): item is CreateLandTariffItem => Boolean(item))
}

function parseGcfHtml(text: string) {
  const document = new DOMParser().parseFromString(text, 'text/html')
  const profile = text.toLowerCase().includes('nvocc') ? 'Nvocc' : 'FinalClient'
  return gcfLtlRoutes.map(([origin, destination, rateId, minimumId, transitDays, warehouse]) => importItem({
    shipmentMode: 'Ltl',
    commercialProfile: profile,
    origin,
    destination,
    price: (document.getElementById(rateId) as HTMLInputElement | null)?.value,
    minimum: (document.getElementById(minimumId) as HTMLInputElement | null)?.value,
    transitDays,
    warehouse,
    source: profile === 'Nvocc' ? 'LTL GCF NVOCC · HTML' : 'GCF Centroamérica LTL · HTML',
  })).filter((item): item is CreateLandTariffItem => Boolean(item))
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !canUpdate.value || importing.value) return
  importing.value = true
  try {
    const text = await file.text()
    const name = file.name.toLowerCase()
    let items: CreateLandTariffItem[] = []
    if (name.endsWith('.json')) {
      const parsed = JSON.parse(text) as unknown
      const tariffMap =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as { tarifas?: unknown }).tarifas
          : null

      if (tariffMap && typeof tariffMap === 'object' && !Array.isArray(tariffMap)) {
        const profile: LandCommercialProfile = JSON.stringify(parsed).toLowerCase().includes('nvocc')
          ? 'Nvocc'
          : 'FinalClient'
        items = gcfItemsFromMap(
          tariffMap as Record<string, unknown>,
          profile,
          profile === 'Nvocc' ? 'LTL GCF NVOCC · JSON' : 'GCF Centroamérica LTL · JSON',
        )
      } else {
        const raw = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown[] }).items)
            ? (parsed as { items: unknown[] }).items : []
        items = raw.map((value) => importItem(value as Record<string, unknown>))
          .filter((item): item is CreateLandTariffItem => Boolean(item))
      }
    } else if (name.endsWith('.html') || name.endsWith('.htm')) items = parseGcfHtml(text)
    else items = parseCsv(text)

    if (!items.length) {
      toastStore.warning('Sin tarifas válidas', 'El archivo no contiene filas que Dhole pueda importar.')
      return
    }
    const result = await FtlTariffService.importBatch(items)
    toastStore.success('Tarifario importado', result.created + ' nuevas y ' + result.updated + ' actualizadas de ' + result.total + ' tarifas.')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo importar el tarifario terrestre.')
  } finally {
    importing.value = false
  }
}
function downloadTemplate() {
  const headers = ['shipmentMode','commercialProfile','origin','originCode','destination','destinationCode','equipmentClasses','price','minimum','transitDays','warehouse','source','notes','validFrom','validTo','isActive','currency']
  const ftlEquipmentExample = catalogs.landEquipmentSizes.value
    .slice(0, 2)
    .map(equipmentCatalogKey)
    .filter(Boolean)
    .join('|')
  const examples = [
    ['Ftl','General','Costa Rica','','Nicaragua','',ftlEquipmentExample,'1400','','4','','Proveedor','','','','true','USD'],
    ['Ltl','FinalClient','San José, Costa Rica','','Managua, Nicaragua','','','40','55','3','Almacén Fiscal Premier 6117','Proveedor','','','','true','USD'],
  ]
  const escape = (value: string) => '"' + value.replaceAll('"', '""') + '"'
  const csv = [headers.join(','), ...examples.map((row) => row.map(escape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'dhole-tarifas-terrestres.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

onMounted(async () => {
  await catalogs.loadAll()
  await load()
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Tarifas terrestres FTL / LTL"
      subtitle="FTL se carga manualmente. LTL se administra como matriz por ruta para Cliente final y NVOCC."
      :icon="Truck"
    >
      <template #actions>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <DhButton label="Plantilla CSV" :icon="Download" variant="secondary" @click="downloadTemplate" />
          <DhButton v-if="canUpdate" label="Verificar matriz LTL" :icon="RefreshCw" variant="secondary" :loading="seedingDefaults" @click="seedDefaults" />
          <DhButton v-if="canUpdate" label="Importar" :icon="Upload" variant="secondary" :loading="importing" @click="fileInput?.click()" />
          <DhButton v-if="canUpdate" label="Nueva tarifa" @click="openForm()" />
          <input ref="fileInput" type="file" accept=".csv,text/csv,.json,application/json,.html,.htm,text/html" class="hidden" @change="importFile" />
        </div>
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="filters.search"
        title="Matriz de tarifas terrestres"
        create-label="Nueva tarifa"
        :show-create="canUpdate"
        @create="openForm()"
        @refresh="load"
        @search="page = 1"
        @filter="filtersOpen = !filtersOpen"
      >
        <template #description>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ total }} tarifas. FTL se mantiene por carga manual; LTL se consulta y edita desde la matriz por ruta.
          </p>
        </template>
      </DhCrudToolbar>

      <section class="mt-5 rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Matriz LTL</p>
            <h3 class="mt-1 text-lg font-black text-[var(--dh-text)]">Tarifa consolidada por ruta</h3>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
              Cada celda muestra tarifa USD/CBM, mínimo y días de tránsito. LTL no requiere contenedor.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-xs font-black transition"
              :class="selectedLtlMatrixProfile === 'FinalClient'
                ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]'
                : 'border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text-soft)]'"
              @click="selectedLtlMatrixProfile = 'FinalClient'"
            >
              Cliente final
            </button>
            <button
              type="button"
              class="rounded-xl border px-4 py-2 text-xs font-black transition"
              :class="selectedLtlMatrixProfile === 'Nvocc'
                ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]'
                : 'border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text-soft)]'"
              @click="selectedLtlMatrixProfile = 'Nvocc'"
            >
              NVOCC
            </button>
          </div>
        </div>

        <div v-if="ltlMatrixOrigins.length && ltlMatrixDestinations.length" class="mt-4 overflow-x-auto dh-scrollbar">
          <table class="min-w-[980px] w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th class="sticky left-0 z-10 min-w-[210px] border-b border-r border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
                  Origen
                </th>
                <th
                  v-for="destination in ltlMatrixDestinations"
                  :key="destination"
                  class="min-w-[190px] border-b border-[var(--dh-border)] px-4 py-3 text-xs font-black text-[var(--dh-text)]"
                >
                  {{ destination }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="origin in ltlMatrixOrigins" :key="origin">
                <th class="sticky left-0 z-10 border-b border-r border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-4 align-top text-sm font-black text-[var(--dh-text)]">
                  {{ origin }}
                </th>
                <td
                  v-for="destination in ltlMatrixDestinations"
                  :key="origin + '|' + destination"
                  class="border-b border-[var(--dh-border)] p-2 align-top"
                >
                  <button
                    v-if="ltlMatrixTariff(origin, destination)"
                    type="button"
                    class="w-full rounded-2xl border border-[var(--dh-border)] bg-black/[0.025] p-3 text-left transition hover:border-[rgb(var(--dh-primary-rgb)/0.4)] hover:bg-[rgb(var(--dh-primary-rgb)/0.05)] dark:bg-white/[0.04]"
                    @click="canUpdate && openForm(ltlMatrixTariff(origin, destination)!)"
                  >
                    <span class="block text-sm font-black text-[var(--dh-text)]">
                      {{ formatMoney(ltlMatrixTariff(origin, destination)!.priceAmount, currencyDisplayValue(ltlMatrixTariff(origin, destination)!)) }}
                      <span class="text-[10px] text-[var(--dh-text-muted)]">/ CBM</span>
                    </span>
                    <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">
                      Mín. {{ formatMoney(ltlMatrixTariff(origin, destination)!.minimumAmount || 0, currencyDisplayValue(ltlMatrixTariff(origin, destination)!)) }}
                    </span>
                    <span class="mt-1 block text-xs font-bold text-[var(--dh-primary)]">
                      {{ ltlMatrixTariff(origin, destination)!.transitDays == null ? 'Tránsito sin definir' : ltlMatrixTariff(origin, destination)!.transitDays + ' días' }}
                    </span>
                  </button>
                  <div v-else class="rounded-2xl border border-dashed border-[var(--dh-border)] px-3 py-5 text-center text-xs font-bold text-[var(--dh-text-muted)]">
                    Sin tarifa
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] px-4 py-8 text-center">
          <p class="font-black text-[var(--dh-text)]">No hay matriz LTL para este perfil.</p>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            Use “Verificar matriz LTL” para crear las rutas base faltantes.
          </p>
        </div>
      </section>

      <div v-if="filtersOpen" class="mt-5 rounded-[26px] border border-[var(--dh-border)] bg-black/[0.025] p-4 dark:bg-white/[0.04]">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PricingMultiSelect v-model="filters.shipmentMode" label="Tipo" :options="modeFilterOptions" placeholder="Todos" search-placeholder="Buscar tipo..." />
          <PricingMultiSelect v-model="filters.commercialProfile" label="Perfil" :options="profileFilterOptions" placeholder="Todos" search-placeholder="Buscar perfil..." />
          <PricingMultiSelect v-model="filters.equipmentClasses" label="Equipo" :options="equipmentFilterOptions" placeholder="Todos" search-placeholder="Buscar equipo..." />
          <PricingMultiSelect v-model="filters.active" label="Estado" :options="activeOptions" placeholder="Todos" search-placeholder="Buscar estado..." />
        </div>
        <div class="mt-4 flex justify-end"><DhButton label="Limpiar" variant="ghost" size="sm" @click="clearFilters" /></div>
      </div>

      <div class="mt-5">
        <DhDataTable
          :columns="columns"
          :rows="pagedRows"
          :loading="loading"
          empty-text="No hay tarifas terrestres que coincidan con los filtros."
          @row-click="(row) => canUpdate && openForm(row)"
        >
          <template #cell-route="{ row }">
            <div>
              <p class="font-black text-[var(--dh-text)]">{{ row.originName }} → {{ row.destinationName }}</p>
              <p v-if="row.source" class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.source }}</p>
            </div>
          </template>
          <template #cell-shipmentMode="{ row }">
            <div class="space-y-1">
              <DhBadge :label="row.shipmentMode === 'Ftl' ? 'Completo · FTL' : 'Consolidado · LTL'" :variant="row.shipmentMode === 'Ftl' ? 'primary' : 'neutral'" />
              <p v-if="row.shipmentMode === 'Ltl'" class="text-[11px] font-bold text-[var(--dh-text-muted)]">{{ profileLabel(row.commercialProfile) }}</p>
            </div>
          </template>
          <template #cell-equipment="{ row }">
            <div v-if="row.shipmentMode === 'Ftl'" class="flex max-w-[260px] flex-wrap gap-1">
              <DhBadge v-for="equipmentClass in applicableClasses(row)" :key="equipmentClass" :label="equipmentClassLabel(equipmentClass)" variant="primary" />
            </div>
            <DhBadge v-else label="No requiere contenedor" variant="neutral" />
          </template>
          <template #cell-transitDays="{ row }"><span class="font-black">{{ row.transitDays == null ? '—' : row.transitDays + ' días' }}</span></template>
          <template #cell-priceAmount="{ row }">
            <span class="font-black">
              {{ formatMoney(row.priceAmount, currencyDisplayValue(row)) }}
              <span v-if="row.shipmentMode === 'Ltl'" class="text-[10px] text-[var(--dh-text-muted)]">/ CBM</span>
            </span>
          </template>
          <template #cell-minimumAmount="{ row }">
            <span v-if="row.shipmentMode === 'Ltl' && row.minimumAmount != null" class="font-bold">{{ formatMoney(row.minimumAmount, currencyDisplayValue(row)) }}</span>
            <span v-else>—</span>
          </template>
          <template #cell-validity="{ row }">
            <div class="text-xs font-semibold text-[var(--dh-text-soft)]">
              <p>{{ row.validFrom?.slice(0, 10) || 'Sin inicio' }}</p>
              <p>{{ row.validTo?.slice(0, 10) || 'Sin vencimiento' }}</p>
            </div>
          </template>
          <template #cell-isActive="{ value }"><DhBadge :label="value ? 'Activa' : 'Inactiva'" :variant="value ? 'success' : 'neutral'" /></template>
          <template #cell-actions="{ row }">
            <button
              v-if="canUpdate"
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-black/[0.025] text-[var(--dh-text-soft)] transition hover:bg-black/[0.07] hover:text-[var(--dh-text)] dark:bg-white/[0.05]"
              aria-label="Editar tarifa"
              title="Editar"
              @click.stop="openForm(row)"
            >
              <Pencil class="h-[18px] w-[18px]" />
            </button>
          </template>
        </DhDataTable>
      </div>
      <div class="mt-5"><DhPagination v-model:page="page" v-model:page-size="pageSize" :total="total" /></div>
    </section>
  </section>
</template>
