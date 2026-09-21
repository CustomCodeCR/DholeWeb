<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhCheckbox, DhInput } from '@/shared/components/atoms'
import type { AgentExtractionRouteDto, SaveAgentExtractionRouteRequest } from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  profileId: string
  route?: AgentExtractionRouteDto | null
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const { t } = useI18n()
const toastStore = useToastStore()
const saving = ref(false)

const form = reactive({
  name: '',
  polCode: '',
  polName: '',
  poeCode: '',
  poeName: '',
  podCode: '',
  podName: '',
  isActive: true,
  sortOrder: '0',
})

function reset() {
  form.name = props.route?.name ?? ''
  form.polCode = props.route?.polCode ?? ''
  form.polName = props.route?.polName ?? ''
  form.poeCode = props.route?.poeCode ?? ''
  form.poeName = props.route?.poeName ?? ''
  form.podCode = props.route?.podCode ?? ''
  form.podName = props.route?.podName ?? ''
  form.isActive = props.route?.isActive ?? true
  form.sortOrder = String(props.route?.sortOrder ?? 0)
}

async function save() {
  if (saving.value) return

  if (!form.polName.trim()) {
    toastStore.warning(t('agent.review.route'), t('agent.validation.required', { field: 'POL Name' }))
    return
  }
  if (!form.podName.trim()) {
    toastStore.warning(t('agent.review.route'), t('agent.validation.required', { field: 'POD Name' }))
    return
  }

  const sortOrder = Number(form.sortOrder)
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    toastStore.warning(t('agent.review.route'), 'SortOrder debe ser un entero mayor o igual a 0.')
    return
  }

  const payload: SaveAgentExtractionRouteRequest = {
    name: form.name.trim() || null,
    polCode: form.polCode.trim() || null,
    polName: form.polName.trim(),
    poeCode: form.poeCode.trim() || null,
    poeName: form.poeName.trim() || null,
    podCode: form.podCode.trim() || null,
    podName: form.podName.trim(),
    isActive: form.isActive,
    sortOrder,
  }

  try {
    saving.value = true
    if (props.route) {
      await AgentService.routes.update(props.profileId, props.route.id, payload)
    } else {
      await AgentService.routes.create(props.profileId, payload)
    }
    toastStore.success(props.route ? 'Ruta actualizada.' : 'Ruta creada.')
    emit('saved')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la ruta.')
  } finally {
    saving.value = false
  }
}

watch(() => props.route?.id, reset, { immediate: true })
</script>

<template>
  <form class="grid gap-5" @submit.prevent="save">
    <DhInput v-model="form.name" label="Nombre opcional" :disabled="saving" />

    <div class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="form.polCode" label="POL Code" :disabled="saving" />
      <DhInput v-model="form.polName" label="POL Name" :disabled="saving" />
      <DhInput v-model="form.poeCode" label="POE Code" :disabled="saving" />
      <DhInput v-model="form.poeName" label="POE Name" :disabled="saving" />
      <DhInput v-model="form.podCode" label="POD Code" :disabled="saving" />
      <DhInput v-model="form.podName" label="POD Name" :disabled="saving" />
      <DhInput v-model="form.sortOrder" label="Orden" type="number" :disabled="saving" />
      <div class="flex items-end pb-2">
        <DhCheckbox v-model="form.isActive" label="Activo" :disabled="saving" />
      </div>
    </div>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <DhButton label="Cancelar" variant="secondary" :disabled="saving" @click.prevent="emit('cancel')" />
      <DhButton type="submit" :label="route ? 'Guardar cambios' : 'Agregar ruta'" :loading="saving" />
    </div>
  </form>
</template>
