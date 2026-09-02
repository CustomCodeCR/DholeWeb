<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Edit3, Eye, Lock, Plus, RefreshCcw, Ship, X } from 'lucide-vue-next'
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import { DhDataTable, DhSearchInput, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import {
  OwnLclConsolidationService,
  type OwnLclAutomationSnapshotDto,
  type OwnLclConsolidationDto,
  type OwnLclDestinationProfileDto,
} from '@/core/services/ownLclConsolidationService'
import { useToastStore } from '@/core/stores/toastStore'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'
import PricingContainerSelector from '@/modules/pricing/components/PricingContainerSelector.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'

type OwnLclTableRow = OwnLclConsolidationDto & Record<string, unknown>

const toastStore = useToastStore()
const pricingCatalogs = usePricingCatalogs()
const loading = ref(false)
const saving = ref(false)
const previewLoading = ref(false)
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

const form = reactive({
  booking: '',
  etd: '',
  carrierId: '',
  containerId: '',
  polId: '',
  panamaArrivalPortCode: '',
  oceanFreight: 0,
  maximumCbm: 50,
  bunkerCost: 280,
  includeEmptyReturn: true,
})

const columns: DhTableColumn<OwnLclTableRow>[] = [
  { key: 'consolidation', label: 'Consolidado', width: '180px' },
  { key: 'route', label: 'Ruta / logística' },
  { key: 'etd', label: 'ETD', width: '120px' },
  { key: 'capacity', label: 'Capacidad', align: 'right', width: '120px' },
  { key: 'ocean', label: 'Ocean Freight', align: 'right', width: '150px' },
  { key: 'destination', label: 'Destino automático', align: 'right', width: '165px' },
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
  readOnly.value = false
  Object.assign(form, {
    booking: '', etd: '', carrierId: '', containerId: '', polId: '', panamaArrivalPortCode: '',
    oceanFreight: 0, maximumCbm: 50, bunkerCost: 280, includeEmptyReturn: true,
  })
}
function newConsolidation() {
  resetForm()
  editorOpen.value = true
}

async function openRow(row: OwnLclTableRow, mode: 'view' | 'edit') {
  selectedId.value = row.id
  readOnly.value = mode === 'view'
  editorOpen.value = true
  profilePreview.value = null
  Object.assign(form, {
    booking: row.booking ?? '',
    etd: row.etd ?? '',
    carrierId: row.carrierId ?? '',
    containerId: row.containerId ?? '',
    polId: row.polId ?? '',
    panamaArrivalPortCode: '',
    oceanFreight: row.oceanFreight,
    maximumCbm: row.maximumCbm,
    bunkerCost: row.bunkerCost,
    includeEmptyReturn: true,
  })
  try {
    selectedAutomation.value = await OwnLclConsolidationService.getAutomation(row.id)
    form.panamaArrivalPortCode = selectedAutomation.value.panamaArrivalPortCode ?? ''
    form.includeEmptyReturn = selectedAutomation.value.includeEmptyReturn
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
const previewDestinationTotal = computed(() => effectiveProfile.value?.totalCost ?? selected.value?.carrierDestinationCostTotal ?? 0)
const previewDestinationPerCbm = computed(() => effectiveProfile.value?.costPerCbm ?? previewDestinationTotal.value / Math.max(Number(form.maximumCbm || 50), 0.01))
const previewOceanPerCbm = computed(() => Number(form.oceanFreight || 0) / Math.max(Number(form.maximumCbm || 50), 0.01))
const previewTransfer = computed(() => effectiveProfile.value?.costaRicaTransfer.panamaToCostaRica ?? selected.value?.panamaToCostaRicaCost ?? 0)
const previewBunker = computed(() => Number(form.bunkerCost ?? effectiveProfile.value?.costaRicaTransfer.bunker ?? selected.value?.bunkerCost ?? 280))
const previewTransferBase = computed(() => effectiveProfile.value?.costaRicaTransfer.baseCbm ?? selected.value?.costaRicaTransferBaseCbm ?? 95)
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

async function save() {
  if (readOnly.value) return
  const body = buildPayload()
  if (!body.booking || !body.etd || !body.carrierCode || !body.panamaArrivalPortCode || !body.polCode || !body.containerCode || body.oceanFreight <= 0) {
    toastStore.warning('Datos incompletos', 'Ingrese booking y ETD; seleccione naviera, POE, POL y equipo; e indique el flete marítimo.')
    return
  }
  try {
    saving.value = true
    if (selectedId.value) {
      await OwnLclConsolidationService.update(selectedId.value, body)
      toastStore.success('Consolidado actualizado', 'Los costos y el POD se recalcularon con la Matriz de costos vigente.')
    } else {
      const created = await OwnLclConsolidationService.create(body)
      selectedId.value = created.id
      toastStore.success('Consolidado creado', `${created.name} fue creado con costos y POD automáticos.`)
    }
    await load()
    const row = rows.value.find((item) => item.id === selectedId.value)
    if (row) await openRow(row, 'view')
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
}

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <DhPageHeader
      title="Consolidados propios LCL"
      description="Administre el costo real de cada consolidado. El wizard LCL los consume después como fuente tarifaria, igual que un coloader."
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
          <DhButton label="Crear consolidado" :icon="Plus" @click="newConsolidation" />
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
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Este proyecto determina el costo del consolidado; la cotización se construye después en el wizard.</p>
        </div>
        <DhButton :icon="X" variant="ghost" aria-label="Cerrar" @click="closeEditor" />
      </header>

      <div class="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
        <div class="space-y-5">
          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <p class="mb-4 text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Datos del proyecto</p>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DhInput v-model="form.booking" label="Booking" placeholder="Booking de naviera" :disabled="readOnly" />
              <DhInput v-model="form.etd" type="date" label="ETD" :disabled="readOnly" />
              <DhSelect v-model="form.carrierId" label="Naviera" :disabled="readOnly" :options="[{ label: 'Seleccione', value: '' }, ...carriers.map((x) => ({ label: x.label, value: x.id }))]" />
              <PricingLocationSearchSelect
                v-model="form.polId"
                label="Origen (POL)"
                placeholder="Buscar puerto de origen"
                search-placeholder="Buscar ciudad, puerto o código…"
                terminal-type="CY"
                :disabled="readOnly"
                :options="polLocationOptions"
              />
              <PricingLocationSearchSelect
                v-model="form.panamaArrivalPortCode"
                label="Puerto de llegada naviera (POE)"
                placeholder="Buscar POE"
                search-placeholder="Buscar cualquier POE activo…"
                terminal-type="CY"
                :disabled="readOnly"
                :options="poeLocationOptions"
              />
              <div class="md:col-span-2 xl:col-span-2">
                <PricingContainerSelector
                  v-model="form.containerId"
                  transport="maritime"
                  :disabled="readOnly"
                />
              </div>
              <DhInput v-model.number="form.oceanFreight" type="number" label="Ocean Freight USD" :disabled="readOnly" />
              <DhInput v-model.number="form.maximumCbm" type="number" label="Capacidad máxima CBM" :disabled="readOnly" />
              <DhInput v-model.number="form.bunkerCost" type="number" min="0" step="0.01" label="Bunker Panamá → Costa Rica USD" :disabled="readOnly" />
              <div class="flex items-end pb-1"><DhCheckbox v-model="form.includeEmptyReturn" label="Incluir retiro de vacío" :disabled="readOnly" /></div>
            </div>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 dark:bg-white/[0.025]">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Cargos en destino automáticos</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Naviera + POE de llegada consultan directamente la Matriz de costos. Si no hay cargos LCL/Any, el destino queda en USD 0.00 y el consolidado se puede crear igual.</p>
              </div>
              <span class="inline-flex items-center gap-1 rounded-full border border-[var(--dh-border)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"><Lock class="h-3 w-3" /> bloqueado</span>
            </div>

            <div v-if="previewLoading" class="mt-4 text-sm font-bold text-[var(--dh-text-muted)]">Resolviendo costos...</div>
            <div v-else-if="effectiveProfile" class="mt-4 space-y-2">
              <div class="rounded-2xl border border-[var(--dh-primary)]/25 bg-[var(--dh-primary)]/5 px-4 py-3">
                <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">POD final</p>
                <p class="mt-1 text-sm font-black text-[var(--dh-text)]">
                  {{ effectiveProfile.finalRatePointName }}
                  <span v-if="effectiveProfile.finalRatePointCode" class="text-[var(--dh-text-muted)]">({{ effectiveProfile.finalRatePointCode }})</span>
                </p>
              </div>
              <div v-if="effectiveProfile.charges.length === 0" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]">
                No hay cargos LCL/Any aplicables para esta naviera + POE. Destino: USD 0.00. Esto no bloquea la creación del consolidado.
              </div>
              <div v-for="charge in effectiveProfile.charges" :key="charge.code" class="flex items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3">
                <div>
                  <p class="text-sm font-bold">{{ charge.name }}</p>
                  <p class="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">{{ charge.basis }}<span v-if="charge.optional"> · opcional</span></p>
                </div>
                <p class="font-black">USD {{ money(charge.included ? charge.amount : 0) }}</p>
              </div>
              <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ effectiveProfile.source }}
              </div>
            </div>
            <div v-else class="mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]">Seleccione naviera + POE para consultar la Matriz de costos. No se requiere configurar ningún perfil en Config.</div>
          </section>
        </div>

        <aside class="space-y-4">
          <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-5 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl">
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Costo del consolidado</p>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Ocean / CBM</p><p class="mt-1 text-xl font-black">USD {{ money(previewOceanPerCbm) }}</p></div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Destino / CBM</p><p class="mt-1 text-xl font-black">USD {{ money(previewDestinationPerCbm) }}</p></div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Base Panamá / CBM</p><p class="mt-1 text-xl font-black text-[var(--dh-primary)]">USD {{ money(previewOceanPerCbm + previewDestinationPerCbm) }}</p></div>
              <div class="rounded-2xl border border-[var(--dh-border)] p-4"><p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Panamá → CR / CBM</p><p class="mt-1 text-xl font-black">USD {{ money(previewCrTransferPerCbm) }}</p></div>
            </div>
            <div class="mt-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <p class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo proyectado Costa Rica</p>
              <p class="mt-1 text-2xl font-black text-[var(--dh-primary)]">USD {{ money(previewOceanPerCbm + previewDestinationPerCbm + previewCrTransferPerCbm) }} / CBM</p>
              <p class="mt-1 text-xs font-bold text-[var(--dh-text-muted)]">Base {{ decimal(form.maximumCbm) }} CBM</p>
            </div>
          </section>

          <section class="rounded-[24px] border border-[var(--dh-border)] bg-black/[0.018] p-4 text-xs font-semibold text-[var(--dh-text-muted)] dark:bg-white/[0.025]">
            <p class="font-black text-[var(--dh-text)]">Regla de operación</p>
            <p class="mt-2">Aquí se calcula y versiona el costo del proyecto. La venta y el margen se resuelven cuando el wizard usa este consolidado como fuente tarifaria.</p>
          </section>

          <div v-if="!readOnly" class="flex justify-end gap-2">
            <DhButton label="Cancelar" variant="secondary" @click="closeEditor" />
            <DhButton :label="selectedId ? 'Guardar consolidado' : 'Crear consolidado'" :loading="saving" :disabled="previewLoading" @click="save" />
          </div>
          <div v-else class="flex justify-end"><DhButton label="Editar" :icon="Edit3" variant="secondary" @click="readOnly = false; previewProfile()" /></div>
        </aside>
      </div>
    </section>
  </div>
</template>
