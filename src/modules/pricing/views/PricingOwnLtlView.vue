<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Edit3, Eye, Plus, RefreshCcw, Truck, X } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import {
  FtlTariffService,
  type CreateLandTariffItem,
  type FtlTariffDto,
  type LandCommercialProfile,
} from '@/core/services/ftlTariffService'
import {
  usePricingCatalogs,
  type PricingCatalogItem,
} from '@/modules/pricing/composables/usePricingCatalogs'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'

type OwnLtlTableRow = FtlTariffDto & Record<string, unknown>

const authStore = useAuthStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const rows = ref<OwnLtlTableRow[]>([])
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const selectedProfile = ref<LandCommercialProfile | ''>('')
const selectedId = ref('')
const editorOpen = ref(false)
const readOnly = ref(false)

const LEGACY_ORIGIN = '__legacy_origin__'
const LEGACY_DESTINATION = '__legacy_destination__'
const DEFAULT_WEIGHT_KG_PER_CBM = 330
const DEFAULT_DUA_COST = 50
const DEFAULT_DUCA_T_COST = 30
const DEFAULT_STUFFING_COST_PER_CBM = 550 / 60
const DEFAULT_STUFFING_SALE_PER_CBM = 10
const DEFAULT_PANAMA_SURCHARGE_PER_CBM = 9

const canUpdate = computed(() =>
  authStore.hasScope(PRICING_SCOPES.costs.update)
  || authStore.hasRole('Administrador')
  || authStore.hasRole('Admin')
  || authStore.hasRole('Administrator'),
)

const form = reactive({
  commercialProfile: 'FinalClient' as LandCommercialProfile,
  originId: '',
  destinationId: '',
  currencyId: '',
  priceAmount: '',
  minimumAmount: '',
  costPerCbm: '',
  weightKgPerCbm: String(DEFAULT_WEIGHT_KG_PER_CBM),
  duaCost: String(DEFAULT_DUA_COST),
  ducaTCost: String(DEFAULT_DUCA_T_COST),
  stuffingCostPerCbm: String(DEFAULT_STUFFING_COST_PER_CBM),
  stuffingSalePerCbm: String(DEFAULT_STUFFING_SALE_PER_CBM),
  panamaCostSurchargePerCbm: String(DEFAULT_PANAMA_SURCHARGE_PER_CBM),
  transitDays: '',
  warehouseName: '',
  source: '',
  notes: '',
  validFrom: '',
  validTo: '',
  isActive: true,
  submitted: false,
})

const columns: DhTableColumn<OwnLtlTableRow>[] = [
  { key: 'route', label: 'Ruta / logística' },
  { key: 'profile', label: 'Perfil', width: '125px' },
  { key: 'freight', label: 'Costo / venta CBM', align: 'right', width: '185px' },
  { key: 'minimum', label: 'Venta mínima', align: 'right', width: '125px' },
  { key: 'documents', label: 'Documentos', align: 'right', width: '155px' },
  { key: 'weight', label: 'Peso', align: 'right', width: '120px' },
  { key: 'transit', label: 'Tránsito', align: 'center', width: '105px' },
  { key: 'status', label: 'Estado', width: '100px' },
  { key: 'actions', label: '', align: 'right', width: '110px' },
]

const selected = computed(() => rows.value.find((row) => row.id === selectedId.value) ?? null)

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function money(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function profileLabel(profile: LandCommercialProfile | string | null | undefined) {
  return String(profile).toLowerCase() === 'nvocc' ? 'NVOCC' : 'Cliente final'
}

function routeTerminalType(item: PricingCatalogItem, fallback: 'CY' | 'SD' = 'CY') {
  if (item.metadataJson) {
    try {
      const metadata = JSON.parse(item.metadataJson) as Record<string, unknown>
      const configured = String(metadata.terminalType ?? '').trim().toUpperCase()
      if (configured === 'CY' || configured === 'SD') return configured as 'CY' | 'SD'
    } catch {
      // Usar la convención del código cuando metadata no sea JSON válido.
    }
  }

  const code = String(item.code || '').trim().toUpperCase()
  if (code.startsWith('SD_') || code.endsWith('_SD') || code.includes('_SD_')) return 'SD'
  if (code.startsWith('CY_') || code.endsWith('_CY') || code.includes('_CY_')) return 'CY'
  return fallback
}

const landOrigins = computed(() =>
  catalogs.polPorts.value.filter((item) => routeTerminalType(item, 'CY') === 'SD'),
)

const landDestinations = computed(() =>
  catalogs.poePorts.value.filter((item) => routeTerminalType(item, 'CY') === 'SD'),
)

const originLocationOptions = computed(() => {
  const options = landOrigins.value.map((item) => ({
    value: item.id,
    label: item.name,
    searchText: [item.code, item.value, item.slug, item.name].filter(Boolean).join(' '),
  }))

  if (selected.value && !selected.value.originId) {
    options.unshift({
      value: LEGACY_ORIGIN,
      label: selected.value.originName + ' · ruta actual',
      searchText: [selected.value.originCode, selected.value.originName].filter(Boolean).join(' '),
    })
  }

  return options
})

const destinationLocationOptions = computed(() => {
  const options = landDestinations.value.map((item) => ({
    value: item.id,
    label: item.name,
    searchText: [item.code, item.value, item.slug, item.name].filter(Boolean).join(' '),
  }))

  if (selected.value && !selected.value.destinationId) {
    options.unshift({
      value: LEGACY_DESTINATION,
      label: selected.value.destinationName + ' · ruta actual',
      searchText: [selected.value.destinationCode, selected.value.destinationName].filter(Boolean).join(' '),
    })
  }

  return options
})

function allRouteItems() {
  const result = new Map<string, PricingCatalogItem>()
  ;[...landOrigins.value, ...landDestinations.value].forEach((item) => result.set(item.id, item))
  return result
}

function routeSnapshot(value: string, role: 'origin' | 'destination') {
  if (value === LEGACY_ORIGIN && role === 'origin' && selected.value) {
    return {
      id: null,
      name: selected.value.originName,
      code: selected.value.originCode,
    }
  }

  if (value === LEGACY_DESTINATION && role === 'destination' && selected.value) {
    return {
      id: null,
      name: selected.value.destinationName,
      code: selected.value.destinationCode,
    }
  }

  const item = allRouteItems().get(value)
  return item ? { id: item.id, name: item.name, code: item.code } : null
}

function isPanamaValue(value: unknown) {
  const normalized = normalize(value)
  return normalized.includes('panama')
    || normalized.includes('cfz')
    || normalized.includes('colon free zone')
    || normalized.includes('zona libre de colon')
}

function isPanamaOrigin(row: FtlTariffDto) {
  return isPanamaValue([row.originName, row.originCode].filter(Boolean).join(' '))
}

const formOrigin = computed(() => routeSnapshot(form.originId, 'origin'))
const formDestination = computed(() => routeSnapshot(form.destinationId, 'destination'))
const formIsPanamaOrigin = computed(() =>
  isPanamaValue([formOrigin.value?.name, formOrigin.value?.code].filter(Boolean).join(' ')),
)

const effectiveCostPerCbm = computed(() =>
  Math.max(Number(form.costPerCbm || 0), 0)
  + (formIsPanamaOrigin.value ? Math.max(Number(form.panamaCostSurchargePerCbm || 0), 0) : 0),
)

const documentCostTotal = computed(() =>
  Math.max(Number(form.duaCost || 0), 0) + Math.max(Number(form.ducaTCost || 0), 0),
)

const variableCostPerCbm = computed(() =>
  effectiveCostPerCbm.value + Math.max(Number(form.stuffingCostPerCbm || 0), 0),
)

const routeTitle = computed(() => {
  if (!formOrigin.value && !formDestination.value) return 'Nuevo consolidado LTL'
  return (formOrigin.value?.name || 'Origen pendiente') + ' → ' + (formDestination.value?.name || 'Destino pendiente')
})

function effectiveRowCost(row: FtlTariffDto) {
  return Number(row.costPerCbm ?? 0)
    + (isPanamaOrigin(row) ? Number(row.panamaCostSurchargePerCbm ?? DEFAULT_PANAMA_SURCHARGE_PER_CBM) : 0)
}

const filteredRows = computed(() => {
  const q = normalize(search.value)

  return rows.value.filter((row) => {
    if (selectedProfile.value && row.commercialProfile !== selectedProfile.value) return false
    if (!q) return true

    return [
      row.originName,
      row.originCode,
      row.destinationName,
      row.destinationCode,
      row.warehouseName,
      row.source,
      row.notes,
      profileLabel(row.commercialProfile),
    ].some((value) => normalize(value).includes(q))
  })
})

function resetForm() {
  selectedId.value = ''
  readOnly.value = false
  Object.assign(form, {
    commercialProfile: selectedProfile.value || 'FinalClient',
    originId: '',
    destinationId: '',
    currencyId: '',
    priceAmount: '',
    minimumAmount: '',
    costPerCbm: '',
    weightKgPerCbm: String(DEFAULT_WEIGHT_KG_PER_CBM),
    duaCost: String(DEFAULT_DUA_COST),
    ducaTCost: String(DEFAULT_DUCA_T_COST),
    stuffingCostPerCbm: String(DEFAULT_STUFFING_COST_PER_CBM),
    stuffingSalePerCbm: String(DEFAULT_STUFFING_SALE_PER_CBM),
    panamaCostSurchargePerCbm: String(DEFAULT_PANAMA_SURCHARGE_PER_CBM),
    transitDays: '',
    warehouseName: '',
    source: '',
    notes: '',
    validFrom: '',
    validTo: '',
    isActive: true,
    submitted: false,
  })
}

function newConsolidation() {
  if (!canUpdate.value) {
    toastStore.warning('Permiso requerido', 'Necesita permiso para administrar costos de Pricing.')
    return
  }

  resetForm()
  editorOpen.value = true
}

function hydrateForm(row: FtlTariffDto) {
  Object.assign(form, {
    commercialProfile: row.commercialProfile === 'Nvocc' ? 'Nvocc' : 'FinalClient',
    originId: row.originId || LEGACY_ORIGIN,
    destinationId: row.destinationId || LEGACY_DESTINATION,
    currencyId: row.currencyId || '',
    priceAmount: String(row.priceAmount ?? ''),
    minimumAmount: row.minimumAmount == null ? '' : String(row.minimumAmount),
    costPerCbm: row.costPerCbm == null ? '' : String(row.costPerCbm),
    weightKgPerCbm: String(row.weightKgPerCbm ?? DEFAULT_WEIGHT_KG_PER_CBM),
    duaCost: String(row.duaCost ?? DEFAULT_DUA_COST),
    ducaTCost: String(row.ducaTCost ?? DEFAULT_DUCA_T_COST),
    stuffingCostPerCbm: String(row.stuffingCostPerCbm ?? DEFAULT_STUFFING_COST_PER_CBM),
    stuffingSalePerCbm: String(row.stuffingSalePerCbm ?? DEFAULT_STUFFING_SALE_PER_CBM),
    panamaCostSurchargePerCbm: String(row.panamaCostSurchargePerCbm ?? DEFAULT_PANAMA_SURCHARGE_PER_CBM),
    transitDays: row.transitDays == null ? '' : String(row.transitDays),
    warehouseName: row.warehouseName || '',
    source: row.source || '',
    notes: row.notes || '',
    validFrom: row.validFrom?.slice(0, 10) || '',
    validTo: row.validTo?.slice(0, 10) || '',
    isActive: row.isActive,
    submitted: false,
  })
}

function openRow(row: OwnLtlTableRow, mode: 'view' | 'edit') {
  selectedId.value = row.id
  readOnly.value = mode === 'view'
  hydrateForm(row)
  editorOpen.value = true
}

function handleRowClick(row: OwnLtlTableRow) {
  openRow(row, 'view')
}

function closeEditor() {
  editorOpen.value = false
  selectedId.value = ''
  readOnly.value = false
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function buildPayload(): CreateLandTariffItem | null {
  form.submitted = true

  const origin = routeSnapshot(form.originId, 'origin')
  const destination = routeSnapshot(form.destinationId, 'destination')
  const currency = catalogs.currencies.value.find((item) => item.id === form.currencyId)

  const priceAmount = numberOrNull(form.priceAmount)
  const minimumAmount = numberOrNull(form.minimumAmount)
  const costPerCbm = numberOrNull(form.costPerCbm)
  const weightKgPerCbm = numberOrNull(form.weightKgPerCbm)
  const duaCost = numberOrNull(form.duaCost)
  const ducaTCost = numberOrNull(form.ducaTCost)
  const stuffingCostPerCbm = numberOrNull(form.stuffingCostPerCbm)
  const stuffingSalePerCbm = numberOrNull(form.stuffingSalePerCbm)
  const panamaCostSurchargePerCbm = numberOrNull(form.panamaCostSurchargePerCbm)
  const transitDays = numberOrNull(form.transitDays)

  if (
    !origin
    || !destination
    || !currency
    || priceAmount == null
    || !Number.isFinite(priceAmount)
    || priceAmount < 0
    || costPerCbm == null
    || !Number.isFinite(costPerCbm)
    || costPerCbm < 0
    || weightKgPerCbm == null
    || !Number.isFinite(weightKgPerCbm)
    || weightKgPerCbm <= 0
    || (minimumAmount != null && (!Number.isFinite(minimumAmount) || minimumAmount < 0))
    || [duaCost, ducaTCost, stuffingCostPerCbm, stuffingSalePerCbm, panamaCostSurchargePerCbm]
      .some((value) => value == null || !Number.isFinite(value) || value < 0)
    || (transitDays != null && (!Number.isInteger(transitDays) || transitDays < 0))
    || (form.validFrom && form.validTo && form.validFrom > form.validTo)
  ) {
    return null
  }

  return {
    originId: origin.id,
    originName: origin.name,
    originCode: origin.code || null,
    destinationId: destination.id,
    destinationName: destination.name,
    destinationCode: destination.code || null,
    shipmentMode: 'Ltl',
    commercialProfile: form.commercialProfile,
    equipmentClass: 'LTL_CBM',
    equipmentLabel: 'LTL · Consolidado',
    applicableEquipmentClasses: ['LTL_CBM'],
    currencyId: currency.id,
    currencyName: currency.name,
    currencyCode: currency.code || currency.value || currency.name,
    priceAmount,
    rateBasis: 'PerCbm',
    minimumAmount,
    costPerCbm,
    weightKgPerCbm,
    duaCost,
    ducaTCost,
    stuffingCostPerCbm,
    stuffingSalePerCbm,
    panamaCostSurchargePerCbm,
    transitDays,
    warehouseName: form.warehouseName.trim() || null,
    source: form.source.trim() || null,
    notes: form.notes.trim() || null,
    validFrom: form.validFrom || null,
    validTo: form.validTo || null,
    isActive: form.isActive,
  }
}

async function load() {
  loading.value = true
  try {
    await catalogs.loadAll()
    rows.value = (await FtlTariffService.browse('Ltl')) as OwnLtlTableRow[]
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la matriz LTL propia.')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (readOnly.value) return

  const payload = buildPayload()
  if (!payload) {
    toastStore.error(
      'Revise el consolidado',
      'Seleccione origen, destino y moneda; complete costo/venta por CBM, factor de peso y los cargos LTL.',
    )
    return
  }

  try {
    saving.value = true
    let targetId = selectedId.value

    if (targetId) {
      await FtlTariffService.update(targetId, payload)
    } else {
      const created = await FtlTariffService.create(payload)
      targetId = created.id
      selectedId.value = created.id
    }

    toastStore.success(
      selected.value ? 'Consolidado actualizado' : 'Consolidado creado',
      payload.originName + ' → ' + payload.destinationName + ' quedó guardado en la matriz LTL propia.',
    )

    await load()
    const row = rows.value.find((item) => item.id === targetId)
    if (row) openRow(row, 'view')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el consolidado LTL.')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Consolidados propios LTL"
      description="Administre rutas, costos y ventas del consolidado terrestre. El flujo visual sigue el mismo patrón de los consolidados propios LCL."
    />

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 shadow-[var(--dh-shadow-sm)] backdrop-blur-2xl">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="min-w-0 flex-1 lg:max-w-xl">
          <DhSearchInput v-model="search" placeholder="Buscar ruta, almacén, proveedor o perfil..." />
        </div>

        <DhSelect
          v-model="selectedProfile"
          class="lg:w-52"
          :options="[
            { label: 'Todos los perfiles', value: '' },
            { label: 'Cliente final', value: 'FinalClient' },
            { label: 'NVOCC', value: 'Nvocc' },
          ]"
        />

        <div class="flex gap-2 lg:ml-auto">
          <DhButton label="Actualizar" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
          <DhButton v-if="canUpdate" label="Crear consolidado" :icon="Plus" @click="newConsolidation" />
        </div>
      </div>

      <div class="mt-4">
        <DhDataTable
          :columns="columns"
          :rows="filteredRows"
          :loading="loading"
          empty-text="No hay consolidados LTL que coincidan con la búsqueda."
          @row-click="handleRowClick"
        >
          <template #cell-route="{ row }">
            <div class="min-w-0">
              <p class="font-black text-[var(--dh-text)]">{{ row.originName }} → {{ row.destinationName }}</p>
              <p class="mt-0.5 truncate text-xs text-[var(--dh-text-muted)]">
                {{ row.warehouseName || 'Sin almacén' }}<span v-if="row.source"> · {{ row.source }}</span>
              </p>
            </div>
          </template>

          <template #cell-profile="{ row }">
            <DhBadge :label="profileLabel(row.commercialProfile)" :variant="row.commercialProfile === 'Nvocc' ? 'warning' : 'neutral'" />
          </template>

          <template #cell-freight="{ row }">
            <div class="text-right">
              <p class="font-black">USD {{ money(effectiveRowCost(row)) }} costo</p>
              <p class="text-[11px] font-bold text-[var(--dh-primary)]">USD {{ money(row.priceAmount) }} venta</p>
              <p v-if="isPanamaOrigin(row)" class="text-[10px] text-[var(--dh-text-muted)]">
                incluye +USD {{ money(row.panamaCostSurchargePerCbm ?? DEFAULT_PANAMA_SURCHARGE_PER_CBM) }} Panamá
              </p>
            </div>
          </template>

          <template #cell-minimum="{ row }">
            <span class="font-black">USD {{ money(row.minimumAmount) }}</span>
          </template>

          <template #cell-documents="{ row }">
            <div class="text-right text-xs font-bold">
              <p>DUA {{ money(row.duaCost ?? DEFAULT_DUA_COST) }}</p>
              <p class="text-[var(--dh-text-muted)]">DUCA-T {{ money(row.ducaTCost ?? DEFAULT_DUCA_T_COST) }}</p>
            </div>
          </template>

          <template #cell-weight="{ row }">
            <span class="font-black">{{ money(row.weightKgPerCbm ?? DEFAULT_WEIGHT_KG_PER_CBM) }} kg/CBM</span>
          </template>

          <template #cell-transit="{ row }">
            <span class="font-bold">{{ row.transitDays == null ? '—' : row.transitDays + ' días' }}</span>
          </template>

          <template #cell-status="{ row }">
            <DhBadge :label="row.isActive ? 'Activa' : 'Inactiva'" :variant="row.isActive ? 'success' : 'neutral'" />
          </template>

          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-1" @click.stop>
              <DhButton :icon="Eye" variant="ghost" size="sm" aria-label="Ver consolidado" @click="openRow(row, 'view')" />
              <DhButton v-if="canUpdate" :icon="Edit3" variant="ghost" size="sm" aria-label="Editar consolidado" @click="openRow(row, 'edit')" />
            </div>
          </template>
        </DhDataTable>
      </div>
    </section>

    <section v-if="editorOpen" class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow)] backdrop-blur-2xl">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dh-border)] p-5">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <Truck class="h-5 w-5 text-[var(--dh-primary)]" />
            <h2 class="text-lg font-black">{{ routeTitle }}</h2>
            <DhBadge label="LTL · Terrestre" variant="neutral" />
            <DhBadge :label="profileLabel(form.commercialProfile)" :variant="form.commercialProfile === 'Nvocc' ? 'warning' : 'neutral'" />
            <DhBadge v-if="readOnly" label="Solo lectura" variant="neutral" />
          </div>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Los costos y ventas quedan ligados a esta ruta LTL propia y se reutilizan al cotizar.
          </p>
        </div>

        <DhButton :icon="X" variant="ghost" aria-label="Cerrar" @click="closeEditor" />
      </header>

      <div class="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div class="space-y-5">
          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <p class="mb-4 text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
              Datos del proyecto y ruta
            </p>

            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DhSelect
                v-model="form.commercialProfile"
                label="Perfil comercial"
                :disabled="readOnly"
                :options="[
                  { label: 'Cliente final', value: 'FinalClient' },
                  { label: 'NVOCC', value: 'Nvocc' },
                ]"
              />

              <PricingLocationSearchSelect
                v-model="form.originId"
                label="Origen terrestre"
                placeholder="Buscar origen"
                search-placeholder="Buscar ciudad o punto terrestre…"
                terminal-type="SD"
                :disabled="readOnly"
                :options="originLocationOptions"
              />

              <PricingLocationSearchSelect
                v-model="form.destinationId"
                label="Destino terrestre"
                placeholder="Buscar destino"
                search-placeholder="Buscar ciudad o punto terrestre…"
                terminal-type="SD"
                :disabled="readOnly"
                :options="destinationLocationOptions"
              />

              <DhSelect
                v-model="form.currencyId"
                label="Moneda"
                :disabled="readOnly"
                :options="catalogs.currencyOptions.value"
              />

              <DhInput v-model="form.transitDays" type="number" min="0" step="1" label="Días de tránsito" :disabled="readOnly" />
              <DhInput v-model="form.warehouseName" label="Almacén de ingreso" placeholder="Opcional" :disabled="readOnly" />
              <DhInput v-model="form.validFrom" type="date" label="Vigencia desde" :disabled="readOnly" />
              <DhInput v-model="form.validTo" type="date" label="Vigencia hasta" :disabled="readOnly" />
              <DhInput v-model="form.source" label="Fuente / proveedor" placeholder="Opcional" :disabled="readOnly" />
            </div>

            <div class="mt-4">
              <DhTextarea v-model="form.notes" label="Notas" :rows="3" :disabled="readOnly" />
            </div>

            <label class="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--dh-border)] px-4 py-3">
              <input v-model="form.isActive" type="checkbox" class="h-4 w-4" :disabled="readOnly" />
              <span>
                <strong class="block text-sm text-[var(--dh-text)]">Consolidado activo</strong>
                <span class="text-xs font-semibold text-[var(--dh-text-muted)]">Disponible para resolver nuevas cotizaciones LTL.</span>
              </span>
            </label>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
                Tarifario del consolidado · costos y ventas
              </p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                Igual que en LCL propio, los conceptos se editan en una matriz compacta. Venta/CBM y mínimo pertenecen a esta ruta.
              </p>
            </div>

            <div class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
              <table class="w-full min-w-[760px] text-sm">
                <thead class="bg-black/[0.025] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)] dark:bg-white/[0.03]">
                  <tr>
                    <th class="px-4 py-3 text-left">Concepto</th>
                    <th class="px-4 py-3 text-left">Base cobro</th>
                    <th class="px-4 py-3 text-right">Costo USD</th>
                    <th class="px-4 py-3 text-right">Venta USD</th>
                    <th class="px-4 py-3 text-right">Mínimo USD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3">
                      <p class="font-black">Flete terrestre LTL</p>
                      <p v-if="formIsPanamaOrigin" class="mt-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">
                        Al costo base se suma el recargo Panamá configurado abajo.
                      </p>
                    </td>
                    <td class="px-4 py-3 text-xs font-bold text-[var(--dh-text-muted)]">CBM</td>
                    <td class="px-4 py-3 text-right">
                      <input v-model="form.costPerCbm" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                    </td>
                    <td class="px-4 py-3 text-right">
                      <input v-model="form.priceAmount" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                    </td>
                    <td class="px-4 py-3 text-right">
                      <input v-model="form.minimumAmount" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                    </td>
                  </tr>

                  <tr class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3">
                      <p class="font-black">Stuffing</p>
                      <p class="mt-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">
                        Base LCL: USD 550 ÷ 60 CBM = USD {{ money(DEFAULT_STUFFING_COST_PER_CBM) }}/CBM.
                      </p>
                    </td>
                    <td class="px-4 py-3 text-xs font-bold text-[var(--dh-text-muted)]">CBM</td>
                    <td class="px-4 py-3 text-right">
                      <input v-model="form.stuffingCostPerCbm" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                    </td>
                    <td class="px-4 py-3 text-right">
                      <input v-model="form.stuffingSalePerCbm" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                    </td>
                    <td class="px-4 py-3 text-right text-xs font-bold text-[var(--dh-text-muted)]">—</td>
                  </tr>

                  <tr class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3 font-black">DUA</td>
                    <td class="px-4 py-3 text-xs font-bold text-[var(--dh-text-muted)]">Documento</td>
                    <td class="px-4 py-3 text-right">
                      <input v-model="form.duaCost" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                    </td>
                    <td class="px-4 py-3 text-right text-xs font-bold text-[var(--dh-text-muted)]">—</td>
                    <td class="px-4 py-3 text-right text-xs font-bold text-[var(--dh-text-muted)]">—</td>
                  </tr>

                  <tr class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3 font-black">DUCA-T</td>
                    <td class="px-4 py-3 text-xs font-bold text-[var(--dh-text-muted)]">Documento</td>
                    <td class="px-4 py-3 text-right">
                      <input v-model="form.ducaTCost" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                    </td>
                    <td class="px-4 py-3 text-right text-xs font-bold text-[var(--dh-text-muted)]">—</td>
                    <td class="px-4 py-3 text-right text-xs font-bold text-[var(--dh-text-muted)]">—</td>
                  </tr>

                  <tr class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3">
                      <p class="font-black">Recargo origen Panamá</p>
                      <p class="mt-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">
                        Se aplica únicamente cuando la ruta inicia en Panamá.
                      </p>
                    </td>
                    <td class="px-4 py-3 text-xs font-bold text-[var(--dh-text-muted)]">CBM</td>
                    <td class="px-4 py-3 text-right">
                      <input v-model="form.panamaCostSurchargePerCbm" type="number" min="0" step="0.01" :disabled="readOnly" class="w-32 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                    </td>
                    <td class="px-4 py-3 text-right text-xs font-bold text-[var(--dh-text-muted)]">—</td>
                    <td class="px-4 py-3 text-right text-xs font-bold text-[var(--dh-text-muted)]">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Regla de cubicaje LTL</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  Se compara el CBM dimensional contra el CBM por peso y se utiliza el mayor.
                </p>
              </div>

              <div class="w-full sm:w-64">
                <DhInput
                  v-model="form.weightKgPerCbm"
                  type="number"
                  min="0.01"
                  step="0.01"
                  label="Peso kg por CBM"
                  :disabled="readOnly"
                />
              </div>
            </div>

            <div class="mt-4 rounded-2xl border border-[var(--dh-primary)]/25 bg-[var(--dh-primary)]/5 px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]">
              CBM por peso = peso total kg ÷ {{ form.weightKgPerCbm || DEFAULT_WEIGHT_KG_PER_CBM }}. El valor inicial es 330 kg/CBM, no 500.
            </div>
          </section>
        </div>

        <aside class="space-y-4">
          <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-5 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Costo del consolidado</p>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-[var(--dh-border)] p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo base / CBM</p>
                <p class="mt-1 text-xl font-black">USD {{ money(form.costPerCbm) }}</p>
              </div>

              <div class="rounded-2xl border border-[var(--dh-border)] p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Recargo Panamá / CBM</p>
                <p class="mt-1 text-xl font-black">USD {{ money(formIsPanamaOrigin ? form.panamaCostSurchargePerCbm : 0) }}</p>
              </div>

              <div class="rounded-2xl border border-[var(--dh-border)] p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo terrestre / CBM</p>
                <p class="mt-1 text-xl font-black text-[var(--dh-primary)]">USD {{ money(effectiveCostPerCbm) }}</p>
              </div>

              <div class="rounded-2xl border border-[var(--dh-border)] p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Venta / CBM</p>
                <p class="mt-1 text-xl font-black text-[var(--dh-primary)]">USD {{ money(form.priceAmount) }}</p>
              </div>

              <div class="rounded-2xl border border-[var(--dh-border)] p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Stuffing C / V</p>
                <p class="mt-1 text-sm font-black">USD {{ money(form.stuffingCostPerCbm) }} / {{ money(form.stuffingSalePerCbm) }}</p>
              </div>

              <div class="rounded-2xl border border-[var(--dh-border)] p-4">
                <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Documentos</p>
                <p class="mt-1 text-xl font-black">USD {{ money(documentCostTotal) }}</p>
                <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">DUA + DUCA-T</p>
              </div>
            </div>

            <div class="mt-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo variable proyectado</p>
              <p class="mt-1 text-2xl font-black text-[var(--dh-primary)]">USD {{ money(variableCostPerCbm) }} / CBM</p>
              <p class="mt-1 text-xs font-bold text-[var(--dh-text-muted)]">Flete efectivo + Stuffing. Los documentos se mantienen por embarque.</p>
            </div>

            <div class="mt-3 rounded-2xl border border-[var(--dh-primary)]/25 bg-[var(--dh-primary)]/5 p-4">
              <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-primary)]">Venta mínima</p>
              <p class="mt-1 text-2xl font-black">USD {{ money(form.minimumAmount) }}</p>
              <p class="mt-1 text-xs font-bold text-[var(--dh-text-muted)]">La cotización usa el mayor entre CBM × venta y este mínimo.</p>
            </div>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 text-xs font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.025]">
            <p class="font-black text-[var(--dh-text)]">Regla de operación · LTL</p>
            <p class="mt-2">
              Peso inicial {{ form.weightKgPerCbm || DEFAULT_WEIGHT_KG_PER_CBM }} kg/CBM. DUA USD {{ money(form.duaCost) }}, DUCA-T USD {{ money(form.ducaTCost) }} y Stuffing con base LCL. Si el origen es Panamá se suma USD {{ money(form.panamaCostSurchargePerCbm) }}/CBM al costo terrestre.
            </p>
          </section>

          <div v-if="!readOnly" class="flex justify-end gap-2">
            <DhButton label="Cancelar" variant="secondary" @click="closeEditor" />
            <DhButton :label="selectedId ? 'Guardar consolidado' : 'Crear consolidado'" :loading="saving" @click="save" />
          </div>

          <div v-else class="flex justify-end">
            <DhButton v-if="canUpdate" label="Editar" :icon="Edit3" variant="secondary" @click="readOnly = false" />
          </div>
        </aside>
      </div>
    </section>
  </div>
</template>
