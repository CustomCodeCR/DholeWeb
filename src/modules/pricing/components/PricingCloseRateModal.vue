<script setup lang="ts">
import { reactive } from 'vue'
import { Archive, AlertTriangle } from 'lucide-vue-next'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  rateId: string
  onSaved?: () => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({ reason: '', submitted: false, saving: false })

async function submit() {
  form.submitted = true
  const reason = form.reason.trim()
  if (!reason || reason.length > 1000) return

  try {
    form.saving = true
    await PricingService.setRateStatus(props.rateId, { status: 'Closed', reason })
    toastStore.success('Tarifa cerrada', 'El motivo del cierre quedó registrado.')
    modalStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cerrar la tarifa.')
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
        Cerrar la tarifa finaliza su flujo sin marcarla como aceptada ni rechazada por el cliente.
        El motivo quedará disponible para seguimiento y auditoría.
      </p>
    </div>

    <DhTextarea
      v-model="form.reason"
      label="Motivo del cierre"
      :rows="4"
      placeholder="Explique por qué se cerró la tarifa..."
      :error="
        form.submitted && !form.reason.trim()
          ? 'El motivo es obligatorio.'
          : form.reason.trim().length > 1000
            ? 'El motivo no puede superar los 1000 caracteres.'
            : undefined
      "
    />

    <div class="flex justify-end gap-2">
      <DhButton
        label="Cancelar"
        variant="secondary"
        :disabled="form.saving"
        @click="modalStore.close()"
      />
      <DhButton
        label="Cerrar tarifa"
        :icon="Archive"
        variant="danger"
        type="submit"
        :loading="form.saving"
      />
    </div>
  </form>
</template>
