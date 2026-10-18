<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Activity, ArrowRightLeft, CalendarClock, CheckCircle2, History, Plus,
  RefreshCw, Settings2, ShieldCheck, Workflow,
} from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { ApiError } from '@/core/api/apiErrorHandler'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'

type TriggerCode = 'manual' | 'scheduled' | 'technical_failure' | 'data_quality'
type Panel = 'overview' | 'manual' | 'automation'

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
const standbyBusy = ref<string | null>(null)
const activeStandbyViewer = ref<{ generation: string; url: string } | null>(null)
const automaticHubInspectionAttempts = new Map<string, number>()
const automaticHubInspectionIntervalMs = 180_000
const independentlyVerified = ref<Record<string, boolean>>({})
const panel = ref<Panel>('overview')
const newGeneration = ref('')
const target = ref('')
const reason = ref('')
const reviewed = ref(false)
const canView = computed(() => auth.hasScope('agent.executions.view') &&
  auth.hasScope('agent.browser-profiles.view'))
const canManage = computed(() => auth.hasScope('agent.browser-profiles.authenticate'))
const destinations = computed(() => (state.value?.generations ?? [])
  .filter(item => item.name !== state.value?.activeGeneration &&
    item.provisioningStatus === 'Provisioned'))
const manualEnabled = computed(() => state.value?.rules.some(rule => rule.code === 'manual' && rule.enabled) ?? false)
const validGeneration = computed(() => /^prod[1-9][0-9]*$/.test(newGeneration.value) &&
  newGeneration.value.length <= 64 &&
  !(state.value?.generations ?? []).some(item => item.name === newGeneration.value))
const validRequest = computed(() => canManage.value && manualEnabled.value &&
  destinations.value.some(item => item.name === target.value) &&
  reason.value.trim().length >= 12 && reason.value.trim().length <= 500 && reviewed.value)
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
    if (canManage.value && !document.hidden && !standbyBusy.value) {
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
    toast.success('Preparación solicitada', 'Se abrirá un Chromium aislado. prod1 continuará ejecutando la cola.')
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
      'No se pudo abrir el navegador. Confirma que prod2 esté listo e inténtalo nuevamente.')
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
    if (!silent) {
      toast.success('Comprobación del Hub solicitada',
        'Dhole comprobará el Hub de Maersk en el navegador de ' + name + '. No se necesitan datos de usuario.')
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
    if (!destinations.value.some(item => item.name === target.value)) {
      target.value = destinations.value[0]?.name ?? ''
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
      subtitle="Consulta el entorno activo, administra los disponibles y solicita cambios"
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

      <nav class="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Secciones del orquestador">
        <button type="button" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-bold transition"
          :class="panel === 'overview' ? 'border-[var(--dh-primary)] bg-[var(--dh-card-hover)] text-[var(--dh-text)]' : 'border-[var(--dh-border)] bg-[var(--dh-surface)] text-[var(--dh-text-soft)]'"
          :aria-current="panel === 'overview' ? 'page' : undefined" @click="panel = 'overview'">
          <Activity class="h-4 w-4" /> 1. Ver entornos
        </button>
        <button type="button" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-bold transition"
          :class="panel === 'manual' ? 'border-[var(--dh-primary)] bg-[var(--dh-card-hover)] text-[var(--dh-text)]' : 'border-[var(--dh-border)] bg-[var(--dh-surface)] text-[var(--dh-text-soft)]'"
          :aria-current="panel === 'manual' ? 'page' : undefined" @click="panel = 'manual'">
          <ArrowRightLeft class="h-4 w-4" /> 2. Solicitar cambio
        </button>
        <button type="button" class="flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-bold transition"
          :class="panel === 'automation' ? 'border-[var(--dh-primary)] bg-[var(--dh-card-hover)] text-[var(--dh-text)]' : 'border-[var(--dh-border)] bg-[var(--dh-surface)] text-[var(--dh-text-soft)]'"
          :aria-current="panel === 'automation' ? 'page' : undefined" @click="panel = 'automation'">
          <CalendarClock class="h-4 w-4" /> 3. Reglas automáticas
        </button>
      </nav>

      <template v-if="panel === 'overview'">
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] p-4 sm:p-5">
          <div class="mb-4">
            <h2 class="text-lg font-bold">Tus entornos</h2>
            <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
              Cada entorno conserva su navegador y su sesión. Registrar un nombre no crea ni inicia su contenedor.
            </p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="item in state.generations" :key="item.name"
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
                  El acceso se administra desde Dhole. El Worker de prod1 sigue activo.
                </p>
                <template v-if="standbySession(item.name)?.status === 'Ready'">
                  <DhButton :label="'Abrir navegador de ' + item.name" :icon="ShieldCheck"
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

          <details v-if="canManage" class="group mt-5 rounded-xl border border-[var(--dh-border)] p-4">
            <summary class="flex cursor-pointer list-none items-center gap-2 text-sm font-bold">
              <Plus class="h-4 w-4" /> Agregar otro entorno
            </summary>
            <p class="mt-3 text-sm text-[var(--dh-text-muted)]">
              Puedes crear tantos registros como necesites: prod2, prod3, prod4…
              El Worker solicitará automáticamente a GitHub Actions la preparación de infraestructura cuando tenga acceso configurado.
            </p>
            <div class="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
              <label class="min-w-0 flex-1 text-sm font-semibold">Nombre del entorno
                <input v-model.trim="newGeneration" maxlength="64" type="text" autocomplete="off" placeholder="prod2"
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
    <div v-if="activeStandbyViewer"
      class="fixed inset-0 z-[100] flex flex-col bg-[var(--dh-surface)]"
      role="dialog" aria-modal="true" aria-label="Navegador independiente de Maersk">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] p-3">
        <div class="text-sm font-semibold">
          Maersk · {{ activeStandbyViewer.generation }} · Navegador independiente
          <p class="text-xs font-normal text-[var(--dh-text-muted)]">
            Ingresá al Hub de Maersk. Dhole comprobará automáticamente que esté abierto y autenticado, sin pedir datos de cuenta.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <DhButton label="Comprobar ahora" :icon="ShieldCheck"
            variant="secondary" :loading="standbyBusy === activeStandbyViewer.generation"
            :disabled="standbyBusy !== null"
            @click="inspectStandby(activeStandbyViewer.generation)" />
          <DhButton label="Cerrar visor" variant="secondary"
            @click="activeStandbyViewer = null" />
        </div>
      </div>
      <iframe :src="activeStandbyViewer.url"
        class="min-h-0 w-full flex-1 border-0"
        title="Navegador aislado de Maersk"
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
        referrerpolicy="no-referrer"
        allow="clipboard-read; clipboard-write" />
    </div>

  </section>
</template>
