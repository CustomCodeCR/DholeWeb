<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms'
import {
  AGENT_EXTRACTION_DATA_TYPES,
  AGENT_EXTRACTION_SOURCE_TYPES,
  type AgentExtractionDataType,
  type AgentExtractionFieldDto,
  type AgentExtractionSourceType,
  type SaveAgentExtractionFieldRequest,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  profileId: string
  field?: AgentExtractionFieldDto | null
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const { t } = useI18n()
const toastStore = useToastStore()
const saving = ref(false)

const dataTypeOptions = AGENT_EXTRACTION_DATA_TYPES.map((value) => ({ label: value, value }))
const sourceTypeOptions = AGENT_EXTRACTION_SOURCE_TYPES.map((value) => ({ label: value, value }))

const form = reactive({
  key: '',
  label: '',
  description: '',
  dataType: 'String' as AgentExtractionDataType,
  sourceType: 'Auto' as AgentExtractionSourceType,
  jsonPath: '',
  required: false,
  isActive: true,
  sortOrder: '0',
})

const needsJsonPath = computed(() => form.sourceType === 'JsonPath')

function reset() {
  form.key = props.field?.key ?? ''
  form.label = props.field?.label ?? ''
  form.description = props.field?.description ?? ''
  form.dataType = props.field?.dataType ?? 'String'
  form.sourceType = props.field?.sourceType ?? 'Auto'
  form.jsonPath = props.field?.jsonPath ?? ''
  form.required = props.field?.required ?? false
  form.isActive = props.field?.isActive ?? true
  form.sortOrder = String(props.field?.sortOrder ?? 0)
}

async function save() {
  if (saving.value) return

  if (!form.key.trim()) {
    toastStore.warning(t('agent.review.field'), t('agent.validation.required', { field: 'Key' }))
    return
  }

  if (!form.label.trim()) {
    toastStore.warning(t('agent.review.field'), t('agent.validation.required', { field: 'Label' }))
    return
  }

  if (needsJsonPath.value && !form.jsonPath.trim()) {
    toastStore.warning(t('agent.review.field'), t('agent.validation.required', { field: 'JsonPath' }))
    return
  }

  const sortOrder = Number(form.sortOrder)
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    toastStore.warning(
      t('agent.review.field'),
      t('agent.validation.nonNegativeInteger', { field: 'SortOrder' }),
    )
    return
  }

  const payload: SaveAgentExtractionFieldRequest = {
    key: form.key.trim(),
    label: form.label.trim(),
    description: form.description.trim() || null,
    dataType: form.dataType,
    sourceType: form.sourceType,
    jsonPath: form.jsonPath.trim() || null,
    required: form.required,
    sortOrder,
    isActive: form.isActive,
  }

  try {
    saving.value = true

    if (props.field) {
      await AgentService.fields.update(props.profileId, props.field.id, payload)
    } else {
      await AgentService.fields.create(props.profileId, payload)
    }

    toastStore.success(props.field ? 'Campo actualizado.' : 'Campo agregado.')
    emit('saved')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el campo de extracción.')
  } finally {
    saving.value = false
  }
}

watch(() => props.field?.id, reset, { immediate: true })
</script>

<template>
  <form class="grid gap-5" @submit.prevent="save">
    <div class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="form.key" label="Key" placeholder="etd" :disabled="saving" />
      <DhInput v-model="form.label" label="Nombre" placeholder="ETD" :disabled="saving" />
      <DhInput
        v-model="form.description"
        label="Descripción"
        placeholder="Fecha estimada de salida"
        :disabled="saving"
      />
      <DhSelect
        v-model="form.dataType"
        label="Tipo de dato"
        :options="dataTypeOptions"
        :disabled="saving"
      />
      <DhSelect
        v-model="form.sourceType"
        label="Origen"
        :options="sourceTypeOptions"
        :disabled="saving"
      />
      <DhInput
        v-model="form.jsonPath"
        label="JsonPath"
        placeholder="$.offers[*].departureDate"
        :disabled="saving"
      />
      <DhInput v-model="form.sortOrder" label="Orden" type="number" :disabled="saving" />
    </div>

    <div class="grid gap-3 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:grid-cols-2">
      <DhCheckbox v-model="form.required" label="Obligatorio" :disabled="saving" />
      <DhCheckbox v-model="form.isActive" label="Activo" :disabled="saving" />
    </div>

    <p
      v-if="needsJsonPath"
      class="rounded-[18px] bg-[var(--dh-card)] px-4 py-3 text-sm font-semibold text-[var(--dh-text-muted)]"
    >
      Para origen JsonPath debe indicar la ruta JSON que el backend utilizará para leer este dato.
    </p>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <DhButton label="Cancelar" variant="secondary" :disabled="saving" @click.prevent="emit('cancel')" />
      <DhButton
        type="submit"
        :label="field ? 'Guardar cambios' : 'Agregar campo'"
        :loading="saving"
      />
    </div>
  </form>
</template>
