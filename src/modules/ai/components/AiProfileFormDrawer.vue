<script setup lang="ts">
import { computed, ref } from 'vue'
import { DhButton, DhCheckbox, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { AiService } from '@/core/services/aiService'
import type {
  AiModelSummaryDto,
  AiProfileDto,
  AiResponseFormat,
  AiRoutingMode,
  AiPromptTemplateSummaryDto,
} from '@/core/interfaces/ai'
import {
  responseFormatOptions,
  routingModeOptions,
} from '@/modules/ai/aiOptions'

interface ModelSelection {
  selected: boolean
  priority: string
  isFallback: boolean
}

const props = defineProps<{
  profile?: AiProfileDto
  models: AiModelSummaryDto[]
  promptTemplates: AiPromptTemplateSummaryDto[]
  onSaved?: () => Promise<void> | void
}>()

const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const loading = ref(false)

const form = ref({
  key: props.profile?.key ?? '',
  name: props.profile?.name ?? '',
  description: props.profile?.description ?? '',
  promptTemplateId: props.profile?.promptTemplateId ?? '',
  routingMode: (props.profile?.routingMode ?? 'PriorityFallback') as AiRoutingMode,
  responseFormat: (props.profile?.responseFormat ?? 'Text') as AiResponseFormat,
  temperature: String(props.profile?.temperature ?? 0.2),
  maximumOutputTokens: String(props.profile?.maximumOutputTokens ?? 2048),
  timeoutSeconds: String(props.profile?.timeoutSeconds ?? 120),
  jsonSchema: props.profile?.jsonSchema ?? '',
})

const modelSelections = ref<Record<string, ModelSelection>>(
  Object.fromEntries(
    props.models.map((model, index) => {
      const assigned = props.profile?.models.find((item) => item.modelId === model.id)
      return [
        model.id,
        {
          selected: Boolean(assigned),
          priority: String(assigned?.priority ?? index + 1),
          isFallback: assigned?.isFallback ?? false,
        },
      ]
    }),
  ),
)

const isEdit = computed(() => Boolean(props.profile))
const activeModels = computed(() => props.models.filter((model) => model.isActive))
const selectedModelCount = computed(() =>
  Object.values(modelSelections.value).filter((selection) => selection.selected).length,
)
const templateOptions = computed(() => [
  { label: 'Sin plantilla', value: '' },
  ...props.promptTemplates
    .filter((template) => template.isActive || template.id === props.profile?.promptTemplateId)
    .map((template) => ({ label: `${template.name} · ${template.key}`, value: template.id })),
])

function setModelSelected(modelId: string, selected: boolean) {
  const current = modelSelections.value[modelId]
  if (!current) return
  modelSelections.value[modelId] = { ...current, selected, isFallback: selected ? current.isFallback : false }
}

function setPriority(modelId: string, priority: string) {
  const current = modelSelections.value[modelId]
  if (!current) return
  modelSelections.value[modelId] = { ...current, priority }
}

function setFallback(modelId: string, value: boolean) {
  const current = modelSelections.value[modelId]
  if (!current) return
  modelSelections.value[modelId] = { ...current, isFallback: value, selected: value || current.selected }
}

function selectedModels() {
  return props.models
    .map((model) => ({ model, selection: modelSelections.value[model.id] }))
    .filter((item): item is { model: AiModelSummaryDto; selection: ModelSelection } => Boolean(item.selection?.selected))
    .map(({ model, selection }) => ({
      modelId: model.id,
      priority: Math.max(1, Number(selection.priority) || 1),
      isFallback: selection.isFallback,
    }))
    .sort((a, b) => a.priority - b.priority)
}

async function save() {
  if (!form.value.key.trim() || !form.value.name.trim()) {
    toastStore.warning('Datos incompletos', 'Key y nombre son obligatorios.')
    return
  }

  const models = selectedModels()
  if (!models.length) {
    toastStore.warning('Modelos requeridos', 'Asigne al menos un modelo al perfil.')
    return
  }

  const temperature = Number(form.value.temperature)
  const maximumOutputTokens = Number(form.value.maximumOutputTokens)
  const timeoutSeconds = Number(form.value.timeoutSeconds)

  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    toastStore.warning('Temperatura inválida', 'La temperatura debe estar entre 0 y 2.')
    return
  }

  if (!Number.isInteger(maximumOutputTokens) || maximumOutputTokens < 1) {
    toastStore.warning('Tokens inválidos', 'El máximo de tokens debe ser mayor que cero.')
    return
  }

  try {
    loading.value = true
    const common = {
      key: form.value.key.trim(),
      name: form.value.name.trim(),
      description: form.value.description.trim() || null,
      promptTemplateId: form.value.promptTemplateId || null,
      routingMode: form.value.routingMode,
      responseFormat: form.value.responseFormat,
      temperature,
      maximumOutputTokens,
      timeoutSeconds,
      jsonSchema: form.value.jsonSchema.trim() || null,
    }

    if (props.profile) {
      await AiService.updateProfile(props.profile.id, common)
      await AiService.configureProfileModels(props.profile.id, models)
    } else {
      await AiService.createProfile({ ...common, models })
    }

    toastStore.success('Perfil guardado', 'El enrutamiento ya puede utilizarse desde el Playground y las integraciones.')
    await props.onSaved?.()
    drawerStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el perfil de IA.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="save">
    <section class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="form.key" label="Key de integración" placeholder="pricing.rate-assistant" />
      <DhInput v-model="form.name" label="Nombre" placeholder="Asistente de Pricing" />
      <DhInput v-model="form.description" label="Descripción" placeholder="Uso del perfil" class="md:col-span-2" />
      <DhSelect v-model="form.promptTemplateId" label="Plantilla" :options="templateOptions" placeholder="" />
      <DhSelect v-model="form.routingMode" label="Enrutamiento" :options="routingModeOptions" />
      <DhSelect v-model="form.responseFormat" label="Formato de respuesta" :options="responseFormatOptions" />
      <DhInput v-model="form.temperature" type="number" label="Temperatura" placeholder="0.2" />
      <DhInput v-model="form.maximumOutputTokens" type="number" label="Máximo de tokens" placeholder="2048" />
      <DhInput v-model="form.timeoutSeconds" type="number" label="Timeout (segundos)" placeholder="120" />
    </section>

    <DhTextarea
      v-if="form.responseFormat === 'JsonSchema'"
      v-model="form.jsonSchema"
      label="JSON Schema"
      :rows="9"
      placeholder='{"type":"object","properties":{}}'
    />

    <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="font-black text-[var(--dh-text)]">Modelos del perfil</p>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            Ordene por prioridad y marque cuáles pueden utilizarse como fallback.
          </p>
        </div>
        <span class="rounded-full bg-[var(--dh-primary-soft)] px-3 py-1 text-xs font-black text-[var(--dh-primary)]">
          {{ selectedModelCount }} seleccionados
        </span>
      </div>

      <div class="mt-4 space-y-3">
        <article
          v-for="model in activeModels"
          :key="model.id"
          class="grid gap-3 rounded-[22px] border border-[var(--dh-border)] p-4 md:grid-cols-[1fr_130px_150px] md:items-center"
        >
          <DhCheckbox
            :model-value="modelSelections[model.id]?.selected ?? false"
            :label="model.name"
            :description="`${model.connectionName} · ${model.providerType} · ${model.externalModelId}`"
            @update:model-value="setModelSelected(model.id, $event)"
          />
          <DhInput
            :model-value="modelSelections[model.id]?.priority ?? '1'"
            type="number"
            label="Prioridad"
            :disabled="!(modelSelections[model.id]?.selected ?? false)"
            @update:model-value="setPriority(model.id, $event)"
          />
          <DhCheckbox
            :model-value="modelSelections[model.id]?.isFallback ?? false"
            label="Permitir fallback"
            :disabled="!(modelSelections[model.id]?.selected ?? false)"
            @update:model-value="setFallback(model.id, $event)"
          />
        </article>

        <p v-if="!activeModels.length" class="py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
          No hay modelos activos. Registre o active uno antes de crear el perfil.
        </p>
      </div>
    </section>

    <div class="flex justify-end gap-2">
      <DhButton label="Cancelar" variant="secondary" @click="drawerStore.close()" />
      <DhButton type="submit" :label="isEdit ? 'Guardar cambios' : 'Crear perfil'" :loading="loading" />
    </div>
  </form>
</template>
