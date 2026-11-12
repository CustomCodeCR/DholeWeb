<script setup lang="ts">
import { matchesLandLtlEndpoint } from '@/modules/pricing/utils/ltlGamRouting'
import { computed, onMounted, ref, watch } from 'vue'
import { Building2, Check, RefreshCcw, Truck } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import {
  FtlTariffService,
  type FtlTariffDto,
} from '@/core/services/ftlTariffService'
import { PricingService } from '@/core/services/pricingService'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { sellerRateCurrencyValue } from '@/modules/pricing/utils/sellerRateCurrency'
import type { ImportRateSelectDto, CostSelectDto } from '@/core/interfaces/pricing'
import { buildCfzSanJoseCatalogTariff, isCfzToSanJoseOwnLtl, LTL_PANAMA_REQUIRED_KINDS, selectLtlPanamaCosts } from '@/modules/pricing/utils/ltlPanamaOwnCosts'

type SourceTab = 'Own' | 'Coloader'
type OwnRow = FtlTariffDto & Record<string, unknown>
type ColoaderRow = ImportRateSelectDto & Record<string, unknown>

const props = withDefaults(defineProps<{
  originId?: string | null
  originName?: string | null
  originCode?: string | null
  destinationId?: string | null
  destinationName?: string | null
  destinationCode?: string | null
  quoteDate?: string | null
  requestedCbm?: number
  cargoWeightKg?: number
  incotermId?: string | null
  serviceIds?: string[]
  selectedMasterId?: string | null
  selectedImportId?: string | null
}>(), {
  originId: null,
  originName: null,
  originCode: null,
  destinationId: null,
  destinationName: null,
  destinationCode: null,
  quoteDate: null,
  requestedCbm: 0,
  cargoWeightKg: 0,
  incotermId: null,
  serviceIds: () => [],
  selectedMasterId: null,
  selectedImportId: null,
})

const emit = defineEmits<{
  'select-own': [tariff: FtlTariffDto]
  'select-coloader': [rate: ImportRateSelectDto]
  'manual-coloader': []
}>()

const loading = ref(false)
const selecting = ref('')
const search = ref('')
const tab = ref<SourceTab>('Own')
const ownRows = ref<OwnRow[]>([])
const coloaderRows = ref<ColoaderRow[]>([])
const costMasterRows = ref<CostSelectDto[]>([])
const currencyCatalog = ref<CatalogItemSelectDto[]>([])
const isPanamaCostRoute = computed(() => isCfzToSanJoseOwnLtl(
  [props.originName, props.originCode].filter(Boolean).join(' '),
  [props.destinationName, props.destinationCode].filter(Boolean).join(' '),
  'Ltl', 'FinalClient',
))
const costBackedOwnRow = computed(() => buildCfzSanJoseCatalogTariff(costMasterRows.value, {
  originId: props.originId,
  originName: props.originName,
  originCode: props.originCode,
  destinationId: props.destinationId,
  destinationName: props.destinationName,
  destinationCode: props.destinationCode,
  weightKg: Number(props.cargoWeightKg),
  billableCbm: Number(props.requestedCbm),
  incotermId: props.incotermId,
  serviceIds: props.serviceIds,
}))
const error = ref('')

const ownColumns: DhTableColumn<OwnRow>[] = [
  { key: 'source', label: 'Tarifario LTL propio', width: '220px' },
  { key: 'route', label: 'Ruta' },
  { key: 'validity', label: 'Vigencia', width: '190px' },
  { key: 'sale', label: 'Flete terrestre / CBM', align: 'right', width: '220px' },
  { key: 'action', label: '', align: 'right', width: '130px' },
]

const coloaderColumns: DhTableColumn<ColoaderRow>[] = [
  { key: 'source', label: 'Proveedor LTL coloader', width: '220px' },
  { key: 'route', label: 'Ruta' },
  { key: 'validity', label: 'Vigencia', width: '190px' },
  { key: 'sale', label: 'Flete terrestre / CBM', align: 'right', width: '220px' },
  { key: 'action', label: '', align: 'right', width: '130px' },
]

function n(value: unknown) {
  return Number(value ?? 0)
}

function money(value: unknown) {
  return n(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bde\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isValidOn(validFrom: string | null | undefined, validTo: string | null | undefined) {
  const date = String(props.quoteDate ?? '').slice(0, 10)
  if (!date) return true
  const from = String(validFrom ?? '').slice(0, 10)
  const to = String(validTo ?? '').slice(0, 10)
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function ownMatchesRoute(row: FtlTariffDto) {
  return matchesLandLtlEndpoint(
    { id: row.originId, ids: row.applicableOriginIds, name: row.originName, code: row.originCode },
    { id: props.originId, name: props.originName, code: props.originCode },
    'origin',
  ) && matchesLandLtlEndpoint(
    { id: row.destinationId, ids: row.applicableDestinationIds, name: row.destinationName, code: row.destinationCode },
    { id: props.destinationId, name: props.destinationName, code: props.destinationCode },
    'destination',
  )
}

function searchableOwn(row: FtlTariffDto) {
  return [
    row.source,
    row.notes,
    row.warehouseName,
    row.originName,
    row.originCode,
    row.destinationName,
    row.destinationCode,
    row.currencyCode,
    row.commercialProfile,
  ].map(normalize).join(' ')
}

function searchableColoader(row: ImportRateSelectDto) {
  return [
    row.agent,
    row.agentCode,
    row.carrier,
    row.carrierCode,
    row.pol,
    row.polCode,
    row.poe,
    row.poeCode,
    row.pod,
    row.currency,
    row.currencyCode,
    row.importProfileName,
  ].map(normalize).join(' ')
}

const filteredOwn = computed(() => {
  const q = normalize(search.value)
  const inferred = costBackedOwnRow.value
  const available = inferred && !ownRows.value.some((row) =>
    row.isActive && ownMatchesRoute(row) && String(row.commercialProfile) === 'FinalClient'
  ) ? [...ownRows.value, { ...inferred } as OwnRow] : ownRows.value
  return available.filter((row) =>
    row.isActive
    && String(row.shipmentMode).toLowerCase() === 'ltl'
    && isValidOn(row.validFrom, row.validTo)
    && ownMatchesRoute(row)
    && (!q || searchableOwn(row).includes(q)),
  )
})

const ownEmptyText = computed(() => {
  if (isPanamaCostRoute.value) {
    if (!(Number(props.cargoWeightKg) > 0)) return 'Ingrese el peso total en KG para calcular la ruta LTL CFZ → San José según los tramos configurados.'
    const catalog = selectLtlPanamaCosts(costMasterRows.value, { incotermId: props.incotermId, serviceIds: props.serviceIds })
    const missing = LTL_PANAMA_REQUIRED_KINDS.filter((kind) => !catalog.has(kind))
    if (missing.length) return 'No se pudo formar la ruta LTL propia: faltan costos aplicables en Costos y recargos (' + missing.join(', ') + ').'
    return 'Los costos configurados no tienen un tramo aplicable al peso total de la carga. Revise los tramos en Costos y recargos.'
  }
  const base = ownRows.value
  if (!base.length) return 'No hay tarifarios LTL propios registrados en Pricing. Revise las tarifas terrestres LTL o la carga de la matriz oficial.'
  const applicable = base.filter((row) => row.isActive
    && String(row.shipmentMode).toLowerCase() === 'ltl'
    && isValidOn(row.validFrom, row.validTo))
  if (!applicable.length) return 'Hay ' + base.length + ' tarifas LTL registradas, pero ninguna activa y vigente para la fecha de carga.'
  const matchingOrigin = applicable.filter((row) => matchesLandLtlEndpoint(
    { id: row.originId, ids: row.applicableOriginIds, name: row.originName, code: row.originCode },
    { id: props.originId, name: props.originName, code: props.originCode },
    'origin',
  ))
  if (!matchingOrigin.length) return 'Hay ' + applicable.length + ' tarifas LTL vigentes, pero ninguna corresponde al origen ' + (props.originName || props.originCode || 'seleccionado') + '. Revise los tarifarios terrestres.'
  if (!matchingOrigin.some(ownMatchesRoute)) return 'Hay ' + matchingOrigin.length + ' tarifas LTL vigentes para este origen, pero ninguna corresponde al destino ' + (props.destinationName || props.destinationCode || 'seleccionado') + '. Revise las rutas registradas.'
  return search.value.trim()
    ? 'Existen tarifas LTL para esta ruta, pero ninguna coincide con la búsqueda. Limpie el buscador.'
    : 'No hay tarifas LTL disponibles para esta combinación.'
})

const filteredColoaders = computed(() => {
  const q = normalize(search.value)
  return coloaderRows.value.filter((row) =>
    isValidOn(row.validFrom, row.validTo)
    && (!q || searchableColoader(row).includes(q)),
  )
})

async function load() {
  try {
    loading.value = true
    error.value = ''
    const [mastersResult, importsResult, costsResult, currencyResult] = await Promise.allSettled([
      FtlTariffService.browse('Ltl'),
      PricingService.selectImportRates({
        shipmentMode: 'Ltl',
        pol: props.originName || props.originCode || undefined,
        poe: props.destinationName || props.destinationCode || undefined,
        quoteDate: props.quoteDate || undefined,
      }),
      isPanamaCostRoute.value
        ? PricingService.selectCosts({ isActive: true })
        : Promise.resolve([] as CostSelectDto[]),
      CatalogItemsService.select({ catalogGroupSlug: 'currencies' }),
    ])

    // Own land LTL tariffs must remain visible even if the imports/coloader API fails.
    ownRows.value = mastersResult.status === 'fulfilled'
      ? mastersResult.value.map((row) => ({ ...row }))
      : []
    coloaderRows.value = importsResult.status === 'fulfilled'
      ? importsResult.value.map((row) => ({ ...row }))
      : []
    costMasterRows.value = costsResult.status === 'fulfilled' ? costsResult.value : []
    currencyCatalog.value = currencyResult.status === 'fulfilled' ? currencyResult.value : []
    if (isPanamaCostRoute.value && costsResult.status === 'rejected') {
      error.value = 'No se pudieron consultar los costos LTL Panamá → Costa Rica. Intente actualizar.'
    } else if (mastersResult.status === 'rejected' && !costBackedOwnRow.value) {
      error.value = 'No fue posible cargar los tarifarios propios LTL. Intente actualizar.'
    } else if (importsResult.status === 'rejected') {
      error.value = 'Los tarifarios LTL propios están disponibles, pero no se pudieron consultar los LTL coloaders.'
    }

    if (!filteredOwn.value.length && filteredColoaders.value.length) tab.value = 'Coloader'
    else if (filteredOwn.value.length) tab.value = 'Own'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No fue posible consultar las tarifas LTL.'
  } finally {
    loading.value = false
  }
}

function chooseOwn(row: FtlTariffDto) {
  selecting.value = 'own:' + row.id
  emit('select-own', row)
  selecting.value = ''
}

function chooseColoader(row: ImportRateSelectDto) {
  selecting.value = 'import:' + row.id
  emit('select-coloader', row)
  selecting.value = ''
}

function ownProfileLabel(row: FtlTariffDto) {
  return String(row.commercialProfile).toLowerCase() === 'nvocc' ? 'NVOCC propio' : 'Cliente propio'
}

function importedProvider(row: ImportRateSelectDto) {
  return row.agent || row.agentCode || row.carrier || row.carrierCode || 'Coloader importado'
}

function importedSale(row: ImportRateSelectDto) {
  return n(row.totalSale ?? row.freight)
}

function importedCost(row: ImportRateSelectDto) {
  return n(row.totalCost ?? row.freight)
}

// CurrencyCode is an internal Config identifier. Render the currency Value
// for both own and imported LTL rates, including historical snapshots.
function ownCurrencyValue(row: FtlTariffDto): string {
  return sellerRateCurrencyValue(row, currencyCatalog.value) ?? '—'
}

function importedCurrencyValue(row: ImportRateSelectDto): string {
  return sellerRateCurrencyValue({
    currencyId: row.currencyId,
    currencyName: row.currency,
    currencyCode: row.currencyCode,
  }, currencyCatalog.value) ?? '—'
}

onMounted(load)

watch(
  () => [props.originId, props.originName, props.originCode, props.destinationId, props.destinationName, props.destinationCode, props.quoteDate, props.incotermId, props.serviceIds.join(',')],
  () => { void load() },
)
</script>

<template>
  <section class="space-y-4">
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_auto] lg:items-end">
      <DhSearchInput v-model="search" placeholder="Buscar tarifa LTL, proveedor, origen o destino..." />
      <DhInput :model-value="requestedCbm" type="number" label="Volumen LTL cobrable (CBM)" disabled />
      <DhButton label="Actualizar tarifas" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
    </div>

    <div class="flex gap-2 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-1.5">
      <button
        type="button"
        class="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-black transition"
        :class="tab === 'Own' ? 'bg-[var(--dh-card)] text-[var(--dh-primary)] shadow-[var(--dh-shadow-sm)]' : 'text-[var(--dh-text-muted)]'"
        @click="tab = 'Own'"
      >
        <Truck class="h-4 w-4" />
        Tarifarios LTL propios
        <span class="rounded-full bg-black/5 px-2 py-0.5 text-[10px] dark:bg-white/10">{{ filteredOwn.length }}</span>
      </button>

      <button
        type="button"
        class="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-black transition"
        :class="tab === 'Coloader' ? 'bg-[var(--dh-card)] text-[var(--dh-primary)] shadow-[var(--dh-shadow-sm)]' : 'text-[var(--dh-text-muted)]'"
        @click="tab = 'Coloader'"
      >
        <Building2 class="h-4 w-4" />
        LTL coloaders
        <span class="rounded-full bg-black/5 px-2 py-0.5 text-[10px] dark:bg-white/10">{{ filteredColoaders.length }}</span>
      </button>
    </div>

    <div v-if="error" class="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-300">
      {{ error }}
    </div>

    <div v-if="tab === 'Own'">
      <DhDataTable
        :columns="ownColumns"
        :rows="filteredOwn"
        :loading="loading"
        :empty-text="ownEmptyText"
      >
        <template #cell-source="{ row }">
          <div>
            <p class="font-black">{{ row.source || 'Grupo Castro Fallas' }}</p>
            <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">
              {{ row.warehouseName || 'Tarifario LTL propio' }}
            </p>
          </div>
        </template>
        <template #cell-route="{ row }">
          <div>
            <p class="font-bold">{{ row.originName }} → {{ row.destinationName }}</p>
            <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">
              {{ row.transitDays != null ? row.transitDays + ' días' : 'Tránsito por confirmar' }}
            </p>
          </div>
        </template>
        <template #cell-validity="{ row }">
          <div>
            <p class="font-bold">{{ row.validFrom || 'Sin inicio' }} – {{ row.validTo || 'Sin vencimiento' }}</p>
            <DhBadge class="mt-1" :label="ownProfileLabel(row)" variant="success" />
          </div>
        </template>
        <template #cell-sale="{ row }">
          <div class="space-y-0.5 text-right">
            <p v-if="row.id === 'ltl-catalog:cfz-san-jose' && row.priceAmount > 0" class="font-black">{{ ownCurrencyValue(row) }} {{ money(row.priceAmount * requestedCbm) }} por embarque</p>
            <p v-else-if="row.id === 'ltl-catalog:cfz-san-jose'" class="text-xs font-bold text-[var(--dh-text-muted)]">Pendiente de peso total / tramo válido</p>
            <p v-else class="font-black">{{ ownCurrencyValue(row) }} {{ money(row.priceAmount) }} / CBM</p>
            <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">
              <template v-if="row.id === 'ltl-catalog:cfz-san-jose' && row.priceAmount > 0">Costo {{ ownCurrencyValue(row) }} {{ money(n(row.costPerCbm) * requestedCbm) }} por embarque · Tramos por KG</template>
              <template v-else-if="row.id === 'ltl-catalog:cfz-san-jose'">Complete peso en KG para activar los cuatro cargos</template>
              <template v-else>Costo {{ ownCurrencyValue(row) }} {{ money(row.costPerCbm) }} / CBM · Mínimo {{ ownCurrencyValue(row) }} {{ money(row.minimumAmount) }}</template>
            </p>
          </div>
        </template>
        <template #cell-action="{ row }">
          <div class="flex justify-end" @click.stop>
            <DhButton
              class="min-w-[108px]"
              :label="selectedMasterId === row.id ? 'Seleccionado' : 'Seleccionar'"
              :icon="selectedMasterId === row.id ? Check : undefined"
              size="sm"
              :loading="selecting === 'own:' + row.id"
              :disabled="row.id === 'ltl-catalog:cfz-san-jose' && !(row.priceAmount > 0)"
              @click="chooseOwn(row)"
            />
          </div>
        </template>
      </DhDataTable>

    </div>

    <div v-else>
      <DhDataTable
        :columns="coloaderColumns"
        :rows="filteredColoaders"
        :loading="loading"
        empty-text="No hay tarifas LTL coloaders vigentes para esta ruta en Revisar importaciones."
      >
        <template #cell-source="{ row }">
          <div>
            <p class="font-black">{{ importedProvider(row) }}</p>
            <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">
              Revisar importaciones · {{ row.sourceType }}
            </p>
          </div>
        </template>
        <template #cell-route="{ row }">
          <div>
            <p class="font-bold">{{ row.pol }} → {{ row.poe || row.pod }}</p>
            <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">
              {{ row.transitDays != null ? row.transitDays + ' días' : 'Tránsito por confirmar' }}
            </p>
          </div>
        </template>
        <template #cell-validity="{ row }">
          <div>
            <p class="font-bold">{{ row.validFrom }} – {{ row.validTo }}</p>
            <DhBadge class="mt-1" label="LTL importado · Coloader" variant="warning" />
          </div>
        </template>
        <template #cell-sale="{ row }">
          <div class="space-y-0.5 text-right">
            <p class="font-black">{{ importedCurrencyValue(row) }} {{ money(importedSale(row)) }} / CBM</p>
            <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">
              Costo {{ importedCurrencyValue(row) }} {{ money(importedCost(row)) }} / CBM
            </p>
          </div>
        </template>
        <template #cell-action="{ row }">
          <div class="flex justify-end" @click.stop>
            <DhButton
              class="min-w-[108px]"
              :label="selectedImportId === row.id ? 'Seleccionado' : 'Seleccionar'"
              :icon="selectedImportId === row.id ? Check : undefined"
              size="sm"
              :loading="selecting === 'import:' + row.id"
              @click="chooseColoader(row)"
            />
          </div>
        </template>
      </DhDataTable>

      <div class="mt-4 flex flex-col gap-3 rounded-[22px] border border-dashed border-[rgb(var(--dh-primary-rgb)/0.35)] bg-[rgb(var(--dh-primary-rgb)/0.04)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-black">Tarifa LTL coloader manual</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Puede crear una tarifa manual cuando no exista un coloader vigente o necesite ingresar sus propios importes.
          </p>
        </div>
        <DhButton class="shrink-0" label="Crear tarifa manual" variant="secondary" @click="emit('manual-coloader')" />
      </div>
    </div>
  </section>
</template>
