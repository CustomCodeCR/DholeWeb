<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck, Package, Plus, Trash2, Save, FolderPlus, Route, Check, Search, FileUp, Truck, RefreshCw, UserRound, CircleAlert, CircleCheck, UsersRound, Layers3 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhMultiSelect, DhSelect, DhTextarea, DhCheckbox, DhSkeleton } from '@/shared/components/atoms'
import { agentMatchesOrigin } from '@/modules/catalogs/utils/agentOriginCoverage'
import { warehouseAgentNames, warehouseAgentOwnership } from '@/modules/catalogs/utils/warehouseAgentOwnership'
import { DhCard } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { operationsApi, type OpeningCompleteness } from '../services/operationsApi'
import { openingFieldLabel, openingStatusLabel, openingStatusVariant } from '../utils/openingFieldValidation'
import { contactsForDivision, defaultDivisionContacts, groupDivisionContacts, divisionContactCount } from '../utils/accountDivisionContacts'
import { crmGet, crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import PricingCrmClientSelect from '@/modules/pricing/components/PricingCrmClientSelect.vue'
import { callEndpoint } from '@/core/api/callEndpoint'
import { StorageService } from '@/core/services/storageService'
import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'
import PricingWizardStepper from '@/modules/pricing/components/PricingWizardStepper.vue'
import PricingContainerSelector from '@/modules/pricing/components/PricingContainerSelector.vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { useAuthStore } from '@/core/stores/authStore'
import { normalizeIncotermCode } from '@/modules/pricing/utils/pricingIncotermPerspective'
import { operationForClientCountry, resolveCrmCountryCode } from '@/modules/pricing/utils/pricingClientCountryOperation'
import { catalogMetadata, resolveLocationCountryCode } from '@/modules/pricing/utils/pricingCountryIso'
import type { RateOperationType } from '@/core/interfaces/pricing'
import { operationsQuoteApi, type OperationsQuoteSummary, type OperationsQuoteDetail, type OperationsConsolidation } from '../services/operationsQuoteApi'
import PricingInlandServiceLocation from '@/modules/pricing/components/PricingInlandServiceLocation.vue'

type InlandPoint = { address: string; latitude?: number | null; longitude?: number | null;
  cargoCondition?: 'FiscalCargo' | 'NationalizedCargo' | null;
  billingParty?: 'Exporter' | 'Importer' | 'Both' | 'ByAgreement' | null }

const router = useRouter()
const route = useRoute()
const editingId = computed(() => typeof route.params.id === 'string' ? route.params.id : '')
const existingVersion = ref(0)
const canEdit = ref(false)
const auth = useAuthStore()
const companyId = ref('')
const canInitialize = computed(() => auth.hasScope('operations.team.manage'))
const initializing = ref(false)
const accountId = ref('')
const selectedClientName = ref('')
const executiveName = ref('')
const executiveUserId = ref('')
const institutionalExecutive = ref(false)
const executiveLoading = ref(false)
const operationalContactsLoading = ref(false)
const operationalContactsIssue = ref('')
const operationalContacts = ref<Array<{ id: string; name: string; email: string; divisionIds: string[] }>>([])
const crmDivisions = ref<Array<{ id: string; name: string }>>([])
const eligibleOperationalContacts = computed(() => contactsForDivision(operationalContacts.value, form.value.crmDivisionId))
const selectedDivision = computed(() => crmDivisions.value.find(d => d.id === form.value.crmDivisionId))
// A non-empty sentinel lets both the native and searchable DH selectors display
// the general-account option as a genuine selection, without persisting it.
const generalDivisionValue = 'account-general'
const divisionChoices = computed(() => [
  { value: generalDivisionValue, label: 'Cuenta general' },
  ...crmDivisions.value.map(d => ({ value: d.id, label: d.name })),
])
const divisionSelectValue = computed(() => form.value.crmDivisionId || generalDivisionValue)
const divisionContactSummary = computed(() => {
  if (!selectedDivision.value) return ''
  const own = divisionContactCount(operationalContacts.value, selectedDivision.value.id)
  return own + ' de la división · ' + generalContactCount.value + ' generales'
})
function selectOpeningDivision(value: string | number) {
  const id = String(value)
  if (id === generalDivisionValue || !id) changeDivision('')
  else if (crmDivisions.value.some(d => d.id === id)) changeDivision(id)
}
const contactGroups = computed(() => groupDivisionContacts(eligibleOperationalContacts.value, form.value.crmDivisionId))
const generalContactCount = computed(() => operationalContacts.value.filter(c => !c.divisionIds.length).length)
const selectedRecipientCount = computed(() => eligibleOperationalContacts.value.filter(c => form.value.contactIds.includes(c.id)).length)
const missingRecipientCount = computed(() => form.value.contactIds.filter(id => !eligibleOperationalContacts.value.some(c => c.id === id)).length)
function setRecipientGroup(ids: string[], selected: boolean) {
  contactsTouched.value = true
  const group = new Set(ids)
  form.value.contactIds = selected
    ? [...new Set([...form.value.contactIds, ...ids])]
    : form.value.contactIds.filter(id => !group.has(id))
  form.value.contactReferences = form.value.contactIds.join(',')
}
function restoreSuggestedRecipients() {
  contactsTouched.value = true
  form.value.contactIds = defaultDivisionContacts(operationalContacts.value, form.value.crmDivisionId, crmDivisions.value.length > 0).map(c => c.id)
  form.value.contactReferences = form.value.contactIds.join(',')
}
function retryDivisionDirectory() {
  if (!accountId.value || operationalContactsLoading.value) return
  void resolveCrmOpeningData(accountId.value, { executiveUserId: executiveUserId.value,
    executiveName: executiveName.value, isCastroFallasExecutive: institutionalExecutive.value })
}
function changeDivision(id: string) {
  if (id === form.value.crmDivisionId) return
  form.value.crmDivisionId = id
  form.value.crmDivisionName = crmDivisions.value.find(d => d.id === id)?.name || ''
  contactsTouched.value = true
  form.value.contactIds = defaultDivisionContacts(operationalContacts.value, form.value.crmDivisionId, crmDivisions.value.length > 0).map(c => c.id)
  form.value.contactReferences = form.value.contactIds.join(',')
}
let clientGeneration = 0
let lastSelectedAccountId = ''
const executiveAssigned = computed(() => institutionalExecutive.value || Boolean(executiveUserId.value))
const executiveLabel = computed(() =>
  executiveLoading.value ? 'Consultando responsable comercial en CRM…'
    : executiveName.value || (executiveUserId.value ? 'Ejecutivo asignado; nombre pendiente de consulta'
      : 'Sin ejecutivo comercial asignado en CRM'))
const selectedOperationalContacts = computed(() =>
  eligibleOperationalContacts.value.filter(contact => form.value.contactIds.includes(contact.id)))
const modality = ref('')
const quoteSearch = ref('')
const quoteCandidates = ref<OperationsQuoteSummary[]>([])
const quoteRateId = ref('')
const quoteLabel = ref('')
const quoteBusy = ref(false)
const quoteIssue = ref('')
const quoteHydrated = ref(false)
let quoteGeneration = 0
let applyingQuote = false
const canSelectQuote = computed(() => auth.hasScope('operations.pricing.quote.read') && auth.hasScope('operations.pricing.quote.link'))
function clearQuote() {
  ++quoteGeneration
  quoteSearch.value = ''
  quoteRateId.value = ''
  quoteLabel.value = ''
  quoteHydrated.value = false
  quoteCandidates.value = []
  quoteIssue.value = ''
  quoteBusy.value = false
}
watch([accountId, modality], () => { if (!applyingQuote) clearQuote() }, { flush: 'sync' })
function quoteTransport(mode: string) {
  return ['FCL', 'LCL'].includes(mode) ? 'MARITIME' : ['FTL', 'LTL'].includes(mode) ? 'ROAD' : mode === 'AIR' ? 'AIR' : ''
}
function quoteMatchesOpening(rate: OperationsQuoteSummary) {
  const mode = rate.shipmentMode.toUpperCase()
  const transport = quoteTransport(mode)
  return rate.status === 'AcceptedByClient' && Boolean(rate.quoNumber && rate.clientAccountId && transport) &&
    (!accountId.value || rate.clientAccountId === accountId.value) &&
    (!modality.value || mode === modality.value.toUpperCase()) &&
    (!form.value.transportType || transport === form.value.transportType)
}
function quoteOptionLabel(rate: OperationsQuoteSummary) {
  return [rate.quoNumber || rate.rateCode, rate.clientName, rate.shipmentMode, rate.polName + ' → ' + (rate.podName || rate.poeName), rate.idtraNumber].filter(Boolean).join(' · ')
}
async function searchQuotes() {
  if (!canSelectQuote.value || !quoteSearch.value.trim() || quoteBusy.value || assignmentPendingId.value) return
  const generation = ++quoteGeneration
  quoteBusy.value = true
  quoteIssue.value = ''
  quoteCandidates.value = []
  try {
    const result = await operationsQuoteApi.search(quoteSearch.value.trim(), accountId.value || undefined)
    if (generation !== quoteGeneration) return
    quoteCandidates.value = result.items.filter(quoteMatchesOpening)
    if (!quoteCandidates.value.length) quoteIssue.value = 'No se encontraron QUO aceptadas compatibles. Revisa el número o los filtros de cliente y embarque.'
  } catch {
    if (generation === quoteGeneration) quoteIssue.value = 'No se pudieron consultar las cotizaciones. Reintenta.'
  } finally {
    if (generation === quoteGeneration) quoteBusy.value = false
  }
}
// Resolve real catalog identifiers, not labels or fabricated UUIDs.
function quoteCatalogItem(group: string, id?: string | null, code?: string | null, name?: string | null) {
  const items = currentCatalog(group).filter(item => item.isActive)
  const key = (value: unknown) => String(value || '').trim().toLowerCase()
  return (id && items.find(item => key(item.id) === key(id))) ||
    (code && items.find(item => key(item.code) === key(code))) ||
    (name && items.find(item => [item.label, item.value, optionText(item)].some(value => key(value) === key(name)))) || undefined
}

function quoteInlandPoints(points: Array<{ address: string; latitude?: number | null; longitude?: number | null; cargoCondition?: 'FiscalCargo' | 'NationalizedCargo' | null }>): InlandPoint[] {
  return points.filter(point => typeof point?.address === 'string' && point.address.trim()).map(point => ({
    address: point.address, latitude: point.latitude, longitude: point.longitude, cargoCondition: point.cargoCondition,
  }))
}

function hydrateQuoteOpening(rate: OperationsQuoteDetail) {
  const warnings: string[] = []
  const mode = rate.shipmentMode.toUpperCase()
  if (!accountId.value && rate.clientAccountId) {
    accountId.value = rate.clientAccountId
    onCrmClientSelected({ id: rate.clientAccountId, displayName: rate.clientName || '', executiveName: '' })
  }
  if (!modality.value) {
    selectTransport(quoteTransport(mode))
    selectShipment(mode)
  }
  if (mode === 'LCL') {
    form.value.consolidationId = rate.consolidationId || ''
    form.value.consolidationNumber = rate.consolidationNumber ?? null
    form.value.consolidationReference = rate.consolidationReference || ''
  }
  const term = normalizeIncotermCode(rate.incotermCode, rate.incotermName)
  if (term && incotermChoices.value.some(item => item.value === term)) {
    form.value.incoterm = term
    form.value.incotermName = term
  } else if (rate.incotermCode || rate.incotermName) warnings.push('Incoterm')
  for (const [group, target, id, code, name] of [
    ['pol', selectedPol, rate.polId, rate.polCode, rate.polName],
    ['poe', selectedPoe, rate.poeId, rate.poeCode, rate.poeName],
    ['pod', selectedPod, rate.podId, rate.podCode, rate.podName],
  ] as const) {
    if (group === 'pod' && !showPod.value) continue
    if (!id && !name && !code) continue
    const item = quoteCatalogItem(group, id, code, name)
    if (item && locationChoices(group).some(option => option.value === item.id)) {
      target.value = item.id
      form.value[group] = optionText(item)
    } else {
      target.value = ''
      form.value[group] = name || code || ''
      warnings.push(group.toUpperCase())
    }
  }
  if (rate.operationType && ['Import','Export','TransitDomestic'].includes(rate.operationType))
    form.value.operationOverride = rate.operationType
  const carrier = quoteCatalogItem('carriers', rate.carrierId, rate.carrierCode, rate.carrierName)
  if (showCarrier.value && carrier) setProvider('carrier', carrier.id)
  else if (showCarrier.value && (rate.carrierId || rate.carrierName)) warnings.push('Naviera')
  const agent = quoteCatalogItem('agents', rate.agentId, rate.agentCode, rate.agentName)
  if (agent && eligibleAgents.value.some(item => item.id === agent.id)) setProvider('agent', agent.id)
  else if (rate.agentId || rate.agentName) warnings.push('Agente')
  if (rate.warehouseId && requiresWarehouse.value) {
    const whs = quoteCatalogItem('warehouses', rate.warehouseId)
    if (whs && warehouseOptions.value.some(option => option.value === whs.id)) {
      selectedWarehouse.value = whs.id
      form.value.warehouseId = whs.id
      form.value.whsName = optionText(whs)
      form.value.warehouseAddress = String(catalogMetadata(whs).address || catalogMetadata(whs).fullAddress || '')
    } else warnings.push('WHS')
  }
  if (positive(rate.totalPackages)) form.value.packageCount = String(rate.totalPackages)
  if (positive(rate.totalWeightKg)) {
    form.value.estimatedWeightValue = String(rate.totalWeightKg)
    form.value.estimatedWeightUnit = 'KG'
  }
  if (positive(rate.totalVolumeCbm)) {
    form.value.volumeValue = String(rate.totalVolumeCbm)
    form.value.volumeUnit = 'CBM'
  }
  const lines = rate.cargoLines || []
  if (lines.some(line => line.isStackable === false)) form.value.stackable = false
  else if (lines.length && lines.every(line => line.isStackable === true)) form.value.stackable = true
  if (rate.containers?.some(item => (item.overweightUnitCount ?? 0) > 0)) form.value.overweight = true
  const descriptions = [...new Set(lines.map(line => line.description?.trim()).filter(Boolean))]
  if (descriptions.length) form.value.cargoDescription = descriptions.join(' · ')
  // A single dimension set is only meaningful when the quote has one cargo line.
  if (mode === 'AIR' && lines.length === 1 && lines[0]) {
    const line = lines[0]
    for (const axis of ['length','width','height'] as const) {
      const value = line[`${axis}Cm`]
      if (positive(value)) {
        form.value[`${axis}Value`] = String(value)
        form.value[`${axis}Unit`] = 'CM'
      }
    }
  }
  if (needsEquipment.value) {
    const containers = rate.containers?.length ? rate.containers : [{
      containerTypeId: rate.containerTypeId, containerTypeName: rate.containerTypeName,
      containerTypeCode: rate.containerTypeCode, quantity: rate.containerQuantity,
    }]
    const equipment = new Map<string, typeof form.value.equipment[number]>()
    for (const row of containers) {
      if (!positive(row.quantity)) continue
      const item = quoteCatalogItem(equipmentCatalogKey.value, row.containerTypeId, row.containerTypeCode, row.containerTypeName)
      if (!item) { warnings.push('Tipo de equipo: ' + (row.containerTypeName || row.containerTypeCode || 'sin catálogo')); continue }
      const existing = equipment.get(item.id)
      if (existing) existing.quantity += row.quantity
      else equipment.set(item.id, { equipmentType: optionText(item), equipmentCatalogId: item.id, quantity: row.quantity })
    }
    if (equipment.size) form.value.equipment = [...equipment.values()]
  }
  if (rate.services?.length) {
    const services = rate.services.map(service => quoteCatalogItem('pricing-services', service.id, service.code, service.name)?.id)
    if (services.some(id => !id)) warnings.push('Servicios sin correspondencia en catálogo')
    const ids = services.filter((id): id is string => Boolean(id))
    if (ids.length) form.value.services = [...new Set(ids)]
  }
  const pickups = quoteInlandPoints(rate.inlandPickupLocations?.length ? rate.inlandPickupLocations :
    rate.inlandPickupLocation ? [rate.inlandPickupLocation] : rate.pickupLocations?.length ? rate.pickupLocations :
    rate.pickupAddress ? [{ address: rate.pickupAddress, latitude: rate.pickupLatitude, longitude: rate.pickupLongitude }] : [])
  const deliveries = quoteInlandPoints(rate.inlandDeliveryLocations?.length ? rate.inlandDeliveryLocations :
    rate.inlandDeliveryLocation ? [rate.inlandDeliveryLocation] : [])
  if (pickups.length) {
    form.value.requiresPickup = true
    form.value.pickupLocations = pickups
    form.value.pickupAddress = pickups[0]!.address
  }
  if (deliveryRequired.value && deliveries.length) {
    form.value.requiresDelivery = true
    form.value.deliveryLocations = deliveries
    form.value.destinationAddress = deliveries[0]!.address
  }
  return warnings
}

async function selectQuote(id: string) {
  const selected = quoteCandidates.value.find(rate => rate.id === id)
  const reload = id === quoteRateId.value
  if ((!selected && !reload) || (selected && !quoteMatchesOpening(selected)) || !canSelectQuote.value || assignmentPendingId.value || quoteBusy.value) return
  const generation = ++quoteGeneration
  quoteBusy.value = true
  quoteIssue.value = ''
  try {
    const rate = await operationsQuoteApi.detail(id)
    if (generation !== quoteGeneration) return
    if (rate.id !== id || !quoteMatchesOpening(rate)) {
      quoteIssue.value = 'La cotización ya no es compatible o no está aceptada. Revisa los datos.'
      return
    }
    applyingQuote = true
    try {
      const warnings = hydrateQuoteOpening(rate)
      await nextTick()
      if (generation !== quoteGeneration) return
      quoteRateId.value = rate.id
      quoteLabel.value = quoteOptionLabel(rate)
      quoteHydrated.value = true
      quoteIssue.value = warnings.length ? 'Datos de QUO cargados. Revisa los campos sin catálogo compatible: ' + [...new Set(warnings)].join(', ') : ''
    } finally { applyingQuote = false }
  } catch {
    if (generation === quoteGeneration) quoteIssue.value = 'No se pudo cargar el detalle de la QUO. Reintenta antes de crear el trámite.'
  } finally {
    if (generation === quoteGeneration) quoteBusy.value = false
  }
}
const priority = ref(1)
const complexity = ref(1)
const saving = ref(false)
const autosaveState = ref<'pending' | 'saved' | 'error'>('saved')
const lastAutoSaveAt = ref('')
const contactsTouched = ref(false)
const assignmentPendingId = ref('')
const autosaveReady = ref(false)
let autosaveTimer: ReturnType<typeof setTimeout> | undefined
const activeStep = ref(1)
const wizardSteps = [
  { id: 1, label: 'Cliente, ruta y servicios', hint: 'Cliente CRM, modalidad, embarque, Incoterm, terminales y servicios' },
  { id: 2, label: 'Carga y condiciones', hint: 'Bultos, peso, volumen, equipos y condiciones especiales' },
  { id: 3, label: 'Revisión', hint: 'Confirmar datos y enviar a Coordinación Origen' },
]
const activeStepMeta = computed(() => wizardSteps.find(x => x.id === activeStep.value) ?? wizardSteps[0]!)
const catalogLoading = ref(false)
const catalogIssue = ref('')
const catalogs = ref<Record<string, CatalogItemSelectDto[]>>({})
const selectedPol = ref('')
const selectedPoe = ref('')
const selectedPod = ref('')
const selectedWarehouse = ref('')
const warehouseCatalogGroup = ref('')
let restoringOpening = false
const currentCatalog = (key: string) => catalogs.value[key] || []
const optionText = (item: CatalogItemSelectDto) => String(item.value || item.label || item.code).trim()
const catalogChoices = (key: string) => currentCatalog(key).filter(item => item.isActive).map(item => ({ value: optionText(item), label: optionText(item) }))
type RouteTerminal = 'CY' | 'SD' | 'APT'
function routeTerminalType(item: CatalogItemSelectDto, fallback: RouteTerminal): RouteTerminal {
  let configured = ''
  try { configured = String(JSON.parse(item.metadataJson || '{}')?.terminalType || '').trim().toUpperCase() }
  catch { /* Legacy catalog items use the code or group fallback. */ }
  if (configured === 'CY' || configured === 'SD' || configured === 'APT') return configured
  const code = String(item.code || '').trim().toUpperCase()
  for (const terminal of ['CY', 'SD', 'APT'] as const)
    if (code.split('_').includes(terminal)) return terminal
  return fallback
}
const routeTerminal = computed<RouteTerminal>(() =>
  form.value.transportType === 'AIR' ? 'APT' : form.value.transportType === 'ROAD' ? 'SD' : 'CY')
const locationChoices = (key: string) => currentCatalog(key).filter(item => item.isActive &&
  (key === 'warehouses' || routeTerminalType(item, key === 'pod' ? 'SD' : 'CY') === (key === 'pod' ? 'SD' : routeTerminal.value)))
  .map(item => ({ value: item.id, label: optionText(item), searchText: [item.label,item.code,item.slug].join(' ') }))
function catalogCode(key: string, id: string): string { return currentCatalog(key).find(x => x.id === id && x.isActive)?.code || '' }
function selectedRouteType(key: 'pol' | 'poe' | 'pod', id: string): RouteTerminal | undefined {
  const item = currentCatalog(key).find(x => x.id === id && x.isActive)
  return item ? routeTerminalType(item, key === 'pod' ? 'SD' : 'CY') : undefined
}
const polOptions = computed(() => locationChoices('pol'))
const poeOptions = computed(() => locationChoices('poe'))
const podOptions = computed(() => locationChoices('pod'))
const warehouseOptions = computed(() => {
  const options = locationChoices('warehouses')
  if (editingId.value) return options
  const agent = eligibleAgents.value.find(item => item.id === form.value.agentId)
  if (!agent) return []
  const origin = countryFromRoute('pol', selectedPol.value, form.value.pol)
  // A historical WHS without an owner can be selected for this operation,
  // but must never be presented as a warehouse owned by the selected agent.
  const linked = []
  const unlinked = []
  for (const option of options) {
    const item = currentCatalog('warehouses').find(row => row.id === option.value)
    const ownership = warehouseAgentOwnership(item?.metadataJson, agent)
    if (ownership === 'linked') {
      const ownerLabel = String(catalogMetadata(item).agentId || '').trim() ? optionText(agent) : warehouseAgentNames(item?.metadataJson).join(' / ') || optionText(agent)
      linked.push({ ...option, label: option.label + ' · ' + ownerLabel,
        searchText: option.searchText + ' ' + ownerLabel + ' ' + optionText(agent) })
    } else if (ownership === 'unlinked') {
      const country = resolveLocationCountryCode(item, currentCatalog('countries'))
      if (!country || !origin || country === origin)
        unlinked.push({ ...option, label: option.label + ' · Sin agente vinculado', searchText: option.searchText + ' sin agente vinculado' })
    }
  }
  const available = [...linked, ...unlinked]
  // Same city can have multiple physical warehouses; never collapse distinct IDs.
  return available.map(option => available.filter(row => row.label === option.label).length > 1
    ? { ...option, label: option.label + ' · ' + catalogCode('warehouses', option.value) } : option)
})
const incotermChoices = computed(() => {
  const items = currentCatalog('incoterms').filter(item => item.isActive)
  const choices = items.map(item => {
    const code = normalizeIncotermCode(item.code, [item.value, item.label, item.slug].filter(Boolean).join(' '))
    return { value: code, label: optionText(item) }
  }).filter(item => incoterms.includes(item.value))
  const values = choices.length ? [...new Map(choices.map(item => [item.value, item])).values()] : incoterms.map(value => ({ label: value, value }))
  return values.filter(item => isMaritime.value || !['FAS','FOB','CFR','CIF'].includes(item.value))
})
function lookupLabel(key: string, id: string) { return optionText(currentCatalog(key).find(x => x.id === id) || { value: '', label: '', code: '' } as CatalogItemSelectDto) }
function selectedForLabel(key: string, label: string) {
  return currentCatalog(key).find(item => optionText(item).trim().toLowerCase() === label.trim().toLowerCase())?.id || ''
}
function reconcileLocations() {
  selectedPol.value = quoteCatalogItem('pol', editingId.value ? form.value.polCatalogId : undefined, undefined, form.value.pol)?.id || ''
  selectedPoe.value = quoteCatalogItem('poe', editingId.value ? form.value.poeCatalogId : undefined, undefined, form.value.poe)?.id || ''
  selectedPod.value = quoteCatalogItem('pod', editingId.value ? form.value.podCatalogId : undefined, undefined, form.value.pod)?.id || ''
  if (editingId.value) {
    if (!form.value.carrierId && form.value.carrierReference)
      form.value.carrierId = quoteCatalogItem('carriers', undefined, undefined, form.value.carrierReference)?.id || ''
    if (!form.value.agentId && form.value.agentReference)
      form.value.agentId = quoteCatalogItem('agents', undefined, undefined, form.value.agentReference)?.id || ''
  }
  selectedWarehouse.value = currentCatalog('warehouses').some(item => item.id === form.value.warehouseId && item.isActive)
    ? form.value.warehouseId : selectedForLabel('warehouses', form.value.whsName)
}
async function loadPricingCatalogs() {
  catalogLoading.value = true
  try {
    const names = ['pol','poe','pod','incoterms','container-types','land-equipment-sizes','countries','carriers','agents','pricing-services']
    const result = await Promise.all(names.map(async key => {
      try { return [key, await CatalogItemsService.select({ catalogGroupSlug: key })] as const }
      catch { return [key, [] as CatalogItemSelectDto[]] as const }
    }))
    const warehouseGroups = ['pricing-warehouses','warehouses','whs','fca-warehouses']
    let warehouseItems: CatalogItemSelectDto[] = []
    warehouseCatalogGroup.value = ''
    for (const key of warehouseGroups) {
      try { warehouseItems = await CatalogItemsService.select({ catalogGroupSlug: key }); if (warehouseItems.length) { warehouseCatalogGroup.value = key; break } } catch { /* legacy slug */ }
    }
    catalogs.value = { ...Object.fromEntries(result), warehouses: warehouseItems }
    if (!polOptions.value.length || !poeOptions.value.length || !podOptions.value.length)
      catalogIssue.value = 'No se pudieron consultar todos los catálogos de ubicaciones; puede conservar las referencias manuales.'
    reconcileLocations()
  } finally { catalogLoading.value = false }
}
function goToStep(target: number) {
  if (target < 1 || target > wizardSteps.length) return
  activeStep.value = target
  void nextTick(() => document.getElementById('operations-opening-wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
const loading = ref(true)
const error = ref('')
const form = ref({
  provenance: 'CLIENT', clientPoReference: '', crmDivisionId: '', crmDivisionName: '',
  shipmentType: '', cargoNature: '', transportType: '', incoterm: '', incotermName: '',
  pol: '', poe: '', pod: '', polCatalogId: '', poeCatalogId: '', podCatalogId: '', pickupAddress: '', pickupContact: '',
  pickupWindow: '', requiresPickup: false, whsName: '',
  destinationAddress: '', cargoDescription: '', packageCount: '',
  packageType: '', weightValue: '', weightUnit: 'KG',
  estimatedWeightValue: '', estimatedWeightUnit: 'KG',
  lengthCm: '', widthCm: '', heightCm: '', lengthValue: '', widthValue: '', heightValue: '',
  lengthUnit: 'CM', widthUnit: 'CM', heightUnit: 'CM', operationDirection: '',
  clientCountryId: '', clientCountryOverrideId: '', operationOverride: '' as RateOperationType | '',
  pickupLocations: [] as InlandPoint[], deliveryLocations: [] as InlandPoint[], requiresDelivery: false, warehouseId: '', warehouseAddress: '',
  volumeValue: '', volumeUnit: 'CBM', consolidationReference: '', consolidationId: '', consolidationNumber: null as number | null,
  isImo: null as boolean | null, imoClass: '', unNumber: '', stackable: null as boolean | null,
  overweight: null as boolean | null, overweightNotes: '', carrierReference: '',
  agentReference: '', merchantReference: '', carrierId: '', agentId: '', merchantId: '', haulageMode: '', airline: '', roadCarrierReference: '', etm: '', eta: '',
  services: [] as string[], observations: '',
  contactReferences: '', contactIds: [] as string[], commercialReviewRequested: false,
  equipment: [] as Array<{ equipmentType: string; equipmentCatalogId?: string; quantity: number; weightKg?: number }>,
  originCountryCode: '', destinationCountryCode: '',
  cabysSearch: '', cabysCode: '', portHandlingMode: '',
  supportEntityId: '',
  supportDocuments: [] as Array<{ id: string; fileName: string; category: string; categoryLabel: string; sizeInBytes: number }>,
})
const eligibleAgents = computed(() => {
  const origin = currentCatalog('pol').find(item => item.id === selectedPol.value)
  if (!origin) return []
  return currentCatalog('agents').filter(item => item.isActive && agentMatchesOrigin(item, origin, currentCatalog('pol'), false))
})
const providerOptions = (group: string, previous: string, id: string) => {
  const options = (group === 'agents' ? eligibleAgents.value : currentCatalog(group).filter(item => item.isActive)).map(item => ({ value: item.id, label: optionText(item) }))
  if (editingId.value && id && previous && !options.some(option => option.value === id)) options.push({ value: id, label: previous + ' (registrado)' })
  return options
}
watch([selectedPol, eligibleAgents, catalogLoading], () => {
  if (editingId.value || restoringOpening || catalogLoading.value || !form.value.agentId) return
  if (!eligibleAgents.value.some(item => item.id === form.value.agentId)) setProvider('agent', '')
})
const serviceOptions = computed(() => currentCatalog('pricing-services').filter(item => item.isActive).map(item => ({ value: item.id, label: optionText(item) })))
const selectedServiceLabels = computed(() => (form.value.services as unknown[]).map(service => {
  if (typeof service === 'string') return serviceOptions.value.find(option => option.value === service)?.label || 'Servicio registrado'
  if (service && typeof service === 'object') {
    const row = service as Record<string, unknown>
    return String(row.name || row.serviceName || row.serviceCode || 'Servicio registrado')
  }
  return 'Servicio registrado'
}))
function setProvider(role: 'carrier' | 'agent' | 'merchant', id: string) {
  const group = role === 'carrier' ? 'carriers' : 'agents'
  const label = lookupLabel(group, id)
  if (role === 'carrier') { form.value.carrierId = id; form.value.carrierReference = label }
  else if (role === 'agent') {
    const changed = form.value.agentId !== id
    form.value.agentId = id
    form.value.agentReference = label
    if (!editingId.value && selectedWarehouse.value && (!warehouseOptions.value.some(option => option.value === selectedWarehouse.value) ||
      (changed && warehouseAgentOwnership(warehouse.value?.metadataJson) === 'unlinked'))) clearWarehouse()
  }
  else { form.value.merchantId = id; form.value.merchantReference = label }
}
const cabysResults = ref<Array<{ code: string; description: string }>>([])
const searchingCabys = ref(false)
const uploadingSupport = ref('')
const supportCategories = [
  {key:'OC',label:'OC / Detalle de la carga'}, {key:'PL',label:'Packing List (PL)'},
  {key:'INVOICE',label:'Invoice'}, {key:'MSDS',label:'MSDS / Ficha técnica'},
]
const supportAccept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp'
const packageTypeOptions = [
  { label: 'Cajas', value: 'Cajas' }, { label: 'Pallets / tarimas', value: 'Pallets' },
  { label: 'Bultos', value: 'Bultos' }, { label: 'Sacos', value: 'Sacos' },
  { label: 'Fardos', value: 'Fardos' }, { label: 'Rollos', value: 'Rollos' },
  { label: 'Tambores', value: 'Tambores' }, { label: 'Piezas', value: 'Piezas' },
  { label: 'Granel', value: 'Granel' }, { label: 'Otros', value: 'Otros' },
]
const cargoNatureOptions = [
  { label: 'Carga general', value: 'Carga general' },
  { label: 'Perecedera', value: 'Perecedera' },
  { label: 'Refrigerada', value: 'Refrigerada' },
  { label: 'Peligrosa / IMO', value: 'Peligrosa' },
  { label: 'Frágil', value: 'Frágil' },
  { label: 'Sobredimensionada', value: 'Sobredimensionada' },
  { label: 'Otro', value: 'Otro' },
]
const packageTypeChoiceOptions = computed(() => form.value.packageType &&
  !packageTypeOptions.some(x => x.value === form.value.packageType)
  ? [...packageTypeOptions, { label: form.value.packageType + ' (registrado)', value: form.value.packageType }]
  : packageTypeOptions)
const cargoNatureChoiceOptions = computed(() => form.value.cargoNature &&
  !cargoNatureOptions.some(x => x.value === form.value.cargoNature)
  ? [...cargoNatureOptions, { label: form.value.cargoNature + ' (registrado)', value: form.value.cargoNature }]
  : cargoNatureOptions)
const modalOptions = [
  { label: 'FCL', value: 'FCL' }, { label: 'LCL', value: 'LCL' },
  { label: 'FTL', value: 'FTL' }, { label: 'LTL', value: 'LTL' },
  { label: 'Aéreo', value: 'AIR' },
]
const transportSelectionOptions = [
  { label: 'Marítimo', value: 'MARITIME', caption: 'FCL o LCL' },
  { label: 'Aéreo', value: 'AIR', caption: 'Carga aérea internacional' },
  { label: 'Terrestre', value: 'ROAD', caption: 'FTL o LTL' },
]
const shipmentOptionsByTransport: Record<string, Array<{ label: string; value: string }>> = {
  MARITIME: [{ label: 'FCL · Contenedor completo', value: 'FCL' }, { label: 'LCL · Coloading / propio', value: 'LCL' }],
  AIR: [{ label: 'Carga aérea', value: 'AIR' }],
  ROAD: [{ label: 'FTL · Furgón completo', value: 'FTL' }, { label: 'LTL · Carga consolidada', value: 'LTL' }],
  MULTIMODAL: [{ label: 'FCL · Contenedor completo', value: 'FCL' }, { label: 'LCL · Carga consolidada', value: 'LCL' },
    { label: 'FTL · Furgón completo', value: 'FTL' }, { label: 'LTL · Carga consolidada', value: 'LTL' }],
}
const shipmentOptions = computed(() => shipmentOptionsByTransport[form.value.transportType] ?? [])
const effectiveShipment = computed(() => {
  const saved = form.value.shipmentType.toUpperCase()
  return shipmentOptions.value.some(item => item.value === saved) ? saved :
    shipmentOptions.value.some(item => item.value === modality.value) ? modality.value : ''
})
const equipmentCatalogKey = computed(() => effectiveShipment.value === 'FTL' ? 'land-equipment-sizes' : 'container-types')
function selectTransport(value: string) {
  if (form.value.transportType === value) return
  const available = shipmentOptionsByTransport[value] ?? []
  form.value.transportType = value
  if (value !== 'MARITIME') { form.value.carrierId = ''; form.value.carrierReference = ''; form.value.merchantId = ''; form.value.merchantReference = ''; form.value.haulageMode = '' }
  if (value !== 'AIR') form.value.airline = ''
  if (value !== 'ROAD') form.value.roadCarrierReference = ''
  form.value.operationOverride = ''
  if (!['MARITIME','MULTIMODAL'].includes(value)) { selectedPod.value = ''; form.value.pod = '' }
  selectedPol.value = ''
  selectedPoe.value = ''
  form.value.pol = ''
  form.value.poe = ''
  form.value.equipment = []
  if (!['MARITIME', 'MULTIMODAL'].includes(value)) form.value.portHandlingMode = ''
  if (available.length === 1 && available[0]) {
    form.value.shipmentType = available[0].value
    modality.value = available[0].value
  } else if (!available.some(item => item.value === effectiveShipment.value)) {
    form.value.shipmentType = ''
    modality.value = ''
  } else {
    modality.value = value === 'MULTIMODAL' ? 'MULTIMODAL' : effectiveShipment.value
  }
  if (!['MARITIME', 'MULTIMODAL'].includes(value) && ['FAS','FOB','CFR','CIF'].includes(selectedIncoterm.value)) {
    form.value.incoterm = ''
    form.value.incotermName = ''
  }
}
function selectShipment(value: string) {
  if (!shipmentOptions.value.some(item => item.value === value)) return
  if (form.value.shipmentType !== value) {
    form.value.equipment = []
    form.value.portHandlingMode = ''
  }
  form.value.shipmentType = value
  modality.value = form.value.transportType === 'MULTIMODAL' ? 'MULTIMODAL' : value
}
function resolvedEquipmentId(item: { equipmentType: string; equipmentCatalogId?: string }) {
  return item.equipmentCatalogId || selectedForLabel(equipmentCatalogKey.value, item.equipmentType)
}
function setEquipmentType(item: { equipmentType: string; equipmentCatalogId?: string }, id: string) {
  if (id && form.value.equipment.some(other => other !== item && resolvedEquipmentId(other) === id)) {
    error.value = 'Este tipo de equipo ya está agregado. Aumenta su cantidad en la misma fila.'
    return
  }
  error.value = ''
  item.equipmentCatalogId = id
  item.equipmentType = lookupLabel(equipmentCatalogKey.value, id) || id
}
const totalEquipment = computed(() => form.value.equipment.reduce((total, row) => total + (Number(row.quantity) || 0), 0))
const uniqueEquipment = computed(() => {
  const ids = form.value.equipment.map(resolvedEquipmentId).filter(Boolean)
  return ids.length === new Set(ids).size
})
const originOptions = [
  { label: 'Cliente', value: 'CLIENT' }, { label: 'Proveedor', value: 'SUPPLIER' },
  { label: 'Agente', value: 'AGENT' }, { label: 'Oficina de origen', value: 'ORIGIN_OFFICE' },
]
const incoterms = ['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP']
const isMaritime = computed(() => ['MARITIME','MULTIMODAL'].includes(form.value.transportType))
const needsEquipment = computed(() => ['FCL','FTL'].includes(effectiveShipment.value))
const selectedIncoterm = computed(() => form.value.incoterm
  ? normalizeIncotermCode(form.value.incoterm, form.value.incotermName)
  : '')
const requiresWarehouse = computed(() => ['LCL', 'LTL'].includes(effectiveShipment.value) ||
  (selectedIncoterm.value === 'FCA' && (needsEquipment.value || Boolean(editingId.value))))
const showCarrier = computed(() => editingId.value ? isMaritime.value : effectiveShipment.value === 'FCL')
const showPod = computed(() => isMaritime.value)
const clientCountry = computed(() => resolveCrmCountryCode(form.value.clientCountryId, currentCatalog('countries')) ||
  resolveCrmCountryCode(form.value.clientCountryOverrideId, currentCatalog('countries')))
const automaticOperation = computed(() => operationForClientCountry(clientCountry.value,
  countryFromRoute('pol', selectedPol.value, form.value.pol),
  showPod.value && selectedPod.value ? countryFromRoute('pod', selectedPod.value, form.value.pod) : countryFromRoute('poe', selectedPoe.value, form.value.poe)))
const operation = computed(() => form.value.operationOverride || automaticOperation.value || (editingId.value ? (form.value.operationDirection === 'IMPORT' ? 'Import' : form.value.operationDirection === 'EXPORT' ? 'Export' : form.value.operationDirection === 'OTHER' ? 'TransitDomestic' : null) : null))
const routingCountries = computed(() => ({
  origin: countryFromRoute('pol', selectedPol.value, form.value.pol),
  destination: showPod.value && selectedPod.value
    ? countryFromRoute('pod', selectedPod.value, form.value.pod)
    : countryFromRoute('poe', selectedPoe.value, form.value.poe),
}))
const originTeamPreview = computed(() => {
  const { origin, destination } = routingCountries.value
  if (!origin || !destination || !operation.value || !effectiveShipment.value) return 'Por determinar'
  if (operation.value === 'TransitDomestic' && origin !== destination) return 'Origen · Tránsito'
  if (origin === 'US' || destination === 'US') return 'Origen · Estados Unidos'
  const centralAmerica = ['BZ', 'GT', 'SV', 'HN', 'NI', 'CR', 'PA']
  if (centralAmerica.includes(origin) && centralAmerica.includes(destination)) return 'Origen · Centroamérica'
  if (effectiveShipment.value === 'FCL') return 'Origen · FCL internacional'
  if (['LCL', 'AIR'].includes(effectiveShipment.value)) return 'Origen · LCL y Aéreo internacional'
  if (effectiveShipment.value === 'FTL') return 'Origen · FTL'
  if (effectiveShipment.value === 'LTL') return 'Origen · LTL'
  return 'Por determinar'
})
const operationLabel = computed(() => operation.value === 'Import' ? 'Importación' :
  operation.value === 'Export' ? 'Exportación' : operation.value === 'TransitDomestic' ? 'Tránsito / doméstico' : '')
const showOperationOverride = ref(false)
function clearWarehouse() {
  selectedWarehouse.value = ''
  form.value.whsName = ''
  form.value.warehouseId = ''
  form.value.warehouseAddress = ''
}
const warehouse = computed(() => currentCatalog('warehouses').find(item => item.id === selectedWarehouse.value))
const warehouseAgent = computed(() => {
  if (!warehouse.value) return undefined
  const agents = currentCatalog('agents').filter(item => warehouseAgentOwnership(warehouse.value?.metadataJson, item) === 'linked')
  return agents.find(item => item.id === form.value.agentId) || agents[0]
})
const warehouseOwnerLabel = computed(() => {
  if (!warehouse.value) return ''
  if (String(catalogMetadata(warehouse.value).agentId || '').trim())
    return warehouseAgent.value ? optionText(warehouseAgent.value) : 'Agente registrado no disponible'
  return warehouseAgentNames(warehouse.value.metadataJson).join(' / ') ||
    (warehouseAgent.value ? optionText(warehouseAgent.value) : '') ||
    (warehouseAgentOwnership(warehouse.value.metadataJson) === 'unlinked' ? 'Sin agente vinculado en Config' : 'Agente registrado no disponible')
})
watch([warehouseOptions, catalogLoading], () => {
  if (editingId.value || restoringOpening || catalogLoading.value || !form.value.agentId || !selectedWarehouse.value) return
  if (!warehouseOptions.value.some(option => option.value === selectedWarehouse.value)) clearWarehouse()
})
const warehouseMeta = computed(() => catalogMetadata(warehouse.value))
const warehouseAddress = computed(() => String(warehouseMeta.value.address || warehouseMeta.value.fullAddress || form.value.warehouseAddress || '').trim())
const deliveryRequired = computed(() => (form.value.services as unknown[]).some(service => {
  const item = typeof service === 'string' ? currentCatalog('pricing-services').find(row => row.id === service) : service
  const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
  const key = [typeof service === 'string' ? service : '', row.code, row.label, row.name, row.serviceCode, row.serviceName].filter(Boolean).join(' ')
  return /\b(entrega|deliver(y|ies))\b/i.test(key)
}))
const validPoints = (points: InlandPoint[]) => points.length > 0 && points.every(p => typeof p?.address === 'string' && p.address.trim() &&
  ['FiscalCargo','NationalizedCargo'].includes(p.cargoCondition || ''))
// New manual openings must not assign commercial billing responsibility.
const operationalPoints = (points: InlandPoint[]): InlandPoint[] => points.map(point => {
  const copy = { ...point }
  delete copy.billingParty
  return copy
})
const pickupPoint = computed<InlandPoint>({
  get: () => form.value.pickupLocations[0] || { address: form.value.pickupAddress },
  set: p => { form.value.pickupAddress = p.address },
})
const deliveryPoint = computed<InlandPoint>({
  get: () => form.value.deliveryLocations[0] || { address: form.value.destinationAddress },
  set: p => { form.value.destinationAddress = p.address },
})
const requiresExwPickup = computed(() => selectedIncoterm.value === 'EXW')
const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0
const dimensionOptions = [{ label: 'cm', value: 'CM' }, { label: 'm', value: 'M' }, { label: 'in', value: 'IN' }]
function toCm(value: unknown, unit: string) {
  if (!positive(value)) return ''
  const factor = unit === 'M' ? 100 : unit === 'IN' ? 2.54 : 1
  return String(Number(value) * factor)
}
function restoreDimensionValues() {
  for (const axis of ['length', 'width', 'height'] as const) {
    if (!positive(form.value[`${axis}Value`]) && positive(form.value[`${axis}Cm`])) {
      form.value[`${axis}Value`] = String(form.value[`${axis}Cm`])
      form.value[`${axis}Unit`] = 'CM'
    }
  }
}
watch(() => [form.value.lengthValue, form.value.lengthUnit, form.value.widthValue, form.value.widthUnit, form.value.heightValue, form.value.heightUnit], () => {
  form.value.lengthCm = toCm(form.value.lengthValue, form.value.lengthUnit)
  form.value.widthCm = toCm(form.value.widthValue, form.value.widthUnit)
  form.value.heightCm = toCm(form.value.heightValue, form.value.heightUnit)
})
const estimatedKg = computed(() => positive(form.value.estimatedWeightValue)
  ? Number(form.value.estimatedWeightValue) * (form.value.estimatedWeightUnit === 'LB' ? 0.45359237 : 1) : null)
const normalizedVolume = computed(() => positive(form.value.volumeValue)
  ? Number(form.value.volumeValue) * (form.value.volumeUnit === 'CFT' ? 0.028316846592 : 1) : null)
// Only user-driven unit changes convert the value. QUO hydration and restored drafts
// continue to assign their original unit and value together.
const weightUnitSelection = computed({
  get: () => form.value.estimatedWeightUnit,
  set: (unit: string) => {
    if (unit !== 'KG' && unit !== 'LB') return
    if (unit === form.value.estimatedWeightUnit) return
    const kg = estimatedKg.value
    if (kg !== null) form.value.estimatedWeightValue = String(kg / (unit === 'LB' ? 0.45359237 : 1))
    form.value.estimatedWeightUnit = unit
  },
})
const volumeUnitSelection = computed({
  get: () => form.value.volumeUnit,
  set: (unit: string) => {
    if (unit !== 'CBM' && unit !== 'CFT') return
    if (unit === form.value.volumeUnit) return
    const cbm = normalizedVolume.value
    if (cbm !== null) form.value.volumeValue = String(cbm / (unit === 'CFT' ? 0.028316846592 : 1))
    form.value.volumeUnit = unit
  },
})
function measurementLabel(value: number | null) {
  return value == null ? '—' : value.toLocaleString('es-CR', { maximumFractionDigits: 4 })
}
const consolidationRows = ref<OperationsConsolidation[]>([])
const consolidationLoading = ref(false)
const consolidationError = ref('')
let consolidationRequest = 0
async function loadConsolidations() {
  const generation = ++consolidationRequest
  consolidationRows.value = []
  consolidationError.value = ''
  if (effectiveShipment.value !== 'LCL') { consolidationLoading.value = false; return }
  consolidationLoading.value = true
  try {
    const rows = await operationsQuoteApi.consolidations('LCL')
    if (generation === consolidationRequest) consolidationRows.value = rows
  } catch (cause) {
    if (generation === consolidationRequest) consolidationError.value = 'No se pudieron consultar los consolidados de Pricing. ' + (cause instanceof Error ? cause.message : '')
  } finally { if (generation === consolidationRequest) consolidationLoading.value = false }
}
const selectedConsolidation = computed(() => consolidationRows.value.find(row => form.value.consolidationId ? row.id === form.value.consolidationId : form.value.consolidationNumber != null ? row.number === form.value.consolidationNumber : false))
const consolidationOptions = computed(() => [{ label: 'Por confirmar / sin consolidado propio', value: '' }, ...consolidationRows.value.filter(row => row.isActive || row.id === selectedConsolidation.value?.id).map(row => ({ label: row.name, value: row.id }))])
function selectConsolidation(value: string | number) {
  const row = consolidationRows.value.find(item => item.id === String(value))
  form.value.consolidationId = row?.id || ''
  form.value.consolidationNumber = row?.number ?? null
  form.value.consolidationReference = row?.name || ''
}
watch(effectiveShipment, (mode, previous) => {
  if (previous && mode !== previous && !restoringOpening && !applyingQuote) selectConsolidation('')
  void loadConsolidations()
}, { immediate: true })
watch(activeStep, step => { if (step === 2 && effectiveShipment.value === 'LCL' && !consolidationLoading.value && (!consolidationRows.value.length || consolidationError.value)) void loadConsolidations() })
watch(selectedConsolidation, row => { if (row && effectiveShipment.value === 'LCL') { form.value.consolidationId = row.id; form.value.consolidationNumber = row.number; form.value.consolidationReference = row.name } })
const pickupServiceSelected = computed(() => (form.value.services as unknown[]).some(service => {
  const item = typeof service === 'string' ? currentCatalog('pricing-services').find(row => row.id === service) : service
  const row = item && typeof item === 'object' ? item as unknown as Record<string, unknown> : {}
  const key = [typeof service === 'string' ? service : '', row.code, row.slug, row.label, row.value, row.name, row.serviceName, row.serviceCode].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return /recolec|pick[\s_-]*up/.test(key)
}))
const pickupRequired = computed(() => requiresExwPickup.value || pickupServiceSelected.value)
const stackableApplicable = computed(() => ['LCL', 'LTL', 'AIR', 'AIRCONSOL'].includes(effectiveShipment.value))
function conditionLabel(value: boolean | null) { return value === true ? 'Sí' : value === false ? 'No' : 'Por confirmar' }
function toggleCondition(value: boolean | null) { return value !== true }
const valid = computed(() =>
  (editingId.value ? canEdit.value : /^[0-9a-f-]{36}$/i.test(companyId.value)) &&
  (modalOptions.some(x => x.value === modality.value) || (Boolean(editingId.value) && modality.value === 'MULTIMODAL')) &&
  /^[0-9a-f-]{36}$/i.test(accountId.value) &&
  priority.value >= 1 && priority.value <= 5 && complexity.value > 0 &&
  (!form.value.originCountryCode || /^[A-Za-z]{2}$/.test(form.value.originCountryCode)) &&
  (!form.value.destinationCountryCode || /^[A-Za-z]{2}$/.test(form.value.destinationCountryCode)) &&
  (!needsEquipment.value || (form.value.equipment.every(x => Number.isInteger(x.quantity) && x.quantity > 0 && (x.weightKg == null || Number(x.weightKg) >= 0)) &&
  uniqueEquipment.value)))
const blockers = computed(() => {
  const result: string[] = []
  if (!editingId.value && quoteRateId.value && !quoteHydrated.value) result.push('Cargar datos de la QUO')
  if (!editingId.value && quoteBusy.value) result.push('Cargando cotización')
  if (!editingId.value && !form.value.services.length) result.push('Servicios solicitados')
  if (!accountId.value) result.push('Cliente CRM')
  else if (!executiveLoading.value && !executiveAssigned.value) result.push('Ejecutivo comercial por asignar en CRM')
  if (!form.value.transportType) result.push('Modalidad de transporte')
  if (!effectiveShipment.value) result.push('Tipo de embarque')
  if (editingId.value && !form.value.cargoDescription.trim()) result.push('Descripción de la carga')
  if (!form.value.pol.trim()) result.push('POL / lugar de origen')
  if (!form.value.poe.trim()) result.push('POE / destino')
  if (!editingId.value) {
    if (!operation.value) result.push('País del cliente o sentido de operación')
    if (form.value.pol.trim() && selectedRouteType('pol', selectedPol.value) !== routeTerminal.value) result.push('Origen compatible con la modalidad')
    if (form.value.poe.trim() && selectedRouteType('poe', selectedPoe.value) !== routeTerminal.value) result.push('Entrada compatible con la modalidad')
    if (showPod.value && form.value.pod.trim() && selectedRouteType('pod', selectedPod.value) !== 'SD') result.push('Destino final compatible')
    if (!positive(form.value.estimatedWeightValue) || !['KG', 'LB'].includes(form.value.estimatedWeightUnit)) result.push('Peso estimado')
    if (!positive(form.value.volumeValue) || !['CBM','CFT'].includes(form.value.volumeUnit)) result.push('Volumen de carga')
    if (!positive(form.value.packageCount) || !Number.isInteger(Number(form.value.packageCount))) result.push('Cantidad de bultos')
    if (showCarrier.value && !form.value.carrierId) result.push('Naviera')
  }
  if (!incoterms.includes(selectedIncoterm.value) || (!isMaritime.value && ['FAS','FOB','CFR','CIF'].includes(selectedIncoterm.value))) result.push('Incoterm aplicable al transporte')
  if (editingId.value && pickupRequired.value) {
    if (!form.value.pickupAddress.trim() && !validPoints(form.value.pickupLocations)) result.push('Dirección de recolecta')
  }
  if (needsEquipment.value && !form.value.equipment.length) result.push('Equipos')
  if (needsEquipment.value && form.value.equipment.some(x => !x.equipmentType.trim() || (!editingId.value && !currentCatalog(equipmentCatalogKey.value).some(item => item.id === resolvedEquipmentId(x) && item.isActive)))) result.push('Tipo de equipo por seleccionar')
  if (needsEquipment.value && !uniqueEquipment.value) result.push('Equipos duplicados: unifica las cantidades')
  if (!editingId.value && requiresWarehouse.value) {
    if (!eligibleAgents.value.some(item => item.id === form.value.agentId)) result.push('Agente de origen del WHS')
    if (!warehouseOptions.value.some(option => option.value === selectedWarehouse.value)) result.push('WHS compatible con el agente')
  }
  if (requiresWarehouse.value && !(warehouse.value || (!warehouseOptions.value.length && form.value.warehouseAddress.trim()))) result.push('WHS global o dirección del WHS')
  if (editingId.value && form.value.isImo && (!form.value.imoClass || !form.value.unNumber)) result.push('Clase IMO / número UN')
  if (editingId.value && form.value.overweight && !form.value.overweightNotes.trim()) result.push('Observaciones de sobrepeso')
  return result
})
function addEquipment() { form.value.equipment.push({ equipmentType: '', equipmentCatalogId: '', quantity: 1 }) }

function toggleOperationalContact(id: string, selected: boolean) {
  contactsTouched.value = true
  form.value.contactIds = selected
    ? [...new Set([...form.value.contactIds, id])]
    : form.value.contactIds.filter(x => x !== id)
  // Keep legacy field for older cases; real IDs live in contactIds.
  form.value.contactReferences = form.value.contactIds.join(',')
}

async function resolveCrmOpeningData(id: string, client: {
  executiveName?: string; executiveUserId?: string; isCastroFallasExecutive?: boolean
}) {
  const generation = ++clientGeneration
  executiveLoading.value = true
  operationalContactsLoading.value = true
  operationalContacts.value = []
  operationalContactsIssue.value = ''
  executiveName.value = client.executiveName?.trim() || ''
  executiveUserId.value = client.executiveUserId?.trim() || ''
  institutionalExecutive.value = client.isCastroFallasExecutive === true
  try {
    const [accountResponse, contactsResponse] = await Promise.allSettled([
      crmGet('operations/accounts', id),
      editingId.value ? operationsApi.caseContactDirectory(editingId.value) :
        crmRequest<unknown>(crmPath('operations/accounts', id, 'contacts') + '?includeDirectory=true'),
    ])
    if (generation !== clientGeneration || accountId.value !== id) return
    if (accountResponse.status === 'fulfilled') {
      const account = accountResponse.value as Record<string, unknown>
      form.value.clientCountryId = String(account.countryId || form.value.clientCountryId || '')
      selectedClientName.value = String(account.displayName || selectedClientName.value || '')
      institutionalExecutive.value = institutionalExecutive.value || account.isCastroFallasExecutive === true
      executiveUserId.value = String(account.executiveUserId || executiveUserId.value || '')
      executiveName.value = String(account.executiveName || executiveName.value || '').trim()
    }
    if (institutionalExecutive.value && !executiveName.value) executiveName.value = 'Castro Fallas'
    if (executiveUserId.value && !executiveName.value) {
      try {
        const labels = await crmRequest<{ owners?: Record<string, string> }>(
          crmPath('calendar/labels') + '?' +
          new URLSearchParams({ ownerIds: executiveUserId.value }))
        if (generation !== clientGeneration || accountId.value !== id) return
        executiveName.value = labels.owners?.[executiveUserId.value]?.trim() || ''
      } catch { /* The CRM executive ID remains assigned if labels are unavailable. */ }
    }
    if (contactsResponse.status === 'fulfilled') {
      const raw = contactsResponse.value
      const directory = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as { divisions?: Array<{ id: string; name: string }>; contacts?: unknown[] } : null
      crmDivisions.value = Array.isArray(directory?.divisions) ? directory.divisions : []
      if (form.value.crmDivisionId) form.value.crmDivisionName =
        crmDivisions.value.find(d => d.id === form.value.crmDivisionId)?.name || form.value.crmDivisionName
      const entries = Array.isArray(directory?.contacts) ? directory.contacts : Array.isArray(raw) ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as {items?: unknown}).items)
          ? (raw as {items: unknown[]}).items : []
      operationalContacts.value = entries.flatMap((entry: unknown) => {
        if (!entry || typeof entry !== 'object') return []
        const relation = entry as Record<string, unknown>
        const contact = (relation.contact && typeof relation.contact === 'object'
          ? relation.contact : relation) as Record<string, unknown>
        const active = relation.isActive !== false && contact.isActive !== false &&
          !['INACTIVE','DISABLED'].includes(String(contact.status ?? '').toUpperCase())
        const operations = relation.isOperationsContact === true || contact.isOperationsContact === true
        const email = String(contact.email || '').trim()
        const name = String(contact.name || [contact.firstName,contact.lastName].filter(Boolean).join(' ') || '').trim()
        const contactId = String(contact.id || relation.contactId || '')
        return active && operations && contactId && name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? [{ id: contactId, name, email, divisionIds: Array.isArray(relation.divisionIds) ? relation.divisionIds.map(String) : [] }] : []
      })
      if (!contactsTouched.value && !form.value.contactIds.length) {
        form.value.contactIds = defaultDivisionContacts(operationalContacts.value, form.value.crmDivisionId, crmDivisions.value.length > 0).map(contact => contact.id)
        form.value.contactReferences = form.value.contactIds.join(',')
      }
    } else {
      operationalContactsIssue.value = 'No se pudieron consultar los contactos de CRM; puede conservar el borrador.'
    }
  } finally {
    if (generation === clientGeneration) {
      executiveLoading.value = false
      operationalContactsLoading.value = false
    }
  }
}

function onCrmClientSelected(client: {
  countryId?: string | null;
  id: string; kind?: 'account' | 'lead'; displayName: string;
  executiveName: string; executiveUserId?: string; isCastroFallasExecutive?: boolean
} | null) {
  if (client?.kind === 'lead') {
    crmDivisions.value = []
    form.value.crmDivisionId = ''
    form.value.crmDivisionName = ''
    form.value.clientCountryId = ''
    form.value.clientCountryOverrideId = ''
    form.value.operationOverride = ''
    ++clientGeneration
    accountId.value = ''
    lastSelectedAccountId = ''
    selectedClientName.value = ''
    executiveName.value = ''
    executiveUserId.value = ''
    institutionalExecutive.value = false
    operationalContacts.value = []
    executiveLoading.value = false
    operationalContactsLoading.value = false
    operationalContactsIssue.value = ''
    error.value = 'Para aperturar el trámite, convierta primero el prospecto en una cuenta CRM.'
    return
  }
  if (!client) {
    crmDivisions.value = []
    form.value.crmDivisionId = ''
    form.value.crmDivisionName = ''
    form.value.clientCountryId = ''
    form.value.clientCountryOverrideId = ''
    form.value.operationOverride = ''
    ++clientGeneration
    lastSelectedAccountId = ''
    selectedClientName.value = ''
    executiveName.value = ''
    executiveUserId.value = ''
    institutionalExecutive.value = false
    operationalContacts.value = []
    executiveLoading.value = false
    operationalContactsLoading.value = false
    operationalContactsIssue.value = ''
    form.value.contactIds = []
    contactsTouched.value = false
    return
  }
  if (lastSelectedAccountId !== client.id) {
    crmDivisions.value = []
    form.value.crmDivisionId = ''
    form.value.crmDivisionName = ''
    form.value.clientCountryOverrideId = ''
    form.value.operationOverride = ''
    form.value.clientCountryId = client.countryId || ''
    form.value.contactIds = []
    form.value.contactReferences = ''
    contactsTouched.value = false
  }
  lastSelectedAccountId = client.id
  error.value = ''
  selectedClientName.value = client.displayName
  void resolveCrmOpeningData(client.id, client)
}
function countryFromRoute(group: 'pol' | 'poe' | 'pod', id: string, location: string): string {
  const item = currentCatalog(group).find(x => x.id === id && x.isActive)
    || currentCatalog(group).find(x => optionText(x).toLowerCase() === location.toLowerCase() && x.isActive)
  return resolveLocationCountryCode(item, currentCatalog('countries'))
}
watch(() => [selectedPol.value, form.value.pol, selectedPoe.value, form.value.poe, selectedPod.value, form.value.pod, showPod.value], () => {
  if (restoringOpening) return
  form.value.originCountryCode = countryFromRoute('pol', selectedPol.value, form.value.pol)
  form.value.destinationCountryCode = showPod.value && selectedPod.value
    ? countryFromRoute('pod', selectedPod.value, form.value.pod)
    : countryFromRoute('poe', selectedPoe.value, form.value.poe)
})
watch([selectedPol, selectedPoe, selectedPod], () => { if (!restoringOpening && !applyingQuote && autosaveReady.value && !editingId.value) form.value.operationOverride = '' })
async function searchCabys() {
  const query = form.value.cabysSearch.trim()
  if (query.length < 3) { error.value = 'Escriba al menos 3 caracteres para buscar CABYS.'; return }
  searchingCabys.value = true
  error.value = ''
  try {
    const payload = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/cabys?q=' + encodeURIComponent(query) + '&top=20',
      headers: { Accept: 'application/json' },
    })
    const root = payload as Record<string, unknown> | null
    const entries = Array.isArray(payload) ? payload : Array.isArray(root?.cabys) ? root.cabys
      : Array.isArray(root?.data) ? root.data : Array.isArray(root?.results) ? root.results
      : root && (root.codigo || root.code) ? [root] : []
    cabysResults.value = entries.map((row: unknown) => {
      const item = row as Record<string, unknown>
      return { code: String(item.codigo ?? item.code ?? item.cabys ?? ''),
        description: String(item.descripcion ?? item.description ?? item.detalle ?? '') }
    }).filter((item: {code:string;description:string}) => Boolean(item.code && item.description))
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo consultar CABYS de Hacienda.'
  } finally { searchingCabys.value = false }
}
function chooseCabys(item: {code:string;description:string}) {
  form.value.cabysCode = item.code
  form.value.cargoDescription = item.description
  cabysResults.value = []
}
async function uploadDocument(category: string, categoryLabel: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || uploadingSupport.value) return
  uploadingSupport.value = category
  error.value = ''
  try {
    if (!form.value.supportEntityId) form.value.supportEntityId = crypto.randomUUID()
    const uploaded = await StorageService.uploadFile({
      file, sourceService: 'DholeWeb', entityType: 'OperationsOpeningSupport',
      entityId: form.value.supportEntityId,
      metadataJson: JSON.stringify({ category, categoryLabel, caseId: editingId.value || null }),
    })
    form.value.supportDocuments.push({
      id: uploaded.id, fileName: uploaded.originalFileName,
      sizeInBytes: uploaded.sizeInBytes, category, categoryLabel,
    })
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo subir el documento.' }
  finally { uploadingSupport.value = '' }
}
async function removeDocument(id: string) {
  try {
    await StorageService.deleteFile(id)
    form.value.supportDocuments = form.value.supportDocuments.filter(x => x.id !== id)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No se pudo eliminar el documento.' }
}
function toggleHandling(value: 'Redestino' | 'Anticipado') {
  form.value.portHandlingMode = form.value.portHandlingMode === value ? '' : value
}

async function loadContext() {
  try {
    companyId.value = (await operationsApi.createContext()).companyId || ''
    if (!companyId.value) error.value = 'El servicio no pudo resolver la empresa operativa. Configure Operations antes de crear el expediente.'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'No fue posible resolver el contexto.' }
  finally { loading.value = false }
}
async function initializeWorkspace() {
  if (!canInitialize.value || initializing.value) return
  initializing.value = true
  error.value = ''
  try {
    await operationsApi.initializeTeams()
    companyId.value = (await operationsApi.createContext()).companyId || ''
    if (!companyId.value)
      error.value = 'El catálogo se inicializó, pero no se identificó la empresa operativa.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo inicializar Operaciones.'
  } finally { initializing.value = false }
}
// PostgreSQL is authoritative for unsubmitted manual openings. localStorage is
// retained only as an offline fallback, scoped to this user and company.
const draftStorageKey = computed(() =>
  'dhole.operations.manual-opening.v2:' + (auth.userId || 'guest') + ':' +
  (auth.clientId || 'company') + ':' + (editingId.value || 'new'))
let remoteDraftVersion = 0
let draftWriteQueue: Promise<void> = Promise.resolve()
function draftSnapshot(): Record<string, unknown> {
  const { weightValue: _manualWeight, weightUnit: _manualWeightUnit, pickupContact: _pickupContact, pickupWindow: _pickupWindow, ...draftForm } = form.value
  return {
    savedAt: Date.now(), version: 2, form: { ...draftForm, pickupLocations: operationalPoints(draftForm.pickupLocations), deliveryLocations: operationalPoints(draftForm.deliveryLocations) },
    routeIds: { pol: selectedPol.value, poe: selectedPoe.value, pod: selectedPod.value },
    accountId: accountId.value, selectedClientName: selectedClientName.value,
    modality: modality.value, step: activeStep.value,
    executiveName: executiveName.value, executiveUserId: executiveUserId.value,
    institutionalExecutive: institutionalExecutive.value,
    contactsTouched: contactsTouched.value, assignmentPendingId: assignmentPendingId.value,
    quoteRateId: quoteRateId.value, quoteLabel: quoteLabel.value, quoteHydrated: quoteHydrated.value,
  }
}
function persistLocalDraft(draft = draftSnapshot()) {
  if (!autosaveReady.value || editingId.value) return
  try { window.localStorage.setItem(draftStorageKey.value, JSON.stringify(draft)) }
  catch { /* An unavailable browser store must not prevent PostgreSQL autosave. */ }
}
function persistDraft() {
  if (!autosaveReady.value || editingId.value) return
  const draft = draftSnapshot()
  persistLocalDraft(draft)
  autosaveState.value = 'pending'
  // Serialize writes so ExpectedVersion always matches the previously
  // confirmed server version. A 409 is not blindly overwritten.
  draftWriteQueue = draftWriteQueue.catch(() => {}).then(async () => {
    if (!autosaveReady.value || editingId.value) return
    const saved = await operationsApi.saveManualOpeningDraft(remoteDraftVersion, draft)
    remoteDraftVersion = saved.version
    autosaveState.value = 'saved'
    lastAutoSaveAt.value = new Date(saved.updatedAtUtc).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    })
  }).catch(() => {
    // Preserve the fallback for a later retry or reconciliation after reconnect.
    autosaveState.value = 'error'
  })
}
function scheduleLocalDraft() {
  if (!autosaveReady.value || editingId.value) return
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveState.value = 'pending'
  autosaveTimer = setTimeout(persistDraft, 650)
}
function restoreLocalDraft(serverDraft?: Record<string, unknown>) {
  if (editingId.value) return
  try {
    const raw = serverDraft ? null : window.localStorage.getItem(draftStorageKey.value)
    if (!serverDraft && !raw) return
    const draft = serverDraft || JSON.parse(raw!) as Record<string, unknown>
    if (draft.version !== 2 || !Number.isFinite(Number(draft.savedAt)) ||
        (!serverDraft && Date.now() - Number(draft.savedAt) > 7 * 24 * 60 * 60 * 1000)) {
      if (!serverDraft) window.localStorage.removeItem(draftStorageKey.value)
      return
    }
    if (draft.form && typeof draft.form === 'object' && !Array.isArray(draft.form)) {
      form.value = { ...form.value, ...draft.form } as typeof form.value
      restoreDimensionValues()
      // Manual openings do not capture actual weight (Coordinación Origen owns it).
      form.value.weightValue = ''
      form.value.weightUnit = 'KG'
      if (!Array.isArray(form.value.services)) form.value.services = []
      if (!Array.isArray(form.value.contactIds)) form.value.contactIds = []
      if (!Array.isArray(form.value.equipment)) form.value.equipment = []
      if (!Array.isArray(form.value.supportDocuments)) form.value.supportDocuments = []
      if (!needsEquipment.value && form.value.shipmentType) form.value.equipment = []
      if (!isMaritime.value) { form.value.portHandlingMode = ''; form.value.pod = '' }
      if (!Array.isArray(form.value.pickupLocations)) form.value.pickupLocations = []
      if (!Array.isArray(form.value.deliveryLocations)) form.value.deliveryLocations = []
    }
    accountId.value = String(draft.accountId || '')
    lastSelectedAccountId = accountId.value
    selectedClientName.value = String(draft.selectedClientName || '')
    modality.value = String(draft.modality || '')
    if (canSelectQuote.value) {
      quoteRateId.value = typeof draft.quoteRateId === 'string' ? draft.quoteRateId : ''
      quoteLabel.value = typeof draft.quoteLabel === 'string' ? draft.quoteLabel : ''
      quoteHydrated.value = draft.quoteHydrated === true
    }
    executiveName.value = String(draft.executiveName || '')
    executiveUserId.value = String(draft.executiveUserId || '')
    institutionalExecutive.value = draft.institutionalExecutive === true
    contactsTouched.value = draft.contactsTouched === true
    assignmentPendingId.value = String(draft.assignmentPendingId || '')
    const step = Number(draft.step)
    activeStep.value = step >= 1 && step <= wizardSteps.length ? step : 1
    reconcileLocations()
    const routeIds = draft.routeIds
    if (routeIds && typeof routeIds === 'object' && !Array.isArray(routeIds)) {
      const ids = routeIds as Record<string, unknown>
      for (const [group, target] of [['pol', selectedPol], ['poe', selectedPoe], ['pod', selectedPod]] as const) {
        const id = ids[group]
        if (typeof id === 'string' && currentCatalog(group).some(item => item.id === id && item.isActive && optionText(item) === form.value[group]))
          target.value = id
      }
    }
    lastAutoSaveAt.value = new Date(Number(draft.savedAt)).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    })
    if (accountId.value && !assignmentPendingId.value) {
      void resolveCrmOpeningData(accountId.value, {
        executiveName: executiveName.value, executiveUserId: executiveUserId.value,
        isCastroFallasExecutive: institutionalExecutive.value,
      })
    }
  } catch { autosaveState.value = 'error' }
}
async function restoreDraft() {
  let server: { version: number; updatedAtUtc: string; draft: Record<string, unknown> } | null = null
  try {
    const response = await operationsApi.getManualOpeningDraft()
    if ('draft' in response && response.draft) {
      const snapshot = response as {
        version: number; updatedAtUtc: string; draft: Record<string, unknown>
      }
      server = { version: snapshot.version, updatedAtUtc: snapshot.updatedAtUtc,
        draft: snapshot.draft }
      remoteDraftVersion = snapshot.version
    }
  } catch {
    autosaveState.value = 'error'
  }
  let localSavedAt = 0
  try {
    const local = JSON.parse(window.localStorage.getItem(draftStorageKey.value) || 'null') as
      Record<string, unknown> | null
    localSavedAt = Number(local?.savedAt) || 0
  } catch { /* Invalid or restricted local backup. */ }
  const serverSavedAt = server ? new Date(server.updatedAtUtc).getTime() : 0
  if (server && serverSavedAt >= localSavedAt) restoreLocalDraft(server.draft)
  else restoreLocalDraft()
}
async function clearLocalDraft() {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveReady.value = false
  try { window.localStorage.removeItem(draftStorageKey.value) }
  catch { /* storage restricted */ }
  await draftWriteQueue
  try { await operationsApi.clearManualOpeningDraft() }
  catch { /* Successful IDTRA creation is never reverted by failed cleanup. */ }
}
watch([form, accountId, selectedClientName, modality, activeStep, contactsTouched, assignmentPendingId, quoteRateId, quoteLabel, quoteHydrated],
  scheduleLocalDraft, { deep: true })
onBeforeUnmount(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  if (autosaveReady.value && !editingId.value) {
    persistLocalDraft()
    persistDraft()
  }
})

function buildOpeningData() {
  return {
      ...form.value,
      ...(!editingId.value ? { etm: undefined, eta: undefined, clientPoReference: undefined, invoiceReference: undefined } : {}),
      incotermName: selectedIncoterm.value,
      // Origin-owned measurements are preserved by the server; never write them from Aperturas.
      weightValue: undefined, weightUnit: undefined, weightKg: undefined,
      actualWeightValue: undefined, actualWeightUnit: undefined, actualWeightKg: undefined, equipmentUnits: undefined,
      ...(!editingId.value ? { pickupContact: undefined, pickupWindow: undefined } : {}),
      estimatedWeightKg: estimatedKg.value,
      stackable: stackableApplicable.value ? form.value.stackable : null,
      isImo: form.value.isImo,
      overweight: form.value.overweight,
      consolidationId: effectiveShipment.value === 'LCL' ? form.value.consolidationId || null : null,
      consolidationNumber: effectiveShipment.value === 'LCL' ? form.value.consolidationNumber : null,
      consolidationReference: ['LCL', 'LTL'].includes(effectiveShipment.value) ? String(selectedConsolidation.value?.name ?? form.value.consolidationReference ?? '').trim() : '',
      // Existing Pricing openings can carry zero as an unknown volume, not a measured zero.
      volumeValue: editingId.value && Number(form.value.volumeValue) === 0 ? null : form.value.volumeValue,
      volumeCbm: normalizedVolume.value,
      requiresPickup: pickupRequired.value,
      pickupAddress: pickupRequired.value ? (form.value.pickupLocations[0]?.address || form.value.pickupAddress) : '',
      pickupLocations: pickupRequired.value ? operationalPoints(form.value.pickupLocations) : [],
      requiresDelivery: deliveryRequired.value,
      destinationAddress: deliveryRequired.value ? (form.value.deliveryLocations[0]?.address || form.value.destinationAddress) : '',
      deliveryLocations: deliveryRequired.value ? operationalPoints(form.value.deliveryLocations) : [],
      ...(!editingId.value ? { operationDirection: operation.value === 'Import' ? 'IMPORT' : operation.value === 'Export' ? 'EXPORT' : 'OTHER', operationType: operation.value, clientCountryCode: clientCountry.value, pod: showPod.value ? form.value.pod : '', warehouseId: requiresWarehouse.value ? selectedWarehouse.value : '', warehouseCatalogGroup: requiresWarehouse.value ? warehouseCatalogGroup.value : '', warehouseCatalogCode: requiresWarehouse.value ? catalogCode('warehouses', selectedWarehouse.value) : '', whsName: requiresWarehouse.value ? (warehouse.value ? optionText(warehouse.value) : form.value.warehouseAddress) : '', warehouseAddress: requiresWarehouse.value ? warehouseAddress.value : '' } : {}),
      ...(!editingId.value && !showCarrier.value ? { carrierId: '', carrierReference: '' } : {}),
      portHandlingMode: isMaritime.value ? form.value.portHandlingMode : '',
      ...Object.fromEntries((['length', 'width', 'height'] as const).flatMap(axis => [
        [`${axis}Value`, effectiveShipment.value === 'AIR' ? form.value[`${axis}Value`] : ''],
        [`${axis}Unit`, form.value[`${axis}Unit`]],
        [`${axis}Cm`, effectiveShipment.value === 'AIR' ? form.value[`${axis}Cm`] : ''],
      ])),
      ...(!editingId.value ? { openingValidationVersion: 8, serviceSelections: currentCatalog('pricing-services').filter(item => form.value.services.includes(item.id)).map(item => ({ id: item.id, code: item.code, label: optionText(item) })), providerSelections: ([['carriers', 'carrierReference', showCarrier.value ? form.value.carrierId : ''], ['agents', 'agentReference', form.value.agentId]] as const).flatMap(([group, field, id]) => { const item = currentCatalog(group).find(row => row.id === id && row.isActive); return item ? [{ group, field, id, code: item.code, label: optionText(item) }] : [] }), polCatalogId: selectedPol.value, poeCatalogId: selectedPoe.value, podCatalogId: showPod.value ? selectedPod.value : '', polCatalogCode: catalogCode('pol', selectedPol.value), poeCatalogCode: catalogCode('poe', selectedPoe.value), podCatalogCode: showPod.value ? catalogCode('pod', selectedPod.value) : '', polTerminalType: selectedRouteType('pol', selectedPol.value), poeTerminalType: selectedRouteType('poe', selectedPoe.value), podTerminalType: showPod.value ? selectedRouteType('pod', selectedPod.value) : undefined } : {}),
      equipment: form.value.equipment.map(item => ({
        equipmentType: item.equipmentType,
        equipmentCatalogId: resolvedEquipmentId(item) || undefined,
        ...(!editingId.value ? { equipmentCatalogCode: catalogCode(equipmentCatalogKey.value, resolvedEquipmentId(item)) } : {}),
        quantity: Number(item.quantity),
        ...(editingId.value && item.weightKg != null ? { weightKg: item.weightKg } : {}),
      })).filter(() => needsEquipment.value || Boolean(editingId.value)),
      completionStatus: blockers.value.length ? 'DRAFT_INCOMPLETE' : 'READY_FOR_ORIGIN',
      missingFields: blockers.value,
      ...(!editingId.value ? { commercialStatus: 'SIN_QUO' } : {}),
  }
}

const completeness = ref<OpeningCompleteness | null>(null)
const completenessError = ref('')
const completenessLoading = ref(false)
const retryCompleteness = ref(0)
let completenessSequence = 0
let completenessTimer: ReturnType<typeof setTimeout> | undefined
const previewPayload = computed(() => ({ modality: modality.value, accountId: accountId.value, openingData: buildOpeningData() }))
watch([previewPayload, activeStep, editingId, canEdit, retryCompleteness], () => {
  const sequence = ++completenessSequence
  if (completenessTimer) clearTimeout(completenessTimer)
  completeness.value = null
  completenessError.value = ''
  completenessLoading.value = false
  if (activeStep.value !== 3 || (editingId.value && !canEdit.value)) return
  completenessLoading.value = true
  const payload = previewPayload.value
  const account = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.accountId)
    ? payload.accountId : '00000000-0000-0000-0000-000000000000'
  completenessTimer = setTimeout(async () => {
    try {
      const result = await operationsApi.previewOpeningCompleteness(payload.modality, account, payload.openingData, editingId.value || undefined)
      if (sequence === completenessSequence) completeness.value = result
    } catch {
      if (sequence === completenessSequence) completenessError.value = 'No se pudo consultar la validación de Operations. Revisa la información y reintenta.'
    } finally {
      if (sequence === completenessSequence) completenessLoading.value = false
    }
  }, 250)
}, { deep: true, immediate: true })
onBeforeUnmount(() => {
  ++completenessSequence
  if (completenessTimer) clearTimeout(completenessTimer)
})
const serverBlockers = computed(() => completeness.value?.missingFields.length ?? 0)
const statusGroups = computed(() => (['PENDIENTE_BLOQUEANTE', 'PENDIENTE_PERMITIDO', 'CONFIRMADO', 'NO_APLICA'] as const).map(status => ({ status, fields: completeness.value?.fields.filter(field => field.completionStatus === status) || [] })))
const selectedStatusGroup = ref('PENDIENTE_PERMITIDO')
watch(serverBlockers, count => { if (count > 0) selectedStatusGroup.value = 'PENDIENTE_BLOQUEANTE' })
const reviewValidationPending = computed(() => activeStep.value === 3 && !completeness.value?.canPassFieldValidation)
const manualReviewBlockers = computed(() => [...new Set([
  ...blockers.value,
  ...(completeness.value?.missingFields ?? []).map(openingFieldLabel),
])])
const manualReviewReady = computed(() => valid.value && !manualReviewBlockers.value.length &&
  !completenessLoading.value && !completenessError.value && completeness.value?.canPassFieldValidation === true)
const manualReviewSections = computed(() => [
  { title: 'Cliente y comercial', icon: UserRound, step: 1, rows: [
    { label: 'Cliente', value: selectedClientName.value || 'Por seleccionar' },
    { label: 'Vendedor', value: accountId.value ? executiveLabel.value : 'Por seleccionar' },
    { label: 'División', value: form.value.crmDivisionName || 'Sin división' },
    { label: 'Contacto operativo', value: selectedOperationalContacts.value.map(contact => contact.name).join(' · ') || 'Sin contacto seleccionado' },
    { label: 'QUO', value: quoteRateId.value ? (quoteLabel.value || 'Vínculo seleccionado') + ' · Se verificará en Pricing' : 'Sin QUO vinculada' },
  ] },
  { title: 'Transporte y ruta', icon: Route, step: 1, rows: [
    { label: 'Transporte', value: transportSelectionOptions.find(x => x.value === form.value.transportType)?.label || 'Por seleccionar' },
    { label: 'Tipo de embarque', value: shipmentOptions.value.find(x => x.value === effectiveShipment.value)?.label || 'Por seleccionar' },
    { label: 'Sentido de operación', value: operationLabel.value || 'Por seleccionar' },
    { label: 'Incoterm', value: selectedIncoterm.value || 'Por seleccionar' },
    ...(pickupRequired.value ? [{ label: 'Recolecta', value: form.value.pickupLocations.map(point => point.address).filter(Boolean).join(' · ') || form.value.pickupAddress || 'Por confirmar' }] : []),
    { label: 'POL · Origen', value: form.value.pol || 'Por seleccionar' },
    { label: 'POE · Entrada', value: form.value.poe || 'Por seleccionar' },
    ...(showPod.value ? [{ label: 'POD · Destino final', value: form.value.pod || 'Por seleccionar' }] : []),
    ...(requiresWarehouse.value ? [{ label: 'WHS', value: [warehouse.value ? optionText(warehouse.value) : '', warehouseOwnerLabel.value, warehouseAddress.value].filter(Boolean).join(' · ') || 'Por seleccionar' }] : []),
  ] },
  { title: 'Mercancía y equipos', icon: Package, step: 2, rows: [
    { label: 'IMO', value: conditionLabel(form.value.isImo) },
    ...(stackableApplicable.value ? [{ label: 'Estibable', value: conditionLabel(form.value.stackable) }] : []),
    { label: 'Sobrepeso', value: conditionLabel(form.value.overweight) },
    ...(['LCL','LTL'].includes(effectiveShipment.value) ? [{ label: 'Nombre del consolidado', value: selectedConsolidation.value?.name || form.value.consolidationReference || 'Por confirmar' }] : []),
    { label: 'Cantidad de bultos', value: form.value.packageCount || 'Por completar' },
    { label: 'Peso estimado', value: positive(form.value.estimatedWeightValue) ? form.value.estimatedWeightValue + ' ' + form.value.estimatedWeightUnit : 'Por completar' },
    { label: 'Volumen', value: positive(form.value.volumeValue) ? form.value.volumeValue + ' ' + form.value.volumeUnit : 'Por completar' },
    ...(needsEquipment.value ? [{ label: effectiveShipment.value === 'FTL' ? 'Furgones: cantidad y tipo' : 'Contenedores: cantidad y tipo', value: form.value.equipment.filter(x => x.equipmentType).map(x => x.quantity + ' × ' + x.equipmentType).join(' · ') || 'Por seleccionar' }] : []),
  ] },
  { title: 'Servicios y proveedores', icon: Truck, step: 2, rows: [
    { label: 'Servicios', value: selectedServiceLabels.value.join(' · ') || 'Por seleccionar' },
    ...(showCarrier.value ? [{ label: 'Naviera', value: form.value.carrierReference || 'Por seleccionar' }] : []),
    { label: 'Agente', value: form.value.agentReference || 'Sin agente seleccionado' },
  ] },
])

async function save() {
  if (saving.value || quoteBusy.value || (quoteRateId.value && !quoteHydrated.value && !assignmentPendingId.value) || (editingId.value ? !canEdit.value : !auth.hasScope('operations.case.create'))) return
  if ((!valid.value || blockers.value.length > 0 || serverBlockers.value > 0 || reviewValidationPending.value) && !assignmentPendingId.value && !editingId.value) {
    error.value = 'Completa los campos indispensables antes de crear y asignar el trámite. Los avances se guardan automáticamente en PostgreSQL (con copia local de respaldo).'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const openingData = buildOpeningData()
    const result = editingId.value
      ? await operationsApi.updateCase(editingId.value, {
          expectedVersion: existingVersion.value,
          modalityCode: modality.value, priority: Number(priority.value),
          complexityPoints: Number(complexity.value),
          originCountryCode: form.value.originCountryCode.toUpperCase() || null,
          destinationCountryCode: form.value.destinationCountryCode.toUpperCase() || null,
          openingData,
        }).then(() => ({ id: editingId.value }))
      : assignmentPendingId.value
        ? { id: assignmentPendingId.value }
        : await operationsApi.createAperture({
          companyId: companyId.value,
          accountId: accountId.value,
          modalityCode: modality.value,
          priority: Number(priority.value),
          complexityPoints: Number(complexity.value),
          originCountryCode: routingCountries.value.origin || null,
          destinationCountryCode: routingCountries.value.destination || null,
          openingData,
          ...(quoteRateId.value && canSelectQuote.value ? { quoteRateId: quoteRateId.value } : {}),
        })
    // Operations atomically creates the Origin stage. The worker handles assignment retries.
    // Do not open a case that is now owned by another department.
    if (!editingId.value) {
      assignmentPendingId.value = result.id
      persistLocalDraft()
    }
    await clearLocalDraft()
    if (editingId.value) await router.push({ name: 'operations-case-detail', params: { id: result.id } })
    else await router.push({ name: 'operations-cases', query: { manualSubmitted: '1' } })
  } catch (cause) {
    error.value = assignmentPendingId.value
      ? 'El IDTRA existente no se duplicará. Consulta su estado con el supervisor de Coordinación Origen. Detalle: ' + (cause instanceof Error ? cause.message : 'Error desconocido')
      : cause instanceof Error ? cause.message : 'No se pudo crear la apertura.'
  } finally { saving.value = false }
}
watch(selectedPol, id => { const label = lookupLabel('pol', id); if (label) form.value.pol = label })
watch(selectedPoe, id => { const label = lookupLabel('poe', id); if (label) form.value.poe = label })
watch(selectedPod, id => { const label = lookupLabel('pod', id); if (label) form.value.pod = label })
watch(selectedWarehouse, id => { const label = lookupLabel('warehouses', id); if (label) { form.value.whsName = label; form.value.warehouseId = id; form.value.warehouseAddress = String(catalogMetadata(warehouse.value).address || catalogMetadata(warehouse.value).fullAddress || '') } })
onMounted(async () => {
  await Promise.all([loadContext(), loadPricingCatalogs()])
  if (!editingId.value) {
    await restoreDraft()
    autosaveReady.value = true
    if (quoteRateId.value && !quoteHydrated.value && !assignmentPendingId.value) await selectQuote(quoteRateId.value)
  }
  if (editingId.value) {
    try {
      const [detail, tabs] = await Promise.all([
        operationsApi.caseDetail(editingId.value), operationsApi.caseTabs(editingId.value),
      ])
      canEdit.value = tabs.tabs.some(x => x.code === 'RESUMEN' && x.accessLevel === 'EDITABLE')
      if (!canEdit.value) { error.value = 'No tiene permisos para modificar esta apertura.'; return }
      restoringOpening = true
      existingVersion.value = detail.version
      accountId.value = detail.accountId
      lastSelectedAccountId = detail.accountId
      companyId.value = detail.companyId
      modality.value = detail.modalityCode
      priority.value = detail.priority
      complexity.value = detail.complexityPoints
      const parsed = JSON.parse(detail.openingDataJson || '{}') as Record<string, unknown>
      selectedClientName.value = String(parsed.clientName || '')
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        form.value = { ...form.value, ...parsed } as typeof form.value
        restoreDimensionValues()
        if (!positive(form.value.estimatedWeightValue) && positive(parsed.quotedWeightKg)) {
          form.value.estimatedWeightValue = String(parsed.quotedWeightKg)
          form.value.estimatedWeightUnit = 'KG'
        }
        const term = normalizeIncotermCode(form.value.incoterm, form.value.incotermName)
        if (incoterms.includes(term)) { form.value.incoterm = term; form.value.incotermName = term }
        if (typeof parsed.requiresPickup !== 'boolean' && typeof parsed.pickupAddress === 'string' && parsed.pickupAddress.trim())
          form.value.requiresPickup = true
        if (!Array.isArray(form.value.services)) form.value.services = []
        if (!Array.isArray(form.value.contactIds)) form.value.contactIds = []
        if (!Array.isArray(form.value.pickupLocations)) form.value.pickupLocations = []
        if (!Array.isArray(form.value.deliveryLocations)) form.value.deliveryLocations = []
      }
      if (detail.modalityCode === 'LCL' && !form.value.consolidationId && !form.value.consolidationNumber && !form.value.consolidationReference && detail.sourceQuoteOptionId) {
        try {
          const quote = await operationsQuoteApi.detail(detail.sourceQuoteOptionId)
          form.value.consolidationId = quote.consolidationId || ''
          form.value.consolidationNumber = quote.consolidationNumber ?? null
          form.value.consolidationReference = quote.consolidationReference || ''
        } catch { /* Existing opening remains editable. */ }
      }
      if (!form.value.transportType) {
        form.value.transportType = modality.value === 'AIR' ? 'AIR'
          : ['FTL','LTL'].includes(modality.value) ? 'ROAD'
            : modality.value === 'MULTIMODAL' ? 'MULTIMODAL' : 'MARITIME'
      }
      if (!form.value.shipmentType && modality.value !== 'MULTIMODAL') form.value.shipmentType = modality.value
      form.value.originCountryCode = detail.originCountryCode || ''
      form.value.destinationCountryCode = detail.destinationCountryCode || ''
      reconcileLocations()
      contactsTouched.value = true
      await resolveCrmOpeningData(detail.accountId, { executiveUserId: detail.executiveUserId })
      await nextTick()
      restoringOpening = false
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'No fue posible abrir la captura.'
    } finally { restoringOpening = false }
  }
})
</script>

<template>
  <div id="operations-opening-wizard" class="mx-auto w-full max-w-[1440px] space-y-5 px-3 pb-32 pt-4 sm:px-6 sm:pt-6 lg:px-8 scroll-mt-36">
    <RouterLink to="/operations/cases" class="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--dh-primary)]">
      <ArrowLeft class="h-4 w-4" /> Trámites
    </RouterLink>
    <DhPageHeader
      :title="editingId ? 'Modificar apertura' : 'Nueva apertura manual'"
      subtitle="Registra los datos básicos y confirma el envío a Coordinación Origen."
      :icon="FolderPlus"
      :hide-excel-export="true"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-3">
          <span v-if="!editingId" role="status" aria-live="polite" class="text-xs font-semibold"
            :class="autosaveState === 'error' ? 'text-amber-500' : 'text-[var(--dh-text-muted)]'">
            {{ autosaveState === 'error' ? 'Autoguardado no disponible' : autosaveState === 'pending' ? 'Guardando cambios…' : lastAutoSaveAt ? 'Guardado automáticamente · ' + lastAutoSaveAt : 'Autoguardado activado' }}
          </span>
          <DhButton v-if="editingId" :icon="Save"
            :label="editingId ? 'Guardar modificaciones' : assignmentPendingId ? 'Confirmar trámite existente' : 'Crear y enviar a Coordinación Origen'"
            :loading="saving" :disabled="loading || saving || (!valid && !assignmentPendingId) || (!editingId && (blockers.length > 0 || serverBlockers > 0 || reviewValidationPending) && !assignmentPendingId)"
            @click="save" />
        </div>
      </template>
    </DhPageHeader>

    <div class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)] sm:p-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-4">
          <div class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
            <FolderPlus class="h-7 w-7" />
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">OPERATIONS · APERTURAS</p>
            <h2 class="text-xl font-black tracking-tight text-[var(--dh-text)] sm:text-2xl">{{ editingId ? 'Actualizar expediente' : 'Crear expediente operativo' }}</h2>
            <p class="mt-1 text-xs font-medium text-[var(--dh-text-muted)]">Completa una etapa a la vez. Los cambios se guardan automáticamente; el IDTRA se crea al confirmar.</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <DhBadge variant="neutral">IDTRA automático</DhBadge>
          <DhBadge variant="primary">{{ editingId ? 'Modificación' : 'Apertura manual' }}</DhBadge>
          <DhBadge variant="neutral">Paso {{ activeStep }} de {{ wizardSteps.length }}</DhBadge>
        </div>
      </div>
      <div class="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--dh-input)]">
        <div class="h-full rounded-full bg-[var(--dh-primary)] transition-all duration-300" :style="{ width: (activeStep / wizardSteps.length * 100) + '%' }" />
      </div>
    </div>

    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-500">{{ error }}</div>
    <div v-if="assignmentPendingId" role="status" class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-500">
      El IDTRA ya existe. Confirma para continuar sin generar otro expediente. Operations recuperará las asignaciones pendientes.
    </div>
    <div v-if="catalogIssue" role="status" class="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs font-semibold text-amber-500">{{ catalogIssue }}</div>
    <DhCard v-if="!companyId && canInitialize && !editingId" title="Inicialización de Operaciones" subtitle="Acción administrativa, necesaria solo cuando la empresa operativa no se ha identificado.">
      <DhButton variant="secondary" label="Inicializar equipos" :loading="initializing" @click="initializeWorkspace" />
    </DhCard>

    <PricingWizardStepper
      :steps="wizardSteps"
      :active-step="activeStep"
      aria-label="Etapas de creación de apertura"
      @update:active-step="goToStep"
    />

    <section class="scroll-mt-36 overflow-visible rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]">
      <header class="flex flex-wrap items-center gap-3 rounded-t-[26px] border-b border-[var(--dh-border)] p-5 sm:p-6">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.10)] text-[var(--dh-primary)]">
          <Route v-if="activeStep === 1" class="h-5 w-5" />
          <Package v-else-if="activeStep === 2" class="h-5 w-5" />
          <ClipboardCheck v-else class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-[10px] font-black uppercase tracking-[.16em] text-[var(--dh-primary)]">PASO {{ activeStep }} DE {{ wizardSteps.length }}</p>
          <h3 class="mt-0.5 text-lg font-black tracking-tight">{{ activeStepMeta.label }}</h3>
          <p class="text-xs font-medium text-[var(--dh-text-muted)]">{{ activeStepMeta.hint }}</p>
        </div>
        <DhBadge v-if="activeStep === 3 && editingId" :variant="blockers.length ? 'warning' : 'success'" class="ml-auto">{{ blockers.length ? blockers.length + ' pendientes' : 'Sin pendientes locales' }}</DhBadge>
      </header>

      <div class="p-4 sm:p-6">
        <DhCard v-if="!editingId && activeStep === 1" class="mb-6" title="Cotización (QUO)" padding="sm"
          subtitle="Opcional. Vincula una QUO aceptada para cargar sus datos comerciales y logísticos disponibles.">
          <template #actions><DhBadge :variant="quoteRateId ? 'primary' : 'neutral'">{{ quoteRateId ? 'Seleccionada' : 'Sin QUO' }}</DhBadge></template>
          <p v-if="!canSelectQuote" class="text-sm text-[var(--dh-text-muted)]">Se requieren los permisos operativos de consulta y vinculación de QUO.</p>
          <div v-else class="space-y-3">
            <div v-if="quoteRateId" class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm font-semibold">{{ quoteLabel || 'Cotización seleccionada' }}</p>
              <div class="flex flex-wrap gap-2">
                <DhButton variant="secondary" size="sm" :icon="RefreshCw" label="Cargar datos de QUO" :loading="quoteBusy" :disabled="Boolean(assignmentPendingId)" @click="selectQuote(quoteRateId)" />
                <DhButton variant="secondary" size="sm" label="Quitar QUO" :disabled="Boolean(assignmentPendingId) || quoteBusy" @click="clearQuote" />
              </div>
            </div>
            <template v-else>
              <form class="flex flex-wrap items-end gap-3" @submit.prevent="searchQuotes">
                <div class="min-w-0 flex-1"><DhInput v-model="quoteSearch" label="Número de QUO" placeholder="Ej. QUO-00000-000672" /></div>
                <DhButton type="submit" :icon="Search" label="Buscar QUO" :loading="quoteBusy" :disabled="!quoteSearch.trim() || Boolean(assignmentPendingId)" />
              </form>
              <DhSelect v-if="quoteCandidates.length" searchable label="Cotización aceptada"
                :model-value="quoteRateId" :disabled="quoteBusy" :options="quoteCandidates.map(rate => ({ value: rate.id, label: quoteOptionLabel(rate) }))"
                placeholder="Vincular QUO" @update:model-value="selectQuote(String($event || ''))" />
              <DhButton v-if="quoteCandidates.length === 1 && quoteCandidates[0]" label="Vincular QUO" :loading="quoteBusy" :disabled="Boolean(assignmentPendingId)" @click="selectQuote(quoteCandidates[0].id)" />
            </template>
            <p v-if="quoteBusy" role="status" class="text-sm text-[var(--dh-text-muted)]">Consultando cotización y cargando datos…</p>
            <p v-else-if="quoteRateId && quoteHydrated" role="status" class="text-sm text-[var(--dh-text-muted)]">Datos de QUO cargados. Puedes completar los campos operativos restantes.</p>
            <p v-if="quoteIssue" role="status" class="text-sm text-[var(--dh-text-muted)]">{{ quoteIssue }}</p>
          </div>
        </DhCard>

        <DhCard v-show="activeStep === 1" title="Modalidad y embarque" :icon="Truck" padding="sm">
          <div class="grid gap-4 md:grid-cols-2">
            <DhSelect label="Modalidad de transporte" :model-value="form.transportType"
              :options="transportSelectionOptions" placeholder="Seleccionar modalidad"
              @update:model-value="selectTransport(String($event))" />
            <DhSelect label="Tipo de embarque" :model-value="effectiveShipment"
              :options="shipmentOptions" :disabled="!shipmentOptions.length" placeholder="Seleccionar embarque"
              @update:model-value="selectShipment(String($event))" />
          </div>
          <p v-if="form.transportType === 'MULTIMODAL' && editingId" class="mt-3 text-xs text-[var(--dh-text-muted)]">
            Expediente histórico multimodal. Para nuevas aperturas selecciona marítimo, aéreo o terrestre.
          </p>
        </DhCard>
        <div v-show="activeStep === 1" class="mt-6 space-y-5">
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/60 p-4 sm:p-5">
            <div class="mb-4">
              <h4 class="text-base font-black">Cuenta y responsable comercial</h4>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">El cliente y el ejecutivo se obtienen de CRM; nunca debes introducir un UUID o IDTRA.</p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-3 md:col-span-2">
                <PricingCrmClientSelect v-model="accountId" mode="operations" :initial-name="selectedClientName" :disabled="Boolean(editingId)" :inline-results="true" @selected="onCrmClientSelected" />
                <div role="status" aria-live="polite"
                  class="flex flex-wrap items-center gap-3 rounded-2xl border p-4"
                  :class="executiveAssigned ? 'border-[var(--dh-primary)]/35 bg-[rgb(var(--dh-primary-rgb)/0.09)]' : 'border-amber-500/35 bg-amber-500/5'">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--dh-card)]">
                    <UserRound class="h-5 w-5 text-[var(--dh-primary)]" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-[11px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Ejecutivo comercial responsable (CRM)</span>
                    <span class="mt-1 block text-base font-extrabold">{{ accountId ? executiveLabel : 'Selecciona una cuenta de CRM' }}</span>
                    <span v-if="accountId && !executiveLoading && !executiveAssigned" class="mt-1 block text-xs text-amber-500">
                      Pendiente bloqueante para validar; la asignación debe resolverse en CRM.
                    </span>
                  </span>
                  <CircleCheck v-if="executiveAssigned" class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
                  <CircleAlert v-else-if="accountId && !executiveLoading" class="h-5 w-5 shrink-0 text-amber-500" />
                </div>
              </div>
              <DhSelect v-if="editingId" v-model="form.provenance" label="Asignación recibida desde" :options="originOptions" />
              <p v-if="editingId && form.clientPoReference" class="text-sm text-[var(--dh-text-muted)]">PO: {{ form.clientPoReference }} · Editable en Coordinación Origen.</p>
              <!-- Flat form layout: no nested glass cards, duplicate summaries or oversized choices. -->
              <section class="min-w-0 border-t border-[var(--dh-border)] pt-4 md:col-span-2"
                data-testid="opening-division-workspace" :aria-busy="operationalContactsLoading">
                <p v-if="!accountId" class="text-sm text-[var(--dh-text-muted)]">Selecciona una cuenta para consultar sus divisiones y contactos operativos.</p>
                <div v-else-if="operationalContactsLoading" class="grid gap-4 md:grid-cols-3" role="status" aria-label="Consultando divisiones y contactos">
                  <DhSkeleton height="2.75rem" rounded="md" />
                  <DhSkeleton class="md:col-span-2" height="2.75rem" rounded="md" />
                </div>
                <div v-else-if="operationalContactsIssue" role="alert" class="flex flex-wrap items-center justify-between gap-2">
                  <p class="min-w-0 flex-1 text-sm text-[var(--dh-text)]">{{ operationalContactsIssue }} Se conserva la selección guardada.</p>
                  <DhButton size="sm" variant="secondary" :icon="RefreshCw" label="Reintentar" @click="retryDivisionDirectory" />
                </div>
                <div v-else class="grid min-w-0 gap-5 md:grid-cols-3">
                  <div class="min-w-0 space-y-2">
                    <DhSelect v-if="crmDivisions.length || form.crmDivisionId"
                      :model-value="divisionSelectValue" label="División de la cuenta (opcional)"
                      :options="divisionChoices" :searchable="crmDivisions.length > 8"
                      placeholder="" @update:model-value="selectOpeningDivision" />
                    <div v-else>
                      <p class="mb-1.5 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">División de la cuenta</p>
                      <div class="flex min-h-11 items-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm font-semibold text-[var(--dh-text)]">
                        <Layers3 class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" /> Cuenta general
                      </div>
                      <p class="mt-2 text-xs text-[var(--dh-text-muted)]">No hay divisiones registradas.</p>
                    </div>
                    <p v-if="form.crmDivisionId && !selectedDivision" role="alert" class="text-xs font-semibold text-[var(--dh-text)]">La división guardada ya no está disponible. Selecciona otra opción.</p>
                    <p v-else-if="divisionContactSummary" class="text-xs text-[var(--dh-text-muted)]">{{ divisionContactSummary }}</p>
                    <p v-else-if="crmDivisions.length" class="text-xs text-[var(--dh-text-muted)]">Sin división específica.</p>
                  </div>

                  <div class="min-w-0 md:col-span-2">
                    <div class="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <h5 class="text-sm font-bold text-[var(--dh-text)]">Contactos operativos</h5>
                      <span class="text-xs font-semibold text-[var(--dh-text)]" aria-live="polite">{{ selectedRecipientCount }} de {{ eligibleOperationalContacts.length }} seleccionados</span>
                    </div>
                    <p v-if="missingRecipientCount" role="status" class="mb-2 text-xs font-semibold text-[var(--dh-text)]">{{ missingRecipientCount }} contactos guardados ya no están disponibles. Restaura la selección sugerida para actualizarla.</p>
                    <p v-if="!eligibleOperationalContacts.length" class="rounded-xl border border-[var(--dh-border)] px-3 py-2.5 text-sm text-[var(--dh-text-muted)]">No hay contactos operativos con correo válido para esta selección.</p>
                    <div v-else class="overflow-hidden rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
                      <section v-for="group in contactGroups" :key="group.key" :aria-label="group.label" class="border-b border-[var(--dh-border)] last:border-b-0">
                        <div v-if="contactGroups.length > 1 || group.contacts.length > 1"
                          class="flex flex-wrap items-center justify-between gap-1 border-b border-[var(--dh-border)] px-3 py-1.5">
                          <h6 class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ group.label }} ({{ group.contacts.length }})</h6>
                          <DhButton v-if="group.contacts.length > 1" size="sm" variant="ghost"
                            :label="group.contacts.every(c => form.contactIds.includes(c.id)) ? 'Desmarcar grupo' : 'Seleccionar grupo'"
                            @click="setRecipientGroup(group.contacts.map(c => c.id), !group.contacts.every(c => form.contactIds.includes(c.id)))" />
                        </div>
                        <div v-for="contact in group.contacts" :key="contact.id"
                          class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--dh-border)] px-3 py-2.5 last:border-b-0">
                          <DhCheckbox :model-value="form.contactIds.includes(contact.id)" :label="contact.name"
                            :description="contact.email" class="min-w-0 flex-1 break-words"
                            @update:model-value="toggleOperationalContact(contact.id, $event)" />
                          <span class="text-xs text-[var(--dh-text-muted)]">
                            {{ !contact.divisionIds.length ? 'General' : form.crmDivisionId ? 'División' : crmDivisions.filter(d => contact.divisionIds.includes(d.id)).map(d => d.name).join(' · ') || 'División' }}
                          </span>
                        </div>
                      </section>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center justify-between gap-x-2">
                      <p class="text-xs text-[var(--dh-text-muted)]">Destinatarios de notificaciones. El borrador no envía correos.</p>
                      <DhButton v-if="eligibleOperationalContacts.length || missingRecipientCount" size="sm" variant="ghost" label="Restaurar sugeridos" @click="restoreSuggestedRecipients" />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>



        <div v-show="activeStep === 1" class="mt-6 space-y-5">
          <div class="grid gap-4 md:grid-cols-2">
            <DhSelect v-model="form.incoterm" label="Incoterm" :options="incotermChoices" />
            <div v-if="!editingId" class="space-y-2">
              <p class="text-xs font-bold">Sentido de operación</p>
              <DhBadge :variant="operation ? 'primary' : 'neutral'">{{ operationLabel || 'Pendiente de cliente y ruta' }}</DhBadge>
              <DhButton variant="ghost" size="sm" @click="showOperationOverride = !showOperationOverride">{{ showOperationOverride ? 'Ocultar opciones' : 'Cambiar operación' }}</DhButton>
              <DhSelect v-if="accountId && !resolveCrmCountryCode(form.clientCountryId, currentCatalog('countries'))" v-model="form.clientCountryOverrideId" label="País del cliente para este trámite" :options="currentCatalog('countries').filter(country => resolveCrmCountryCode(country.id, currentCatalog('countries'))).map(country => ({ value: country.id, label: optionText(country) }))" />
              <DhSelect v-if="showOperationOverride || (!operation && accountId && selectedPol && selectedPoe)" v-model="form.operationOverride" label="Importación / exportación" :options="[{ value: 'Import', label: 'Importación' }, { value: 'Export', label: 'Exportación' }, { value: 'TransitDomestic', label: 'Tránsito / doméstico' }]" />
              <DhButton v-if="form.operationOverride" variant="ghost" size="sm" @click="form.operationOverride = ''">Usar cálculo automático</DhButton>
            </div>
            <DhSelect v-if="editingId" v-model="form.cargoNature" label="Naturaleza de la carga"
              :options="cargoNatureChoiceOptions" placeholder="Seleccione la naturaleza de la carga" />
          </div>
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4 sm:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h4 class="text-base font-black">Ruta de transporte</h4><p class="mt-1 text-xs font-medium text-[var(--dh-text-muted)]">Buscadores de POL, POE y POD compartidos con el wizard de Pricing.</p></div>
              <DhBadge variant="neutral">{{ catalogLoading ? 'Cargando catálogos' : 'Catálogos de Config' }}</DhBadge>
            </div>
            <div class="grid gap-4" :class="showPod ? 'md:grid-cols-3' : 'md:grid-cols-2'">
              <div>
                <PricingLocationSearchSelect v-if="polOptions.length" v-model="selectedPol" :label="routeTerminal === 'APT' ? 'Aeropuerto de origen / POL' : 'Origen / POL'" placeholder="Buscar ubicación…" search-placeholder="Nombre, código o país…" :options="polOptions" :terminal-type="routeTerminal" @update:model-value="!$event && (form.pol = '')" />
                <DhInput v-else v-model="form.pol" label="Origen / POL" placeholder="Puerto o lugar de origen" />
                <DhInput v-if="form.pol && !selectedPol && polOptions.length" v-model="form.pol" label="Origen registrado / texto libre" />
              </div>
              <div>
                <PricingLocationSearchSelect v-if="poeOptions.length" v-model="selectedPoe" :label="routeTerminal === 'APT' ? 'Aeropuerto destino (POE)' : 'Destino (POE)'" placeholder="Buscar ubicación de entrada…" search-placeholder="Nombre, código o país…" :options="poeOptions" :terminal-type="routeTerminal" @update:model-value="!$event && (form.poe = '')" />
                <DhInput v-else v-model="form.poe" label="Entrada / POE" placeholder="Puerto de entrada" />
                <DhInput v-if="form.poe && !selectedPoe && poeOptions.length" v-model="form.poe" label="POE registrado / texto libre"  />
              </div>
              <div v-if="showPod">
                <PricingLocationSearchSelect v-if="podOptions.length" v-model="selectedPod" label="Destino final / POD" placeholder="Buscar destino…" search-placeholder="Nombre, código o país…" :options="podOptions" terminal-type="SD" @update:model-value="!$event && (form.pod = '')" />
                <DhInput v-else v-model="form.pod" label="Destino final / POD" placeholder="Destino" />
                <DhInput v-if="form.pod && !selectedPod && podOptions.length" v-model="form.pod" label="POD registrado / texto libre" />
              </div>
            </div>
          </div>
          <DhCard v-if="requiresWarehouse" title="WHS · Almacén de origen" :icon="Package" padding="sm" class="space-y-3">
            <p class="text-xs text-[var(--dh-text-muted)]">Selecciona primero el agente de origen y luego el WHS. Los almacenes sin propietario registrado se identifican por separado.</p>
            <DhSelect v-if="!editingId" searchable :disabled="!selectedPol || catalogLoading" :model-value="form.agentId"
              :options="providerOptions('agents', form.agentReference, form.agentId)" label="Agente / oficina de origen"
              placeholder="Seleccionar agente" @update:model-value="setProvider('agent', String($event || ''))" />
            <p v-if="!editingId && !form.agentId" class="text-xs text-[var(--dh-text-muted)]">Selecciona un agente con cobertura en el país de origen para habilitar el WHS.</p>
            <p v-else-if="!editingId && !warehouseOptions.length && !catalogLoading" class="text-xs text-[var(--dh-text-muted)]">No hay WHS compatibles disponibles. Revisa los almacenes en Configuración → Catálogos → WHS globales.</p>
            <PricingLocationSearchSelect v-if="!editingId || warehouseOptions.length" v-model="selectedWarehouse"
              label="WHS global" placeholder="Buscar almacén…" search-placeholder="Buscar bodega o ciudad…"
              :disabled="!editingId && !form.agentId"
              :options="warehouseOptions" terminal-type="WHS" @open="loadPricingCatalogs"
              @update:model-value="!$event && (form.whsName = '', form.warehouseId = '', form.warehouseAddress = '')" />
            <div v-if="warehouse && (editingId || warehouseOptions.some(option => option.value === selectedWarehouse))" class="space-y-1 text-xs">
              <p class="font-black">{{ optionText(warehouse) }}</p>
              <p><strong>Agente:</strong> {{ warehouseOwnerLabel }}</p>
              <p v-if="!editingId && warehouseAgentOwnership(warehouse?.metadataJson) === 'unlinked'" class="text-[var(--dh-text-muted)]">Se utilizará con {{ form.agentReference }} únicamente en este trámite. No se modifica el propietario del catálogo.</p>
              <p><strong>Dirección:</strong> {{ warehouseAddress || 'Sin dirección' }}</p>
              <p v-if="warehouseMeta.schedule"><strong>Horario:</strong> {{ warehouseMeta.schedule }}</p>
              <p v-if="warehouseMeta.contacts"><strong>Contactos:</strong> {{ warehouseMeta.contacts }}</p>
              <p v-if="warehouseMeta.email"><strong>Email:</strong> {{ warehouseMeta.email }}</p>
              <p v-if="warehouseMeta.phone"><strong>Teléfono:</strong> {{ warehouseMeta.phone }}</p>
            </div>
            <DhInput v-else-if="editingId && !warehouseOptions.length && !catalogLoading" v-model="form.warehouseAddress" label="Dirección del WHS" />
            <p v-else-if="catalogLoading" class="text-xs text-[var(--dh-text-muted)]">Consultando almacenes…</p>
          </DhCard>
          <DhCard v-if="!editingId" title="Equipo previsto" :icon="UsersRound" padding="sm">
            <p class="text-sm font-semibold">{{ originTeamPreview }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">El servidor confirma el equipo y asigna un operativo autorizado según disponibilidad y carga del pool.</p>
          </DhCard>
          <DhCard title="Servicios solicitados y proveedores" padding="sm">
            <p class="mb-3 text-xs text-[var(--dh-text-muted)]">Selecciona los servicios acordados. Los proveedores pueden confirmarse en Origen; no se crean costos ni tarifas.</p>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="md:col-span-2" v-if="!editingId">
                <DhMultiSelect v-model="form.services" :options="serviceOptions" label="Servicios solicitados" placeholder="Seleccionar servicios" show-selected-labels search-placeholder="Buscar servicio..." />
                <p v-if="!serviceOptions.length" class="mt-2 text-xs text-[var(--dh-text-muted)]">Catálogo de servicios no disponible. <DhButton size="sm" variant="secondary" label="Reintentar" @click="loadPricingCatalogs" /></p>
              </div>
              <div v-else class="md:col-span-2"><p class="mb-2 text-xs font-bold text-[var(--dh-text-muted)]">Servicios registrados</p><div class="flex flex-wrap gap-2"><DhBadge v-for="service in selectedServiceLabels" :key="service" variant="neutral">{{ service }}</DhBadge><span v-if="!selectedServiceLabels.length" class="text-xs text-[var(--dh-text-muted)]">Sin servicios registrados</span></div></div>
              <DhSelect v-if="showCarrier" searchable :model-value="form.carrierId" :options="providerOptions('carriers', form.carrierReference, form.carrierId)" label="Naviera" placeholder="Por confirmar" @update:model-value="setProvider('carrier', String($event || ''))" />
              <DhSelect v-if="editingId || !requiresWarehouse" searchable :disabled="!selectedPol" :model-value="form.agentId" :options="providerOptions('agents', form.agentReference, form.agentId)" label="Agente / oficina de origen" placeholder="Por confirmar" @update:model-value="setProvider('agent', String($event || ''))" />
              <p v-if="(editingId || !requiresWarehouse) && selectedPol && !eligibleAgents.length && !catalogLoading" class="text-xs text-[var(--dh-text-muted)] md:col-span-2">No hay agentes activos con cobertura para el país de origen. Puede confirmarse en Coordinación Origen.</p>
              <div v-if="!editingId && requiresWarehouse" class="text-sm"><span class="text-xs font-semibold text-[var(--dh-text-muted)]">Agente de origen (paso 1)</span><p class="font-semibold">{{ form.agentReference || 'Por seleccionar' }}</p></div>
              <DhSelect v-if="editingId && isMaritime && deliveryRequired" searchable v-model="form.haulageMode" :options="[{ value: 'Merchant', label: 'Merchant Haulage' }, { value: 'Carrier', label: 'Carrier Haulage' }]" label="Transporte en destino" placeholder="Por confirmar" />
              <DhInput v-if="editingId && form.transportType === 'AIR'" v-model="form.airline" label="Referencia de aerolínea (si se conoce)" />
              <DhInput v-if="editingId && form.transportType === 'ROAD'" v-model="form.roadCarrierReference" label="Referencia de transportista (si se conoce)" />
              <div v-if="editingId" class="md:col-span-2"><DhTextarea v-model="form.observations" label="Observaciones / instrucciones para Origen" :rows="3" /></div>
            </div>
          </DhCard>
          <PricingInlandServiceLocation v-if="pickupRequired"
            v-model="pickupPoint" v-model:locations="form.pickupLocations" kind="pickup" operational
            :operation-type="operation || undefined" :incoterm-code="selectedIncoterm" />
          <PricingInlandServiceLocation v-if="deliveryRequired"
            v-model="deliveryPoint" v-model:locations="form.deliveryLocations" kind="delivery" operational
            :operation-type="operation || undefined" :incoterm-code="selectedIncoterm" />
        </div>

        <div v-show="activeStep === 2" class="space-y-5">
          <div class="space-y-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4">
            <h4 class="text-base font-black">Descripción de carga y CABYS</h4>
            <div class="flex flex-wrap items-end gap-3">
              <div class="min-w-[180px] flex-1">
                <DhInput v-model="form.cabysSearch" label="Buscar CABYS de Hacienda" placeholder="Ej. repuestos, textiles, maquinaria…" @keyup.enter="searchCabys" />
              </div>
              <DhButton :icon="Search" label="Buscar" :loading="searchingCabys" @click="searchCabys" />
            </div>
            <div v-if="cabysResults.length" class="max-h-52 overflow-auto rounded-xl border border-[var(--dh-border)]">
              <button v-for="item in cabysResults" :key="item.code" type="button"
                class="flex w-full gap-3 border-b border-[var(--dh-border)] p-3 text-left text-sm hover:bg-[var(--dh-card-hover)]" @click="chooseCabys(item)">
                <span class="font-mono font-black">{{ item.code }}</span>
                <span>{{ item.description }}</span>
              </button>
            </div>
            <p v-if="form.cabysCode" class="text-xs font-black">CABYS seleccionado: {{ form.cabysCode }}</p>
          </div>
          <DhTextarea v-model="form.cargoDescription" label="Descripción de la mercancía" :rows="3" />
          <p class="text-xs text-[var(--dh-text-muted)]">Registra las medidas estimadas. Coordinación Origen confirma el peso real y las fechas de transporte.</p>
          <div v-if="effectiveShipment === 'LCL'" class="space-y-2">
            <DhSelect searchable :model-value="selectedConsolidation?.id || form.consolidationId || ''" :options="consolidationOptions" label="Nombre del consolidado" placeholder="Buscar consolidado de Pricing" :disabled="consolidationLoading" @update:model-value="selectConsolidation" />
            <p v-if="consolidationLoading" class="text-xs text-[var(--dh-text-muted)]">Consultando consolidados…</p>
            <p v-else-if="consolidationError" class="text-xs text-[var(--dh-text-muted)]">{{ consolidationError }} <DhButton size="sm" variant="secondary" label="Reintentar" @click="loadConsolidations" /></p>
            <p v-if="!selectedConsolidation && form.consolidationReference" class="text-xs text-[var(--dh-text-muted)]">Referencia guardada: {{ form.consolidationReference }}</p>
          </div>
          <DhInput v-else-if="effectiveShipment === 'LTL'" v-model="form.consolidationReference" label="Nombre del consolidado" placeholder="Por confirmar si aún no está disponible" />
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <DhInput v-model="form.packageCount" label="Cantidad de bultos" type="number" :min="0" />
            <DhSelect v-if="editingId" v-model="form.packageType" label="Tipo de bulto" :options="packageTypeChoiceOptions" placeholder="Seleccione tipo de bulto" />
            <DhInput v-model="form.estimatedWeightValue" label="Peso estimado" type="number" :min="0" />
            <DhSelect v-model="weightUnitSelection" label="Unidad de peso" :options="[{ label: 'KG', value: 'KG' }, { label: 'LB', value: 'LB' }]" />
            <DhInput v-model="form.volumeValue" label="Volumen" type="number" :min="0" />
            <DhSelect v-model="volumeUnitSelection" label="Unidad de volumen" :options="[{ label: 'CBM', value: 'CBM' }, { label: 'CFT', value: 'CFT' }]" />
            <template v-if="editingId && effectiveShipment === 'AIR'">
              <DhInput v-model="form.lengthValue" label="Largo" type="number" :min="0" />
              <DhSelect v-model="form.lengthUnit" label="Unidad de largo" :options="dimensionOptions" />
              <DhInput v-model="form.widthValue" label="Ancho" type="number" :min="0" />
              <DhSelect v-model="form.widthUnit" label="Unidad de ancho" :options="dimensionOptions" />
              <DhInput v-model="form.heightValue" label="Alto" type="number" :min="0" />
              <DhSelect v-model="form.heightUnit" label="Unidad de alto" :options="dimensionOptions" />
            </template>
          </div>
          <DhCard title="Equivalencias de la mercancía">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <p class="text-sm">Peso estimado: <strong>{{ measurementLabel(estimatedKg) }} kg / {{ measurementLabel(estimatedKg === null ? null : estimatedKg / 0.45359237) }} lb</strong></p>
              <p class="text-sm">Volumen: <strong>{{ measurementLabel(normalizedVolume) }} CBM / {{ measurementLabel(normalizedVolume === null ? null : normalizedVolume / 0.028316846592) }} CFT</strong></p>
              <p v-if="editingId && effectiveShipment === 'AIR'" class="text-sm">Dimensiones: <strong>{{ [form.lengthCm, form.widthCm, form.heightCm].map(x => measurementLabel(positive(x) ? Number(x) : null)).join(' × ') }} cm</strong></p>
            </div>
          </DhCard>
          <div class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/40 p-4 sm:p-5">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><h4 class="text-sm font-black">Condiciones especiales</h4><p class="text-xs text-[var(--dh-text-muted)]">Se mostrarán únicamente los campos que correspondan.</p></div>
            </div>
            <div class="flex flex-wrap gap-3">
              <DhButton class="min-w-[150px]" :variant="form.isImo === true ? 'primary' : 'secondary'" :aria-pressed="form.isImo === true" :label="'IMO / Peligrosa · ' + conditionLabel(form.isImo)" @click="form.isImo = toggleCondition(form.isImo)" />
              <DhButton v-if="stackableApplicable" class="min-w-[150px]" :variant="form.stackable === true ? 'primary' : 'secondary'" :aria-pressed="form.stackable === true" :label="'Estibable · ' + conditionLabel(form.stackable)" @click="form.stackable = toggleCondition(form.stackable)" />
              <DhButton class="min-w-[150px]" :variant="form.overweight === true ? 'primary' : 'secondary'" :aria-pressed="form.overweight === true" :label="'Sobrepeso · ' + conditionLabel(form.overweight)" @click="form.overweight = toggleCondition(form.overweight)" />
            </div>
            <div v-if="editingId && isMaritime" class="mt-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]/30 p-4">
              <div class="mb-3">
                <h5 class="text-sm font-black">Muellaje en destino</h5>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Opciones excluyentes; selecciona únicamente la que corresponda.</p>
              </div>
              <div class="grid gap-2 sm:grid-cols-2">
                <button type="button" :aria-pressed="form.portHandlingMode === 'Redestino'" @click="toggleHandling('Redestino')"
                  class="group flex min-h-[94px] items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                  :class="form.portHandlingMode === 'Redestino' ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] shadow-sm'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/50 hover:bg-[var(--dh-card-hover)]'">
                  <span><span class="block text-sm font-black">Redestino</span>
                    <span class="mt-1 block text-xs font-medium text-[var(--dh-text-muted)]">Retiro o entrega con redestino</span></span>
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                    :class="form.portHandlingMode === 'Redestino' ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                      : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'">
                    <Check v-if="form.portHandlingMode === 'Redestino'" class="h-4 w-4" />
                  </span>
                </button>
                <button type="button" :aria-pressed="form.portHandlingMode === 'Anticipado'" @click="toggleHandling('Anticipado')"
                  class="group flex min-h-[94px] items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                  :class="form.portHandlingMode === 'Anticipado' ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] shadow-sm'
                    : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/50 hover:bg-[var(--dh-card-hover)]'">
                  <span><span class="block text-sm font-black">Anticipado</span>
                    <span class="mt-1 block text-xs font-medium text-[var(--dh-text-muted)]">Muellaje anticipado en destino</span></span>
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
                    :class="form.portHandlingMode === 'Anticipado' ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                      : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'">
                    <Check v-if="form.portHandlingMode === 'Anticipado'" class="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <DhInput v-if="form.isImo" v-model="form.imoClass" label="Clase IMO" />
              <DhInput v-if="form.isImo" v-model="form.unNumber" label="Número UN" />
              <DhInput v-if="form.overweight" v-model="form.overweightNotes" label="Requerimientos por sobrepeso" />
            </div>
          </div>
          <div v-if="needsEquipment" class="overflow-hidden rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)]">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] bg-[rgb(var(--dh-primary-rgb)/0.04)] px-5 py-4">
              <div>
                <h4 class="text-base font-black">{{ effectiveShipment === 'FTL' ? 'Distribución de furgones FTL' : 'Distribución de contenedores FCL' }}</h4>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Cada tipo se agrega una vez. Utiliza Cantidad para varias unidades iguales.</p>
              </div>
              <DhButton variant="secondary" :icon="Plus" :label="effectiveShipment === 'FTL' ? 'Añadir furgón' : 'Añadir contenedor'" size="sm"
                :disabled="Boolean(assignmentPendingId)" @click="addEquipment" />
            </div>
            <div class="space-y-3 p-4 sm:p-5">
              <div v-if="!form.equipment.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm text-[var(--dh-text-muted)]">
                Selecciona al menos un tipo de equipo para este embarque.
              </div>
              <div v-for="(item, index) in form.equipment" :key="'equipment-' + index"
                class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]/35 p-4 transition-colors"
                :class="resolvedEquipmentId(item) ? 'border-[var(--dh-primary)]/25' : ''">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <span class="text-[11px] font-black uppercase tracking-widest text-[var(--dh-primary)]">
                    {{ effectiveShipment === 'FTL' ? 'Furgón' : 'Contenedor' }} {{ index + 1 }}
                  </span>
                  <button v-if="form.equipment.length > 1" type="button"
                    class="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/10"
                    @click="form.equipment.splice(index, 1)"><Trash2 class="h-4 w-4" /> Quitar</button>
                </div>
                <div class="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                  <div class="min-w-0">
                    <PricingContainerSelector
                      :model-value="resolvedEquipmentId(item)"
                      :transport="effectiveShipment === 'FTL' ? 'land' : 'maritime'"
                      :excluded-equipment-ids="form.equipment.filter((_, otherIndex) => otherIndex !== index).map(other => resolvedEquipmentId(other)).filter(Boolean)"
                      :show-resolved-label="false"
                      @update:model-value="setEquipmentType(item, $event)"
                    />
                  </div>
                  <DhInput :model-value="item.quantity" label="Cantidad" type="number" :min="1" :step="1"
                    @update:model-value="item.quantity = Math.max(1, Math.floor(Number($event) || 1))" />
                </div>
                <p v-if="item.equipmentType" class="mt-2 text-xs text-[var(--dh-text-muted)]">
                  {{ item.equipmentType }}
                </p>
              </div>
              <div v-if="form.equipment.length"
                class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dh-primary)]/20 bg-[rgb(var(--dh-primary-rgb)/0.05)] px-4 py-3">
                <span class="text-xs font-black text-[var(--dh-primary)]">
                  Total: {{ totalEquipment }} {{ effectiveShipment === 'FTL' ? 'furgones' : 'contenedores' }}

                </span>
                <div class="flex flex-wrap gap-1.5">
                  <span v-for="(row, i) in form.equipment.filter(x => needsEquipment && x.equipmentType)" :key="i"
                    class="rounded-full border border-[var(--dh-border)] bg-[var(--dh-card)] px-2.5 py-1 text-[10px] font-bold">
                    {{ row.quantity }} × {{ row.equipmentType }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="editingId || form.supportDocuments.length" class="space-y-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)]/35 p-4 sm:p-5">
            <h4 class="text-base font-black">Documentos de respaldo</h4>
            <p class="text-xs text-[var(--dh-text-muted)]">Imágenes, PDF, Word y Excel quedan almacenados en Storage y asociados a esta apertura.</p>
            <div v-if="editingId" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label v-for="category in supportCategories" :key="category.key" class="flex min-h-[68px] cursor-pointer items-center justify-center gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-4 text-center text-xs font-black transition-all hover:border-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.07)]">
                <FileUp class="h-4 w-4" />{{ uploadingSupport === category.key ? 'Subiendo…' : category.label }}
                <input class="hidden" type="file" :accept="supportAccept" :disabled="Boolean(uploadingSupport)" @change="uploadDocument(category.key, category.label, $event)" />
              </label>
            </div>
            <div v-if="form.supportDocuments.length" class="grid gap-2 md:grid-cols-2">
              <div v-for="document in form.supportDocuments" :key="document.id" class="flex items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] p-3 text-xs">
                <div class="min-w-0"><p class="font-black">{{ document.categoryLabel }}</p><p class="truncate text-[var(--dh-text-muted)]">{{ document.fileName }}</p></div>
                <button type="button" class="font-black text-red-500" @click="removeDocument(document.id)">Eliminar</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!editingId && activeStep === 3" class="space-y-4" data-testid="manual-opening-review">
          <DhCard title="Revisión de apertura manual" padding="sm">
            <template #actions>
              <DhBadge :variant="manualReviewReady ? 'success' : manualReviewBlockers.length ? 'warning' : 'neutral'">
                {{ manualReviewReady ? 'Lista para crear' : manualReviewBlockers.length ? 'Requiere revisión' : 'Por verificar' }}
              </DhBadge>
            </template>
            <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div class="min-w-0"><dt class="text-xs text-[var(--dh-text-muted)]">Consecutivo IDTRA</dt><dd class="mt-1 font-semibold">{{ assignmentPendingId ? 'Ya asignado al expediente' : 'Automático al confirmar' }}</dd></div>
              <div class="min-w-0"><dt class="text-xs text-[var(--dh-text-muted)]">Estado inicial</dt><dd class="mt-1 font-semibold">Coordinación Origen</dd></div>
              <div class="min-w-0"><dt class="text-xs text-[var(--dh-text-muted)]">Equipo previsto</dt><dd class="mt-1 font-semibold">{{ originTeamPreview }}</dd></div>
              <div class="min-w-0"><dt class="text-xs text-[var(--dh-text-muted)]">Operativo</dt><dd class="mt-1 font-semibold">Asignación por pool</dd></div>
            </dl>
          </DhCard>
          <DhCard title="Validación de apertura" :icon="ClipboardCheck" padding="sm" aria-live="polite">
            <template #actions><DhBadge :variant="manualReviewReady ? 'success' : manualReviewBlockers.length ? 'danger' : 'neutral'">{{ manualReviewReady ? 'Completa' : manualReviewBlockers.length ? 'Datos requeridos' : 'Por verificar' }}</DhBadge></template>
            <ul v-if="manualReviewBlockers.length" class="space-y-2 text-sm">
              <li v-for="item in manualReviewBlockers" :key="item" class="flex items-start gap-2"><CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{{ item }}</li>
            </ul>
            <p v-if="completenessLoading" class="text-sm text-[var(--dh-text-muted)]">Verificando los datos de apertura…</p>
            <div v-else-if="completenessError" role="alert" class="space-y-2">
              <p class="text-sm">{{ completenessError }}</p>
              <DhButton size="sm" variant="secondary" label="Reintentar" @click="retryCompleteness++" />
            </div>
            <p v-else-if="manualReviewReady" class="flex items-center gap-2 text-sm font-semibold"><CircleCheck class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />Todos los datos requeridos para la apertura están completos.</p>
            <p v-else-if="!manualReviewBlockers.length" class="text-sm text-[var(--dh-text-muted)]">Revisa el contexto de creación y los datos de apertura antes de confirmar.</p>
            <p class="mt-3 text-xs text-[var(--dh-text-muted)]">{{ assignmentPendingId ? 'El expediente ya existe. Confirmar no genera otro IDTRA.' : 'Al confirmar, se crea el IDTRA y se envía a Coordinación Origen. Los datos de etapas posteriores se completan allí.' }}</p>
          </DhCard>
          <div class="grid items-stretch gap-4 lg:grid-cols-2">
            <DhCard v-for="section in manualReviewSections" :key="section.title" :title="section.title" :icon="section.icon" padding="sm">
              <template #actions><DhButton size="sm" variant="secondary" label="Editar" :disabled="Boolean(assignmentPendingId)" @click="goToStep(section.step)" /></template>
              <dl class="grid gap-x-4 gap-y-3 sm:grid-cols-2 text-sm">
                <div v-for="row in section.rows" :key="row.label" class="min-w-0">
                  <dt class="text-xs text-[var(--dh-text-muted)]">{{ row.label }}</dt>
                  <dd class="mt-1 break-words font-semibold text-[var(--dh-text)]">{{ row.value }}</dd>
                </div>
              </dl>
            </DhCard>
          </div>
        </div>

        <div v-if="editingId && activeStep === 3" class="space-y-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 class="text-lg font-black">Revisión de apertura</h4>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Confirma la información del expediente. La apertura manual pasa directamente a Coordinación Origen sin doble validación.</p>
            </div>
            <DhBadge :variant="blockers.length ? 'warning' : 'success'">
              {{ blockers.length ? blockers.length + ' datos por completar' : 'Información completa' }}
            </DhBadge>
          </div>
          <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)]/30 px-4 py-3">
            <span class="text-[11px] font-black uppercase tracking-wide text-[var(--dh-text-muted)]">Apertura manual</span>
            <span class="text-[var(--dh-text-muted)]">·</span>
            <strong class="text-sm">{{ form.transportType === 'MARITIME' ? 'Marítimo' : form.transportType === 'ROAD' ? 'Terrestre' : form.transportType === 'AIR' ? 'Aéreo' : 'Transporte pendiente' }}</strong>
            <DhBadge v-if="effectiveShipment" variant="primary">{{ effectiveShipment }}</DhBadge>
            <span class="ml-auto text-xs text-[var(--dh-text-muted)]">IDTRA consecutivo al confirmar</span>
          </div>
          <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div class="space-y-4">
              <section class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
                <div class="mb-4 flex items-center gap-2"><UserRound class="h-4 w-4 text-[var(--dh-primary)]" /><h5 class="text-sm font-black">Cliente y responsable</h5></div>
                <p class="text-lg font-black">{{ selectedClientName || 'Cliente por seleccionar' }}</p>
                <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Ejecutivo comercial: <strong class="text-[var(--dh-text)]">{{ executiveLabel }}</strong></p>
                <div v-if="editingId" class="mt-4 grid gap-3 border-t border-[var(--dh-border)] pt-3 sm:grid-cols-2">
                  <div><p class="text-[10px] font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">Procedencia</p><p class="mt-1 text-sm font-semibold">{{ originOptions.find(x => x.value === form.provenance)?.label || '—' }}</p></div>
                  <div><p class="text-[10px] font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">PO / referencia</p><p class="mt-1 break-words text-sm font-semibold">{{ form.clientPoReference || 'Sin referencia' }}</p></div>
                </div>
                <div v-if="selectedOperationalContacts.length" class="mt-3 border-t border-[var(--dh-border)] pt-3">
                  <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">Contactos de operaciones</p>
                  <div class="flex flex-wrap gap-2"><span v-for="contact in selectedOperationalContacts" :key="contact.id" class="rounded-lg bg-[var(--dh-input)] px-2.5 py-1.5 text-xs font-semibold">{{ contact.name }}</span></div>
                </div>
              </section>
              <section class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
                <div class="mb-4 flex items-center gap-2"><Route class="h-4 w-4 text-[var(--dh-primary)]" /><h5 class="text-sm font-black">Ruta e itinerario</h5></div>
                <div class="grid gap-3" :class="showPod && form.pod ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
                  <div v-for="stop in [{ name: 'Origen · POL', value: form.pol }, { name: 'Destino · POE', value: form.poe }, ...(showPod && form.pod ? [{ name: 'Destino final · POD', value: form.pod }] : [])]" :key="stop.name" class="min-w-0 border-l-2 border-[var(--dh-primary)]/35 pl-3">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-[var(--dh-text-muted)]">{{ stop.name }}</p>
                    <p class="mt-1 break-words text-sm font-black">{{ stop.value || 'Pendiente' }}</p>
                  </div>
                </div>
                <div class="mt-4 flex flex-wrap gap-5 border-t border-[var(--dh-border)] pt-3 text-xs">
                  <span><span class="text-[var(--dh-text-muted)]">Operación:</span> <strong>{{ operationLabel || 'Pendiente' }}</strong></span>
                  <span><span class="text-[var(--dh-text-muted)]">Incoterm:</span> <strong>{{ form.incoterm || 'Pendiente' }}</strong></span>
                </div>
                <div v-if="(selectedIncoterm === 'EXW' || pickupRequired) && form.pickupLocations.length" class="mt-4 border-t border-[var(--dh-border)] pt-3">
                  <p class="text-xs font-bold">Puntos de recolecta</p>
                  <div v-for="(point, index) in form.pickupLocations" :key="index" class="mt-2 text-xs">
                    <p class="break-words font-semibold">{{ index + 1 }}. {{ point.address }}</p>
                    <p class="text-[var(--dh-text-muted)]">{{ point.cargoCondition === 'FiscalCargo' ? 'Carga fiscal' : point.cargoCondition === 'NationalizedCargo' ? 'Carga nacionalizada' : 'Tipo de carga pendiente' }}</p>
                  </div>
                </div>
                <div v-if="deliveryRequired && form.deliveryLocations.length" class="mt-4 border-t border-[var(--dh-border)] pt-3">
                  <p class="text-xs font-bold">Puntos de entrega</p>
                  <div v-for="(point, index) in form.deliveryLocations" :key="index" class="mt-2 text-xs">
                    <p class="break-words font-semibold">{{ index + 1 }}. {{ point.address }}</p>
                    <p class="text-[var(--dh-text-muted)]">{{ point.cargoCondition === 'FiscalCargo' ? 'Carga fiscal' : point.cargoCondition === 'NationalizedCargo' ? 'Carga nacionalizada' : 'Tipo de carga pendiente' }}</p>
                  </div>
                </div>
                <div v-if="requiresWarehouse && (warehouse || warehouseAddress)" class="mt-4 border-t border-[var(--dh-border)] pt-3 text-xs">
                  <p class="font-bold">WHS</p>
                  <p v-if="warehouse" class="mt-1 font-semibold">{{ optionText(warehouse) }}</p>
                  <p v-if="warehouseAddress" class="mt-1 break-words">{{ warehouseAddress }}</p>
                </div>
              </section>
              <DhCard title="Servicios y coordinación" padding="sm">
                <p class="text-xs font-semibold">Servicios solicitados</p>
                <div class="mt-2 flex flex-wrap gap-2"><DhBadge v-for="service in selectedServiceLabels" :key="service" variant="neutral">{{ service }}</DhBadge><span v-if="!selectedServiceLabels.length" class="text-xs text-[var(--dh-text-muted)]">Por completar</span></div>
                <div class="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <p v-if="showCarrier">Naviera: <strong>{{ form.carrierReference || 'Por confirmar' }}</strong></p>
                  <p>Agente: <strong>{{ form.agentReference || 'Por confirmar' }}</strong></p>
                  <p v-if="editingId && isMaritime && deliveryRequired">Transporte en destino: <strong>{{ form.haulageMode || form.merchantReference || 'Por confirmar' }}</strong></p>
                  <p v-if="editingId && form.transportType === 'AIR'">Aerolínea: <strong>{{ form.airline || 'Por confirmar' }}</strong></p>
                  <p v-if="editingId && form.transportType === 'ROAD'">Transportista: <strong>{{ form.roadCarrierReference || 'Por confirmar' }}</strong></p>
                </div>
                <p v-if="form.observations" class="mt-3 whitespace-pre-wrap break-words text-xs">{{ form.observations }}</p>
                <DhButton class="mt-3" size="sm" variant="secondary" label="Editar servicios y proveedores" @click="goToStep(2)" />
              </DhCard>
              <section class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
                <div class="mb-3 flex items-center gap-2"><Package class="h-4 w-4 text-[var(--dh-primary)]" /><h5 class="text-sm font-black">Mercancía y equipos</h5></div>
                <p v-if="editingId || form.cargoDescription" class="text-sm font-semibold">{{ form.cargoDescription || 'Descripción pendiente' }}</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span v-if="form.cabysCode" class="rounded-lg bg-[var(--dh-input)] px-3 py-1.5 text-xs font-bold">CABYS {{ form.cabysCode }}</span>
                  <span v-if="form.packageCount" class="rounded-lg bg-[var(--dh-input)] px-3 py-1.5 text-xs font-bold">{{ form.packageCount }} {{ form.packageType || 'bultos' }}</span>
                  <span v-if="form.estimatedWeightValue" class="rounded-lg bg-[var(--dh-input)] px-3 py-1.5 text-xs font-bold">{{ form.estimatedWeightValue }} {{ form.estimatedWeightUnit }} estimado</span>
                  <span v-if="form.volumeValue" class="rounded-lg bg-[var(--dh-input)] px-3 py-1.5 text-xs font-bold">{{ form.volumeValue }} {{ form.volumeUnit }}</span>
                  <span v-for="(item, i) in form.equipment.filter(x => needsEquipment && x.equipmentType)" :key="i" class="rounded-lg border border-[var(--dh-primary)]/20 px-3 py-1.5 text-xs font-bold">{{ item.quantity }} × {{ item.equipmentType }}</span>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                  <DhBadge :variant="form.isImo ? 'warning' : 'neutral'">IMO: {{ conditionLabel(form.isImo) }}</DhBadge>
                  <DhBadge v-if="stackableApplicable" variant="neutral">Estibable: {{ conditionLabel(form.stackable) }}</DhBadge>
                  <DhBadge :variant="form.overweight ? 'warning' : 'neutral'">Sobrepeso: {{ conditionLabel(form.overweight) }}</DhBadge>
                  <DhBadge v-if="['LCL','LTL'].includes(effectiveShipment)" variant="neutral">Consolidado: {{ form.consolidationReference || 'Por confirmar' }}</DhBadge>
                  <DhBadge v-if="isMaritime && form.portHandlingMode" variant="neutral">{{ form.portHandlingMode }}</DhBadge>
                  <DhBadge v-if="form.cargoNature" variant="neutral">{{ form.cargoNature }}</DhBadge>
                </div>
                <div v-if="editingId || form.supportDocuments.length" class="mt-4 border-t border-[var(--dh-border)] pt-3">
                  <p class="text-xs font-bold">Documentos: {{ form.supportDocuments.length }}</p>
                  <p v-if="form.supportDocuments.length" class="mt-1 break-words text-xs text-[var(--dh-text-muted)]">{{ form.supportDocuments.map(x => x.fileName).join(' · ') }}</p>
                  <p v-else class="mt-1 text-xs text-[var(--dh-text-muted)]">Sin documentos adjuntos.</p>
                </div>
              </section>
            </div>
            <div class="space-y-4">
              <DhCard title="Coordinación Origen" :icon="UsersRound" padding="sm">
                <p class="text-sm text-[var(--dh-text-muted)]">
                  {{ editingId ? 'La asignación existente se mantiene al editar el trámite.' : 'El pool operativo asignará el equipo y el operativo de Origen según las reglas de ruta, modalidad y disponibilidad. No requiere validadores de Aperturas.' }}
                </p>
              </DhCard>
              <section class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
                <div class="flex items-center justify-between gap-2"><h5 class="text-sm font-black">Completitud</h5><DhBadge :variant="blockers.length || serverBlockers ? 'danger' : completeness?.canPassFieldValidation ? 'success' : 'neutral'">{{ blockers.length || serverBlockers ? 'Campos bloqueantes' : completeness?.canPassFieldValidation ? 'Lista' : 'Por verificar' }}</DhBadge></div>
                <p v-if="!blockers.length && !serverBlockers && completeness?.canPassFieldValidation" class="mt-3 text-xs text-[var(--dh-text-muted)]">Información mínima lista. Operations registra el envío a Coordinación Origen y recupera la asignación si el pool no está disponible.</p>
                <ul v-if="blockers.length" class="mt-3 space-y-2">
                  <li v-for="item in blockers" :key="item" class="flex gap-2 text-xs font-semibold text-amber-500"><CircleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />{{ item }}</li>
                </ul>
                <div class="mt-4 space-y-2 border-t border-[var(--dh-border)] pt-3" aria-live="polite">
                  <p v-if="completenessLoading" class="text-xs text-[var(--dh-text-muted)]">Consultando estados de validación…</p>
                  <div v-else-if="completenessError" role="alert" class="space-y-2"><p class="text-xs text-[var(--dh-text-muted)]">{{ completenessError }}</p><DhButton size="sm" variant="secondary" label="Reintentar" @click="retryCompleteness++" /></div>
                  <template v-else-if="completeness">
                    <p class="text-xs font-semibold">{{ serverBlockers }} campos bloqueantes · {{ completeness.fields.filter(f => f.completionStatus === 'PENDIENTE_PERMITIDO').length }} pendientes permitidos</p>
                    <div class="grid grid-cols-2 gap-2">
                      <DhButton v-for="group in statusGroups" :key="group.status" size="sm" :variant="selectedStatusGroup === group.status ? 'primary' : 'secondary'" :label="openingStatusLabel(group.status) + ' (' + group.fields.length + ')'" @click="selectedStatusGroup = group.status" />
                    </div>
                    <div class="max-h-72 overflow-y-auto space-y-1">
                      <div v-for="field in statusGroups.find(group => group.status === selectedStatusGroup)?.fields || []" :key="field.fieldCode" class="flex flex-wrap items-center justify-between gap-2 py-1">
                        <span class="text-xs font-medium">{{ openingFieldLabel(field.fieldCode) }}</span>
                        <DhBadge :variant="openingStatusVariant(field.completionStatus)">{{ openingStatusLabel(field.completionStatus) }}</DhBadge>
                      </div>
                    </div>
                  </template>
                </div>
                <p class="mt-4 border-t border-[var(--dh-border)] pt-3 text-xs text-[var(--dh-text-muted)]">
                  {{ assignmentPendingId ? 'Este IDTRA ya existe. Reintentar la asignación no crea otro expediente.' : 'La creación no modifica QUOs ni costos comerciales. El IDTRA se asigna al confirmar.' }}
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="flex flex-wrap items-center justify-between gap-3 rounded-[var(--dh-radius-xl)] border border-[var(--dh-border)] bg-[var(--dh-card-solid,var(--dh-card))] p-3 sm:p-4" :class="editingId ? 'sticky bottom-3 z-30 shadow-xl' : ''">
      <DhButton variant="secondary" :icon="ChevronLeft" label="Anterior" :disabled="activeStep <= 1" @click="goToStep(activeStep - 1)" />
      <div class="hidden text-center sm:block">
        <p class="text-xs font-black">{{ activeStepMeta.label }}</p>
        <p class="text-[11px] text-[var(--dh-text-muted)]">Paso {{ activeStep }} / {{ wizardSteps.length }}</p>
      </div>
      <div class="flex items-center gap-2">
        <DhButton v-if="activeStep < wizardSteps.length" :icon="ChevronRight" label="Siguiente" @click="goToStep(activeStep + 1)" />
        <DhButton v-else :icon="editingId ? Save : FolderPlus"
          :label="editingId ? 'Guardar modificaciones' : assignmentPendingId ? 'Confirmar trámite existente' : 'Crear y enviar a Coordinación Origen'"
          :disabled="loading || saving || (!valid && !assignmentPendingId) || (!editingId && (blockers.length > 0 || serverBlockers > 0 || reviewValidationPending) && !assignmentPendingId)" :loading="saving" @click="save" />
      </div>
    </footer>
  </div>
</template>
