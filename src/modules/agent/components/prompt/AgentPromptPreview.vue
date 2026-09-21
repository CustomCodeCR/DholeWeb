<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eye } from 'lucide-vue-next'
import { DhButton, DhInput, DhTextarea } from '@/shared/components/atoms'
import type { AgentPromptPreviewDto } from '@/core/interfaces/agent'
import { AgentService } from '@/core/services/agentService'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  profileId: string
}>()

const toastStore = useToastStore()
const cargoReadyDate = ref('')
const executionId = ref('')
const loading = ref(false)
const preview = ref<AgentPromptPreviewDto | null>(null)

const hasPreview = computed(() => Boolean(preview.value?.prompt))

async function loadPreview() {
  if (loading.value) return

  try {
    loading.value = true
    preview.value = await AgentService.prompts.preview(props.profileId, {
      cargoReadyDate: cargoReadyDate.value || null,
      executionId: executionId.value.trim() || null,
    })
  } catch (error) {
    preview.value = null
    toastStore.backendError(error, 'No se pudo generar la vista previa del prompt.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <DhInput
        v-model="cargoReadyDate"
        type="date"
        label="Cargo Ready Date"
        :disabled="loading"
      />
      <DhInput
        v-model="executionId"
        label="Execution ID (opcional)"
        placeholder="UUID"
        :disabled="loading"
      />
    </div>

    <div class="flex justify-end">
      <DhButton
        label="Vista previa"
        :icon="Eye"
        :loading="loading"
        @click="loadPreview"
      />
    </div>

    <div
      v-if="preview?.availableVariables?.length"
      class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
    >
      <p class="mb-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">
        Variables disponibles según backend
      </p>
      <div class="flex flex-wrap gap-2">
        <code
          v-for="variable in preview.availableVariables"
          :key="variable"
          class="rounded-full bg-[var(--dh-shell)] px-3 py-1.5 text-xs font-bold text-[var(--dh-text)]"
        >
          {{ variable }}
        </code>
      </div>
    </div>

    <DhTextarea
      v-if="hasPreview"
      :model-value="preview?.prompt ?? ''"
      label="Prompt final generado por DholeAgentService"
      :rows="20"
      readonly
    />

    <p
      v-else
      class="rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-5 text-sm font-semibold text-[var(--dh-text-muted)]"
    >
      La vista previa se obtiene directamente del backend. El frontend no interpola variables ni construye el prompt por su cuenta.
    </p>
  </section>
</template>
