<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Building2, Check, RefreshCcw, Truck } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import {
  FtlTariffService,
  type FtlTariffDto,
  type LandCommercialProfile,
} from '@/core/services/ftlTariffService'

type SourceTab = 'Own' | 'Coloader'
type TableRow = FtlTariffDto & Record<string, unknown>

const props = withDefaults(defineProps<{
  originId?: string | null
  originName?: string | null
  originCode?: string | null
  destinationId?: string | null
  destinationName?: string | null
  destinationCode?: string | null
  quoteDate?: string | null
  requestedCbm?: number
  selectedId?: string | null
}>(), {
  originId: null,
  originName: null,
  originCode: null,
  destinationId: null,
  destinationName: null,
  destinationCode: null,
  quoteDate: null,
  requestedCbm: 0,
  selectedId: null,
})

const emit = defineEmits<{
  select: [tariff: FtlTariffDto]
  'manual-own': []
}>()

const loading = ref(false)
const selecting = ref('')
const search = ref('')
const tab = ref<SourceTab>('Own')
const rows = ref<TableRow[]>([])
const error = ref('')

const ownColumns: DhTableColumn<TableRow>[] = [
  { key: 'source', label: 'Consolidado', width: '220px' },
  { key: 'route', label: 'Ruta' },
  { key: 'validity', label: 'Vigencia', width: '190px' },
  { key: 'sale', label: 'Flete / CBM', align: 'right', width: '220px' },
  { key: 'action', label: '', align: 'right', width: '130px' },
]

const coloaderColumns: DhTableColumn<TableRow>[] = [
  { key: 'source', label: 'Coloader / tarifario', width: '220px' },
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

function isValidOn(row: FtlTariffDto) {
  const date = String(props.quoteDate ?? '').slice(0, 10)
  if (!date) return true
  const from = String(row.validFrom ?? '').slice(0, 10)
  const to = String(row.validTo ?? '').slice(0, 10)
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function matchesRoute(row: FtlTariffDto) {
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

const routeRows = computed(() =>
  rows.value.filter((row) =>
    row.isActive
    && String(row.shipmentMode).toLowerCase() === 'ltl'
    && isValidOn(row)
    && matchesRoute(row),
  ),
)

function searchable(row: FtlTariffDto) {
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

function profileRows(profile: LandCommercialProfile) {
  const q = normalize(search.value)
  return routeRows.value.filter((row) =>
    row.commercialProfile === profile
    && (!q || searchable(row).includes(q)),
  )
}

const filteredOwn = computed(() => profileRows('FinalClient'))
const filteredColoaders = computed(() => profileRows('Nvocc'))

async function load() {
  try {
    loading.value = true
    error.value = ''
    rows.value = (await FtlTariffService.browse('Ltl')).map((row) => ({ ...row }))
    if (!filteredOwn.value.length && filteredColoaders.value.length) tab.value = 'Coloader'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No fue posible consultar las tarifas LTL.'
  } finally {
    loading.value = false
  }
}

function choose(row: FtlTariffDto) {
  selecting.value = row.id
  emit('select', row)
  selecting.value = ''
}

function profileLabel(row: FtlTariffDto) {
  return row.commercialProfile === 'Nvocc' ? 'Coloader' : 'Consolidado propio'
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
      <DhSearchInput v-model="search" placeholder="Buscar consolidado, coloader, ruta o código..." />
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
        empty-text="No hay consolidados propios LTL vigentes para esta ruta."
      >
        <template #cell-source="{ row }">
          <div>
            <p class="font-black">Grupo Castro Fallas</p>
            <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">
              {{ row.source || row.warehouseName || 'Tarifario LTL propio' }}
            </p>
          </div>
        </template>
        <template #cell-route="{ row }">
          <div>
            <p class="font-bold">{{ row.originName }} → {{ row.destinationName }}</p>
            <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">
              {{ row.warehouseName || 'LTL terrestre' }} · {{ row.transitDays != null ? row.transitDays + ' días' : 'Tránsito por confirmar' }}
            </p>
          </div>
        </template>
        <template #cell-validity="{ row }">
          <div>
            <p class="font-bold">{{ row.validFrom || 'Sin inicio' }} – {{ row.validTo || 'Sin vencimiento' }}</p>
            <DhBadge class="mt-1" :label="profileLabel(row)" variant="success" />
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
              :label="selectedId === row.id ? 'Seleccionado' : 'Seleccionar'"
              :icon="selectedId === row.id ? Check : undefined"
              size="sm"
              :loading="selecting === row.id"
              @click="choose(row)"
            />
          </div>
        </template>
      </DhDataTable>

      <div class="mt-4 flex flex-col gap-3 rounded-[22px] border border-dashed border-[rgb(var(--dh-primary-rgb)/0.35)] bg-[rgb(var(--dh-primary-rgb)/0.04)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-black">Tarifa LTL propia manual</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Puede crearla aunque exista una tarifa propia vigente para esta ruta.
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
        empty-text="No hay tarifarios LTL de coloader vigentes para esta ruta."
      >
        <template #cell-source="{ row }">
          <div>
            <p class="font-black">{{ row.source || 'Coloader' }}</p>
            <p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">
              {{ row.warehouseName || 'Tarifario LTL' }}
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
            <DhBadge class="mt-1" label="Tarifario LTL" variant="success" />
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
              :label="selectedId === row.id ? 'Seleccionado' : 'Seleccionar'"
              :icon="selectedId === row.id ? Check : undefined"
              size="sm"
              :loading="selecting === row.id"
              @click="choose(row)"
            />
          </div>
        </template>
      </DhDataTable>
    </div>
  </section>
</template>
