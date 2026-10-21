<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, SearchCheck } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { fetchClient } from '@/core/api/fetchConfig'
import { useAuthStore } from '@/core/stores/authStore'

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
  } | null
  createdAtUtc?: string
}
type Diagnosis = {
  valid: boolean
  stage: string
  code: string
  message: string
  schemaVersion?: number
  httpStatus?: number
  noPostExecuted?: boolean
}

type QuoteCrudKey = {
  id: string
  templateName: string
  entityName: string
  operation: string
  label: string
  enabled: boolean
  expiresAt: string
}
const auth = useAuthStore()
const isAdministrator = computed(() => auth.hasScope('dynamics.security.admin'))
const quoteKeys = ref<QuoteCrudKey[]>([])
const selectedKeyId = ref('')
const granting = ref(false)
const grantError = ref('')
const grantSuccess = ref('')

async function loadQuoteKeys() {
  if (!isAdministrator.value) return
  try {
    const keys = await fetchClient<QuoteCrudKey[]>(
      '/api/dynamics-admin/connections/principal/crud-keys', { method: 'GET' })
    quoteKeys.value = keys.filter(k => k.enabled &&
      k.entityName === 'quote' && k.operation === 'create' &&
      k.templateName === 'crear_oferta' && new Date(k.expiresAt).getTime() > Date.now())
    if (!quoteKeys.value.some(k => k.id === selectedKeyId.value))
      selectedKeyId.value = quoteKeys.value.length === 1 ? quoteKeys.value[0]!.id : ''
  } catch {
    grantError.value = 'No se pudieron consultar las claves de crear_oferta.'
  }
}

async function grantQuoteTotal() {
  if (!selectedKeyId.value || !isAdministrator.value || granting.value) return
  granting.value = true
  grantError.value = ''
  grantSuccess.value = ''
  try {
    await fetchClient<unknown>(
      '/api/dynamics-admin/connections/principal/quote-total-grants/' +
        encodeURIComponent(selectedKeyId.value),
      { method: 'POST', body: {} })
    // Requeue only failures that the backend proved to be pre-write; legacy
    // ambiguous operations never qualify and cannot be retried here.
    let queued = 0
    for (const issue of issues.value.filter(i =>
      i.status === 'NeedsAttention' && i.retryableWithoutDuplicateRisk)) {
      try {
        await callEndpoint<unknown>({
          method: 'POST',
          path: `/api/pricing/rates/${encodeURIComponent(issue.rateId)}/dynamics-sync/retry`,
        })
        queued += 1
      } catch {
        // A row may have been picked up concurrently or changed status.
      }
    }
    grantSuccess.value = `Permisos aprobados. ${queued} cotización(es) con fallos seguros encoladas para reintento; las operaciones ambiguas permanecen bloqueadas.`
    await refresh()
  } catch (error) {
    grantError.value = error instanceof Error ? error.message :
      'No fue posible habilitar los permisos. Confirmá los campos de quote y quotedetail en Catálogo.'
  } finally {
    granting.value = false
  }
}

const issues = ref<QuoteIssue[]>([])
const loading = ref(false)
const loadError = ref('')
const diagnosingRateId = ref<string | null>(null)
const diagnoses = ref<Record<string, Diagnosis>>({})

async function refresh() {
  if (loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rates/dynamics-sync/issues',
    })
    const result = unwrapApiResponse<{ issues: QuoteIssue[] }>(response as never)
    issues.value = Array.isArray(result?.issues) ? result.issues : []
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

onMounted(() => { void refresh(); void loadQuoteKeys() })
</script>

<template>
  <section class="dynamics-panel quote-sync-panel" aria-label="Incidencias de ofertas de Pricing en Dynamics">
    <div class="dynamics-panel-header">
      <div>
        <p class="dynamics-section-label">SINCRONIZACIÓN · PRICING → DYNAMICS 365</p>
        <h2>Incidencias de ofertas</h2>
        <p class="dynamics-subtitle">
          Revisá los errores de creación de Quotes y validá el mapeo sin enviar operaciones nuevas a Dataverse.
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
          Elegí la clave activa de crear_oferta. Esta acción autoriza únicamente
          la lectura del identificador de la oferta y la creación de su línea de venta
          en quotedetail. No crea ni modifica ofertas.
        </p>
      </div>
      <div class="quote-sync-grant-controls">
        <select v-model="selectedKeyId" aria-label="Clave de crear oferta">
          <option value="">Seleccionar clave activa</option>
          <option v-for="key in quoteKeys" :key="key.id" :value="key.id">
            {{ key.label }} · {{ key.id.slice(0, 8) }}
          </option>
        </select>
        <button class="dynamics-primary-button" type="button"
          :disabled="granting || !selectedKeyId" @click="grantQuoteTotal">
          {{ granting ? 'Autorizando...' : 'Autorizar venta total' }}
        </button>
      </div>
      <p v-if="grantError" class="quote-sync-error" role="alert">{{ grantError }}</p>
      <p v-if="grantSuccess" class="quote-sync-ok" role="status">{{ grantSuccess }}</p>
      <p class="quote-sync-footnote">
        Si no aparece la clave o falta quotedetail, actualizá los metadatos y habilitá
        sus campos de creación en Catálogo antes de autorizar.
      </p>
    </div>

    <p v-if="loadError" class="quote-sync-message quote-sync-error" role="alert">
      <AlertCircle :size="16" /> {{ loadError }}
    </p>
    <div v-else-if="loading && !issues.length" class="dynamics-empty">
      <RefreshCw :size="22" class="animate-spin" />
      <span>Consultando incidencias de las cotizaciones...</span>
    </div>
    <p v-else-if="!issues.length" class="quote-sync-message quote-sync-ok">
      <CheckCircle2 :size="17" /> No hay incidencias de sincronización pendientes.
    </p>
    <div v-else class="quote-sync-list">
      <article v-for="issue in issues" :key="`${issue.rateId}-${issue.revisionNumber}`" class="quote-sync-item">
        <div class="quote-sync-main">
          <div class="quote-sync-head">
            <strong class="quote-sync-id">Tarifa {{ issue.rateId }}</strong>
            <span class="quote-sync-state">{{ issue.status === 'NeedsAttention' ? 'Requiere atención' : 'Reintento pendiente' }}</span>
          </div>
          <p class="quote-sync-meta">Revisión {{ issue.revisionNumber }} · {{ issue.attempts }} intento{{ issue.attempts === 1 ? '' : 's' }}
            <span v-if="issue.error?.stage"> · Etapa: {{ issue.error.stage }}</span>
            <span v-if="issue.error?.httpStatus"> · HTTP {{ issue.error.httpStatus }}</span>
          </p>
          <p class="quote-sync-error-detail">{{ issue.lastError || issue.error?.message || 'Error anterior sin detalle registrado. Usá Diagnosticar.' }}</p>
          <div v-if="diagnoses[issue.rateId]" class="quote-sync-diagnosis" :class="{ 'quote-sync-ok': diagnoses[issue.rateId]?.valid }" role="status">
            <CheckCircle2 v-if="diagnoses[issue.rateId]?.valid" :size="16" />
            <AlertCircle v-else :size="16" />
            <div>
              <strong>{{ diagnoses[issue.rateId]?.valid ? 'Mapeo válido' : 'Diagnóstico' }}</strong>
              <p>{{ diagnoses[issue.rateId]?.message }}</p>
              <small v-if="diagnoses[issue.rateId]?.code">{{ diagnoses[issue.rateId]?.code }}</small>
            </div>
          </div>
        </div>
        <div class="quote-sync-actions">
          <RouterLink class="dynamics-outline-button" :to="{ path: '/pricing/rates', query: { rateId: issue.rateId } }">
            <ExternalLink :size="15" /> Ver tarifa
          </RouterLink>
          <button type="button" class="dynamics-primary-button" :disabled="Boolean(diagnosingRateId)" @click="diagnose(issue.rateId)">
            <SearchCheck :size="15" />
            {{ diagnosingRateId === issue.rateId ? 'Diagnóstico en curso...' : 'Diagnosticar' }}
          </button>
        </div>
      </article>
    </div>
    <p class="quote-sync-footnote">
      Diagnosticar solamente lee el esquema activo de Dynamics y comprueba los campos; nunca crea otra oferta.
    </p>
  </section>
</template>

<style scoped>
.quote-sync-grants{border:1px solid var(--dh-border);border-radius:14px;margin-bottom:16px;padding:16px;background:var(--dh-card)}
.quote-sync-grants strong{font-size:13px}
.quote-sync-grants p{font-size:12px;color:var(--dh-text-muted);margin:7px 0}
.quote-sync-grant-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:12px 0}
.quote-sync-grant-controls select{border:1px solid var(--dh-border);border-radius:10px;padding:10px;flex:1;min-width:180px;background:var(--dh-card);color:var(--dh-text)}
.quote-sync-grant-controls button{padding:10px 14px}

.quote-sync-panel{margin-top:18px}
.quote-sync-list{display:grid;gap:12px}
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
