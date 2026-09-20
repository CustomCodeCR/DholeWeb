<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  Activity,
  Bot,
  CalendarClock,
  Clock3,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  Ship,
  Square,
  TimerReset,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhDataTable, DhTabs, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { AGENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { AgentService } from '@/core/services/agentService'
import type {
  AgentCredentialDto,
  AgentDefinitionDto,
  AgentExecutionDto,
  AgentExecutionStatus,
  AgentExecutionStrategy,
  AgentProviderDto,
  AgentProviderType,
  AgentScheduleDto,
  AgentScheduleType,
} from '@/core/interfaces/agent'

const authStore = useAuthStore()
const toastStore = useToastStore()

const activeTab = ref('status')
const loading = ref(false)
const actionLoading = ref(false)
const serviceOnline = ref(false)
const lastRefreshAt = ref<Date | null>(null)
const providers = ref<AgentProviderDto[]>([])
const definitions = ref<AgentDefinitionDto[]>([])
const credentials = ref<AgentCredentialDto[]>([])
const schedules = ref<AgentScheduleDto[]>([])
const executions = ref<AgentExecutionDto[]>([])
const selectedExecution = ref<AgentExecutionDto | null>(null)

const tabs = [
  { key: 'status', label: 'Estado' },
  { key: 'providers', label: 'Navieras' },
  { key: 'manual', label: 'Extracción manual' },
  { key: 'schedules', label: 'Programaciones' },
  { key: 'history', label: 'Historial' },
]

const providerTypeOptions = [
  { label: 'Maersk', value: 'Maersk' },
  { label: 'MSC', value: 'Msc' },
  { label: 'PIL', value: 'Pil' },
  { label: 'CMA CGM', value: 'CmaCgm' },
  { label: 'Hapag-Lloyd', value: 'HapagLloyd' },
  { label: 'Otra naviera / web genérica', value: 'GenericWeb' },
]

const strategyOptions = [
  { label: 'Hermes (IA + navegador)', value: 'Hermes' },
  { label: 'Híbrido', value: 'Hybrid' },
  { label: 'Navegador', value: 'Browser' },
  { label: 'Navegador + captura de red', value: 'BrowserNetworkCapture' },
]

const scheduleTypeOptions = [
  { label: 'Una sola vez', value: 'Once' },
  { label: 'Cada N horas', value: 'Interval' },
  { label: 'Cron avanzado', value: 'Cron' },
]

const canViewProviders = computed(() => authStore.hasScope(AGENT_SCOPES.providers.view))
const canManageProviders = computed(
  () =>
    authStore.hasScope(AGENT_SCOPES.providers.manage) &&
    authStore.hasScope(AGENT_SCOPES.definitions.manage),
)
const canViewDefinitions = computed(() => authStore.hasScope(AGENT_SCOPES.definitions.view))
const canViewCredentials = computed(() => authStore.hasScope(AGENT_SCOPES.credentials.view))
const canManageCredentials = computed(() => authStore.hasScope(AGENT_SCOPES.credentials.manage))
const canViewSchedules = computed(() => authStore.hasScope(AGENT_SCOPES.schedules.view))
const canCreateSchedule = computed(() => authStore.hasScope(AGENT_SCOPES.schedules.create))
const canUpdateSchedule = computed(() => authStore.hasScope(AGENT_SCOPES.schedules.update))
const canExecuteSchedule = computed(() => authStore.hasScope(AGENT_SCOPES.schedules.execute))
const canViewExecutions = computed(() => authStore.hasScope(AGENT_SCOPES.executions.view))
const canCreateExecution = computed(() => authStore.hasScope(AGENT_SCOPES.executions.create))
const canCancelExecution = computed(() => authStore.hasScope(AGENT_SCOPES.executions.cancel))

const providerForm = reactive({
  code: '',
  name: '',
  providerType: 'GenericWeb' as AgentProviderType,
  baseUrl: '',
  strategy: 'Hermes' as AgentExecutionStrategy,
})

const credentialForm = reactive({
  providerId: '',
  name: '',
  usernameSecretKey: '',
  passwordSecretKey: '',
})

function tomorrowIsoDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

function defaultExtractionInput() {
  return {
    providerId: '',
    definitionId: '',
    credentialId: '',
    pol: 'Shanghai, China',
    pod: 'Puerto Caldera, Costa Rica',
    containerType: '40HC',
    quantity: '1',
    weightKg: '15000',
    commodity: 'FAK',
    cargoReadyDate: tomorrowIsoDate(),
    instruction: '',
  }
}

const manualForm = reactive(defaultExtractionInput())

const scheduleForm = reactive({
  name: '',
  scheduleType: 'Interval' as AgentScheduleType,
  intervalHours: '6',
  executeAt: '',
  cronExpression: '0 */6 * * *',
  timezone: 'America/Costa_Rica',
  ...defaultExtractionInput(),
})

const providerOptions = computed(() =>
  providers.value
    .filter((item) => item.isActive)
    .map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id })),
)

const credentialProviderOptions = providerOptions

function definitionsFor(providerId: string) {
  return definitions.value.filter((item) => item.providerId === providerId && item.isActive)
}

function credentialsFor(providerId: string) {
  return credentials.value.filter((item) => item.providerId === providerId && item.isActive)
}

function definitionOptions(providerId: string) {
  return definitionsFor(providerId).map((item) => ({ label: item.name, value: item.id }))
}

function credentialOptions(providerId: string) {
  return [
    { label: 'Sin credencial', value: '' },
    ...credentialsFor(providerId).map((item) => ({ label: item.name, value: item.id })),
  ]
}

function setExtractionDefaults(target: typeof manualForm | typeof scheduleForm, providerId: string) {
  const firstDefinition = definitionsFor(providerId)[0]
  const firstCredential = credentialsFor(providerId)[0]
  target.definitionId = firstDefinition?.id ?? ''
  target.credentialId = firstCredential?.id ?? ''
}

watch(
  () => manualForm.providerId,
  (providerId) => setExtractionDefaults(manualForm, providerId),
)

watch(
  () => scheduleForm.providerId,
  (providerId) => setExtractionDefaults(scheduleForm, providerId),
)

const activeProviderCount = computed(() => providers.value.filter((item) => item.isActive).length)
const runningExecutionCount = computed(() =>
  executions.value.filter((item) =>
    ['Pending', 'Queued', 'Running', 'WaitingForAuthentication'].includes(item.status),
  ).length,
)
const failedExecutionCount = computed(() =>
  executions.value.filter((item) => item.status === 'Failed').length,
)
const nextSchedule = computed(() =>
  schedules.value
    .filter((item) => item.isActive && item.nextExecutionAt)
    .sort(
      (a, b) =>
        new Date(a.nextExecutionAt ?? 0).getTime() - new Date(b.nextExecutionAt ?? 0).getTime(),
    )[0] ?? null,
)

const providerColumns: DhTableColumn<AgentProviderDto>[] = [
  { key: 'name', label: 'Naviera' },
  { key: 'providerType', label: 'Tipo' },
  { key: 'defaultExecutionStrategy', label: 'Estrategia' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right' },
]

const scheduleColumns: DhTableColumn<AgentScheduleDto>[] = [
  { key: 'name', label: 'Programación' },
  { key: 'providerId', label: 'Naviera' },
  { key: 'scheduleType', label: 'Frecuencia' },
  { key: 'nextExecutionAt', label: 'Próxima ejecución' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right' },
]

const executionColumns: DhTableColumn<AgentExecutionDto>[] = [
  { key: 'createdAtUtc', label: 'Creada' },
  { key: 'providerId', label: 'Naviera' },
  { key: 'executionType', label: 'Tipo' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'durationMs', label: 'Duración', align: 'right' },
  { key: 'actions', label: '', align: 'right' },
]

function providerName(id: string) {
  return providers.value.find((item) => item.id === id)?.name ?? id
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function statusVariant(status: AgentExecutionStatus) {
  if (status === 'Completed') return 'success'
  if (status === 'Failed') return 'danger'
  if (status === 'Cancelled') return 'warning'
  if (status === 'Running') return 'primary'
  if (status === 'PartiallyCompleted') return 'warning'
  return 'neutral'
}

function statusLabel(status: AgentExecutionStatus) {
  const labels: Record<AgentExecutionStatus, string> = {
    Pending: 'Pendiente',
    Queued: 'En cola',
    Running: 'Ejecutando',
    WaitingForAuthentication: 'Esperando autenticación',
    Completed: 'Completada',
    PartiallyCompleted: 'Parcial',
    Failed: 'Fallida',
    Cancelled: 'Cancelada',
  }
  return labels[status] ?? status
}

function scheduleLabel(row: AgentScheduleDto) {
  if (row.scheduleType === 'Interval') {
    const hours = Number(row.intervalMinutes ?? 0) / 60
    return `Cada ${hours} h`
  }
  if (row.scheduleType === 'Cron') return row.cronExpression ?? 'Cron'
  return 'Una vez'
}

function buildInputJson(source: typeof manualForm | typeof scheduleForm) {
  const quantity = Number(source.quantity)
  const weightKg = Number(source.weightKg)

  if (!source.pol.trim() || !source.pod.trim()) throw new Error('POL y POD son obligatorios.')
  if (!source.containerType.trim()) throw new Error('El tipo de contenedor es obligatorio.')
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero.')
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error('El peso debe ser mayor que cero.')
  if (!source.cargoReadyDate) throw new Error('Cargo Ready Date es obligatorio.')

  return JSON.stringify({
    pol: source.pol.trim(),
    pod: source.pod.trim(),
    containerType: source.containerType.trim(),
    quantity,
    weightKg,
    commodity: source.commodity.trim() || 'FAK',
    cargoReadyDate: source.cargoReadyDate,
    ...(source.instruction.trim() ? { instruction: source.instruction.trim() } : {}),
  })
}

async function loadAll(showError = true) {
  if (loading.value) return
  loading.value = true

  try {
    const [providerRows, definitionRows, credentialRows, scheduleRows, executionRows] =
      await Promise.all([
        canViewProviders.value ? AgentService.browseProviders() : Promise.resolve([]),
        canViewDefinitions.value ? AgentService.browseDefinitions() : Promise.resolve([]),
        canViewCredentials.value ? AgentService.browseCredentials() : Promise.resolve([]),
        canViewSchedules.value ? AgentService.browseSchedules() : Promise.resolve([]),
        canViewExecutions.value ? AgentService.browseExecutions(100) : Promise.resolve([]),
      ])

    providers.value = providerRows
    definitions.value = definitionRows
    credentials.value = credentialRows
    schedules.value = scheduleRows
    executions.value = executionRows
    serviceOnline.value = true
    lastRefreshAt.value = new Date()

    if (!manualForm.providerId && providerRows[0]) manualForm.providerId = providerRows[0].id
    if (!scheduleForm.providerId && providerRows[0]) scheduleForm.providerId = providerRows[0].id
    if (!credentialForm.providerId && providerRows[0]) credentialForm.providerId = providerRows[0].id
  } catch (error) {
    serviceOnline.value = false
    if (showError) {
      toastStore.backendError(error, 'No se pudo conectar con DholeAgentService.')
    }
  } finally {
    loading.value = false
  }
}

async function createProvider() {
  const code = providerForm.code.trim().toUpperCase()
  const name = providerForm.name.trim()

  if (!code || !name) {
    toastStore.warning('Datos incompletos', 'Código y nombre de naviera son obligatorios.')
    return
  }

  try {
    actionLoading.value = true
    const providerId = await AgentService.createProvider({
      code,
      name,
      providerType: providerForm.providerType,
      baseUrl: providerForm.baseUrl.trim() || null,
      defaultExecutionStrategy: providerForm.strategy,
      isSystem: false,
      metadataJson: null,
    })

    await AgentService.createDefinition({
      providerId,
      code: `${code}_GENERIC_EXTRACTION`,
      name: `${name} · Extracción de tarifas`,
      description: 'Extracción de tarifas creada desde DholeWeb.',
      actionType: 'GenericExtraction',
      executionStrategy: providerForm.strategy,
      configurationJson: null,
    })

    providerForm.code = ''
    providerForm.name = ''
    providerForm.baseUrl = ''
    providerForm.providerType = 'GenericWeb'
    providerForm.strategy = 'Hermes'

    toastStore.success('Naviera creada', 'La naviera y su definición de extracción quedaron activas.')
    await loadAll(false)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo crear la naviera.')
  } finally {
    actionLoading.value = false
  }
}

async function createCredential() {
  if (
    !credentialForm.providerId ||
    !credentialForm.name.trim() ||
    !credentialForm.usernameSecretKey.trim() ||
    !credentialForm.passwordSecretKey.trim()
  ) {
    toastStore.warning(
      'Datos incompletos',
      'Seleccione la naviera e indique nombre y claves de secretos.',
    )
    return
  }

  try {
    actionLoading.value = true
    await AgentService.createCredential({
      providerId: credentialForm.providerId,
      name: credentialForm.name.trim(),
      usernameSecretKey: credentialForm.usernameSecretKey.trim(),
      passwordSecretKey: credentialForm.passwordSecretKey.trim(),
      additionalSecretsJson: null,
    })

    credentialForm.name = ''
    credentialForm.usernameSecretKey = ''
    credentialForm.passwordSecretKey = ''

    toastStore.success('Credencial registrada', 'Se guardaron únicamente las referencias de secretos.')
    await loadAll(false)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo registrar la credencial.')
  } finally {
    actionLoading.value = false
  }
}

async function toggleProvider(row: AgentProviderDto) {
  try {
    actionLoading.value = true
    await AgentService.setProviderActive(row.id, !row.isActive)
    toastStore.success('Estado actualizado')
    await loadAll(false)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo actualizar la naviera.')
  } finally {
    actionLoading.value = false
  }
}

async function executeManual() {
  if (!manualForm.providerId || !manualForm.definitionId) {
    toastStore.warning('Configuración incompleta', 'Seleccione naviera y definición.')
    return
  }

  try {
    actionLoading.value = true
    const executionId = await AgentService.createExecution({
      agentDefinitionId: manualForm.definitionId,
      providerId: manualForm.providerId,
      credentialId: manualForm.credentialId || null,
      priority: 0,
      inputJson: buildInputJson(manualForm),
      maxAttempts: 3,
      correlationId: null,
      traceId: null,
    })

    toastStore.success('Extracción enviada', `Ejecución ${executionId.slice(0, 8)} creada.`)
    activeTab.value = 'history'
    await loadAll(false)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo iniciar la extracción.')
  } finally {
    actionLoading.value = false
  }
}

async function createSchedule() {
  if (!scheduleForm.name.trim() || !scheduleForm.providerId || !scheduleForm.definitionId) {
    toastStore.warning('Configuración incompleta', 'Nombre, naviera y definición son obligatorios.')
    return
  }

  let intervalMinutes: number | null = null
  let executeAt: string | null = null
  let cronExpression: string | null = null

  if (scheduleForm.scheduleType === 'Interval') {
    const hours = Number(scheduleForm.intervalHours)
    if (!Number.isFinite(hours) || hours <= 0) {
      toastStore.warning('Intervalo inválido', 'Indique una cantidad de horas mayor que cero.')
      return
    }
    intervalMinutes = Math.round(hours * 60)
  }

  if (scheduleForm.scheduleType === 'Once') {
    if (!scheduleForm.executeAt) {
      toastStore.warning('Fecha requerida', 'Seleccione cuándo debe ejecutarse.')
      return
    }
    executeAt = new Date(scheduleForm.executeAt).toISOString()
  }

  if (scheduleForm.scheduleType === 'Cron') {
    if (!scheduleForm.cronExpression.trim()) {
      toastStore.warning('Cron requerido', 'Indique una expresión cron válida.')
      return
    }
    cronExpression = scheduleForm.cronExpression.trim()
  }

  try {
    actionLoading.value = true
    await AgentService.createSchedule({
      name: scheduleForm.name.trim(),
      agentDefinitionId: scheduleForm.definitionId,
      providerId: scheduleForm.providerId,
      credentialId: scheduleForm.credentialId || null,
      scheduleType: scheduleForm.scheduleType,
      cronExpression,
      intervalMinutes,
      executeAt,
      timezone: scheduleForm.timezone,
      inputJson: buildInputJson(scheduleForm),
      maxRetries: 2,
      timeoutSeconds: 900,
    })

    toastStore.success('Programación creada', 'Dhole Agent ejecutará la extracción según la frecuencia indicada.')
    scheduleForm.name = ''
    await loadAll(false)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo crear la programación.')
  } finally {
    actionLoading.value = false
  }
}

async function toggleSchedule(row: AgentScheduleDto) {
  try {
    actionLoading.value = true
    await AgentService.setScheduleActive(row.id, !row.isActive)
    toastStore.success('Programación actualizada')
    await loadAll(false)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado de la programación.')
  } finally {
    actionLoading.value = false
  }
}

async function runSchedule(row: AgentScheduleDto) {
  try {
    actionLoading.value = true
    const executionId = await AgentService.runSchedule(row.id)
    toastStore.success('Ejecución enviada', `Ejecución ${executionId.slice(0, 8)} creada.`)
    await loadAll(false)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo ejecutar la programación.')
  } finally {
    actionLoading.value = false
  }
}

async function cancelExecution(row: AgentExecutionDto) {
  try {
    actionLoading.value = true
    await AgentService.cancelExecution(row.id)
    toastStore.success('Ejecución cancelada')
    await loadAll(false)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cancelar la ejecución.')
  } finally {
    actionLoading.value = false
  }
}

function canCancel(row: AgentExecutionDto) {
  return ['Pending', 'Queued', 'Running', 'WaitingForAuthentication'].includes(row.status)
}

let refreshTimer: number | null = null

onMounted(async () => {
  await loadAll()
  refreshTimer = window.setInterval(() => void loadAll(false), 20000)
})

onBeforeUnmount(() => {
  if (refreshTimer !== null) window.clearInterval(refreshTimer)
})
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Dhole Agent"
      subtitle="Administre navieras, ejecute extracciones y programe búsquedas automáticas de tarifas."
      :icon="Bot"
    >
      <template #actions>
        <DhBadge
          :label="serviceOnline ? 'Servicio en línea' : 'Servicio sin conexión'"
          :variant="serviceOnline ? 'success' : 'danger'"
        />
        <DhButton
          label="Actualizar"
          :icon="RefreshCw"
          variant="secondary"
          :loading="loading"
          @click="loadAll()"
        />
      </template>
    </DhPageHeader>

    <DhTabs v-model="activeTab" :items="tabs" />

    <template v-if="activeTab === 'status'">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm font-black text-[var(--dh-text-muted)]">DholeAgentService</p>
            <Activity class="h-5 w-5" :class="serviceOnline ? 'text-green-500' : 'text-red-500'" />
          </div>
          <p class="mt-3 text-2xl font-black text-[var(--dh-text)]">
            {{ serviceOnline ? 'Operativo' : 'Sin conexión' }}
          </p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Última actualización: {{ lastRefreshAt ? formatDate(lastRefreshAt.toISOString()) : '—' }}
          </p>
        </article>

        <article class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm font-black text-[var(--dh-text-muted)]">Navieras activas</p>
            <Ship class="h-5 w-5 text-[var(--dh-primary)]" />
          </div>
          <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ activeProviderCount }}</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ providers.length }} registradas
          </p>
        </article>

        <article class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm font-black text-[var(--dh-text-muted)]">Trabajo activo</p>
            <Play class="h-5 w-5 text-[var(--dh-primary)]" />
          </div>
          <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ runningExecutionCount }}</p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ failedExecutionCount }} fallidas entre las últimas {{ executions.length }}
          </p>
        </article>

        <article class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm font-black text-[var(--dh-text-muted)]">Próxima extracción</p>
            <Clock3 class="h-5 w-5 text-[var(--dh-primary)]" />
          </div>
          <p class="mt-3 text-base font-black text-[var(--dh-text)]">
            {{ nextSchedule?.name ?? 'Sin programación' }}
          </p>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ formatDate(nextSchedule?.nextExecutionAt) }}
          </p>
        </article>
      </div>

      <section class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="mb-4 flex items-center gap-2">
          <Activity class="h-5 w-5 text-[var(--dh-primary)]" />
          <h2 class="text-lg font-black text-[var(--dh-text)]">Ejecuciones recientes</h2>
        </div>
        <DhDataTable
          :columns="executionColumns"
          :rows="executions.slice(0, 10)"
          :loading="loading"
          empty-text="Todavía no existen ejecuciones."
          @row-click="selectedExecution = $event"
        >
          <template #cell-createdAtUtc="{ value }">{{ formatDate(String(value)) }}</template>
          <template #cell-providerId="{ value }">{{ providerName(String(value)) }}</template>
          <template #cell-status="{ row }">
            <DhBadge :label="statusLabel(row.status)" :variant="statusVariant(row.status)" />
          </template>
          <template #cell-durationMs="{ value }">
            {{ value == null ? '—' : `${value} ms` }}
          </template>
          <template #cell-actions="{ row }">
            <DhButton
              v-if="canCancelExecution && canCancel(row)"
              label="Cancelar"
              :icon="Square"
              variant="danger"
              size="sm"
              @click.stop="cancelExecution(row)"
            />
          </template>
        </DhDataTable>
      </section>
    </template>

    <template v-else-if="activeTab === 'providers'">
      <div class="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-black text-[var(--dh-text)]">Navieras y proveedores</h2>
              <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
                Maersk usa su automatización determinística; las nuevas navieras pueden usar Hermes.
              </p>
            </div>
          </div>

          <DhDataTable
            :columns="providerColumns"
            :rows="providers"
            :loading="loading"
            empty-text="No hay navieras configuradas."
          >
            <template #cell-name="{ row }">
              <div>
                <p class="font-black text-[var(--dh-text)]">{{ row.name }}</p>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ row.code }} · {{ row.baseUrl ?? 'Sin URL base' }}
                </p>
              </div>
            </template>
            <template #cell-isActive="{ row }">
              <DhBadge :label="row.isActive ? 'Activa' : 'Inactiva'" :variant="row.isActive ? 'success' : 'neutral'" />
            </template>
            <template #cell-actions="{ row }">
              <DhButton
                v-if="canManageProviders && !row.isSystem"
                :label="row.isActive ? 'Inactivar' : 'Activar'"
                :icon="Activity"
                variant="secondary"
                size="sm"
                @click.stop="toggleProvider(row)"
              />
            </template>
          </DhDataTable>
        </section>

        <section v-if="canManageProviders" class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-4 flex items-center gap-2">
            <Plus class="h-5 w-5 text-[var(--dh-primary)]" />
            <h2 class="text-lg font-black text-[var(--dh-text)]">Añadir naviera</h2>
          </div>

          <form class="space-y-4" @submit.prevent="createProvider">
            <div class="grid gap-4 sm:grid-cols-2">
              <DhInput v-model="providerForm.code" label="Código" placeholder="MSC" />
              <DhInput v-model="providerForm.name" label="Nombre" placeholder="MSC" />
            </div>
            <DhSelect
              v-model="providerForm.providerType"
              label="Tipo de proveedor"
              :options="providerTypeOptions"
            />
            <DhInput
              v-model="providerForm.baseUrl"
              label="URL base"
              placeholder="https://www.ejemplo.com"
            />
            <DhSelect
              v-model="providerForm.strategy"
              label="Estrategia"
              :options="strategyOptions"
            />
            <DhButton
              type="submit"
              label="Crear naviera"
              :icon="Plus"
              :loading="actionLoading"
              class="w-full"
            />
          </form>
        </section>
      </div>

      <section v-if="canViewCredentials" class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="mb-4 flex items-center gap-2">
          <KeyRound class="h-5 w-5 text-[var(--dh-primary)]" />
          <div>
            <h2 class="text-lg font-black text-[var(--dh-text)]">Referencias de credenciales</h2>
            <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
              DholeWeb no guarda contraseñas; solo el nombre de las variables secretas del servidor.
            </p>
          </div>
        </div>

        <div v-if="canManageCredentials" class="grid gap-4 lg:grid-cols-4">
          <DhSelect
            v-model="credentialForm.providerId"
            label="Naviera"
            :options="credentialProviderOptions"
          />
          <DhInput v-model="credentialForm.name" label="Nombre" placeholder="Cuenta principal" />
          <DhInput
            v-model="credentialForm.usernameSecretKey"
            label="Variable usuario"
            placeholder="MSC_USERNAME"
          />
          <DhInput
            v-model="credentialForm.passwordSecretKey"
            label="Variable contraseña"
            placeholder="MSC_PASSWORD"
          />
        </div>

        <div v-if="canManageCredentials" class="mt-4 flex justify-end">
          <DhButton
            label="Registrar credencial"
            :icon="KeyRound"
            :loading="actionLoading"
            @click="createCredential"
          />
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="credential in credentials"
            :key="credential.id"
            class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-black text-[var(--dh-text)]">{{ credential.name }}</p>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ providerName(credential.providerId) }}
                </p>
              </div>
              <DhBadge
                :label="credential.isActive ? 'Activa' : 'Inactiva'"
                :variant="credential.isActive ? 'success' : 'neutral'"
              />
            </div>
          </article>
        </div>
      </section>
    </template>

    <template v-else-if="activeTab === 'manual'">
      <section class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="mb-5 flex items-center gap-2">
          <Play class="h-5 w-5 text-[var(--dh-primary)]" />
          <div>
            <h2 class="text-lg font-black text-[var(--dh-text)]">Extracción manual</h2>
            <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
              Cree una ejecución inmediatamente y siga su progreso desde Historial.
            </p>
          </div>
        </div>

        <form class="space-y-5" @submit.prevent="executeManual">
          <div class="grid gap-4 md:grid-cols-3">
            <DhSelect v-model="manualForm.providerId" label="Naviera" :options="providerOptions" />
            <DhSelect
              v-model="manualForm.definitionId"
              label="Extracción"
              :options="definitionOptions(manualForm.providerId)"
            />
            <DhSelect
              v-model="manualForm.credentialId"
              label="Credencial"
              placeholder=""
              :options="credentialOptions(manualForm.providerId)"
            />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <DhInput v-model="manualForm.pol" label="POL" />
            <DhInput v-model="manualForm.pod" label="POD" />
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <DhInput v-model="manualForm.containerType" label="Contenedor" placeholder="40HC" />
            <DhInput v-model="manualForm.quantity" type="number" label="Cantidad" />
            <DhInput v-model="manualForm.weightKg" type="number" label="Peso kg" />
            <DhInput v-model="manualForm.commodity" label="Commodity" />
            <DhInput v-model="manualForm.cargoReadyDate" type="date" label="Cargo Ready" />
          </div>

          <DhTextarea
            v-model="manualForm.instruction"
            label="Instrucción adicional"
            placeholder="Opcional para Hermes: restricciones, producto, preferencias de ruta, etc."
            :rows="3"
          />

          <div class="flex justify-end">
            <DhButton
              type="submit"
              label="Extraer ahora"
              :icon="Play"
              :loading="actionLoading"
              :disabled="!canCreateExecution"
            />
          </div>
        </form>
      </section>
    </template>

    <template v-else-if="activeTab === 'schedules'">
      <div class="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section class="dh-glass dh-liquid rounded-[28px] p-5">
          <div class="mb-5 flex items-center gap-2">
            <CalendarClock class="h-5 w-5 text-[var(--dh-primary)]" />
            <div>
              <h2 class="text-lg font-black text-[var(--dh-text)]">Nueva programación</h2>
              <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
                Ejecute una vez, cada varias horas o mediante cron.
              </p>
            </div>
          </div>

          <form class="space-y-4" @submit.prevent="createSchedule">
            <DhInput v-model="scheduleForm.name" label="Nombre" placeholder="Maersk cada 6 horas" />

            <div class="grid gap-4 md:grid-cols-2">
              <DhSelect v-model="scheduleForm.providerId" label="Naviera" :options="providerOptions" />
              <DhSelect
                v-model="scheduleForm.definitionId"
                label="Extracción"
                :options="definitionOptions(scheduleForm.providerId)"
              />
            </div>

            <DhSelect
              v-model="scheduleForm.credentialId"
              label="Credencial"
              placeholder=""
              :options="credentialOptions(scheduleForm.providerId)"
            />

            <DhSelect
              v-model="scheduleForm.scheduleType"
              label="Frecuencia"
              :options="scheduleTypeOptions"
            />

            <DhInput
              v-if="scheduleForm.scheduleType === 'Interval'"
              v-model="scheduleForm.intervalHours"
              type="number"
              label="Cada cuántas horas"
            />
            <DhInput
              v-else-if="scheduleForm.scheduleType === 'Once'"
              v-model="scheduleForm.executeAt"
              type="datetime-local"
              label="Ejecutar el"
            />
            <DhInput
              v-else
              v-model="scheduleForm.cronExpression"
              label="Cron"
              placeholder="0 */6 * * *"
            />

            <div class="grid gap-4 md:grid-cols-2">
              <DhInput v-model="scheduleForm.pol" label="POL" />
              <DhInput v-model="scheduleForm.pod" label="POD" />
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <DhInput v-model="scheduleForm.containerType" label="Contenedor" />
              <DhInput v-model="scheduleForm.quantity" type="number" label="Cantidad" />
              <DhInput v-model="scheduleForm.weightKg" type="number" label="Peso kg" />
              <DhInput v-model="scheduleForm.commodity" label="Commodity" />
            </div>

            <DhInput v-model="scheduleForm.cargoReadyDate" type="date" label="Cargo Ready" />
            <DhTextarea
              v-model="scheduleForm.instruction"
              label="Instrucción adicional"
              :rows="2"
            />

            <DhButton
              type="submit"
              label="Guardar programación"
              :icon="TimerReset"
              :loading="actionLoading"
              :disabled="!canCreateSchedule"
              class="w-full"
            />
          </form>
        </section>

        <section class="dh-glass dh-liquid rounded-[28px] p-5">
          <h2 class="mb-4 text-lg font-black text-[var(--dh-text)]">Programaciones activas</h2>
          <DhDataTable
            :columns="scheduleColumns"
            :rows="schedules"
            :loading="loading"
            empty-text="No hay extracciones programadas."
          >
            <template #cell-providerId="{ value }">{{ providerName(String(value)) }}</template>
            <template #cell-scheduleType="{ row }">{{ scheduleLabel(row) }}</template>
            <template #cell-nextExecutionAt="{ value }">
              {{ formatDate(value ? String(value) : null) }}
            </template>
            <template #cell-isActive="{ row }">
              <DhBadge
                :label="row.isActive ? 'Activa' : 'Pausada'"
                :variant="row.isActive ? 'success' : 'neutral'"
              />
            </template>
            <template #cell-actions="{ row }">
              <div class="flex flex-wrap justify-end gap-2">
                <DhButton
                  v-if="canExecuteSchedule"
                  label="Ejecutar"
                  :icon="Play"
                  size="sm"
                  variant="secondary"
                  @click.stop="runSchedule(row)"
                />
                <DhButton
                  v-if="canUpdateSchedule"
                  :label="row.isActive ? 'Pausar' : 'Activar'"
                  :icon="Clock3"
                  size="sm"
                  variant="secondary"
                  @click.stop="toggleSchedule(row)"
                />
              </div>
            </template>
          </DhDataTable>
        </section>
      </div>
    </template>

    <template v-else-if="activeTab === 'history'">
      <section class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-black text-[var(--dh-text)]">Historial de extracciones</h2>
            <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
              Seleccione una fila para revisar input, output y errores.
            </p>
          </div>
        </div>

        <DhDataTable
          :columns="executionColumns"
          :rows="executions"
          :loading="loading"
          empty-text="No hay ejecuciones registradas."
          @row-click="selectedExecution = $event"
        >
          <template #cell-createdAtUtc="{ value }">{{ formatDate(String(value)) }}</template>
          <template #cell-providerId="{ value }">{{ providerName(String(value)) }}</template>
          <template #cell-status="{ row }">
            <DhBadge :label="statusLabel(row.status)" :variant="statusVariant(row.status)" />
          </template>
          <template #cell-durationMs="{ value }">
            {{ value == null ? '—' : `${value} ms` }}
          </template>
          <template #cell-actions="{ row }">
            <DhButton
              v-if="canCancelExecution && canCancel(row)"
              label="Cancelar"
              :icon="Square"
              variant="danger"
              size="sm"
              @click.stop="cancelExecution(row)"
            />
          </template>
        </DhDataTable>
      </section>

      <section v-if="selectedExecution" class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-black text-[var(--dh-text)]">Detalle de ejecución</h2>
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ selectedExecution.id }} · {{ providerName(selectedExecution.providerId) }}
            </p>
          </div>
          <DhBadge
            :label="statusLabel(selectedExecution.status)"
            :variant="statusVariant(selectedExecution.status)"
          />
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div>
            <p class="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              Input
            </p>
            <pre class="max-h-80 overflow-auto rounded-[20px] border border-[var(--dh-border)] bg-black/5 p-4 text-xs text-[var(--dh-text)] dark:bg-black/20">{{ selectedExecution.inputJson }}</pre>
          </div>
          <div>
            <p class="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
              Output / Error
            </p>
            <pre class="max-h-80 overflow-auto rounded-[20px] border border-[var(--dh-border)] bg-black/5 p-4 text-xs text-[var(--dh-text)] dark:bg-black/20">{{ selectedExecution.outputJson ?? selectedExecution.errorMessage ?? 'Sin resultado todavía.' }}</pre>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>
