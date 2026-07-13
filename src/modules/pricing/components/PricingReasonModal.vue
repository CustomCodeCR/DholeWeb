<script setup lang="ts">
import { reactive } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  target: 'import' | 'margin'
  id: string
  onSaved?: () => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({ reason: '', submitted: false, saving: false })

async function submit() {
  form.submitted = true
  if (!form.reason.trim()) return

  try {
    form.saving = true
    if (props.target === 'import')
      await PricingService.rejectImportRate(props.id, { reason: form.reason.trim() })
    else await PricingService.rejectRateMargin(props.id, { reason: form.reason.trim() })
    toastStore.success(props.target === 'import' ? 'Importación rechazada' : 'Margen rechazado')
    modalStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo completar el rechazo.')
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div
      class="flex items-start gap-3 rounded-[22px] bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200"
    >
      <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
      <p class="text-sm font-semibold">
        Indique un motivo claro. Esta información queda disponible para auditoría y seguimiento
        operativo.
      </p>
    </div>
    <DhTextarea
      v-model="form.reason"
      label="Motivo"
      :rows="4"
      placeholder="Explique por qué se rechaza..."
      :error="form.submitted && !form.reason.trim() ? 'El motivo es obligatorio.' : undefined"
    />
    <div class="flex justify-end gap-2">
      <DhButton
        label="Cancelar"
        variant="secondary"
        :disabled="form.saving"
        @click="modalStore.close()"
      />
      <DhButton label="Rechazar" variant="danger" type="submit" :loading="form.saving" />
    </div>
  </form>
</template>
