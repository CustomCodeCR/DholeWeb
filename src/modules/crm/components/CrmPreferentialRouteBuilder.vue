<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { CostSelectDto } from '@/core/interfaces/pricing'
import CrmMultiCatalogPicker from './CrmMultiCatalogPicker.vue'
import DhSelect from '@/shared/components/atoms/DhSelect.vue'
import { crmError, crmPath, crmRequest } from '../services/crmApi'
import { matchesPreferentialRoute, saleUnitForBasis, type PreferentialShipment } from '../utils/crmPreferentialCostRoute'

type SavedRate = {
  id: string; rowVersion: number; modality: string; laneCode: string | null
  sourceCostId?: string | null; chargeCode: string; rateType: string; value: number | null
  insuranceCostPercent: number | null; insuranceSalePercent: number | null
  equipmentCodes: string[]; polCodes: string[]; poeCodes: string[]; podCodes: string[]; isActive: boolean
}
const props = defineProps<{
  accountId: string; categoryType: string; categoryCode: string
  costs: CostSelectDto[]; rates: SavedRate[]
  canReadPricingConcepts: boolean; costsLoading: boolean
}>()
const emit = defineEmits<{ saved: [] }>()
const route = reactive({
  modality: 'MARITIME' as 'MARITIME' | 'TERRESTRIAL',
  shipment: 'FCL' as PreferentialShipment,
  equipmentCodes: [] as string[], polCodes: [] as string[],
  poeCodes: [] as string[], podCodes: [] as string[],
})
const preview = ref(false), saving = ref(false), error = ref(''), success = ref('')
const editedSales = ref<Record<string, string>>({})
const insuranceEnabled = ref(false), insuranceCost = ref(''), insuranceSale = ref('')
const modalityOptions = [
  { value: 'MARITIME', label: 'Marítimo' },
  { value: 'TERRESTRIAL', label: 'Terrestre' },
]
const options = computed(() => route.modality === 'MARITIME'
  ? [{ value: 'FCL', label: 'FCL' }, { value: 'LCL', label: 'LCL propio' }]
  : [{ value: 'FTL', label: 'FTL' }, { value: 'LTL', label: 'LTL propio' }])
const laneCode = computed(() => ['LCL', 'LTL'].includes(route.shipment) ? 'OWN' : null)
const equipmentGroups = computed(() => route.modality === 'MARITIME'
  ? ['container-types'] : ['land-equipment-sizes', 'land-equipment-types'])
const isComplete = computed(() => [route.equipmentCodes, route.polCodes, route.poeCodes].every(x => x.length === 1) &&
  (route.modality === 'TERRESTRIAL' || route.podCodes.length === 1))
const categoryLabel = computed(() => props.categoryType === 'LITTLE' ? 'Cargas Little'
  : props.categoryType === 'NVOCC' ? 'NVOCC ' + props.categoryCode : 'Cliente ' + props.categoryCode)
const costsForRoute = computed(() => !preview.value || !isComplete.value ? [] : props.costs
  .filter(cost => cost.costDetailType !== 'Insurance' && matchesPreferentialRoute(cost, {
    shipment: route.shipment, polCode: route.polCodes[0] ?? '',
    poeCode: route.poeCodes[0] ?? '', podCode: route.podCodes[0] ?? '',
  }))
  .sort((a, b) => a.costDetailType.localeCompare(b.costDetailType) || a.name.localeCompare(b.name, 'es')))
const normalized = (codes: string[] | undefined) => (codes ?? []).map(x => x.toUpperCase()).sort().join('|')
function scopeMatches(rate: SavedRate) {
  return rate.modality === route.shipment && rate.laneCode === laneCode.value &&
    normalized(rate.equipmentCodes) === normalized(route.equipmentCodes) &&
    normalized(rate.polCodes) === normalized(route.polCodes) &&
    normalized(rate.poeCodes) === normalized(route.poeCodes) &&
    normalized(rate.podCodes) === (route.modality === 'MARITIME' ? normalized(route.podCodes) : '')
}
function existingCost(cost: CostSelectDto) {
  return props.rates.find(x => x.isActive && x.sourceCostId?.toLowerCase() === cost.id.toLowerCase() && scopeMatches(x))
}
function existingInsurance() {
  return props.rates.find(x => x.isActive && x.rateType === 'INSURANCE_PERCENT' &&
    x.chargeCode === 'Insurance' && scopeMatches(x))
}
function resetPreview() {
  preview.value = false; editedSales.value = {}; error.value = ''; success.value = ''
  insuranceEnabled.value = false; insuranceCost.value = ''; insuranceSale.value = ''
}
function changeModality(value: 'MARITIME' | 'TERRESTRIAL') {
  route.modality = value; route.shipment = value === 'MARITIME' ? 'FCL' : 'FTL'
  route.equipmentCodes = []; route.polCodes = []; route.poeCodes = []; route.podCodes = []
}
watch(() => [route.modality, route.shipment, route.equipmentCodes.join('|'),
  route.polCodes.join('|'), route.poeCodes.join('|'), route.podCodes.join('|')], resetPreview)
function consult() {
  error.value = ''; success.value = ''
  if (!isComplete.value) {
    error.value = 'Seleccioná exactamente un POL, POE, equipo y, si es marítimo, POD.'
    return
  }
  if (!props.canReadPricingConcepts) {
    error.value = 'No tenés el permiso pricing.cost.select para cargar los costos y recargos de Pricing.'
    return
  }
  editedSales.value = {}; preview.value = true
  const insured = existingInsurance()
  insuranceEnabled.value = !!insured
  insuranceCost.value = insured?.insuranceCostPercent == null ? '' : String(insured.insuranceCostPercent)
  insuranceSale.value = insured?.insuranceSalePercent == null ? '' : String(insured.insuranceSalePercent)
}
function saleValue(cost: CostSelectDto) {
  return Object.prototype.hasOwnProperty.call(editedSales.value, cost.id)
    ? (editedSales.value[cost.id] ?? '') : String(existingCost(cost)?.value ?? cost.saleAmount)
}
function editSale(cost: CostSelectDto, value: string) {
  editedSales.value = { ...editedSales.value, [cost.id]: value }
}
const money = (value: number, code: string) =>
  code + ' ' + Number(value ?? 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const validPercent = (value: string) =>
  value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100
function scope() {
  return {
    modality: route.shipment, laneCode: laneCode.value,
    equipmentCodes: [...route.equipmentCodes], polCodes: [...route.polCodes],
    poeCodes: [...route.poeCodes], podCodes: route.modality === 'MARITIME' ? [...route.podCodes] : [],
    equipmentCode: null, originCode: null, destinationCode: null,
    validFrom: null, validUntil: null, notes: null, isActive: true,
  }
}
async function save() {
  if (!preview.value || saving.value || !isComplete.value) return
  error.value = ''; success.value = ''
  const modified = costsForRoute.value.filter(x => Object.prototype.hasOwnProperty.call(editedSales.value, x.id))
  if (!modified.length && !insuranceEnabled.value) {
    error.value = 'Modificá un precio de venta o configurá los porcentajes de seguro.'
    return
  }
  for (const cost of modified) {
    if (!saleValue(cost).trim() || !Number.isFinite(Number(saleValue(cost))) || Number(saleValue(cost)) < 0) {
      error.value = 'La venta de ' + cost.name + ' debe ser un número válido y no negativo.'
      return
    }
    if (!['USD', 'CRC'].includes(cost.currencyCode.toUpperCase())) {
      error.value = 'El ítem ' + cost.name + ' utiliza una moneda que requiere conversión antes de guardarse.'
      return
    }
  }
  if (insuranceEnabled.value && (!validPercent(insuranceCost.value) || !validPercent(insuranceSale.value))) {
    error.value = 'El seguro requiere porcentajes de costo y venta entre 0 y 100 %, aplicados al valor de la mercancía.'
    return
  }
  let count = 0; saving.value = true
  const base = crmPath('accounts', props.accountId, 'commercial-benefits/rates')
  try {
    for (const cost of modified) {
      const existing = existingCost(cost)
      const body = {
        ...scope(), expectedVersion: existing?.rowVersion ?? null,
        sourceCostId: cost.id, chargeCode: cost.costDetailType,
        customChargeName: cost.name.slice(0, 120), rateType: 'FIXED_AMOUNT',
        value: Number(saleValue(cost)), minimumCharge: null,
        insuranceCostPercent: null, insuranceSalePercent: null,
        currencyCode: cost.currencyCode.toUpperCase(),
        unitCode: saleUnitForBasis(cost.chargeBasis),
      }
      await crmRequest(base + (existing ? '/' + encodeURIComponent(existing.id) : ''),
        existing ? 'PUT' : 'POST', body)
      count++
    }
    if (insuranceEnabled.value) {
      const existing = existingInsurance()
      const body = {
        ...scope(), expectedVersion: existing?.rowVersion ?? null,
        sourceCostId: null, chargeCode: 'Insurance', customChargeName: null,
        rateType: 'INSURANCE_PERCENT', value: Number(insuranceSale.value),
        insuranceCostPercent: Number(insuranceCost.value), insuranceSalePercent: Number(insuranceSale.value),
        minimumCharge: null, currencyCode: null, unitCode: null,
      }
      await crmRequest(base + (existing ? '/' + encodeURIComponent(existing.id) : ''),
        existing ? 'PUT' : 'POST', body)
      count++
    }
    editedSales.value = {}
    success.value = count + ' ítem(s) guardado(s). El costo original de Pricing no se alteró.'
  } catch (cause) {
    error.value = crmError(cause) + (count ? ' Se guardaron ' + count + ' ítems antes del error.' : '')
  } finally {
    saving.value = false
    if (count) emit('saved')
  }
}
</script>

<template>
  <section data-crm-preferential-route class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
    <h3 class="text-sm font-extrabold">Personalización de venta por ruta</h3>
    <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
      Seleccioná los datos como en una cotización estándar. Los costos y recargos originales de Pricing se mantienen intactos.
    </p>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

      <DhSelect :model-value="route.modality" label="Modalidad" :options="modalityOptions"
        placeholder="" @update:model-value="changeModality(String($event) as 'MARITIME' | 'TERRESTRIAL')" />
      <DhSelect :model-value="route.shipment" label="Embarque" :options="options"
        placeholder="" @update:model-value="route.shipment = String($event) as PreferentialShipment" />

      <label class="route-label">Tipo de cliente
        <input class="route-input" :value="categoryLabel" readonly />
        <span class="text-[11px] font-normal normal-case tracking-normal">
          Se utiliza la categoría comercial de esta cuenta.
        </span>
      </label>

      <CrmMultiCatalogPicker v-model="route.equipmentCodes" single label="Equipo"
        placeholder="Buscar tamaño o tipo de equipo" :catalog-group-slugs="equipmentGroups" />
      <CrmMultiCatalogPicker v-model="route.polCodes" single label="Origen (POL)"
        placeholder="Buscar puerto de origen" :catalog-group-slugs="['pol']"
        :route-mode="route.shipment" route-role="pol" />
      <CrmMultiCatalogPicker v-model="route.poeCodes" single label="Destino (POE)"
        placeholder="Buscar puerto de entrada" :catalog-group-slugs="['poe']"
        :route-mode="route.shipment" route-role="poe" />
      <CrmMultiCatalogPicker v-if="route.modality==='MARITIME'" v-model="route.podCodes"
        single label="POD requerido" placeholder="Buscar destino final"
        :catalog-group-slugs="['pod']" :route-mode="route.shipment" route-role="pod" />
    </div>
    <button type="button" class="route-action mt-4" :disabled="saving || costsLoading" @click="consult">
      {{ costsLoading ? 'Cargando costos…' : 'Mostrar costos y recargos' }}
    </button>
    <p class="mt-2 text-xs text-[var(--dh-text-muted)]">FCL · FTL · LCL propio · LTL propio</p>
    <p v-if="error" role="alert" class="mt-3 rounded-lg border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="mt-3 rounded-lg border border-emerald-500/40 p-3 text-sm text-emerald-600">{{ success }}</p>
    <template v-if="preview">
      <h4 class="mt-5 border-t border-[var(--dh-border)] pt-4 text-sm font-bold">
        Ítems de costos y recargos ({{ costsForRoute.length }})
      </h4>
      <div class="mt-3 overflow-x-auto rounded-xl border border-[var(--dh-border)]">
        <table class="w-full min-w-[660px] text-left text-xs">
          <thead class="bg-[var(--dh-shell)]">
            <tr><th class="p-3">Concepto</th><th class="p-3">Base</th><th class="p-3">Costo original</th>
              <th class="p-3">Venta estándar</th><th class="p-3">Venta preferencial</th></tr>
          </thead>
          <tbody>
            <tr v-for="cost in costsForRoute" :key="cost.id" class="border-t border-[var(--dh-border)]">
              <td class="p-3 font-bold">{{ cost.name }}
                <span class="block font-normal text-[var(--dh-text-muted)]">{{ cost.costDetailType }}</span>
              </td>
              <td class="p-3">{{ cost.chargeBasis }}</td>
              <td class="p-3">{{ money(cost.costAmount,cost.currencyCode) }}</td>
              <td class="p-3">{{ money(cost.saleAmount,cost.currencyCode) }}</td>
              <td class="p-3">
                <input type="number" min="0" step="0.000001" class="route-input max-w-44"
                  :aria-label="'Venta preferencial de '+cost.name" :value="saleValue(cost)"
                  @input="editSale(cost,($event.target as HTMLInputElement).value)" />
                <small v-if="existingCost(cost)" class="block text-[var(--dh-primary)]">Acuerdo existente</small>
              </td>
            </tr>
            <tr v-if="!costsForRoute.length"><td colspan="5" class="p-5 text-center text-[var(--dh-text-muted)]">
              No hay costos configurados en Pricing compatibles con esta ruta.
            </td></tr>
          </tbody>
        </table>
      </div>
      <div class="mt-4 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
        <label class="flex items-center gap-2 text-sm font-bold">
          <input v-model="insuranceEnabled" type="checkbox" class="h-4 w-4 accent-[var(--dh-primary)]" />
          Personalizar seguro de carga
        </label>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Costo y venta porcentuales sobre el valor declarado de la mercancía.
        </p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label class="route-label">Seguro · costo (%)
            <input v-model="insuranceCost" type="number" min="0" max="100" step="0.000001"
              class="route-input" :disabled="!insuranceEnabled" />
          </label>
          <label class="route-label">Seguro · venta (%)
            <input v-model="insuranceSale" type="number" min="0" max="100" step="0.000001"
              class="route-input" :disabled="!insuranceEnabled" />
          </label>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span class="text-xs text-[var(--dh-text-muted)]">{{ Object.keys(editedSales).length }} ventas modificadas</span>
        <button type="button" class="route-action" :disabled="saving" @click="save">
          {{ saving ? 'Guardando…' : 'Guardar ventas preferenciales' }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.route-label{display:flex;min-width:0;flex-direction:column;gap:.375rem;font-size:.75rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:var(--dh-text-muted)}
.route-input{width:100%;min-width:0;min-height:44px;border:1px solid var(--dh-border);border-radius:18px;padding:.65rem .75rem;background:var(--dh-input);color:var(--dh-text);font-size:.875rem;font-weight:600;box-shadow:var(--dh-shadow-sm)}
.route-action{min-height:38px;border:1px solid var(--dh-primary);border-radius:.7rem;background:var(--dh-primary);padding:.5rem 1rem;color:#fff;font-size:.8rem;font-weight:750}
.route-action:disabled{opacity:.5}
</style>
