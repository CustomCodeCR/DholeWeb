<script setup lang="ts">
import { computed, ref } from 'vue'
import { DhButton, DhInput, DhSelect } from '@/shared/components/atoms'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { AiService } from '@/core/services/aiService'
import type { AiConnectionDto, AiProviderType } from '@/core/interfaces/ai'
import { providerOptions } from '@/modules/ai/aiOptions'

const props = defineProps<{
  connection?: AiConnectionDto
  onSaved?: () => Promise<void> | void
}>()

const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const loading = ref(false)

const form = ref({
  name: props.connection?.name ?? '',
  providerType: (props.connection?.providerType ?? 'Ollama') as AiProviderType,
  baseUrl: props.connection?.baseUrl ?? 'http://localhost:11434',
  secretReference: props.connection?.secretReference ?? '',
  timeoutSeconds: String(props.connection?.timeoutSeconds ?? 120),
})

const isEdit = computed(() => Boolean(props.connection))

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, '')
}

async function save() {
  if (!form.value.name.trim() || !form.value.baseUrl.trim()) {
    toastStore.warning('Datos incompletos', 'Nombre y URL base son obligatorios.')
    return
  }

  const timeoutSeconds = Number(form.value.timeoutSeconds)
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 600) {
    toastStore.warning('Timeout inválido', 'Debe estar entre 1 y 600 segundos.')
    return
  }

  try {
    loading.value = true
    const payload = {
      name: form.value.name.trim(),
      providerType: form.value.providerType,
      baseUrl: normalizeBaseUrl(form.value.baseUrl),
      secretReference: form.value.secretReference.trim() || null,
      timeoutSeconds,
    }

    if (props.connection) {
      await AiService.updateConnection(props.connection.id, payload)
    } else {
      await AiService.createConnection(payload)
    }

    toastStore.success('Conexión guardada', 'La configuración del proveedor quedó actualizada.')
    await props.onSaved?.()
    drawerStore.close()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar la conexión de IA.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="save">
    <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <p class="text-sm font-black text-[var(--dh-text)]">Configuración del proveedor</p>
      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
        La referencia secreta debe apuntar a la clave configurada en el entorno del servicio. No escriba la API key directamente.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <DhInput v-model="form.name" label="Nombre" placeholder="Ollama desarrollo" />
      <DhSelect v-model="form.providerType" label="Proveedor" :options="providerOptions" />
      <DhInput v-model="form.baseUrl" label="URL base" placeholder="http://localhost:11434" class="md:col-span-2" />
      <DhInput
        v-model="form.secretReference"
        label="Referencia del secreto"
        placeholder="AI__Connections__OpenAI__ApiKey"
        class="md:col-span-2"
      />
      <DhInput v-model="form.timeoutSeconds" type="number" label="Timeout (segundos)" />
    </div>

    <div class="flex justify-end gap-2">
      <DhButton label="Cancelar" variant="secondary" @click="drawerStore.close()" />
      <DhButton type="submit" :label="isEdit ? 'Guardar cambios' : 'Crear conexión'" :loading="loading" />
    </div>
  </form>
</template>
