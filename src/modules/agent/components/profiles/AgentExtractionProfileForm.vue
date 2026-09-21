<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import {
  AGENT_EXECUTION_STRATEGIES,
  type AgentExecutionStrategy,
  type AgentExtractionProfileDto,
  type CreateAgentExtractionProfileRequest,
  type UpdateAgentExtractionProfileRequest,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'
import { useAgentPermissions } from '@/modules/agent/composables/useAgentPermissions'
import { useAgentStore } from '@/modules/agent/stores/agentStore'

const props = defineProps<{
  profile?: AgentExtractionProfileDto | null
}>()

const emit = defineEmits<{
  saved: [profileId: string]
  cancel: []
}>()

const store = useAgentStore()
const permissions = useAgentPermissions()
const toastStore = useToastStore()
const saving = ref(false)

const defaultPrompt = `Acceda al portal de {{providerName}}.
URL base: {{baseUrl}}
Login: {{loginUrl}}
Búsqueda: {{searchUrl}}

Ejecute la extracción usando estas rutas:
{{routes}}

Equipos a consultar:
{{equipment}}

Capture únicamente estos datos:
{{fields}}

Reglas de endpoints/red:
{{captureRules}}

Cargo Ready Date: {{cargoReadyDate}}
Execution ID: {{executionId}}

No realice reservas, compras ni acciones irreversibles. Devuelva datos estructurados y preserve precios, moneda, ETD, ETA, tránsito, buque, viaje, ruta y desglose de cargos cuando existan.`

const form = reactive({
  providerId: '',
  credentialId: '',
  name: '',
  description: '',
  baseUrl: '',
  loginUrl: '',
  searchUrl: '',
  promptTemplate: defaultPrompt,
  executionStrategy: 'Hermes' as AgentExecutionStrategy,
  parserKey: '',
})

const providerOptions = computed(() =>
  store.activeProviders.map((item) => ({ value: item.id, label: `${item.name} (${item.code})` })),
)

const credentialOptions = computed(() => [
  { value: '', label: 'Sin credencial' },
  ...store.credentials
    .filter((item) => item.isActive && (!form.providerId || item.providerId === form.providerId))
    .map((item) => ({ value: item.id, label: `${item.name} · ${item.usernameMasked}` })),
])

const strategyOptions = AGENT_EXECUTION_STRATEGIES.map((value) => ({ value, label: value }))

function reset() {
  form.providerId = props.profile?.providerId ?? ''
  form.credentialId = props.profile?.credentialId ?? ''
  form.name = props.profile?.name ?? ''
  form.description = props.profile?.description ?? ''
  form.baseUrl = props.profile?.baseUrl ?? ''
  form.loginUrl = props.profile?.loginUrl ?? ''
  form.searchUrl = props.profile?.searchUrl ?? ''
  form.promptTemplate = props.profile?.promptTemplate ?? defaultPrompt
  form.executionStrategy = props.profile?.executionStrategy ?? 'Hermes'
  form.parserKey = props.profile?.parserKey ?? ''
}

watch(() => props.profile?.id, reset, { immediate: true })

watch(
  () => form.providerId,
  (providerId, previousProviderId) => {
    if (!providerId || providerId === previousProviderId) return
    const provider = store.providers.find((item) => item.id === providerId)
    if (!props.profile && provider?.baseUrl && !form.baseUrl) form.baseUrl = provider.baseUrl
    if (!props.profile || providerId !== props.profile.providerId) form.credentialId = ''
  },
)

async function save() {
  if (saving.value) return

  if (!form.providerId) {
    toastStore.warning('Revise el perfil', 'Seleccione una naviera o provider.')
    return
  }
  if (!form.name.trim()) {
    toastStore.warning('Revise el perfil', 'El nombre es obligatorio.')
    return
  }
  if (!form.promptTemplate.trim()) {
    toastStore.warning('Revise el perfil', 'El prompt de Hermes es obligatorio.')
    return
  }

  try {
    saving.value = true

    if (props.profile) {
      const payload: UpdateAgentExtractionProfileRequest = {
        credentialId: form.credentialId || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        baseUrl: form.baseUrl.trim() || null,
        loginUrl: form.loginUrl.trim() || null,
        searchUrl: form.searchUrl.trim() || null,
        promptTemplate: form.promptTemplate.trim(),
        executionStrategy: form.executionStrategy,
        parserKey: form.parserKey.trim() || null,
      }

      await AgentService.profiles.update(props.profile.id, payload)
      toastStore.success('Perfil de extracción actualizado.')
      emit('saved', props.profile.id)
      return
    }

    const payload: CreateAgentExtractionProfileRequest = {
      providerId: form.providerId,
      credentialId: form.credentialId || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      baseUrl: form.baseUrl.trim() || null,
      loginUrl: form.loginUrl.trim() || null,
      searchUrl: form.searchUrl.trim() || null,
      promptTemplate: form.promptTemplate.trim(),
      executionStrategy: form.executionStrategy,
      parserKey: form.parserKey.trim() || null,
    }

    const id = await AgentService.profiles.create(payload)
    toastStore.success('Perfil de extracción creado.')
    emit('saved', id)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el perfil de extracción.')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const tasks: Promise<unknown>[] = []
    if (!store.providers.length) tasks.push(store.loadProviders())
    if (permissions.canViewCredentials.value && !store.credentials.length) tasks.push(store.loadCredentials())
    await Promise.all(tasks)
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los datos necesarios para el perfil.')
  }
})
</script>

<template>
  <form class="grid gap-6" @submit.prevent="save">
    <section class="grid gap-4 md:grid-cols-2">
      <DhSelect
        v-model="form.providerId"
        label="Naviera / provider"
        :options="providerOptions"
        :disabled="saving || Boolean(profile)"
      />
      <DhSelect
        v-model="form.credentialId"
        label="Credencial"
        :options="credentialOptions"
        placeholder=""
        :disabled="saving || !form.providerId"
      />
      <DhInput v-model="form.name" label="Nombre del perfil" :disabled="saving" />
      <DhSelect
        v-model="form.executionStrategy"
        label="Motor de ejecución"
        :options="strategyOptions"
        :disabled="saving"
      />
      <DhInput v-model="form.baseUrl" label="URL de la naviera" placeholder="https://..." :disabled="saving" />
      <DhInput v-model="form.loginUrl" label="URL de login" placeholder="https://..." :disabled="saving" />
      <DhInput v-model="form.searchUrl" label="URL / endpoint de búsqueda" placeholder="https://..." :disabled="saving" />
      <DhInput v-model="form.parserKey" label="Parser Key (opcional)" :disabled="saving" />
    </section>

    <DhTextarea
      v-model="form.description"
      label="Descripción"
      :rows="3"
      :disabled="saving"
    />

    <DhTextarea
      v-model="form.promptTemplate"
      label="Prompt de Hermes"
      :rows="16"
      :disabled="saving"
    />

    <div v-pre class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-sm text-[var(--dh-text-muted)]">
      Variables disponibles: <code>{{providerName}}</code>, <code>{{providerCode}}</code>,
      <code>{{baseUrl}}</code>, <code>{{loginUrl}}</code>, <code>{{searchUrl}}</code>,
      <code>{{routes}}</code>, <code>{{equipment}}</code>, <code>{{fields}}</code>,
      <code>{{captureRules}}</code>, <code>{{cargoReadyDate}}</code> y <code>{{executionId}}</code>.
    </div>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <DhButton label="Cancelar" variant="secondary" :disabled="saving" @click.prevent="emit('cancel')" />
      <DhButton
        type="submit"
        :label="profile ? 'Guardar cambios' : 'Crear perfil'"
        :loading="saving"
      />
    </div>
  </form>
</template>
