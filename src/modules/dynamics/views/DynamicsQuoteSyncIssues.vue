<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, SearchCheck } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { ApiError, getApiErrorMessage } from '@/core/api/apiErrorHandler'
import { fetchClient } from '@/core/api/fetchConfig'
import { useAuthStore } from '@/core/stores/authStore'

type LedgerEntry = {
  status: 'not_sent' | 'reserved' | 'rejected' | 'succeeded' | 'ambiguous' | 'reconciled'
  httpStatus: number | null
  recordId: string | null
  providerCode: string | null
}
type QuoteLedger = {
  rateId: string
  revisionNumber: number
  header: LedgerEntry
  total: LedgerEntry
  legacy?: {
    hasPriorSuccessfulCreate: boolean
    historyTruncated: boolean
    priorHeaderCount: number
    uniqueQuoteId: string | null
    liveQuoteExists: boolean | null
    liveQuoteStatus: string
    requiresRateIdLink: boolean
    candidates: Array<{ revisionNumber: number; quoteId: string | null }>
  }
  live?: {
    headerExists: boolean | null
    headerStatus: string
    detailExists: boolean | null
    detailStatus: string
    confirmed: boolean
  }
  noPostExecuted: boolean
}

type MissingQueuedRate = {
  rateId: string
  rateCode: string
  rateName: string | null
  clientName: string | null
  idtraNumber: string | null
  revisionNumber: number
  polName: string | null
  poeName: string | null
  podName: string | null
  incotermName: string | null
  totalSaleAmount: number
  totalCostAmount: number
  currencyCode: string
  currencyName?: string | null
}
type EligibleRate = {
  rateId: string
  rateCode: string
  rateName: string | null
  clientName: string | null
  idtraNumber: string
  revisionNumber: number
  totalSaleAmount: number
  currencyCode: string
  jobStatus: string
  canRetry: boolean
}
type QuoteIssue = {
  rate?: {
    rateCode?: string | null
    rateName?: string | null
    clientName?: string | null
    executiveName?: string | null
    idtraNumber?: string | null
    shipmentMode?: string | null
    incotermName?: string | null
    polName?: string | null
    poeName?: string | null
    podName?: string | null
    currencyCode?: string | null
    currencyName?: string | null
    totalSaleAmount?: number | null
    totalCostAmount?: number | null
    totalUtilityAmount?: number | null
  }
  crm?: {
    quoteId: string | null
    lineId: string | null
    connectorRecordedSuccess: boolean
    liveDataverseVerified: boolean
    verification: string
  }
  rateId: string
  revisionNumber: number
  status: string
  attempts: number
  retryableWithoutDuplicateRisk?: boolean
  lastError: string | null
  error?: {
    code?: string
    stage?: string
    message?: string
    httpStatus?: number | null
    postAttempted?: boolean
    providerCode?: string
    lookupInput?: string | null
    lookupSearchField?: string | null
  } | null
  createdAtUtc?: string
  nextAttemptAtUtc?: string | null
  completedAtUtc?: string | null
  currentRateRevision?: number | null
  retryBlockReason?: string | null
}
type WriteReadiness = {
  ready: boolean
  code: string
  message: string
  noPostExecuted: boolean
  configuredKeyId?: string | null
  missingGrants?: string[] | null
}
type Diagnosis = {
  valid: boolean
  stage: string
  code: string
  message: string
  schemaVersion?: number
  httpStatus?: number
  noPostExecuted?: boolean
  lookupInput?: string | null
  lookupSearchField?: string | null
}

type QuoteCrudKey = {
  id: string
  templateName: string
  entityName: string
  operation: string
  label: string
  enabled: boolean
  expiresAt: string
  templateVersion: number
}
type QuoteTemplate = {
  name: string
  activeVersion: number | null
}
type TrackedDelivery = {
  revisionNumber: number
  status: string
  attempts: number
  lastError: string | null
  error?: {
    stage?: string
    code?: string
    providerCode?: string
    httpStatus?: number | null
    postAttempted?: boolean
    lookupInput?: string | null
    lookupSearchField?: string | null
    message?: string
  } | null
  createdAtUtc?: string
  nextAttemptAtUtc?: string | null
  completedAtUtc?: string | null
}
const auth = useAuthStore()
const isAdministrator = computed(() => auth.hasScope('dynamics.security.admin'))
const quoteKeys = ref<QuoteCrudKey[]>([])
const currentQuoteVersion = ref<number | null>(null)
const selectedKeyId = ref('')
const granting = ref(false)
const grantError = ref('')
const grantSuccess = ref('')
const selectedRateQuery = ref('')
const searchedRates = ref<EligibleRate[]>([])
const searchingRates = ref(false)
const searchedRatesError = ref('')
const publishingRateId = ref<string | null>(null)
const publishingMessage = ref('')
async function searchRatesForDynamics() {
  const query = selectedRateQuery.value.trim()
  if (!isAdministrator.value || searchingRates.value || query.length < 2) return
  searchingRates.value = true
  searchedRatesError.value = ''
  publishingMessage.value = ''
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rates/dynamics-sync/eligible-rates?search=' +
        encodeURIComponent(query),
    })
    const result = unwrapApiResponse<{ results: EligibleRate[] }>(response as never)
    searchedRates.value = result.results || []
    if (!searchedRates.value.length)
      searchedRatesError.value = 'No hay tarifas aceptadas con IDTRA que coincidan con esta búsqueda.'
  } catch (error) {
    searchedRates.value = []
    searchedRatesError.value = error instanceof ApiError
      ? (error.code ? '[' + error.code + '] ' : '') + getApiErrorMessage(error)
      : error instanceof Error ? error.message : 'No se pudo buscar en Pricing.'
  } finally {
    searchingRates.value = false
  }
}

async function publishSelectedRate(rate: EligibleRate) {
  if (!isAdministrator.value || publishingRateId.value) return
  publishingRateId.value = rate.rateId
  publishingMessage.value = ''
  try {
    if (rate.jobStatus === 'NotQueued') {
      manualRateId.value = rate.rateId
      await enqueueAccepted()
      publishingMessage.value = enqueueError.value || enqueueFeedback.value
    } else if (rate.jobStatus === 'NeedsAttention' && rate.canRetry) {
      const readiness = await checkWriteReadiness()
      if (!readiness.ready) {
        publishingMessage.value = 'No se pudo enviar: ' + readiness.message
        return
      }
      await callEndpoint<unknown>({
        method: 'POST',
        path: '/api/pricing/rates/' + encodeURIComponent(rate.rateId) +
          '/dynamics-sync/retry',
      })
      publishingMessage.value =
        'Reintento seguro encolado con la misma clave. Consultá el seguimiento.'
    } else if (rate.jobStatus === 'NeedsAttention') {
      publishingMessage.value =
        'La incidencia requiere conciliar la operación anterior antes de publicar. Abrí el seguimiento y verificá Dynamics.'
    } else if (rate.jobStatus === 'Completed') {
      publishingMessage.value =
        'Esta revisión ya fue enviada. No se crea una segunda oferta.'
    } else {
      publishingMessage.value =
        'Ya existe una operación en ' + rate.jobStatus + '. Consultá su progreso.'
    }
    followRate(rate.rateId)
    await refresh()
    await refreshTrackedDelivery()
    if (rate.jobStatus !== 'NotQueued' && rate.canRetry) await searchRatesForDynamics()
  } catch (error) {
    publishingMessage.value = error instanceof ApiError
      ? (error.code ? '[' + error.code + '] ' : '') + getApiErrorMessage(error)
      : error instanceof Error ? error.message : 'No se pudo publicar la QUO.'
  } finally {
    publishingRateId.value = null
  }
}
const manualRateId = ref('')
const enqueueing = ref(false)
const enqueueFeedback = ref('')
const enqueueError = ref('')
// The user should never lose sight of the exact queued revision when the
// status switches from Pending to NeedsAttention between 3-second polls.
const trackedRateId = ref('')
const trackedRevision = ref<number | null>(null)
const trackedDelivery = ref<TrackedDelivery | null>(null)
const trackedLoadError = ref('')
const manualRateIdValid = computed(() =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(manualRateId.value.trim()))

async function enqueueAccepted() {
  if (!isAdministrator.value || !manualRateIdValid.value || enqueueing.value) return
  enqueueing.value = true
  enqueueFeedback.value = ''
  enqueueError.value = ''
  try {
    const readiness = await checkWriteReadiness()
    if (!readiness.ready) {
      enqueueError.value = 'No se encoló la tarifa: ' + readiness.message +
        ' (' + readiness.code + ').'
      return
    }
    const response = await callEndpoint<unknown>({
      method: 'POST',
      path: `/api/pricing/rates/${encodeURIComponent(manualRateId.value.trim())}/dynamics-sync/enqueue`,
    })
    const result = unwrapApiResponse<{ status: string; alreadyQueued: boolean;
      revisionNumber: number }>(response as never)
    const queuedId = manualRateId.value.trim().toLowerCase()
    trackedRateId.value = queuedId
    trackedRevision.value = result.revisionNumber
    trackedDelivery.value = null
    rateSearch.value = queuedId
    // A previously selected 'Completadas' filter hid the newly enqueued job.
    statusFilter.value = 'all'
    enqueueFeedback.value = result.alreadyQueued
      ? `Revisión v${result.revisionNumber} ya registrada en estado ${result.status}. No se duplicó. Consultá el seguimiento de esta revisión.`
      : `Revisión v${result.revisionNumber} guardada en Pricing. La QUO NO está confirmada hasta que el worker y Dataverse confirmen su creación.`
    await refresh()
    await refreshTrackedDelivery()
  } catch (error) {
    enqueueError.value = error instanceof ApiError
      ? (error.code ? '[' + error.code + '] ' : '') + getApiErrorMessage(error) +
        (error.status === 503
          ? ' El servicio registró la etapa del fallo: consultá el seguimiento de Pricing antes de volver a intentar.'
          : '')
      : error instanceof Error ? error.message :
        'No se pudo encolar la tarifa. Confirmá que está aceptada y que tiene IDTRA.'
  } finally {
    enqueueing.value = false
  }
}

async function loadQuoteKeys() {
  if (!isAdministrator.value) return
  try {
    const [keys, templates] = await Promise.all([
      fetchClient<QuoteCrudKey[]>(
        '/api/dynamics-admin/connections/principal/crud-keys', { method: 'GET' }),
      fetchClient<QuoteTemplate[]>(
        '/api/dynamics-admin/connections/principal/templates', { method: 'GET' }),
    ])
    currentQuoteVersion.value = templates.find(t => t.name === 'crear_oferta')
      ?.activeVersion ?? null
    quoteKeys.value = keys.filter(k => k.enabled &&
      k.entityName === 'quote' && ['create', 'upsert'].includes(k.operation) &&
      k.templateName === 'crear_oferta' &&
      k.templateVersion === currentQuoteVersion.value &&
      new Date(k.expiresAt).getTime() > Date.now())
    const configured = writeReadiness.value?.configuredKeyId
    if (configured && quoteKeys.value.some(k => k.id === configured))
      selectedKeyId.value = configured
    else if (!quoteKeys.value.some(k => k.id === selectedKeyId.value))
      selectedKeyId.value = quoteKeys.value.length === 1 ? quoteKeys.value[0]!.id : ''
  } catch {
    grantError.value = 'No se pudieron consultar las claves de crear_oferta.'
  }
}

async function grantQuoteTotal() {
  if (!selectedKeyId.value || !isAdministrator.value || granting.value ||
      (writeReadiness.value?.configuredKeyId &&
        writeReadiness.value.configuredKeyId !== selectedKeyId.value)) return
  granting.value = true
  grantError.value = ''
  grantSuccess.value = ''
  try {
    await fetchClient<unknown>(
      '/api/dynamics-admin/connections/principal/quote-total-grants/' +
        encodeURIComponent(selectedKeyId.value),
      { method: 'POST', body: {} })
    // Verify with the same API key that the Pricing worker really uses.
    // A successful admin grant is NOT proof that the active worker key has
    // permission, and must never enqueue or execute a Dataverse write.
    const readiness = await checkWriteReadiness()
    grantSuccess.value = readiness.ready
      ? 'Permisos autorizados y comprobados con la clave activa de Pricing. Diagnosticá la tarifa antes de recuperar una QUO rechazada. No se envió ninguna QUO.'
      : 'Se guardaron los permisos solicitados, pero la clave de Pricing todavía no está lista: ' +
        readiness.message + ' (' + readiness.code + '). No se envió ninguna QUO.'
    await refresh()
    // Refresh only the diagnoses the operator already opened. Never auto-
    // recover or retry previously rejected Dataverse quote headers.
    for (const rateId of Object.keys(diagnoses.value).slice(0, 3)) {
      await diagnose(rateId)
    }
  } catch (error) {
    grantError.value = error instanceof ApiError &&
      error.code === 'pricing_quote_notification_option_missing_live'
      ? 'Dynamics no tiene publicada la opción numérica 100000000 de ' +
        'new_notifrespuestacotizacion. Revisá las opciones reales del campo ' +
        'en Dataverse y publicá la personalización correcta antes de autorizar. ' +
        'No se envió ninguna QUO.'
      : error instanceof ApiError &&
        error.code === 'pricing_quote_notification_choice_unavailable'
      ? 'El campo new_notifrespuestacotizacion no está disponible como opción ' +
        'editable para crear o actualizar la oferta. Revisá su tipo, opción ' +
        '100000000 y permisos en los metadatos de Dynamics. No se envió ninguna QUO.'
      : error instanceof ApiError
      ? (error.code ? '[' + error.code + '] ' : 'HTTP ' + error.status + ': ') +
        getApiErrorMessage(error)
      : error instanceof Error ? error.message :
        'No fue posible habilitar los permisos. Confirmá los campos de quote y quotedetail en Catálogo.'
  } finally {
    granting.value = false
  }
}

type WorkerStatus = {
  ready: boolean
  code: string
  lastHeartbeatUtc: string | null
}
type QueueSummary = {
  pending: number
  processing: number
  retry: number
  needsAttention: number
  completed: number
}
const emptyQueue = (): QueueSummary => ({
  pending: 0, processing: 0, retry: 0, needsAttention: 0, completed: 0,
})
const statusFilter = ref<'active' | 'completed' | 'attention' | 'all'>('active')
const rateSearch = ref('')
const visibleIssues = computed(() => {
  const search = rateSearch.value.trim().toLocaleLowerCase()
  return issues.value.filter(issue => {
    if (statusFilter.value === 'active' && issue.status === 'Completed') return false
    if (statusFilter.value === 'completed' && issue.status !== 'Completed') return false
    if (statusFilter.value === 'attention' && issue.status !== 'NeedsAttention') return false
    if (!search) return true
    return [issue.rateId, issue.rate?.rateCode, issue.rate?.rateName,
      issue.rate?.clientName, issue.rate?.idtraNumber, issue.rate?.executiveName]
      .some(value => (value || '').toLocaleLowerCase().includes(search))
  })
})
function money(amount?: number | null, currency = '', currencyName = ''): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—'
  // Catalog currencies (e.g. CUR-2026-001) are NOT ISO 4217 codes.
  // Passing them to Intl.NumberFormat({ style:'currency' }) throws
  // RangeError during Vue render and makes the entire queue disappear.
  // Prefer the approved currency's real name when present.
  const code = [currencyName, currency]
    .map(value => (value || '').trim().toUpperCase())
    .find(value => value === 'USD' || value === 'CRC')
  if (code) {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency', currency: code, maximumFractionDigits: 2,
    }).format(Number(amount))
  }
  // Do not pretend that an unknown catalog code means USD.
  const amountText = new Intl.NumberFormat('es-CR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(amount))
  const label = currencyName || currency || 'moneda sin identificar'
  return amountText + ' (' + label + ')'
}
function quoteUrl(value?: string | null): string | null {
  if (!value || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))
    return null
  // Tenant hostname is fixed and is not based on user or response-controlled input.
  return 'https://sibaja07.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=quote&id=' +
    encodeURIComponent(value)
}
const missingQueuedJobs = ref<MissingQueuedRate[]>([])
const missingQueuedVisible = computed(() => {
  const search = rateSearch.value.trim().toLowerCase()
  if (statusFilter.value === 'completed') return []
  return missingQueuedJobs.value.filter(rate =>
    !search || [rate.rateId, rate.rateCode, rate.rateName,
      rate.clientName, rate.idtraNumber].some(value =>
      (value || '').toLowerCase().includes(search)))
})
async function enqueueMissingRate(rateId: string) {
  if (!isAdministrator.value || enqueueing.value) return
  manualRateId.value = rateId
  await enqueueAccepted()
}
const issues = ref<QuoteIssue[]>([])
const queueSummary = ref<QueueSummary>(emptyQueue())
const workerStatus = ref<WorkerStatus | null>(null)
const workerExplanation = computed(() => {
  const status = workerStatus.value
  if (!status || status.ready) return ''
  switch (status.code) {
    case 'DYNAMICS_SYNC_DISABLED':
      return 'La sincronización está deshabilitada en Pricing (DynamicsQuoteSync__Enabled). Activala y reiniciá Pricing API.'
    case 'DYNAMICS_API_KEY_MISSING':
      return 'Falta DynamicsQuoteSync__ApiKey en la configuración de Pricing API. Revisá /opt/dhole/.env y reiniciá el servicio.'
    case 'crud_key_invalid':
    case 'DYNAMICS_PREFLIGHT_HTTP_401':
      return 'Dynamics rechazó la clave de Pricing. Usá una clave vigente de la versión activa de crear_oferta.'
    case 'quote_grants_incomplete':
      return 'Faltan permisos para esta clave. Revisá «Autorizar vínculos y venta total» con la clave usada por Pricing.'
    case 'production_writes_not_approved':
    case 'production_quote_writes_not_approved':
      return 'El conector no tiene aprobada la escritura de ofertas en producción. Se requiere la autorización correspondiente.'
    case 'DYNAMICS_PREFLIGHT_UNAVAILABLE':
      return 'Pricing no logra consultar el conector de Dynamics. Revisá la conectividad y los registros de Pricing API.'
    case 'DYNAMICS_WORKER_UNRESPONSIVE':
      return 'El worker dejó de responder. Revisá los registros y el estado de Pricing API.'
    case 'DYNAMICS_WORKER_ITERATION_FAILED':
      return 'El worker encontró un error al consultar la cola en PostgreSQL. Revisá los registros de Pricing API.'
    case 'DYNAMICS_WORKER_NOT_STARTED':
    case 'DYNAMICS_WORKER_STARTING':
      return 'El worker todavía no confirmó su inicio. Revisá los registros de Pricing API si persiste.'
    default:
      return 'Dynamics todavía no autorizó el envío (código: ' + status.code + '). Revisá la comprobación de permisos.'
  }
})
const lastQueueUpdate = ref<string | null>(null)
let queueRefreshTimer: ReturnType<typeof setInterval> | null = null
let readinessRefreshTimer: ReturnType<typeof setInterval> | null = null

function syncStateLabel(status: string, rateId?: string): string {
  switch (status) {
    case 'Pending': return workerStatus.value && !workerStatus.value.ready
      ? 'En cola · envío pausado' : 'En cola'
    case 'Processing': return 'Enviando a Dynamics'
    case 'Retry': return 'Reintento programado'
    case 'NeedsAttention': return 'Requiere atención'
    case 'Completed': return rateId && ledgerByRate.value[rateId]?.live?.confirmed
      ? 'Verificada en Dynamics' : 'Completada (sin verificar)'
    default: return status
  }
}
function dateTimeLabel(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}
const loading = ref(false)
const loadError = ref('')
const diagnosingRateId = ref<string | null>(null)
const diagnoses = ref<Record<string, Diagnosis>>({})
const retryingRateId = ref<string | null>(null)
// Remains visible even if a new write is blocked by idempotency protection.
const retryDecisionRateId = ref<string | null>(null)
const retryMessages = ref<Record<string, string>>({})
const writeReadiness = ref<WriteReadiness | null>(null)
const checkingWrites = ref(false)
const ledgerByRate = ref<Record<string, QuoteLedger>>({})
const ledgerErrors = ref<Record<string, string>>({})
const checkingLedgerRateId = ref<string | null>(null)
const reconcilingRateId = ref<string | null>(null)
const reconcileMessages = ref<Record<string,string>>({})
const recoveringRateId = ref<string | null>(null)
const recoveryMessages = ref<Record<string,string>>({})
const legacyConfirmed = ref<Record<string, boolean>>({})
const linkingLegacyRateId = ref<string | null>(null)
const legacyLinkMessages = ref<Record<string, string>>({})

async function linkLegacyAndResume(issue: QuoteIssue) {
  const legacy = ledgerByRate.value[issue.rateId]?.legacy
  const quoteId = legacy?.uniqueQuoteId
  if (!isAdministrator.value || issue.status !== 'NeedsAttention' ||
      issue.error?.providerCode !== 'legacy_quote_requires_rate_key_linking' ||
      issue.retryBlockReason || linkingLegacyRateId.value ||
      !quoteId || !legacy?.liveQuoteExists || legacy.historyTruncated ||
      !legacyConfirmed.value[issue.rateId]) return
  linkingLegacyRateId.value = issue.rateId
  legacyLinkMessages.value = { ...legacyLinkMessages.value,
    [issue.rateId]: 'Verificando la QUO histórica y su clave alternativa...' }
  try {
    // Step 1: admin action only PATCHes the unique existing historical Quote
    // with the immutable RateId, guarded by an ETag and live reads.
    await fetchClient<{ linked: boolean; quoteId: string }>(
      '/api/dynamics-admin/connections/principal/quote-sync-ledger/' +
        encodeURIComponent(issue.rateId) + '/' +
        encodeURIComponent(String(issue.revisionNumber)) + '/link-legacy', {
          method: 'POST', body: { quoteId, confirmExistingQuote: true },
        })
    legacyLinkMessages.value = { ...legacyLinkMessages.value,
      [issue.rateId]: 'Vínculo confirmado. Comprobando que se puede reanudar sin duplicados...' }
    // Step 2: Pricing independently asks the keyed connector to confirm
    // the link by the ACTIVE alternate key and that v8 was never written.
    const resumed = await fetchClient<{ message: string; existingQuoteId: string }>(
      '/api/pricing/rates/' + encodeURIComponent(issue.rateId) +
      '/dynamics-sync/resume-linked-legacy', { method: 'POST' })
    legacyLinkMessages.value = { ...legacyLinkMessages.value,
      [issue.rateId]: resumed.message || 'Reanudada la QUO existente sin crear otra.' }
    legacyConfirmed.value = { ...legacyConfirmed.value, [issue.rateId]: false }
    await refresh()
  } catch (error) {
    legacyLinkMessages.value = { ...legacyLinkMessages.value,
      [issue.rateId]: error instanceof ApiError
        ? (error.code ? '[' + error.code + '] ' : '') + getApiErrorMessage(error)
        : error instanceof Error ? error.message :
          'No se pudo confirmar el vínculo o reanudar la tarifa. No se creó otra QUO.' }
    // Never submit the resume step after a failed/unconfirmed PATCH.
  } finally {
    linkingLegacyRateId.value = null
  }
}


async function recoverRejected(issue: QuoteIssue) {
  const ledger = ledgerByRate.value[issue.rateId]
  if (!isAdministrator.value || recoveringRateId.value || issue.retryBlockReason ||
      issue.status !== 'NeedsAttention' ||
      ledger?.header.status !== 'rejected' || ledger.total.status !== 'not_sent' ||
      ledger.header.recordId || ledger.total.recordId) return
  recoveringRateId.value = issue.rateId
  recoveryMessages.value = { ...recoveryMessages.value, [issue.rateId]: '' }
  try {
    const result = await fetchClient<{ recoveryAttempt: number }>(
      `/api/pricing/rates/${encodeURIComponent(issue.rateId)}/dynamics-sync/recover-rejected`,
      {
        method: 'POST',
      })
    recoveryMessages.value = { ...recoveryMessages.value,
      [issue.rateId]: `Reenvío r${result.recoveryAttempt} autorizado. Dynamics está procesando la creación de la QUO y su línea; el resultado se actualizará automáticamente.` }
    await refresh()
  } catch (error) {
    const message = error instanceof ApiError
      ? (error.code ? '[' + error.code + '] ' : '') + getApiErrorMessage(error)
      : error instanceof Error ? error.message : 'No fue posible autorizar la recuperación.'
    recoveryMessages.value = { ...recoveryMessages.value, [issue.rateId]: message }
  } finally {
    recoveringRateId.value = null
  }
}


async function reconcileConfirmed(issue: QuoteIssue) {
  const ledger = ledgerByRate.value[issue.rateId]
  if (!isAdministrator.value || reconcilingRateId.value ||
      issue.status !== 'NeedsAttention' ||
      ledger?.header.status !== 'succeeded' || !ledger.header.recordId ||
      ledger?.total.status !== 'succeeded' || !ledger.total.recordId) return
  reconcilingRateId.value = issue.rateId
  reconcileMessages.value = { ...reconcileMessages.value, [issue.rateId]: '' }
  try {
    const result = await fetchClient<{ status: string; message: string }>(
      '/api/pricing/rates/' + encodeURIComponent(issue.rateId) +
        '/dynamics-sync/reconcile-confirmed', { method: 'POST' })
    reconcileMessages.value = { ...reconcileMessages.value,
      [issue.rateId]: result.message ||
        'QUO y línea conciliadas contra el historial sin reenviar a Dynamics.' }
    await refresh()
  } catch (error) {
    reconcileMessages.value = { ...reconcileMessages.value,
      [issue.rateId]: error instanceof ApiError
        ? (error.code ? '[' + error.code + '] ' : '') + getApiErrorMessage(error)
        : error instanceof Error ? error.message :
          'No se pudo confirmar la QUO en el historial. No se modificó la tarifa.' }
  } finally {
    reconcilingRateId.value = null
  }
}

async function verifyQuoteLedger(issue: QuoteIssue): Promise<QuoteLedger | null> {
  if (!isAdministrator.value || checkingLedgerRateId.value) return null
  checkingLedgerRateId.value = issue.rateId
  ledgerErrors.value = { ...ledgerErrors.value, [issue.rateId]: '' }
  try {
    const result = await fetchClient<QuoteLedger>(
      '/api/dynamics-admin/connections/principal/quote-sync-ledger/' +
        encodeURIComponent(issue.rateId) + '/' +
        encodeURIComponent(String(issue.revisionNumber)), { method: 'GET' })
    if (!result?.noPostExecuted || !result.header || !result.total)
      throw new Error('El conector devolvió un diagnóstico incompleto.')
    ledgerByRate.value = { ...ledgerByRate.value, [issue.rateId]: result }
    return result
  } catch (error) {
    ledgerErrors.value = { ...ledgerErrors.value, [issue.rateId]:
      error instanceof ApiError && error.status === 404
        ? 'La consulta de operaciones todavía no está disponible en el conector de producción (endpoint 404). Se requiere desplegar la versión correspondiente del conector; no significa que la oferta no exista.'
        : error instanceof ApiError && error.status === 403
          ? 'Sin permiso de administrador Dynamics para consultar el historial de esta operación.'
          : error instanceof Error ? error.message
            : 'No se pudo consultar el historial del conector.' }
    return null
  } finally {
    checkingLedgerRateId.value = null
  }
}

function ledgerLabel(record: LedgerEntry): string {
  switch (record.status) {
    case 'rejected': return 'Rechazada'
    case 'succeeded': return 'Creada'
    case 'reserved': return 'Reservada: comprobar'
    case 'ambiguous': return 'Sin confirmar'
    case 'reconciled': return 'Conciliada manualmente'
    default: return 'Sin envío registrado'
  }
}



async function checkWriteReadiness(): Promise<WriteReadiness> {
  if (!isAdministrator.value) {
    return { ready: false, code: 'DYNAMICS_NOT_AUTHORIZED',
      message: 'No tenés autorización para revisar las escrituras de QUO.', noPostExecuted: true }
  }
  checkingWrites.value = true
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET', path: '/api/pricing/rates/dynamics-sync/write-readiness',
    })
    const result = unwrapApiResponse<WriteReadiness>(response as never)
    if (typeof result?.ready !== 'boolean' || typeof result?.code !== 'string') {
      throw new Error('Respuesta de autorización inválida.')
    }
    writeReadiness.value = result
    if (result.configuredKeyId &&
        quoteKeys.value.some(key => key.id === result.configuredKeyId))
      selectedKeyId.value = result.configuredKeyId
    return result
  } catch {
    const unavailable: WriteReadiness = {
      ready: false, code: 'DYNAMICS_PREFLIGHT_UNAVAILABLE',
      message: 'No se pudo verificar la autorización en Pricing/Connector. No se reenviará la tarifa.',
      noPostExecuted: true,
    }
    writeReadiness.value = unavailable
    return unavailable
  } finally {
    checkingWrites.value = false
  }
}

// Always-available action: a click NEVER bypasses the write ledger or
// modifies a previously successful/ambiguous Dataverse operation.
async function retryWithoutDuplicate(issue: QuoteIssue) {
  if (retryDecisionRateId.value || retryingRateId.value || recoveringRateId.value) return
  const rateId = issue.rateId
  retryDecisionRateId.value = rateId
  retryMessages.value = { ...retryMessages.value, [rateId]: '' }
  try {
    if (!isAdministrator.value) {
      retryMessages.value = { ...retryMessages.value, [rateId]:
        'La acción es visible, pero la recuperación y verificación requieren permisos de administrador de Dynamics.' }
      return
    }
    if (issue.retryBlockReason) {
      retryMessages.value = { ...retryMessages.value, [rateId]:
        'No se enviará una revisión desactualizada: ' + issue.retryBlockReason }
      return
    }
    if (issue.status === 'Pending' || issue.status === 'Processing' || issue.status === 'Retry') {
      await refresh()
      retryMessages.value = { ...retryMessages.value, [rateId]:
        'Este trabajo ya está en cola, en proceso o programado para reintentar. No se generó otra oferta.' }
      return
    }

    const ledger = await verifyQuoteLedger(issue)
    if (!ledger) {
      retryMessages.value = { ...retryMessages.value, [rateId]:
        'No fue posible verificar el historial de Dataverse. No se envió otra QUO; consultá el error de verificación.' }
      return
    }
    if (ledger.header.status === 'succeeded' && ledger.total.status === 'succeeded') {
      if (issue.status === 'NeedsAttention') {
        await reconcileConfirmed(issue)
        retryMessages.value = { ...retryMessages.value, [rateId]:
          'El conector ya registró cabecera y línea. Se comprobó la conciliación sin generar una segunda QUO.' }
      } else {
        retryMessages.value = { ...retryMessages.value, [rateId]:
          'Cabecera y línea registradas. No se intentó crear otra oferta.' }
      }
      return
    }
    if (issue.status === 'Completed') {
      retryMessages.value = { ...retryMessages.value, [rateId]:
        'El trabajo está completado en Pricing. Verificá la existencia en Dataverse: no se vuelve a crear.' }
      return
    }
    if (issue.status !== 'NeedsAttention') {
      retryMessages.value = { ...retryMessages.value, [rateId]:
        'El estado actual no admite un nuevo envío. Se consultó el historial sin escribir en Dynamics.' }
      return
    }
    if (ledger.header.status === 'rejected' && ledger.total.status === 'not_sent' &&
        !ledger.header.recordId && !ledger.total.recordId) {
      // One click: the backend checks the prior 4xx ledger, read-only
      // lookups and text limits, then queues a fresh safe idempotency key.
      // Never bypass reconciliation for reserved/ambiguous/succeeded writes.
      await recoverRejected(issue)
      return
    }
    if (ledger.header.status !== 'not_sent' || ledger.total.status !== 'not_sent') {
      retryMessages.value = { ...retryMessages.value, [rateId]:
        'Hay una cabecera o línea previa, reservada o con resultado incierto. Conciliá antes de intentar otra escritura para evitar duplicados.' }
      return
    }
    if (issue.retryableWithoutDuplicateRisk) {
      await retryConfirmedPreWrite(issue)
      return
    }
    retryMessages.value = { ...retryMessages.value, [rateId]:
      'No existe confirmación de fallo seguro anterior a la escritura. Revisá el historial; no se creó una QUO nueva.' }
  } finally {
    retryDecisionRateId.value = null
  }
}

async function retryConfirmedPreWrite(issue: QuoteIssue) {
  if (!isAdministrator.value || retryingRateId.value ||
      issue.status !== 'NeedsAttention' || !issue.retryableWithoutDuplicateRisk ||
      issue.retryBlockReason) return
  retryingRateId.value = issue.rateId
  retryMessages.value = { ...retryMessages.value, [issue.rateId]: '' }
  try {
    const readiness = await checkWriteReadiness()
    if (!readiness.ready) {
      retryMessages.value = { ...retryMessages.value, [issue.rateId]:
        'No se encoló: ' + readiness.message + ' (' + readiness.code + ').' }
      return
    }
    await callEndpoint<unknown>({
      method: 'POST',
      path: `/api/pricing/rates/${encodeURIComponent(issue.rateId)}/dynamics-sync/retry`,
    })
    retryMessages.value = { ...retryMessages.value,
      [issue.rateId]: 'Reintento encolado con la misma revisión e identificador.' }
    await refresh()
  } catch (error) {
    // Preserve the provider code instead of hiding code-only 404/409 responses
    // behind the generic global message 'No se encontró el registro solicitado'.
    const message = error instanceof ApiError
      ? (error.code ? '[' + error.code + '] ' : 'HTTP ' + error.status + ': ') +
        getApiErrorMessage(error)
      : error instanceof Error ? error.message : 'No se pudo reintentar. Revisá el estado actual.'
    retryMessages.value = { ...retryMessages.value, [issue.rateId]: message }
  } finally {
    retryingRateId.value = null
  }
}

async function refreshTrackedDelivery() {
  const rateId = trackedRateId.value
  if (!rateId) return
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: `/api/pricing/rates/${encodeURIComponent(rateId)}/dynamics-sync`,
    })
    const detail = unwrapApiResponse<{
      deliveries: TrackedDelivery[]
      currentRevision: number
    }>(response as never)
    if (trackedRateId.value !== rateId) return
    const revision = trackedRevision.value ?? detail.currentRevision
    trackedDelivery.value = (detail.deliveries || [])
      .find(delivery => delivery.revisionNumber === revision) ?? null
    trackedLoadError.value = trackedDelivery.value
      ? '' : 'No se encontró el registro de esta revisión en la consulta individual. Revisá su historial antes de volver a encolar.'
  } catch (error) {
    if (trackedRateId.value !== rateId) return
    trackedLoadError.value = error instanceof Error
      ? error.message : 'No se pudo consultar el seguimiento de esta revisión.'
  }
}

function followRate(rateId: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(rateId.trim())) return
  trackedRateId.value = rateId.trim().toLowerCase()
  trackedRevision.value = null
  trackedDelivery.value = null
  trackedLoadError.value = ''
  rateSearch.value = trackedRateId.value
  statusFilter.value = 'all'
  void refreshTrackedDelivery()
}

function clearTrackedRate() {
  trackedRateId.value = ''
  trackedRevision.value = null
  trackedDelivery.value = null
  trackedLoadError.value = ''
  rateSearch.value = ''
  statusFilter.value = 'active'
}

async function refresh() {
  if (loading.value) {
    if (trackedRateId.value) await refreshTrackedDelivery()
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rates/dynamics-sync/queue',
    })
    const result = unwrapApiResponse<{ issues: QuoteIssue[],
      missingQueuedJobs?: MissingQueuedRate[], queue: QueueSummary,
      worker?: WorkerStatus | null, refreshedAtUtc: string }>(response as never)
    issues.value = Array.isArray(result?.issues) ? result.issues : []
    missingQueuedJobs.value = Array.isArray(result?.missingQueuedJobs)
      ? result.missingQueuedJobs : []
    queueSummary.value = result?.queue ?? emptyQueue()
    workerStatus.value = result?.worker ?? null
    lastQueueUpdate.value = result?.refreshedAtUtc ?? null
  } catch {
    loadError.value = 'No fue posible consultar las incidencias de Pricing. Verificá tus permisos o la conexión del servicio.'
  } finally {
    loading.value = false
  }
  if (trackedRateId.value) await refreshTrackedDelivery()
}

async function diagnose(rateId: string) {
  if (diagnosingRateId.value) return
  diagnosingRateId.value = rateId
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: `/api/pricing/rates/${encodeURIComponent(rateId)}/dynamics-sync/validate`,
    })
    const result = unwrapApiResponse<Diagnosis>(response as never)
    diagnoses.value = { ...diagnoses.value, [rateId]: result }
  } catch {
    diagnoses.value = { ...diagnoses.value, [rateId]: {
      valid: false,
      stage: 'consulta',
      code: 'DIAGNOSIS_UNAVAILABLE',
      message: 'No se pudo ejecutar la validación. Revisá los permisos de Dynamics y el estado de Pricing.',
    } }
  } finally {
    diagnosingRateId.value = null
  }
}

onMounted(() => {
  void refresh()
  void loadQuoteKeys()
  void checkWriteReadiness()
  // Lightweight near-live queue monitoring without submitting another QUO.
  // Clear both timers when leaving this view.
  queueRefreshTimer = setInterval(() => { void refresh() }, 3000)
  if (isAdministrator.value)
    readinessRefreshTimer = setInterval(() => { void checkWriteReadiness() }, 20000)
})
onUnmounted(() => {
  if (queueRefreshTimer !== null) clearInterval(queueRefreshTimer)
  if (readinessRefreshTimer !== null) clearInterval(readinessRefreshTimer)
})
</script>

<template>
  <section class="dynamics-panel quote-sync-panel" aria-label="Incidencias de ofertas de Pricing en Dynamics">
    <div class="dynamics-panel-header">
      <div>
        <p class="dynamics-section-label">SINCRONIZACIÓN · PRICING → DYNAMICS 365</p>
        <h2>Cola y sincronización de ofertas</h2>
        <p class="dynamics-subtitle">
          Consultá en vivo las ofertas en cola, en proceso, confirmadas y con errores.
          Esta pantalla solo consulta estados y no crea QUO.
        </p>
      </div>
      <button type="button" class="dynamics-outline-button" :disabled="loading" @click="refresh">
        <RefreshCw :size="15" :class="{ 'animate-spin': loading }" />
        {{ loading ? 'Consultando...' : 'Actualizar' }}
      </button>
    </div>

    <section v-if="isAdministrator" class="quote-sync-grants" aria-label="Publicar cualquier tarifa elegible">
      <div>
        <strong>Publicar una tarifa en Dynamics</strong>
        <p>Elegí cualquier tarifa aceptada con IDTRA por número QUO, cliente o referencia.
          Si existe un rechazo anterior a la escritura, se reintenta con la misma clave.
          Los trabajos ya creados nunca se duplican.</p>
        <div class="quote-sync-grant-controls">
          <input v-model.trim="selectedRateQuery" type="search"
            aria-label="Buscar tarifa para publicar en Dynamics"
            placeholder="QUO-00000-000364, cliente o IDTRA"
            @keydown.enter.prevent="searchRatesForDynamics" />
          <button type="button" class="dynamics-primary-button"
            :disabled="searchingRates || selectedRateQuery.trim().length < 2"
            @click="searchRatesForDynamics">
            <SearchCheck :size="15" /> {{ searchingRates ? 'Buscando...' : 'Buscar y elegir' }}
          </button>
        </div>
        <p v-if="searchedRatesError" class="quote-sync-error" role="alert">{{ searchedRatesError }}</p>
        <p v-if="publishingMessage" class="quote-sync-meta" role="status">{{ publishingMessage }}</p>
        <div v-if="searchedRates.length" class="quote-sync-list">
          <article v-for="rate in searchedRates" :key="rate.rateId" class="quote-sync-item">
            <div class="quote-sync-main">
              <strong>{{ rate.rateCode }}</strong>
              <p class="quote-sync-client">{{ rate.clientName }}</p>
              <p class="quote-sync-meta">{{ rate.rateName }}</p>
              <p class="quote-sync-meta">IDTRA: {{ rate.idtraNumber }} · REV {{ rate.revisionNumber }}
                · {{ syncStateLabel(rate.jobStatus, rate.rateId) }}</p>
            </div>
            <div class="quote-sync-actions">
              <button type="button" class="dynamics-primary-button"
                :disabled="Boolean(publishingRateId) || rate.jobStatus === 'Completed' ||
                  (rate.jobStatus !== 'NotQueued' &&
                   !(rate.jobStatus === 'NeedsAttention' && rate.canRetry))"
                @click="publishSelectedRate(rate)">
                <RefreshCw :size="15" />
                {{ publishingRateId === rate.rateId ? 'Solicitando envío...' :
                  rate.jobStatus === 'NotQueued' ? 'Publicar QUO' :
                  rate.jobStatus === 'NeedsAttention' && rate.canRetry ? 'Reintentar y publicar' :
                  rate.jobStatus === 'Completed' ? 'Ya publicada' : 'Revisar estado' }}
              </button>
              <button type="button" class="dynamics-outline-button"
                @click="followRate(rate.rateId)">Ver seguimiento</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <div class="quote-sync-queue-stats" aria-label="Resumen de sincronizaciones">
      <div><strong>{{ queueSummary.pending }}</strong><span>En cola</span></div>
      <div><strong>{{ queueSummary.processing }}</strong><span>Procesando</span></div>
      <div><strong>{{ queueSummary.retry }}</strong><span>Reintentos</span></div>
      <div><strong>{{ queueSummary.needsAttention }}</strong><span>Con error</span></div>
      <div><strong>{{ queueSummary.completed }}</strong><span>Confirmadas (total)</span></div>
    </div>
    <p class="quote-sync-meta" role="status">
      Actualización automática cada 3 segundos · Última consulta:
      {{ dateTimeLabel(lastQueueUpdate) }} · Se muestran trabajos activos recientes
      y las últimas 25 sincronizaciones completadas.
      <template v-if="writeReadiness && !writeReadiness.ready">
        <strong>Envíos pausados:</strong> {{ writeReadiness.message }}
      </template>
    </p>
    <p v-if="queueSummary.pending > 0 && workerStatus && !workerStatus.ready"
      class="quote-sync-error-detail" role="status">
      <strong>Cola de Dynamics pausada ({{ workerStatus.code }}):</strong>
      {{ workerExplanation }} Ninguna QUO pendiente se está enviando; reanudará automáticamente cuando el conector y el worker estén listos.
    </p>
    <div class="quote-sync-toolbar" role="search" aria-label="Buscar sincronizaciones">
      <input v-model="rateSearch" type="search" placeholder="Buscar QUO, cliente, IDTRA o tarifa…"
        aria-label="Buscar QUO, cliente o IDTRA" />
      <select v-model="statusFilter" aria-label="Filtrar estado de sincronización">
        <option value="active">Pendientes y errores</option>
        <option value="attention">Solo con error</option>
        <option value="completed">Completadas</option>
        <option value="all">Todas</option>
      </select>
      <button v-if="/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(rateSearch.trim())"
        type="button" class="dynamics-outline-button" @click="followRate(rateSearch)">
        Seguir revisión
      </button>
      <span class="quote-sync-meta">{{ visibleIssues.length }} resultados</span>
    </div>
    <section v-if="trackedRateId" class="quote-sync-tracking" aria-label="Seguimiento individual de Dynamics" role="status">
      <div class="quote-sync-head">
        <strong>Seguimiento de tarifa {{ trackedRateId }}{{ trackedRevision != null ? ' · REV ' + trackedRevision : '' }}</strong>
        <button type="button" class="dynamics-outline-button" @click="clearTrackedRate">
          Volver a ver todas
        </button>
      </div>
      <template v-if="trackedDelivery">
        <p><strong>Estado real en Pricing:</strong> {{ syncStateLabel(trackedDelivery.status, trackedRateId) }}
          · {{ trackedDelivery.attempts }} intento{{ trackedDelivery.attempts === 1 ? '' : 's' }}</p>
        <p v-if="trackedDelivery.error?.stage" class="quote-sync-meta">
          Etapa: {{ trackedDelivery.error.stage }}
          <template v-if="trackedDelivery.error.httpStatus"> · HTTP {{ trackedDelivery.error.httpStatus }}</template>
          <template v-if="trackedDelivery.error.providerCode"> · Código: {{ trackedDelivery.error.providerCode }}</template>
        </p>
        <p v-if="trackedDelivery.lastError || trackedDelivery.error?.message"
          class="quote-sync-error-detail" role="alert">
          {{ trackedDelivery.lastError || trackedDelivery.error?.message }}
        </p>
        <p v-if="trackedDelivery.error?.providerCode === 'quote_text_exceeds_dataverse_limit'"
          class="quote-sync-meta">
          Validación anterior a crear la cabecera. No se envió una QUO a Dataverse.
          <template v-if="trackedDelivery.error?.lookupInput">
            Campo excedido: <code>{{ trackedDelivery.error.lookupInput }}</code>
            · Límite: MaxLength del campo en Dynamics
          </template>
          Corregido el texto, usá «Reintentar sin duplicar» sobre esta revisión.
        </p>
        <p v-if="trackedDelivery.status === 'Completed'" class="quote-sync-meta">
          El conector informó la operación como completada. Verificá los identificadores de cabecera y línea en Dataverse antes de dar por creada la QUO.
        </p>
        <p v-else-if="trackedDelivery.status === 'NeedsAttention' &&
          trackedDelivery.error?.postAttempted &&
          trackedDelivery.error?.providerCode !== 'quote_text_exceeds_dataverse_limit'"
          class="quote-sync-error-detail">
          El envío a Dynamics pudo haberse ejecutado. Consultá «Verificar en Dynamics» en el registro inferior; no generés un nuevo intento sin conciliarlo.
        </p>
        <p v-else-if="trackedDelivery.status === 'Pending' || trackedDelivery.status === 'Processing' || trackedDelivery.status === 'Retry'"
          class="quote-sync-meta">
          Todavía no hay confirmación de creación de QUO en Dynamics. Esta vista se actualiza automáticamente.
        </p>
      </template>
      <p v-else class="quote-sync-meta">Consultando el trabajo de esta revisión. El POST de encolado por sí solo no crea una QUO.</p>
      <p v-if="trackedLoadError" class="quote-sync-error-detail" role="alert">{{ trackedLoadError }}</p>
    </section>
    <details v-if="isAdministrator" class="quote-sync-advanced">
      <summary class="quote-sync-advanced-trigger">
        <span>Configuración y herramientas de administración</span>
        <span class="quote-sync-meta">Permisos · Comprobaciones · Publicación avanzada por GUID</span>
      </summary>
    <div class="quote-sync-grants">
      <div>
        <strong>Autorizar importe total estándar de Dynamics</strong>
        <p>
          Elegí la clave activa de crear_oferta. Esta acción autoriza la lectura
          limitada de los vínculos configurados (cliente, IDTRA y divisa), la
          búsqueda de divisa por código ISO, los nueve campos de costo
          (monto1 con el total del proveedor y monto2–9 en cero), la
          lectura del identificador de quote y la creación de su línea de venta
          en quotedetail, conforme al catálogo aprobado. No crea ofertas ni reintenta tarifas.
        </p>
      </div>
      <div class="quote-sync-grant-controls">
        <select v-model="selectedKeyId" aria-label="Clave de crear oferta">
          <option value="">Seleccionar clave activa</option>
          <option v-for="key in quoteKeys" :key="key.id" :value="key.id">
            {{ key.label }} · v{{ key.templateVersion }} · {{ key.id.slice(0, 8) }}
          {{ writeReadiness?.configuredKeyId === key.id ? ' · Clave usada por Pricing' : '' }}
          </option>
        </select>
        <button class="dynamics-primary-button" type="button"
          :disabled="granting || !selectedKeyId ||
            Boolean(writeReadiness?.configuredKeyId &&
              writeReadiness.configuredKeyId !== selectedKeyId)" @click="grantQuoteTotal">
          {{ granting ? 'Autorizando...' : 'Autorizar vínculos y venta total' }}
        </button>
      </div>
      <p v-if="grantError" class="quote-sync-error" role="alert">{{ grantError }}</p>
      <p v-if="grantSuccess" class="quote-sync-ok" role="status">{{ grantSuccess }}</p>
      <p v-if="writeReadiness?.configuredKeyId && quoteKeys.length &&
        !quoteKeys.some(key => key.id === writeReadiness?.configuredKeyId)"
        class="quote-sync-error" role="alert">
        La clave configurada en el backend de Pricing no corresponde a ninguna
        clave activa de crear_oferta. No autorices otra clave: corregí la selección
        de versión o la clave usada por Pricing.
      </p>
      <p v-if="!quoteKeys.length" class="quote-sync-error">
        No hay claves vigentes para crear_oferta
        {{ currentQuoteVersion ? 'v' + currentQuoteVersion : '(sin versión activa)' }}.
        Generá una nueva clave para esa versión desde API CRUD y configurala
        también en DholePricing.
      </p>
      <p class="quote-sync-footnote">
        Si no aparece la clave o falta quotedetail, actualizá los metadatos y habilitá
        sus campos de creación en Catálogo antes de autorizar.
      </p>
    </div>

    <div class="quote-sync-grants">
      <div>
        <strong>Autorización de escrituras de QUO en producción</strong>
        <p>Esta comprobación utiliza la clave del backend de Pricing y consulta la
          política real de Dynamics; no crea ni modifica ofertas.</p>
        <p v-if="writeReadiness" role="status"
          :class="writeReadiness.ready ? 'quote-sync-ok' : 'quote-sync-error'">
          {{ writeReadiness.ready ? 'Habilitado' : 'Bloqueado' }}:
          {{ writeReadiness.message }} ({{ writeReadiness.code }})
        </p>
        <div v-if="writeReadiness?.missingGrants?.length" class="quote-sync-meta">
          <strong>Permisos específicos pendientes ({{ writeReadiness.missingGrants.length }}):</strong>
          <ul class="list-disc pl-5">
            <li v-for="grant in writeReadiness.missingGrants" :key="grant">
              <code>{{ grant }}</code>
            </li>
          </ul>
        </div>
        <p v-else-if="writeReadiness?.ready" class="quote-sync-meta">
          Todos los permisos de la plantilla activa fueron verificados.
        </p>
        <p v-else-if="!writeReadiness">Sin comprobar.</p>
      </div>
      <button class="dynamics-outline-button" type="button"
        :disabled="checkingWrites" @click="checkWriteReadiness">
        <RefreshCw :size="15" :class="{ 'animate-spin': checkingWrites }" />
        {{ checkingWrites ? 'Comprobando...' : 'Comprobar autorización' }}
      </button>
    </div>

    <div class="quote-sync-grants">
      <div>
        <strong>Probar QUO con tarifa aceptada e IDTRA</strong>
        <p>Escribí el GUID de una tarifa existente en Dhole, ya aceptada y con
          IDTRA asignado. Solo se encola su revisión si todavía no existe un
          trabajo de sincronización. Esta acción no envía un POST directo a Dataverse.</p>
      </div>
      <div class="quote-sync-grant-controls">
        <input v-model.trim="manualRateId" type="text"
          aria-label="GUID de tarifa Dhole" placeholder="GUID de la tarifa Dhole" />
        <button class="dynamics-primary-button" type="button"
          :disabled="enqueueing || !manualRateIdValid" @click="enqueueAccepted">
          {{ enqueueing ? 'Encolando...' : 'Encolar QUO aceptada' }}
        </button>
      </div>
      <p v-if="enqueueError" class="quote-sync-error" role="alert">{{ enqueueError }}</p>
      <p v-if="enqueueFeedback" class="quote-sync-ok" role="status">{{ enqueueFeedback }}</p>
    </div>

    </details>

    <section v-if="missingQueuedVisible.length" class="quote-sync-untracked"
      aria-label="Cotizaciones aceptadas sin sincronización">
      <div class="quote-sync-head">
        <strong>Ofertas aceptadas sin envío registrado ({{ missingQueuedVisible.length }})</strong>
        <span class="quote-sync-state">Revisar</span>
      </div>
      <p class="quote-sync-meta">Estas tarifas tienen IDTRA, pero no hay trabajo
        para su revisión actual. No significa que falten en Dynamics: comprobá
        que no se hayan creado manualmente antes de encolarlas.</p>
      <article v-for="rate in missingQueuedVisible" :key="rate.rateId"
        class="quote-sync-item">
        <div class="quote-sync-main">
          <strong>{{ rate.rateCode }}</strong>
          <p class="quote-sync-client">{{ rate.clientName }}</p>
          <p class="quote-sync-meta">
            {{ [rate.polName, rate.poeName, rate.podName].filter(Boolean).join(' → ') }}
            · {{ rate.incotermName }}
          </p>
          <p class="quote-sync-meta">IDTRA: {{ rate.idtraNumber }} · REV {{ rate.revisionNumber }}
            · Venta: {{ money(rate.totalSaleAmount, rate.currencyCode, rate.currencyName || '') }}</p>
        </div>
        <div class="quote-sync-actions">
          <RouterLink class="dynamics-outline-button"
            :to="{ path: '/pricing/rates', query: { rateId: rate.rateId } }">
            <ExternalLink :size="15" /> Ver tarifa
          </RouterLink>
          <button v-if="isAdministrator" type="button" class="dynamics-primary-button"
            :disabled="enqueueing || !writeReadiness?.ready"
            @click="enqueueMissingRate(rate.rateId)">
            Encolar revisión sin duplicar
          </button>
        </div>
      </article>
    </section>
    <p v-if="loadError" class="quote-sync-message quote-sync-error" role="alert">
      <AlertCircle :size="16" /> {{ loadError }}
    </p>
    <div v-else-if="loading && !issues.length" class="dynamics-empty">
      <RefreshCw :size="22" class="animate-spin" />
      <span>Consultando la cola de Dynamics...</span>
    </div>
    <p v-else-if="!visibleIssues.length && !missingQueuedVisible.length" class="quote-sync-message">
      No hay cotizaciones para el filtro actual. Las completadas siguen disponibles en «Completadas» y «Todas».
    </p>
    <div v-else class="quote-sync-list">
      <article v-for="issue in visibleIssues" :key="`${issue.rateId}-${issue.revisionNumber}`" class="quote-sync-item">
        <div class="quote-sync-main">
          <div class="quote-sync-head">
            <strong class="quote-sync-id">{{ issue.rate?.rateCode || issue.rate?.rateName || ('Tarifa ' + issue.rateId) }}</strong>
            <span class="quote-sync-state">{{ syncStateLabel(issue.status, issue.rateId) }}</span>
          </div>
          <p class="quote-sync-client">
            {{ issue.rate?.clientName || 'Cliente no disponible en la revisión registrada' }}
          </p>
          <p class="quote-sync-meta">
            {{ [issue.rate?.shipmentMode, issue.rate?.incotermName].filter(Boolean).join(' · ') }}
            <template v-if="issue.rate?.polName"> ·
              {{ [issue.rate.polName, issue.rate?.poeName, issue.rate?.podName].filter(Boolean).join(' → ') }}
            </template>
          </p>
          <p class="quote-sync-meta">
            IDTRA: <strong>{{ issue.rate?.idtraNumber || 'Sin IDTRA en el snapshot' }}</strong>
            · Ejecutivo: {{ issue.rate?.executiveName || '—' }}
          </p>
          <p class="quote-sync-meta">
            Venta: {{ money(issue.rate?.totalSaleAmount, issue.rate?.currencyCode || '', issue.rate?.currencyName || '') }}
            · Costo: {{ money(issue.rate?.totalCostAmount, issue.rate?.currencyCode || '', issue.rate?.currencyName || '') }}
            · Utilidad: {{ money(issue.rate?.totalUtilityAmount, issue.rate?.currencyCode || '', issue.rate?.currencyName || '') }}
          </p>
          <p class="quote-sync-meta">Revisión {{ issue.revisionNumber }} · {{ issue.attempts }} intento{{ issue.attempts === 1 ? '' : 's' }}
            <span v-if="issue.error?.stage"> · Etapa: {{ issue.error.stage }}</span>
            <span v-if="issue.error?.httpStatus"> · HTTP {{ issue.error.httpStatus }}</span>
          </p>
          <p v-if="issue.status === 'Pending' && workerStatus && !workerStatus.ready"
            class="quote-sync-error-detail" role="status">
            No se ha intentado enviar esta QUO. {{ workerExplanation }}
            Última actividad del worker: {{ dateTimeLabel(workerStatus.lastHeartbeatUtc) }}.
          </p>
          <p v-else-if="issue.status === 'Pending'" class="quote-sync-meta">Pendiente de ser tomada por el worker. Todavía no hay confirmación de Dynamics.</p>
          <p v-else-if="issue.status === 'Processing'" class="quote-sync-meta">Operación en ejecución. La creación y su línea de venta aún deben confirmarse.</p>
          <p v-else-if="issue.status === 'Completed'" class="quote-sync-meta">
            <strong>Completada en el registro del conector.</strong>
            Se requiere verificación de lectura en Dynamics para confirmar la existencia real.
            Finalizada: {{ dateTimeLabel(issue.completedAtUtc) }}.
          </p>
          <p v-else-if="issue.status === 'Retry'" class="quote-sync-meta">
            Próximo intento: {{ dateTimeLabel(issue.nextAttemptAtUtc) }}.
            No se genera una clave de idempotencia nueva.
          </p>
          <p v-if="issue.crm?.quoteId" class="quote-sync-meta">
            Identificador CRM: <code>{{ issue.crm.quoteId }}</code>
            · Línea: <code>{{ issue.crm.lineId || 'No confirmada' }}</code>
          </p>
          <p v-if="issue.status === 'NeedsAttention' || issue.status === 'Retry'"
            class="quote-sync-error-detail">{{ issue.lastError || issue.error?.message || 'Sin detalle del error anterior.' }}</p>
          <p v-if="(issue.status === 'NeedsAttention' || issue.status === 'Retry') &&
            issue.error?.providerCode" class="quote-sync-meta">
            Código del proveedor: {{ issue.error.providerCode }}
          </p>
          <div v-if="issue.error?.providerCode === 'legacy_quote_requires_rate_key_linking' ||
            (issue.error?.httpStatus === 409 && issue.error?.postAttempted)"
            class="quote-sync-diagnosis" role="alert">
            <AlertCircle :size="17" />
            <div>
              <strong v-if="issue.error?.providerCode === 'legacy_quote_requires_rate_key_linking'">
                Ya existe una cabecera CREATE histórica — falta vincular el RateId
              </strong>
              <strong v-else-if="ledgerByRate[issue.rateId]?.header.status === 'rejected' &&
                ledgerByRate[issue.rateId]?.total.status === 'not_sent'">
                Cabecera rechazada en Dataverse — requiere corregir el HTTP 400
              </strong>
              <strong v-else>Conciliación de QUO necesaria — no reintentar todavía</strong>
              <p v-if="issue.error?.providerCode === 'legacy_quote_requires_rate_key_linking'">
                Este HTTP 409 es un bloqueo anterior a la escritura de la revisión actual.
                El conector encontró una cabecera CREATE exitosa de esta tarifa en su
                historial, pero UPSERT no la localizó por el GUID de Dhole. Verificá en
                Dynamics la revisión histórica y enlazá su RateId antes de continuar.
                No generés otra oferta.
              </p>
              <p v-else-if="ledgerByRate[issue.rateId]?.header.status === 'rejected' &&
                ledgerByRate[issue.rateId]?.total.status === 'not_sent'">
                Resultado real del conector: cabecera rechazada
                (HTTP {{ ledgerByRate[issue.rateId]?.header.httpStatus ?? 'desconocido' }}).
                No se registró intento de la línea de venta. El HTTP 409 es la respuesta
                histórica de Pricing, no una confirmación de creación.
              </p>
              <p v-else>Dynamics pudo crear la cabecera, la línea de venta o ambas.
                El HTTP 409 no confirma que la operación no se haya ejecutado.</p>
              <p v-if="ledgerByRate[issue.rateId]?.header.status === 'rejected' &&
                ledgerByRate[issue.rateId]?.total.status === 'not_sent'">
                Dataverse rechazó la cabecera sin crear la línea. Podés reintentar
                desde el botón de abajo: el servidor verifica el historial, los vínculos
                permitidos y los límites de texto antes de generar otro envío.
              </p>
              <p v-else-if="issue.error?.providerCode !== 'legacy_quote_requires_rate_key_linking'">Consultá las operaciones <code>dhole-pricing-quote-{{ issue.rateId.replaceAll('-', '') }}-v{{ issue.revisionNumber }}-header</code>
                y <code>...-total</code> en el registro de idempotencia de Dynamics antes de volver a enviar.</p>
            </div>
          </div>
          <div v-if="ledgerByRate[issue.rateId]?.legacy?.hasPriorSuccessfulCreate"
            class="quote-sync-diagnosis" role="alert">
            <AlertCircle :size="17" />
            <div>
              <strong>Cabecera CREATE encontrada en una revisión anterior</strong>
              <p>
                {{ ledgerByRate[issue.rateId]!.legacy!.priorHeaderCount }}
                operación(es) CREATE exitosa(s) registrada(s) para esta tarifa.
                <template v-if="ledgerByRate[issue.rateId]!.legacy!.historyTruncated">
                  El historial está limitado y requiere revisión administrativa completa.
                </template>
              </p>
              <p v-for="(candidate, index) in ledgerByRate[issue.rateId]!.legacy!.candidates"
                :key="index">
                Revisión {{ candidate.revisionNumber }} ·
                Quote ID: <code>{{ candidate.quoteId || 'No registrado' }}</code>
              </p>
              <p v-if="ledgerByRate[issue.rateId]!.legacy!.uniqueQuoteId">
                Identificador único candidato:
                <code>{{ ledgerByRate[issue.rateId]!.legacy!.uniqueQuoteId }}</code>
                · Estado de lectura en Dynamics:
                {{ ledgerByRate[issue.rateId]!.legacy!.liveQuoteStatus }}
              </p>
              <p v-else>
                No existe un identificador histórico único y completo. Se requiere
                conciliación manual del historial antes de cualquier escritura.
              </p>
              <a v-if="quoteUrl(ledgerByRate[issue.rateId]!.legacy!.uniqueQuoteId)"
                :href="quoteUrl(ledgerByRate[issue.rateId]!.legacy!.uniqueQuoteId) || undefined"
                target="_blank" rel="noopener noreferrer" class="dynamics-outline-button">
                <ExternalLink :size="15" /> Inspeccionar QUO histórica en Dynamics
              </a>
              <p>
                Verificá en Dynamics que este registro corresponde a
                {{ issue.rate?.clientName }} ({{ issue.rate?.idtraNumber }}).
                Al confirmar, se vinculará el RateId a la QUO histórica y después
                se intentará actualizar esa misma oferta. No se creará otra cabecera.
              </p>
              <label v-if="isAdministrator && issue.status === 'NeedsAttention' &&
                issue.error?.providerCode === 'legacy_quote_requires_rate_key_linking' &&
                ledgerByRate[issue.rateId]!.legacy!.uniqueQuoteId &&
                ledgerByRate[issue.rateId]!.legacy!.liveQuoteExists === true &&
                !ledgerByRate[issue.rateId]!.legacy!.historyTruncated &&
                !issue.retryBlockReason"
                class="quote-sync-recovery-check">
                <input type="checkbox"
                  :checked="Boolean(legacyConfirmed[issue.rateId])"
                  :disabled="Boolean(linkingLegacyRateId)"
                  @change="legacyConfirmed[issue.rateId] = ($event.target as HTMLInputElement).checked" />
                Confirmo que revisé el registro existente, el cliente y el IDTRA.
              </label>
              <button v-if="isAdministrator && issue.status === 'NeedsAttention' &&
                issue.error?.providerCode === 'legacy_quote_requires_rate_key_linking'"
                type="button" class="dynamics-primary-button"
                :disabled="!legacyConfirmed[issue.rateId] || Boolean(linkingLegacyRateId) ||
                  !ledgerByRate[issue.rateId]!.legacy!.uniqueQuoteId ||
                  ledgerByRate[issue.rateId]!.legacy!.liveQuoteExists !== true ||
                  ledgerByRate[issue.rateId]!.legacy!.historyTruncated ||
                  Boolean(issue.retryBlockReason)"
                @click="linkLegacyAndResume(issue)">
                <RefreshCw :size="15" />
                {{ linkingLegacyRateId === issue.rateId
                  ? 'Vinculando y verificando...' : 'Vincular QUO existente y reenviar revisión' }}
              </button>
              <p v-if="legacyLinkMessages[issue.rateId]" role="status"
                class="quote-sync-meta">{{ legacyLinkMessages[issue.rateId] }}</p>
            </div>
          </div>
          <div v-if="ledgerByRate[issue.rateId]?.live" class="quote-sync-diagnosis"
            role="status">
            <CheckCircle2 v-if="ledgerByRate[issue.rateId]?.live?.confirmed" :size="16" />
            <AlertCircle v-else :size="16" />
            <div>
              <strong>{{ ledgerByRate[issue.rateId]?.live?.confirmed
                ? 'Existencia verificada directamente en Dynamics'
                : 'Existencia en Dynamics no confirmada' }}</strong>
              <p>Cabecera: {{ ledgerByRate[issue.rateId]?.live?.headerStatus }} ·
                Línea: {{ ledgerByRate[issue.rateId]?.live?.detailStatus }}</p>
              <p>Si falta permiso de lectura, el resultado es desconocido,
                no una confirmación de que el registro no exista.</p>
            </div>
          </div>
          <div v-if="ledgerByRate[issue.rateId]" class="quote-sync-diagnosis" role="status">
            <SearchCheck :size="17" />
            <div>
              <strong>Operaciones verificadas en Dynamics (solo lectura)</strong>
              <p>Cabecera: {{ ledgerLabel(ledgerByRate[issue.rateId]!.header) }}
                <template v-if="ledgerByRate[issue.rateId]!.header.httpStatus">
                  · HTTP {{ ledgerByRate[issue.rateId]!.header.httpStatus }}
                </template>
                <template v-if="ledgerByRate[issue.rateId]!.header.providerCode">
                  · Código {{ ledgerByRate[issue.rateId]!.header.providerCode }}
                </template>
              </p>
              <p>Línea de venta: {{ ledgerLabel(ledgerByRate[issue.rateId]!.total) }}
                <template v-if="ledgerByRate[issue.rateId]!.total.httpStatus">
                  · HTTP {{ ledgerByRate[issue.rateId]!.total.httpStatus }}
                </template>
              </p>
              <p>Esta consulta no reintenta ni crea QUO. Una cabecera rechazada
                requiere corregir el fallo y realizar una recuperación controlada.</p>
            </div>
          </div>
          <p v-if="recoveryMessages[issue.rateId]" class="quote-sync-meta" role="status">
            {{ recoveryMessages[issue.rateId] }}
          </p>
          <p v-if="ledgerErrors[issue.rateId]" class="quote-sync-error-detail" role="alert">
            {{ ledgerErrors[issue.rateId] }}
          </p>
          <p v-if="issue.retryBlockReason" class="quote-sync-error-detail" role="alert">
            Reintento bloqueado: {{ issue.retryBlockReason }}
            <template v-if="issue.currentRateRevision && issue.currentRateRevision !== issue.revisionNumber">
              (revisión actual: {{ issue.currentRateRevision }})
            </template>
          </p>
          <p v-if="issue.error?.lookupInput && issue.error?.providerCode === 'quote_text_exceeds_dataverse_limit'"
            class="quote-sync-meta">
            Texto excedido en Dynamics: <code>{{ issue.error.lookupInput }}</code>
            · Se valida contra MaxLength del campo, sin modificar la tarifa original.
          </p>
          <p v-else-if="issue.error?.lookupInput" class="quote-sync-meta">
            Relación sin resolver: <code>{{ issue.error.lookupInput }}</code>
            <template v-if="issue.error.lookupSearchField">
              · Campo de búsqueda: <code>{{ issue.error.lookupSearchField }}</code>
            </template>
          </p>
          <p v-else-if="issue.error?.providerCode === 'lookup_name_not_found'" class="quote-sync-meta">
            Hay una referencia de cliente o IDTRA que no coincide con Dynamics.
            Usá «Diagnosticar» para identificar la relación antes de reintentar.
          </p>
          <p v-if="retryMessages[issue.rateId]" class="quote-sync-meta" role="status">
            {{ retryMessages[issue.rateId] }}
          </p>
          <div v-if="diagnoses[issue.rateId]" class="quote-sync-diagnosis" :class="{ 'quote-sync-ok': diagnoses[issue.rateId]?.valid }" role="status">
            <CheckCircle2 v-if="diagnoses[issue.rateId]?.valid" :size="16" />
            <AlertCircle v-else :size="16" />
            <div>
              <strong>{{ diagnoses[issue.rateId]?.valid ? 'Relaciones verificadas' : 'Diagnóstico' }}</strong>
              <p>{{ diagnoses[issue.rateId]?.message }}</p>
              <p v-if="diagnoses[issue.rateId]?.lookupInput">
                Relación: <code>{{ diagnoses[issue.rateId]?.lookupInput }}</code>
                <template v-if="diagnoses[issue.rateId]?.lookupSearchField">
                  · Campo de Dynamics: <code>{{ diagnoses[issue.rateId]?.lookupSearchField }}</code>
                </template>
              </p>
              <small v-if="diagnoses[issue.rateId]?.code">{{ diagnoses[issue.rateId]?.code }}</small>
            </div>
          </div>
        </div>
        <div class="quote-sync-actions">
          <RouterLink class="dynamics-outline-button" :to="{ path: '/pricing/rates', query: { rateId: issue.rateId } }">
            <ExternalLink :size="15" /> Ver tarifa
          </RouterLink>
          <button v-if="isAdministrator && (issue.status === 'Completed' ||
              issue.status === 'NeedsAttention' || issue.status === 'Retry')" type="button"
            class="dynamics-outline-button" :disabled="Boolean(checkingLedgerRateId)"
            @click="verifyQuoteLedger(issue)">
            <SearchCheck :size="15" />
            {{ checkingLedgerRateId === issue.rateId ? 'Verificando...' : 'Verificar en Dynamics' }}
          </button>
          <a v-if="quoteUrl(ledgerByRate[issue.rateId]?.header.recordId || issue.crm?.quoteId)"
            :href="quoteUrl(ledgerByRate[issue.rateId]?.header.recordId || issue.crm?.quoteId) || undefined"
            target="_blank" rel="noopener noreferrer" class="dynamics-outline-button">
            <ExternalLink :size="15" /> Abrir registro en Dynamics
          </a>
          <button v-if="isAdministrator && issue.status === 'NeedsAttention' &&
              ledgerByRate[issue.rateId]?.header.status === 'succeeded' &&
              ledgerByRate[issue.rateId]?.header.recordId &&
              ledgerByRate[issue.rateId]?.total.status === 'succeeded' &&
              ledgerByRate[issue.rateId]?.total.recordId"
            type="button" class="dynamics-primary-button"
            :disabled="Boolean(reconcilingRateId)" @click="reconcileConfirmed(issue)">
            <CheckCircle2 :size="15" />
            {{ reconcilingRateId === issue.rateId ? 'Conciliando...' : 'Confirmar QUO ya creada (sin duplicar)' }}
          </button>
          <p v-if="reconcileMessages[issue.rateId]" class="quote-sync-meta" role="status">
            {{ reconcileMessages[issue.rateId] }}
          </p>
          <button v-if="issue.status === 'NeedsAttention' || issue.status === 'Retry'"
            type="button" class="dynamics-primary-button"
            :disabled="Boolean(diagnosingRateId)" @click="diagnose(issue.rateId)">
            <SearchCheck :size="15" />
            {{ diagnosingRateId === issue.rateId ? 'Diagnóstico en curso...' : 'Diagnosticar' }}
          </button>
          <button v-if="issue.error?.providerCode !== 'legacy_quote_requires_rate_key_linking'"
            type="button" class="dynamics-outline-button"
            :disabled="Boolean(retryingRateId) || Boolean(retryDecisionRateId) ||
              Boolean(checkingLedgerRateId) || Boolean(recoveringRateId)"
            :aria-label="'Reintentar sin duplicar y comprobar el historial de ' +
              (issue.rate?.rateCode || issue.rateId)"
            @click="retryWithoutDuplicate(issue)">
            <RefreshCw :size="15" />
            {{ retryDecisionRateId === issue.rateId || retryingRateId === issue.rateId
              ? 'Verificando y enviando...' : 'Reintentar sin duplicar' }}
          </button>
        </div>
      </article>
    </div>
    <p class="quote-sync-footnote">
      «Reintentar sin duplicar» verifica el historial de Dynamics en el mismo clic.
      Si la cabecera fue rechazada con HTTP 4xx y la línea nunca se envió,
      valida el mapeo de IDTRA, moneda y límites de texto y solicita la creación
      inmediatamente. Nunca reenvía operaciones ambiguas ni cuotas ya creadas.
    </p>
  </section>
</template>

<style scoped>
.quote-sync-recovery{border:1px solid var(--dh-border);padding:12px;border-radius:12px;margin:12px 0}
.quote-sync-recovery textarea{display:block;width:100%;background:var(--dh-card);color:var(--dh-text);border:1px solid var(--dh-border);padding:8px;border-radius:7px}
.quote-sync-recovery-label{display:block;font-weight:600;margin:10px 0 6px}
.quote-sync-recovery-check{display:flex;align-items:center;gap:8px;margin:10px 0}
.quote-sync-grants{border:1px solid var(--dh-border);border-radius:14px;margin-bottom:16px;padding:16px;background:var(--dh-card)}
.quote-sync-grants strong{font-size:13px}
.quote-sync-grants p{font-size:12px;color:var(--dh-text-muted);margin:7px 0}
.quote-sync-grant-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:12px 0}
.quote-sync-grant-controls select{border:1px solid var(--dh-border);border-radius:10px;padding:10px;flex:1;min-width:180px;background:var(--dh-card);color:var(--dh-text)}
.quote-sync-grant-controls button{padding:10px 14px}

.quote-sync-panel{margin-top:18px}
.quote-sync-list{display:grid;gap:12px}
.quote-sync-advanced{margin:16px 0;border:1px solid var(--dh-border);border-radius:14px;padding:10px;background:var(--dh-surface)}
.quote-sync-advanced-trigger{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;cursor:pointer;font-weight:750;flex-wrap:wrap}
.quote-sync-advanced[open] .quote-sync-advanced-trigger{margin-bottom:14px}
.quote-sync-advanced>.quote-sync-grants{margin:10px 0}

.quote-sync-untracked{display:grid;gap:10px;margin:18px 0;padding:14px;border:1px solid var(--dh-border);border-radius:14px}
.quote-sync-untracked>.quote-sync-head{justify-content:space-between}

.quote-sync-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:16px 0}
.quote-sync-toolbar input,.quote-sync-toolbar select{background:var(--dh-card);color:var(--dh-text);border:1px solid var(--dh-border);border-radius:9px;padding:10px 12px}
.quote-sync-toolbar input{flex:1;min-width:210px}
.quote-sync-client{font-size:14px;font-weight:650;margin:8px 0 5px}

.quote-sync-queue-stats{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:10px;margin:14px 0}
.quote-sync-queue-stats>div{display:flex;flex-direction:column;gap:3px;padding:12px;border:1px solid var(--dh-border);border-radius:12px;background:var(--dh-card)}
.quote-sync-queue-stats strong{font-size:22px;font-variant-numeric:tabular-nums}
.quote-sync-queue-stats span{font-size:12px;color:var(--dh-text-muted)}
@media(max-width:850px){.quote-sync-queue-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
.quote-sync-tracking{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dh-border);background:var(--dh-card);border-radius:14px;padding:16px;margin:12px 0}
.quote-sync-tracking p{margin:0}
.quote-sync-tracking .quote-sync-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.quote-sync-tracking strong{overflow-wrap:anywhere}
.quote-sync-item{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:17px;border:1px solid var(--dh-border);border-radius:16px;background:var(--dh-card)}
.quote-sync-main{min-width:0;flex:1}
.quote-sync-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.quote-sync-id{font-size:13px;overflow-wrap:anywhere}
.quote-sync-state{border:1px solid #d97706;color:#d97706;border-radius:30px;padding:3px 9px;font-size:11px;font-weight:700}
.quote-sync-meta{color:var(--dh-text-muted);margin:7px 0;font-size:12px}
.quote-sync-error-detail{font-size:13px;overflow-wrap:anywhere}
.quote-sync-actions{display:flex;flex-wrap:wrap;gap:8px;flex-shrink:0}
.quote-sync-actions .dynamics-outline-button,.quote-sync-actions .dynamics-primary-button{display:inline-flex;align-items:center;gap:7px;text-decoration:none;white-space:nowrap}
.quote-sync-message{display:flex;align-items:center;gap:10px;padding:16px;border-radius:12px;border:1px solid var(--dh-border);font-size:13px}
.quote-sync-ok{color:#059669}
.quote-sync-error{color:#dc2626}
.quote-sync-diagnosis{display:flex;gap:9px;padding:12px;margin-top:12px;border:1px solid var(--dh-border);border-radius:12px;font-size:12px}
.quote-sync-diagnosis p{margin:4px 0;overflow-wrap:anywhere}
.quote-sync-diagnosis small{color:var(--dh-text-muted)}
.quote-sync-footnote{font-size:12px;color:var(--dh-text-muted);margin:14px 0 0}
@media(max-width:850px){.quote-sync-item{flex-direction:column}.quote-sync-actions{width:100%}}
</style>
