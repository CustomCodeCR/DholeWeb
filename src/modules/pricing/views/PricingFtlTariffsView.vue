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
const equipmentFilterOptions = [
  { label: 'Equipo 48/53 pies', value: '48_53' },
  { label: 'Equipo 5 a 7 toneladas', value: '5_7_TON' },
]

function applicableClasses(row: FtlTariffDto) {
  const values = row.applicableEquipmentClasses?.length
    ? row.applicableEquipmentClasses
    : row.equipmentClass ? [row.equipmentClass] : []
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))]
}
function equipmentClassLabel(value: string) {
  if (value === '48_53') return '48/53 pies'
  if (value === '5_7_TON') return '5–7 toneladas'
  if (value === 'LTL_CBM') return 'Consolidado'
  return value
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
    toastStore.success('Tarifario base verificado', result.ftl + ' completos y ' + result.ltl + ' consolidados disponibles (' + result.total + ' total).')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las tarifas base TIGSA / GCF.')
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
  return normalized.length ? [...new Set(normalized)] : ['48_53']
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
    currencyCode: currency.code || currency.value || currency.name,
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
  const examples = [
    ['Ftl','General','Costa Rica','','Nicaragua','','48_53|5_7_TON','1400','','4','','Proveedor','','','','true','USD'],
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
      subtitle="Configure la ruta, modalidad, equipos aplicables y días de tránsito de cada tarifa."
      :icon="Truck"
    >
      <template #actions>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <DhButton label="Plantilla CSV" :icon="Download" variant="secondary" @click="downloadTemplate" />
          <DhButton v-if="canUpdate" label="Cargar base TIGSA / GCF" :icon="RefreshCw" variant="secondary" :loading="seedingDefaults" @click="seedDefaults" />
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
            {{ total }} tarifas. Los completos pueden compartir tarifa entre varios equipos; los consolidados no requieren contenedor.
          </p>
        </template>
      </DhCrudToolbar>

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
              {{ formatMoney(row.priceAmount, row.currencyCode || row.currencyName) }}
              <span v-if="row.shipmentMode === 'Ltl'" class="text-[10px] text-[var(--dh-text-muted)]">/ CBM</span>
            </span>
          </template>
          <template #cell-minimumAmount="{ row }">
            <span v-if="row.shipmentMode === 'Ltl' && row.minimumAmount != null" class="font-bold">{{ formatMoney(row.minimumAmount, row.currencyCode || row.currencyName) }}</span>
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
