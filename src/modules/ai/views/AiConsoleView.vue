<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Activity,
  Bot,
  Boxes,
  Braces,
  CheckCircle2,
  CircleDollarSign,
  Clipboard,
  CloudCog,
  DatabaseZap,
  FileCode2,
  FlaskConical,
  Gauge,
  History,
  KeyRound,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  ServerCog,
  Sparkles,
  Trash2,
  Unplug,
  WandSparkles,
} from 'lucide-vue-next'
import {
  DhBadge,
  DhButton,
  DhEmptyState,
  DhInput,
  DhSelect,
  DhSpinner,
  DhTextarea,
} from '@/shared/components/atoms'
import { DhDataTable, DhTabs, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { AI_SCOPES } from '@/core/auth/scopes'
import { AiService } from '@/core/services/aiService'
import type {
  AiConnectionDto,
  AiConnectionStatus,
  AiConnectionSummaryDto,
  AiExecutionDto,
  AiExecutionStatus,
  AiExecutionSummaryDto,
  AiExecutionType,
  AiModelDto,
  AiModelStatus,
  AiModelSummaryDto,
  AiProfileDto,
  AiProfileSummaryDto,
  AiPromptTemplateDto,
  AiPromptTemplateSummaryDto,
} from '@/core/interfaces/ai'
import AiConnectionFormDrawer from '@/modules/ai/components/AiConnectionFormDrawer.vue'
import AiDiscoveredModelsDrawer from '@/modules/ai/components/AiDiscoveredModelsDrawer.vue'
import AiExecutionDetailDrawer from '@/modules/ai/components/AiExecutionDetailDrawer.vue'
import AiModelFormDrawer from '@/modules/ai/components/AiModelFormDrawer.vue'
import AiProfileFormDrawer from '@/modules/ai/components/AiProfileFormDrawer.vue'
import AiPromptTemplateFormDrawer from '@/modules/ai/components/AiPromptTemplateFormDrawer.vue'
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue'
import {
  connectionStatusLabel,
  executionStatusLabel,
  executionTypeLabel,
  executionTypeOptions,
  formatAiCost,
  formatAiDate,
  modelStatusLabel,
  providerLabel,
  responseFormatLabel,
  routingModeLabel,
} from '@/modules/ai/aiOptions'

const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const modalStore = useModalStore()
const toastStore = useToastStore()

const activeTab = ref('playground')
const loading = ref(false)
const executing = ref(false)
const actionId = ref('')
const connections = ref<AiConnectionSummaryDto[]>([])
const models = ref<AiModelSummaryDto[]>([])
const profiles = ref<AiProfileSummaryDto[]>([])
const promptTemplates = ref<AiPromptTemplateSummaryDto[]>([])
const executions = ref<AiExecutionSummaryDto[]>([])

const connectionSearch = ref('')
const modelSearch = ref('')
const profileSearch = ref('')
const templateSearch = ref('')
const executionSearch = ref('')

const playgroundMode = ref<AiExecutionType>('Chat')
const playgroundProfileKey = ref('')
const systemPrompt = ref('')
const userPrompt = ref('Explique brevemente qué puede hacer este perfil y responda en español.')
const variablesJson = ref('{}')
const schemaOverride = ref('')
const responseText = ref('')
const responseError = ref('')
const responseMeta = ref<{
  executionId: string
  provider: string
  connection: string
  model: string
  tokens: number
  estimatedCost: number
  durationMilliseconds: number
  finishReason?: string
} | null>(null)

const tabs = [
  { key: 'playground', label: 'Playground' },
  { key: 'connections', label: 'Conexiones' },
  { key: 'models', label: 'Modelos' },
  { key: 'profiles', label: 'Perfiles' },
  { key: 'templates', label: 'Plantillas' },
  { key: 'executions', label: 'Historial' },
]

const canExecute = computed(() => authStore.hasScope(AI_SCOPES.executions.execute))
const canCreateConnection = computed(() => authStore.hasScope(AI_SCOPES.connections.create))
const canUpdateConnection = computed(() => authStore.hasScope(AI_SCOPES.connections.update))
const canDeleteConnection = computed(() => authStore.hasScope(AI_SCOPES.connections.delete))
const canTestConnection = computed(() => authStore.hasScope(AI_SCOPES.connections.test))
const canDiscoverModels = computed(() => authStore.hasScope(AI_SCOPES.connections.discoverModels))
const canSetConnectionActive = computed(() => authStore.hasScope(AI_SCOPES.connections.setActive))
const canCreateModel = computed(() => authStore.hasScope(AI_SCOPES.models.create))
const canUpdateModel = computed(() => authStore.hasScope(AI_SCOPES.models.update))
const canDeleteModel = computed(() => authStore.hasScope(AI_SCOPES.models.delete))
const canSetModelActive = computed(() => authStore.hasScope(AI_SCOPES.models.setActive))
const canCreateProfile = computed(() => authStore.hasScope(AI_SCOPES.profiles.create))
const canUpdateProfile = computed(() => authStore.hasScope(AI_SCOPES.profiles.update))
const canDeleteProfile = computed(() => authStore.hasScope(AI_SCOPES.profiles.delete))
const canSetProfileActive = computed(() => authStore.hasScope(AI_SCOPES.profiles.setActive))
const canCreateTemplate = computed(() => authStore.hasScope(AI_SCOPES.promptTemplates.create))
const canUpdateTemplate = computed(() => authStore.hasScope(AI_SCOPES.promptTemplates.update))
const canDeleteTemplate = computed(() => authStore.hasScope(AI_SCOPES.promptTemplates.delete))
const canSetTemplateActive = computed(() => authStore.hasScope(AI_SCOPES.promptTemplates.setActive))

const healthyConnections = computed(
  () => connections.value.filter((connection) => connection.isActive && connection.status === 'Healthy').length,
)
const activeModels = computed(() => models.value.filter((model) => model.isActive).length)
const activeProfiles = computed(() => profiles.value.filter((profile) => profile.isActive).length)
const completedExecutions = computed(
  () => executions.value.filter((execution) => execution.status === 'Completed').length,
)
const totalExecutionCost = computed(() =>
  executions.value.reduce((total, execution) => total + Number(execution.estimatedCost ?? 0), 0),
)

const profileOptions = computed(() =>
  profiles.value
    .filter((profile) => profile.isActive)
    .map((profile) => ({ label: `${profile.name} · ${profile.key}`, value: profile.key })),
)

const filteredConnections = computed(() => filterBySearch(connections.value, connectionSearch.value, (item) => [item.name, item.providerType, item.baseUrl]))
const filteredModels = computed(() => filterBySearch(models.value, modelSearch.value, (item) => [item.name, item.externalModelId, item.connectionName, item.providerType]))
const filteredProfiles = computed(() => filterBySearch(profiles.value, profileSearch.value, (item) => [item.name, item.key, item.description ?? '', item.routingMode]))
const filteredTemplates = computed(() => filterBySearch(promptTemplates.value, templateSearch.value, (item) => [item.name, item.key, item.description ?? '']))
const filteredExecutions = computed(() => filterBySearch(executions.value, executionSearch.value, (item) => [item.profileName, item.profileKey, item.modelName ?? '', item.providerType ?? '', item.status]))

const connectionColumns: DhTableColumn<AiConnectionSummaryDto>[] = [
  { key: 'name', label: 'Conexión' },
  { key: 'providerType', label: 'Proveedor' },
  { key: 'status', label: 'Salud', align: 'center' },
  { key: 'lastHealthCheckAtUtc', label: 'Última prueba' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right' },
]
const modelColumns: DhTableColumn<AiModelSummaryDto>[] = [
  { key: 'name', label: 'Modelo' },
  { key: 'connectionName', label: 'Conexión' },
  { key: 'capabilities', label: 'Capacidades' },
  { key: 'status', label: 'Disponibilidad', align: 'center' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right' },
]
const profileColumns: DhTableColumn<AiProfileSummaryDto>[] = [
  { key: 'name', label: 'Perfil' },
  { key: 'routingMode', label: 'Enrutamiento' },
  { key: 'responseFormat', label: 'Respuesta' },
  { key: 'modelCount', label: 'Modelos', align: 'center' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right' },
]
const templateColumns: DhTableColumn<AiPromptTemplateSummaryDto>[] = [
  { key: 'name', label: 'Plantilla' },
  { key: 'key', label: 'Key' },
  { key: 'variableCount', label: 'Variables', align: 'center' },
  { key: 'isActive', label: 'Estado', align: 'center' },
  { key: 'actions', label: '', align: 'right' },
]
const executionColumns: DhTableColumn<AiExecutionSummaryDto>[] = [
  { key: 'startedAtUtc', label: 'Inicio' },
  { key: 'profileName', label: 'Perfil' },
  { key: 'executionType', label: 'Tipo' },
  { key: 'modelName', label: 'Modelo' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'durationMilliseconds', label: 'Duración', align: 'right' },
  { key: 'estimatedCost', label: 'Costo', align: 'right' },
]

function filterBySearch<T>(items: T[], search: string, values: (item: T) => string[]) {
  const normalized = search.trim().toLocaleLowerCase()
  if (!normalized) return items
  return items.filter((item) => values(item).some((value) => value.toLocaleLowerCase().includes(normalized)))
}

function connectionVariant(status: AiConnectionStatus) {
  if (status === 'Healthy') return 'success'
  if (status === 'Unhealthy') return 'danger'
  return 'neutral'
}

function modelVariant(status: AiModelStatus) {
  if (status === 'Available') return 'success'
  if (status === 'Unavailable') return 'danger'
  return 'neutral'
}

function executionVariant(status: AiExecutionStatus) {
  if (status === 'Completed') return 'success'
  if (status === 'Failed') return 'danger'
  if (status === 'Cancelled') return 'warning'
  if (status === 'Running') return 'primary'
  return 'neutral'
}

function parseVariables() {
  const text = variablesJson.value.trim()
  if (!text || text === '{}') return []
  const value = JSON.parse(text) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Variables debe ser un objeto JSON.')
  return Object.entries(value as Record<string, unknown>).map(([name, item]) => ({
    name,
    value: typeof item === 'string' ? item : JSON.stringify(item),
  }))
}

async function loadAll() {
  try {
    loading.value = true
    const [connectionsResult, modelsResult, profilesResult, templatesResult, executionsResult] =
      await Promise.all([
        AiService.browseConnections({ pageNumber: 1, pageSize: 200 }),
        AiService.browseModels({ pageNumber: 1, pageSize: 500 }),
        AiService.browseProfiles({ pageNumber: 1, pageSize: 200 }),
        AiService.browsePromptTemplates({ pageNumber: 1, pageSize: 200 }),
        AiService.browseExecutions({ pageNumber: 1, pageSize: 50 }),
      ])

    connections.value = connectionsResult.items
    models.value = modelsResult.items
    profiles.value = profilesResult.items
    promptTemplates.value = templatesResult.items
    executions.value = executionsResult.items

    if (!playgroundProfileKey.value || !profiles.value.some((profile) => profile.key === playgroundProfileKey.value && profile.isActive)) {
      playgroundProfileKey.value = profiles.value.find((profile) => profile.isActive)?.key ?? ''
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la consola de inteligencia artificial.')
  } finally {
    loading.value = false
  }
}

async function executePlayground() {
  if (!playgroundProfileKey.value) {
    toastStore.warning('Perfil requerido', 'Seleccione un perfil activo para ejecutar la prueba.')
    return
  }
  if (!userPrompt.value.trim()) {
    toastStore.warning('Entrada requerida', 'Escriba el mensaje o los textos que desea procesar.')
    return
  }

  try {
    executing.value = true
    responseText.value = ''
    responseError.value = ''
    responseMeta.value = null
    const variables = parseVariables()

    if (playgroundMode.value === 'Embeddings') {
      const inputs = userPrompt.value.split(/\n{2,}|\n/).map((item) => item.trim()).filter(Boolean)
      const result = await AiService.executeEmbeddings({
        profileKey: playgroundProfileKey.value,
        inputs,
      })
      responseText.value = JSON.stringify(result.embeddings, null, 2)
      responseMeta.value = {
        executionId: result.executionId,
        provider: providerLabel(result.providerType),
        connection: result.connectionName,
        model: `${result.modelName} · ${result.externalModelId}`,
        tokens: result.inputTokens,
        estimatedCost: result.estimatedCost,
        durationMilliseconds: result.durationMilliseconds,
      }
    } else {
      const messages = [
        ...(systemPrompt.value.trim() ? [{ role: 'system' as const, content: systemPrompt.value.trim() }] : []),
        { role: 'user' as const, content: userPrompt.value.trim() },
      ]

      if (playgroundMode.value === 'Structured') {
        const result = await AiService.executeStructured({
          profileKey: playgroundProfileKey.value,
          messages,
          variables,
          jsonSchemaOverride: schemaOverride.value.trim() || null,
        })
        try {
          responseText.value = JSON.stringify(JSON.parse(result.jsonContent), null, 2)
        } catch {
          responseText.value = result.jsonContent
        }
        responseMeta.value = {
          executionId: result.executionId,
          provider: providerLabel(result.providerType),
          connection: result.connectionName,
          model: `${result.modelName} · ${result.externalModelId}`,
          tokens: result.tokenUsage.totalTokens,
          estimatedCost: result.estimatedCost,
          durationMilliseconds: result.durationMilliseconds,
          finishReason: result.finishReason,
        }
      } else {
        const result = await AiService.executeChat({
          profileKey: playgroundProfileKey.value,
          messages,
          variables,
        })
        responseText.value = result.content
        responseMeta.value = {
          executionId: result.executionId,
          provider: providerLabel(result.providerType),
          connection: result.connectionName,
          model: `${result.modelName} · ${result.externalModelId}`,
          tokens: result.tokenUsage.totalTokens,
          estimatedCost: result.estimatedCost,
          durationMilliseconds: result.durationMilliseconds,
          finishReason: result.finishReason,
        }
      }
    }

    toastStore.success('Prueba completada', 'La ejecución quedó registrada en el historial.')
    const history = await AiService.browseExecutions({ pageNumber: 1, pageSize: 50 })
    executions.value = history.items
  } catch (error) {
    responseError.value = error instanceof Error ? error.message : 'La ejecución no pudo completarse.'
    toastStore.backendError(error, 'No se pudo ejecutar la prueba de IA.')
  } finally {
    executing.value = false
  }
}

async function copyResponse() {
  if (!responseText.value) return
  await navigator.clipboard.writeText(responseText.value)
  toastStore.success('Respuesta copiada')
}

function openCreateConnection() {
  drawerStore.open({
    title: 'Nueva conexión de IA',
    component: AiConnectionFormDrawer,
    size: 'lg',
    props: { onSaved: loadAll },
  })
}

async function openEditConnection(connection: AiConnectionSummaryDto) {
  try {
    actionId.value = connection.id
    const detail = await AiService.getConnection(connection.id)
    drawerStore.open({
      title: `Editar ${detail.name}`,
      component: AiConnectionFormDrawer,
      size: 'lg',
      props: { connection: detail, onSaved: loadAll },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la conexión.')
  } finally {
    actionId.value = ''
  }
}

async function testConnection(connection: AiConnectionSummaryDto) {
  try {
    actionId.value = connection.id
    const result = await AiService.testConnection(connection.id)
    if (result.success) toastStore.success('Conexión saludable', `${connection.name} respondió en ${result.durationMilliseconds} ms.`)
    else toastStore.warning('Conexión con errores', result.errorMessage ?? 'El proveedor no respondió correctamente.')
    await loadAll()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo probar la conexión.')
  } finally {
    actionId.value = ''
  }
}

async function discoverModels(connection: AiConnectionSummaryDto) {
  try {
    actionId.value = connection.id
    const discovered = await AiService.discoverModels(connection.id)
    drawerStore.open({
      title: `Modelos detectados · ${connection.name}`,
      component: AiDiscoveredModelsDrawer,
      size: 'xl',
      props: { connection, discovered, connections: connections.value, onSaved: loadAll },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron descubrir los modelos del proveedor.')
  } finally {
    actionId.value = ''
  }
}

async function toggleConnection(connection: AiConnectionSummaryDto) {
  try {
    actionId.value = connection.id
    await AiService.setConnectionActive(connection.id, !connection.isActive)
    toastStore.success(connection.isActive ? 'Conexión desactivada' : 'Conexión activada')
    await loadAll()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado de la conexión.')
  } finally {
    actionId.value = ''
  }
}

function openCreateModel() {
  drawerStore.open({
    title: 'Registrar modelo',
    component: AiModelFormDrawer,
    size: 'lg',
    props: { connections: connections.value.filter((connection) => connection.isActive), onSaved: loadAll },
  })
}

async function openEditModel(model: AiModelSummaryDto) {
  try {
    actionId.value = model.id
    const detail = await AiService.getModel(model.id)
    drawerStore.open({
      title: `Editar ${detail.name}`,
      component: AiModelFormDrawer,
      size: 'lg',
      props: { model: detail, connections: connections.value, onSaved: loadAll },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el modelo.')
  } finally {
    actionId.value = ''
  }
}

async function toggleModel(model: AiModelSummaryDto) {
  await performToggle(model.id, () => AiService.setModelActive(model.id, !model.isActive), model.isActive ? 'Modelo desactivado' : 'Modelo activado')
}

function openCreateProfile() {
  drawerStore.open({
    title: 'Nuevo perfil de IA',
    component: AiProfileFormDrawer,
    size: 'xl',
    props: { models: models.value, promptTemplates: promptTemplates.value, onSaved: loadAll },
  })
}

async function openEditProfile(profile: AiProfileSummaryDto) {
  try {
    actionId.value = profile.id
    const detail = await AiService.getProfile(profile.id)
    drawerStore.open({
      title: `Editar ${detail.name}`,
      component: AiProfileFormDrawer,
      size: 'xl',
      props: { profile: detail, models: models.value, promptTemplates: promptTemplates.value, onSaved: loadAll },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el perfil.')
  } finally {
    actionId.value = ''
  }
}

async function toggleProfile(profile: AiProfileSummaryDto) {
  await performToggle(profile.id, () => AiService.setProfileActive(profile.id, !profile.isActive), profile.isActive ? 'Perfil desactivado' : 'Perfil activado')
}

function openCreateTemplate() {
  drawerStore.open({
    title: 'Nueva plantilla de prompt',
    component: AiPromptTemplateFormDrawer,
    size: 'xl',
    props: { onSaved: loadAll },
  })
}

async function openEditTemplate(template: AiPromptTemplateSummaryDto) {
  try {
    actionId.value = template.id
    const detail = await AiService.getPromptTemplate(template.id)
    drawerStore.open({
      title: `Editar ${detail.name}`,
      component: AiPromptTemplateFormDrawer,
      size: 'xl',
      props: { template: detail, onSaved: loadAll },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la plantilla.')
  } finally {
    actionId.value = ''
  }
}

async function toggleTemplate(template: AiPromptTemplateSummaryDto) {
  await performToggle(template.id, () => AiService.setPromptTemplateActive(template.id, !template.isActive), template.isActive ? 'Plantilla desactivada' : 'Plantilla activada')
}

async function performToggle(id: string, action: () => Promise<unknown>, successMessage: string) {
  try {
    actionId.value = id
    await action()
    toastStore.success(successMessage)
    await loadAll()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado.')
  } finally {
    actionId.value = ''
  }
}

function confirmDelete(title: string, message: string, action: () => Promise<unknown>) {
  modalStore.open({
    title,
    component: DhConfirmDialog,
    size: 'md',
    props: {
      title,
      message,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          await action()
          modalStore.close()
          toastStore.success('Registro eliminado')
          await loadAll()
        } catch (error) {
          toastStore.backendError(error, 'No se pudo eliminar el registro.')
        }
      },
      onCancel: () => modalStore.close(),
    },
  })
}

async function openExecution(execution: AiExecutionSummaryDto) {
  try {
    actionId.value = execution.id
    const detail: AiExecutionDto = await AiService.getExecution(execution.id)
    drawerStore.open({
      title: `Ejecución ${detail.id.slice(0, 8)}`,
      component: AiExecutionDetailDrawer,
      size: 'xl',
      props: { execution: detail },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el detalle de la ejecución.')
  } finally {
    actionId.value = ''
  }
}

onMounted(loadAll)
</script>

<template>
  <section class="space-y-6 pb-8">
    <DhPageHeader
      title="Centro de inteligencia artificial"
      subtitle="Pruebe perfiles, administre proveedores y prepare el servicio para integraciones gRPC y tareas en segundo plano."
      :icon="Sparkles"
    >
      <template #actions>
        <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :loading="loading" @click="loadAll" />
      </template>
    </DhPageHeader>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <article class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="flex items-center justify-between"><p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Conexiones sanas</p><Activity class="h-5 w-5 text-green-500" /></div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ healthyConnections }}/{{ connections.length }}</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="flex items-center justify-between"><p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Modelos activos</p><Bot class="h-5 w-5 text-[var(--dh-primary)]" /></div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ activeModels }}</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="flex items-center justify-between"><p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Perfiles activos</p><WandSparkles class="h-5 w-5 text-violet-500" /></div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ activeProfiles }}</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="flex items-center justify-between"><p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Ejecuciones OK</p><CheckCircle2 class="h-5 w-5 text-sky-500" /></div>
        <p class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ completedExecutions }}</p>
      </article>
      <article class="dh-glass dh-liquid rounded-[28px] p-5">
        <div class="flex items-center justify-between"><p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Costo últimas 50</p><CircleDollarSign class="h-5 w-5 text-amber-500" /></div>
        <p class="mt-3 text-xl font-black text-[var(--dh-text)]">{{ formatAiCost(totalExecutionCost) }}</p>
      </article>
    </section>

    <div class="dh-scrollbar overflow-x-auto">
      <DhTabs v-model="activeTab" :items="tabs" class="min-w-max" />
    </div>

    <section v-if="activeTab === 'playground'" class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form class="dh-glass dh-liquid space-y-5 rounded-[32px] p-5" @submit.prevent="executePlayground">
        <div class="flex items-center justify-between gap-3">
          <div><h2 class="text-lg font-black text-[var(--dh-text)]">Banco de pruebas</h2><p class="text-xs font-semibold text-[var(--dh-text-muted)]">La ejecución usa el perfil completo, incluyendo prioridad, fallback, costos y plantilla.</p></div>
          <FlaskConical class="h-6 w-6 text-[var(--dh-primary)]" />
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <DhSelect v-model="playgroundProfileKey" label="Perfil" :options="profileOptions" placeholder="Seleccione un perfil activo" />
          <DhSelect v-model="playgroundMode" label="Tipo de prueba" :options="executionTypeOptions" />
        </div>

        <DhTextarea v-if="playgroundMode !== 'Embeddings'" v-model="systemPrompt" label="System prompt adicional" :rows="4" placeholder="Opcional: instrucciones adicionales para esta prueba" />
        <DhTextarea v-model="userPrompt" :label="playgroundMode === 'Embeddings' ? 'Textos (uno por línea)' : 'Mensaje del usuario'" :rows="10" placeholder="Escriba la solicitud que desea probar" />
        <DhTextarea v-if="playgroundMode !== 'Embeddings'" v-model="variablesJson" label="Variables de plantilla (JSON)" :rows="4" placeholder='{"rateJson":"...","language":"es"}' />
        <DhTextarea v-if="playgroundMode === 'Structured'" v-model="schemaOverride" label="JSON Schema de prueba (opcional)" :rows="7" placeholder='{"type":"object","properties":{}}' />

        <div class="flex justify-end">
          <DhButton type="submit" label="Ejecutar prueba" :icon="Play" :loading="executing" :disabled="!canExecute || !playgroundProfileKey" />
        </div>
      </form>

      <section class="dh-glass dh-liquid flex min-h-[620px] flex-col rounded-[32px] p-5">
        <div class="flex items-center justify-between gap-3">
          <div><h2 class="text-lg font-black text-[var(--dh-text)]">Respuesta</h2><p class="text-xs font-semibold text-[var(--dh-text-muted)]">Resultado bruto y métricas del proveedor seleccionado.</p></div>
          <DhButton v-if="responseText" label="Copiar" :icon="Clipboard" size="sm" variant="secondary" @click="copyResponse" />
        </div>

        <div v-if="executing" class="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--dh-text-muted)]"><DhSpinner /><p class="text-sm font-black">Ejecutando perfil y registrando intentos...</p></div>
        <DhEmptyState v-else-if="!responseText && !responseError" class="flex-1" title="Sin respuesta todavía" description="Ejecute una prueba para ver el contenido, modelo elegido, tokens, costo y duración." :icon="Bot" />
        <div v-else-if="responseError" class="mt-5 whitespace-pre-wrap rounded-[24px] border border-red-500/25 bg-red-500/10 p-5 text-sm font-semibold text-red-600 dark:text-red-300">{{ responseError }}</div>
        <template v-else>
          <div class="dh-scrollbar mt-5 flex-1 overflow-auto rounded-[24px] border border-[var(--dh-border)] bg-black/[0.025] p-5 dark:bg-black/20"><pre class="whitespace-pre-wrap break-words font-sans text-sm font-semibold leading-7 text-[var(--dh-text)]">{{ responseText }}</pre></div>
          <div v-if="responseMeta" class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div class="rounded-[18px] border border-[var(--dh-border)] p-3"><p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Proveedor</p><p class="mt-1 text-sm font-black text-[var(--dh-text)]">{{ responseMeta.provider }}</p></div>
            <div class="rounded-[18px] border border-[var(--dh-border)] p-3"><p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Modelo</p><p class="mt-1 line-clamp-2 text-sm font-black text-[var(--dh-text)]">{{ responseMeta.model }}</p></div>
            <div class="rounded-[18px] border border-[var(--dh-border)] p-3"><p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Duración</p><p class="mt-1 text-sm font-black text-[var(--dh-text)]">{{ responseMeta.durationMilliseconds }} ms</p></div>
            <div class="rounded-[18px] border border-[var(--dh-border)] p-3"><p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tokens</p><p class="mt-1 text-sm font-black text-[var(--dh-text)]">{{ responseMeta.tokens }}</p></div>
            <div class="rounded-[18px] border border-[var(--dh-border)] p-3"><p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Costo</p><p class="mt-1 text-sm font-black text-[var(--dh-text)]">{{ formatAiCost(responseMeta.estimatedCost) }}</p></div>
            <div class="rounded-[18px] border border-[var(--dh-border)] p-3"><p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Ejecución</p><button type="button" class="mt-1 text-left text-sm font-black text-[var(--dh-primary)]" @click="activeTab = 'executions'">{{ responseMeta.executionId.slice(0, 8) }}…</button></div>
          </div>
        </template>
      </section>
    </section>

    <section v-else-if="activeTab === 'connections'" class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
        <DhInput v-model="connectionSearch" label="Buscar conexiones" placeholder="Nombre, proveedor o URL" :icon="Search" class="w-full max-w-md" />
        <DhButton v-if="canCreateConnection" label="Nueva conexión" :icon="Plus" @click="openCreateConnection" />
      </div>
      <DhDataTable :columns="connectionColumns" :rows="filteredConnections" :loading="loading" empty-text="No hay conexiones de IA registradas.">
        <template #cell-name="{ row }"><div><p class="font-black text-[var(--dh-text)]">{{ row.name }}</p><p class="mt-1 max-w-sm truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.baseUrl }}</p></div></template>
        <template #cell-providerType="{ row }"><span class="font-black">{{ providerLabel(row.providerType) }}</span></template>
        <template #cell-status="{ row }"><DhBadge :label="connectionStatusLabel(row.status)" :variant="connectionVariant(row.status)" /></template>
        <template #cell-lastHealthCheckAtUtc="{ row }">{{ formatAiDate(row.lastHealthCheckAtUtc) }}</template>
        <template #cell-isActive="{ value }"><DhBadge :label="value ? 'Activa' : 'Inactiva'" :variant="value ? 'success' : 'neutral'" /></template>
        <template #cell-actions="{ row }"><div class="flex justify-end gap-1">
          <button v-if="canTestConnection" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" title="Probar conexión" :disabled="actionId === row.id" @click.stop="testConnection(row)"><Gauge class="h-4 w-4" /></button>
          <button v-if="canDiscoverModels" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" title="Descubrir modelos" :disabled="actionId === row.id" @click.stop="discoverModels(row)"><DatabaseZap class="h-4 w-4" /></button>
          <button v-if="canSetConnectionActive" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" :title="row.isActive ? 'Desactivar' : 'Activar'" @click.stop="toggleConnection(row)"><Power class="h-4 w-4" /></button>
          <button v-if="canUpdateConnection" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" title="Editar" @click.stop="openEditConnection(row)"><Pencil class="h-4 w-4" /></button>
          <button v-if="canDeleteConnection" class="rounded-xl p-2 text-red-500 hover:bg-red-500/10" title="Eliminar" @click.stop="confirmDelete('Eliminar conexión', `¿Eliminar ${row.name}?`, () => AiService.deleteConnection(row.id))"><Trash2 class="h-4 w-4" /></button>
        </div></template>
      </DhDataTable>
    </section>

    <section v-else-if="activeTab === 'models'" class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3"><DhInput v-model="modelSearch" label="Buscar modelos" placeholder="Modelo, ID externo o conexión" :icon="Search" class="w-full max-w-md" /><DhButton v-if="canCreateModel" label="Registrar modelo" :icon="Plus" @click="openCreateModel" /></div>
      <DhDataTable :columns="modelColumns" :rows="filteredModels" :loading="loading" empty-text="No hay modelos registrados.">
        <template #cell-name="{ row }"><div><p class="font-black text-[var(--dh-text)]">{{ row.name }}</p><p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.externalModelId }} · {{ providerLabel(row.providerType) }}<span v-if="row.isLocal"> · Local</span></p></div></template>
        <template #cell-connectionName="{ value }"><span class="font-black">{{ value }}</span></template>
        <template #cell-capabilities="{ value }"><div class="flex max-w-md flex-wrap gap-1"><span v-for="capability in value" :key="capability" class="rounded-full bg-black/5 px-2 py-1 text-[10px] font-black dark:bg-white/10">{{ capability }}</span></div></template>
        <template #cell-status="{ row }"><DhBadge :label="modelStatusLabel(row.status)" :variant="modelVariant(row.status)" /></template>
        <template #cell-isActive="{ value }"><DhBadge :label="value ? 'Activo' : 'Inactivo'" :variant="value ? 'success' : 'neutral'" /></template>
        <template #cell-actions="{ row }"><div class="flex justify-end gap-1"><button v-if="canSetModelActive" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" :title="row.isActive ? 'Desactivar' : 'Activar'" @click.stop="toggleModel(row)"><Power class="h-4 w-4" /></button><button v-if="canUpdateModel" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" title="Editar" @click.stop="openEditModel(row)"><Pencil class="h-4 w-4" /></button><button v-if="canDeleteModel" class="rounded-xl p-2 text-red-500 hover:bg-red-500/10" title="Eliminar" @click.stop="confirmDelete('Eliminar modelo', `¿Eliminar ${row.name}?`, () => AiService.deleteModel(row.id))"><Trash2 class="h-4 w-4" /></button></div></template>
      </DhDataTable>
    </section>

    <section v-else-if="activeTab === 'profiles'" class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3"><DhInput v-model="profileSearch" label="Buscar perfiles" placeholder="Nombre, key o enrutamiento" :icon="Search" class="w-full max-w-md" /><DhButton v-if="canCreateProfile" label="Nuevo perfil" :icon="Plus" @click="openCreateProfile" /></div>
      <DhDataTable :columns="profileColumns" :rows="filteredProfiles" :loading="loading" empty-text="No hay perfiles de IA registrados.">
        <template #cell-name="{ row }"><div><p class="font-black text-[var(--dh-text)]">{{ row.name }}</p><p class="mt-1 text-xs font-semibold text-[var(--dh-primary)]">{{ row.key }}</p><p v-if="row.description" class="mt-1 line-clamp-1 max-w-sm text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.description }}</p></div></template>
        <template #cell-routingMode="{ row }"><span class="font-black">{{ routingModeLabel(row.routingMode) }}</span></template>
        <template #cell-responseFormat="{ row }"><DhBadge :label="responseFormatLabel(row.responseFormat)" variant="primary" /></template>
        <template #cell-modelCount="{ value }"><span class="font-black">{{ value }}</span></template>
        <template #cell-isActive="{ value }"><DhBadge :label="value ? 'Activo' : 'Inactivo'" :variant="value ? 'success' : 'neutral'" /></template>
        <template #cell-actions="{ row }"><div class="flex justify-end gap-1"><button v-if="canSetProfileActive" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" :title="row.isActive ? 'Desactivar' : 'Activar'" @click.stop="toggleProfile(row)"><Power class="h-4 w-4" /></button><button v-if="canUpdateProfile" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" title="Editar" @click.stop="openEditProfile(row)"><Pencil class="h-4 w-4" /></button><button v-if="canDeleteProfile" class="rounded-xl p-2 text-red-500 hover:bg-red-500/10" title="Eliminar" @click.stop="confirmDelete('Eliminar perfil', `¿Eliminar ${row.name}?`, () => AiService.deleteProfile(row.id))"><Trash2 class="h-4 w-4" /></button></div></template>
      </DhDataTable>
    </section>

    <section v-else-if="activeTab === 'templates'" class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3"><DhInput v-model="templateSearch" label="Buscar plantillas" placeholder="Nombre, key o descripción" :icon="Search" class="w-full max-w-md" /><DhButton v-if="canCreateTemplate" label="Nueva plantilla" :icon="Plus" @click="openCreateTemplate" /></div>
      <DhDataTable :columns="templateColumns" :rows="filteredTemplates" :loading="loading" empty-text="No hay plantillas de prompt registradas.">
        <template #cell-name="{ row }"><div><p class="font-black text-[var(--dh-text)]">{{ row.name }}</p><p v-if="row.description" class="mt-1 line-clamp-1 max-w-md text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.description }}</p></div></template>
        <template #cell-key="{ value }"><code class="rounded-full bg-[var(--dh-primary-soft)] px-3 py-1 text-xs font-black text-[var(--dh-primary)]">{{ value }}</code></template>
        <template #cell-variableCount="{ value }"><span class="font-black">{{ value }}</span></template>
        <template #cell-isActive="{ value }"><DhBadge :label="value ? 'Activa' : 'Inactiva'" :variant="value ? 'success' : 'neutral'" /></template>
        <template #cell-actions="{ row }"><div class="flex justify-end gap-1"><button v-if="canSetTemplateActive" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" :title="row.isActive ? 'Desactivar' : 'Activar'" @click.stop="toggleTemplate(row)"><Power class="h-4 w-4" /></button><button v-if="canUpdateTemplate" class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10" title="Editar" @click.stop="openEditTemplate(row)"><Pencil class="h-4 w-4" /></button><button v-if="canDeleteTemplate" class="rounded-xl p-2 text-red-500 hover:bg-red-500/10" title="Eliminar" @click.stop="confirmDelete('Eliminar plantilla', `¿Eliminar ${row.name}?`, () => AiService.deletePromptTemplate(row.id))"><Trash2 class="h-4 w-4" /></button></div></template>
      </DhDataTable>
    </section>

    <section v-else class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3"><DhInput v-model="executionSearch" label="Buscar ejecuciones" placeholder="Perfil, modelo, proveedor o estado" :icon="Search" class="w-full max-w-md" /><div class="flex items-center gap-2 text-xs font-semibold text-[var(--dh-text-muted)]"><History class="h-4 w-4" /> Últimas 50 ejecuciones</div></div>
      <DhDataTable :columns="executionColumns" :rows="filteredExecutions" :loading="loading" empty-text="No hay ejecuciones registradas." @row-click="openExecution">
        <template #cell-startedAtUtc="{ row }">{{ formatAiDate(row.startedAtUtc) }}</template>
        <template #cell-profileName="{ row }"><div><p class="font-black text-[var(--dh-text)]">{{ row.profileName }}</p><p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.profileKey }}</p></div></template>
        <template #cell-executionType="{ row }"><span class="font-black">{{ executionTypeLabel(row.executionType) }}</span></template>
        <template #cell-modelName="{ row }"><div><p class="font-black text-[var(--dh-text)]">{{ row.modelName ?? 'Sin selección' }}</p><p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ providerLabel(row.providerType) }}</p></div></template>
        <template #cell-status="{ row }"><DhBadge :label="executionStatusLabel(row.status)" :variant="executionVariant(row.status)" /></template>
        <template #cell-durationMilliseconds="{ value }"><span class="font-black">{{ value }} ms</span></template>
        <template #cell-estimatedCost="{ value }"><span class="font-black">{{ formatAiCost(Number(value)) }}</span></template>
      </DhDataTable>
    </section>
  </section>
</template>
