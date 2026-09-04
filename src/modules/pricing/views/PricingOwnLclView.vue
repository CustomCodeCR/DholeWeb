<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Edit3, Eye, Plus, RefreshCcw, Ship, X } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import {
  OwnLclConsolidationService,
  createDefaultOwnLclPricingLines,
  type OwnLclAutomationSnapshotDto,
  type OwnLclConsolidationDto,
  type OwnLclDestinationProfileDto,
  type OwnLclFobScenarioMatrixDto,
  type OwnLclPricingLineDto,
} from '@/core/services/ownLclConsolidationService'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'
import PricingContainerSelector from '@/modules/pricing/components/PricingContainerSelector.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'

type OwnLclTableRow = OwnLclConsolidationDto & Record<string, unknown>

const toastStore = useToastStore()
const authStore = useAuthStore()
const pricingCatalogs = usePricingCatalogs()
const loading = ref(false)
const saving = ref(false)
const previewLoading = ref(false)
const scenarioLoading = ref(false)
const scenarioSaving = ref(false)
const pricingLineSaving = ref(false)
const pricingLines = ref<OwnLclPricingLineDto[]>(createDefaultOwnLclPricingLines())
const rows = ref<OwnLclTableRow[]>([])
const carriers = ref<CatalogItemSelectDto[]>([])
const containers = ref<CatalogItemSelectDto[]>([])
const pols = ref<CatalogItemSelectDto[]>([])
const poePorts = ref<CatalogItemSelectDto[]>([])
const search = ref('')
const statusFilter = ref('')
const selectedId = ref('')
const editorOpen = ref(false)
const readOnly = ref(false)
const selectedAutomation = ref<OwnLclAutomationSnapshotDto | null>(null)
const profilePreview = ref<OwnLclDestinationProfileDto | null>(null)
const scenarioMatrix = ref<OwnLclFobScenarioMatrixDto | null>(null)

const canCreateConsolidation = computed(() =>
  authStore.hasScope(PRICING_SCOPES.ownLclConsolidations.create)
  || authStore.hasRole('Administrador')
  || authStore.hasRole('Admin')
  || authStore.hasRole('Administrator'),
)

const form = reactive({
  booking: '',
  etd: '',
  carrierId: '',
  containerId: '',
  polId: '',
  panamaArrivalPortCode: '',
  oceanFreight: 0,
  maximumCbm: 50,
  carrierDestinationCostTotal: 0,
  panamaToCostaRicaCost: 2140,
  bunkerCost: 280,
  costaRicaTransferBaseCbm: 95,
  includeEmptyReturn: true,
})

const columns: DhTableColumn<OwnLclTableRow>[] = [
  { key: 'consolidation', label: 'Consolidado', width: '180px' },
  { key: 'route', label: 'Ruta / logística' },
  { key: 'etd', label: 'ETD', width: '120px' },
  { key: 'capacity', label: 'Capacidad', align: 'right', width: '120px' },
  { key: 'ocean', label: 'Ocean Freight', align: 'right', width: '150px' },
  { key: 'destination', label: 'Destino', align: 'right', width: '165px' },
  { key: 'costPerCbm', label: 'Costo base/CBM', align: 'right', width: '150px' },
  { key: 'status', label: 'Estado', width: '110px' },
  { key: 'actions', label: '', align: 'right', width: '110px' },
]

const money = (value: number | null | undefined) => Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const decimal = (value: number | null | undefined, digits = 2) => Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function option(items: CatalogItemSelectDto[], id: string) {
  return items.find((item) => item.id === id) ?? null
}
function normalize(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

const filteredRows = computed(() => {
  const q = normalize(search.value)
  return rows.value.filter((row) => {
    if (statusFilter.value && normalize(row.status) !== normalize(statusFilter.value)) return false
    if (!q) return true
    return [row.name, row.consolidationNumber, row.booking, row.carrierName, row.carrierCode, row.polName, row.polCode, row.containerName, row.containerCode, row.etd, row.matrixVersion]
      .some((value) => normalize(value).includes(q))
  })
})
const selected = computed(() => rows.value.find((row) => row.id === selectedId.value) ?? null)
const polLocationOptions = computed(() => pols.value.map((item) => ({
  value: item.id,
  label: item.label,
  searchText: [item.code, item.value, item.label].filter(Boolean).join(' '),
})))
const poeLocationOptions = computed(() => poePorts.value.map((item) => ({
  value: item.code || item.value,
  label: item.label,
  searchText: [item.code, item.value, item.label].filter(Boolean).join(' '),
})))
const pricingLineGroups = computed(() => [
  { scope: 'PA', label: 'Panamá', description: 'Cargos de destino Panamá.', rows: pricingLines.value.filter((line) => line.scope === 'PA') },
  { scope: 'CR', label: 'Costa Rica', description: 'Cargos fijos de destino Costa Rica.', rows: pricingLines.value.filter((line) => line.scope === 'CR') },
  { scope: 'CA', label: 'Centroamérica', description: 'Cargos fijos para Nicaragua, Honduras, El Salvador y Guatemala.', rows: pricingLines.value.filter((line) => line.scope === 'CA') },
  { scope: 'ORIGIN', label: 'Origen FCA / EXW', description: 'Manejos en origen. La recolección EXW sigue siendo específica de cada carga.', rows: pricingLines.value.filter((line) => line.scope === 'ORIGIN') },
])

function destinationPerCbm(row: OwnLclConsolidationDto) {
  return row.maximumCbm > 0 ? row.carrierDestinationCostTotal / row.maximumCbm : 0
}
function oceanPerCbm(row: OwnLclConsolidationDto) {
  return row.maximumCbm > 0 ? row.oceanFreight / row.maximumCbm : 0
}
function baseCostPerCbm(row: OwnLclConsolidationDto) {
  return oceanPerCbm(row) + destinationPerCbm(row)
}
function crTransferPerCbm(row: OwnLclConsolidationDto) {
  const base = row.costaRicaTransferBaseCbm || 95
  return base > 0 ? (row.panamaToCostaRicaCost + row.bunkerCost) / base : 0
}

async function load() {
  try {
    loading.value = true
    await pricingCatalogs.loadAll()
    const [consolidations, carrierRows, containerRows, polRows, poeRows] = await Promise.all([
      OwnLclConsolidationService.browse(),
      CatalogItemsService.select({ catalogGroupSlug: 'carriers' }),
      CatalogItemsService.select({ catalogGroupSlug: 'container-types' }).catch(() => CatalogItemsService.select({ catalogGroupSlug: 'containers-types' })),
      CatalogItemsService.select({ catalogGroupSlug: 'pol' }),
      CatalogItemsService.select({ catalogGroupSlug: 'poe' }).catch(() => CatalogItemsService.select({ catalogGroupSlug: 'ports' })),
    ])
    rows.value = consolidations.map((row) => ({ ...row })) as OwnLclTableRow[]
    carriers.value = carrierRows
    containers.value = containerRows
    pols.value = polRows
    poePorts.value = poeRows
  } catch (error) {
    toastStore.backendError(error, 'No fue posible cargar los consolidados propios.')
  } finally {
    loading.value = false
  }
}

function resetForm() {
  selectedId.value = ''
  selectedAutomation.value = null
  profilePreview.value = null
  scenarioMatrix.value = null
  pricingLines.value = createDefaultOwnLclPricingLines()
  readOnly.value = false
  Object.assign(form, {
    booking: '', etd: '', carrierId: '', containerId: '', polId: '', panamaArrivalPortCode: '',
    oceanFreight: 0, maximumCbm: 50, carrierDestinationCostTotal: 0,
    panamaToCostaRicaCost: 2140, bunkerCost: 280, costaRicaTransferBaseCbm: 95,
    includeEmptyReturn: true,
  })
}
function newConsolidation() {
  if (!canCreateConsolidation.value) {
    toastStore.warning('Permiso requerido', 'Necesita el scope pricing.own-lcl-consolidation.create para crear consolidados propios.')
    return
  }
  resetForm()
  editorOpen.value = true
}

async function loadScenarios(id: string) {
  try {
    scenarioLoading.value = true
    scenarioMatrix.value = await OwnLclConsolidationService.getFobScenarios(id)
  } catch (error) {
    scenarioMatrix.value = null
    toastStore.backendError(error, 'No fue posible cargar los escenarios FOB del consolidado.')
  } finally {
    scenarioLoading.value = false
  }
}

async function openRow(row: OwnLclTableRow, mode: 'view' | 'edit') {
  selectedId.value = row.id
  readOnly.value = mode === 'view'
  editorOpen.value = true
  profilePreview.value = null
  scenarioMatrix.value = null
  Object.assign(form, {
    booking: row.booking ?? '',
    etd: row.etd ?? '',
    carrierId: row.carrierId ?? '',
    containerId: row.containerId ?? '',
    polId: row.polId ?? '',
    panamaArrivalPortCode: '',
    oceanFreight: row.oceanFreight,
    maximumCbm: row.maximumCbm,
    carrierDestinationCostTotal: row.carrierDestinationCostTotal,
    panamaToCostaRicaCost: row.panamaToCostaRicaCost,
    bunkerCost: row.bunkerCost,
    costaRicaTransferBaseCbm: row.costaRicaTransferBaseCbm || 95,
    includeEmptyReturn: true,
  })
  try {
    const [automation, storedPricingLines] = await Promise.all([
      OwnLclConsolidationService.getAutomation(row.id),
      OwnLclConsolidationService.getPricingLines(row.id),
      loadScenarios(row.id),
    ])
    selectedAutomation.value = automation
    pricingLines.value = storedPricingLines
    form.panamaArrivalPortCode = automation.panamaArrivalPortCode ?? ''
    form.includeEmptyReturn = automation.includeEmptyReturn
  } catch (error) {
    selectedAutomation.value = null
    toastStore.backendError(error, 'No fue posible cargar el detalle automático del consolidado.')
  }
}
function handleRowClick(row: OwnLclTableRow) {
  void openRow(row, 'view')
}

async function previewProfile() {
  const carrier = option(carriers.value, form.carrierId)
  if (!carrier || !form.panamaArrivalPortCode) {
    profilePreview.value = null
    return
  }
  try {
    previewLoading.value = true
    const container = option(containers.value, form.containerId)
    profilePreview.value = await OwnLclConsolidationService.previewDestinationCosts({
      carrierCode: carrier.code || carrier.value,
      carrierName: carrier.label,
      arrivalPortCode: form.panamaArrivalPortCode,
      maximumCbm: Math.max(Number(form.maximumCbm || 50), 0.01),
      includeEmptyReturn: form.includeEmptyReturn,
      containerCode: container?.code || container?.value || null,
      bunkerCost: Math.max(Number(form.bunkerCost || 0), 0),
    })
    if (!selectedId.value && form.carrierDestinationCostTotal === 0) {
      form.carrierDestinationCostTotal = profilePreview.value.totalCost
    }
  } catch {
    profilePreview.value = null
  } finally {
    previewLoading.value = false
  }
}

watch(() => [form.carrierId, form.containerId, form.panamaArrivalPortCode, form.maximumCbm, form.bunkerCost, form.includeEmptyReturn], () => {
  if (!readOnly.value) void previewProfile()
})

const effectiveProfile = computed(() => profilePreview.value ?? selectedAutomation.value?.destinationProfile ?? null)
const previewDestinationTotal = computed(() => Number(form.carrierDestinationCostTotal ?? effectiveProfile.value?.totalCost ?? selected.value?.carrierDestinationCostTotal ?? 0))
const previewDestinationPerCbm = computed(() => previewDestinationTotal.value / Math.max(Number(form.maximumCbm || 50), 0.01))
const previewOceanPerCbm = computed(() => Number(form.oceanFreight || 0) / Math.max(Number(form.maximumCbm || 50), 0.01))
const previewTransfer = computed(() => Number(form.panamaToCostaRicaCost ?? selected.value?.panamaToCostaRicaCost ?? 2140))
const previewBunker = computed(() => Number(form.bunkerCost ?? effectiveProfile.value?.costaRicaTransfer.bunker ?? selected.value?.bunkerCost ?? 280))
const previewTransferBase = computed(() => Number(form.costaRicaTransferBaseCbm || selected.value?.costaRicaTransferBaseCbm || 95))
const previewCrTransferPerCbm = computed(() => (previewTransfer.value + previewBunker.value) / Math.max(previewTransferBase.value, 0.01))

function buildPayload() {
  const carrier = option(carriers.value, form.carrierId)
  const container = option(containers.value, form.containerId)
  const pol = option(pols.value, form.polId)
  const arrivalPoe = poePorts.value.find((item) => (item.code || item.value) === form.panamaArrivalPortCode) ?? null
  return {
    booking: form.booking.trim() || null,
    etd: form.etd || null,
    carrierId: carrier?.id ?? null,
    carrierName: carrier?.label ?? null,
    carrierCode: carrier?.code || carrier?.value || '',
    containerId: container?.id ?? null,
    containerName: container?.label ?? null,
    containerCode: container?.code || container?.value || '',
    polId: pol?.id ?? null,
    polName: pol?.label ?? null,
    polCode: pol?.code || pol?.value || '',
    oceanFreight: Number(form.oceanFreight || 0),
    maximumCbm: Number(form.maximumCbm || 50),
    panamaArrivalPortId: arrivalPoe?.id ?? null,
    panamaArrivalPortName: arrivalPoe?.label ?? null,
    panamaArrivalPortCode: form.panamaArrivalPortCode,
    includeEmptyReturn: form.includeEmptyReturn,
    bunkerCost: Math.max(Number(form.bunkerCost || 0), 0),
  }
}

function buildCostOverrides() {
  return {
    oceanFreight: Math.max(Number(form.oceanFreight || 0), 0),
    maximumCbm: Math.max(Number(form.maximumCbm || 50), 0.01),
    carrierDestinationCostTotal: Math.max(Number(form.carrierDestinationCostTotal || 0), 0),
    panamaToCostaRicaCost: Math.max(Number(form.panamaToCostaRicaCost || 0), 0),
    bunkerCost: Math.max(Number(form.bunkerCost || 0), 0),
    costaRicaTransferBaseCbm: Math.max(Number(form.costaRicaTransferBaseCbm || 95), 0.01),
  }
}

function buildPricingLinesPayload() {
  return {
    rows: pricingLines.value.map((line) => ({
      lineKey: line.lineKey,
      costUnit: line.lineKey === 'PA_DESTINATION_CHARGE'
        ? Math.max(previewDestinationPerCbm.value, 0)
        : Math.max(Number(line.costUnit || 0), 0),
      saleUnit: Math.max(Number(line.saleUnit || 0), 0),
    })),
  }
}

async function savePricingLineRows(showToast = true) {
  if (!selectedId.value) return
  pricingLineSaving.value = true
  try {
    await OwnLclConsolidationService.savePricingLines(selectedId.value, buildPricingLinesPayload())
    pricingLines.value = await OwnLclConsolidationService.getPricingLines(selectedId.value)
    if (showToast) toastStore.success('Tarifario guardado', 'Los costos y ventas por línea quedaron asociados únicamente a este consolidado.')
  } catch (error) {
    toastStore.backendError(error, 'No fue posible guardar los costos y ventas del consolidado.')
  } finally {
    pricingLineSaving.value = false
  }
}

async function saveScenarioRows(showToast = true) {
  if (!selectedId.value || !scenarioMatrix.value) return
  scenarioSaving.value = true
  try {
    await OwnLclConsolidationService.saveFobScenarios(selectedId.value, {
      rows: scenarioMatrix.value.countries.flatMap((country) => country.ports.map((port) => ({
        destinationCode: country.destinationCode,
        polCode: port.polCode,
        salePerCbm: Math.max(Number(port.salePerCbm || 0), 0),
      }))),
    })
    if (showToast) toastStore.success('Escenarios guardados', 'Las ventas FOB por país y puerto quedaron asociadas a este consolidado.')
    await loadScenarios(selectedId.value)
  } catch (error) {
    toastStore.backendError(error, 'No fue posible guardar los escenarios FOB.')
  } finally {
    scenarioSaving.value = false
  }
}

async function save() {
  if (readOnly.value) return
  const body = buildPayload()
  if (!body.booking || !body.etd || !body.carrierCode || !body.panamaArrivalPortCode || !body.polCode || !body.containerCode || body.oceanFreight <= 0) {
    toastStore.warning('Datos incompletos', 'Ingrese booking y ETD; seleccione naviera, POE, POL y equipo; e indique el flete marítimo.')
    return
  }
  const wasNew = !selectedId.value
  try {
    saving.value = true
    let targetId = selectedId.value
    if (targetId) {
      await OwnLclConsolidationService.update(targetId, body)
    } else {
      const created = await OwnLclConsolidationService.create(body)
      targetId = created.id
      selectedId.value = created.id
    }

    await OwnLclConsolidationService.saveCostOverrides(targetId, buildCostOverrides())
    await OwnLclConsolidationService.savePricingLines(targetId, buildPricingLinesPayload())
    if (!wasNew && scenarioMatrix.value) await saveScenarioRows(false)

    toastStore.success(
      wasNew ? 'Consolidado creado' : 'Consolidado actualizado',
      wasNew
        ? 'El consolidado fue creado con sus costos y ventas por línea. La matriz FOB queda disponible para ajustar la venta por país y puerto.'
        : 'Los costos y ventas quedaron guardados a nivel del consolidado y se reutilizarán en las próximas cotizaciones.',
    )

    await load()
    const row = rows.value.find((item) => item.id === targetId)
    if (row) await openRow(row, wasNew ? 'edit' : 'view')
  } catch (error) {
    toastStore.backendError(error, 'No fue posible guardar el consolidado.')
  } finally {
    saving.value = false
  }
}

function closeEditor() {
  editorOpen.value = false
  selectedAutomation.value = null
  profilePreview.value = null
  scenarioMatrix.value = null
  pricingLines.value = createDefaultOwnLclPricingLines()
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Consolidados propios LCL"
      description="Administre costos y ventas por consolidado. Las cotizaciones LCL consumen estos valores sin modificar el maestro global."
    />

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 shadow-[var(--dh-shadow-sm)] backdrop-blur-2xl">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="min-w-0 flex-1 lg:max-w-xl">
          <DhSearchInput v-model="search" placeholder="Buscar consolidado, booking, naviera, POL, equipo..." />
        </div>
        <DhSelect
          v-model="statusFilter"
          class="lg:w-52"
          :options="[
            { label: 'Todos los estados', value: '' },
            { label: 'Draft', value: 'Draft' },
            { label: 'Open', value: 'Open' },
            { label: 'Closed', value: 'Closed' },
          ]"
        />
        <div class="flex gap-2 lg:ml-auto">
          <DhButton label="Actualizar" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
          <DhButton v-if="canCreateConsolidation" label="Crear consolidado" :icon="Plus" @click="newConsolidation" />
        </div>
      </div>

      <div class="mt-4">
        <DhDataTable
          :columns="columns"
          :rows="filteredRows"
          :loading="loading"
          empty-text="No hay consolidados propios que coincidan con la búsqueda."
          @row-click="handleRowClick"
        >
          <template #cell-consolidation="{ row }">
            <div class="min-w-0">
              <p class="font-black text-[var(--dh-text)]">{{ row.name }}</p>
              <p class="mt-0.5 truncate text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ row.matrixVersion }}</p>
            </div>
          </template>
          <template #cell-route="{ row }">
            <div class="min-w-0">
              <p class="font-bold text-[var(--dh-text)]">{{ row.polName || row.polCode }} → {{ row.poeName || row.poeCode || 'POE pendiente' }}<span v-if="row.podName || row.podCode"> → {{ row.podName || row.podCode }}</span></p>
              <p class="mt-0.5 truncate text-xs text-[var(--dh-text-muted)]">{{ row.carrierName || row.carrierCode || 'Naviera pendiente' }} · {{ row.booking || 'Sin booking' }} · {{ row.containerCode || row.containerName || 'Sin equipo' }}</p>
            </div>
          </template>
          <template #cell-etd="{ row }"><span class="font-bold">{{ row.etd || '—' }}</span></template>
          <template #cell-capacity="{ row }"><span class="font-black">{{ decimal(row.maximumCbm) }} CBM</span></template>
          <template #cell-ocean="{ row }"><span class="font-black">USD {{ money(row.oceanFreight) }}</span></template>
          <template #cell-destination="{ row }">
            <div class="text-right">
              <p class="font-black">USD {{ money(row.carrierDestinationCostTotal) }}</p>
              <p class="text-[11px] text-[var(--dh-text-muted)]">{{ money(destinationPerCbm(row)) }}/CBM</p>
            </div>
          </template>
          <template #cell-costPerCbm="{ row }">
            <div class="text-right">
              <p class="font-black text-[var(--dh-primary)]">USD {{ money(baseCostPerCbm(row)) }}</p>
              <p class="text-[11px] text-[var(--dh-text-muted)]">CR +{{ money(crTransferPerCbm(row)) }}/CBM</p>
            </div>
          </template>
          <template #cell-status="{ row }"><DhBadge :label="row.status" :variant="row.status === 'Open' ? 'success' : 'neutral'" /></template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-1" @click.stop>
              <DhButton :icon="Eye" variant="ghost" size="sm" aria-label="Ver consolidado" @click="openRow(row, 'view')" />
              <DhButton :icon="Edit3" variant="ghost" size="sm" aria-label="Editar consolidado" @click="openRow(row, 'edit')" />
            </div>
          </template>
        </DhDataTable>
      </div>
    </section>

    <section v-if="editorOpen" class="rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow)] backdrop-blur-2xl">
      <header class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dh-border)] p-5">
        <div>
          <div class="flex items-center gap-2">
            <Ship class="h-5 w-5 text-[var(--dh-primary)]" />
            <h2 class="text-lg font-black">{{ selected ? selected.name : 'Nuevo consolidado propio' }}</h2>
            <DhBadge v-if="readOnly" label="Solo lectura" variant="neutral" />
          </div>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Los cambios de costo y venta quedan ligados únicamente a este consolidado.</p>
        </div>
        <DhButton :icon="X" variant="ghost" aria-label="Cerrar" @click="closeEditor" />
      </header>

      <div class="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div class="space-y-5">
          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <p class="mb-4 text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Datos del proyecto y costos</p>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DhInput v-model="form.booking" label="Booking" placeholder="Booking de naviera" :disabled="readOnly" />
              <DhInput v-model="form.etd" type="date" label="ETD" :disabled="readOnly" />
              <DhSelect v-model="form.carrierId" label="Naviera" :disabled="readOnly" :options="[{ label: 'Seleccione', value: '' }, ...carriers.map((x) => ({ label: x.label, value: x.id }))]" />
              <PricingLocationSearchSelect v-model="form.polId" label="Origen (POL)" placeholder="Buscar puerto de origen" search-placeholder="Buscar ciudad, puerto o código…" terminal-type="CY" :disabled="readOnly" :options="polLocationOptions" />
              <PricingLocationSearchSelect v-model="form.panamaArrivalPortCode" label="Puerto de llegada naviera (POE)" placeholder="Buscar POE" search-placeholder="Buscar cualquier POE activo…" terminal-type="CY" :disabled="readOnly" :options="poeLocationOptions" />
              <div class="md:col-span-2 xl:col-span-2"><PricingContainerSelector v-model="form.containerId" transport="maritime" :disabled="readOnly" /></div>
              <DhInput v-model.number="form.oceanFreight" type="number" min="0" step="0.01" label="Ocean Freight USD" :disabled="readOnly" />
              <DhInput v-model.number="form.maximumCbm" type="number" min="0.01" step="0.01" label="Capacidad máxima CBM" :disabled="readOnly" />
              <DhInput v-model.number="form.carrierDestinationCostTotal" type="number" min="0" step="0.01" label="Costos destino USD" :disabled="readOnly" />
              <DhInput v-model.number="form.bunkerCost" type="number" min="0" step="0.01" label="Bunker Panamá → Costa Rica USD" :disabled="readOnly" />
              <DhInput v-model.number="form.panamaToCostaRicaCost" type="number" min="0" step="0.01" label="Flete Terrestre Panamá → Costa Rica USD" :disabled="readOnly" />
              <DhInput v-model.number="form.costaRicaTransferBaseCbm" type="number" min="0.01" step="0.01" label="Base CBM flete terrestre" :disabled="readOnly" />
              <div class="flex items-end pb-1"><DhCheckbox v-model="form.includeEmptyReturn" label="Incluir retiro de vacío" :disabled="readOnly" /></div>
            </div>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Referencia automática de destino</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Naviera + POE consultan la Matriz de costos como referencia. El valor final puede ajustarse arriba para este consolidado.</p>
              </div>
              <span class="rounded-full border border-[var(--dh-primary)]/30 bg-[var(--dh-primary)]/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">editable por consolidado</span>
            </div>
            <div v-if="previewLoading" class="mt-4 text-sm font-bold text-[var(--dh-text-muted)]">Resolviendo costos...</div>
            <div v-else-if="effectiveProfile" class="mt-4 space-y-2">
              <div class="rounded-2xl border border-[var(--dh-primary)]/25 bg-[var(--dh-primary)]/5 px-4 py-3">
                <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">POD final</p>
                <p class="mt-1 text-sm font-black text-[var(--dh-text)]">{{ effectiveProfile.finalRatePointName }} <span v-if="effectiveProfile.finalRatePointCode" class="text-[var(--dh-text-muted)]">({{ effectiveProfile.finalRatePointCode }})</span></p>
              </div>
              <div v-if="effectiveProfile.charges.length === 0" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]">No hay cargos LCL/Any aplicables para esta naviera + POE. La referencia automática es USD 0.00.</div>
              <div v-for="charge in effectiveProfile.charges" :key="charge.code" class="flex items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3">
                <div><p class="text-sm font-bold">{{ charge.name }}</p><p class="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">{{ charge.basis }}<span v-if="charge.optional"> · opcional</span></p></div>
                <p class="font-black">USD {{ money(charge.included ? charge.amount : 0) }}</p>
              </div>
            </div>
            <div v-else class="mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]">Seleccione naviera + POE para consultar la Matriz de costos.</div>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Tarifario del consolidado · costos y ventas</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Estos valores pertenecen solo a este consolidado. Las cotizaciones LCL propias los cargan automáticamente y ya no hay que corregirlos cotización por cotización.</p>
              </div>
              <DhButton v-if="selectedId && !readOnly" label="Guardar costos y ventas" :loading="pricingLineSaving" variant="secondary" @click="savePricingLineRows()" />
            </div>

            <div class="mt-4 space-y-3">
              <details v-for="group in pricingLineGroups" :key="group.scope" class="group overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]" :open="group.scope === 'PA'">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <div><p class="font-black">{{ group.label }}</p><p class="mt-0.5 text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ group.description }}</p></div>
                  <span class="text-xs font-black text-[var(--dh-text-muted)]">{{ group.rows.length }} líneas ▾</span>
                </summary>
                <div class="overflow-x-auto border-t border-[var(--dh-border)]">
                  <table class="w-full min-w-[610px] text-sm">
                    <thead class="bg-black/[0.025] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)] dark:bg-white/[0.03]">
                      <tr><th class="px-4 py-2 text-left">Concepto</th><th class="px-4 py-2 text-left">Base</th><th class="px-4 py-2 text-right">Costo USD</th><th class="px-4 py-2 text-right">Venta USD</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="line in group.rows" :key="line.lineKey" class="border-t border-[var(--dh-border)] first:border-t-0">
                        <td class="px-4 py-2 font-black">{{ line.name }}<p v-if="line.lineKey === 'PA_DESTINATION_CHARGE'" class="mt-0.5 text-[10px] font-semibold text-[var(--dh-text-muted)]">Costo derivado de “Costos destino USD” ÷ capacidad CBM.</p></td>
                        <td class="px-4 py-2 text-xs font-bold text-[var(--dh-text-muted)]">{{ line.chargeBasis }}</td>
                        <td class="px-4 py-2 text-right">
                          <span v-if="line.lineKey === 'PA_DESTINATION_CHARGE'" class="inline-block min-w-28 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black">{{ money(previewDestinationPerCbm) }}</span>
                          <input v-else v-model.number="line.costUnit" type="number" min="0" step="0.01" :disabled="readOnly" class="w-28 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" />
                        </td>
                        <td class="px-4 py-2 text-right"><input v-model.number="line.saleUnit" type="number" min="0" step="0.01" :disabled="readOnly" class="w-28 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Escenarios FOB por país</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Abra un país para ver los puertos de China, el costo calculado y la venta asociada a este consolidado.</p>
              </div>
              <DhButton v-if="selectedId && !readOnly" label="Guardar ventas FOB" :loading="scenarioSaving" variant="secondary" @click="saveScenarioRows()" />
            </div>
            <div v-if="!selectedId" class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] p-4 text-xs font-semibold text-[var(--dh-text-muted)]">Guarde primero los datos base del consolidado para habilitar la matriz de ventas por país.</div>
            <div v-else-if="scenarioLoading" class="mt-4 text-sm font-bold text-[var(--dh-text-muted)]">Cargando escenarios...</div>
            <div v-else-if="scenarioMatrix" class="mt-4 space-y-2">
              <details v-for="country in scenarioMatrix.countries" :key="country.destinationCode" class="group overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]" :open="country.destinationCode === 'CR'">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-black"><span>{{ country.destinationName }} <span class="text-xs text-[var(--dh-text-muted)]">({{ country.destinationCode }})</span></span><span class="text-xs text-[var(--dh-text-muted)]">{{ country.ports.length }} puertos ▾</span></summary>
                <div class="overflow-x-auto border-t border-[var(--dh-border)]">
                  <table class="w-full min-w-[620px] text-sm">
                    <thead class="bg-black/[0.025] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)] dark:bg-white/[0.03]"><tr><th class="px-4 py-2 text-left">Puerto China</th><th class="px-4 py-2 text-right">Costo / CBM</th><th class="px-4 py-2 text-right">Venta / CBM</th><th class="px-4 py-2 text-right">Recomendada</th></tr></thead>
                    <tbody>
                      <tr v-for="port in country.ports" :key="`${country.destinationCode}-${port.polCode}`" class="border-t border-[var(--dh-border)] first:border-t-0">
                        <td class="px-4 py-2 font-black">{{ port.polCode }}</td>
                        <td class="px-4 py-2 text-right font-bold">USD {{ money(port.costPerCbm) }}</td>
                        <td class="px-4 py-2 text-right"><input v-model.number="port.salePerCbm" type="number" min="0" step="0.01" :disabled="readOnly" class="w-28 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-right font-black outline-none focus:border-[var(--dh-primary)] disabled:opacity-60" /></td>
                        <td class="px-4 py-2 text-right text-[var(--dh-text-muted)]">USD {{ money(port.recommendedSalePerCbm) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </section>
        </div>

        <aside class="space-y-4">
          <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-5 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Costo del consolidado</p>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Ocean / CBM</p><p class="mt-1 text-xl font-black">USD {{ money(previewOceanPerCbm) }}</p></div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Destino / CBM</p><p class="mt-1 text-xl font-black">USD {{ money(previewDestinationPerCbm) }}</p></div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Base Panamá / CBM</p><p class="mt-1 text-xl font-black text-[var(--dh-primary)]">USD {{ money(previewOceanPerCbm + previewDestinationPerCbm) }}</p></div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Flete terrestre + Bunker / CBM</p><p class="mt-1 text-xl font-black">USD {{ money(previewCrTransferPerCbm) }}</p></div>
            </div>
            <div class="mt-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo proyectado Costa Rica</p><p class="mt-1 text-2xl font-black text-[var(--dh-primary)]">USD {{ money(previewOceanPerCbm + previewDestinationPerCbm + previewCrTransferPerCbm) }} / CBM</p><p class="mt-1 text-xs font-bold text-[var(--dh-text-muted)]">Base {{ decimal(form.maximumCbm) }} CBM</p></div>
          </section>
          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 text-xs font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.025]"><p class="font-black text-[var(--dh-text)]">Regla de operación</p><p class="mt-2">Costos y ventas se guardan en el consolidado. Las cotizaciones posteriores toman esta matriz como fuente y ya no requieren cambiar los mismos valores una por una.</p></section>
          <div v-if="!readOnly" class="flex justify-end gap-2"><DhButton label="Cancelar" variant="secondary" @click="closeEditor" /><DhButton :label="selectedId ? 'Guardar consolidado' : 'Crear consolidado'" :loading="saving" :disabled="previewLoading" @click="save" /></div>
          <div v-else class="flex justify-end"><DhButton label="Editar" :icon="Edit3" variant="secondary" @click="readOnly = false; previewProfile()" /></div>
        </aside>
      </div>
    </section>
  </div>
</template>
