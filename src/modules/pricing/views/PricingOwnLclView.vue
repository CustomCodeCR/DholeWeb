<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Plus, RefreshCcw, Calculator, Ship, Trash2 } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { OwnLclConsolidationService, type OwnLclConsolidationDto, type OwnLclQuoteCalculationDto } from '@/core/services/ownLclConsolidationService'
import { useToastStore } from '@/core/stores/toastStore'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

const toastStore = useToastStore()
const loading = ref(false)
const saving = ref(false)
const calculating = ref(false)
const consolidations = ref<OwnLclConsolidationDto[]>([])
const carriers = ref<CatalogItemSelectDto[]>([])
const containers = ref<CatalogItemSelectDto[]>([])
const pols = ref<CatalogItemSelectDto[]>([])
const selectedId = ref('')
const calculation = ref<OwnLclQuoteCalculationDto | null>(null)

const consolidationForm = reactive({
  booking: '',
  etd: '',
  carrierId: '',
  containerId: '',
  polId: '',
  oceanFreight: 0,
  maximumCbm: 50,
  carrierDestinationCostTotal: 912,
  panamaToCostaRicaCost: 2140,
  bunkerCost: 280,
  costaRicaTransferBaseCbm: 95,
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
const money = (value: number | null | undefined) => Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const decimal = (value: number | null | undefined, digits = 3) => Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function catalogById(items: CatalogItemSelectDto[], id: string) {
  return items.find((x) => x.id === id) ?? null
}

async function load() {
  try {
    loading.value = true
    const [rows, carrierRows, containerRows, polRows] = await Promise.all([
      OwnLclConsolidationService.browse(),
      CatalogItemsService.select({ catalogGroupSlug: 'carriers' }),
      CatalogItemsService.select({ catalogGroupSlug: 'container-types' }).catch(() => CatalogItemsService.select({ catalogGroupSlug: 'containers-types' })),
      CatalogItemsService.select({ catalogGroupSlug: 'pol' }),
    ])
    consolidations.value = rows
    carriers.value = carrierRows
    containers.value = containerRows
    pols.value = polRows
    if (!selectedId.value && rows.length > 0) selectConsolidation(rows[0]!)
  } catch (error) {
    toastStore.backendError(error, 'No fue posible cargar los consolidados propios.')
  } finally {
    loading.value = false
  }
}

function resetNew() {
  selectedId.value = ''
  calculation.value = null
  Object.assign(consolidationForm, {
    booking: '', etd: '', carrierId: '', containerId: '', polId: '', oceanFreight: 0,
    maximumCbm: 50, carrierDestinationCostTotal: 912, panamaToCostaRicaCost: 2140,
    bunkerCost: 280, costaRicaTransferBaseCbm: 95,
  })
}

function selectConsolidation(row: OwnLclConsolidationDto) {
  selectedId.value = row.id
  calculation.value = null
  Object.assign(consolidationForm, {
    booking: row.booking ?? '', etd: row.etd ?? '', carrierId: row.carrierId ?? '',
    containerId: row.containerId ?? '', polId: row.polId ?? '', oceanFreight: row.oceanFreight,
    maximumCbm: row.maximumCbm, carrierDestinationCostTotal: row.carrierDestinationCostTotal,
    panamaToCostaRicaCost: row.panamaToCostaRicaCost, bunkerCost: row.bunkerCost,
    costaRicaTransferBaseCbm: row.costaRicaTransferBaseCbm,
  })
}

function buildConsolidationPayload() {
  const carrier = catalogById(carriers.value, consolidationForm.carrierId)
  const container = catalogById(containers.value, consolidationForm.containerId)
  const pol = catalogById(pols.value, consolidationForm.polId)
  return {
    booking: consolidationForm.booking.trim() || null,
    etd: consolidationForm.etd || null,
    carrierId: carrier?.id ?? null,
    carrierName: carrier?.label ?? null,
    carrierCode: carrier?.code ?? null,
    containerId: container?.id ?? null,
    containerName: container?.label ?? null,
    containerCode: container?.code ?? null,
    polId: pol?.id ?? null,
    polName: pol?.label ?? null,
    polCode: pol?.code || pol?.value || '',
    oceanFreight: Number(consolidationForm.oceanFreight || 0),
    maximumCbm: Number(consolidationForm.maximumCbm || 50),
    carrierDestinationCostTotal: Number(consolidationForm.carrierDestinationCostTotal || 0),
    panamaToCostaRicaCost: Number(consolidationForm.panamaToCostaRicaCost || 0),
    bunkerCost: Number(consolidationForm.bunkerCost || 0),
    costaRicaTransferBaseCbm: Number(consolidationForm.costaRicaTransferBaseCbm || 95),
  }
}

async function saveConsolidation() {
  try {
    saving.value = true
    const payload = buildConsolidationPayload()
    if (!payload.polCode || payload.oceanFreight <= 0) {
      toastStore.warning('Datos incompletos', 'Seleccione POL e indique el flete marítimo.')
      return
    }
    if (selectedId.value) {
      await OwnLclConsolidationService.update(selectedId.value, payload)
      toastStore.success('Consolidado actualizado', 'La matriz fue recalculada con los nuevos valores.')
    } else {
      const created = await OwnLclConsolidationService.create(payload)
      toastStore.success('Consolidado creado', `${created.name} creado automáticamente.`)
      selectedId.value = created.id
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
  try {
    calculating.value = true
    calculation.value = await OwnLclConsolidationService.calculate(selectedId.value, {
      destinationCode: quoteForm.destinationCode,
      incoterm: quoteForm.incoterm,
      cargoLines: cargoLines.value.map((line) => ({ ...line, units: Number(line.units || 0), totalWeightKg: Number(line.totalWeightKg || 0), lengthCm: Number(line.lengthCm || 0), widthCm: Number(line.widthCm || 0), heightCm: Number(line.heightCm || 0) })),
      polCode: selected.value?.polCode ?? null,
      salePerCbm: quoteForm.salePerCbm && quoteForm.salePerCbm > 0 ? Number(quoteForm.salePerCbm) : null,
      sets: Number(quoteForm.sets || 1), hbl: Number(quoteForm.hbl || 1),
      pickupCost: Number(quoteForm.pickupCost || 0), pickupSale: Number(quoteForm.pickupSale || 0), discount: Number(quoteForm.discount || 0),
    })
    if (quoteForm.salePerCbm == null || quoteForm.salePerCbm <= 0) quoteForm.salePerCbm = calculation.value.recommendedSalePerCbm
  } catch (error) {
    toastStore.backendError(error, 'No fue posible calcular la tarifa LCL propia.')
  } finally {
    calculating.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <DhPageHeader title="Consolidados LCL propios" description="China → Panamá, Costa Rica y Centroamérica con matriz automática por consolidado." />

    <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black">Consolidados</h2>
          <p class="text-sm text-[var(--dh-text-muted)]">Los #048 y #049 quedan versionados; los nuevos continúan la secuencia automáticamente.</p>
        </div>
        <div class="flex gap-2">
          <DhButton label="Actualizar" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
          <DhButton label="Crear LCL propio" :icon="Plus" @click="resetNew" />
        </div>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button v-for="row in consolidations" :key="row.id" type="button" class="rounded-xl border p-4 text-left transition hover:border-[var(--dh-primary)]" :class="selectedId === row.id ? 'border-[var(--dh-primary)] ring-1 ring-[var(--dh-primary)]' : 'border-[var(--dh-border)]'" @click="selectConsolidation(row)">
          <div class="flex items-center justify-between gap-2"><strong>{{ row.name }}</strong><Ship class="h-4 w-4" /></div>
          <div class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ row.matrixVersion }}</div>
          <div class="mt-2 text-sm">ETD: {{ row.etd || '—' }}</div>
          <div class="text-sm">{{ row.polName || row.polCode }} · {{ row.containerCode || row.containerName || 'Equipo pendiente' }}</div>
          <div class="mt-2 font-bold">Ocean Freight $ {{ money(row.oceanFreight) }}</div>
        </button>
      </div>
    </section>

    <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-black">{{ selected ? `Editar ${selected.name}` : 'Nuevo consolidado propio' }}</h2><span v-if="selected" class="text-xs font-bold text-[var(--dh-text-muted)]">{{ selected.matrixVersion }}</span></div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label class="field"><span>Booking</span><input v-model="consolidationForm.booking" /></label>
        <label class="field"><span>ETD</span><input v-model="consolidationForm.etd" type="date" /></label>
        <label class="field"><span>Naviera</span><select v-model="consolidationForm.carrierId"><option value="">Seleccione</option><option v-for="x in carriers" :key="x.id" :value="x.id">{{ x.label }}</option></select></label>
        <label class="field"><span>Contenedor</span><select v-model="consolidationForm.containerId"><option value="">Seleccione</option><option v-for="x in containers" :key="x.id" :value="x.id">{{ x.label }}</option></select></label>
        <label class="field"><span>POL</span><select v-model="consolidationForm.polId"><option value="">Seleccione</option><option v-for="x in pols" :key="x.id" :value="x.id">{{ x.label }}</option></select></label>
        <label class="field"><span>Flete marítimo USD</span><input v-model.number="consolidationForm.oceanFreight" type="number" min="0" step="0.01" /></label>
        <label class="field"><span>CBM máximo</span><input v-model.number="consolidationForm.maximumCbm" type="number" min="0.01" step="0.01" /></label>
        <label class="field"><span>Cargos destino naviera USD</span><input v-model.number="consolidationForm.carrierDestinationCostTotal" type="number" min="0" step="0.01" /></label>
        <label class="field"><span>Balboa/Panamá → Costa Rica USD</span><input v-model.number="consolidationForm.panamaToCostaRicaCost" type="number" min="0" step="0.01" /></label>
        <label class="field"><span>Bunker USD</span><input v-model.number="consolidationForm.bunkerCost" type="number" min="0" step="0.01" /></label>
        <label class="field"><span>Base transferencia CR (CBM)</span><input v-model.number="consolidationForm.costaRicaTransferBaseCbm" type="number" min="0.01" step="0.01" /></label>
      </div>
      <div class="mt-5 flex justify-end"><DhButton :label="selected ? 'Guardar cambios' : 'Crear consolidado'" :loading="saving" @click="saveConsolidation" /></div>
    </section>

    <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-5 shadow-sm">
      <h2 class="text-lg font-black">Cotizador del consolidado</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <label class="field"><span>Destino</span><select v-model="quoteForm.destinationCode"><option value="CR">Costa Rica</option><option value="PA">CFZ Panamá</option><option value="NI">Managua, Nicaragua</option><option value="HN">San Pedro Sula, Honduras</option><option value="GT">Ciudad de Guatemala</option><option value="SV">San Salvador</option></select></label>
        <label class="field"><span>Incoterm</span><select v-model="quoteForm.incoterm"><option>FOB</option><option>FCA</option><option>EXW</option></select></label>
        <label class="field"><span>Venta flete USD/CBM</span><input v-model.number="quoteForm.salePerCbm" type="number" min="0" step="0.01" placeholder="Automática" /></label>
        <label class="field"><span>SET</span><input v-model.number="quoteForm.sets" type="number" min="1" /></label>
        <label class="field"><span>HBL</span><input v-model.number="quoteForm.hbl" type="number" min="1" /></label>
        <label class="field"><span>Descuento USD</span><input v-model.number="quoteForm.discount" type="number" min="0" step="0.01" /></label>
        <label v-if="quoteForm.incoterm === 'EXW'" class="field"><span>Recolecta costo USD</span><input v-model.number="quoteForm.pickupCost" type="number" min="0" step="0.01" /></label>
        <label v-if="quoteForm.incoterm === 'EXW'" class="field"><span>Recolecta venta USD</span><input v-model.number="quoteForm.pickupSale" type="number" min="0" step="0.01" /></label>
      </div>

      <div class="mt-5 overflow-x-auto rounded-xl border border-[var(--dh-border)]">
        <table class="w-full min-w-[950px] text-sm">
          <thead class="bg-[var(--dh-surface-muted)] text-left"><tr><th class="p-3">Descripción</th><th class="p-3">Bultos</th><th class="p-3">KG</th><th class="p-3">Largo cm</th><th class="p-3">Ancho cm</th><th class="p-3">Alto cm</th><th class="p-3"></th></tr></thead>
          <tbody><tr v-for="(line,index) in cargoLines" :key="index" class="border-t border-[var(--dh-border)]"><td class="p-2"><input v-model="line.description" class="cell" /></td><td class="p-2"><input v-model.number="line.units" class="cell" type="number" min="1" /></td><td class="p-2"><input v-model.number="line.totalWeightKg" class="cell" type="number" min="0" step="0.01" /></td><td class="p-2"><input v-model.number="line.lengthCm" class="cell" type="number" min="0" step="0.01" /></td><td class="p-2"><input v-model.number="line.widthCm" class="cell" type="number" min="0" step="0.01" /></td><td class="p-2"><input v-model.number="line.heightCm" class="cell" type="number" min="0" step="0.01" /></td><td class="p-2"><button type="button" class="rounded p-2 hover:bg-red-50" @click="removeCargoLine(index)"><Trash2 class="h-4 w-4" /></button></td></tr></tbody>
        </table>
      </div>
      <div class="mt-3 flex flex-wrap justify-between gap-2"><DhButton label="Agregar línea" :icon="Plus" variant="secondary" @click="addCargoLine" /><DhButton label="Calcular tarifa" :icon="Calculator" :loading="calculating" @click="calculate" /></div>
    </section>

    <section v-if="calculation" class="space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-lg font-black">Resultado · {{ calculation.consolidationName }}</h2><p class="text-sm text-[var(--dh-text-muted)]">{{ calculation.matrixVersion }} · {{ calculation.polCode }} · {{ calculation.incoterm }}</p></div><div class="rounded-full px-4 py-2 text-sm font-black" :class="calculation.meetsMinimumMargin ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'">{{ calculation.meetsMinimumMargin ? 'Margen mínimo cumplido' : 'Requiere aprobación de margen' }}</div></div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div class="metric"><span>CBM cobrable</span><strong>{{ decimal(calculation.billableCbm) }}</strong></div>
        <div class="metric"><span>Costo total</span><strong>$ {{ money(calculation.totalCost) }}</strong></div>
        <div class="metric"><span>Venta final</span><strong>$ {{ money(calculation.finalSale) }}</strong></div>
        <div class="metric"><span>Utilidad</span><strong>$ {{ money(calculation.profitAmount) }}</strong></div>
        <div class="metric"><span>Utilidad / CBM</span><strong>$ {{ money(calculation.profitPerCbm) }}</strong></div>
        <div class="metric"><span>Utilidad %</span><strong>{{ money(calculation.profitPercentage) }}%</strong></div>
      </div>
      <div class="grid gap-3 md:grid-cols-3"><div class="metric"><span>Costo flete / CBM</span><strong>$ {{ money(calculation.freightCostPerCbm) }}</strong></div><div class="metric"><span>Venta recomendada / CBM</span><strong>$ {{ money(calculation.recommendedSalePerCbm) }}</strong></div><div class="metric"><span>Mínimo requerido</span><strong>$ {{ money(calculation.minimumProfitPerCbm) }} / CBM</strong></div></div>
      <div class="overflow-x-auto rounded-xl border border-[var(--dh-border)]"><table class="w-full min-w-[900px] text-sm"><thead class="bg-[var(--dh-surface-muted)]"><tr><th class="p-3 text-left">Rubro</th><th class="p-3">Base</th><th class="p-3">Cantidad</th><th class="p-3">Costo</th><th class="p-3">Venta</th><th class="p-3">Utilidad</th></tr></thead><tbody><tr v-for="line in calculation.lines" :key="`${line.name}-${line.chargeBasis}`" class="border-t border-[var(--dh-border)]"><td class="p-3 font-semibold">{{ line.name }}</td><td class="p-3 text-center">{{ line.chargeBasis }}</td><td class="p-3 text-center">{{ decimal(line.quantity) }}</td><td class="p-3 text-right">$ {{ money(line.costTotal) }}</td><td class="p-3 text-right">$ {{ money(line.saleTotal) }}</td><td class="p-3 text-right font-bold">$ {{ money(line.profit) }}</td></tr></tbody></table></div>
    </section>
  </div>
</template>

<style scoped>
.field { display:flex; flex-direction:column; gap:.35rem; font-size:.75rem; font-weight:800; text-transform:uppercase; color:var(--dh-text-muted); }
.field input,.field select,.cell { width:100%; border:1px solid var(--dh-border); border-radius:.65rem; background:var(--dh-surface); color:var(--dh-text); padding:.65rem .75rem; font-size:.875rem; font-weight:600; text-transform:none; outline:none; }
.field input:focus,.field select:focus,.cell:focus { border-color:var(--dh-primary); box-shadow:0 0 0 1px var(--dh-primary); }
.metric { border:1px solid var(--dh-border); border-radius:.8rem; padding:.85rem; background:var(--dh-surface-muted); display:flex; flex-direction:column; gap:.3rem; }
.metric span { font-size:.7rem; font-weight:800; text-transform:uppercase; color:var(--dh-text-muted); }
.metric strong { font-size:1.05rem; }
</style>
