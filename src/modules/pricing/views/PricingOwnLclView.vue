<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Calculator, Lock, MapPin, Plus, RefreshCcw, Ship, Trash2 } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import {
  OwnLclConsolidationService,
  type OwnLclConsolidationDto,
  type OwnLclDestinationProfileDto,
  type OwnLclQuoteCalculationDto,
} from '@/core/services/ownLclConsolidationService'
import { useToastStore } from '@/core/stores/toastStore'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

const toastStore = useToastStore()
const loading = ref(false)
const saving = ref(false)
const calculating = ref(false)
const previewLoading = ref(false)
const consolidations = ref<OwnLclConsolidationDto[]>([])
const carriers = ref<CatalogItemSelectDto[]>([])
const containers = ref<CatalogItemSelectDto[]>([])
const pols = ref<CatalogItemSelectDto[]>([])
const arrivalPorts = ref<CatalogItemSelectDto[]>([])
const selectedId = ref('')
const calculation = ref<OwnLclQuoteCalculationDto | null>(null)
const destinationProfile = ref<OwnLclDestinationProfileDto | null>(null)
const profileError = ref('')
let previewTimer: number | undefined

const consolidationForm = reactive({
  booking: '',
  etd: '',
  carrierId: '',
  containerId: '',
  polId: '',
  panamaArrivalPortId: '',
  oceanFreight: 0,
  maximumCbm: 50,
  includeEmptyReturn: true,
})

const quoteForm = reactive({
  destinationCode: 'CR',
  incoterm: 'FOB',
  salePerCbm: null as number | null,
  sets: 1,
  hbl: 1,
  pickupCost: 0,
  pickupSale: 0,
  discount: 0,
})

const cargoLines = ref([
  { description: '', units: 1, totalWeightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0 },
])

const selected = computed(() => consolidations.value.find((x) => x.id === selectedId.value) ?? null)
const selectedCarrier = computed(() => catalogById(carriers.value, consolidationForm.carrierId))
const selectedContainer = computed(() => catalogById(containers.value, consolidationForm.containerId))
const selectedPol = computed(() => catalogById(pols.value, consolidationForm.polId))
const selectedArrivalPort = computed(() => catalogById(arrivalPorts.value, consolidationForm.panamaArrivalPortId))
const oceanCostPerCbm = computed(() => {
  const base = Number(consolidationForm.maximumCbm || 0)
  return base > 0 ? Number(consolidationForm.oceanFreight || 0) / base : 0
})
const canSave = computed(() => Boolean(
  selectedCarrier.value
  && selectedPol.value
  && selectedArrivalPort.value
  && Number(consolidationForm.oceanFreight) > 0
  && Number(consolidationForm.maximumCbm) > 0
  && destinationProfile.value,
))

const money = (value: number | null | undefined) => Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const decimal = (value: number | null | undefined, digits = 3) => Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function catalogById(items: CatalogItemSelectDto[], id: string) {
  return items.find((x) => x.id === id) ?? null
}

function catalogCode(item: CatalogItemSelectDto | null) {
  return String(item?.code || item?.value || '').trim()
}

function findArrivalPort(snapshot: { panamaArrivalPortId?: string | null; panamaArrivalPortCode?: string | null }) {
  if (snapshot.panamaArrivalPortId) {
    const byId = arrivalPorts.value.find((x) => x.id === snapshot.panamaArrivalPortId)
    if (byId) return byId
  }
  const code = String(snapshot.panamaArrivalPortCode || '').trim().toUpperCase()
  return arrivalPorts.value.find((x) => catalogCode(x).toUpperCase() === code) ?? null
}

async function load() {
  try {
    loading.value = true
    const [rows, carrierRows, containerRows, polRows, portRows] = await Promise.all([
      OwnLclConsolidationService.browse(),
      CatalogItemsService.select({ catalogGroupSlug: 'carriers' }),
      CatalogItemsService.select({ catalogGroupSlug: 'container-types' }).catch(() => CatalogItemsService.select({ catalogGroupSlug: 'containers-types' })),
      CatalogItemsService.select({ catalogGroupSlug: 'pol' }),
      CatalogItemsService.select({ catalogGroupSlug: 'pricing-panama-arrival-ports' }),
    ])
    consolidations.value = rows
    carriers.value = carrierRows
    containers.value = containerRows
    pols.value = polRows
    arrivalPorts.value = portRows

    if (!consolidationForm.panamaArrivalPortId && portRows.length === 1) {
      consolidationForm.panamaArrivalPortId = portRows[0]!.id
    }

    if (!selectedId.value && rows.length > 0) await selectConsolidation(rows[0]!)
    else scheduleDestinationPreview()
  } catch (error) {
    toastStore.backendError(error, 'No fue posible cargar los consolidados propios.')
  } finally {
    loading.value = false
  }
}

function resetNew() {
  selectedId.value = ''
  calculation.value = null
  destinationProfile.value = null
  profileError.value = ''
  Object.assign(consolidationForm, {
    booking: '',
    etd: '',
    carrierId: '',
    containerId: '',
    polId: '',
    panamaArrivalPortId: arrivalPorts.value.length === 1 ? arrivalPorts.value[0]!.id : '',
    oceanFreight: 0,
    maximumCbm: 50,
    includeEmptyReturn: true,
  })
}

async function selectConsolidation(row: OwnLclConsolidationDto) {
  selectedId.value = row.id
  calculation.value = null
  destinationProfile.value = null
  profileError.value = ''
  Object.assign(consolidationForm, {
    booking: row.booking ?? '',
    etd: row.etd ?? '',
    carrierId: row.carrierId ?? '',
    containerId: row.containerId ?? '',
    polId: row.polId ?? '',
    oceanFreight: row.oceanFreight,
    maximumCbm: row.maximumCbm || 50,
    includeEmptyReturn: true,
  })

  try {
    const automation = await OwnLclConsolidationService.getAutomation(row.id)
    const port = findArrivalPort(automation)
    consolidationForm.panamaArrivalPortId = port?.id
      ?? (arrivalPorts.value.length === 1 ? arrivalPorts.value[0]!.id : '')
    consolidationForm.includeEmptyReturn = automation.includeEmptyReturn
    destinationProfile.value = automation.destinationProfile
  } catch {
    consolidationForm.panamaArrivalPortId = arrivalPorts.value.length === 1 ? arrivalPorts.value[0]!.id : ''
  }

  scheduleDestinationPreview()
}

function buildConsolidationPayload() {
  const carrier = selectedCarrier.value
  const container = selectedContainer.value
  const pol = selectedPol.value
  const arrivalPort = selectedArrivalPort.value
  return {
    booking: consolidationForm.booking.trim() || null,
    etd: consolidationForm.etd || null,
    carrierId: carrier?.id ?? null,
    carrierName: carrier?.label ?? null,
    carrierCode: catalogCode(carrier) || null,
    containerId: container?.id ?? null,
    containerName: container?.label ?? null,
    containerCode: catalogCode(container) || null,
    polId: pol?.id ?? null,
    polName: pol?.label ?? null,
    polCode: catalogCode(pol),
    oceanFreight: Number(consolidationForm.oceanFreight || 0),
    maximumCbm: Number(consolidationForm.maximumCbm || 50),
    panamaArrivalPortId: arrivalPort?.id ?? null,
    panamaArrivalPortName: arrivalPort?.label ?? null,
    panamaArrivalPortCode: catalogCode(arrivalPort),
    includeEmptyReturn: Boolean(consolidationForm.includeEmptyReturn),
  }
}

async function refreshDestinationPreview() {
  const carrier = selectedCarrier.value
  const arrivalPort = selectedArrivalPort.value
  const maximumCbm = Number(consolidationForm.maximumCbm || 0)

  if (!carrier || !arrivalPort || maximumCbm <= 0) {
    destinationProfile.value = null
    profileError.value = ''
    return
  }

  try {
    previewLoading.value = true
    profileError.value = ''
    destinationProfile.value = await OwnLclConsolidationService.previewDestinationCosts({
      carrierCode: catalogCode(carrier),
      carrierName: carrier.label,
      arrivalPortCode: catalogCode(arrivalPort),
      maximumCbm,
      includeEmptyReturn: Boolean(consolidationForm.includeEmptyReturn),
    })
  } catch {
    destinationProfile.value = null
    profileError.value = `No hay un perfil de costos configurado para ${carrier.label} + ${arrivalPort.label}. Configure esa combinación en Config antes de cotizar.`
  } finally {
    previewLoading.value = false
  }
}

function scheduleDestinationPreview() {
  if (previewTimer) window.clearTimeout(previewTimer)
  previewTimer = window.setTimeout(() => void refreshDestinationPreview(), 180)
}

async function saveConsolidation() {
  try {
    saving.value = true
    await refreshDestinationPreview()
    const payload = buildConsolidationPayload()
    if (!payload.polCode || payload.oceanFreight <= 0 || !payload.carrierId || !payload.panamaArrivalPortCode) {
      toastStore.warning('Datos incompletos', 'Seleccione naviera, puerto de llegada en Panamá, POL e indique el flete marítimo.')
      return
    }
    if (!destinationProfile.value) {
      toastStore.warning('Costos sin configurar', 'No se puede crear el consolidado sin un perfil automático de naviera + puerto.')
      return
    }

    if (selectedId.value) {
      destinationProfile.value = await OwnLclConsolidationService.update(selectedId.value, payload)
      toastStore.success('Consolidado actualizado', 'Dhole recargó y congeló los costos automáticos del perfil vigente.')
    } else {
      const created = await OwnLclConsolidationService.create(payload)
      destinationProfile.value = created.destinationProfile
      selectedId.value = created.id
      toastStore.success('Consolidado creado', `${created.name} creado con cargos en destino automáticos.`)
    }
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No fue posible guardar el consolidado.')
  } finally {
    saving.value = false
  }
}

function addCargoLine() {
  cargoLines.value.push({ description: '', units: 1, totalWeightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0 })
}

function removeCargoLine(index: number) {
  if (cargoLines.value.length === 1) return
  cargoLines.value.splice(index, 1)
}

async function calculate() {
  if (!selectedId.value) {
    toastStore.warning('Seleccione un consolidado', 'Primero guarde o seleccione un consolidado propio.')
    return
  }
  if (!destinationProfile.value) {
    toastStore.warning('Costos sin configurar', 'La tarifa no puede calcularse hasta resolver naviera + puerto de llegada.')
    return
  }

  try {
    calculating.value = true
    calculation.value = await OwnLclConsolidationService.calculate(selectedId.value, {
      destinationCode: quoteForm.destinationCode,
      incoterm: quoteForm.incoterm,
      cargoLines: cargoLines.value.map((line) => ({
        ...line,
        units: Number(line.units || 0),
        totalWeightKg: Number(line.totalWeightKg || 0),
        lengthCm: Number(line.lengthCm || 0),
        widthCm: Number(line.widthCm || 0),
        heightCm: Number(line.heightCm || 0),
      })),
      polCode: selectedPol.value ? catalogCode(selectedPol.value) : selected.value?.polCode ?? null,
      salePerCbm: quoteForm.salePerCbm && quoteForm.salePerCbm > 0 ? Number(quoteForm.salePerCbm) : null,
      sets: Number(quoteForm.sets || 1),
      hbl: Number(quoteForm.hbl || 1),
      pickupCost: Number(quoteForm.pickupCost || 0),
      pickupSale: Number(quoteForm.pickupSale || 0),
      discount: Number(quoteForm.discount || 0),
    })
    if (quoteForm.salePerCbm == null || quoteForm.salePerCbm <= 0) {
      quoteForm.salePerCbm = calculation.value.recommendedSalePerCbm
    }
  } catch (error) {
    toastStore.backendError(error, 'No fue posible calcular la tarifa LCL propia.')
  } finally {
    calculating.value = false
  }
}

watch(
  () => [
    consolidationForm.carrierId,
    consolidationForm.panamaArrivalPortId,
    consolidationForm.maximumCbm,
    consolidationForm.includeEmptyReturn,
  ],
  scheduleDestinationPreview,
)

watch(
  () => [consolidationForm.polId, quoteForm.destinationCode, quoteForm.incoterm],
  () => {
    quoteForm.salePerCbm = null
    calculation.value = null
  },
)

onMounted(load)
</script>

<template>
  <div class="own-lcl-page space-y-6">
    <div class="liquid-orb liquid-orb-one" />
    <div class="liquid-orb liquid-orb-two" />

    <DhPageHeader
      title="Consolidados LCL propios"
      description="China → Panamá, Costa Rica y Centroamérica. Dhole calcula los costos; Pricing decide la venta."
    />

    <section class="glass-panel hero-panel overflow-hidden p-6 lg:p-7">
      <div class="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div class="max-w-3xl">
          <div class="glass-pill mb-4 inline-flex items-center gap-2">
            <Lock class="h-3.5 w-3.5" />
            Motor automático · costos protegidos
          </div>
          <h1 class="text-2xl font-black tracking-tight lg:text-3xl">Una matriz operativa, no una hoja para llenar.</h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-[var(--dh-text-muted)]">
            Selecciona naviera, puerto de llegada en Panamá, POL y capacidad. Los cargos operativos se cargan desde Config y quedan congelados en el consolidado. La venta recomendada sí puede ajustarse.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <DhButton label="Actualizar" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
          <DhButton label="Nuevo consolidado" :icon="Plus" @click="resetNew" />
        </div>
      </div>

      <div class="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="metric-glass"><span>Consolidados activos</span><strong>{{ consolidations.length }}</strong></div>
        <div class="metric-glass"><span>Base del proyecto</span><strong>{{ decimal(consolidationForm.maximumCbm, 0) }} CBM</strong></div>
        <div class="metric-glass"><span>Ocean Freight / CBM</span><strong>$ {{ money(oceanCostPerCbm) }}</strong></div>
        <div class="metric-glass"><span>Costo destino / CBM</span><strong>{{ destinationProfile ? `$ ${money(destinationProfile.costPerCbm)}` : 'Automático' }}</strong></div>
      </div>
    </section>

    <section class="glass-panel p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div><p class="eyebrow">Histórico versionado</p><h2 class="mt-1 text-lg font-black">Consolidados</h2></div>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">#048 y #049 se conservan; la secuencia siguiente es automática.</p>
      </div>
      <div class="mt-4 flex gap-3 overflow-x-auto pb-2">
        <button v-for="row in consolidations" :key="row.id" type="button" class="consolidation-card min-w-[250px] flex-1 text-left" :class="selectedId === row.id ? 'consolidation-card-active' : ''" @click="selectConsolidation(row)">
          <div class="flex items-center justify-between gap-3"><strong class="text-sm">{{ row.name }}</strong><Ship class="h-4 w-4 opacity-70" /></div>
          <div class="mt-1 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ row.matrixVersion }}</div>
          <div class="mt-3 text-xs">{{ row.polName || row.polCode }} · {{ row.containerCode || row.containerName || 'Equipo pendiente' }}</div>
          <div class="mt-1 text-xs text-[var(--dh-text-muted)]">ETD {{ row.etd || 'pendiente' }}</div>
          <div class="mt-3 text-sm font-black">OF $ {{ money(row.oceanFreight) }}</div>
        </button>
      </div>
    </section>

    <section class="grid gap-5 xl:grid-cols-12">
      <div class="glass-panel p-5 lg:p-6 xl:col-span-7">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><p class="eyebrow">01 · Definición del proyecto</p><h2 class="mt-1 text-xl font-black">{{ selected ? `Editar ${selected.name}` : 'Nuevo consolidado propio' }}</h2><p class="mt-1 text-xs text-[var(--dh-text-muted)]">La numeración y la versión de matriz las genera Dhole.</p></div>
          <span v-if="selected" class="glass-pill">{{ selected.matrixVersion }}</span>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <label class="field"><span>Booking</span><input v-model="consolidationForm.booking" placeholder="Número de booking" /></label>
          <label class="field"><span>ETD</span><input v-model="consolidationForm.etd" type="date" /></label>
          <label class="field"><span>Naviera</span><select v-model="consolidationForm.carrierId"><option value="">Seleccione naviera</option><option v-for="x in carriers" :key="x.id" :value="x.id">{{ x.label }}</option></select><small>Define automáticamente los cargos del puerto seleccionado.</small></label>
          <label class="field"><span>Puerto de llegada en Panamá</span><select v-model="consolidationForm.panamaArrivalPortId"><option value="">Seleccione puerto</option><option v-for="x in arrivalPorts" :key="x.id" :value="x.id">{{ x.label }}</option></select><small>Naviera + puerto seleccionan el perfil de costo.</small></label>
          <label class="field"><span>POL China</span><select v-model="consolidationForm.polId"><option value="">Seleccione POL</option><option v-for="x in pols" :key="x.id" :value="x.id">{{ x.label }}</option></select></label>
          <label class="field"><span>Contenedor</span><select v-model="consolidationForm.containerId"><option value="">Seleccione equipo</option><option v-for="x in containers" :key="x.id" :value="x.id">{{ x.label }}</option></select></label>
          <label class="field"><span>Flete marítimo USD</span><input v-model.number="consolidationForm.oceanFreight" type="number" min="0" step="0.01" /><small>Se divide automáticamente entre la base CBM.</small></label>
          <label class="field"><span>CBM máximo del consolidado</span><input v-model.number="consolidationForm.maximumCbm" type="number" min="0.01" step="0.01" /><small>Default 50 CBM, editable por proyecto.</small></label>
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/5 p-4">
          <div><p class="text-xs font-bold text-[var(--dh-text-muted)]">Costo Ocean Freight calculado</p><p class="mt-1 text-xl font-black">$ {{ money(oceanCostPerCbm) }} <span class="text-xs font-bold text-[var(--dh-text-muted)]">/ CBM</span></p></div>
          <DhButton :label="selected ? 'Guardar y recalcular matriz' : 'Crear consolidado automático'" :loading="saving" :disabled="!canSave" @click="saveConsolidation" />
        </div>
      </div>

      <aside class="glass-panel automatic-cost-panel p-5 lg:p-6 xl:col-span-5">
        <div class="flex items-start justify-between gap-3"><div><p class="eyebrow">02 · Cargos en destino</p><h2 class="mt-1 flex items-center gap-2 text-xl font-black"><Lock class="h-4 w-4" /> Automáticos</h2></div><span class="auto-badge">Config</span></div>
        <div class="mt-4 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-3"><MapPin class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" /><div class="min-w-0"><p class="truncate text-sm font-black">{{ selectedCarrier?.label || 'Seleccione naviera' }}</p><p class="truncate text-xs text-[var(--dh-text-muted)]">{{ selectedArrivalPort?.label || 'Puerto de llegada pendiente' }} → {{ destinationProfile?.finalRatePointName || 'Colón Free Zone' }}</p></div></div>

        <div v-if="previewLoading" class="mt-5 rounded-2xl border border-white/15 bg-white/5 p-5 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Resolviendo perfil de costos…</div>
        <div v-else-if="profileError" class="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4"><p class="text-sm font-black text-amber-600">Perfil pendiente de Config</p><p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ profileError }}</p></div>

        <template v-else-if="destinationProfile">
          <div class="mt-5 space-y-2">
            <div v-for="charge in destinationProfile.charges" :key="charge.code" class="cost-row" :class="!charge.included ? 'cost-row-muted' : ''">
              <div class="min-w-0"><div class="flex items-center gap-2"><span class="truncate text-sm font-bold">{{ charge.name }}</span><span v-if="charge.required" class="lock-dot"><Lock class="h-3 w-3" /></span></div><p v-if="charge.components.length" class="mt-1 text-[10px] leading-4 text-[var(--dh-text-muted)]">{{ charge.components.join(', ') }}</p><p v-else class="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--dh-text-muted)]">{{ charge.basis }}</p></div>
              <strong>$ {{ money(charge.amount) }}</strong>
            </div>
          </div>

          <label class="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 p-3"><div><p class="text-sm font-bold">Incluir retiro de vacío</p><p class="text-[10px] text-[var(--dh-text-muted)]">Único costo opcional de esta matriz.</p></div><input v-model="consolidationForm.includeEmptyReturn" type="checkbox" class="h-5 w-5 accent-[var(--dh-primary)]" /></label>

          <div class="cost-total mt-4"><div><span>Costo destino automático</span><strong>$ {{ money(destinationProfile.totalCost) }}</strong></div><div><span>Distribuido sobre {{ decimal(consolidationForm.maximumCbm, 0) }} CBM</span><strong>$ {{ money(destinationProfile.costPerCbm) }} / CBM</strong></div></div>
          <div class="mt-4 grid grid-cols-3 gap-2 text-center"><div class="mini-stat"><span>Panamá → CR</span><strong>$ {{ money(destinationProfile.costaRicaTransfer.panamaToCostaRica) }}</strong></div><div class="mini-stat"><span>Bunker</span><strong>$ {{ money(destinationProfile.costaRicaTransfer.bunker) }}</strong></div><div class="mini-stat"><span>Base CR</span><strong>{{ decimal(destinationProfile.costaRicaTransfer.baseCbm, 0) }} CBM</strong></div></div>
          <p class="mt-4 text-[10px] font-semibold leading-4 text-[var(--dh-text-muted)]">{{ destinationProfile.profileCode }} · {{ destinationProfile.version }} · Costos bloqueados desde {{ destinationProfile.source }}. Pricing no los edita manualmente.</p>
        </template>

        <div v-else class="mt-5 rounded-2xl border border-dashed border-[var(--dh-border)] p-5 text-center"><Lock class="mx-auto h-6 w-6 opacity-40" /><p class="mt-2 text-sm font-bold">Selecciona naviera y puerto</p><p class="mt-1 text-xs text-[var(--dh-text-muted)]">Dhole cargará el perfil automáticamente.</p></div>
      </aside>
    </section>

    <section class="glass-panel p-5 lg:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="eyebrow">03 · Cotización sobre el consolidado</p><h2 class="mt-1 text-xl font-black">Carga y venta</h2><p class="mt-1 text-xs text-[var(--dh-text-muted)]">La venta recomendada sale de la matriz; Pricing puede modificarla y Dhole vuelve a validar la utilidad.</p></div><DhButton label="Calcular tarifa" :icon="Calculator" :loading="calculating" :disabled="!selectedId || !destinationProfile" @click="calculate" /></div>

      <div class="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <label class="field"><span>Destino</span><select v-model="quoteForm.destinationCode"><option value="CR">Costa Rica</option><option value="PA">CFZ Panamá</option><option value="NI">Managua, Nicaragua</option><option value="HN">San Pedro Sula, Honduras</option><option value="GT">Ciudad de Guatemala</option><option value="SV">San Salvador</option></select></label>
        <label class="field"><span>Incoterm</span><select v-model="quoteForm.incoterm"><option>FOB</option><option>FCA</option><option>EXW</option></select></label>
        <label class="field"><span>Venta flete USD/CBM</span><input v-model.number="quoteForm.salePerCbm" type="number" min="0" step="0.01" placeholder="Recomendada por Dhole" /><small>Editable por Pricing.</small></label>
        <label class="field"><span>SET</span><input v-model.number="quoteForm.sets" type="number" min="1" /></label>
        <label class="field"><span>HBL</span><input v-model.number="quoteForm.hbl" type="number" min="1" /></label>
        <label class="field"><span>Descuento USD</span><input v-model.number="quoteForm.discount" type="number" min="0" step="0.01" /></label>
        <label v-if="quoteForm.incoterm === 'EXW'" class="field"><span>Recolecta costo USD</span><input v-model.number="quoteForm.pickupCost" type="number" min="0" step="0.01" /></label>
        <label v-if="quoteForm.incoterm === 'EXW'" class="field"><span>Recolecta venta USD</span><input v-model.number="quoteForm.pickupSale" type="number" min="0" step="0.01" /></label>
      </div>

      <div class="mt-5 overflow-x-auto rounded-2xl border border-white/15 bg-white/5"><table class="w-full min-w-[940px] text-sm"><thead><tr><th>Descripción</th><th>Unidades</th><th>Peso KG</th><th>Largo cm</th><th>Ancho cm</th><th>Alto cm</th><th></th></tr></thead><tbody><tr v-for="(line, index) in cargoLines" :key="index"><td><input v-model="line.description" placeholder="Carga" /></td><td><input v-model.number="line.units" type="number" min="0" /></td><td><input v-model.number="line.totalWeightKg" type="number" min="0" step="0.01" /></td><td><input v-model.number="line.lengthCm" type="number" min="0" step="0.01" /></td><td><input v-model.number="line.widthCm" type="number" min="0" step="0.01" /></td><td><input v-model.number="line.heightCm" type="number" min="0" step="0.01" /></td><td><button class="icon-button" type="button" title="Eliminar" @click="removeCargoLine(index)"><Trash2 class="h-4 w-4" /></button></td></tr></tbody></table></div>
      <button type="button" class="glass-action mt-3" @click="addCargoLine"><Plus class="h-4 w-4" /> Agregar línea de carga</button>
    </section>

    <section v-if="calculation" class="glass-panel p-5 lg:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="eyebrow">04 · Resultado</p><h2 class="mt-1 text-xl font-black">{{ calculation.consolidationName }} · {{ calculation.polCode }} → {{ calculation.destinationCode }}</h2></div><div class="glass-pill" :class="calculation.meetsMinimumMargin ? 'profit-ok' : 'profit-warning'">{{ calculation.meetsMinimumMargin ? 'Margen mínimo cumplido' : 'Requiere aprobación de margen' }}</div></div>
      <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><div class="result-card"><span>CBM cobrable</span><strong>{{ decimal(calculation.billableCbm) }}</strong></div><div class="result-card"><span>Costo total</span><strong>$ {{ money(calculation.totalCost) }}</strong></div><div class="result-card"><span>Venta final</span><strong>$ {{ money(calculation.finalSale) }}</strong></div><div class="result-card"><span>Utilidad</span><strong>$ {{ money(calculation.profitAmount) }}</strong></div><div class="result-card"><span>Utilidad / CBM</span><strong>$ {{ money(calculation.profitPerCbm) }}</strong></div><div class="result-card"><span>Utilidad %</span><strong>{{ money(calculation.profitPercentage) }}%</strong></div></div>
      <div class="mt-5 overflow-x-auto rounded-2xl border border-white/15 bg-white/5"><table class="w-full min-w-[900px] text-sm"><thead><tr><th>Rubro</th><th>Base</th><th>Cantidad</th><th>Costo unit.</th><th>Venta unit.</th><th>Costo</th><th>Venta</th><th>Profit</th></tr></thead><tbody><tr v-for="line in calculation.lines" :key="`${line.name}-${line.chargeBasis}`"><td class="font-bold">{{ line.name }}</td><td>{{ line.chargeBasis }}</td><td>{{ decimal(line.quantity) }}</td><td>$ {{ money(line.costUnit) }}</td><td>$ {{ money(line.saleUnit) }}</td><td>$ {{ money(line.costTotal) }}</td><td>$ {{ money(line.saleTotal) }}</td><td class="font-black">$ {{ money(line.profit) }}</td></tr></tbody></table></div>
      <div class="mt-4 grid gap-3 md:grid-cols-3"><div class="mini-stat"><span>Ocean cost base</span><strong>$ {{ money(calculation.baseOceanCostPerCbm) }}/CBM</strong></div><div class="mini-stat"><span>Destino automático</span><strong>$ {{ money(calculation.destinationCostPerCbm) }}/CBM</strong></div><div class="mini-stat"><span>Venta recomendada</span><strong>$ {{ money(calculation.recommendedSalePerCbm) }}/CBM</strong></div></div>
    </section>
  </div>
</template>

<style scoped>
.own-lcl-page{position:relative;isolation:isolate}.liquid-orb{pointer-events:none;position:fixed;z-index:-1;width:32rem;height:32rem;border-radius:999px;filter:blur(100px);opacity:.13}.liquid-orb-one{top:8rem;right:-12rem;background:var(--dh-primary)}.liquid-orb-two{bottom:5rem;left:-15rem;background:#6d5dfc;opacity:.08}.glass-panel{position:relative;border:1px solid color-mix(in srgb,var(--dh-border) 62%,rgba(255,255,255,.35));border-radius:1.5rem;background:color-mix(in srgb,var(--dh-surface) 78%,transparent);box-shadow:0 24px 70px rgba(15,23,42,.08),inset 0 1px 0 rgba(255,255,255,.35);backdrop-filter:blur(24px) saturate(155%);-webkit-backdrop-filter:blur(24px) saturate(155%)}.hero-panel::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 88% 12%,color-mix(in srgb,var(--dh-primary) 16%,transparent),transparent 34%),linear-gradient(135deg,rgba(255,255,255,.08),transparent 50%)}.glass-pill,.auto-badge{border:1px solid color-mix(in srgb,var(--dh-border) 58%,rgba(255,255,255,.45));border-radius:999px;background:color-mix(in srgb,var(--dh-surface) 62%,transparent);padding:.42rem .72rem;font-size:.68rem;font-weight:900;letter-spacing:.04em;backdrop-filter:blur(16px)}.auto-badge{color:var(--dh-primary)}.metric-glass,.result-card,.mini-stat{border:1px solid rgba(255,255,255,.16);background:color-mix(in srgb,var(--dh-surface) 62%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.2);backdrop-filter:blur(14px)}.metric-glass{border-radius:1.1rem;padding:.9rem 1rem}.metric-glass span,.result-card span,.mini-stat span{display:block;font-size:.66rem;font-weight:800;color:var(--dh-text-muted)}.metric-glass strong{display:block;margin-top:.28rem;font-size:1.05rem}.eyebrow{font-size:.66rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:var(--dh-primary)}.consolidation-card{border:1px solid color-mix(in srgb,var(--dh-border) 70%,transparent);border-radius:1.15rem;background:color-mix(in srgb,var(--dh-surface) 60%,transparent);padding:1rem;backdrop-filter:blur(16px);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.consolidation-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--dh-primary) 55%,var(--dh-border))}.consolidation-card-active{border-color:color-mix(in srgb,var(--dh-primary) 70%,white 10%);box-shadow:0 10px 30px color-mix(in srgb,var(--dh-primary) 12%,transparent),inset 0 1px 0 rgba(255,255,255,.22)}.field{display:flex;flex-direction:column;gap:.42rem}.field>span{font-size:.68rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--dh-text-muted)}.field small{font-size:.66rem;line-height:1.2rem;color:var(--dh-text-muted)}.field input,.field select,td input{width:100%;min-height:2.7rem;border:1px solid color-mix(in srgb,var(--dh-border) 70%,transparent);border-radius:.9rem;background:color-mix(in srgb,var(--dh-surface) 65%,transparent);color:var(--dh-text);padding:.65rem .8rem;outline:none;backdrop-filter:blur(12px);transition:border-color .18s ease,box-shadow .18s ease}.field input:focus,.field select:focus,td input:focus{border-color:color-mix(in srgb,var(--dh-primary) 70%,white 10%);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.automatic-cost-panel{overflow:hidden}.automatic-cost-panel::after{content:'';position:absolute;width:15rem;height:15rem;right:-7rem;bottom:-8rem;border-radius:999px;background:color-mix(in srgb,var(--dh-primary) 14%,transparent);filter:blur(50px);pointer-events:none}.cost-row{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:1rem;border:1px solid rgba(255,255,255,.14);border-radius:1rem;background:rgba(255,255,255,.035);padding:.8rem .9rem}.cost-row-muted{opacity:.42}.lock-dot{display:inline-flex;align-items:center;justify-content:center;width:1.25rem;height:1.25rem;border-radius:999px;background:color-mix(in srgb,var(--dh-primary) 12%,transparent);color:var(--dh-primary)}.cost-total{position:relative;z-index:1;display:grid;gap:.6rem;border:1px solid color-mix(in srgb,var(--dh-primary) 24%,var(--dh-border));border-radius:1.1rem;background:color-mix(in srgb,var(--dh-primary) 7%,transparent);padding:1rem}.cost-total>div{display:flex;align-items:baseline;justify-content:space-between;gap:1rem}.cost-total span{font-size:.68rem;font-weight:800;color:var(--dh-text-muted)}.cost-total strong{font-size:.92rem}.mini-stat{border-radius:.9rem;padding:.75rem .55rem}.mini-stat strong{display:block;margin-top:.3rem;font-size:.78rem}.result-card{border-radius:1rem;padding:1rem}.result-card strong{display:block;margin-top:.35rem;font-size:1.12rem}.glass-action,.icon-button{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border:1px solid color-mix(in srgb,var(--dh-border) 70%,transparent);background:color-mix(in srgb,var(--dh-surface) 64%,transparent);color:var(--dh-text);backdrop-filter:blur(12px)}.glass-action{border-radius:.8rem;padding:.6rem .8rem;font-size:.75rem;font-weight:900}.icon-button{height:2.2rem;width:2.2rem;border-radius:.7rem}.profit-ok{color:#0f8a54}.profit-warning{color:#c16a0b}table th{padding:.7rem .65rem;text-align:left;font-size:.64rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--dh-text-muted);background:rgba(255,255,255,.035)}table td{border-top:1px solid rgba(255,255,255,.09);padding:.55rem .65rem}table td input{min-height:2.3rem;border-radius:.7rem}@media(prefers-reduced-motion:reduce){.consolidation-card{transition:none}}
</style>
