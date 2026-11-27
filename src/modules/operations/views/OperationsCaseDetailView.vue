<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkspaceTabsStore } from '@/core/stores/workspaceTabsStore'
import { workspaceTabKey } from '@/core/stores/workspaceTabPolicy'
import {
  ArrowLeft, RefreshCw, Pencil, Save, FolderOpen, ClipboardList,
  FileText, LockKeyhole, MessageSquareText, Plus, Layers3,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhTabs, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { operationsQuoteApi, type OperationsQuoteSummary } from '../services/operationsQuoteApi'
import { useAuthStore } from '@/core/stores/authStore'
import { crmPath, crmRequest } from '@/modules/crm/services/crmApi'
import {
  operationsApi, type OperationsCaseDetail, type OperationsCaseWorkspace,
  type OperationsCaseCost, type OperationsSnapshotCost, type OperationsCommercialConditions, type OperationsCaseTab, type OperationsTabCode,
  type OperationsTabLevel, type OperationsAudit, type OperationsUser,
  type OperationsInternalNote, type OperationsOriginProgress,
  type OperationsOpeningEdit, type OperationsServiceReviewDashboard, type OpeningCompleteness,
  type OperationsContact, type OperationsQuoteComparison, type OperationsQuoteComparisonRow,
} from '../services/operationsApi'
import OperationsAuditTimeline from '../components/OperationsAuditTimeline.vue'
import OperationsApertureValidationPanel from '../components/OperationsApertureValidationPanel.vue'
import { useOperationsCaseRealtime } from '../composables/useOperationsCaseRealtime'
import { departmentStatusLabel, operationsLabel, summaryMeasure, isPendingOperationsTask, commercialComparisonCounts, isOperationsCaseOnHold } from '../utils/caseOverview'
import { openingFieldLabel, openingStatusLabel, openingStatusVariant } from '../utils/openingFieldValidation'

import { mergeCommercialOpening, useCommercialLabels, sameRevisionCommercialData, readable, countryLabel, useOpeningDocuments } from '../utils/commercialPresentation'

const route = useRoute()
const router = useRouter()
const workspaceTabs = useWorkspaceTabsStore()
const { openingField, currency, serviceLabels } = useCommercialLabels()
const supplemental = ref<Record<string, unknown>>({})
const auth = useAuthStore()
const caseId = computed(() => String(route.params.id ?? ''))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')
const record = ref<OperationsCaseDetail | null>(null)
const completeness = ref<OpeningCompleteness | null>(null)
const completenessError = ref(false)
const completenessGroup = ref('PENDIENTE_PERMITIDO')
const completenessTabs = computed(() => (['PENDIENTE_BLOQUEANTE','PENDIENTE_PERMITIDO','CONFIRMADO','NO_APLICA'] as const).map(status => ({ key: status, label: openingStatusLabel(status) + ' (' + (completeness.value?.fields.filter(field => field.completionStatus === status).length || 0) + ')' })))
const visibleCompleteness = computed(() => (completeness.value?.fields || []).filter(field => field.completionStatus === completenessGroup.value).map(field => ({ ...field, id: field.fieldCode, label: openingFieldLabel(field.fieldCode) })))
watch(completeness, value => { if (value?.missingFields.length) completenessGroup.value = 'PENDIENTE_BLOQUEANTE' })
const hasAperturePanel = computed(() => record.value?.apertureType === 'AUTOMATIC' && ['PENDING_VALIDATION', 'APERTURA_REQUIERE_CAMBIOS'].includes(record.value.status))
const openingData = computed<Record<string, unknown>>(() => {
  try {
    const value = JSON.parse(record.value?.openingDataJson || '{}') as unknown
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (() => {
          const raw = value as Record<string, unknown>
          const merged = record.value?.apertureType === 'MANUAL' ? { ...raw } : mergeCommercialOpening(raw, workspace.value?.commercialData, supplemental.value)
          // Quoted measurements are estimates, not proof of real cargo weight.
          merged.estimatedWeightValue = raw.estimatedWeightValue ?? raw.quotedWeightKg ?? (record.value?.apertureType === 'AUTOMATIC' ? merged.weightValue : undefined)
          merged.estimatedWeightUnit = raw.estimatedWeightUnit ?? (merged.estimatedWeightValue != null ? 'KG' : undefined)
          merged.actualWeightValue = raw.actualWeightValue
          merged.actualWeightUnit = raw.actualWeightUnit
          merged.actualWeightKg = raw.actualWeightKg
          return merged
        })() : {}
  } catch { return {} }
})
const openingSections = computed(() => {
  const data = openingData.value
  const sections: Array<{ title: string; rows: Array<{ label: string; key: string }> }> = [
    { title: 'Ruta y transporte', rows: [
      { label: 'Tipo de embarque', key: 'shipmentType' },
      { label: 'Transporte', key: 'transportType' },
      { label: 'Incoterm', key: 'incoterm' },
      { label: 'POL · Salida', key: 'pol' },
      { label: 'POE · Entrada', key: 'poe' },
      { label: 'POD · Destino', key: 'pod' },
      { label: 'ETD', key: 'etm' }, { label: 'ETA', key: 'eta' },
      { label: 'Operación', key: 'provenance' }, { label: 'Tránsito cotizado', key: 'transitTime' },
      { label: 'Días libres cotizados', key: 'freeDays' }, { label: 'Referencias de QUO', key: 'quoteReferences' },
      { label: 'Válida desde', key: 'validFrom' }, { label: 'Válida hasta', key: 'validTo' },
    ] },
    { title: 'Mercancía', rows: [
      { label: 'Descripción', key: 'cargoDescription' },
      { label: 'CABYS', key: 'cabysCode' },
      { label: 'Naturaleza de carga', key: 'cargoNature' },
      { label: 'Bultos', key: 'packageCount' },
      { label: 'Tipo de bulto', key: 'packageType' },
      { label: 'Peso estimado', key: 'estimatedWeightValue' },
      { label: 'Unidad estimada', key: 'estimatedWeightUnit' },
      { label: 'Peso real', key: 'actualWeightValue' },
      { label: 'Unidad de peso real', key: 'actualWeightUnit' },
      { label: 'Peso real normalizado (kg)', key: 'actualWeightKg' },
      { label: 'Volumen', key: 'volumeValue' },
      { label: 'Unidad de volumen', key: 'volumeUnit' },
    ] },
    { title: 'Coordinación y proveedores', rows: [
      { label: 'Consolidado', key: 'consolidationReference' },
      { label: 'Dirección de recolecta', key: 'pickupAddress' },
      { label: 'WHS', key: 'whsName' },
      { label: 'Dirección de entrega', key: 'destinationAddress' },
      { label: 'Naviera', key: 'carrierReference' },
      { label: 'Agente', key: 'agentReference' },
      { label: 'Agente de consolidación', key: 'lclGroupAgentReference' },
      { label: 'Transporte en destino', key: 'haulageMode' },
      { label: 'Aerolínea', key: 'airline' },
      { label: 'Transportista', key: 'roadCarrierReference' },
      { label: 'Observaciones', key: 'observations' },
    ] },
  ]
  const inapplicable = new Set(completeness.value?.fields.filter(field => field.completionStatus === 'NO_APLICA').map(field => field.fieldCode))
  const fieldAliases: Record<string, string> = {
    estimatedWeightValue: 'estimatedWeight', estimatedWeightUnit: 'estimatedWeight',
    actualWeightValue: 'actualWeight', actualWeightUnit: 'actualWeight', actualWeightKg: 'actualWeight',
    volumeValue: 'volume', volumeUnit: 'volume', consolidationReference: 'consolidation',
  }
  const units: Record<string, string> = { estimatedWeightValue: 'estimatedWeightUnit', actualWeightValue: 'actualWeightUnit', volumeValue: 'volumeUnit' }
  return sections.map(section => ({
    title: section.title,
    rows: section.rows.filter(row => (!hasAperturePanel.value || !['etm','eta','actualWeightValue','actualWeightUnit','actualWeightKg','consolidationReference'].includes(row.key)) && !inapplicable.has(row.key) && !inapplicable.has(fieldAliases[row.key] || row.key) && !['estimatedWeightUnit','actualWeightUnit','volumeUnit'].includes(row.key) && (!['quoteReferences','validFrom','validTo','freeDays','transitTime'].includes(row.key) || Boolean(record.value?.sourceQuoteId))).map(row => {
      const raw = openingField(row.key, data)
      const unitKey = units[row.key]
      const value = unitKey ? summaryMeasure(raw, openingField(unitKey, data)) : raw
      return { label: row.label, value: value || (
        row.key === 'actualWeightValue' ? 'Pendiente de Coordinación Origen' : 'Por confirmar'
      ) }
    }),
  }))
})

const workspace = ref<OperationsCaseWorkspace | null>(null)
const pendingSummaryTasks = computed(() => (workspace.value?.tasks || []).filter(isPendingOperationsTask))
const quoteSearch = ref('')
const quoteCandidates = ref<OperationsQuoteSummary[]>([])
const quoteSelection = ref('')
const selectedQuoteCandidate = computed(() => quoteCandidates.value.find(rate => rate.id === quoteSelection.value))
const quoteLinkBusy = ref(false)
const quoteLinkMessage = ref('')
const quoteLinkError = ref('')
const pendingQuoteLink = computed(() => workspace.value?.quotes.some(quote => quote.status === 'PENDING_LINK'))
const canLinkQuote = computed(() => record.value?.apertureType === 'MANUAL' && !record.value.sourceQuoteId &&
  !['CANCELLED','COMPLETED'].includes(record.value.status) && auth.hasScope('operations.pricing.quote.read') && auth.hasScope('operations.pricing.quote.link'))
watch(caseId, () => { quoteSearch.value = ''; quoteCandidates.value = []; quoteSelection.value = ''; quoteLinkError.value = ''; quoteLinkMessage.value = '' })
async function searchAcceptedQuotes() {
  const detail = record.value
  if (!detail || !quoteSearch.value.trim() || quoteLinkBusy.value) return
  quoteLinkBusy.value = true; quoteSelection.value = ''; quoteCandidates.value = []; quoteLinkError.value = ''; quoteLinkMessage.value = ''
  try {
    const result = await operationsQuoteApi.search(quoteSearch.value.trim(), detail.accountId)
    if (caseId.value !== detail.id) return
    quoteCandidates.value = result.items.filter(rate => rate.status === 'AcceptedByClient' && rate.clientAccountId === detail.accountId &&
      rate.shipmentMode.toUpperCase() === detail.modalityCode.toUpperCase())
    if (!quoteCandidates.value.length) quoteLinkMessage.value = 'No se encontraron QUO aceptadas del mismo cliente y modalidad.'
    else if (quoteCandidates.value.length === 1) quoteSelection.value = quoteCandidates.value[0]!.id
  } catch { quoteLinkError.value = 'No se pudo consultar las cotizaciones autorizadas.' }
  finally { quoteLinkBusy.value = false }
}
async function requestQuoteLink() {
  const detail = record.value
  if (!detail || !quoteSelection.value || !canLinkQuote.value || quoteLinkBusy.value || pendingQuoteLink.value) return
  quoteLinkBusy.value = true; quoteLinkError.value = ''; quoteLinkMessage.value = ''
  try {
    const result = await operationsApi.linkQuote(detail.id, quoteSelection.value, detail.version)
    if (caseId.value !== detail.id) return
    quoteLinkMessage.value = result.status === 'ACCEPTED' ? 'Vínculo confirmado.' : 'Solicitud registrada; pendiente de confirmación de Pricing.'
    quoteSelection.value = ''; quoteCandidates.value = []
    await load()
  } catch { quoteLinkError.value = 'No se pudo registrar el vínculo. Verifica los permisos y actualiza el expediente.' }
  finally { quoteLinkBusy.value = false }
}
const access = ref<OperationsCaseTab[]>([])
const costs = ref<OperationsCaseCost[]>([])
const snapshotCosts = ref<OperationsSnapshotCost[]>([])
const commercialConditions = ref<OperationsCommercialConditions | null>(null)
const costError = ref(false)
const costRows = computed(() => snapshotCosts.value.length ? snapshotCosts.value.map(cost => ({ ...cost })) : costs.value.map(cost => ({ ...cost, currencyName: null, quantity: null, unitCost: null, taxAmount: null, saleTotal: null, chargeBasis: null, costDetailType: null })))
function amountLabel(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : 'Por confirmar'
}
const costColumns = computed<DhTableColumn<(typeof costRows.value)[number]>[]>(() => [
  { key: 'description', label: 'Rubro' },
  { key: 'costDetailType', label: 'Categoría' },
  { key: 'chargeBasis', label: 'Unidad de cobro' },
  { key: 'quantity', label: 'Cantidad', align: 'right' },
  { key: 'unitCost', label: 'Costo unitario', align: 'right' },
  { key: 'supplierName', label: 'Proveedor' },
  { key: 'currencyCode', label: 'Moneda' },
  { key: 'costAmount', label: 'Costo', align: 'right' },
  ...(auth.hasScope('operations.finance.manage') ? [{ key: 'saleAmount' as const, label: 'Subtotal venta', align: 'right' as const }, { key: 'taxAmount' as const, label: 'Impuesto', align: 'right' as const }, { key: 'saleTotal' as const, label: 'Total venta', align: 'right' as const }] : []),
])
const missingCostProviders = computed(() => costRows.value.filter(cost => !readable(cost.supplierName)).length)
const commercialReviews = ref<OperationsServiceReviewDashboard | null>(null)
const contacts = ref<OperationsContact[]>([])
const contactsError = ref(false)
const contactsLoading = ref(false)
const comparison = ref<OperationsQuoteComparison | null>(null)
const comparisonError = ref(false)
const reviewComment = ref('')
const requestingReview = ref(false)
const reviewDraftChanged = ref(false)
const comparisonRows = computed(() => (comparison.value?.rows || []).map(row => ({ ...row, id: row.field })))
const comparisonColumns: DhTableColumn<OperationsQuoteComparisonRow>[] = [
  { key: 'label', label: 'Dato comercial' },
  { key: 'quoted', label: 'QUO aceptada' },
  { key: 'current', label: 'Trámite actual' },
  { key: 'status', label: 'Comparación' },
]
const comparisonCounts = computed(() => commercialComparisonCounts(comparisonRows.value))
const discrepancyCount = computed(() => comparisonCounts.value.changed)
const unconfirmedCount = computed(() => comparisonCounts.value.unconfirmed)
const comparisonFilter = ref('ALL')
const comparisonFilters = computed(() => [
  { key: 'ALL', label: `Todos (${comparisonRows.value.length})` },
  { key: 'MATCH', label: `Coinciden (${comparisonCounts.value.match})` },
  { key: 'UNCONFIRMED', label: `Por confirmar (${unconfirmedCount.value})` },
  { key: 'CHANGED', label: `Diferencias (${discrepancyCount.value})` },
])
const visibleComparisonRows = computed(() => comparisonRows.value.filter(row => comparisonFilter.value === 'ALL' || row.status === comparisonFilter.value))
const confirmedHold = computed(() => isOperationsCaseOnHold(record.value?.status))
const canOpenComparison = computed(() => ['EDITABLE', 'READ_ONLY'].includes(level('QUO')))
const selectedContacts = computed(() => new Set(Array.isArray(openingData.value.contactIds) ? openingData.value.contactIds.map(String) : []))
const quoteData = computed(() => mergeCommercialOpening({}, workspace.value?.commercialData, supplemental.value))
const quoteFields = computed(() => [
  ['Cliente', 'clientName'], ['Ejecutivo comercial', 'executiveName'], ['Tipo de embarque', 'shipmentType'],
  ['Transporte', 'transportType'], ['Incoterm', 'incoterm'], ['Operación', 'provenance'],
  ['POL · Origen', 'pol'], ['POE · Entrada', 'poe'], ['POD · Destino', 'pod'],
  ['Naviera', 'carrierReference'], ['Agente / co-loader', 'agentReference'],
  ['Agente de consolidación', 'lclGroupAgentReference'], ['Merchant', 'merchantReference'],
  ['Dirección de recolecta', 'pickupAddress'], ['Ruta de naviera', 'carrierRoute'], ['Descripción de mercancía', 'cargoDescription'],
  ['Tránsito cotizado', 'transitTime'], ['Días libres', 'freeDays'],
  ['Válida desde', 'validFrom'], ['Válida hasta', 'validTo'], ['Referencias', 'quoteReferences'],
].map(([label, key]) => ({ label: label!, value: openingField(key!, quoteData.value) || 'No registrado en la QUO' })))
const quoteServices = computed(() => Array.isArray(quoteData.value.services)
  ? quoteData.value.services.map(x => readable(x)).filter(Boolean) : [])
const quoteEquipment = computed(() => Array.isArray(quoteData.value.equipment)
  ? quoteData.value.equipment.map(x => {
      const item = x as Record<string, unknown>
      return [readable(item.quantity), readable(item.equipmentName) || readable(item.equipmentType)].filter(Boolean).join(' × ')
    }).filter(Boolean) : [])
const quoteTotals = computed(() => {
  const grouped = new Map<string, { cost: number; sale: number; completeCost: boolean; completeSale: boolean }>()
  for (const row of snapshotCosts.value) {
    const code = currency(row.currencyCode, row.currencyName)
    if (!code) return []
    const group = grouped.get(code) || { cost: 0, sale: 0, completeCost: true, completeSale: true }
    if (row.costAmount === null) group.completeCost = false
    else group.cost += row.costAmount
    if (row.saleAmount === null) group.completeSale = false
    else group.sale += row.saleAmount
    grouped.set(code, group)
  }
  return Array.from(grouped, ([code, group]) => ({ code, ...group }))
})
function comparisonValue(row: OperationsQuoteComparisonRow, side: 'quoted' | 'current') {
  const value = row[side]
  if (row.field === 'incoterm' && /^(EXW|FCA|FAS|FOB|CFR|CIF|CPT|CIP|DAP|DPU|DDP)$/.test(value || '')) return value!
  if (row.field === 'incoterm' && side === 'quoted') return openingField('incoterm', quoteData.value) || readable(value) || 'Por identificar'
  if (row.field === 'incoterm' && side === 'current') {
    try { return openingField('incoterm', JSON.parse(record.value?.openingDataJson || '{}')) || readable(value) || 'Por identificar' }
    catch { return 'Por identificar' }
  }
  return readable(value) || 'Por confirmar'
}
function comparisonStatusLabel(status: string) {
  return ({ MATCH: 'Coincide', CHANGED: 'Cambió', UNCONFIRMED: 'Por confirmar' } as Record<string, string>)[status] || 'Por confirmar'
}
function comparisonStatusVariant(status: string) {
  return status === 'MATCH' ? 'success' as const : status === 'CHANGED' ? 'danger' as const : 'warning' as const
}
const commercialSeverity = computed(() => {
  const severity = comparison.value?.severity || 'UNKNOWN'
  if (pendingCommercialAlerts.value.some(x => x.severity === 'RED') || severity === 'RED') return 'RED'
  if (pendingCommercialAlerts.value.length || severity === 'YELLOW') return 'YELLOW'
  return severity
})
const commercialLabel = computed(() => {
  if (confirmedHold.value) return 'HOLD · Trámite en espera'
  if (comparisonError.value) return 'No se pudo comparar'
  if (!comparison.value?.hasSnapshot) return 'Sin QUO comparable'
  if (commercialSeverity.value === 'RED') return comparison.value.currentReview?.status === 'REVIEWING'
    ? 'Recotización requerida' : comparison.value.currentReview?.status === 'REJECTED'
      ? 'Revisión rechazada · requiere atención' : 'Diferencias comerciales detectadas'
  if (commercialSeverity.value === 'YELLOW') return comparison.value.currentReview?.status === 'PENDING_PRICING' || pendingCommercialAlerts.value.length
    ? 'Pendiente de Pricing' : 'Datos por confirmar'
  if (commercialSeverity.value === 'GREEN') return comparison.value.currentReview?.status === 'RESOLVED_NO_PRICE_CHANGE' ? 'Conciliado por Pricing' : 'Sin diferencias en campos comparados'
  return 'Pendiente de comparación'
})
const commercialVariant = computed(() => confirmedHold.value ? 'danger' as const : commercialSeverity.value === 'GREEN' ? 'success' as const :
  commercialSeverity.value === 'RED' ? 'danger' as const : commercialSeverity.value === 'YELLOW' ? 'warning' as const : 'neutral' as const)
const pendingCommercialAlerts = computed(() =>
  commercialReviews.value?.alerts.filter(x =>
    x.severity !== 'GREEN' && x.status !== 'RESOLVED') ?? [])
const origin = ref<OperationsOriginProgress | null>(null)
const notes = ref<OperationsInternalNote[]>([])
const noteText = ref('')
const originStatus = ref('ORIGIN_COORDINATION')
const savingOrigin = ref(false)
const originWeightValue = ref('')
const originWeightUnit = ref('KG')
const originWeightSaving = ref(false)
const originWeightStale = ref(false)
const originPlanning = ref({ etd: '', eta: '', consolidationReference: '', clientPoReference: '', invoiceReference: '' })
const originPlanningBase = ref({ etd: '', eta: '', consolidationReference: '', clientPoReference: '', invoiceReference: '' })
const originPlanningSaving = ref(false)
const originPlanningStale = ref(false)
const originPlanningDirty = computed(() => JSON.stringify(originPlanning.value) !== JSON.stringify(originPlanningBase.value))
const originConsolidationApplicable = computed(() => ['LCL','LTL'].includes(record.value?.modalityCode || ''))
function hydrateOriginPlanning() {
  const data = openingData.value
  const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}/.test(String(value ?? '')) ? String(value).slice(0, 10) : ''
  originPlanningBase.value = { etd: date(data.etm), eta: date(data.eta), consolidationReference: originConsolidationApplicable.value ? String(data.consolidationReference ?? '') : '', clientPoReference: String(data.clientPoReference ?? ''), invoiceReference: String(data.invoiceReference ?? '') }
  originPlanning.value = { ...originPlanningBase.value }
  originPlanningStale.value = false
}
async function saveOriginPlanning() {
  const detail = record.value
  if (!detail || level('COORDINACION_ORIGEN') !== 'EDITABLE' || !originPlanningDirty.value || originPlanningStale.value || originPlanningSaving.value) return
  originPlanningSaving.value = true
  error.value = ''
  try {
    await operationsApi.updateOriginPlanning(detail.id, { expectedVersion: detail.version, ...originPlanning.value })
    if (caseId.value === detail.id) { await load(); message.value = 'Planificación de Origen actualizada.' }
  } catch (cause) {
    if (caseId.value === detail.id) { error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la planificación.'; originPlanningStale.value = true }
  } finally { originPlanningSaving.value = false }
}
const weightUnitOptions = [{ label: 'KG', value: 'KG' }, { label: 'LB', value: 'LB' }]
function weightKg(value: unknown, unit: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= 1e12 && (unit === 'KG' || unit === 'LB')
    ? n * (unit === 'LB' ? 0.45359237 : 1) : null
}
const estimatedWeightKg = computed(() => weightKg(openingData.value.estimatedWeightValue, openingData.value.estimatedWeightUnit))
const confirmedWeightKg = computed(() => weightKg(openingData.value.actualWeightValue, openingData.value.actualWeightUnit))
const pendingWeightKg = computed(() => weightKg(originWeightValue.value, originWeightUnit.value))
const weightDifference = computed(() => estimatedWeightKg.value != null && confirmedWeightKg.value != null
  ? confirmedWeightKg.value - estimatedWeightKg.value : null)
const weightDirty = computed(() => originWeightValue.value !== String(openingData.value.actualWeightValue ?? '') ||
  originWeightUnit.value !== String(openingData.value.actualWeightUnit ?? 'KG'))
function hydrateOriginWeight() {
  originWeightValue.value = String(openingData.value.actualWeightValue ?? '')
  originWeightUnit.value = String(openingData.value.actualWeightUnit ?? 'KG')
  originWeightStale.value = false
}
async function confirmOriginWeight() {
  const detail = record.value
  if (!detail || level('COORDINACION_ORIGEN') !== 'EDITABLE' || pendingWeightKg.value == null ||
      !weightDirty.value || originWeightStale.value || originWeightSaving.value) return
  originWeightSaving.value = true
  error.value = ''
  try {
    await operationsApi.confirmOriginWeight(detail.id, { expectedVersion: detail.version, value: Number(originWeightValue.value), unit: originWeightUnit.value })
    if (caseId.value !== detail.id) return
    await load()
    message.value = 'Peso real confirmado. El peso estimado se conserva.'
  } catch (cause) {
    if (caseId.value === detail.id) {
      error.value = cause instanceof Error ? cause.message : 'No se pudo confirmar el peso.'
      originWeightStale.value = true
    }
  } finally { originWeightSaving.value = false }
}
const originStatusChoices = computed(() => {
  const pickup = openingData.value.requiresPickup === true ? [{ label: 'Recolecta de carga', value: 'CARGO_PICKUP' }] : []
  switch (record.value?.modalityCode) {
    case 'FCL': return [
      { label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' },
      ...pickup,
      { label: 'Booking listo', value: 'BOOKING_READY' },
      { label: 'Carga en puerto de salida', value: 'PORT_OF_LOADING' },
    ]
    case 'LCL': return [
      { label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' },
      ...pickup,
      { label: 'Carga WHS Origen', value: 'ORIGIN_WAREHOUSE' },
      { label: 'Booking listo', value: 'BOOKING_READY' },
      { label: 'Carga en puerto de salida', value: 'PORT_OF_LOADING' },
    ]
    case 'AIR': return [
      { label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' },
      ...pickup,
      { label: 'Carga WHS Origen', value: 'ORIGIN_WAREHOUSE' },
      { label: 'Booking listo', value: 'BOOKING_READY' },
      { label: 'Carga en aeropuerto salida', value: 'DEPARTURE_AIRPORT' },
    ]
    case 'FTL': case 'MULTIMODAL': return [
      { label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' },
      ...pickup,
      { label: 'Preparando envío', value: 'PREPARING_DISPATCH' },
    ]
    case 'LTL': return [
      { label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' },
      ...pickup,
      { label: 'Carga WHS Origen', value: 'ORIGIN_WAREHOUSE' },
      { label: 'Preparando envío', value: 'PREPARING_DISPATCH' },
    ]
    default: return [{ label: 'Coordinación en Origen', value: 'ORIGIN_COORDINATION' }, ...pickup]
  }
})
const postingNote = ref(false)
const audit = ref<OperationsAudit[]>([])
const actors = ref<OperationsUser[]>([])
const accountName = ref('')
const clientExecutiveName = ref('')
const responsibleNames = ref<Record<string, string>>({})
const currentResponsibility = computed(() => workspace.value?.stages.find(s =>
  s.status === 'IN_PROGRESS') || workspace.value?.stages.find(s =>
  s.status === 'READY') || workspace.value?.stages.find(s => !['COMPLETED', 'SKIPPED'].includes(s.status)) || workspace.value?.stages[0])
const currentDepartmentStatus = computed(() => departmentStatusLabel(
  currentResponsibility.value?.departmentCode, currentResponsibility.value?.status,
  record.value?.status,
  currentResponsibility.value?.departmentCode === 'COORDINACION_ORIGEN'
    ? origin.value?.progress?.statusCode : null,
))
function responsibleName(id: string | null | undefined): string {
  return id ? responsibleNames.value[id] || 'Nombre pendiente de consulta' : 'Sin operativo asignado'
}
const { openingDocuments, downloadDocument, documentError } = useOpeningDocuments(() => openingData.value.supportDocuments)
const openingServices = computed(() => serviceLabels(openingData.value))
async function loadResponsibleNames(ids: Array<string | null | undefined>, current: number) {
  const uniques = [...new Set(ids.filter((x): x is string => Boolean(x)))]
  if (!uniques.length || !auth.hasScope('operations.audit.read')) return
  try {
    const found = await operationsApi.auditActors(uniques)
    if (current === sequence) responsibleNames.value = {
      ...responsibleNames.value,
      ...Object.fromEntries(found.items.map(p => [p.id, p.displayName || p.userName])),
    }
  } catch { /* A missing Auth display name must not hide the expediente. */ }
}
const selectedTab = ref<OperationsTabCode>('RESUMEN')
const editing = ref(false)
const serverChangedWhileEditing = ref(false)
const edit = ref<OperationsOpeningEdit>({
  expectedVersion: 0, modalityCode: 'FCL', priority: 1,
  complexityPoints: 1, originCountryCode: null, destinationCountryCode: null,
})
const tabs: Array<{ code: OperationsTabCode; label: string }> = [
  { code: 'RESUMEN', label: 'Resumen' },
  { code: 'QUO', label: 'QUO' },
  { code: 'COORDINACION_ORIGEN', label: 'Coordinación Origen' },
  { code: 'DOCUMENTACION', label: 'Documentación' },
  { code: 'TRANSITO', label: 'Tránsito' },
  { code: 'PANAMA', label: 'Panamá' },
  { code: 'COSTA_RICA', label: 'Costa Rica' },
  { code: 'FINANZAS', label: 'Finanzas' },
]
const modalityOptions = [
  { label: 'FCL', value: 'FCL' }, { label: 'LCL', value: 'LCL' },
  { label: 'FTL', value: 'FTL' }, { label: 'LTL', value: 'LTL' },
  { label: 'Aéreo', value: 'AIR' }, { label: 'Multimodal', value: 'MULTIMODAL' },
]
const level = (code: OperationsTabCode): OperationsTabLevel =>
  access.value.find(tab => tab.code === code)?.accessLevel ?? 'LOCKED'
const caseTabItems = computed(() => tabs.map(tab => ({
  key: tab.code,
  label: tab.label,
  disabled: level(tab.code) === 'LOCKED' || level(tab.code) === 'NOT_APPLICABLE',
  title: level(tab.code) === 'EDITABLE' ? 'Editable según permisos' : level(tab.code) === 'READ_ONLY' ? 'Solo lectura' : level(tab.code) === 'NOT_APPLICABLE' ? 'No aplica' : 'Aún no habilitado',
})))
function selectCaseTab(key: string) {
  const tab = tabs.find(item => item.code === key)
  if (!tab || level(tab.code) === 'LOCKED' || level(tab.code) === 'NOT_APPLICABLE') return
  selectedTab.value = tab.code
  editing.value = false
}
const canEditSummary = computed(() => level('RESUMEN') === 'EDITABLE')
const currentStage = computed(() =>
  workspace.value?.stages.find(s => s.departmentCode === selectedTab.value))
const currentTasks = computed(() =>
  workspace.value?.tasks.filter(t => currentStage.value && t.caseStageId === currentStage.value.id) ?? [])
const currentMilestones = computed(() =>
  workspace.value?.milestones.filter(m => currentStage.value && m.caseStageId === currentStage.value.id) ?? [])
const canWriteNote = computed(() =>
  level('COORDINACION_ORIGEN') === 'EDITABLE' &&
  auth.hasScope('operations.internal-note.create'))
const isoValid = (code: string | null) => !code?.trim() || /^[A-Z]{2}$/i.test(code.trim())
const validEdit = computed(() => (
  edit.value.modalityCode &&
  edit.value.priority >= 1 && edit.value.priority <= 5 &&
  Number.isInteger(edit.value.priority) &&
  edit.value.complexityPoints >= 0.5 && edit.value.complexityPoints <= 1000 &&
  isoValid(edit.value.originCountryCode) && isoValid(edit.value.destinationCountryCode)
))
function statusLabel(value: string | null | undefined) {
  return operationsLabel(value)
}
function dateLabel(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-CR')
}
function captureEdit(detail: OperationsCaseDetail) {
  edit.value = {
    expectedVersion: detail.version, modalityCode: detail.modalityCode,
    priority: detail.priority, complexityPoints: detail.complexityPoints,
    originCountryCode: detail.originCountryCode,
    destinationCountryCode: detail.destinationCountryCode,
  }
}
let sequence = 0
let leaving = false
async function leaveApprovedCase() {
  if (leaving) return
  leaving = true
  ++sequence
  const key = workspaceTabKey(route.fullPath)
  record.value = null
  workspace.value = null
  access.value = []
  workspaceTabs.closeTab(key)
  await router.replace({ path: '/operations/cases' })
}
async function load() {
  if (!caseId.value || leaving) return
  const current = ++sequence
  loading.value = true
  error.value = ''
  message.value = ''
  editing.value = false
  serverChangedWhileEditing.value = false
  reviewDraftChanged.value = false
  try {
    const [detail, work, tabResponse] = await Promise.all([
      operationsApi.caseDetail(caseId.value),
      operationsApi.caseWorkspace(caseId.value),
      operationsApi.caseTabs(caseId.value),
    ])
    if (current !== sequence) return
    record.value = detail
    workspace.value = work
    access.value = tabResponse.tabs
    hydrateOriginWeight()
    hydrateOriginPlanning()
    captureEdit(detail)
    if (level(selectedTab.value) === 'LOCKED' || level(selectedTab.value) === 'NOT_APPLICABLE')
      selectedTab.value = tabs.find(tab => ['EDITABLE', 'READ_ONLY'].includes(level(tab.code)))?.code ?? 'RESUMEN'

    // Optional reads are scoped individually; an unauthorized panel must not
    // prevent opening the whole expediente.
    const optional: Promise<unknown>[] = []
    completeness.value = null
    completenessError.value = false
    if (!hasAperturePanel.value) optional.push(operationsApi.openingCompleteness(detail.id)
      .then(x => { if (current === sequence) completeness.value = x })
      .catch(() => { if (current === sequence) completenessError.value = true }))
    costs.value = []
    snapshotCosts.value = []
    commercialConditions.value = null
    costError.value = false
    supplemental.value = {}
    optional.push(sameRevisionCommercialData(work).then(x => { if (current === sequence) supplemental.value = x }))
    commercialReviews.value = null
    contacts.value = []
    contactsError.value = false
    contactsLoading.value = true
    comparison.value = null
    comparisonError.value = false
    optional.push(operationsApi.caseContacts(caseId.value)
      .then(x => { if (current === sequence) contacts.value = Array.isArray(x) ? x : [] })
      .catch(() => { if (current === sequence) contactsError.value = true })
      .finally(() => { if (current === sequence) contactsLoading.value = false }))
    if (detail.sourceQuoteId) optional.push(operationsApi.caseQuoteComparison(caseId.value)
      .then(x => { if (current === sequence) comparison.value = x })
      .catch(() => { if (current === sequence) comparisonError.value = true }))
    origin.value = null
    notes.value = []
    audit.value = []
    actors.value = []
    accountName.value = ''
    clientExecutiveName.value = ''
    responsibleNames.value = { ...(work.people || {}) }
    optional.push(loadResponsibleNames([
      detail.createdBy, detail.executiveUserId,
      ...work.stages.map(s => s.assignedUserId),
      ...work.stages.flatMap(s => s.supervisorUserIds || []),
      ...(work.validators || []).map(v => v.userId),
      ...work.tasks.map(t => t.assignedUserId),
    ], current))
    optional.push(operationsApi.caseServicesAndReviews(caseId.value)
      .then(x => { if (current === sequence) commercialReviews.value = x })
      .catch(() => { /* Commercial panel has its own scope; no fake success. */ }))
    if (auth.hasScope('operations.cost.read')) optional.push(
      operationsApi.caseCosts(caseId.value).then(x => { if (current === sequence) { costs.value = x.items; snapshotCosts.value = x.snapshotItems || []; commercialConditions.value = x.conditions || null } }).catch(() => { if (current === sequence) costError.value = true }))
    if (auth.hasScope('operations.origin.read') &&
        work.stages.some(s => s.departmentCode === 'COORDINACION_ORIGEN')) optional.push(
      operationsApi.caseOriginProgress(caseId.value).then(x => { if (current === sequence) { origin.value = x; originStatus.value = x.progress?.statusCode || 'ORIGIN_COORDINATION' } }).catch(() => {}))
    if (auth.hasScope('operations.internal-note.read') &&
        work.stages.some(s => s.departmentCode === 'COORDINACION_ORIGEN')) optional.push(
      operationsApi.caseInternalNotes(caseId.value).then(x => { if (current === sequence) notes.value = x }).catch(() => {}))
    if (auth.hasScope('operations.audit.read')) optional.push(
      operationsApi.caseAudit(caseId.value).then(async x => {
        if (current !== sequence) return
        audit.value = x
        const people = await operationsApi.auditActors(x.map(e => e.actorUserId))
        if (current === sequence) actors.value = people.items
      }).catch(() => {}))
    optional.push(crmRequest<Record<string, unknown>>(crmPath('operations/accounts', detail.accountId))
      .then(x => { if (current === sequence) {
        accountName.value = String(x.displayName || x.legalName || x.name || '').trim()
        clientExecutiveName.value = String(x.executiveName || '').trim()
      } }).catch(() => {}))
    await Promise.all(optional)
  } catch (cause) {
    if (current === sequence) {
      record.value = null
      workspace.value = null
      access.value = []
      commercialReviews.value = null
      error.value = cause instanceof Error ? cause.message : 'No se pudo abrir el expediente.'
    }
  } finally { if (current === sequence) loading.value = false }
}
async function saveEdit() {
  if (!record.value || !canEditSummary.value || !validEdit.value || saving.value) return
  if (serverChangedWhileEditing.value) { error.value = 'Primero recargue los cambios realizados por otro usuario.'; return }
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    await operationsApi.updateCase(record.value.id, {
      ...edit.value,
      originCountryCode: edit.value.originCountryCode?.trim().toUpperCase() || null,
      destinationCountryCode: edit.value.destinationCountryCode?.trim().toUpperCase() || null,
    })
    await load()
    message.value = 'Cambios de Aperturas guardados y auditados correctamente.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo actualizar el expediente. Actualice antes de volver a intentarlo.'
  } finally { saving.value = false }
}
async function saveOriginStatus() {
  if (!record.value || !origin.value || level('COORDINACION_ORIGEN') !== 'EDITABLE' || savingOrigin.value) return
  savingOrigin.value = true
  error.value = ''
  try {
    await operationsApi.updateOriginStatus(record.value.id, originStatus.value, origin.value.progress?.version ?? 0)
    await load()
    message.value = 'Estado de Coordinación Origen actualizado y auditado.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar el estado de Origen.'
  } finally { savingOrigin.value = false }
}
async function requestCommercialReview() {
  const selected = comparison.value
  const id = record.value?.id
  if (!id || !selected?.canRequest || selected.currentReview || !discrepancyCount.value ||
      requestingReview.value || reviewDraftChanged.value || !reviewComment.value.trim() || reviewComment.value.trim().length > 300) return
  requestingReview.value = true
  error.value = ''
  try {
    await operationsApi.requestQuoteReview(id, {
      expectedVersion: selected.version, fingerprint: selected.fingerprint, comment: reviewComment.value.trim(),
    })
    if (caseId.value !== id) return
    reviewComment.value = ''
    await load()
    message.value = 'Diferencias registradas; solicitud registrada para envío a Pricing.'
  } catch (cause) {
    if (caseId.value === id) error.value = cause instanceof Error ? cause.message : 'No se pudo enviar la revisión. Actualice y verifique las diferencias.'
  } finally { requestingReview.value = false }
}
async function addNote() {
  if (!record.value || !canWriteNote.value || !noteText.value.trim() || postingNote.value) return
  postingNote.value = true
  error.value = ''
  try {
    await operationsApi.addCaseInternalNote(record.value.id, noteText.value.trim())
    notes.value = await operationsApi.caseInternalNotes(record.value.id)
    noteText.value = ''
    message.value = 'Nota privada registrada.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la nota.'
  } finally { postingNote.value = false }
}
useOperationsCaseRealtime(caseId, () => {
  if (originPlanningDirty.value || originPlanningSaving.value) { originPlanningStale.value = true; return }
  if (weightDirty.value || originWeightSaving.value) {
    originWeightStale.value = true
    return
  }
  if (requestingReview.value || reviewComment.value.trim()) {
    reviewDraftChanged.value = true
    return
  }
  if (editing.value || saving.value) {
    serverChangedWhileEditing.value = true
    return
  }
  void load()
})
watch([caseId, () => auth.userId], () => { leaving = false; ++sequence; access.value = []; record.value = null; workspace.value = null; selectedTab.value = 'RESUMEN'; comparisonFilter.value = 'ALL'; reviewComment.value = ''; reviewDraftChanged.value = false; void load() }, { immediate: true })
</script>

<template>
  <div class="mx-auto w-full max-w-[1700px] space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <div class="flex items-center">
      <RouterLink to="/operations/cases" class="inline-flex items-center gap-2 text-sm font-bold text-[var(--dh-primary)] hover:underline">
        <ArrowLeft class="h-4 w-4" /> Todos los trámites
      </RouterLink>
    </div>
    <DhPageHeader :title="record?.idtra || 'Expediente operativo'" subtitle="Centro de control operativo" :icon="FolderOpen" :hide-excel-export="true">
      <template #actions>
        <DhBadge v-if="record" :variant="confirmedHold ? 'danger' : 'primary'">{{ confirmedHold ? 'HOLD · En espera' : currentDepartmentStatus }}</DhBadge>
        <DhBadge v-if="record?.sourceQuoteId" :variant="commercialVariant">{{ commercialLabel }}</DhBadge>
        <DhButton variant="secondary" :icon="RefreshCw" label="Actualizar" :loading="loading" @click="load" />
        <RouterLink v-if="record && canEditSummary && selectedTab === 'RESUMEN'" :to="{ name: 'operations-case-edit', params: { id: record.id } }">
          <DhButton :icon="Pencil" label="Completar o modificar apertura" />
        </RouterLink>
      </template>
    </DhPageHeader>
    <div v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{{ error }}</div>
    <div v-if="serverChangedWhileEditing" role="alert" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
      Otro usuario modificó el trámite. Actualice para revisar la nueva versión antes de guardar.
      <DhButton size="sm" variant="secondary" label="Recargar" @click="serverChangedWhileEditing = false; load()" />
    </div>
    <div v-if="message" role="status" class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{{ message }}</div>
    <div v-if="pendingCommercialAlerts.length" role="alert" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
      <strong>Revisión comercial pendiente:</strong> {{ pendingCommercialAlerts.length }} servicio(s) o diferencia(s) requieren seguimiento en Pricing.
      <span class="ml-2">La QUO original permanece sin modificaciones.</span>
    </div>
    <div v-if="loading" class="rounded-2xl bg-[var(--dh-input)] p-8 text-center text-[var(--dh-text-muted)]">Cargando expediente operativo…</div>

    <template v-if="record && workspace && !loading">
      <DhCard v-if="confirmedHold" padding="sm" title="Trámite en HOLD" subtitle="Estado informado por Operations. Consulta el seguimiento comercial antes de continuar.">
        <div class="flex flex-wrap items-center justify-between gap-3" role="status">
          <DhBadge variant="danger">HOLD · En espera</DhBadge>
          <DhButton v-if="record.sourceQuoteId && canOpenComparison" variant="secondary" size="sm" label="Consultar revisión comercial" @click="selectCaseTab('QUO')" />
        </div>
      </DhCard>
      <DhCard padding="sm"><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="min-w-0">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Cliente</p>
          <p class="mt-1 break-words font-bold">{{ accountName || String(openingData.clientName || '') || 'Nombre pendiente de CRM' }}</p>
          <p class="mt-1 break-words text-xs text-[var(--dh-text-muted)]">Ejecutivo: {{ clientExecutiveName || String(openingData.executiveName || '') || responsibleName(record.executiveUserId) }}</p>
          <RouterLink :to="`/crm/accounts/${record.accountId}`" class="text-xs text-[var(--dh-primary)] hover:underline">Consultar cuenta CRM</RouterLink>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Ruta y procedencia</p>
          <div class="mt-1 flex flex-wrap gap-1"><DhBadge variant="primary">{{ record.modalityCode }}</DhBadge><DhBadge variant="neutral">{{ record.apertureType === 'AUTOMATIC' ? 'Automática' : 'Manual' }}</DhBadge><DhBadge v-if="openingField('incoterm', openingData)" variant="neutral">{{ openingField('incoterm', openingData) }}</DhBadge></div>
          <p class="mt-2 break-words text-sm font-semibold">{{ openingData.pol || countryLabel(record.originCountryCode, openingData.pol) || 'Pendiente' }} → {{ openingData.pod || countryLabel(record.destinationCountryCode, openingData.pod) || 'Pendiente' }}</p>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Departamento y responsable</p>
          <p class="mt-1 font-bold">{{ statusLabel(currentResponsibility?.departmentCode) }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ currentResponsibility?.teamName || 'Equipo por asignar' }}</p>
          <p class="mt-1 text-xs font-semibold">{{ responsibleName(currentResponsibility?.assignedUserId) }}</p>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-[var(--dh-text-muted)]">Estado operativo</p>
          <DhBadge class="mt-1" :variant="confirmedHold ? 'danger' : 'primary'">{{ confirmedHold ? 'HOLD · En espera' : currentDepartmentStatus }}</DhBadge>
          <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Actualizado: {{ dateLabel(record.updatedAtUtc) }}</p>
          <p class="text-xs text-[var(--dh-text-muted)]">Versión {{ record.version }}</p>
        </div>
      </div></DhCard>

      <OperationsApertureValidationPanel
        v-if="record.apertureType === 'AUTOMATIC' && (record.status === 'PENDING_VALIDATION' || record.status === 'APERTURA_REQUIERE_CAMBIOS')"
        :case-id="record.id"
        :version="record.version"
        :can-edit="canEditSummary"
        @updated="load"
        @approved="leaveApprovedCase"
      />
      <DhTabs :model-value="selectedTab" :items="caseTabItems" aria-label="Departamentos del expediente" @update:model-value="selectCaseTab">
        <template #label="{ item }">
          <span class="inline-flex items-center gap-2">
            <LockKeyhole v-if="level(item.key as OperationsTabCode) === 'LOCKED'" class="h-3.5 w-3.5" />
            {{ item.label }}
            <span v-if="level(item.key as OperationsTabCode) === 'NOT_APPLICABLE'" class="text-xs">N/A</span>
          </span>
        </template>
      </DhTabs>

      <div v-if="selectedTab === 'RESUMEN'" class="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div class="min-w-0 space-y-4">
          <DhCard padding="sm" title="Información logística">
            <div class="mb-4 border-b border-[var(--dh-border)] pb-3">
              <h4 class="mb-2 text-sm font-semibold">Servicios contratados y operativos</h4>
              <div class="flex flex-wrap gap-2"><DhBadge v-for="service in openingServices" :key="service" variant="neutral">{{ service }}</DhBadge><span v-if="!openingServices.length" class="text-xs text-[var(--dh-text-muted)]">Sin servicios registrados</span></div>
            </div>
            <div class="space-y-4">
              <section v-for="section in openingSections.filter(section => section.rows.length)" :key="section.title">
                <h4 class="mb-2 text-sm font-bold">{{ section.title }}</h4>
                <div class="grid gap-x-5 gap-y-1 sm:grid-cols-2 2xl:grid-cols-3">
                  <div v-for="field in section.rows" :key="field.label" class="min-w-0 border-b border-[var(--dh-border)] py-2">
                    <p class="text-xs text-[var(--dh-text-muted)]">{{ field.label }}</p>
                    <p class="mt-1 break-words text-sm font-semibold">{{ field.value }}</p>
                  </div>
                </div>
              </section>
            </div>
            <div v-if="Array.isArray(openingData.equipment) && openingData.equipment.length" class="mt-4">
              <h4 class="mb-2 text-sm font-semibold">Equipos</h4>
              <div v-for="(item, index) in openingData.equipment" :key="index" class="mb-1 rounded-lg bg-[var(--dh-input)] px-3 py-2 text-sm">
                {{ (item as { quantity: number; equipmentType: string }).quantity }} × {{ (item as { equipmentType: string }).equipmentType }}
              </div>
            </div>
            <div class="mt-4 border-t border-[var(--dh-border)] pt-3">
              <h4 class="mb-2 text-sm font-semibold">Documentación ({{ openingDocuments.length }})</h4>
              <p v-if="!openingDocuments.length" class="text-xs text-[var(--dh-text-muted)]">Sin adjuntos de apertura.</p>
              <div v-for="document in openingDocuments" :key="document.id" class="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span class="break-words">{{ document.label }} · {{ document.fileName }}</span>
                <DhButton v-if="document.storageId" size="sm" variant="secondary" label="Descargar" @click="downloadDocument(document)" />
              </div>
              <p v-if="documentError" role="alert" class="text-xs text-[var(--dh-text-muted)]">{{ documentError }}</p>
            </div>
          </DhCard>
          <DhCard padding="sm" title="Departamentos y responsables" subtitle="Etapas, equipos, operativos y validadores del expediente.">
            <div v-for="stage in workspace.stages" :key="stage.id" class="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] p-3 last:mb-0">
              <div>
                <p class="text-sm font-bold">{{ statusLabel(stage.departmentCode) }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">Equipo: {{ stage.teamName || 'Por asignar' }}</p>
                <p v-if="stage.departmentCode !== 'APERTURAS'" class="mt-1 text-xs font-semibold">Operativo: {{ responsibleName(stage.assignedUserId) }}</p>
                <p v-if="stage.supervisorUserIds?.length" class="mt-1 text-xs text-[var(--dh-text-soft)]">
                  Supervisión: {{ stage.supervisorUserIds.map(id => responsibleName(id)).join(', ') }}
                </p>
                <p v-if="stage.assignedAtUtc" class="mt-1 text-xs text-[var(--dh-text-muted)]">Asignación: {{ dateLabel(stage.assignedAtUtc) }}</p>
                <p v-for="reviewer in (workspace.validators || []).filter(v => v.caseStageId === stage.id)"
                  :key="reviewer.userId" class="mt-1 text-xs text-[var(--dh-text-soft)]">
                  Validador {{ reviewer.slot }}: {{ responsibleName(reviewer.userId) }} · {{ statusLabel(reviewer.status) }}
                  <span v-if="reviewer.reviewedAtUtc">· {{ dateLabel(reviewer.reviewedAtUtc) }}</span>
                </p>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Inicio: {{ dateLabel(stage.startedAtUtc) }} · Finalización: {{ dateLabel(stage.completedAtUtc) }}</p>
              </div>
              <DhBadge variant="neutral">{{ departmentStatusLabel(stage.departmentCode, stage.status, record.status, stage.departmentCode === 'COORDINACION_ORIGEN' ? origin?.progress?.statusCode : null) }}</DhBadge>
            </div>
            <p v-if="!workspace.stages.length" class="text-sm text-[var(--dh-text-muted)]">No hay departamentos asignados.</p>
          </DhCard>
          <DhCard padding="sm" :icon="ClipboardList" title="Datos de apertura">
            <div v-if="editing && canEditSummary" class="space-y-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <DhSelect v-model="edit.modalityCode" label="Modalidad" :options="modalityOptions" />
                <DhInput v-model="edit.originCountryCode" label="País de origen (ISO)" placeholder="CR" />
                <DhInput v-model="edit.destinationCountryCode" label="País de destino (ISO)" placeholder="HN" />
              </div>
              <p class="text-xs text-[var(--dh-text-muted)]">Los cambios se auditan y requieren la versión vigente. Cliente, ejecutivo y QUO aceptada no se modifican desde este formulario.</p>
              <div class="flex justify-end gap-2">
                <DhButton variant="secondary" label="Cancelar" @click="editing = false; captureEdit(record)" />
                <DhButton :icon="Save" label="Guardar cambios" :loading="saving" :disabled="!validEdit" @click="saveEdit" />
              </div>
            </div>
            <div v-else class="grid gap-x-5 gap-y-1 sm:grid-cols-2 2xl:grid-cols-3">
              <div v-for="item in [
                { key: 'Tipo de apertura', value: record.apertureType === 'AUTOMATIC' ? 'Automática · Pricing' : 'Manual' },
                { key: 'PO / referencia cliente', value: openingData.clientPoReference || 'Sin referencia' },
                { key: 'División CRM', value: openingData.crmDivisionName || 'No registrada' },
                { key: 'Creado', value: dateLabel(record.createdAtUtc) },
                { key: 'Creado por', value: responsibleName(record.createdBy) },
              ]" :key="item.key" class="min-w-0 border-b border-[var(--dh-border)] py-2">
                <p class="text-xs text-[var(--dh-text-muted)]">{{ item.key }}</p>
                <p class="mt-1 break-words text-sm font-bold">{{ item.value }}</p>
              </div>
            </div>
          </DhCard>
          <DhCard padding="sm" title="Contactos del cliente" subtitle="Encargados de operaciones activos en CRM, asociados a este cliente.">
            <p v-if="contactsLoading" class="text-sm text-[var(--dh-text-muted)]">Consultando CRM…</p>
            <p v-else-if="contactsError" role="alert" class="text-sm text-[var(--dh-text-muted)]">No se pudieron consultar los contactos. Actualice el expediente para reintentar.</p>
            <p v-else-if="!contacts.length" class="text-sm text-[var(--dh-text-muted)]">El cliente no tiene contactos operativos activos registrados.</p>
            <div v-else class="grid gap-3 sm:grid-cols-2">
              <div v-for="contact in contacts" :key="contact.id" class="min-w-0 border-b border-[var(--dh-border)] py-2">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="break-words text-sm font-bold">{{ contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Nombre no registrado' }}</p>
                  <DhBadge v-if="contact.isPrimary" variant="primary">Principal</DhBadge>
                  <DhBadge v-if="selectedContacts.has(contact.id)" variant="neutral">En apertura</DhBadge>
                  <DhBadge v-for="division in contact.divisions || []" :key="division.id" variant="neutral">{{ division.name }}</DhBadge>
                </div>
                <p v-if="contact.jobTitle" class="text-xs text-[var(--dh-text-muted)]">{{ contact.jobTitle }}</p>
                <p class="mt-1 break-all text-sm">{{ contact.email || 'Correo no registrado' }}</p>
                <p class="break-words text-xs text-[var(--dh-text-muted)]">{{ contact.phone || 'Teléfono no registrado' }}</p>
              </div>
            </div>
          </DhCard>
        </div>
        <div class="min-w-0 space-y-4">
          <DhCard padding="sm" title="Cotización y seguimiento comercial">
            <RouterLink v-if="record.sourceQuoteId" :to="`/pricing/rates/${record.sourceQuoteOptionId || record.sourceQuoteId}/wizard?mode=view`" class="font-bold text-[var(--dh-primary)] hover:underline">{{ workspace.quotes.find(quote => quote.isPrimary)?.quoteNumber || workspace.quotes[0]?.quoteNumber || 'Abrir QUO en Pricing' }}</RouterLink>
            <p v-else class="text-sm text-[var(--dh-text-muted)]">{{ pendingQuoteLink ? 'Vinculación pendiente de confirmación' : 'Sin cotización vinculada' }}</p>
            <DhButton v-if="canLinkQuote && !record.sourceQuoteId" size="sm" variant="secondary" label="Vincular QUO" class="mt-3" @click="selectCaseTab('QUO')" />
            <div v-if="record.sourceQuoteId" class="mt-3 space-y-2">
              <DhBadge :variant="commercialVariant">{{ commercialLabel }}</DhBadge>
              <div v-if="comparison?.hasSnapshot" class="flex flex-wrap gap-2">
                <DhBadge variant="success">{{ comparisonCounts.match }} coinciden</DhBadge>
                <DhBadge variant="warning">{{ unconfirmedCount }} por confirmar</DhBadge>
                <DhBadge variant="danger">{{ discrepancyCount }} diferencias</DhBadge>
              </div>
              <p v-if="comparison?.currentReview" class="text-xs text-[var(--dh-text-muted)]">Pricing: {{ statusLabel(comparison.currentReview.status) }}</p>
              <DhButton v-if="canOpenComparison" size="sm" variant="secondary" label="Comparar con la QUO" @click="selectCaseTab('QUO')" />
            </div>
          </DhCard>
          <DhCard v-if="!hasAperturePanel" title="Validación de apertura" padding="sm">
            <p v-if="completenessError" role="alert" class="text-xs text-[var(--dh-text-muted)]">No se pudieron consultar los estados.</p>
            <p v-else-if="!completeness" class="text-xs text-[var(--dh-text-muted)]">Consultando estados…</p>
            <template v-else>
              <DhBadge :variant="completeness.missingFields.length ? 'danger' : 'success'">{{ completeness.missingFields.length ? completeness.missingFields.length + ' bloqueantes' : 'Sin campos bloqueantes' }}</DhBadge>
              <DhTabs v-model="completenessGroup" :items="completenessTabs" aria-label="Estados de apertura" class="mt-3" />
              <div class="mt-2 max-h-72 overflow-y-auto dh-scrollbar">
                <div v-for="field in visibleCompleteness" :key="field.id" class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dh-border)] py-2">
                  <div class="min-w-0 flex-1"><p class="text-xs font-medium">{{ field.label }}</p><p v-if="field.reason" class="mt-1 break-words text-xs text-[var(--dh-text-muted)]">{{ field.reason }}</p></div>
                  <DhBadge :variant="openingStatusVariant(field.completionStatus)">{{ openingStatusLabel(field.completionStatus) }}</DhBadge>
                </div>
                <p v-if="!visibleCompleteness.length" class="py-3 text-xs text-[var(--dh-text-muted)]">No hay campos en este estado.</p>
              </div>
            </template>
          </DhCard>
          <DhCard padding="sm" :title="'Tareas pendientes (' + pendingSummaryTasks.length + ')'">
            <div v-for="task in pendingSummaryTasks" :key="task.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3 text-sm last:mb-0">
              <p class="font-bold">{{ task.title }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">{{ statusLabel(task.status) }} · {{ dateLabel(task.dueAtUtc) }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">Responsable: {{ responsibleName(task.assignedUserId) }}</p>
            </div>
            <p v-if="!pendingSummaryTasks.length" class="text-sm text-[var(--dh-text-muted)]">No hay tareas pendientes.</p>
          </DhCard>
          <DhCard v-if="auth.hasScope('operations.audit.read')" padding="sm" title="Historial y trazabilidad">
            <OperationsAuditTimeline :events="audit" :users="actors" empty-title="Sin movimientos" empty-description="Todavía no hay eventos registrados." />
          </DhCard>
          <DhCard padding="sm" title="Permisos de consulta">
            <p class="text-sm text-[var(--dh-text-soft)]">{{ canEditSummary ? 'Aperturas editable mientras esté pendiente de validación; el backend comprueba cada cambio.' : 'Consulta habilitada. La edición depende de la etapa, su estado y el permiso específico.' }}</p>
            <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Un superusuario puede consultar todos los departamentos, incluso los que aún no han iniciado, sin generar etapas ficticias.</p>
          </DhCard>
        </div>
      </div>

      <div v-else-if="selectedTab === 'QUO'" class="space-y-4">
        <DhCard v-if="canLinkQuote" :icon="FileText" title="Agregar QUO al expediente" subtitle="Busca una cotización aceptada del mismo cliente y tipo de embarque. El IDTRA actual se conserva.">
          <template #actions><DhBadge :variant="pendingQuoteLink ? 'warning' : 'neutral'">{{ pendingQuoteLink ? 'Vinculación pendiente' : 'Sin QUO' }}</DhBadge></template>
          <p v-if="pendingQuoteLink" class="text-sm"><DhBadge variant="warning">Pendiente de confirmación de Pricing</DhBadge></p>
          <template v-else>
            <form class="flex flex-wrap items-end gap-3" @submit.prevent="searchAcceptedQuotes">
              <div class="min-w-0 flex-1"><DhInput v-model="quoteSearch" label="Buscar cotización" placeholder="Número de QUO" /></div>
              <DhButton type="submit" label="Buscar" :loading="quoteLinkBusy" :disabled="!quoteSearch.trim()" />
            </form>
            <div v-if="quoteCandidates.length" class="mt-3 space-y-3">
              <DhSelect searchable v-model="quoteSelection" label="Cotización" placeholder="Seleccionar QUO" :options="quoteCandidates.map(rate => ({ value: rate.id, label: [rate.quoNumber || rate.rateCode, rate.polName + ' → ' + (rate.podName || rate.poeName), rate.idtraNumber].filter(Boolean).join(' · ') }))" />
              <DhCard v-if="selectedQuoteCandidate" padding="sm">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="font-semibold">{{ selectedQuoteCandidate.quoNumber || selectedQuoteCandidate.rateCode }}</p>
                    <p class="text-sm text-[var(--dh-text-muted)]">{{ selectedQuoteCandidate.clientName || 'Cliente del expediente' }} · {{ selectedQuoteCandidate.shipmentMode }}</p>
                  </div>
                  <DhBadge variant="success">Aceptada</DhBadge>
                </div>
                <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt class="text-xs text-[var(--dh-text-muted)]">Ruta</dt><dd>{{ selectedQuoteCandidate.polName }} → {{ selectedQuoteCandidate.podName || selectedQuoteCandidate.poeName }}</dd></div>
                  <div><dt class="text-xs text-[var(--dh-text-muted)]">IDTRA existentes</dt><dd>{{ selectedQuoteCandidate.idtraNumber || 'Sin IDTRA registrado' }}</dd></div>
                </dl>
                <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p class="text-xs text-[var(--dh-text-muted)]">Se mantiene el IDTRA del expediente y la información operativa existente.</p>
                  <DhButton label="Vincular QUO" :loading="quoteLinkBusy" :disabled="!quoteSelection" @click="requestQuoteLink" />
                </div>
              </DhCard>
            </div>
          </template>
          <p v-if="quoteLinkMessage" class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ quoteLinkMessage }}</p>
          <p v-if="quoteLinkError" role="alert" class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ quoteLinkError }}</p>
        </DhCard>
        <DhCard :icon="FileText" title="Cotización vinculada" subtitle="Referencia comercial original e independiente del trámite.">
          <p v-if="record.apertureType === 'MANUAL' && record.sourceQuoteId" class="mb-3 text-xs text-[var(--dh-text-muted)]">Los rubros representan la QUO completa, no una distribución financiera por IDTRA. Los datos de apertura manual se mantienen separados.</p>
          <div v-for="quote in workspace.quotes" :key="quote.id" class="mb-3 rounded-xl border border-[var(--dh-border)] p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="font-black">{{ quote.quoteNumber || (quote.status === 'PENDING_LINK' ? 'Solicitud de vinculación' : 'Solicitud no confirmada') }}</p>
                <p class="text-xs text-[var(--dh-text-muted)]">{{ quote.status === 'ACCEPTED' ? 'Revisión ' + quote.snapshotVersion : quote.status === 'PENDING_LINK' ? 'Pendiente de confirmación' : 'Vinculación rechazada' }}</p>
              </div>
              <RouterLink :to="`/pricing/rates/${quote.quoteOptionId || quote.quoteId}/wizard?mode=view`" class="text-sm font-bold text-[var(--dh-primary)] hover:underline">Ver en Pricing</RouterLink>
            </div>
            <p v-if="quote.status === 'ACCEPTED' && quote.quoteOptionId" class="mt-2 text-xs text-[var(--dh-text-muted)]">Opción aceptada vinculada · Consultar detalle en Pricing</p>
          </div>
          <p v-if="!workspace.quotes.length" class="text-sm text-[var(--dh-text-muted)]">
            {{ record.sourceQuoteId ? 'La cotización aún no tiene un snapshot comercial disponible en Operations.' : 'Sin cotización · La apertura fue creada sin cotización.' }}
          </p>
          <template v-if="workspace.commercialData">
            <div class="grid gap-x-5 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
              <div v-for="field in quoteFields" :key="field.label" class="min-w-0 border-b border-[var(--dh-border)] py-2">
                <p class="text-xs text-[var(--dh-text-muted)]">{{ field.label }}</p>
                <p class="mt-1 break-words text-sm font-semibold">{{ field.value }}</p>
              </div>
            </div>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p class="mb-2 text-sm font-semibold">Mercancía y equipos cotizados</p>
                <p class="text-sm">{{ readable(quoteData.packageCount) || '—' }} bultos · {{ readable(quoteData.weightValue) || '—' }} kg · {{ readable(quoteData.volumeValue) || '—' }} CBM</p>
                <p v-if="quoteEquipment.length" class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ quoteEquipment.join(' · ') }}</p>
              </div>
              <div>
                <p class="mb-2 text-sm font-semibold">Servicios cotizados</p>
                <div v-if="quoteServices.length" class="flex flex-wrap gap-2"><DhBadge v-for="service in quoteServices" :key="service" variant="neutral">{{ service }}</DhBadge></div>
                <p v-else class="text-xs text-[var(--dh-text-muted)]">Sin servicios en el snapshot.</p>
              </div>
            </div>
            <div v-if="quoteTotals.length" class="mt-4 border-t border-[var(--dh-border)] pt-3">
              <p class="mb-2 text-sm font-semibold">Subtotales de rubros del snapshot, por moneda</p>
              <div v-for="group in quoteTotals" :key="group.code" class="flex flex-wrap items-center gap-3 py-1 text-sm">
                <strong>{{ group.code }}</strong>
                <span>Costo: {{ group.completeCost ? amountLabel(group.cost) : 'Incompleto' }}</span>
                <span v-if="auth.hasScope('operations.finance.manage')">Venta: {{ group.completeSale ? amountLabel(group.sale) : 'Incompleto' }}</span>
              </div>
              <p class="text-xs text-[var(--dh-text-muted)]">No sustituye el total comercial ni incluye impuestos no registrados en los rubros.</p>
            </div>
          </template>
        </DhCard>
        <DhCard v-if="record.sourceQuoteId" title="Semáforo comercial" subtitle="Compara la QUO aceptada con el IDTRA y revisa las diferencias antes de solicitar una recotización.">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <DhBadge :variant="commercialVariant">{{ commercialLabel }}</DhBadge>
            <p v-if="comparison?.hasSnapshot" class="text-sm text-[var(--dh-text-muted)]">{{ discrepancyCount }} diferencias · {{ unconfirmedCount }} datos por confirmar</p>
          </div>
          <p v-if="comparisonError" role="alert" class="text-sm text-[var(--dh-text-muted)]">No se pudo consultar la comparación. Actualice el expediente.</p>
          <p v-else-if="!comparison?.hasSnapshot" class="text-sm text-[var(--dh-text-muted)]">No hay snapshot aceptado suficiente para comparar. No se presume coincidencia.</p>
          <template v-else>
            <div class="mb-4 grid gap-2 sm:grid-cols-3" aria-label="Resumen de comparación comercial">
              <DhCard padding="compact"><DhBadge variant="success">Coinciden</DhBadge><p class="mt-2 text-xl font-bold tabular-nums">{{ comparisonCounts.match }}</p><p class="text-xs text-[var(--dh-text-muted)]">Datos iguales a la QUO</p></DhCard>
              <DhCard padding="compact"><DhBadge variant="warning">Por confirmar</DhBadge><p class="mt-2 text-xl font-bold tabular-nums">{{ unconfirmedCount }}</p><p class="text-xs text-[var(--dh-text-muted)]">Falta información verificable</p></DhCard>
              <DhCard padding="compact"><DhBadge variant="danger">Diferencias</DhBadge><p class="mt-2 text-xl font-bold tabular-nums">{{ discrepancyCount }}</p><p class="text-xs text-[var(--dh-text-muted)]">Cambios respecto a lo cotizado</p></DhCard>
            </div>
            <p v-if="!confirmedHold && (discrepancyCount || unconfirmedCount)" class="mb-3 text-sm text-[var(--dh-text-muted)]" role="status">Revisa las discrepancias y los datos pendientes. Estos indicadores no confirman un bloqueo HOLD; el estado operativo lo determina Operations.</p>
            <DhTabs v-model="comparisonFilter" :items="comparisonFilters" aria-label="Filtrar datos de la comparación" class="mb-3" />
            <DhDataTable :columns="comparisonColumns" :rows="visibleComparisonRows" empty-text="No hay datos en esta categoría.">
              <template #cell-quoted="{ row }">{{ comparisonValue(row, 'quoted') }}</template>
              <template #cell-current="{ row }">{{ comparisonValue(row, 'current') }}</template>
              <template #cell-status="{ row }"><DhBadge :variant="comparisonStatusVariant(row.status)">{{ comparisonStatusLabel(row.status) }}</DhBadge></template>
            </DhDataTable>
            <p class="mt-3 text-xs text-[var(--dh-text-muted)]">La ausencia de un dato no equivale a un cambio confirmado. El peso y volumen se comparan en unidades normalizadas.</p>
            <div v-if="comparison.currentReview" class="mt-4 border-t border-[var(--dh-border)] pt-3">
              <div class="flex flex-wrap items-center gap-2"><DhBadge :variant="comparison.currentReview.status === 'RESOLVED_NO_PRICE_CHANGE' ? 'success' : comparison.currentReview.status === 'REJECTED' ? 'danger' : 'warning'">{{ statusLabel(comparison.currentReview.status) }}</DhBadge><span class="text-xs text-[var(--dh-text-muted)]">Solicitado: {{ dateLabel(comparison.currentReview.requestedAtUtc) }}</span></div>
              <p class="mt-1 break-words text-sm">{{ comparison.currentReview.reason }}</p>
              <p v-if="comparison.currentReview.decisionReason" class="mt-1 text-xs text-[var(--dh-text-muted)]">Pricing: {{ comparison.currentReview.decisionReason }}</p>
            </div>
            <div v-else-if="comparison.canRequest && discrepancyCount" class="mt-4 space-y-3 border-t border-[var(--dh-border)] pt-3">
              <p class="text-sm font-semibold">Solicitud de modificación a Pricing · {{ record.idtra }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">Se enviarán {{ discrepancyCount }} diferencias confirmadas, con los valores de la QUO y del trámite. No se cambiarán los importes automáticamente.</p>
              <DhTextarea v-model="reviewComment" label="Justificación de la revisión comercial" placeholder="Explique por qué cambian las condiciones de la operación." :rows="3" />
              <p class="text-xs text-[var(--dh-text-muted)]">{{ reviewComment.trim().length }} / 300 caracteres</p>
              <div v-if="reviewDraftChanged" class="flex flex-wrap items-center gap-2" role="alert"><p class="text-sm text-[var(--dh-text-muted)]">El expediente cambió. Actualice la comparación antes de enviar.</p><DhButton variant="secondary" size="sm" label="Actualizar comparación" :loading="loading" @click="load" /></div>
              <div class="flex justify-end">
                <DhButton label="Solicitar revisión / recotización" :loading="requestingReview"
                  :disabled="reviewDraftChanged || !reviewComment.trim() || reviewComment.trim().length > 300" @click="requestCommercialReview" />
              </div>
            </div>
            <p v-else-if="discrepancyCount && !comparison.canRequest && !comparison.currentReview" class="mt-3 text-xs text-[var(--dh-text-muted)]">No tienes autorización para solicitar la revisión de este trámite.</p>
            <div v-if="comparison.history.some(x => x.id !== comparison?.currentReview?.id)" class="mt-4 space-y-2 border-t border-[var(--dh-border)] pt-3">
              <p class="text-sm font-semibold">Historial de revisiones comerciales</p>
              <div v-for="review in comparison.history.filter(x => x.id !== comparison?.currentReview?.id)" :key="review.id" class="border-b border-[var(--dh-border)] pb-2 text-sm">
                <p class="font-semibold">{{ statusLabel(review.status) }} · {{ dateLabel(review.requestedAtUtc) }}</p>
                <p class="break-words text-xs">{{ review.reason }}</p>
              </div>
            </div>
          </template>
          <div v-if="pendingCommercialAlerts.length" class="mt-3 border-t border-[var(--dh-border)] pt-3">
            <p class="text-sm font-semibold">Revisiones de servicios registradas previamente</p>
            <p v-for="review in commercialReviews?.reviews || []" :key="review.id" class="mt-1 text-xs">{{ statusLabel(review.status) }} · {{ review.reason }}</p>
          </div>
        </DhCard>
        <DhCard v-if="auth.hasScope('operations.cost.read')" title="Rubros y proveedores registrados" subtitle="Información histórica disponible; no se generan cargos ficticios.">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-[var(--dh-text-muted)]">{{ costRows.length }} rubros {{ snapshotCosts.length ? 'de la QUO aceptada' : 'registrados' }}</p>
            <DhBadge v-if="missingCostProviders" variant="warning">{{ missingCostProviders }} rubros sin proveedor registrado</DhBadge>
          </div>
          <p v-if="costError" role="alert" class="text-sm text-[var(--dh-text-muted)]">No se pudo consultar la información comercial. Utiliza Actualizar.</p>
          <p v-else-if="snapshotCosts.length && costs.length !== snapshotCosts.length" class="mb-3 text-xs text-[var(--dh-text-muted)]">La tabla muestra el snapshot original completo. Los rubros pendientes de conciliación no se consideran costos operativos confirmados.</p>
          <DhDataTable :columns="costColumns" :rows="costRows" v-if="!costError" empty-text="No hay rubros disponibles en la cotización aceptada.">
            <template #cell-description="{ row }"><span class="font-semibold">{{ readable(row.description) || 'Rubro pendiente de identificar' }}</span></template>
            <template #cell-supplierName="{ row }"><span>{{ readable(row.supplierName) || 'Proveedor pendiente' }}</span></template>
            <template #cell-currencyCode="{ row }">{{ currency(row.currencyCode, row.currencyName) || 'Moneda pendiente' }}</template>
            <template #cell-costDetailType="{ row }">{{ readable(row.costDetailType) || 'Por confirmar' }}</template>
            <template #cell-chargeBasis="{ row }">{{ readable(row.chargeBasis) || 'Por confirmar' }}</template>
            <template #cell-quantity="{ row }">{{ row.quantity ?? 'Por confirmar' }}</template>
            <template #cell-unitCost="{ row }">{{ amountLabel(row.unitCost) }}</template>
            <template #cell-costAmount="{ row }"><span class="font-semibold tabular-nums">{{ amountLabel(row.costAmount) }}</span></template>
            <template #cell-saleAmount="{ row }">{{ amountLabel(row.saleAmount) }}</template>
            <template #cell-taxAmount="{ row }">{{ amountLabel(row.taxAmount) }}</template>
            <template #cell-saleTotal="{ row }">{{ amountLabel(row.saleTotal) }}</template>
          </DhDataTable>
          <div v-if="auth.hasScope('operations.finance.manage') && commercialConditions" class="mt-4 space-y-3 border-t border-[var(--dh-border)] pt-3">
            <p class="text-sm font-semibold">Condiciones de la QUO aceptada</p>
            <div v-for="term in [{ label: 'Incluye', value: commercialConditions.includes }, { label: 'No incluye', value: commercialConditions.excludes }, { label: 'Sujeto a', value: commercialConditions.subjectTo }]" :key="term.label">
              <p class="text-xs text-[var(--dh-text-muted)]">{{ term.label }}</p>
              <p class="whitespace-pre-wrap break-words text-sm">{{ term.value || 'No registrado en la QUO' }}</p>
            </div>
          </div>
        </DhCard>
      </div>

      <div v-else class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div class="space-y-4">
          <DhCard :icon="Layers3" :title="tabs.find(x => x.code === selectedTab)?.label || 'Departamento'" subtitle="Información de la etapa y trabajo de los equipos autorizados.">
            <div v-if="currentStage" class="space-y-3">
              <div class="flex flex-wrap gap-2"><DhBadge variant="primary">{{ statusLabel(currentStage.status) }}</DhBadge><DhBadge variant="neutral">{{ level(selectedTab) === 'EDITABLE' ? 'Editable según permisos' : 'Solo lectura' }}</DhBadge></div>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl bg-[var(--dh-input)] p-3"><p class="text-xs text-[var(--dh-text-muted)]">Equipo</p><p class="font-bold">{{ currentStage.teamName || 'Pendiente' }}</p></div>
                <div class="rounded-xl bg-[var(--dh-input)] p-3"><p class="text-xs text-[var(--dh-text-muted)]">Inicio</p><p class="font-bold">{{ dateLabel(currentStage.startedAtUtc) }}</p></div>
              </div>
              <div v-if="selectedTab === 'COORDINACION_ORIGEN' && origin" class="rounded-xl border border-[var(--dh-border)] p-4">
                <p class="text-xs font-bold text-[var(--dh-text-muted)]">Estado específico de Origen</p>
                <p class="mt-2 font-black">{{ statusLabel(origin.progress?.statusCode || origin.stage.status) }}</p>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Salida real: {{ dateLabel(origin.progress?.actualDepartureAtUtc) }}</p>
                <div v-if="level('COORDINACION_ORIGEN') === 'EDITABLE' && !origin.progress?.actualDepartureAtUtc" class="mt-4 space-y-2">
                  <DhSelect v-model="originStatus" label="Actualizar estado operativo" :options="originStatusChoices" />
                  <DhButton :icon="Save" label="Guardar estado de Origen" :loading="savingOrigin"
                    :disabled="originStatus === (origin.progress?.statusCode || 'ORIGIN_COORDINATION')" @click="saveOriginStatus" />
                  <p class="text-xs text-[var(--dh-text-muted)]">La transición a Tránsito requiere confirmación de salida real con evidencia. Este formulario no la simula.</p>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-[var(--dh-text-muted)]">Esta etapa no está activa en el flujo del trámite.</p>
          </DhCard>
          <DhCard v-if="selectedTab === 'COORDINACION_ORIGEN' && currentStage" title="Peso de la mercancía" subtitle="Conserva el peso estimado y confirma el peso real independientemente.">
            <div class="grid gap-3 sm:grid-cols-3">
              <div><p class="text-xs text-[var(--dh-text-muted)]">Estimado (kg)</p><p class="font-semibold tabular-nums">{{ amountLabel(estimatedWeightKg) }}</p></div>
              <div><p class="text-xs text-[var(--dh-text-muted)]">Real (kg)</p><p class="font-semibold tabular-nums">{{ amountLabel(confirmedWeightKg) }}</p></div>
              <div><p class="text-xs text-[var(--dh-text-muted)]">Diferencia (kg)</p><p class="font-semibold tabular-nums">{{ amountLabel(weightDifference) }}</p></div>
            </div>
            <div v-if="level('COORDINACION_ORIGEN') === 'EDITABLE'" class="mt-4 space-y-3">
              <div class="grid gap-3 sm:grid-cols-2">
                <DhInput v-model="originWeightValue" label="Peso real" type="number" :min="0" />
                <DhSelect v-model="originWeightUnit" label="Unidad" :options="weightUnitOptions" />
              </div>
              <p class="text-sm text-[var(--dh-text-muted)]">Equivalencia: {{ amountLabel(pendingWeightKg) }} kg</p>
              <p v-if="originWeightStale" role="alert" class="text-sm text-[var(--dh-text-muted)]">El expediente cambió. Actualice antes de confirmar el peso.</p>
              <div class="flex justify-end"><DhButton :icon="Save" label="Confirmar peso real" :loading="originWeightSaving"
                :disabled="originWeightStale || !weightDirty || pendingWeightKg == null" @click="confirmOriginWeight" /></div>
            </div>
          </DhCard>
          <DhCard v-if="selectedTab === 'COORDINACION_ORIGEN' && currentStage" title="Planificación de transporte" subtitle="Fechas estimadas y referencia operativa de consolidación.">
            <div v-if="level('COORDINACION_ORIGEN') === 'EDITABLE'" class="space-y-3">
              <div class="grid gap-3 sm:grid-cols-2">
                <DhInput v-model="originPlanning.etd" type="date" label="Salida estimada (ETD)" />
                <DhInput v-model="originPlanning.eta" type="date" label="Llegada estimada (ETA)" />
                <DhInput v-model="originPlanning.clientPoReference" label="PO / referencia del cliente (opcional)" :maxlength="250" />
                <DhInput v-model="originPlanning.invoiceReference" label="Factura (opcional)" :maxlength="250" />
                <DhInput v-if="originConsolidationApplicable" v-model="originPlanning.consolidationReference" label="Referencia de consolidado" />
              </div>
              <p v-if="originPlanningStale" role="alert" class="text-sm text-[var(--dh-text-muted)]">El expediente cambió. Actualice antes de guardar.</p>
              <div class="flex justify-end"><DhButton :icon="Save" label="Guardar planificación" :loading="originPlanningSaving" :disabled="originPlanningStale || !originPlanningDirty" @click="saveOriginPlanning" /></div>
            </div>
            <div v-else class="grid gap-3 sm:grid-cols-2">
              <p>ETD: {{ originPlanningBase.etd || 'Por confirmar' }}</p><p>ETA: {{ originPlanningBase.eta || 'Por confirmar' }}</p>
              <p>PO: {{ originPlanningBase.clientPoReference || 'Sin referencia' }}</p><p>Factura: {{ originPlanningBase.invoiceReference || 'Sin referencia' }}</p>
              <p v-if="originConsolidationApplicable">Consolidado: {{ originPlanningBase.consolidationReference || 'Por confirmar' }}</p>
            </div>
          </DhCard>
          <DhCard title="Hitos y seguimiento" subtitle="Fechas reales y planificadas registradas en Operations.">
            <div v-for="milestone in currentMilestones" :key="milestone.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3">
              <p class="text-sm font-bold">{{ milestone.title }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">{{ statusLabel(milestone.status) }} · {{ dateLabel(milestone.actualAtUtc || milestone.plannedAtUtc) }}</p>
            </div>
            <p v-if="!currentMilestones.length" class="text-sm text-[var(--dh-text-muted)]">Todavía no hay hitos registrados para esta etapa.</p>
          </DhCard>
          <DhCard v-if="selectedTab === 'COORDINACION_ORIGEN' && auth.hasScope('operations.internal-note.read') && origin" :icon="MessageSquareText" title="Bitácora privada de Origen" subtitle="Solo perfiles autorizados. Estas notas no se envían al cliente.">
            <div v-if="canWriteNote" class="mb-4 space-y-2">
              <DhTextarea v-model="noteText" label="Nueva nota interna" :rows="3" placeholder="Registrar seguimiento operativo…" />
              <DhButton :icon="Plus" label="Agregar nota" :loading="postingNote" :disabled="!noteText.trim()" @click="addNote" />
            </div>
            <div v-for="note in notes" :key="note.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3">
              <p class="whitespace-pre-wrap text-sm">{{ note.body }}</p>
              <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ dateLabel(note.createdAtUtc) }}</p>
            </div>
            <p v-if="!notes.length" class="text-sm text-[var(--dh-text-muted)]">Sin notas internas.</p>
          </DhCard>
        </div>
        <div class="space-y-4">
          <DhCard title="Tareas del departamento">
            <div v-for="task in currentTasks" :key="task.id" class="mb-2 rounded-xl bg-[var(--dh-input)] p-3">
              <p class="text-sm font-bold">{{ task.title }}</p>
              <p v-if="task.details" class="mt-1 whitespace-pre-wrap text-xs">{{ task.details }}</p>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ statusLabel(task.status) }} · {{ dateLabel(task.dueAtUtc) }}</p>
            </div>
            <p v-if="!currentTasks.length" class="text-sm text-[var(--dh-text-muted)]">No hay tareas registradas para esta etapa.</p>
          </DhCard>
          <DhCard title="Acceso y responsabilidad">
            <p class="text-sm text-[var(--dh-text-soft)]">
              {{ level(selectedTab) === 'EDITABLE' ? 'El backend ha autorizado acciones de esta etapa para tu equipo. Las modificaciones disponibles dependen del permiso específico de cada operación.' : 'Puedes consultar esta etapa, pero no modificarla con los permisos actuales.' }}
            </p>
          </DhCard>
        </div>
      </div>
    </template>
  </div>
</template>
