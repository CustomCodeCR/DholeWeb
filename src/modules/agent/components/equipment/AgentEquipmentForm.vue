<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DhButton, DhCheckbox, DhInput } from '@/shared/components/atoms'
import type {
  AgentExtractionEquipmentDto,
  SaveAgentExtractionEquipmentRequest,
} from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  profileId: string
  equipment?: AgentExtractionEquipmentDto | null
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const { t } = useI18n()
const toastStore = useToastStore()
const saving = ref(false)

const state = reactive({
  code: '',
  name: '',
  quantity: '1',
  defaultWeightKg: '0',
  isActive: true,
  sortOrder: '0',
})

function reset() {
  state.code = props.equipment?.code ?? ''
  state.name = props.equipment?.name ?? ''
  state.quantity = String(props.equipment?.quantity ?? 1)
  state.defaultWeightKg = String(props.equipment?.defaultWeightKg ?? 0)
  state.isActive = props.equipment?.isActive ?? true
  state.sortOrder = String(props.equipment?.sortOrder ?? 0)
}

async function save() {
  if (saving.value) return

  if (!state.code.trim()) {
    toastStore.warning(t('agent.review.equipment'), t('agent.validation.required', { field: 'Code' }))
    return
  }

  if (!state.name.trim()) {
    toastStore.warning(t('agent.review.equipment'), t('agent.validation.required', { field: 'Name' }))
    return
  }

  const quantity = Number(state.quantity)
  const defaultWeightKg = Number(state.defaultWeightKg)
  const sortOrder = Number(state.sortOrder)

  if (!Number.isInteger(quantity) || quantity <= 0) {
    toastStore.warning(t('agent.review.equipment'), t('agent.validation.positive', { field: 'Quantity' }))
    return
  }

  if (!Number.isFinite(defaultWeightKg) || defaultWeightKg < 0) {
    toastStore.warning(
      t('agent.review.equipment'),
      t('agent.validation.nonNegativeInteger', { field: 'DefaultWeightKg' }),
    )
    return
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    toastStore.warning(
      t('agent.review.equipment'),
      t('agent.validation.nonNegativeInteger', { field: 'SortOrder' }),
    )
    return
  }

  const payload: SaveAgentExtractionEquipmentRequest = {
    code: state.code.trim(),
    name: state.name.trim(),
    quantity,
    defaultWeightKg,
    isActive: state.isActive,
    sortOrder,
  }

  try {
    saving.value = true

    if (props.equipment) {
      await AgentService.equipment.update(props.profileId, props.equipment.id, payload)
    } else {
      await AgentService.equipment.create(props.profileId, payload)
    }

    toastStore.success(props.equipment ? 'Equipo actualizado.' : 'Equipo agregado.')
    emit('saved')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el equipo.')
  } finally {
    saving.value = false
  }
}

watch(() => props.equipment?.id, reset, { immediate: true })
</script>

<template>
  <form class="grid gap-5" @submit.prevent="save">
    <div class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="state.code" label="Code" :disabled="saving" />
      <DhInput v-model="state.name" label="Nombre" :disabled="saving" />
      <DhInput v-model="state.quantity" label="Cantidad" type="number" :disabled="saving" />
      <DhInput
        v-model="state.defaultWeightKg"
        label="Peso por defecto (kg)"
        type="number"
        :disabled="saving"
      />
      <DhInput v-model="state.sortOrder" label="Orden" type="number" :disabled="saving" />

      <div class="flex items-end pb-2">
        <DhCheckbox v-model="state.isActive" label="Activo" :disabled="saving" />
      </div>
    </div>

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <DhButton
        label="Cancelar"
        variant="secondary"
        :disabled="saving"
        @click.prevent="emit('cancel')"
      />
      <DhButton
        type="submit"
        :label="equipment ? 'Guardar cambios' : 'Agregar equipo'"
        :loading="saving"
      />
    </div>
  </form>
</template>
