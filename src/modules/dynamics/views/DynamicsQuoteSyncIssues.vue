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
  noPostExecuted: boolean
}

type QuoteIssue = {
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
const auth = useAuthStore()
const isAdministrator = computed(() => auth.hasScope('dynamics.security.admin'))
const quoteKeys = ref<QuoteCrudKey[]>([])
const currentQuoteVersion = ref<number | null>(null)
const selectedKeyId = ref('')
const granting = ref(false)
const grantError = ref('')
const grantSuccess = ref('')
const manualRateId = ref('')
const enqueueing = ref(false)
const enqueueFeedback = ref('')
const enqueueError = ref('')
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
    enqueueFeedback.value = result.alreadyQueued
      ? `La revisión v${result.revisionNumber} ya tiene sincronización en estado ${result.status}. No se duplicó.`
      : `Revisión v${result.revisionNumber} encolada. Podés consultar su avance en Pricing.`
    await refresh()
  } catch (error) {
    enqueueError.value = error instanceof Error ? error.message :
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
      k.entityName === 'quote' && k.operation === 'create' &&
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
    grantError.value = error instanceof ApiError
      ? (error.code ? '[' + error.code + '] ' : 'HTTP ' + error.status + ': ') +
        getApiErrorMessage(error)
      : error instanceof Error ? error.message :
        'No fue posible habilitar los permisos. Confirmá los campos de quote y quotedetail en Catálogo.'
  } finally {
    granting.value = false
  }
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
const issues = ref<QuoteIssue[]>([])
const queueSummary = ref<QueueSummary>(emptyQueue())
const lastQueueUpdate = ref<string | null>(null)
let queueRefreshTimer: ReturnType<typeof setInterval> | null = null
let readinessRefreshTimer: ReturnType<typeof setInterval> | null = null

function syncStateLabel(status: string): string {
  switch (status) {
    case 'Pending': return 'En cola'
    case 'Processing': return 'Enviando a Dynamics'
    case 'Retry': return 'Reintento programado'
    case 'NeedsAttention': return 'Requiere atención'
    case 'Completed': return 'Confirmada en Dynamics'
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
const retryMessages = ref<Record<string, string>>({})
const writeReadiness = ref<WriteReadiness | null>(null)
const checkingWrites = ref(false)
const ledgerByRate = ref<Record<string, QuoteLedger>>({})
const ledgerErrors = ref<Record<string, string>>({})
const checkingLedgerRateId = ref<string | null>(null)
const reconcilingRateId = ref<string | null>(null)
const reconcileMessages = ref<Record<string,string>>({})
const recoveringRateId = ref<string | null>(null)
const recoveryOpenedRateId = ref<string | null>(null)
const recoveryReason = ref<Record<string,string>>({})
const recoveryConfirm = ref<Record<string,boolean>>({})
const recoveryMessages = ref<Record<string,string>>({})

async function recoverRejected(issue: QuoteIssue) {
  const ledger = ledgerByRate.value[issue.rateId]
  if (!isAdministrator.value || recoveringRateId.value || issue.retryBlockReason ||
      issue.status !== 'NeedsAttention' || !diagnoses.value[issue.rateId]?.valid ||
      ledger?.header.status !== 'rejected' || ledger.total.status !== 'not_sent' ||
      !recoveryConfirm.value[issue.rateId] ||
      (recoveryReason.value[issue.rateId] ?? '').trim().length < 10) return
  recoveringRateId.value = issue.rateId
  recoveryMessages.value = { ...recoveryMessages.value, [issue.rateId]: '' }
  try {
    const result = await fetchClient<{ recoveryAttempt: number }>(
      `/api/pricing/rates/${encodeURIComponent(issue.rateId)}/dynamics-sync/recover-rejected`,
      {
        method: 'POST',
        body: {
          confirmation: 'RECUPERAR_QUO',
          reason: recoveryReason.value[issue.rateId]!.trim(),
        },
      })
    recoveryMessages.value = { ...recoveryMessages.value,
      [issue.rateId]: `Recuperación r${result.recoveryAttempt} encolada. El worker validará la clave nueva antes de crear la oferta.` }
    recoveryOpenedRateId.value = null
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

async function verifyQuoteLedger(issue: QuoteIssue) {
  if (!isAdministrator.value || checkingLedgerRateId.value) return
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
  } catch (error) {
    ledgerErrors.value = { ...ledgerErrors.value, [issue.rateId]:
      error instanceof ApiError && error.status === 404
        ? 'La consulta de operaciones todavía no está disponible en el conector de producción (endpoint 404). Se requiere desplegar la versión correspondiente del conector; no significa que la oferta no exista.'
        : error instanceof ApiError && error.status === 403
          ? 'Sin permiso de administrador Dynamics para consultar el historial de esta operación.'
          : error instanceof Error ? error.message
            : 'No se pudo consultar el historial del conector.' }
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

async function refresh() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rates/dynamics-sync/queue',
    })
    const result = unwrapApiResponse<{ issues: QuoteIssue[], queue: QueueSummary,
      refreshedAtUtc: string }>(response as never)
    issues.value = Array.isArray(result?.issues) ? result.issues : []
    queueSummary.value = result?.queue ?? emptyQueue()
    lastQueueUpdate.value = result?.refreshedAtUtc ?? null
  } catch {
    loadError.value = 'No fue posible consultar las incidencias de Pricing. Verificá tus permisos o la conexión del servicio.'
  } finally {
    loading.value = false
  }
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

    <div v-if="isAdministrator" class="quote-sync-grants">
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

    <div v-if="isAdministrator" class="quote-sync-grants">
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

    <div v-if="isAdministrator" class="quote-sync-grants">
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
    <p v-if="loadError" class="quote-sync-message quote-sync-error" role="alert">
      <AlertCircle :size="16" /> {{ loadError }}
    </p>
    <div v-else-if="loading && !issues.length" class="dynamics-empty">
      <RefreshCw :size="22" class="animate-spin" />
      <span>Consultando la cola de Dynamics...</span>
    </div>
    <p v-else-if="!issues.length" class="quote-sync-message quote-sync-ok">
      <CheckCircle2 :size="17" /> No hay trabajos de sincronización registrados en la consulta.
    </p>
    <div v-else class="quote-sync-list">
      <article v-for="issue in issues" :key="`${issue.rateId}-${issue.revisionNumber}`" class="quote-sync-item">
        <div class="quote-sync-main">
          <div class="quote-sync-head">
            <strong class="quote-sync-id">Tarifa {{ issue.rateId }}</strong>
            <span class="quote-sync-state">{{ syncStateLabel(issue.status) }}</span>
          </div>
          <p class="quote-sync-meta">Revisión {{ issue.revisionNumber }} · {{ issue.attempts }} intento{{ issue.attempts === 1 ? '' : 's' }}
            <span v-if="issue.error?.stage"> · Etapa: {{ issue.error.stage }}</span>
            <span v-if="issue.error?.httpStatus"> · HTTP {{ issue.error.httpStatus }}</span>
          </p>
          <p v-if="issue.status === 'Pending'" class="quote-sync-meta">Pendiente de ser tomada por el worker. Todavía no hay confirmación de Dynamics.</p>
          <p v-else-if="issue.status === 'Processing'" class="quote-sync-meta">Operación en ejecución. La creación y su línea de venta aún deben confirmarse.</p>
          <p v-else-if="issue.status === 'Completed'" class="quote-sync-ok quote-sync-meta">
            El conector confirmó la creación. Completada: {{ dateTimeLabel(issue.completedAtUtc) }}.
          </p>
          <p v-else-if="issue.status === 'Retry'" class="quote-sync-meta">
            Próximo intento: {{ dateTimeLabel(issue.nextAttemptAtUtc) }}.
            No se genera una clave de idempotencia nueva.
          </p>
          <p v-if="issue.status === 'NeedsAttention' || issue.status === 'Retry'"
            class="quote-sync-error-detail">{{ issue.lastError || issue.error?.message || 'Sin detalle del error anterior.' }}</p>
          <p v-if="(issue.status === 'NeedsAttention' || issue.status === 'Retry') &&
            issue.error?.providerCode" class="quote-sync-meta">
            Código del proveedor: {{ issue.error.providerCode }}
          </p>
          <div v-if="issue.error?.httpStatus === 409 && issue.error?.postAttempted"
            class="quote-sync-diagnosis" role="alert">
            <AlertCircle :size="17" />
            <div>
              <strong v-if="ledgerByRate[issue.rateId]?.header.status === 'rejected' &&
                ledgerByRate[issue.rateId]?.total.status === 'not_sent'">
                Cabecera rechazada en Dataverse — requiere corregir el HTTP 400
              </strong>
              <strong v-else>Conciliación de QUO necesaria — no reintentar todavía</strong>
              <p v-if="ledgerByRate[issue.rateId]?.header.status === 'rejected' &&
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
                No se registró una QUO creada. Revisá el diagnóstico y los campos
                obligatorios de la cabecera, especialmente la relación de cliente.
                Esta operación rechazada conserva su clave de idempotencia y necesita
                una recuperación administrativa controlada después de corregir el motivo.
              </p>
              <p v-else>Consultá las operaciones <code>dhole-pricing-quote-{{ issue.rateId.replaceAll('-', '') }}-v{{ issue.revisionNumber }}-header</code>
                y <code>...-total</code> en el registro de idempotencia de Dynamics antes de volver a enviar.</p>
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
          <div v-if="isAdministrator && issue.status === 'NeedsAttention' &&
            !issue.retryBlockReason && ledgerByRate[issue.rateId]?.header.status === 'rejected' &&
            ledgerByRate[issue.rateId]?.total.status === 'not_sent'"
            class="quote-sync-recovery">
            <button v-if="recoveryOpenedRateId !== issue.rateId" type="button"
              class="dynamics-outline-button" @click="recoveryOpenedRateId=issue.rateId; diagnose(issue.rateId)">
              <RefreshCw :size="15" /> Recuperar QUO rechazada
            </button>
            <div v-else>
              <strong>Recuperación excepcional — una nueva clave de idempotencia</strong>
              <p>Solo se habilita tras confirmar que el envío anterior fue rechazado
                y que cliente, IDTRA y los demás vínculos están autorizados.</p>
              <p v-if="!diagnoses[issue.rateId]?.valid">
                Ejecutá Diagnosticar y corregí cualquier error antes de continuar.
              </p>
              <label class="quote-sync-recovery-label" :for="'reason-'+issue.rateId">
                Motivo de recuperación
              </label>
              <textarea :id="'reason-'+issue.rateId" rows="2" maxlength="500"
                :value="recoveryReason[issue.rateId] || ''"
                @input="recoveryReason={...recoveryReason,
                  [issue.rateId]:($event.target as HTMLTextAreaElement).value}"
                placeholder="Ej.: Rechazo HTTP 400 confirmado; relaciones y plantilla corregidas" />
              <label class="quote-sync-recovery-check">
                <input type="checkbox" :checked="Boolean(recoveryConfirm[issue.rateId])"
                  @change="recoveryConfirm={...recoveryConfirm,
                    [issue.rateId]:($event.target as HTMLInputElement).checked}">
                Confirmo que revisé la cabecera rechazada y autorizo el nuevo intento.
              </label>
              <div class="quote-sync-actions">
                <button type="button" class="dynamics-outline-button"
                  @click="recoveryOpenedRateId=null">Cancelar</button>
                <button type="button" class="dynamics-primary-button"
                  :disabled="Boolean(recoveringRateId) || !diagnoses[issue.rateId]?.valid ||
                    !recoveryConfirm[issue.rateId] ||
                    (recoveryReason[issue.rateId] || '').trim().length < 10"
                  @click="recoverRejected(issue)">
                  {{ recoveringRateId===issue.rateId ? 'Validando...' : 'Autorizar recuperación y enviar' }}
                </button>
              </div>
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
          <p v-if="issue.error?.lookupInput" class="quote-sync-meta">
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
          <button v-if="isAdministrator && issue.error?.httpStatus === 409 &&
              issue.error?.postAttempted" type="button"
            class="dynamics-outline-button" :disabled="Boolean(checkingLedgerRateId)"
            @click="verifyQuoteLedger(issue)">
            <SearchCheck :size="15" />
            {{ checkingLedgerRateId === issue.rateId ? 'Verificando...' : 'Verificar en Dynamics' }}
          </button>
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
          <button v-if="isAdministrator && issue.status === 'NeedsAttention' &&
              issue.retryableWithoutDuplicateRisk && !issue.retryBlockReason"
            type="button" class="dynamics-outline-button"
            :disabled="Boolean(retryingRateId)" @click="retryConfirmedPreWrite(issue)">
            <RefreshCw :size="15" />
            {{ retryingRateId === issue.rateId ? 'Encolando...' : 'Reintentar sin duplicar' }}
          </button>
        </div>
      </article>
    </div>
    <p class="quote-sync-footnote">
      Diagnosticar valida también las búsquedas reales por nombre de Cliente, Cuenta e IDTRA
      sin crear ninguna oferta ni consumir intentos de sincronización.
      Reintentar verifica primero que el conector permita escrituras de QUO y solo
      encola fallos confirmados anteriores a la creación. El diagnóstico de mapeo válido
      no reemplaza la aprobación de escrituras. Los fallos de resultado ambiguo
      requieren conciliación en Dynamics antes de cualquier reintento.
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
.quote-sync-queue-stats{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:10px;margin:14px 0}
.quote-sync-queue-stats>div{display:flex;flex-direction:column;gap:3px;padding:12px;border:1px solid var(--dh-border);border-radius:12px;background:var(--dh-card)}
.quote-sync-queue-stats strong{font-size:22px;font-variant-numeric:tabular-nums}
.quote-sync-queue-stats span{font-size:12px;color:var(--dh-text-muted)}
@media(max-width:850px){.quote-sync-queue-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
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
