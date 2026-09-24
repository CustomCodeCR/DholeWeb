<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Building2, Check, RefreshCcw, Ship } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import {
  OwnLclConsolidationService,
  type OwnLclCargoLineRequest,
  type OwnLclConsolidationDto,
  type OwnLclQuoteCalculationDto,
} from '@/core/services/ownLclConsolidationService'
import {
  LclRateSourceService,
  type LclColoaderRateDto,
  type LclColoaderRateLineDto,
} from '@/core/services/lclRateSourceService'
import type { ChargeBasis, CostDetailType, CostType } from '@/core/interfaces/pricing'

type SourceTab = 'Own' | 'Coloader'
type TableRow = Record<string, unknown>

export interface LclNormalizedRateLine {
  key: string
  section: 'pickup_origin' | 'origin_charges' | 'international_freight' | 'destination_charges' | 'delivery_destination'
  name: string
  costDetailType: CostDetailType
  costType: CostType
  chargeBasis: ChargeBasis
  costId?: string | null
  contextLabel?: string | null
  notes?: string | null
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: number
  saleAmount: number
  included: boolean
  optional: boolean
  manual: boolean
  applyDestinationTax?: boolean
  destinationTaxRate?: number
}

export interface LclRateSourceSelection {
  kind: SourceTab
  id: string
  label: string
  requestedCbm: number
  providerId: string | null
  providerName: string | null
  providerCode: string | null
  carrierId: string | null
  carrierName: string | null
  carrierCode: string | null
  currencyId: string
  currencyName: string
  currencyCode: string
  freeDays: number
  transitDays: number
  validFrom: string | null
  validTo: string | null
  includes: string[]
  subjectTo: string[]
  excludes: string[]
  lines: LclNormalizedRateLine[]
  totalCost: number
  totalSale: number
  profitAmount: number
  profitPerCbm: number
  profitPercentage: number
  meetsMinimumMargin: boolean | null
  matrixVersion: string | null
}

const props = withDefaults(defineProps<{
  polId?: string | null
  polCode?: string | null
  poeId?: string | null
  podId?: string | null
  incotermId?: string | null
  incotermCode?: string | null
  destinationLabel?: string | null
  quoteDate?: string | null
  currencyId: string
  currencyName: string
  currencyCode: string
  modelValue?: string | null
  requestedCbm?: number
  requestedCbmLocked?: boolean
  cargoLines?: OwnLclCargoLineRequest[]
}>(), {
  polId: null,
  polCode: null,
  poeId: null,
  podId: null,
  incotermId: null,
  incotermCode: 'FOB',
  destinationLabel: null,
  quoteDate: null,
  modelValue: null,
  requestedCbm: 1,
  requestedCbmLocked: false,
  cargoLines: () => [],
})

const emit = defineEmits<{
  select: [selection: LclRateSourceSelection]
  'update:modelValue': [value: string]
  'update:requestedCbm': [value: number]
}>()

const loading = ref(false)
const selecting = ref('')
const tab = ref<SourceTab>('Own')
const search = ref('')
const ownRows = ref<Array<OwnLclConsolidationDto & TableRow>>([])
const coloaderRows = ref<Array<LclColoaderRateDto & TableRow>>([])
const error = ref('')

const ownColumns: DhTableColumn<OwnLclConsolidationDto & TableRow>[] = [
  { key: 'source', label: 'Consolidado', width: '220px' },
  { key: 'route', label: 'Ruta / salida' },
  { key: 'capacity', label: 'Capacidad', align: 'right', width: '190px' },
  { key: 'cost', label: 'Costo base/CBM', align: 'right', width: '150px' },
  { key: 'action', label: '', align: 'right', width: '130px' },
]

const coloaderColumns: DhTableColumn<LclColoaderRateDto & TableRow>[] = [
  { key: 'source', label: 'Coloader / tarifario', width: '220px' },
  { key: 'route', label: 'Ruta' },
  { key: 'validity', label: 'Vigencia', width: '180px' },
  { key: 'sale', label: 'Flete / CBM', align: 'right', width: '160px' },
  { key: 'action', label: '', align: 'right', width: '120px' },
]

function n(value: unknown) {
  return Number(value ?? 0)
}
function money(value: unknown) {
  return n(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function coloaderFreightPerCbm(row: LclColoaderRateDto) {
  const freight = row.lines.find((line) => line.costDetailType === 'Freight')
  return freight ? n(freight.saleAmount || freight.costAmount) : null
}
function normalize(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}
function splitTerms(value: string | null | undefined) {
  return (value ?? '').split(/[,\n]+/).map((item) => item.trim()).filter(Boolean)
}
function destinationCode() {
  const value = normalize(props.destinationLabel)
  if (value.includes('costa rica') || value.includes('san jose') || value.includes('san josé') || value.includes('gam') || value.includes('caldera') || value.includes('limon') || value.includes('limón') || value.includes('moin') || value.includes('moín')) return 'CR'
  if (value.includes('panama') || value.includes('panamá') || value.includes('colon') || value.includes('colón') || value.includes('cfz') || value.includes('czf')) return 'PA'
  if (value.includes('nicaragua') || value.includes('managua')) return 'NI'
  if (value.includes('honduras') || value.includes('san pedro sula')) return 'HN'
  if (value.includes('guatemala')) return 'GT'
  if (value.includes('salvador') || value.includes('san salvador')) return 'SV'
  return ''
}
function sectionForDetail(type: CostDetailType, name = ''): LclNormalizedRateLine['section'] {
  const normalizedName = normalize(name)
  if (normalizedName.includes('recolecta') || normalizedName.includes('pickup')) return 'pickup_origin'
  if (type === 'Freight') return 'international_freight'
  if (type === 'OriginCharge' || type === 'CustomsCharge' || type === 'Documentation') return 'origin_charges'
  if (type === 'InlandTransport' && (normalizedName.includes('terrestre') || normalizedName.includes('delivery'))) return 'delivery_destination'
  return 'destination_charges'
}
function ownLineType(name: string): CostDetailType {
  const value = normalize(name)
  if (value.includes('flete internacional') || value.includes('ocean')) return 'Freight'
  // PICK UP / Recolecta belong to origin. They must never be rendered or
  // persisted as a destination charge.
  if (value.includes('recolecta') || value.includes('pickup') || value.includes('pick up')) return 'OriginCharge'
  if (value.includes('custom')) return 'CustomsCharge'
  if (value.includes('doc') || value.includes('manifest') || value.includes('vgm')) return 'Documentation'
  if (value.includes('flete terrestre')) return 'InlandTransport'
  if (value.includes('cfs') || value.includes('whse') || value.includes('warehouse')) return 'OriginCharge'
  return 'DestinationCharge'
}
function ownBasis(basis: string): ChargeBasis {
  const value = normalize(basis)
  if (value.includes('cbm')) return 'PerChargeableCbm'
  if (value.includes('document')) return 'PerDocument'
  return 'PerShipment'
}
function requested() {
  return Math.max(1, n(props.requestedCbm || 1))
}

function costaRicaTodayIso() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function remainingCbm(row: OwnLclConsolidationDto) {
  return Math.max(0, n(row.remainingCbm ?? row.maximumCbm))
}

function approvedCbm(row: OwnLclConsolidationDto) {
  return Math.max(0, n(row.approvedCbm))
}

function exceedsApprovalCapacity(row: OwnLclConsolidationDto) {
  return requested() > remainingCbm(row)
}

const chinaOwnLclOrigins = new Set([
  'shanghai', 'ningbo', 'qingdao', 'xiamen', 'shantou', 'dalian',
  'chongqing', 'fuzhou', 'shenzhen', 'xingang', 'shekou', 'guangzhou',
])

const ownLclOriginAliases: Record<string, string> = {
  shanghai: 'shanghai',
  cnsha: 'shanghai',
  ningbo: 'ningbo',
  cnngb: 'ningbo',
  qingdao: 'qingdao',
  cntao: 'qingdao',
  cnqng: 'qingdao',
  xiamen: 'xiamen',
  cnxmn: 'xiamen',
  shantou: 'shantou',
  cnswa: 'shantou',
  dalian: 'dalian',
  cndlc: 'dalian',
  chongqing: 'chongqing',
  cnckg: 'chongqing',
  fuzhou: 'fuzhou',
  cnfoc: 'fuzhou',
  shenzhen: 'shenzhen',
  cnszx: 'shenzhen',
  xingang: 'xingang',
  tianjin: 'xingang',
  cntsn: 'xingang',
  cntxg: 'xingang',
  shekou: 'shekou',
  cnshk: 'shekou',
  guangzhou: 'guangzhou',
  cncan: 'guangzhou',
  miami: 'miami',
  usmia: 'miami',
  mia: 'miami',
}

function canonicalOwnLclOrigin(value: unknown) {
  const key = normalize(value).replace(/[^a-z0-9]/g, '')
  if (ownLclOriginAliases[key]) return ownLclOriginAliases[key]

  const aliases = Object.entries(ownLclOriginAliases)
    .sort(([left], [right]) => right.length - left.length)
  for (const [alias, canonical] of aliases) {
    if (key.includes(alias)) return canonical
  }
  return key
}

function ownCalculationPolCode(row: OwnLclConsolidationDto) {
  const consolidationOrigin = canonicalOwnLclOrigin(row.polName || row.polCode)
  if (consolidationOrigin === 'miami') return 'MIAMI'
  return canonicalOwnLclOrigin(props.polCode || row.polName || row.polCode).toUpperCase()
}

function ownConsolidationSupportsPol(row: OwnLclConsolidationDto, pol: string) {
  if (!pol) return true

  const requestedOrigin = canonicalOwnLclOrigin(pol)
  const consolidationOrigins = [row.polCode, row.polName]
    .map(canonicalOwnLclOrigin)
    .filter(Boolean)

  if (consolidationOrigins.includes(requestedOrigin)) return true

  // China usa Shanghai como base física y aplica el diferencial del POL comercial.
  // Miami es una matriz aparte y nunca debe caer en esta regla.
  return requestedOrigin !== 'miami'
    && consolidationOrigins.includes('shanghai')
    && chinaOwnLclOrigins.has(requestedOrigin)
}

const filteredOwn = computed(() => {
  const q = normalize(search.value)
  const pol = normalize(props.polCode)
  return ownRows.value.filter((row) => {
    if (!row.isActive || normalize(row.status) === 'closed') return false
    if (row.etd && row.etd.slice(0, 10) <= costaRicaTodayIso()) return false
    if (!ownConsolidationSupportsPol(row, pol)) return false
    if (!q) return true
    return [row.name, row.booking, row.carrierName, row.carrierCode, row.polName, row.polCode, row.containerName, row.containerCode, row.etd]
      .some((value) => normalize(value).includes(q))
  })
})

const filteredColoaders = computed(() => {
  const q = normalize(search.value)
  if (!q) return coloaderRows.value
  return coloaderRows.value.filter((row) => [row.rateName, row.rateCode, row.providerName, row.providerCode, row.carrierName, row.carrierCode, row.polName, row.poeName, row.podName]
    .some((value) => normalize(value).includes(q)))
})

async function load() {
  try {
    loading.value = true
    error.value = ''
    const [own, coloaders] = await Promise.all([
      OwnLclConsolidationService.browse(),
      LclRateSourceService.browseColoaders({
        polId: props.polId,
        poeId: props.poeId,
        podId: props.podId,
        incotermId: props.incotermId,
        quoteDate: props.quoteDate,
      }),
    ])
    ownRows.value = own.map((row) => ({ ...row }))
    coloaderRows.value = coloaders.map((row) => ({ ...row }))
    if (!filteredOwn.value.length && filteredColoaders.value.length) tab.value = 'Coloader'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No fue posible consultar las fuentes LCL.'
  } finally {
    loading.value = false
  }
}

function cargoForCbm(cbm: number) {
  return [{ description: 'Cotización LCL', units: 1, totalWeightKg: 0, lengthCm: 100, widthCm: 100, heightCm: cbm * 100 }]
}

function mapOwnLines(calculation: OwnLclQuoteCalculationDto): LclNormalizedRateLine[] {
  const sourceMarker = `LCL PROPIO · ConsolidadoId: ${calculation.consolidationId} · Consolidado: #${calculation.consolidationNumber}`
  return calculation.lines.map((line, index) => {
    const type = ownLineType(line.name)
    const normalizedName = normalize(line.name)
    const variable = normalizedName.includes('recolecta') || normalizedName.includes('pickup')
    const sourceBasis = normalize(line.chargeBasis)
    return {
      key: `own-lcl:${calculation.consolidationId}:${index}`,
      section: sectionForDetail(type, line.name),
      name: line.name,
      costDetailType: type,
      costType: variable ? 'Variable' : 'Fixed',
      // CFS is a raw-CBM charge: it must keep the real volume (for example
      // 0.20 CBM) and must not inherit the 1-CBM ocean-freight minimum.
      chargeBasis: normalizedName === 'cfs' ? 'PerCbm' : ownBasis(line.chargeBasis),
      contextLabel: `Consolidado ${calculation.consolidationNumber} · ${calculation.matrixVersion}`,
      notes: sourceBasis.includes('cbm')
        ? sourceMarker
        : `${sourceMarker} · Base del Excel: ${line.chargeBasis}; cantidad aplicada: 1.`,
      currencyId: props.currencyId,
      currencyName: props.currencyName,
      currencyCode: props.currencyCode,
      costAmount: n(line.costUnit),
      saleAmount: n(line.saleUnit),
      included: true,
      optional: false,
      manual: variable,
      applyDestinationTax: false,
      destinationTaxRate: 0,
    }
  })
}

async function chooseOwn(row: OwnLclConsolidationDto) {
  const destination = destinationCode()
  if (!destination) {
    error.value = 'El destino seleccionado no está soportado por la matriz del consolidado propio.'
    return
  }
  try {
    selecting.value = `Own:${row.id}`
    const cbm = requested()
    const calculation = await OwnLclConsolidationService.calculate(row.id, {
      destinationCode: destination,
      incoterm: props.incotermCode || 'FOB',
      cargoLines: props.cargoLines.length ? props.cargoLines : cargoForCbm(cbm),
      polCode: ownCalculationPolCode(row),
      salePerCbm: null,
      sets: 1,
      hbl: 1,
      pickupCost: 0,
      pickupSale: 0,
      discount: 0,
    })
    const selection: LclRateSourceSelection = {
      kind: 'Own',
      id: row.id,
      label: `${row.name} · ${row.polName || row.polCode}`,
      requestedCbm: cbm,
      providerId: null,
      providerName: 'Grupo Castro Fallas',
      providerCode: 'GCF',
      carrierId: row.carrierId,
      carrierName: row.carrierName,
      carrierCode: row.carrierCode,
      currencyId: props.currencyId,
      currencyName: props.currencyName,
      currencyCode: props.currencyCode,
      freeDays: 0,
      transitDays: 0,
      validFrom: null,
      validTo: row.etd,
      includes: [],
      subjectTo: [],
      excludes: [],
      lines: mapOwnLines(calculation),
      totalCost: calculation.totalCost,
      totalSale: calculation.finalSale,
      profitAmount: calculation.profitAmount,
      profitPerCbm: calculation.profitPerCbm,
      profitPercentage: calculation.profitPercentage,
      meetsMinimumMargin: calculation.meetsMinimumMargin,
      matrixVersion: calculation.matrixVersion,
    }
    emit('update:modelValue', `Own:${row.id}`)
    emit('select', selection)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No fue posible calcular el consolidado seleccionado.'
  } finally {
    selecting.value = ''
  }
}

function mapColoaderLine(line: LclColoaderRateLineDto, rate: LclColoaderRateDto): LclNormalizedRateLine {
  return {
    key: `coloader:${rate.id}:${line.id}`,
    section: sectionForDetail(line.costDetailType, line.name),
    name: line.name,
    costDetailType: line.costDetailType,
    costType: line.costType,
    chargeBasis: line.chargeBasis,
    costId: line.costId,
    contextLabel: `${rate.providerName || rate.providerCode || 'Coloader'} · ${rate.rateCode}`,
    notes: [`LCL COLOADER · RateId: ${rate.id}`, line.notes].filter(Boolean).join(' · '),
    currencyId: line.currencyId,
    currencyName: line.currencyName,
    currencyCode: line.currencyCode,
    costAmount: n(line.costAmount),
    saleAmount: n(line.saleAmount),
    included: true,
    optional: line.costType === 'Optional',
    manual: false,
    applyDestinationTax: line.applyDestinationTax,
    destinationTaxRate: n(line.destinationTaxRate),
  }
}

function chooseColoader(rate: LclColoaderRateDto) {
  const cbm = requested()
  const profit = n(rate.totalSaleAmount) - n(rate.totalCostAmount)
  const selection: LclRateSourceSelection = {
    kind: 'Coloader',
    id: rate.id,
    label: `${rate.providerName || rate.providerCode || 'Coloader'} · ${rate.rateCode}`,
    requestedCbm: cbm,
    providerId: rate.providerId,
    providerName: rate.providerName,
    providerCode: rate.providerCode,
    carrierId: rate.carrierId,
    carrierName: rate.carrierName,
    carrierCode: rate.carrierCode,
    currencyId: rate.currencyId,
    currencyName: rate.currencyName,
    currencyCode: rate.currencyCode,
    freeDays: rate.freeDays,
    transitDays: Number.parseInt(rate.transitTime || '0', 10) || 0,
    validFrom: rate.validFrom,
    validTo: rate.validTo,
    includes: splitTerms(rate.includes),
    subjectTo: splitTerms(rate.subjectTo),
    excludes: splitTerms(rate.excludes),
    lines: rate.lines.map((line) => mapColoaderLine(line, rate)),
    totalCost: n(rate.totalCostAmount),
    totalSale: n(rate.totalSaleAmount),
    profitAmount: profit,
    profitPerCbm: profit / cbm,
    profitPercentage: n(rate.marginPercentage),
    meetsMinimumMargin: null,
    matrixVersion: rate.rateCode,
  }
  emit('update:modelValue', `Coloader:${rate.id}`)
  emit('select', selection)
}

function updateCbm(value: string | number | null) {
  if (props.requestedCbmLocked) return
  emit('update:requestedCbm', Math.max(1, n(value)))
}

watch(() => [props.polId, props.poeId, props.podId, props.incotermId, props.quoteDate], () => void load())
onMounted(load)
</script>

<template>
  <section class="space-y-4">
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_auto] lg:items-end">
      <DhSearchInput v-model="search" placeholder="Buscar consolidado, coloader, naviera, ruta o código..." />
      <DhInput :model-value="requestedCbm" type="number" label="CBM cobrable calculado" :disabled="requestedCbmLocked" @update:model-value="updateCbm" />
      <DhButton label="Actualizar tarifas" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
    </div>

    <div class="flex gap-2 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-1.5">
      <button type="button" class="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-black transition" :class="tab === 'Own' ? 'bg-[var(--dh-card)] text-[var(--dh-primary)] shadow-[var(--dh-shadow-sm)]' : 'text-[var(--dh-text-muted)]'" @click="tab = 'Own'">
        <Ship class="h-4 w-4" /> Consolidados propios <span class="rounded-full bg-black/5 px-2 py-0.5 text-[10px] dark:bg-white/10">{{ filteredOwn.length }}</span>
      </button>
      <button type="button" class="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-black transition" :class="tab === 'Coloader' ? 'bg-[var(--dh-card)] text-[var(--dh-primary)] shadow-[var(--dh-shadow-sm)]' : 'text-[var(--dh-text-muted)]'" @click="tab = 'Coloader'">
        <Building2 class="h-4 w-4" /> Coloader <span class="rounded-full bg-black/5 px-2 py-0.5 text-[10px] dark:bg-white/10">{{ filteredColoaders.length }}</span>
      </button>
    </div>

    <div v-if="error" class="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-300">{{ error }}</div>

    <div v-if="tab === 'Own'">
      <DhDataTable :columns="ownColumns" :rows="filteredOwn" :loading="loading" empty-text="No hay consolidados propios disponibles para este POL.">
        <template #cell-source="{ row }">
          <div><p class="font-black">{{ row.name }}</p><p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ row.matrixVersion }} · {{ row.booking || 'Sin booking' }}</p></div>
        </template>
        <template #cell-route="{ row }">
          <div><p class="font-bold">{{ row.polName || row.polCode }} → {{ row.poeName || row.poeCode || 'Panamá' }} / Centroamérica</p><p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">{{ row.carrierName || row.carrierCode || 'Naviera pendiente' }} · ETD {{ row.etd || '—' }}</p></div>
        </template>
        <template #cell-capacity="{ row }">
          <div class="space-y-0.5 text-right">
            <p class="whitespace-nowrap font-black">{{ remainingCbm(row).toFixed(2) }} CBM disponibles</p>
            <p class="whitespace-nowrap text-[10px] font-semibold text-[var(--dh-text-muted)]">{{ approvedCbm(row).toFixed(2) }} aprobados / {{ n(row.maximumCbm).toFixed(2) }} totales</p>
            <p v-if="exceedsApprovalCapacity(row)" class="text-[10px] font-black text-amber-600 dark:text-amber-300">Se puede cotizar; excede el cupo para aprobación</p>
          </div>
        </template>
        <template #cell-cost="{ row }"><span class="font-black">USD {{ money((n(row.oceanFreight) + n(row.carrierDestinationCostTotal)) / Math.max(n(row.maximumCbm), 1)) }}</span></template>
        <template #cell-action="{ row }">
          <div class="flex justify-end" @click.stop>
            <DhButton class="min-w-[108px]" :label="modelValue === `Own:${row.id}` ? 'Seleccionado' : 'Seleccionar'" :icon="modelValue === `Own:${row.id}` ? Check : undefined" size="sm" :loading="selecting === `Own:${row.id}`" @click="chooseOwn(row)" />
          </div>
        </template>
      </DhDataTable>
    </div>

    <div v-else>
      <DhDataTable :columns="coloaderColumns" :rows="filteredColoaders" :loading="loading" empty-text="No hay tarifarios LCL de coloader vigentes para esta ruta.">
        <template #cell-source="{ row }">
          <div><p class="font-black">{{ row.providerName || row.providerCode || 'Coloader' }}</p><p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ row.rateCode }} · {{ row.carrierName || row.carrierCode || 'Sin naviera' }}</p></div>
        </template>
        <template #cell-route="{ row }"><span class="font-bold">{{ row.polName }} → {{ row.podName || row.poeName }}</span></template>
        <template #cell-validity="{ row }"><div><p class="font-bold">{{ row.validFrom }} – {{ row.validTo }}</p><DhBadge class="mt-1" label="Tarifario LCL" variant="success" /></div></template>
        <template #cell-sale="{ row }">
          <div class="space-y-0.5 text-right">
            <p class="font-black">
              <template v-if="coloaderFreightPerCbm(row) != null">{{ row.currencyCode }} {{ money(coloaderFreightPerCbm(row)) }}</template>
              <template v-else>—</template>
            </p>
            <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">Total base {{ row.currencyCode }} {{ money(row.totalSaleAmount) }}</p>
          </div>
        </template>
        <template #cell-action="{ row }">
          <div class="flex justify-end" @click.stop>
            <DhButton :label="modelValue === `Coloader:${row.id}` ? 'Seleccionado' : 'Seleccionar'" :icon="modelValue === `Coloader:${row.id}` ? Check : undefined" size="sm" @click="chooseColoader(row)" />
          </div>
        </template>
      </DhDataTable>
    </div>
  </section>
</template>
