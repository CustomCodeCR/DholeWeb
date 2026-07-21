<script setup lang="ts">
import { computed, ref } from 'vue'
import { DhButton, DhCheckbox, DhInput, DhSelect, DhSwitch } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { AiService } from '@/core/services/aiService'
import type {
  AiConnectionSummaryDto,
  AiModelCapability,
  AiModelDto,
  DiscoveredAiModelDto,
} from '@/core/interfaces/ai'
import { capabilityOptions } from '@/modules/ai/aiOptions'

const props = defineProps<{
  model?: AiModelDto
  discovered?: DiscoveredAiModelDto
  defaultConnectionId?: string
  connections: AiConnectionSummaryDto[]
  onSaved?: () => Promise<void> | void
}>()

const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const loading = ref(false)

const seedCapabilities = props.model?.capabilities ?? props.discovered?.capabilities ?? ['Chat']
const form = ref({
  connectionId: props.model?.connectionId ?? props.defaultConnectionId ?? '',
  externalModelId: props.model?.externalModelId ?? props.discovered?.externalModelId ?? '',
  name: props.model?.name ?? props.discovered?.name ?? '',
  capabilities: [...seedCapabilities] as AiModelCapability[],
  contextWindow: String(props.model?.contextWindow ?? props.discovered?.contextWindow ?? ''),
  maximumOutputTokens: String(
    props.model?.maximumOutputTokens ?? props.discovered?.maximumOutputTokens ?? '',
  ),
  inputCostPerMillionTokens: String(props.model?.inputCostPerMillionTokens ?? ''),
  outputCostPerMillionTokens: String(props.model?.outputCostPerMillionTokens ?? ''),
  isLocal: props.model?.isLocal ?? props.discovered?.isLocal ?? false,
})

const isEdit = computed(() => Boolean(props.model))
const connectionOptions = computed(() =>
  props.connections.map((connection) => ({ label: `${connection.name} · ${connection.providerType}`, value: connection.id })),
)

function toggleCapability(capability: AiModelCapability, enabled: boolean) {
  const values = new Set(form.value.capabilities)
  if (enabled) values.add(capability)
  else values.delete(capability)
  form.value.capabilities = [...values]
}

function optionalNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function save() {
  if (!form.value.connectionId || !form.value.externalModelId.trim() || !form.value.name.trim()) {
    toastStore.warning('Datos incompletos', 'Conexión, identificador externo y nombre son obligatorios.')
    return
  }

  if (!form.value.capabilities.length) {
    toastStore.warning('Capacidades requeridas', 'Seleccione al menos una capacidad del modelo.')
    return
  }

  try {
    loading.value = true
    const payload = {
      connectionId: form.value.connectionId,
      externalModelId: form.value.externalModelId.trim(),
      name: form.value.name.trim(),
      capabilities: form.value.capabilities,
      contextWindow: optionalNumber(form.value.contextWindow),
      maximumOutputTokens: optionalNumber(form.value.maximumOutputTokens),
      inputCostPerMillionTokens: optionalNumber(form.value.inputCostPerMillionTokens),
      outputCostPerMillionTokens: optionalNumber(form.value.outputCostPerMillionTokens),
      isLocal: form.value.isLocal,
    }

    if (props.model) await AiService.updateModel(props.model.id, payload)
    else await AiService.createModel(payload)

    toastStore.success('Modelo guardado', 'El modelo ya está disponible para asignarlo a perfiles.')
    await props.onSaved?.()
    drawerStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el modelo de IA.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="grid gap-4 md:grid-cols-2">
      <DhSelect
        v-model="form.connectionId"
        label="Conexión"
        :options="connectionOptions"
        placeholder="Seleccione una conexión"
      />
      <DhInput v-model="form.externalModelId" label="ID externo" placeholder="gpt-4.1-mini / llama3.2" />
      <DhInput v-model="form.name" label="Nombre visible" placeholder="Llama 3.2 local" class="md:col-span-2" />
      <DhInput v-model="form.contextWindow" type="number" label="Ventana de contexto" placeholder="128000" />
      <DhInput v-model="form.maximumOutputTokens" type="number" label="Máximo de salida" placeholder="8192" />
      <DhInput v-model="form.inputCostPerMillionTokens" type="number" label="Costo entrada / 1M" placeholder="0.15" />
      <DhInput v-model="form.outputCostPerMillionTokens" type="number" label="Costo salida / 1M" placeholder="0.60" />
    </div>

    <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Capacidades</p>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <DhCheckbox
          v-for="option in capabilityOptions"
          :key="option.value"
          :model-value="form.capabilities.includes(option.value)"
          :label="option.label"
          @update:model-value="toggleCapability(option.value, $event)"
        />
      </div>
    </section>

    <DhSwitch
      v-model="form.isLocal"
      label="Modelo local"
      description="Prioriza este modelo en perfiles configurados con LocalFirst."
    />

    <div class="flex justify-end gap-2">
      <DhButton label="Cancelar" variant="secondary" @click="drawerStore.close()" />
      <DhButton type="submit" :label="isEdit ? 'Guardar cambios' : 'Registrar modelo'" :loading="loading" />
    </div>
  </form>
</template>
