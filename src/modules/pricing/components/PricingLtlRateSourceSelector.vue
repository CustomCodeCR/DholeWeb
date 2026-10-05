<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Building2, Check, RefreshCcw, Truck } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import {
  FtlTariffService,
  type FtlTariffDto,
} from '@/core/services/ftlTariffService'
import { PricingService } from '@/core/services/pricingService'
import type { ImportRateSelectDto } from '@/core/interfaces/pricing'

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
  selectedMasterId: null,
  selectedImportId: null,
})

const emit = defineEmits<{
  'select-own': [tariff: FtlTariffDto]
  'select-coloader': [rate: ImportRateSelectDto]
  'manual-own': []
}>()

const loading = ref(false)
const selecting = ref('')
const search = ref('')
const tab = ref<SourceTab>('Own')
const ownRows = ref<OwnRow[]>([])
const coloaderRows = ref<ColoaderRow[]>([])
const error = ref('')

const ownColumns: DhTableColumn<OwnRow>[] = [
  { key: 'source', label: 'Tarifario propio', width: '220px' },
  { key: 'route', label: 'Ruta' },
  { key: 'validity', label: 'Vigencia', width: '190px' },
  { key: 'sale', label: 'Flete / CBM', align: 'right', width: '220px' },
  { key: 'action', label: '', align: 'right', width: '130px' },
]

const coloaderColumns: DhTableColumn<ColoaderRow>[] = [
  { key: 'source', label: 'Coloader / importación', width: '220px' },
  { key: 'route', label: 'Ruta' },
  { key: 'validity', label: 'Vigencia', width: '190px' },
  { key: 'sale', label: 'Flete / CBM', align: 'right', width: '220px' },
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

function routeKey(value: unknown) {
  const normalized = normalize(value)
  if (
    normalized.includes('cfz')
    || normalized.includes('colon free zone')
    || normalized.includes('zona libre colon')
  ) return 'cfz panama'
  return normalized
}

function endpointMatches(
  rowId: string | null,
  applicableIds: string[] | null | undefined,
  rowName: string | null,
  rowCode: string | null,
  selectedId: string | null | undefined,
  selectedName: string | null | undefined,
  selectedCode: string | null | undefined,
) {
  const ids = new Set([rowId, ...(applicableIds ?? [])].filter(Boolean).map(String))
  if (selectedId && ids.has(String(selectedId))) return true

  const selected = [selectedName, selectedCode].map(routeKey).filter(Boolean)
  const configured = [rowName, rowCode].map(routeKey).filter(Boolean)
  if (!selected.length || !configured.length) return !selectedId

  return selected.some((left) =>
    configured.some((right) =>
      left === right
      || (left.length >= 5 && right.includes(left))
      || (right.length >= 5 && left.includes(right)),
    ),
  )
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
  return endpointMatches(
    row.originId,
    row.applicableOriginIds,
    row.originName,
    row.originCode,
    props.originId,
    props.originName,
    props.originCode,
  ) && endpointMatches(
    row.destinationId,
    row.applicableDestinationIds,
    row.destinationName,
    row.destinationCode,
    props.destinationId,
    props.destinationName,
    props.destinationCode,
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
  return ownRows.value.filter((row) =>
    row.isActive
    && String(row.shipmentMode).toLowerCase() === 'ltl'
    && isValidOn(row.validFrom, row.validTo)
    && ownMatchesRoute(row)
    && (!q || searchableOwn(row).includes(q)),
  )
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
    const [masters, imports] = await Promise.all([
      FtlTariffService.browse('Ltl'),
      PricingService.selectImportRates({
        shipmentMode: 'Ltl',
        pol: props.originName || props.originCode || undefined,
        poe: props.destinationName || props.destinationCode || undefined,
        quoteDate: props.quoteDate || undefined,
      }),
    ])

    // Regla de negocio:
    // FinalClient y NVOCC administrados en Tarifas terrestres son ambos tarifarios propios.
    // Solamente los LTL provenientes de Revisar importaciones se consideran Coloaders.
    ownRows.value = masters.map((row) => ({ ...row }))
    coloaderRows.value = imports.map((row) => ({ ...row }))

    if (!filteredOwn.value.length && filteredColoaders.value.length) tab.value = 'Coloader'
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

onMounted(load)

watch(
  () => [props.originId, props.destinationId, props.quoteDate],
  () => { void load() },
)
</script>

<template>
  <section class="space-y-4">
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_auto] lg:items-end">
      <DhSearchInput v-model="search" placeholder="Buscar tarifario, coloader, ruta o código..." />
      <DhInput :model-value="requestedCbm" type="number" label="CBM cobrable calculado" disabled />
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
        Consolidados propios
        <span class="rounded-full bg-black/5 px-2 py-0.5 text-[10px] dark:bg-white/10">{{ filteredOwn.length }}</span>
      </button>

      <button
        type="button"
        class="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-black transition"
        :class="tab === 'Coloader' ? 'bg-[var(--dh-card)] text-[var(--dh-primary)] shadow-[var(--dh-shadow-sm)]' : 'text-[var(--dh-text-muted)]'"
        @click="tab = 'Coloader'"
      >
        <Building2 class="h-4 w-4" />
        Coloader
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
        empty-text="No hay tarifarios propios LTL vigentes para esta ruta."
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
            <p class="font-black">{{ row.currencyCode || 'USD' }} {{ money(row.priceAmount) }} / CBM</p>
            <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">
              Costo {{ row.currencyCode || 'USD' }} {{ money(row.costPerCbm) }} / CBM · Mínimo {{ row.currencyCode || 'USD' }} {{ money(row.minimumAmount) }}
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
              @click="chooseOwn(row)"
            />
          </div>
        </template>
      </DhDataTable>

      <div class="mt-4 flex flex-col gap-3 rounded-[22px] border border-dashed border-[rgb(var(--dh-primary-rgb)/0.35)] bg-[rgb(var(--dh-primary-rgb)/0.04)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-black">Tarifa LTL propia manual</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Puede crearla aunque exista un tarifario Cliente o NVOCC vigente para esta ruta.
          </p>
        </div>
        <DhButton class="shrink-0" label="Crear tarifa manual" variant="secondary" @click="emit('manual-own')" />
      </div>
    </div>

    <div v-else>
      <DhDataTable
        :columns="coloaderColumns"
        :rows="filteredColoaders"
        :loading="loading"
        empty-text="No hay LTL aprobados o preautorizados en Revisar importaciones para esta ruta."
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
            <p class="font-black">{{ row.currencyCode || row.currency || 'USD' }} {{ money(importedSale(row)) }} / CBM</p>
            <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">
              Costo {{ row.currencyCode || row.currency || 'USD' }} {{ money(importedCost(row)) }} / CBM
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
    </div>
  </section>
</template>
