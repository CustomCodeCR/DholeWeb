<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { CostSelectDto } from '@/core/interfaces/pricing'
import CrmPricingLocationSelect from './CrmPricingLocationSelect.vue'
import CrmPricingEquipmentSelect from './CrmPricingEquipmentSelect.vue'
import CrmMultiCatalogPicker from './CrmMultiCatalogPicker.vue'
import DhSelect from '@/shared/components/atoms/DhSelect.vue'
import { Search, ChevronDown, Layers3, Ship, MapPin, PackageCheck } from 'lucide-vue-next'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { sellerRateCurrencyValue } from '@/modules/pricing/utils/sellerRateCurrency'
import { groupPreferentialCosts, preferentialCostOwners, preferentialCostBasis } from '../utils/crmPreferentialCostGroups'
import { costTiers, currentTierSale, discounted, tierSalesMatch, tierSalesPayload, tierText } from '../utils/crmPreferentialTierSales'
import { crmError, crmPath, crmRequest } from '../services/crmApi'
import { matchesPreferentialRoute, matchesPreferentialCommercialScope, PREFERENTIAL_INCOTERMS, saleUnitForBasis, type PreferentialShipment } from '../utils/crmPreferentialCostRoute'
import { exactPreferentialScope, mostSpecificPreferentialRate } from '../utils/crmPreferentialMatching'

type SavedRate = {
  id: string; rowVersion: number; modality: string; laneCode: string | null
  sourceCostId?: string | null; chargeCode: string; rateType: string; value: number | null
  insuranceCostPercent: number | null; insuranceSalePercent: number | null
  tierSalesJson?: string | null
  equipmentCodes: string[]; polCodes: string[]; poeCodes: string[]; podCodes: string[]; isActive: boolean
  carrierCode?: string | null; incotermCode?: string | null; serviceCodes?: string[]
  customChargeName?: string | null; validFrom?: string | null; validUntil?: string | null
  updatedAt?: string | null
}
const props = defineProps<{
  accountId: string; categoryType: string; categoryCode: string
  costs: CostSelectDto[]; rates: SavedRate[]
  canReadPricingConcepts: boolean; costsLoading: boolean
}>()
const emit = defineEmits<{ saved: [] }>()
const route = reactive({
  modality: 'MARITIME' as 'MARITIME' | 'TERRESTRIAL' | 'AIR',
  shipment: 'FCL' as PreferentialShipment,
  equipmentCodes: [] as string[], polCodes: [] as string[],
  poeCodes: [] as string[], podCodes: [] as string[],
  carrierCode: '', incotermCode: '', serviceCodes: [] as string[],
})
const preview = ref(false), saving = ref(false), error = ref(''), success = ref('')
const editedSales = ref<Record<string, string>>({})
const editedTiers = ref<Record<string, Record<string, string>>>({})
const expandedTiers = ref<string[]>([])
const providerFilter = ref('all')
const bulkDiscount = ref('')
const bulkReview = ref(false)
const showAllCosts = ref(true)
const manual = reactive({ name: '', chargeCode: 'Other', amount: '', currency: 'USD', unit: 'SHIPMENT' })
const manualChargeOptions = [
  {value:'Other',label:'Otro / servicio manual'}, {value:'Freight',label:'Flete internacional'},
  {value:'OriginCharge',label:'Cargo en origen'}, {value:'DestinationCharge',label:'Cargo en destino'},
  {value:'PortCharge',label:'Cargo portuario'}, {value:'CustomsCharge',label:'Aduanas'},
  {value:'InlandTransport',label:'Transporte local'}, {value:'AgentCharge',label:'Cargo de agente'},
  {value:'Documentation',label:'Documentación'}, {value:'Insurance',label:'Seguro'},
]
const manualUnits = [
  {value:'SHIPMENT',label:'Embarque'}, {value:'SERVICE',label:'Servicio'},
  {value:'CONTAINER',label:'Contenedor'}, {value:'TRUCK',label:'Camión'},
  {value:'CBM',label:'CBM'}, {value:'CFT',label:'CFT'},
  {value:'KG',label:'KG'}, {value:'DOCUMENT',label:'Documento'},
]
const containerLabels = ref<Record<string, string>>({})
const containerIdByCode = ref<Record<string, string>>({})
const insuranceEnabled = ref(false), insuranceCost = ref(''), insuranceSale = ref('')
const currencies = ref<CatalogItemSelectDto[]>([])
const searchTerm = ref('')
const expandedZones = ref<string[]>(['origin','destination','transit','other'])
const expandedProviders = ref<string[]>([])
async function loadCurrencies() {
  try {
    currencies.value = await CatalogItemsService.select({ catalogGroupSlug: 'currencies' })
  } catch {
    currencies.value = []
  }
  try {
    const groups = await Promise.all(['container-types','land-equipment-types','land-equipment-sizes']
      .map(slug => CatalogItemsService.select({catalogGroupSlug:slug}).catch(()=>[])))
    const equipment = groups.flat()
    containerLabels.value = Object.fromEntries(equipment.map(x => [x.id,x.label || x.value || x.code]))
    containerIdByCode.value = Object.fromEntries(equipment.map(x => [x.code,x.id]))
  } catch { containerLabels.value = {};containerIdByCode.value = {} }
}
onMounted(() => void loadCurrencies())
const modalityOptions = [
  { value: 'MARITIME', label: 'Marítimo' },
  { value: 'TERRESTRIAL', label: 'Terrestre' },
  { value: 'AIR', label: 'Aéreo' },
]
const options = computed(() => route.modality === 'MARITIME'
  ? [{ value: 'FCL', label: 'FCL' }, { value: 'LCL', label: 'LCL propio' }]
  : route.modality === 'AIR' ? [{ value: 'AIR', label: 'Aéreo' }]
  : [{ value: 'FTL', label: 'FTL' }, { value: 'LTL', label: 'LTL propio' }])
const laneCode = computed(() => ['LCL', 'LTL'].includes(route.shipment) ? 'OWN' : null)
const incotermOptions = [{ value: '', label: 'Todos los Incoterms' },
  ...PREFERENTIAL_INCOTERMS.map(value => ({value,label:value}))]
const equipmentGroups = computed(() => route.modality === 'MARITIME'
  ? ['container-types'] : route.modality === 'AIR' ? []
  : ['land-equipment-sizes', 'land-equipment-types'])
// Every dimension can be unrestricted. A modality alone is enough to create an agreement.
const isComplete = computed(() => !!route.shipment)
const categoryLabel = computed(() => props.categoryType === 'LITTLE' ? 'Cargas Little'
  : props.categoryType === 'NVOCC' ? 'NVOCC ' + props.categoryCode : 'Cliente ' + props.categoryCode)
const costsForRoute = computed(() => !preview.value || !isComplete.value ? [] : props.costs
  .filter(cost => cost.costDetailType !== 'Insurance' &&
    (!route.serviceCodes.length || !(cost.services ?? []).length ||
      (cost.services ?? []).some(service => route.serviceCodes.includes((service.code || service.name).toUpperCase()))) &&
    (showAllCosts.value || matchesPreferentialRoute(cost, {
    shipment: route.shipment, polCode: route.polCodes[0] ?? '',
    poeCode: route.poeCodes[0] ?? '', podCode: route.podCodes[0] ?? '',
    carrierCode: route.carrierCode, incotermCode: route.incotermCode,
    serviceCodes: route.serviceCodes,
  })))
  .filter(cost => {
    const rows = costTiers(cost)
    if (rows[0]?.dimension !== 'ContainerType') return true
    const id = containerIdByCode.value[route.equipmentCodes[0] ?? '']
    return !id || rows.some(row => row.containerTypeId === id)
  })
  .sort((a, b) => a.costDetailType.localeCompare(b.costDetailType) || a.name.localeCompare(b.name, 'es')))
const providerOptions = computed(() => {
  const options = new Map<string,string>()
  for (const cost of costsForRoute.value) {
    const owners = preferentialCostOwners(cost)
    owners.agentNames.forEach(name => options.set('agent:'+name, 'Agente · '+name))
    owners.carrierNames.forEach(name => options.set('carrier:'+name, 'Naviera · '+name))
  }
  return [
    {value:'all',label:'Todas las navieras y agentes'},
    {value:'unassigned',label:'Sin agente o naviera'},
    ...[...options].sort((a,b) => a[1].localeCompare(b[1],'es'))
      .map(([value,label]) => ({value,label})),
  ]
})
const filteredCosts = computed(() => {
  const needle = searchTerm.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLocaleLowerCase()
  return costsForRoute.value.filter(cost => {
    const owners = preferentialCostOwners(cost)
    if (providerFilter.value === 'unassigned' &&
      (owners.agentNames.length || owners.carrierNames.length)) return false
    if (providerFilter.value.startsWith('agent:') &&
      !owners.agentNames.includes(providerFilter.value.slice(6))) return false
    if (providerFilter.value.startsWith('carrier:') &&
      !owners.carrierNames.includes(providerFilter.value.slice(8))) return false
    if (!needle) return true
    const haystack = [cost.name, cost.costDetailType, preferentialCostBasis(cost.chargeBasis),
      ...owners.agentNames, ...owners.carrierNames, cost.portName].join(' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    return haystack.includes(needle)
  })
})
const costSections = computed(() => groupPreferentialCosts(filteredCosts.value))
const isTiered = (cost: CostSelectDto) => costTiers(cost).length > 0
function visibleTiers(cost: CostSelectDto) {
  const rows = costTiers(cost).map((rule,index) => ({rule,index}))
  const equipmentId = containerIdByCode.value[route.equipmentCodes[0] ?? '']
  if (!equipmentId || rows[0]?.rule.dimension !== 'ContainerType') return rows
  return rows.filter(x => x.rule.containerTypeId === equipmentId)
}
const invalidRules = (cost: CostSelectDto) => Boolean(cost.pricingRulesJson && !isTiered(cost))
function tierSale(cost: CostSelectDto, index: number) {
  const saved = existingCost(cost) ?? applicableCost(cost)
  return currentTierSale(cost,index,editedTiers.value[cost.id],
    saved?.rateType === 'TIERED_SALE' ? saved.tierSalesJson : null)
}
function editTier(cost: CostSelectDto, index: number, value: string) {
  editedTiers.value = {
    ...editedTiers.value,
    [cost.id]: {...editedTiers.value[cost.id], [String(index)]:value},
  }
}
function toggleTiers(id: string) {
  expandedTiers.value = expandedTiers.value.includes(id)
    ? expandedTiers.value.filter(x=>x!==id) : [...expandedTiers.value,id]
}
const modifiedCount = computed(() =>
  new Set([...Object.keys(editedSales.value),...Object.keys(editedTiers.value)]).size)
const eligibleBulk = computed(() => filteredCosts.value.filter(c => !invalidRules(c) &&
  (isTiered(c) ? visibleTiers(c).some(x => x.rule.saleAmount>0) : c.saleAmount>0)))
function proposeDiscount() {
  const percent=Number(bulkDiscount.value)
  error.value=''
  if (!bulkDiscount.value.trim() || !Number.isFinite(percent) || percent<0 || percent>100) {
    error.value='Indicá un descuento porcentual entre 0 y 100.'
    bulkReview.value=false;return
  }
  if (!eligibleBulk.value.length) {
    error.value='No hay cargos con venta estándar positiva en esta selección.'
    bulkReview.value=false;return
  }
  bulkReview.value=true
}
function applyDiscount() {
  if (!bulkReview.value) return
  const percent=Number(bulkDiscount.value)
  for (const cost of eligibleBulk.value) {
    if (isTiered(cost)) {
      const edits={...editedTiers.value[cost.id]}
      visibleTiers(cost).forEach(({rule,index}) => {
        if (rule.saleAmount>0) edits[String(index)]=discounted(rule.saleAmount,percent)
      })
      editedTiers.value={...editedTiers.value,[cost.id]:edits}
    } else {
      editedSales.value={...editedSales.value,[cost.id]:discounted(cost.saleAmount,percent)}
    }
  }
  bulkReview.value=false
  success.value='Descuento preparado para '+eligibleBulk.value.length+
    ' cargos. Revisá cada importe y después guardá; todavía no se enviaron a CRM.'
}

const expanded = (key: string) => expandedZones.value.includes(key)
const providerExpanded = (key: string) => !!searchTerm.value.trim() || expandedProviders.value.includes(key)
function toggleZone(key: string) {
  expandedZones.value = expanded(key) ? expandedZones.value.filter(x => x !== key) : [...expandedZones.value,key]
}
function toggleProvider(key: string) {
  expandedProviders.value = expandedProviders.value.includes(key)
    ? expandedProviders.value.filter(x => x !== key) : [...expandedProviders.value,key]
}
function toggleAllProviders() {
  const all = costSections.value.flatMap(s => s.providers.map(p => p.key))
  expandedProviders.value = all.length && all.every(k => expandedProviders.value.includes(k)) ? [] : all
}
const normalized = (codes: string[] | undefined) => (codes ?? []).map(x => x.toUpperCase()).sort().join('|')
function scopeMatches(rate: SavedRate) {
  return rate.modality === route.shipment && rate.laneCode === laneCode.value &&
    normalized(rate.equipmentCodes) === normalized(route.equipmentCodes) &&
    normalized(rate.polCodes) === normalized(route.polCodes) &&
    normalized(rate.poeCodes) === normalized(route.poeCodes) &&
    normalized(rate.podCodes) === (route.modality === 'MARITIME' ? normalized(route.podCodes) : '') &&
    matchesPreferentialCommercialScope(rate, route) &&
    exactPreferentialScope(rate, {
      modality: route.shipment, laneCode: laneCode.value,
      carrierCode: route.carrierCode, incotermCode: route.incotermCode,
      equipmentCodes: route.equipmentCodes, polCodes: route.polCodes,
      poeCodes: route.poeCodes, podCodes: route.modality === 'MARITIME' ? route.podCodes : [],
      serviceCodes: route.serviceCodes,
    })
}
function existingCost(cost: CostSelectDto) {
  return props.rates.find(x => x.isActive && x.sourceCostId?.toLowerCase() === cost.id.toLowerCase() && scopeMatches(x))
}
// A specific override is created instead of overwriting the less-specific fallback.
function applicableCost(cost: CostSelectDto) {
  return mostSpecificPreferentialRate(props.rates, {
    modality: route.shipment, sourceCostId: cost.id,
    chargeCode: cost.costDetailType, customChargeName: cost.name,
    laneCode: laneCode.value, equipmentCode: route.equipmentCodes[0],
    polCode: route.polCodes[0], poeCode: route.poeCodes[0], podCode: route.podCodes[0],
    carrierCode: route.carrierCode, incotermCode: route.incotermCode,
    serviceCode: route.serviceCodes.length === 1 ? route.serviceCodes[0] : undefined,
  })
}
function existingInsurance() {
  return props.rates.find(x => x.isActive && x.rateType === 'INSURANCE_PERCENT' &&
    x.chargeCode === 'Insurance' && scopeMatches(x))
}
function resetPreview() {
  preview.value = false; editedSales.value = {}; editedTiers.value = {}
  error.value = ''; success.value = ''
  insuranceEnabled.value = false; insuranceCost.value = ''; insuranceSale.value = ''
}
function changeModality(value: 'MARITIME' | 'TERRESTRIAL' | 'AIR') {
  route.modality = value; route.shipment = value === 'MARITIME' ? 'FCL' : value === 'AIR' ? 'AIR' : 'FTL'
  route.equipmentCodes = []; route.polCodes = []; route.poeCodes = []; route.podCodes = []
  route.carrierCode = ''; route.incotermCode = ''; route.serviceCodes = []
}
watch(() => [route.modality, route.shipment, route.equipmentCodes.join('|'),
  route.polCodes.join('|'), route.poeCodes.join('|'), route.podCodes.join('|'),
  route.carrierCode, route.incotermCode, route.serviceCodes.join('|')], resetPreview)
function consult() {
  error.value = ''; success.value = ''
  // Se puede consultar el catálogo completo o guardar un cargo manual sin puertos ni equipo.
  if (!isComplete.value) return
  editedSales.value = {}; editedTiers.value = {}; preview.value = true
  searchTerm.value = '';providerFilter.value='all';bulkDiscount.value='';bulkReview.value=false
  expandedTiers.value=[]
  expandedZones.value = ['origin','destination','transit','other']
  expandedProviders.value = []
  const insured = existingInsurance()
  insuranceEnabled.value = !!insured
  insuranceCost.value = insured?.insuranceCostPercent == null ? '' : String(insured.insuranceCostPercent)
  insuranceSale.value = insured?.insuranceSalePercent == null ? '' : String(insured.insuranceSalePercent)
}
function saleValue(cost: CostSelectDto) {
  return Object.prototype.hasOwnProperty.call(editedSales.value, cost.id)
    ? (editedSales.value[cost.id] ?? '') : String((existingCost(cost) ?? applicableCost(cost))?.value ?? cost.saleAmount)
}
function editSale(cost: CostSelectDto, value: string) {
  editedSales.value = { ...editedSales.value, [cost.id]: value }
}
const currencyFor = (cost: CostSelectDto): string | null =>
  sellerRateCurrencyValue(cost, currencies.value)
const money = (value: number, cost: CostSelectDto) =>
  (currencyFor(cost) ?? 'Moneda no identificada') + ' ' +
  Number(value ?? 0).toLocaleString('es-CR', {
    minimumFractionDigits: 2, maximumFractionDigits: 6,
  })
const validPercent = (value: string) =>
  value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100
function scope() {
  return {
    modality: route.shipment, laneCode: laneCode.value,
    carrierCode: route.carrierCode, incotermCode: route.incotermCode,
    serviceCodes: [...route.serviceCodes],
    equipmentCodes: [...route.equipmentCodes], polCodes: [...route.polCodes],
    poeCodes: [...route.poeCodes], podCodes: route.modality === 'MARITIME' ? [...route.podCodes] : [],
    equipmentCode: null, originCode: null, destinationCode: null,
    validFrom: null, validUntil: null, notes: null, isActive: true,
  }
}
async function save() {
  if (!preview.value || saving.value || !isComplete.value) return
  error.value = ''; success.value = ''
  const modified = costsForRoute.value.filter(x =>
    Object.prototype.hasOwnProperty.call(editedSales.value,x.id) ||
    Object.prototype.hasOwnProperty.call(editedTiers.value,x.id))
  if (!modified.length && !insuranceEnabled.value) {
    error.value = 'Modificá un precio de venta o configurá los porcentajes de seguro.'
    return
  }
  for (const cost of modified) {
    if (invalidRules(cost)) {
      error.value='No se pueden leer las bandas originales de '+cost.name+'. Revisá Pricing.'
      return
    }
    if (isTiered(cost)) {
      for (let i=0;i<costTiers(cost).length;i++) {
        const value=tierSale(cost,i)
        if (!value.trim() || !Number.isFinite(Number(value)) || Number(value)<0) {
          error.value='La venta del tramo '+(i+1)+' de '+cost.name+' no es válida.'
          return
        }
      }
    } else if (!saleValue(cost).trim() || !Number.isFinite(Number(saleValue(cost))) ||
      Number(saleValue(cost)) < 0) {
      error.value = 'La venta de ' + cost.name + ' debe ser un número válido y no negativo.'
      return
    }
    if (!['USD', 'CRC'].includes(currencyFor(cost) ?? '')) {
      error.value = 'No se pudo resolver la moneda USD o CRC de ' + cost.name +
        ' desde el Value del catálogo de monedas.'
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
      const inherited = existing ?? applicableCost(cost)
      const body = {
        ...scope(), expectedVersion: existing?.rowVersion ?? null,
        sourceCostId: cost.id, chargeCode: cost.costDetailType,
        customChargeName: cost.name.slice(0,120),
        rateType: isTiered(cost) ? 'TIERED_SALE' : 'FIXED_AMOUNT',
        value: isTiered(cost) ? null : Number(saleValue(cost)),
        tierSalesJson: isTiered(cost) ? tierSalesPayload(cost,editedTiers.value[cost.id],
          inherited?.rateType === 'TIERED_SALE' ? inherited.tierSalesJson : null) : null,
        minimumCharge: null,
        insuranceCostPercent: null, insuranceSalePercent: null,
        currencyCode: currencyFor(cost),
        unitCode: isTiered(cost) ? null : saleUnitForBasis(cost.chargeBasis),
      }
      await crmRequest(base + (existing ? '/' + encodeURIComponent(existing.id) : ''),
        existing ? 'PUT' : 'POST', body)
      count++
    }
    if (insuranceEnabled.value) {
      const existing = existingInsurance()
      const body = {
        ...scope(), expectedVersion: existing?.rowVersion ?? null,
        sourceCostId: null, tierSalesJson: null, chargeCode: 'Insurance', customChargeName: null,
        rateType: 'INSURANCE_PERCENT', value: Number(insuranceSale.value),
        insuranceCostPercent: Number(insuranceCost.value), insuranceSalePercent: Number(insuranceSale.value),
        minimumCharge: null, currencyCode: null, unitCode: null,
      }
      await crmRequest(base + (existing ? '/' + encodeURIComponent(existing.id) : ''),
        existing ? 'PUT' : 'POST', body)
      count++
    }
    editedSales.value = {}
    editedTiers.value = {}
    success.value = count + ' ítem(s) guardado(s). El costo original de Pricing no se alteró.'
  } catch (cause) {
    error.value = crmError(cause) + (count ? ' Se guardaron ' + count + ' ítems antes del error.' : '')
  } finally {
    saving.value = false
    if (count) emit('saved')
  }
}
async function saveManual() {
  error.value = ''; success.value = ''
  const name = manual.name.trim()
  const value = Number(manual.amount)
  if (!name || name.length > 120) {
    error.value = 'Ingresá un nombre de cargo manual de hasta 120 caracteres.'
    return
  }
  if (!manual.amount.trim() || !Number.isFinite(value) || value < 0) {
    error.value = 'Ingresá un precio de venta válido, mayor o igual a cero.'
    return
  }
  const existing = props.rates.find(rate => !rate.sourceCostId && scopeMatches(rate) &&
    rate.chargeCode.toUpperCase() === manual.chargeCode.toUpperCase() &&
    String(rate.customChargeName ?? '').trim().toUpperCase() === name.toUpperCase())
  saving.value = true
  try {
    const base = crmPath('accounts', props.accountId, 'commercial-benefits/rates')
    await crmRequest(base + (existing ? '/' + encodeURIComponent(existing.id) : ''),
      existing ? 'PUT' : 'POST', {
        ...scope(), expectedVersion: existing?.rowVersion ?? null,
        sourceCostId: null, tierSalesJson: null,
        chargeCode: manual.chargeCode, customChargeName: name,
        rateType: 'FIXED_AMOUNT', value, minimumCharge: null,
        insuranceCostPercent: null, insuranceSalePercent: null,
        currencyCode: manual.currency, unitCode: manual.unit,
      })
    manual.name = ''; manual.amount = ''
    success.value = 'Cargo manual guardado con la combinación seleccionada.'
    emit('saved')
  } catch (cause) {
    error.value = crmError(cause)
  } finally { saving.value = false }
}

</script>

<template>
  <section data-crm-preferential-route class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
    <h3 class="text-sm font-extrabold">Personalización de venta por ruta</h3>
    <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
      Seleccioná solo las condiciones que necesités. Las demás se aplican a cualquier combinación. Los costos de Pricing no se modifican.
    </p>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

      <DhSelect :model-value="route.modality" label="Modalidad" :options="modalityOptions"
        placeholder="" @update:model-value="changeModality(String($event) as 'MARITIME' | 'TERRESTRIAL' | 'AIR')" />
      <DhSelect :model-value="route.shipment" label="Embarque" :options="options"
        placeholder="" @update:model-value="route.shipment = String($event) as PreferentialShipment" />

      <label class="route-label">Tipo de cliente
        <input class="route-input" :value="categoryLabel" readonly />
        <span class="text-[11px] font-normal normal-case tracking-normal">
          Se utiliza la categoría comercial de esta cuenta.
        </span>
      </label>

      <CrmPricingEquipmentSelect v-if="route.modality!=='AIR'" v-model="route.equipmentCodes"
        label="Equipo" :catalog-group-slugs="equipmentGroups" />
      <CrmMultiCatalogPicker v-if="route.modality==='MARITIME'"
        :model-value="route.carrierCode ? [route.carrierCode] : []"
        label="Naviera" :catalog-group-slugs="['carriers']" :single="true"
        placeholder="Todas las navieras"
        @update:model-value="route.carrierCode = String($event[0] ?? '')" />
      <DhSelect :model-value="route.incotermCode" label="Incoterm"
        :options="incotermOptions" placeholder=""
        @update:model-value="route.incotermCode = String($event)" />
      <CrmMultiCatalogPicker v-model="route.serviceCodes" label="Servicios aplicables (opcionales)"
        :catalog-group-slugs="['pricing-services']" placeholder="Todos los servicios" />
      <CrmPricingLocationSelect v-model="route.polCodes" label="Origen (POL)"
        placeholder="Buscar puerto de origen" :catalog-group-slugs="['pol']"
        :route-mode="route.shipment" route-role="pol" />
      <CrmPricingLocationSelect v-model="route.poeCodes" label="Destino (POE)"
        placeholder="Buscar puerto de entrada" :catalog-group-slugs="['poe']"
        :route-mode="route.shipment" route-role="poe" />
      <CrmPricingLocationSelect v-if="route.modality==='MARITIME'" v-model="route.podCodes"
        label="POD requerido" placeholder="Buscar destino final"
        :catalog-group-slugs="['pod']" :route-mode="route.shipment" route-role="pod" />
    </div>
    <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
      Podés definir solo un puerto, solo un servicio o cualquier combinación. Las condiciones vacías son generales; una coincidencia más específica tiene prioridad.
    </p>
    <button type="button" class="route-action mt-4" :disabled="saving || costsLoading" @click="consult">
      {{ costsLoading ? 'Cargando costos…' : 'Mostrar costos y recargos' }}
    </button>
    <p class="mt-2 text-xs text-[var(--dh-text-muted)]">FCL · LCL · FTL · LTL · Aéreo · servicios combinables sin obligación de seleccionar puertos o equipo</p>
    <p v-if="error" role="alert" class="mt-3 rounded-lg border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="mt-3 rounded-lg border border-emerald-500/40 p-3 text-sm text-emerald-600">{{ success }}</p>
    <form class="mt-5 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4"
      aria-label="Agregar cargo manual preferencial" @submit.prevent="saveManual">
      <h4 class="text-sm font-extrabold">Agregar ítem manual</h4>
      <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
        Agregá servicios y cargos que todavía no figuran en los costos de Pricing.
        La tarifa utilizará las condiciones opcionales seleccionadas arriba.
      </p>
      <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label class="route-label xl:col-span-2">Nombre del ítem
          <input v-model="manual.name" class="route-input" maxlength="120"
            placeholder="Ej. Fumigación, inspección, almacenaje" required />
        </label>
        <DhSelect :model-value="manual.chargeCode" label="Tipo de cargo"
          :options="manualChargeOptions" @update:model-value="manual.chargeCode=String($event)" />
        <label class="route-label">Venta preferencial
          <input v-model="manual.amount" class="route-input" type="number" min="0" step="0.000001"
            placeholder="0.00" required />
        </label>
        <DhSelect :model-value="manual.currency" label="Moneda"
          :options="[{value:'USD',label:'USD'},{value:'CRC',label:'CRC'}]"
          @update:model-value="manual.currency=String($event)" />
        <DhSelect :model-value="manual.unit" label="Unidad de cobro" :options="manualUnits"
          @update:model-value="manual.unit=String($event)" />
      </div>
      <button class="route-action mt-4" type="submit" :disabled="saving">
        {{ saving ? 'Guardando…' : 'Guardar ítem manual' }}
      </button>
    </form>
    <label class="mt-4 flex items-center gap-2 text-sm font-semibold">
      <input v-model="showAllCosts" type="checkbox" class="h-4 w-4 accent-[var(--dh-primary)]" />
      Mostrar todos los ítems de Pricing, incluso de otros servicios o rutas
    </label>
    <p v-if="!canReadPricingConcepts" class="mt-2 text-xs text-[var(--dh-text-muted)]">
      Para consultar los costos de Pricing se requiere pricing.cost.select. Podés guardar ítems manuales con permiso de CRM.
    </p>
    <template v-if="preview">
      <div class="mt-6 border-t border-[var(--dh-border)] pt-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <Layers3 class="h-5 w-5 text-[var(--dh-primary)]" />
              <h4 class="text-base font-black text-[var(--dh-text)]">Costos y recargos por proveedor y ubicación</h4>
            </div>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
              {{ costsForRoute.length }} conceptos de Pricing · Editá únicamente la venta preferencial.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="route-pill">{{ costSections.length }} secciones</span>
            <span class="route-pill">{{ modifiedCount }} cargos editados sin guardar</span>
          </div>
        </div>

        <div class="mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-extrabold">1. Elegí una naviera o agente</p>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Este filtro solo organiza los conceptos visibles. Para limitar la condición guardada a una naviera, seleccionála en los datos de la ruta.</p>
            </div>
            <span class="route-pill">{{ filteredCosts.length }} cargos visibles</span>
          </div>
          <div class="mt-3">
            <DhSelect :model-value="providerFilter" label="Naviera o agente"
              placeholder="" :options="providerOptions"
              @update:model-value="providerFilter=String($event);bulkReview=false" />
          </div>
          <div class="mt-4 border-t border-[var(--dh-border)] pt-3">
            <p class="text-sm font-extrabold">2. Ajuste rápido de venta (opcional)</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
              Podés aplicar un descuento sobre la venta estándar a todos los cargos visibles con venta positiva,
              incluso a los que se calculan por tramos. Nunca modifica el costo original.
            </p>
            <div class="mt-3 flex flex-wrap items-end gap-2">
              <label class="route-label min-w-32">Descuento sobre venta (%)
                <input v-model="bulkDiscount" type="number" min="0" max="100" step="0.01"
                  class="route-input w-36" placeholder="Ej. 10" @input="bulkReview=false" />
              </label>
              <button type="button" class="route-action-secondary" @click="proposeDiscount">
                Revisar descuento
              </button>
            </div>
            <div v-if="bulkReview" class="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p class="text-xs font-bold">
                Se preparará {{ bulkDiscount }} % de descuento para {{ eligibleBulk.length }} cargos.
                Primero podrás revisar los importes; no se guardará hasta pulsar Guardar ventas preferenciales.
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="route-action" @click="applyDiscount">Aplicar a la edición</button>
                <button type="button" class="route-action-secondary" @click="bulkReview=false">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label class="relative min-w-[240px] flex-1">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]" />
            <input v-model="searchTerm" type="search"
              aria-label="Buscar conceptos, agentes o navieras"
              placeholder="3. Buscar un concepto o cargo…"
              class="route-input w-full pl-10" />
          </label>
          <button type="button" class="route-action-secondary" @click="toggleAllProviders">
            Expandir / contraer proveedores
          </button>
        </div>

        <div v-if="!costsForRoute.length" class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] p-8 text-center text-sm text-[var(--dh-text-muted)]">
          No se encontraron conceptos de Pricing para los filtros. Podés agregar cualquier ítem manual arriba.
        </div>
        <p v-else-if="!filteredCosts.length" class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] p-8 text-center text-sm text-[var(--dh-text-muted)]">
          No se encontraron cargos con esa búsqueda.
        </p>

        <div v-else class="mt-4 space-y-3">
          <section v-for="section in costSections" :key="section.key"
            class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
            <button type="button" class="flex w-full items-center gap-3 p-4 text-left transition hover:bg-[var(--dh-card-hover)]"
              :aria-expanded="expanded(section.key)" @click="toggleZone(section.key)">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.10)] text-[var(--dh-primary)]">
                <MapPin v-if="section.key==='origin' || section.key==='destination'" class="h-5 w-5" />
                <Ship v-else-if="section.key==='transit'" class="h-5 w-5" />
                <PackageCheck v-else class="h-5 w-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-black">{{ section.label }}</span>
                <span class="block text-xs text-[var(--dh-text-muted)]">{{ section.description }}</span>
              </span>
              <span class="route-pill">{{ section.count }} cargos</span>
              <ChevronDown class="h-4 w-4 shrink-0 transition" :class="expanded(section.key)?'rotate-180':''" />
            </button>

            <div v-if="expanded(section.key)" class="space-y-2 border-t border-[var(--dh-border)] p-3 sm:p-4">
              <section v-for="owner in section.providers" :key="owner.key"
                class="overflow-hidden rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)]">
                <button type="button" class="flex w-full items-center gap-3 p-3 text-left transition hover:bg-[var(--dh-card-hover)]"
                  :aria-expanded="providerExpanded(owner.key)" @click="toggleProvider(owner.key)">
                  <span class="min-w-0 flex-1">
                    <span class="block break-words text-xs font-extrabold">{{ owner.label }}</span>
                    <span class="mt-1 block text-[11px] text-[var(--dh-text-muted)]">
                      {{ owner.costs.length }} conceptos
                    </span>
                  </span>
                  <ChevronDown class="h-4 w-4 shrink-0 transition" :class="providerExpanded(owner.key)?'rotate-180':''" />
                </button>

                <div v-if="providerExpanded(owner.key)" class="border-t border-[var(--dh-border)] bg-[var(--dh-card)]">
                  <div class="hidden grid-cols-[minmax(190px,2fr)_minmax(105px,1fr)_minmax(105px,1fr)_minmax(140px,1.2fr)] gap-3 border-b border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-2 text-[10px] font-black uppercase tracking-wide text-[var(--dh-text-muted)] lg:grid">
                    <span>Concepto y base de cobro</span><span>Costo original</span>
                    <span>Venta estándar</span><span>Venta preferencial</span>
                  </div>
                  <div v-for="cost in owner.costs" :key="cost.id"
                    class="border-b border-[var(--dh-border)] last:border-b-0"
                    :class="editedSales[cost.id] !== undefined || editedTiers[cost.id] !== undefined
                      ? 'bg-[rgb(var(--dh-primary-rgb)/0.035)]' : ''">
                    <div class="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(190px,2fr)_minmax(105px,1fr)_minmax(105px,1fr)_minmax(140px,1.2fr)] lg:items-center">
                      <div class="min-w-0">
                        <p class="break-words text-sm font-extrabold">{{ cost.name }}</p>
                        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ preferentialCostBasis(cost.chargeBasis) }}</p>
                        <span v-if="isTiered(cost)"
                          class="mt-1 inline-block rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-300">
                          {{ visibleTiers(cost).length }} tramos aplicables
                        </span>
                        <span v-if="existingCost(cost)"
                          class="ml-1 mt-1 inline-block rounded-md bg-[rgb(var(--dh-primary-rgb)/0.10)] px-2 py-0.5 text-[10px] font-bold text-[var(--dh-primary)]">
                          Acuerdo existente en esta combinación
                        </span>
                        <span v-else-if="applicableCost(cost)"
                          class="ml-1 mt-1 inline-block rounded-md border border-[var(--dh-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--dh-text-muted)]">
                          Tarifa general heredada · se conservará al crear la específica
                        </span>
                      </div>
                      <div>
                        <span class="block text-[10px] font-bold uppercase text-[var(--dh-text-muted)] lg:hidden">Costo original</span>
                        <span v-if="isTiered(cost)" class="text-xs font-bold">Según tramo</span>
                        <span v-else-if="invalidRules(cost)" class="text-xs font-bold text-red-500">Revisar reglas</span>
                        <span v-else class="text-xs font-bold tabular-nums">{{ money(cost.costAmount,cost) }}</span>
                      </div>
                      <div>
                        <span class="block text-[10px] font-bold uppercase text-[var(--dh-text-muted)] lg:hidden">Venta estándar</span>
                        <span v-if="isTiered(cost)" class="text-xs font-bold">Según tramo</span>
                        <span v-else-if="invalidRules(cost)" class="text-xs font-bold text-red-500">Revisar reglas</span>
                        <span v-else class="text-xs font-bold tabular-nums">{{ money(cost.saleAmount,cost) }}</span>
                      </div>
                      <button v-if="isTiered(cost)" type="button" class="route-action-secondary"
                        :aria-expanded="expandedTiers.includes(cost.id)" @click="toggleTiers(cost.id)">
                        {{ expandedTiers.includes(cost.id) ? 'Ocultar tramos' : 'Personalizar '+visibleTiers(cost).length+' tramos' }}
                        <ChevronDown class="ml-1 inline h-4 w-4"
                          :class="expandedTiers.includes(cost.id) && 'rotate-180'" />
                      </button>
                      <span v-else-if="invalidRules(cost)" class="text-xs font-bold text-red-500">
                        Reglas ilegibles; revisar Pricing
                      </span>
                      <label v-else class="min-w-0">
                        <span class="block text-[10px] font-bold uppercase text-[var(--dh-text-muted)] lg:hidden">Venta preferencial</span>
                        <span class="flex h-10 items-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3">
                          <span class="text-xs font-extrabold text-[var(--dh-text-muted)]">{{ currencyFor(cost) ?? '—' }}</span>
                          <input type="number" min="0" step="0.000001" :value="saleValue(cost)"
                            :aria-label="'Venta preferencial de '+cost.name"
                            class="min-w-0 w-full bg-transparent text-right text-sm font-extrabold tabular-nums outline-none"
                            @input="editSale(cost,($event.target as HTMLInputElement).value)" />
                        </span>
                      </label>
                    </div>
                    <div v-if="isTiered(cost) && expandedTiers.includes(cost.id)"
                      class="border-t border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-3">
                      <p class="text-xs font-bold">
                        Tramos originales de Pricing para el equipo seleccionado · solo se modifica la venta
                      </p>
                      <p v-if="!visibleTiers(cost).length"
                        class="mt-2 text-xs font-bold text-amber-600">
                        No hay un tramo aplicable al equipo elegido. Revisá el tipo de contenedor en Pricing.
                      </p>
                      <p v-if="existingCost(cost)?.rateType === 'TIERED_SALE' &&
                        !tierSalesMatch(cost, existingCost(cost)?.tierSalesJson)"
                        class="mt-2 rounded-lg border border-amber-500/40 p-2 text-xs text-amber-600">
                        Los rangos de Pricing cambiaron desde este acuerdo. Revisá las ventas antes de guardar.
                      </p>
                      <div class="mt-3 space-y-2">
                        <div v-for="{rule:band,index} in visibleTiers(cost)" :key="index"
                          class="grid gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 sm:grid-cols-[minmax(130px,2fr)_1fr_1fr_1.2fr] sm:items-center">
                          <div>
                            <p class="text-xs font-extrabold">{{ tierText(band,containerLabels[band.containerTypeId ?? '']) }}</p>
                            <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">Tramo {{ index+1 }}</p>
                          </div>
                          <div>
                            <p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Costo original</p>
                            <p class="text-xs font-bold tabular-nums">{{ money(band.costAmount,cost) }}</p>
                          </div>
                          <div>
                            <p class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Venta estándar</p>
                            <p class="text-xs font-bold tabular-nums">{{ money(band.saleAmount,cost) }}</p>
                          </div>
                          <label class="min-w-0">
                            <span class="block text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">
                              Venta preferencial · {{ currencyFor(cost) ?? '—' }}
                            </span>
                            <input :value="tierSale(cost,index)" type="number" min="0" step="0.000001"
                              class="route-input min-w-0 w-full"
                              :aria-label="'Venta preferencial tramo '+(index+1)+' de '+cost.name"
                              @input="editTier(cost,index,($event.target as HTMLInputElement).value)" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
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
        <span class="text-xs text-[var(--dh-text-muted)]">{{ modifiedCount }} cargos con ventas modificadas</span>
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
.route-action-secondary{display:inline-flex;min-height:38px;align-items:center;justify-content:center;border:1px solid var(--dh-border);border-radius:.7rem;padding:.5rem .85rem;font-size:.78rem;font-weight:750;color:var(--dh-text);background:var(--dh-card)}
.route-action-secondary:hover{border-color:var(--dh-primary)}

.route-pill{display:inline-flex;align-items:center;border:1px solid var(--dh-border);border-radius:999px;padding:.25rem .65rem;font-size:.72rem;font-weight:750;color:var(--dh-text-muted);white-space:nowrap}
</style>
