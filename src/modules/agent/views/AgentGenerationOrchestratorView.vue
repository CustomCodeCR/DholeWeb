<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  Activity, ArrowRightLeft, CalendarClock, CheckCircle2, History, Plus,
  RefreshCw, Settings2, ShieldCheck, Workflow, ExternalLink, ListChecks,
} from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { AgentService } from '@/core/services/agentService'
import { ApiError } from '@/core/api/apiErrorHandler'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'

type TriggerCode = 'manual' | 'scheduled' | 'technical_failure' | 'data_quality'
type Panel = 'guide' | 'overview' | 'manual' | 'automation'

interface Rule {
  code: TriggerCode
  enabled: boolean
  threshold: number
  scheduleMinutes: number
}
interface Generation {
  name: string
  browserState: string
  sharedDatabases: boolean
  registeredAtUtc?: string
  provisioningStatus?: string
  providerReadinessStatus?: 'Missing' | 'Unverified' | 'Expired' | 'Verified'
}
interface StandbyAuthSession {
  generation: string
  status: 'Requested' | 'Preparing' | 'Ready' | 'Finishing' | 'Verified' | 'Expired' | 'Failed'
  diagnosticCode?: string
  requestedAtUtc: string
  updatedAtUtc: string
  accountName?: string
  accountUsername?: string
  accountCustomerId?: string
  accountVerifiedAtUtc?: string
}
interface MaerskCredential {
  id: string
  name: string
}
interface GenerationEvent {
  id: string
  targetGeneration: string
  trigger: TriggerCode
  status: string
  reason: string
  createdAtUtc: string
  completedAtUtc?: string
  diagnosticCode?: string
}
interface Snapshot {
  activeGeneration: string
  authenticationIncidentCount: number
  githubDispatcherConfigured: boolean
  generations: Generation[]
  rules: Rule[]
  events: GenerationEvent[]
}

const auth = useAuthStore()
const toast = useToastStore()
const state = ref<Snapshot | null>(null)
const loading = ref(false)
const registering = ref(false)
const submitting = ref(false)
const savingRule = ref<string | null>(null)
const standbyAuthentications = ref<StandbyAuthSession[]>([])
const maerskCredentials = ref<MaerskCredential[]>([])
const selectedCredential = ref('')
const originalVerificationBusy = ref(false)
const originalVerificationExecutionId = ref<string | null>(null)
const maerskCircuit = ref<{ state: string; requiresOperator: boolean; reasonCode: string | null } | null>(null)
const providerAccessRestricted = computed(() =>
  maerskCircuit.value !== null &&
  (maerskCircuit.value.state !== 'Closed' || maerskCircuit.value.requiresOperator))
const standbyBusy = ref<string | null>(null)
const activeStandbyViewer = ref<{ generation: string; url: string } | null>(null)
const lastStandbyInspectionAt = ref<Record<string, number>>({})
const automaticHubInspectionAttempts = new Map<string, number>()
const automaticHubInspectionIntervalMs = 180_000
const independentlyVerified = ref<Record<string, boolean>>({})
const panel = ref<Panel>('guide')
const newGeneration = ref('')
const target = ref('')
const reason = ref('')
const reviewed = ref(false)
const canView = computed(() => auth.hasScope('agent.executions.view') &&
  auth.hasScope('agent.browser-profiles.view'))
const canManage = computed(() => auth.hasScope('agent.browser-profiles.authenticate'))
// Generation succession is strictly increasing; retired environments are
// still visible for audit but never become selectable standby destinations.
const generationOrdinal = (value: string): bigint | null => {
  if (value === 'prod') return 0n
  return /^prod[1-9][0-9]*$/.test(value) && value.length <= 64
    ? BigInt(value.slice(4)) : null
}
const isFutureGeneration = (candidate: string) => {
  const current = generationOrdinal(state.value?.activeGeneration ?? '')
  const next = generationOrdinal(candidate)
  return current !== null && next !== null && next > current
}
const isRetiredGeneration = (candidate: string) => {
  const current = generationOrdinal(state.value?.activeGeneration ?? '')
  const rank = generationOrdinal(candidate)
  return current !== null && rank !== null && rank < current
}
const destinations = computed(() => (state.value?.generations ?? [])
  .filter(item => isFutureGeneration(item.name) && item.provisioningStatus === 'Provisioned'))
const availableGenerations = computed(() => (state.value?.generations ?? [])
  .filter(item => item.name === state.value?.activeGeneration ||
    (isFutureGeneration(item.name) && item.provisioningStatus === 'Provisioned')))
const unavailableGenerations = computed(() => (state.value?.generations ?? [])
  .filter(item => !availableGenerations.value.some(available => available.name === item.name)))
const manualEnabled = computed(() => state.value?.rules.some(rule => rule.code === 'manual' && rule.enabled) ?? false)
const validGeneration = computed(() => isFutureGeneration(newGeneration.value) &&
  !(state.value?.generations ?? []).some(item => item.name === newGeneration.value))
const validRequest = computed(() => canManage.value && manualEnabled.value &&
  destinations.value.some(item => item.name === target.value) &&
  reason.value.trim().length >= 12 && reason.value.trim().length <= 500 && reviewed.value)
type WebActionOperation = 'inspect' | 'reconcile' | 'provision-check' | 'provision' | 'attest' | 'preflight' | 'switch'
interface GenerationWebAction {
  id: string
  generation: string
  operation: WebActionOperation
  status: 'Pending' | 'Dispatched' | 'Running' | 'Completed' | 'Rejected' | 'Failed'
  diagnosticCode?: string
  createdAtUtc: string
  completedAtUtc?: string
}
const generationActionsUrl = 'https://github.com/CustomCodeCR/DholeAgentService/actions/workflows/production-generation-actions.yml'
const webActions = ref<GenerationWebAction[]>([])
const webActionBusy = ref<WebActionOperation | null>(null)
const webActionsAvailable = ref(true)
const actionFor = (operation: WebActionOperation) =>
  webActions.value.find(item => item.generation === guideTarget.value && item.operation === operation)
const actionPending = (operation: WebActionOperation) =>
  ['Pending', 'Dispatched', 'Running'].includes(actionFor(operation)?.status ?? '')
const recentActionSuccess = (operation: WebActionOperation, maxMinutes = 10) => {
  const action = actionFor(operation)
  return action?.status === 'Completed' && !!action.completedAtUtc &&
    Date.now() - new Date(action.completedAtUtc).getTime() < maxMinutes * 60_000
}
const actionStatusLabel = (operation: WebActionOperation) => {
  const action = actionFor(operation)
  if (!action) return 'Sin ejecutar'
  return ({
    Pending: 'Solicitud registrada', Dispatched: 'Enviada a Actions',
    Running: 'Ejecutándose en Argos', Completed: 'Completada',
    Rejected: 'Rechazada', Failed: 'Fallida',
  } as Record<string, string>)[action.status] ?? action.status
}
const actionDiagnostic = (operation: WebActionOperation) =>
  actionFor(operation)?.diagnosticCode ?? ''

const guideTarget = ref('')
const guideStep = ref(1)
const guideReason = ref('Cambio controlado por mantenimiento técnico y validación del entorno de destino')
const guideReviewed = ref(false)
const guideAttestConsent = ref(false)
const guideSubmittedId = ref<string | null>(null)
const guideGenerationValid = computed(() =>
  isFutureGeneration(guideTarget.value))
const guideGeneration = computed(() =>
  state.value?.generations.find(item => item.name === guideTarget.value))
const guideOptions = computed(() =>
  (state.value?.generations ?? []).filter(item => isFutureGeneration(item.name)))
const guideProvisioned = computed(() => guideGeneration.value?.provisioningStatus === 'Provisioned')
const latestInfrastructureAction = computed(() =>
  [actionFor('provision-check'), actionFor('provision')]
    .filter((action): action is GenerationWebAction => Boolean(action))
    .sort((a, b) => Date.parse(b.createdAtUtc) - Date.parse(a.createdAtUtc))[0])
const guideInfrastructureReady = computed(() =>
  guideProvisioned.value && latestInfrastructureAction.value?.status === 'Completed')
const guideInfrastructureRepairNeeded = computed(() =>
  guideProvisioned.value && latestInfrastructureAction.value?.status === 'Failed')
const infrastructureDiagnostics: Record<string, string> = {
  generation_api_config_incomplete: 'Falta configuración JWT o de base de datos en el entorno temporal. Volvé a comprobar con el workflow corregido.',
  generation_existing_incomplete: 'Falta un contenedor obligatorio del entorno registrado. Es necesario revisar o reparar su infraestructura.',
  generation_hermes_not_running: 'Hermes existe, pero no está ejecutándose. Hay que recuperar su servicio sin tocar los perfiles.',
  generation_required_service_missing: 'Falta un servicio Docker obligatorio; el entorno no está listo.',
  generation_worker_persistence_missing: 'El Worker detenido no tiene todos sus volúmenes persistentes. No se permite activarlo.',
  generation_worker_novnc_config_missing: 'El Worker no tiene la configuración noVNC requerida.',
  generation_insufficient_root_space: 'Argos no tiene el espacio libre mínimo para realizar la operación.',
  generation_infrastructure_health_failed: 'La comprobación de salud de Agent API o Hermes no fue satisfactoria.',
  generation_active_standby_worker_refused: 'Existe un Worker alternativo activo; la protección impide modificarlo.',
  guarded_command_failed: 'El runner detuvo una validación. Reintentá la comprobación con el diagnóstico actualizado.',
}
const infrastructureDiagnostic = (operation: WebActionOperation) => {
  const code = actionDiagnostic(operation)
  return infrastructureDiagnostics[code] ?? (code ? 'Código técnico: ' + code : '')
}
const guideSession = computed(() => standbySession(guideTarget.value))
const guideAuthorized = computed(() => guideGeneration.value?.providerReadinessStatus === 'Verified')
const guideRequest = computed(() =>
  webActions.value.find(event => event.id === guideSubmittedId.value) ??
  actionFor('switch'))
const guideHubProofFresh = computed(() =>
  guideSession.value?.status === 'Verified' &&
  !!guideSession.value.accountVerifiedAtUtc &&
  Date.now() - new Date(guideSession.value.accountVerifiedAtUtc).getTime() < 5 * 60_000)
const guidePreflightReady = computed(() => recentActionSuccess('preflight'))
const guideCanAdvance = computed(() => {
  switch (guideStep.value) {
    case 1: return guideGenerationValid.value && Boolean(guideGeneration.value)
    case 2: return guideInfrastructureReady.value
    case 3: return guideSession.value?.status === 'Verified'
    case 4: return guideAuthorized.value
    case 5: return Boolean(guideSubmittedId.value)
    default: return false
  }
})
const guideCanSubmit = computed(() =>
  canManage.value && guideGenerationValid.value && guideProvisioned.value &&
  guideAuthorized.value && manualEnabled.value && !!state.value?.githubDispatcherConfigured &&
  guidePreflightReady.value && !actionPending('switch') &&
  guideReviewed.value && guideReason.value.trim().length >= 12 &&
  guideReason.value.trim().length <= 500 && guideSubmittedId.value === null)
watch(guideTarget, () => {
  guideReviewed.value = false
  guideAttestConsent.value = false
  guideSubmittedId.value = null
})

const automaticRules = computed(() => (state.value?.rules ?? [])
  .filter(rule => rule.code !== 'manual'))
const diagnosticDescriptions: Record<string, string> = {
  standby_readiness_missing: 'Falta una verificación independiente y reciente del acceso autorizado al proveedor para este entorno.',
  standby_authorization_unverified: 'La autorización del proveedor todavía no está verificada por un operador.',
  standby_readiness_expired: 'La última verificación del proveedor venció; debe verificarse nuevamente.',
  standby_readiness_invalid: 'El registro de autorización no corresponde al entorno solicitado.',
  standby_services_unhealthy: 'Agent API o Hermes no están saludables en el destino.',
  standby_worker_not_stopped: 'El Worker alternativo no está en espera.',
  standby_worker_image_mismatch: 'La imagen Docker del Worker es distinta de la activa.',
  standby_api_image_mismatch: 'La imagen Docker de Agent API es distinta de la activa.',
  standby_runtime_configuration_mismatch: 'La configuración PostgreSQL, Redis o de claves no coincide.',
  standby_circuit_monitoring_mismatch: 'Falta el circuito o la monitorización exigidos.',
  standby_queue_mode_mismatch: 'Los modos de despacho de la cola son diferentes.',
  standby_keyring_not_isolated: 'El volumen de claves no es independiente.',
  standby_browser_volume_not_isolated: 'Los perfiles de Chromium no están aislados.',
  provider_circuit_or_jobs_blocked: 'El circuito del proveedor está restringido o existen trabajos activos; no es seguro cambiar.',
  standby_preflight_failed: 'La comprobación automática del cambio no se completó. Revisa el estado y vuelve a intentarlo.',
  manual_request_expired: 'La solicitud venció antes de procesarse. Debes solicitar un nuevo cambio.',
  destination_not_provisioned: 'El destino todavía no está provisionado.',
}

const labels: Record<TriggerCode, string> = {
  manual: 'Manual',
  scheduled: 'Por horario',
  technical_failure: 'Por fallos técnicos',
  data_quality: 'Por calidad de datos',
}
const ruleDescriptions: Record<TriggerCode, string> = {
  manual: 'Permite solicitar un cambio desde esta página.',
  scheduled: 'Define cada cuántos minutos evaluar el cambio programado.',
  technical_failure: 'Define cuántos fallos operativos deben detectarse.',
  data_quality: 'Define cuántas incidencias de calidad deben detectarse.',
}
let refreshTimer: ReturnType<typeof setInterval> | undefined

function dateLabel(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('es-CR')
}

function standbySession(name: string) {
  return standbyAuthentications.value.find(item => item.generation === name)
}
function validStandbyName(name: string) {
  return /^prod([2-9]|[1-9][0-9]{1,2})$/.test(name) && Number(name.substring(4)) <= 200
}
function standbyStatusLabel(status?: StandbyAuthSession['status']) {
  return ({
    Requested: 'Solicitud recibida', Preparing: 'Preparando navegador',
    Ready: 'Navegador listo', Finishing: 'Finalizando verificación',
    Verified: 'Hub de Maersk verificado', Expired: 'Solicitud vencida',
    Failed: 'La preparación necesita atención',
  } as Record<string, string>)[status ?? ''] ?? 'Sin preparar'
}
const standbyDiagnosticLabels: Record<string, string> = {
  github_dispatch_failed: 'No se pudo iniciar el proceso automático. Vuelve a intentar desde esta pantalla.',
  standby_auth_workflow_failed: 'Falló la preparación. Vuelve a intentarlo desde aquí.',
  operator_session_expired: 'La autorización venció; puedes iniciar una nueva sin borrar el perfil del navegador.',
  standby_auth_session_expired: 'La solicitud venció. Inicia una nueva preparación desde esta pantalla.',
  standby_auth_transition_not_allowed: 'El estado actual no admite esta operación. Actualiza y vuelve a preparar si es necesario.',
  standby_auth_session_verified: 'La cuenta ya figura como verificada.',
  standby_auth_schema_missing: 'El servicio debe actualizar su estructura de datos. Contacta al administrador.',
  postgres_operation_failed: 'No se pudo actualizar el estado de autenticación. Contacta al administrador.',
  standby_hub_not_authenticated: 'El Hub autenticado todavía no está visible. Ingresa al Hub completo y vuelve a comprobar.',
}
function standbyInspectionMessage(name: string): string {
  const session = standbySession(name)
  if (session?.accountVerifiedAtUtc) {
    const verified = Date.parse(session.accountVerifiedAtUtc)
    if (Number.isFinite(verified) && verified > 0) {
      return 'Hub autenticado confirmado por Dhole. Cerrá el visor y finalizá la verificación.'
    }
  }
  const requestedAt = lastStandbyInspectionAt.value[name]
  const updatedAt = session?.updatedAtUtc ? Date.parse(session.updatedAtUtc) : 0
  if (session?.diagnosticCode === 'standby_hub_not_authenticated' &&
      (!requestedAt || (Number.isFinite(updatedAt) && updatedAt >= requestedAt))) {
    return 'No se detectó una sesión autenticada en el Hub de Maersk. Entrá al Hub completo desde este navegador; si no ves su contenido, no es posible finalizar.'
  }
  if (requestedAt) {
    return 'Comprobación enviada. La inspección se ejecuta en el servidor y el resultado puede tardar. Dhole actualizará el estado automáticamente.'
  }
  return 'Entrá al Hub de Maersk en este navegador. Comprobar ahora no inicia sesión automáticamente.'
}

async function refreshStandbyAuthentication() {
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET', path: '/api/agents/runtime-generations/authentication/',
      headers: { Accept: 'application/json' },
    })
    standbyAuthentications.value = unwrapApiResponse<StandbyAuthSession[]>(response as never)
    // Poll only API-authorized, active Ready sessions. No browser credentials
    // or identity fields are read; the trusted runner verifies the real Hub.
    // Throttle dispatch to avoid queueing multiple GitHub jobs.
    if (canManage.value && !document.hidden && !standbyBusy.value && !activeStandbyViewer.value) {
      const now = Date.now()
      const candidate = standbyAuthentications.value.find(session =>
        session.status === 'Ready' && !session.accountVerifiedAtUtc &&
        validStandbyName(session.generation) &&
        now - (automaticHubInspectionAttempts.get(session.generation) ?? 0) >=
          automaticHubInspectionIntervalMs)
      if (candidate) {
        automaticHubInspectionAttempts.set(candidate.generation, now)
        void inspectStandby(candidate.generation, true)
      }
    }
  } catch {
    // A separate auth endpoint may deploy later than the main dashboard.
  }
}
async function prepareStandby(name: string) {
  if (!canManage.value || !selectedCredential.value || standbyBusy.value) return
  standbyBusy.value = name
  try {
    await callEndpoint<unknown, { credentialId: string }>({
      method: 'POST',
      path: '/api/agents/runtime-generations/authentication/{{generation}}/prepare',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { params: { generation: name }, body: { credentialId: selectedCredential.value } })
    toast.success('Preparación solicitada', 'Se abrirá un Chromium aislado. La generación actualmente activa continuará ejecutando la cola.')
    await refreshStandbyAuthentication()
  } catch (error) {
    toast.backendError(error, 'No se pudo preparar el navegador independiente.')
  } finally {
    standbyBusy.value = null
  }
}
async function openStandbyViewer(name: string) {
  if (!canManage.value || standbyBusy.value) return
  standbyBusy.value = name
  try {
    const result = await callEndpoint<{ url: string; expiresAtUtc: string }>({
      method: 'POST',
      path: '/api/agents/runtime-generations/authentication/{{generation}}/viewer/access',
      headers: { Accept: 'application/json' },
    }, { params: { generation: name }, credentials: 'include' })
    const base = new URL(String(import.meta.env.VITE_API_URL || window.location.origin),
      window.location.origin)
    const destination = new URL(result.url, base)
    if (destination.origin !== base.origin ||
        !destination.pathname.startsWith('/api/agents/runtime-generations/authentication/' +
          name + '/viewer/')) {
      throw new Error('La dirección del visor no es válida')
    }
    // Keep the viewer inside Dhole's top-level browsing context so its
    // HttpOnly, partitioned cross-origin cookie remains available to Firefox.
    // Never put bearer credentials into the viewer URL.
    activeStandbyViewer.value = { generation: name, url: destination.href }
  } catch (error) {
    toast.backendError(error,
      'No se pudo abrir el navegador de ' + name + '. Revisá que su sesión figure como lista.')
  } finally {
    standbyBusy.value = null
  }
}

async function inspectStandby(name: string, silent = false) {
  if (!canManage.value || standbyBusy.value) return
  standbyBusy.value = name
  try {
    await callEndpoint<unknown>({
      method: 'POST',
      path: '/api/agents/runtime-generations/authentication/{{generation}}/inspect',
      headers: { Accept: 'application/json' },
    }, { params: { generation: name } })
    lastStandbyInspectionAt.value = { ...lastStandbyInspectionAt.value, [name]: Date.now() }
    if (!silent) {
      toast.info('Comprobación enviada',
        'La inspección de ' + name + ' continúa en el servidor. Esperá a que Dhole confirme el Hub autenticado; enviar la solicitud no significa que haya iniciado sesión.')
    }
    await refreshStandbyAuthentication()
  } catch (error) {
    if (!silent) toast.backendError(error, 'No se pudo comprobar el Hub autenticado de Maersk.')
  } finally {
    standbyBusy.value = null
  }
}
async function restartStandby(name: string) {
  if (!canManage.value || standbyBusy.value) return
  standbyBusy.value = name
  try {
    await callEndpoint<unknown>({
      method: 'POST',
      path: '/api/agents/runtime-generations/authentication/{{generation}}/restart',
      headers: { Accept: 'application/json' },
    }, { params: { generation: name } })
    independentlyVerified.value[name] = false
    toast.success('Reapertura solicitada', 'Se reiniciará solo el visor de ' + name +
      ', conservando su perfil Chromium y sin arrancar el Worker.')
    await refreshStandbyAuthentication()
  } catch (error) {
    toast.backendError(error, 'No se pudo reabrir el visor independiente.')
  } finally {
    standbyBusy.value = null
  }
}
async function completeStandby(name: string) {
  if (!canManage.value || !independentlyVerified.value[name] || standbyBusy.value) return
  standbyBusy.value = name
  try {
    const response = await callEndpoint<{ status?: string; alreadyProcessing?: boolean },
      { confirmation: string }>({
      method: 'POST',
      path: '/api/agents/runtime-generations/authentication/{{generation}}/complete',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, {
      params: { generation: name },
      body: { confirmation: 'I_VERIFIED_AUTHORIZED_MAERSK_ACCESS_IN_THIS_STANDBY' },
    })
    independentlyVerified.value[name] = false
    if (response.status === 'Verified') {
      toast.success('Autorización ya verificada',
        'El acceso de ' + name + ' ya está registrado. No se repetirá el cierre del visor.')
    } else if (response.alreadyProcessing) {
      toast.info('Finalización en curso',
        'Dhole ya está cerrando la autorización de ' + name + '. Esperá a que cambie el estado.')
    } else {
      toast.success('Finalización solicitada',
        'Dhole comprobará nuevamente el Hub, realizará las validaciones y actualizará el estado.')
    }
    await refreshStandbyAuthentication()
  } catch (error) {
    const code = error instanceof ApiError ? error.code : undefined
    switch (code) {
      case 'standby_hub_proof_expired':
      case 'standby_hub_not_verified':
        toast.warning('Verificación del Hub vencida',
          'El Hub debe haberse comprobado hace menos de cinco minutos. Pulsá «Comprobar ahora», esperá la verificación y volvé a finalizar.')
        break
      case 'standby_auth_session_expired':
      case 'standby_authentication_not_ready':
        toast.warning('Preparación no vigente',
          'La solicitud de autenticación ya no está lista. Prepará otra sesión desde esta pantalla; no es necesario borrar el perfil.')
        break
      case 'standby_auth_session_not_ready_or_wrong_operator':
        toast.warning('Finalización rechazada por el servidor',
          'La API todavía aplica la validación antigua del operador o el estado cambió. Actualizá la pantalla y solicitá la actualización de Agent API.')
        break
      case 'standby_authentication_failed':
      case 'standby_completion_state_changed':
        toast.warning('Estado de autenticación actualizado',
          'La operación ya no corresponde al estado actual. Actualizá el entorno para consultar qué paso falta.')
        break
      default:
        toast.backendError(error, 'No se pudo finalizar la verificación del entorno.')
    }
    await refreshStandbyAuthentication()
  } finally {
    standbyBusy.value = null
  }
}
function selectTarget(name: string) {
  target.value = name
  reason.value = ''
  reviewed.value = false
  panel.value = 'manual'
}

async function refresh(silent = false) {
  if (!canView.value || loading.value) return
  loading.value = true
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET', path: '/api/agents/runtime-generations/',
      headers: { Accept: 'application/json' },
    })
    state.value = unwrapApiResponse<Snapshot>(response as never)
    await refreshStandbyAuthentication()
    await refreshWebActions()
    try {
      maerskCircuit.value = (await AgentService.maerskOperations.get()).circuit
    } catch {
      // Unknown circuit state is not approval; Agent API still validates the operation.
      maerskCircuit.value = null
    }
    if (!destinations.value.some(item => item.name === target.value)) {
      target.value = destinations.value[0]?.name ?? ''
    }
    if (!guideGenerationValid.value) {
      guideTarget.value = destinations.value[0]?.name ??
        (state.value?.generations ?? []).find(item => isFutureGeneration(item.name))?.name ??
        (() => {
          const rank = generationOrdinal(state.value?.activeGeneration ?? '')
          return rank === null ? '' : 'prod' + (rank + 1n).toString()
        })()
      guideStep.value = 1
    }
  } catch (error) {
    if (!silent) toast.backendError(error, 'No se pudo consultar el orquestador.')
  } finally {
    loading.value = false
  }
}

async function registerGeneration() {
  if (!canManage.value || !validGeneration.value || registering.value) return
  registering.value = true
  try {
    const name = newGeneration.value.trim()
    await callEndpoint<unknown, { name: string }>({
      method: 'POST', path: '/api/agents/runtime-generations/register',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body: { name } })
    newGeneration.value = ''
    toast.success('Creación solicitada', name + ' fue registrado. El Worker enviará a GitHub la provisión si el despachador está configurado.')
    await refresh()
  } catch (error) {
    toast.backendError(error, 'No se pudo registrar el entorno.')
  } finally {
    registering.value = false
  }
}

async function requestChange() {
  if (!validRequest.value || submitting.value) return
  submitting.value = true
  try {
    await callEndpoint<unknown, { targetGeneration: string; trigger: TriggerCode; reason: string }>({
      method: 'POST', path: '/api/agents/runtime-generations/requests',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body: { targetGeneration: target.value, trigger: 'manual', reason: reason.value.trim() } })
    toast.success('Solicitud registrada', 'El Worker enviará la solicitud a GitHub si está configurado. La operación conserva las sesiones anteriores.')
    reviewed.value = false
    reason.value = ''
    panel.value = 'overview'
    await refresh()
  } catch (error) {
    toast.backendError(error, 'No se pudo solicitar el cambio.')
  } finally {
    submitting.value = false
  }
}

async function saveRule(rule: Rule) {
  if (!canManage.value || savingRule.value) return
  if (!Number.isInteger(rule.threshold) || rule.threshold < 1 || rule.threshold > 50 ||
    !Number.isInteger(rule.scheduleMinutes) || rule.scheduleMinutes < 15 ||
    rule.scheduleMinutes > 10080) {
    toast.backendError(new Error('Valores fuera de rango'), 'Revisa el umbral y el intervalo.')
    return
  }
  savingRule.value = rule.code
  try {
    await callEndpoint<unknown, Rule>({
      method: 'PUT', path: '/api/agents/runtime-generations/rules/{{code}}',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { params: { code: rule.code }, body: rule })
    toast.success('Regla guardada', 'El Worker evaluará la regla cuando esté conectado a GitHub y exista un destino autorizado.')
    await refresh()
  } catch (error) {
    toast.backendError(error, 'No se pudo guardar la regla.')
  } finally {
    savingRule.value = null
  }
}


async function refreshWebActions() {
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET', path: '/api/agents/runtime-generations/actions/',
      headers: { Accept: 'application/json' },
    })
    webActions.value = unwrapApiResponse<GenerationWebAction[]>(response as never)
    webActionsAvailable.value = true
  } catch {
    webActionsAvailable.value = false
  }
}

async function runWebAction(operation: WebActionOperation) {
  const validName = generationOrdinal(guideTarget.value) !== null
  if (!canManage.value || !validName || webActionBusy.value ||
      (!['inspect', 'reconcile'].includes(operation) && !guideGenerationValid.value) ||
      actionPending(operation) || !state.value?.githubDispatcherConfigured) return null
  if (operation === 'attest' && !guideHubProofFresh.value) return null
  if (operation === 'switch' && !guideCanSubmit.value) return null
  webActionBusy.value = operation
  try {
    const response = await callEndpoint<{ id: string },
      { operation: WebActionOperation; generation: string; confirmedProviderAccess: boolean;
        confirmedHandoff: boolean; reason: string }>({
      method: 'POST', path: '/api/agents/runtime-generations/actions/',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }, { body: {
      operation, generation: guideTarget.value,
      confirmedProviderAccess: operation === 'attest' && guideAttestConsent.value,
      confirmedHandoff: operation === 'switch' && guideReviewed.value,
      reason: guideReason.value.trim(),
    } })
    if (!response.id) throw new Error('El servidor no confirmó el identificador de Actions.')
    toast.success('Action solicitada', operation + ': solicitud recibida. Esperá la confirmación del runner.')
    await refreshWebActions()
    return response.id
  } catch (error) {
    toast.backendError(error, 'No se pudo iniciar la operación ' + operation + ' en Actions.')
    return null
  } finally {
    webActionBusy.value = null
  }
}

async function requestOriginalSessionVerification() {
  if (!canManage.value || originalVerificationBusy.value || !selectedCredential.value) return
  originalVerificationBusy.value = true
  try {
    const operations = await AgentService.maerskOperations.get()
    maerskCircuit.value = operations.circuit
    const result = await AgentService.maerskOperations.verifyOriginalSession(
      operations.providerId, selectedCredential.value,
    )
    if (!result.verificationOnly || !result.executionId)
      throw new Error('La API no devolvió una ejecución de verificación válida.')
    originalVerificationExecutionId.value = result.executionId
    toast.success('Verificación de la generación activa solicitada',
      'La ejecución utiliza el perfil persistente de ' + result.activeGeneration + ' y noVNC escucha en el puerto interno ' + result.noVncPort + '. Abrí el visor desde Operación Maersk o Sesiones; no libera el breaker automáticamente.')
  } catch (error) {
    toast.backendError(error, 'No se pudo iniciar la comprobación de la generación activa.')
  } finally {
    originalVerificationBusy.value = false
  }
}

async function registerGuidedTarget() {
  if (!canManage.value || !guideGenerationValid.value || guideGeneration.value) return
  newGeneration.value = guideTarget.value
  await registerGeneration()
}

async function requestGuidedChange() {
  if (!guideCanSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const id = await runWebAction('switch')
    if (id) {
      guideSubmittedId.value = id
      guideReviewed.value = false
      guideStep.value = 6
    }
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void refresh()
  if (canManage.value) {
    void callEndpoint<unknown>({
      method: 'GET', path: '/api/agents/runtime-generations/authentication/credentials',
      headers: { Accept: 'application/json' },
    }).then(response => {
      maerskCredentials.value = unwrapApiResponse<MaerskCredential[]>(response as never)
      selectedCredential.value = maerskCredentials.value[0]?.id ?? ''
    }).catch(() => undefined)
  }
  refreshTimer = setInterval(() => {
    if (!document.hidden) void refresh(true)
  }, 15000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <section class="mx-auto grid w-full max-w-6xl min-w-0 gap-5 pb-8">
    <DhPageHeader
      title="Orquestador de entornos"
      subtitle="Prepará, verificá y cambiá generaciones de producción paso a paso"
      :icon="Workflow"
    >
      <template #actions>
        <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :loading="loading" @click="refresh()" />
      </template>
    </DhPageHeader>

    <div v-if="!canView" class="rounded-2xl border border-[var(--dh-border)] p-5 text-sm">
      No tienes permisos para consultar este módulo. Necesitas acceso a ejecuciones y sesiones web del Agent.
    </div>

    <template v-else-if="state">
      <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--dh-card)]">
              <Activity class="h-6 w-6 text-[var(--dh-primary)]" />
            </div>
            <div>
              <p class="text-sm text-[var(--dh-text-muted)]">Entorno activo registrado</p>
              <p class="text-3xl font-black tracking-tight">{{ state.activeGeneration }}</p>
            </div>
          </div>
          <span class="rounded-full border border-[var(--dh-border)] px-3 py-1.5 text-xs text-[var(--dh-text-muted)]">
            {{ state.generations.length }} entornos registrados
          </span>
        </div>
        <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
          Este es el estado registrado en el sistema, no una prueba de que el Worker esté saludable.
        </p>
      </section>

      <div v-if="!state.githubDispatcherConfigured" class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <strong>Conexión automática pendiente de configurar.</strong>
        El Worker necesita una credencial de GitHub Actions con permiso de ejecución para procesar las solicitudes.
        Registrar entornos y reglas sigue guardando los cambios, pero no implica que Docker haya actuado.
      </div>

      <div v-if="state.authenticationIncidentCount > 0" class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <strong>Incidentes de autenticación: {{ state.authenticationIncidentCount }}</strong>
        <p class="mt-1">Se detectaron ejecuciones en espera por CAPTCHA o rechazo de acceso (401/403).
          Estas incidencias requieren verificación de acceso; no activan rotaciones automáticas de sesiones.</p>
        <RouterLink to="/agents/maersk" class="mt-2 inline-block font-bold underline">
          Ver operaciones de Maersk
        </RouterLink>
      </div>

      <nav class="grid grid-cols-1 gap-2 sm:grid-cols-4" aria-label="Secciones del orquestador">
        <button type="button" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-bold transition"
          :class="panel === 'guide' ? 'border-[var(--dh-primary)] bg-[var(--dh-card-hover)] text-[var(--dh-text)]' : 'border-[var(--dh-border)] bg-[var(--dh-surface)] text-[var(--dh-text-soft)]'"
          :aria-current="panel === 'guide' ? 'page' : undefined" @click="panel = 'guide'">
          <ListChecks class="h-4 w-4" /> Asistente guiado
        </button>
        <button type="button" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-bold transition"
          :class="panel === 'overview' ? 'border-[var(--dh-primary)] bg-[var(--dh-card-hover)] text-[var(--dh-text)]' : 'border-[var(--dh-border)] bg-[var(--dh-surface)] text-[var(--dh-text-soft)]'"
          :aria-current="panel === 'overview' ? 'page' : undefined" @click="panel = 'overview'">
          <Activity class="h-4 w-4" /> Ver entornos
        </button>
        <button type="button" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-bold transition"
          :class="panel === 'manual' ? 'border-[var(--dh-primary)] bg-[var(--dh-card-hover)] text-[var(--dh-text)]' : 'border-[var(--dh-border)] bg-[var(--dh-surface)] text-[var(--dh-text-soft)]'"
          :aria-current="panel === 'manual' ? 'page' : undefined" @click="panel = 'manual'">
          <ArrowRightLeft class="h-4 w-4" /> Solicitar cambio
        </button>
        <button type="button" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-bold transition"
          :class="panel === 'automation' ? 'border-[var(--dh-primary)] bg-[var(--dh-card-hover)] text-[var(--dh-text)]' : 'border-[var(--dh-border)] bg-[var(--dh-surface)] text-[var(--dh-text-soft)]'"
          :aria-current="panel === 'automation' ? 'page' : undefined" @click="panel = 'automation'">
          <CalendarClock class="h-4 w-4" /> Reglas automáticas
        </button>
      </nav>


      <section v-if="panel === 'guide'" class="grid gap-4" aria-label="Asistente de cambio de entorno">
        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-6">
          <h2 class="text-lg font-bold">Cambio de entorno guiado</h2>
          <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
            Seguí los seis pasos en orden. Dhole consulta el inventario y la autorización del Agent API;
            las comprobaciones de Docker y el relevo los ejecuta el runner protegido de GitHub Actions.
            Nunca se interpreta «solicitud enviada» como «Worker cambiado».
          </p>
          <p v-if="!webActionsAvailable" class="mt-3 text-sm text-amber-500" role="alert">
            Agent API todavía no responde al control de GitHub Actions desde Dhole.
            Los botones quedarán limitados hasta que el despliegue del backend esté completo.
          </p>
          <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Pasos del cambio">
            <button v-for="(label, index) in [
                'Destino', 'Infraestructura', 'Acceso', 'Autorización',
                'Preflight y relevo', 'Resultado'
              ]" :key="index" type="button" @click="guideStep = index + 1"
              :aria-current="guideStep === index + 1 ? 'step' : undefined"
              class="rounded-xl border px-3 py-2 text-xs font-semibold transition"
              :class="guideStep === index + 1
                ? 'border-[var(--dh-primary)] bg-[var(--dh-card-hover)] text-[var(--dh-text)]'
                : 'border-[var(--dh-border)] text-[var(--dh-text-muted)]'">
              {{ index + 1 }}. {{ label }}
            </button>
          </div>
          <p class="mt-4 text-sm">
            Origen registrado: <strong>{{ state.activeGeneration }}</strong>
            <span class="mx-2 text-[var(--dh-text-muted)]">→</span>
            Destino: <strong>{{ guideTarget || 'sin elegir' }}</strong>
          </p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
            El entorno activo mostrado es el registro de PostgreSQL. La confirmación física exige
            una ejecución exitosa de Actions y la reconciliación con Docker.
          </p>
        </div>

        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-6">
          <template v-if="guideStep === 1">
            <h3 class="text-lg font-bold">Paso 1 — Elegir o registrar el destino</h3>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
              Indicá la generación que debe recibir el trabajo. Si ya existe, la seleccionamos;
              si no existe, la registramos primero. Registrar no crea contenedores.
            </p>
            <label class="mt-4 block max-w-md text-sm font-semibold">
              Generación de destino
              <input v-model.trim="guideTarget" list="generation-guide-options" maxlength="64"
                autocomplete="off" placeholder="prod2"
                class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" />
              <datalist id="generation-guide-options">
                <option v-for="generation in guideOptions"
                  :key="generation.name" :value="generation.name" />
              </datalist>
            </label>
            <p v-if="!guideGenerationValid" class="mt-3 text-sm text-amber-500" role="status">
              Usá un nombre prodN válido, distinto del entorno activo; por ejemplo prod2.
            </p>
            <p v-else-if="guideGeneration" class="mt-3 text-sm" role="status">
              {{ guideTarget }} está registrado. Provisión: <strong>{{ guideGeneration.provisioningStatus ?? 'Desconocida' }}</strong>.
            </p>
            <div v-else class="mt-4 space-y-2">
              <p class="text-sm text-[var(--dh-text-muted)]">Este nombre todavía no está registrado en Dhole.</p>
              <DhButton label="Registrar entorno en Dhole" :icon="Plus" variant="secondary"
                :disabled="!canManage || !guideGenerationValid || registering"
                :loading="registering" @click="registerGuidedTarget" />
            </div>
            <div class="mt-4 grid gap-2 rounded-xl border border-[var(--dh-border)] p-4">
              <strong class="text-sm">1.1 Diagnóstico real en Argos</strong>
              <p class="text-sm text-[var(--dh-text-muted)]">
                Comprobá el Worker único, el estado de los componentes y las restricciones
                antes de continuar. GitHub Actions ejecuta el diagnóstico desde Dhole.
              </p>
              <p class="text-xs" role="status">{{ actionStatusLabel('inspect') }}</p>
              <DhButton label="Comprobar estado en Argos" :icon="RefreshCw" variant="secondary"
                :disabled="!canManage || !state.githubDispatcherConfigured ||
                  !!webActionBusy || actionPending('inspect')"
                :loading="webActionBusy === 'inspect'" @click="runWebAction('inspect')" />
            </div>
            <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
              La cuenta debe tener el scope agent.browser-profiles.authenticate para registrar y ejecutar cambios.
            </p>
          </template>

          <template v-else-if="guideStep === 2">
            <h3 class="text-lg font-bold">Paso 2 — Preparar la infraestructura</h3>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
              GitHub Actions debe preparar API, Hermes, volúmenes persistentes independientes y un Worker detenido.
              No se tocan los datos ni las sesiones del entorno anterior.
            </p>
            <div class="mt-4 rounded-xl border border-[var(--dh-border)] p-3 text-sm" role="status">
              Estado de {{ guideTarget }}: <strong>{{ guideGeneration?.provisioningStatus ?? 'No registrado' }}</strong>
              <span v-if="guideInfrastructureReady" class="ml-2 text-emerald-500">Infraestructura comprobada por Actions</span>
              <span v-else-if="guideProvisioned" class="ml-2 text-amber-500">Registrada, pendiente de comprobación física</span>
            </div>
            <p class="mt-3 text-sm text-[var(--dh-text-muted)]">
              Primero comprobá la infraestructura. Después pulsá «Preparar {{ guideTarget }}».
              Dhole solicita el workflow y consulta su resultado automáticamente; no necesitás abrir GitHub.
            </p>
            <div class="mt-4 grid gap-3 rounded-xl border border-[var(--dh-border)] p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold">2.1 Comprobación de infraestructura</span>
                <span class="text-xs" role="status">{{ actionStatusLabel('provision-check') }}</span>
              </div>
              <DhButton label="Comprobar infraestructura con Actions" variant="secondary" :icon="ShieldCheck"
                :disabled="!canManage || !guideGeneration || !guideGenerationValid ||
                  !state.githubDispatcherConfigured || !!webActionBusy || actionPending('provision-check')"
                :loading="webActionBusy === 'provision-check'" @click="runWebAction('provision-check')" />
              <p v-if="actionDiagnostic('provision-check')" class="text-xs text-[var(--dh-text-muted)]">
                {{ infrastructureDiagnostic('provision-check') }}
              </p>
              <div class="border-t border-[var(--dh-border)] pt-3">
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span class="text-sm font-semibold">2.2 Crear o reparar el entorno detenido</span>
                  <span class="text-xs" role="status">{{ actionStatusLabel('provision') }}</span>
                </div>
                <DhButton
                  :label="(guideInfrastructureRepairNeeded ? 'Reparar ' : 'Preparar ') + guideTarget + ' con Actions'"
                  variant="secondary" :icon="Plus"
                  :disabled="!canManage || !guideGeneration ||
                    (guideProvisioned && !guideInfrastructureRepairNeeded) ||
                    (!recentActionSuccess('provision-check', 30) && !guideInfrastructureRepairNeeded) ||
                    !state.githubDispatcherConfigured || !!webActionBusy || actionPending('provision')"
                  :loading="webActionBusy === 'provision'" @click="runWebAction('provision')" />
                <p v-if="actionDiagnostic('provision')" class="mt-2 text-xs text-[var(--dh-text-muted)]">
                  {{ infrastructureDiagnostic('provision') }}
                </p>
              </div>
            </div>
            <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
              El estado Provisioned procede del servidor. No implica acceso autenticado al proveedor.
            </p>
          </template>

          <template v-else-if="guideStep === 3">
            <h3 class="text-lg font-bold">Paso 3 — Verificar acceso autorizado al proveedor</h3>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
              Prepará y abrí el navegador independiente de {{ guideTarget }}. Ingresá a Maersk
              por el flujo autorizado, pulsá «Comprobar ahora» y finalizá solamente si el Hub
              está accesible sin CAPTCHA ni denegación. No copies sesiones de otra generación.
            </p>
            <div class="mt-4 rounded-xl border border-[var(--dh-border)] p-3 text-sm" role="status">
              Estado de la sesión: <strong>{{ standbyStatusLabel(guideSession?.status) }}</strong>.
            </div>
            <div v-if="canManage && guideProvisioned && validStandbyName(guideTarget)" class="mt-4 grid gap-3">
              <template v-if="guideSession?.status === 'Ready'">
                <DhButton :label="'Abrir noVNC de ' + guideTarget" variant="secondary" :icon="ShieldCheck"
                  :disabled="standbyBusy !== null" :loading="standbyBusy === guideTarget"
                  @click="openStandbyViewer(guideTarget)" />
                <DhButton label="Comprobar ahora" variant="secondary" :icon="RefreshCw"
                  :disabled="standbyBusy !== null" :loading="standbyBusy === guideTarget"
                  @click="inspectStandby(guideTarget)" />
                <p v-if="guideSession.accountVerifiedAtUtc" class="text-xs text-emerald-500">
                  Hub comprobado: {{ dateLabel(guideSession.accountVerifiedAtUtc) }}
                </p>
                <p role="status" aria-live="polite" class="text-xs text-[var(--dh-text-muted)]">
                  {{ standbyInspectionMessage(guideTarget) }}
                </p>
                <label class="flex items-start gap-2 text-sm">
                  <input v-model="independentlyVerified[guideTarget]" type="checkbox" class="mt-1" />
                  Verifiqué personalmente que {{ guideTarget }} tiene acceso legítimo al Hub
                  y no existe CAPTCHA ni acceso denegado.
                </label>
                <DhButton label="Finalizar verificación" variant="secondary" :icon="CheckCircle2"
                  :disabled="!independentlyVerified[guideTarget] || !guideSession.accountVerifiedAtUtc || standbyBusy !== null"
                  :loading="standbyBusy === guideTarget" @click="completeStandby(guideTarget)" />
              </template>
              <template v-else-if="guideSession?.status === 'Verified'">
                <p class="text-sm text-emerald-500">El Hub figura verificado. Continuá al paso 4.</p>
                <div v-if="!guideHubProofFresh" class="grid gap-2 rounded-xl border border-[var(--dh-border)] p-3">
                  <p class="text-xs text-amber-500">
                    La evidencia anterior venció para la autorización de relevo. Renovala
                    desde este botón conservando los volúmenes y las demás generaciones.
                  </p>
                  <DhButton label="Renovar sesión de verificación" variant="secondary" :icon="RefreshCw"
                    :disabled="!selectedCredential || standbyBusy !== null"
                    :loading="standbyBusy === guideTarget" @click="prepareStandby(guideTarget)" />
                </div>
              </template>
              <template v-else-if="guideSession?.status === 'Requested' ||
                  guideSession?.status === 'Preparing' || guideSession?.status === 'Finishing'">
                <p class="text-sm text-[var(--dh-text-muted)]">
                  Preparación en curso. Actualizá para consultar el siguiente estado.
                </p>
              </template>
              <template v-else>
                <label class="text-sm font-semibold">
                  Credencial autorizada
                  <select v-model="selectedCredential"
                    class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
                    <option v-for="credential in maerskCredentials" :key="credential.id"
                      :value="credential.id">{{ credential.name }}</option>
                  </select>
                </label>
                <DhButton label="Preparar navegador independiente" variant="secondary" :icon="ShieldCheck"
                  :disabled="!selectedCredential || standbyBusy !== null"
                  :loading="standbyBusy === guideTarget" @click="prepareStandby(guideTarget)" />
              </template>
              <p v-if="guideSession?.diagnosticCode" class="text-xs text-[var(--dh-text-muted)]">
                {{ standbyDiagnosticLabels[guideSession.diagnosticCode] ?? guideSession.diagnosticCode }}
              </p>
            </div>
            <p v-else class="mt-3 text-sm text-amber-500">
              El destino debe estar provisionado y requiere permisos de operador antes de abrir la sesión.
            </p>
          </template>

          <template v-else-if="guideStep === 4">
            <h3 class="text-lg font-bold">Paso 4 — Registrar la autorización independiente</h3>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
              Una sesión del Hub verificada no equivale a una autorización de relevo. Un operador
              debe confirmar el acceso legítimo en el workflow protegido de Actions.
            </p>
            <div class="mt-4 rounded-xl border border-[var(--dh-border)] p-3 text-sm" role="status">
              Estado oficial del destino: <strong>{{ guideGeneration?.providerReadinessStatus ?? 'Missing' }}</strong>
              <p v-if="guideAuthorized" class="mt-1 text-emerald-500">
                El servidor registra una autorización vigente para {{ guideTarget }}.
              </p>
            </div>
            <div v-if="providerAccessRestricted" class="mt-4 rounded-xl border border-amber-600/40 p-4" role="status">
              <p class="text-sm font-semibold text-amber-500">
                El breaker de Maersk continúa {{ maerskCircuit?.state }}.
              </p>
              <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
                La sesión independiente de {{ guideTarget }} no reemplaza la verificación
                de la generación activa. Antes de autorizar un relevo debés confirmar que
                Maersk volvió a permitir el acceso original y completar la verificación.
              </p>
              <label class="mt-3 block text-sm font-semibold">
                Credencial de Maersk para el Worker activo
                <select v-model="selectedCredential"
                  class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
                  <option v-for="credential in maerskCredentials" :key="credential.id"
                    :value="credential.id">{{ credential.name }}</option>
                </select>
              </label>
              <DhButton label="Verificar sesión activa" variant="secondary" :icon="ShieldCheck"
                :disabled="!selectedCredential || !canManage || originalVerificationBusy"
                :loading="originalVerificationBusy" @click="requestOriginalSessionVerification" />
              <p v-if="originalVerificationExecutionId" class="text-xs text-[var(--dh-text-muted)]">
                noVNC utiliza el puerto interno 6080 en la generación activa; abrí el visor protegido desde Operación Maersk.
              </p>
              <RouterLink v-if="originalVerificationExecutionId"
                :to="'/agents/executions/' + originalVerificationExecutionId"
                class="mt-3 block text-sm font-semibold text-[var(--dh-primary)] underline">
                Consultar resultado de la verificación activa
              </RouterLink>
              <RouterLink to="/agents/maersk-operations"
                class="mt-3 block text-sm font-semibold text-[var(--dh-primary)] underline">
                Revisar perfiles y liberar el circuito cuando esté autorizado
              </RouterLink>
            </div>
            <p class="mt-3 text-sm text-[var(--dh-text-muted)]">
              El botón siguiente solicita la autorización desde Dhole. La ejecución validará
              la comprobación reciente del Hub y el estado real del circuito.
            </p>
            <div class="mt-4 grid gap-3 rounded-xl border border-[var(--dh-border)] p-4">
              <p class="text-sm" role="status">Ejecución de Actions: <strong>{{ actionStatusLabel('attest') }}</strong></p>
              <p v-if="!guideHubProofFresh && !guideAuthorized" class="text-xs text-amber-500">
                El Hub debe estar verificado en los últimos 5 minutos. Volvé al paso 3
                y renová la sesión autorizada si la comprobación anterior venció.
              </p>
              <label class="flex items-start gap-2 text-sm">
                <input v-model="guideAttestConsent" type="checkbox" class="mt-1" />
                Confirmo que comprobé personalmente el acceso autorizado al Hub de Maersk
                de {{ guideTarget }} y no hay CAPTCHA ni denegación de acceso.
              </label>
              <DhButton label="Registrar autorización con Actions" variant="secondary" :icon="ShieldCheck"
                :disabled="!canManage || guideAuthorized || !guideProvisioned ||
                  providerAccessRestricted || !guideHubProofFresh || !guideAttestConsent ||
                  !state.githubDispatcherConfigured ||
                  !!webActionBusy || actionPending('attest')"
                :loading="webActionBusy === 'attest'" @click="runWebAction('attest')" />
              <p v-if="actionDiagnostic('attest')" class="text-xs text-[var(--dh-text-muted)]">
                Diagnóstico: {{ actionDiagnostic('attest') }}
              </p>
            </div>
            <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
              Esta autorización caduca a los 60 minutos. Si vence, repetí este paso.
            </p>
          </template>

          <template v-else-if="guideStep === 5">
            <h3 class="text-lg font-bold">Paso 5 — Preflight y solicitud de relevo</h3>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
              Primero ejecutá la validación técnica desde acá. El servidor confirmará
              las imágenes, volúmenes, salud, exclusividad del Worker y circuit breaker.
              Solo cuando el resultado sea <strong>Completada</strong> se habilitará el relevo.
            </p>
            <div class="mt-4 grid gap-3 rounded-xl border border-[var(--dh-border)] p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <strong class="text-sm">5.1 Validación de seguridad y salud</strong>
                <span class="text-xs" role="status">{{ actionStatusLabel('preflight') }}</span>
              </div>
              <DhButton label="Ejecutar preflight con Actions" variant="secondary" :icon="ShieldCheck"
                :disabled="!canManage || !guideAuthorized || !guideProvisioned ||
                  !state.githubDispatcherConfigured || !!webActionBusy || actionPending('preflight')"
                :loading="webActionBusy === 'preflight'" @click="runWebAction('preflight')" />
              <p v-if="actionDiagnostic('preflight')" class="text-xs text-[var(--dh-text-muted)]">
                Diagnóstico: {{ actionDiagnostic('preflight') }}
              </p>
              <p v-if="guidePreflightReady" class="text-xs font-semibold text-emerald-500">
                Validación completada. Podés solicitar el cambio durante los próximos minutos.
              </p>
            </div>
            <div class="mt-4 grid gap-3">
              <h4 class="text-sm font-semibold">5.2 Relevo controlado</h4>
              <label class="text-sm font-semibold">
                Motivo documentado
                <textarea v-model="guideReason" rows="3" maxlength="500"
                  class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" />
              </label>
              <label class="flex items-start gap-2 text-sm">
                <input v-model="guideReviewed" type="checkbox" class="mt-1" />
                Comprendo que el relevo se envía a GitHub Actions y puede ser rechazado si
                la autorización venció, el circuito está bloqueado o existe trabajo activo.
              </label>
              <p v-if="!state.githubDispatcherConfigured" class="text-sm text-amber-500" role="status">
                El dispatcher de GitHub Actions no está configurado. No es posible enviar el cambio desde Dhole.
              </p>
              <p v-else-if="!guideAuthorized" class="text-sm text-amber-500" role="status">
                El destino todavía no tiene una autorización independiente vigente.
              </p>
              <p v-else-if="!manualEnabled" class="text-sm text-amber-500" role="status">
                La regla de cambios manuales está deshabilitada.
              </p>
              <DhButton label="Cambiar Worker a destino con Actions" :icon="ArrowRightLeft"
                :disabled="!guideCanSubmit || submitting || !!webActionBusy"
                :loading="submitting || webActionBusy === 'switch'" @click="requestGuidedChange" />
              <p v-if="actionDiagnostic('switch')" class="text-xs text-[var(--dh-text-muted)]">
                Diagnóstico del relevo: {{ actionDiagnostic('switch') }}
              </p>
            </div>
          </template>

          <template v-else>
            <h3 class="text-lg font-bold">Paso 6 — Confirmar el resultado real</h3>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
              La solicitud no implica éxito. Actualizá hasta ver Completed y verificá
              que el entorno activo registrado sea {{ guideTarget }}.
              Revisá el run correspondiente de GitHub Actions para comprobar la ejecución real.
            </p>
            <div class="mt-4 grid gap-2 rounded-xl border border-[var(--dh-border)] p-4 text-sm" role="status">
              <p>ID de esta solicitud: <strong>{{ guideSubmittedId ?? 'Todavía no enviada' }}</strong></p>
              <p>Estado de la solicitud: <strong>{{ guideRequest?.status ?? 'Sin confirmación del servidor' }}</strong></p>
              <p>Entorno activo registrado: <strong>{{ state.activeGeneration }}</strong></p>
              <p v-if="guideRequest?.diagnosticCode" class="text-amber-500">
                {{ diagnosticDescriptions[guideRequest.diagnosticCode] ?? guideRequest.diagnosticCode }}
              </p>
              <p v-if="guideRequest?.status === 'Completed' && state.activeGeneration === guideTarget"
                class="font-semibold text-emerald-500">
                Dhole registró el relevo como completado. Confirmá también el Worker único desde Actions.
              </p>
              <p v-else class="text-[var(--dh-text-muted)]">
                Pendiente de confirmación. No se considera activo el nuevo Worker todavía.
              </p>
            </div>
            <div class="mt-4 grid gap-2 rounded-xl border border-[var(--dh-border)] p-4">
              <strong class="text-sm">6.1 Comprobar el Worker real</strong>
              <p class="text-xs text-[var(--dh-text-muted)]">
                Si el registro de PostgreSQL tarda en actualizarse, ejecutá la
                conciliación. El runner verificará que exactamente un Worker esté activo.
              </p>
              <p class="text-xs" role="status">{{ actionStatusLabel('reconcile') }}</p>
              <DhButton label="Sincronizar estado con Docker" :icon="RefreshCw" variant="secondary"
                :disabled="!canManage || !state.githubDispatcherConfigured ||
                  !!webActionBusy || actionPending('reconcile')"
                :loading="webActionBusy === 'reconcile'" @click="runWebAction('reconcile')" />
            </div>
            <a :href="generationActionsUrl" target="_blank" rel="noopener noreferrer"
              class="mt-3 inline-flex items-center gap-2 text-xs text-[var(--dh-text-muted)] underline">
              Ver registro técnico en GitHub (opcional) <ExternalLink class="h-4 w-4" />
            </a>
          </template>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--dh-border)] pt-4">
            <DhButton label="Paso anterior" variant="secondary" :disabled="guideStep === 1"
              @click="guideStep = Math.max(1, guideStep - 1)" />
            <div class="flex items-center gap-2">
              <DhButton label="Actualizar estados" :icon="RefreshCw" variant="secondary"
                :loading="loading" @click="refresh()" />
              <DhButton label="Siguiente paso" :disabled="guideStep === 6 || !guideCanAdvance"
                @click="guideStep = Math.min(6, guideStep + 1)" />
            </div>
          </div>
        </div>
      </section>

      <template v-else-if="panel === 'overview'">
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-5">
          <div class="mb-4">
            <h2 class="text-lg font-bold">Entornos disponibles y no disponibles</h2>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
              Cada entorno conserva su navegador y su sesión. Registrar un nombre no crea ni inicia su contenedor.
            </p>
          </div>
          <h3 class="mb-3 text-base font-bold">Entornos disponibles ({{ availableGenerations.length }})</h3>
          <p v-if="!availableGenerations.length" class="mb-3 text-sm text-[var(--dh-text-muted)]">
            No hay entornos listos para recibir trabajo; prepará el siguiente prodN.
          </p>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="item in availableGenerations" :key="item.name"
              class="flex flex-col justify-between gap-4 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <div>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <strong class="text-xl">{{ item.name }}</strong>
                  <span v-if="item.name === state.activeGeneration"
                    class="inline-flex items-center gap-1 text-xs font-bold text-emerald-500">
                    <CheckCircle2 class="h-3.5 w-3.5" /> Activo registrado
                  </span>
                  <span v-else class="text-xs text-[var(--dh-text-muted)]">
                    {{ item.provisioningStatus === 'Provisioned' ? 'Infraestructura preparada' :
                       item.provisioningStatus === 'Dispatched' || item.provisioningStatus === 'Dispatching'
                         ? 'Preparando infraestructura' :
                       item.provisioningStatus === 'Failed' ? 'Error de provisión' : 'Registrado' }}
                  </span>
                </div>
                <p class="mt-2 text-xs text-[var(--dh-text-muted)]">
                  Sesión del navegador independiente. Preparación y disponibilidad no verificadas aquí.
                </p>
              </div>
              <div
                v-if="canManage && item.name !== state.activeGeneration &&
                  item.provisioningStatus === 'Provisioned' && validStandbyName(item.name)"
                class="space-y-2 rounded-lg border border-[var(--dh-border)] p-3 text-xs"
              >
                <p class="font-semibold">Autenticación de Maersk en {{ item.name }}</p>
                <p class="text-[var(--dh-text-muted)]">
                  {{ standbyStatusLabel(standbySession(item.name)?.status) }}.
                  El acceso se administra desde Dhole. Worker activo registrado: {{ state.activeGeneration }}.
                </p>
                <template v-if="standbySession(item.name)?.status === 'Ready'">
                  <DhButton :label="'Abrir noVNC de ' + item.name" :icon="ShieldCheck"
                    variant="secondary" :disabled="standbyBusy !== null"
                    :loading="standbyBusy === item.name" @click="openStandbyViewer(item.name)" />
                  <p class="text-[var(--dh-text-muted)]">
                    El navegador se abre aquí dentro de Dhole de forma protegida.
                    No necesitás utilizar SSH ni GitHub Actions.
                  </p>
                  <div v-if="standbySession(item.name)?.accountVerifiedAtUtc"
                    class="space-y-1 rounded-lg border border-emerald-500/40 p-3">
                    <p class="font-bold text-emerald-500">Hub autenticado detectado en {{ item.name }}</p>
                    <p class="text-[var(--dh-text-muted)]">
                      Verificación: {{ dateLabel(standbySession(item.name)?.accountVerifiedAtUtc) }}
                    </p>
                  </div>
                  <p v-else class="text-[var(--dh-text-muted)]">
                    Ingresá al Hub de Maersk dentro de este navegador. Dhole detecta y registra el acceso automáticamente; «Comprobar ahora» es opcional.
                    No necesitás proporcionar nombre, usuario ni Customer ID.
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <DhButton label="Comprobar ahora" :icon="ShieldCheck" variant="secondary"
                      :disabled="standbyBusy !== null" :loading="standbyBusy === item.name"
                      @click="inspectStandby(item.name)" />
                    <DhButton label="Reabrir visor conservando sesión" :icon="RefreshCw"
                      variant="secondary" :disabled="standbyBusy !== null"
                      @click="restartStandby(item.name)" />
                  </div>
                  <label class="flex items-start gap-2">
                    <input v-model="independentlyVerified[item.name]" type="checkbox" class="mt-0.5" />
                    Confirmo que ingresé legítimamente al Hub de Maersk en este navegador aislado. No hay CAPTCHA ni acceso denegado.
                  </label>
                  <DhButton label="Finalizar y verificar acceso" :icon="ShieldCheck"
                     :disabled="!independentlyVerified[item.name] || !standbySession(item.name)?.accountVerifiedAtUtc || standbyBusy !== null"
                    :loading="standbyBusy === item.name" variant="secondary"
                    @click="completeStandby(item.name)" />
                </template>
                <template v-else-if="standbySession(item.name)?.status === 'Requested' ||
                  standbySession(item.name)?.status === 'Preparing' ||
                  standbySession(item.name)?.status === 'Finishing'">
                  <p>Dhole está procesando la solicitud automáticamente. El estado se actualizará aquí.</p>
                </template>
                <template v-else-if="standbySession(item.name)?.status === 'Verified'">
                  <p class="font-semibold text-emerald-500">Autenticación del Hub de Maersk verificada.</p>
                  <p class="text-[var(--dh-text-muted)]">Esto no autoriza todavía el cambio de Worker. La preparación técnica, la salud de los contenedores y el estado del circuit breaker se evalúan por separado antes de cualquier cambio.</p>
                </template>
                <template v-else>
                  <label class="block font-semibold">Credencial Maersk autorizada
                    <select v-model="selectedCredential"
                      class="mt-1 block w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-surface)] p-2">
                      <option v-for="credential in maerskCredentials" :key="credential.id"
                        :value="credential.id">{{ credential.name }}</option>
                    </select>
                  </label>
                  <DhButton label="Preparar sesión independiente" :icon="ShieldCheck" variant="secondary"
                    :disabled="!selectedCredential || standbyBusy !== null"
                    :loading="standbyBusy === item.name" @click="prepareStandby(item.name)" />
                </template>
                <p role="status" aria-live="polite" class="text-[var(--dh-text-muted)]">
                {{ standbyInspectionMessage(item.name) }}
              </p>
              <p v-if="standbySession(item.name)?.diagnosticCode" class="text-[var(--dh-text-muted)]">
                  {{ standbyDiagnosticLabels[standbySession(item.name)?.diagnosticCode ?? ''] ??
                    'No se completó la operación. Actualiza e inténtalo nuevamente desde Dhole.' }}
                </p>
              </div>
              <template v-if="canManage && item.name !== state.activeGeneration">
                <DhButton v-if="item.provisioningStatus === 'Provisioned'" variant="secondary"
                  label="Solicitar cambio" :icon="ArrowRightLeft" @click="selectTarget(item.name)" />
                <p v-else class="rounded-lg border border-[var(--dh-border)] p-2 text-xs text-[var(--dh-text-muted)]">
                  No disponible para cambios: debe completarse y validarse la provisión.
                </p>
              </template>
            </div>
          </div>
          <h3 class="mb-3 mt-7 text-base font-bold">Entornos no disponibles ({{ unavailableGenerations.length }})</h3>
          <p class="mb-3 text-xs text-[var(--dh-text-muted)]">
            Las generaciones anteriores son históricas y nunca pueden volver a seleccionarse.
            Los entornos nuevos que todavía no están provisionados permanecerán aquí hasta estar listos.
          </p>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="item in unavailableGenerations" :key="item.name"
              class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 opacity-75">
              <div class="flex items-center justify-between gap-2">
                <strong class="text-lg">{{ item.name }}</strong>
                <span class="text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ isRetiredGeneration(item.name) ? 'Retirado' : 'Sin preparar' }}
                </span>
              </div>
              <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
                {{ isRetiredGeneration(item.name)
                  ? 'Generación anterior: no se puede reactivar ni seleccionar como destino.'
                  : 'Pendiente de completar la provisión de infraestructura.' }}
              </p>
              <p class="mt-2 text-xs text-[var(--dh-text-muted)]">
                {{ item.provisioningStatus ?? 'Registrado' }}
              </p>
            </div>
          </div>

          <details v-if="canManage" class="group mt-5 rounded-xl border border-[var(--dh-border)] p-4">
            <summary class="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
              <Plus class="h-4 w-4" /> Agregar otro entorno
            </summary>
            <p class="mt-3 text-sm text-[var(--dh-text-muted)]">
              Podés registrar nuevos entornos con un número mayor al activo. Los anteriores quedan retirados.
              El Worker solicitará automáticamente a GitHub Actions la preparación de infraestructura cuando tenga acceso configurado.
            </p>
            <div class="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
              <label class="min-w-0 flex-1 text-sm font-semibold">Nombre del entorno
                <input v-model.trim="newGeneration" maxlength="64" type="text" autocomplete="off" :placeholder="'prod' + ((generationOrdinal(state.activeGeneration) ?? 0n) + 1n).toString()"
                  class="mt-1 block w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" />
              </label>
              <DhButton label="Registrar entorno" :icon="Plus" variant="secondary"
                :disabled="!validGeneration || registering" :loading="registering" @click="registerGeneration" />
            </div>
            <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
              El registro genera una solicitud de provisión en PostgreSQL. GitHub crea la infraestructura si está conectado;
              el Worker alternativo permanece detenido y las sesiones anteriores no se copian.
            </p>
          </details>
        </section>

        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-5">
          <div class="mb-3 flex items-center gap-2">
            <History class="h-5 w-5" />
            <h2 class="text-lg font-bold">Últimas solicitudes</h2>
          </div>
          <p v-if="!state.events.length" class="text-sm text-[var(--dh-text-muted)]">
            Todavía no hay solicitudes. Puedes crearlas desde «Solicitar cambio».
          </p>
          <div v-for="event in state.events.slice(0, 15)" :key="event.id"
            class="flex flex-wrap items-start justify-between gap-3 border-t border-[var(--dh-border)] py-3 first:border-t-0">
            <div class="min-w-0 flex-1">
              <div class="text-sm font-bold">{{ event.targetGeneration }} · {{ labels[event.trigger] ?? event.trigger }}</div>
              <p class="mt-1 break-words text-sm text-[var(--dh-text-muted)]">{{ event.reason }}</p>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ dateLabel(event.createdAtUtc) }}</p>
              <p v-if="event.diagnosticCode" class="mt-1 text-xs text-[var(--dh-text-muted)]" role="status">
                {{ diagnosticDescriptions[event.diagnosticCode] ?? ('Diagnóstico: ' + event.diagnosticCode) }}
              </p>
            </div>
            <span class="rounded-full bg-[var(--dh-card)] px-3 py-1 text-xs font-bold">{{ event.status }}</span>
          </div>
        </section>
      </template>

      <section v-else-if="panel === 'manual'"
        class="max-w-3xl rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-6">
        <h2 class="text-lg font-bold">Solicitar un cambio de entorno</h2>
        <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
          Escoge un entorno registrado y explica por qué deseas utilizarlo.
          El Worker la envía a GitHub cuando esté configurado. El cambio se valida y puede fallar sin alterar el entorno actual.
        </p>
        <div v-if="!canManage" class="mt-4 text-sm text-[var(--dh-text-muted)]">
          No tienes permisos para solicitar cambios.
        </div>
        <div v-else-if="!manualEnabled" class="mt-4 text-sm text-[var(--dh-text-muted)]">
          Los cambios manuales están deshabilitados por la configuración actual del orquestador.
        </div>
        <div v-else-if="!destinations.length" class="mt-4 text-sm text-[var(--dh-text-muted)]">
          No hay otro entorno preparado para recibir un cambio. Revisa la provisión y salud de los entornos registrados.
        </div>
        <form v-else class="mt-5 grid gap-4" @submit.prevent="requestChange">
          <label class="text-sm font-semibold">1. Entorno de destino
            <select v-model="target" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
              <option v-for="item in destinations" :key="item.name" :value="item.name">{{ item.name }}</option>
            </select>
          </label>
          <label class="text-sm font-semibold">2. Motivo del cambio
            <textarea v-model="reason" rows="3" maxlength="500"
              placeholder="Ejemplo: mantenimiento de los servicios del entorno actual"
              class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" />
            <span class="mt-1 block text-xs font-normal text-[var(--dh-text-muted)]">Mínimo 12 caracteres.</span>
          </label>
          <label class="flex items-start gap-3 rounded-xl border border-[var(--dh-border)] p-3 text-sm">
            <input v-model="reviewed" type="checkbox" class="mt-1 h-4 w-4 shrink-0" />
            <span>Comprendo que GitHub realizará validaciones antes del cambio y que un destino no preparado será rechazado.</span>
          </label>
          <div>
            <DhButton label="Registrar solicitud de cambio" :icon="ArrowRightLeft"
              :disabled="!validRequest || submitting" :loading="submitting" @click="requestChange" />
          </div>
        </form>
      </section>

      <section v-else class="max-w-4xl rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-6">
        <div class="flex items-center gap-2">
          <Settings2 class="h-5 w-5" />
          <h2 class="text-lg font-bold">Reglas automáticas</h2>
        </div>
        <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
          Configura cuándo debería evaluarse un cambio. Por ahora estas reglas se guardan,
          y el Worker las evalúa cada diez segundos cuando esté configurado. El cambio solo se realiza
          si GitHub responde, el destino está preparado y la autorización sigue siendo válida.
        </p>
        <div v-for="rule in automaticRules" :key="rule.code"
          class="mt-4 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-bold">{{ labels[rule.code] }}</h3>
              <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ ruleDescriptions[rule.code] }}</p>
            </div>
            <label class="flex items-center gap-2 text-sm font-semibold">
              <input v-model="rule.enabled" type="checkbox" :disabled="!canManage" class="h-5 w-5" />
              {{ rule.enabled ? 'Preferencia activada' : 'Desactivada' }}
            </label>
          </div>
          <div class="mt-4 max-w-xs">
            <label v-if="rule.code === 'scheduled'" class="text-sm font-semibold">
              Evaluar cada (minutos)
              <input v-model.number="rule.scheduleMinutes" type="number" min="15" max="10080" :disabled="!canManage"
                class="mt-2 block w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-3" />
            </label>
            <label v-else class="text-sm font-semibold">
              Número de incidencias
              <input v-model.number="rule.threshold" type="number" min="1" max="50" :disabled="!canManage"
                class="mt-2 block w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-3" />
            </label>
          </div>
          <DhButton v-if="canManage" class="mt-4" label="Guardar preferencia"
            variant="secondary" :icon="ShieldCheck" :disabled="Boolean(savingRule)"
            :loading="savingRule === rule.code" @click="saveRule(rule)" />
        </div>
      </section>
    </template>

    <div v-else-if="loading" class="rounded-2xl border border-[var(--dh-border)] p-6 text-sm text-[var(--dh-text-muted)]">
      Cargando entornos…
    </div>
    <Teleport to="body">
      <div v-if="activeStandbyViewer"
        class="fixed inset-0 z-[9999] flex flex-col bg-[var(--dh-surface)]"
        role="dialog" aria-modal="true" aria-label="Navegador independiente de Maersk">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] bg-[var(--dh-surface)] p-3">
          <div class="text-sm font-semibold">
            Maersk · {{ activeStandbyViewer.generation }} · noVNC interactivo
            <p class="text-xs font-normal text-[var(--dh-text-muted)]">
              Ingresá al Hub completo de Maersk en este navegador. La autenticación real se verifica en el servidor.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <DhButton label="Comprobar ahora" :icon="ShieldCheck"
              variant="secondary" :loading="standbyBusy === activeStandbyViewer.generation"
              :disabled="standbyBusy !== null"
              @click="inspectStandby(activeStandbyViewer.generation)" />
            <a :href="activeStandbyViewer.url" target="_blank" rel="noopener noreferrer"
              class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              <ExternalLink :size="16" />
              Abrir noVNC en otra pestaña
            </a>
            <DhButton label="Cerrar visor" variant="secondary"
              @click="activeStandbyViewer = null" />
          </div>
        </div>
        <p class="border-b border-[var(--dh-border)] bg-[var(--dh-surface)] px-3 py-2 text-xs text-[var(--dh-text-muted)]"
          role="status" aria-live="polite">
          {{ standbyInspectionMessage(activeStandbyViewer.generation) }}
          Si no ves el escritorio o no responde el teclado, usá «Abrir noVNC en otra pestaña» para controlar el mismo Chromium de {{ activeStandbyViewer.generation }} directamente.
        </p>
        <iframe :src="activeStandbyViewer.url"
          class="min-h-0 w-full flex-1 border-0 bg-[var(--dh-surface)]"
          title="Navegador aislado de Maersk"
          sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
          referrerpolicy="no-referrer"
          allow="clipboard-read; clipboard-write" />
      </div>
    </Teleport>

  </section>
</template>
