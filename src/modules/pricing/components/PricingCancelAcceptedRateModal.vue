<script setup lang="ts">
import { computed, reactive } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  rateId: string
  rateCode?: string | null
  onSaved?: () => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({
  decision: 'Cancelled' as 'Cancelled' | 'RejectedByClient',
  reason: '',
  submitted: false,
  saving: false,
})

const reason = computed(() => form.reason.trim())
const reasonError = computed(() => {
  if (form.submitted && !reason.value) return 'El motivo de cancelación es obligatorio.'
  if (reason.value.length > 1000) return 'El motivo no puede superar los 1000 caracteres.'
  return undefined
})

async function submit() {
  if (form.saving) return
  form.submitted = true
  if (!reason.value || reason.value.length > 1000) return

  try {
    form.saving = true
    await PricingService.setRateStatus(props.rateId, {
      status: form.decision,
      reason: reason.value,
    })
    toastStore.success(
      form.decision === 'Cancelled' ? 'Cotización cancelada' : 'Cotización rechazada',
      'El motivo quedó guardado en el historial comercial.',
    )
    modalStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo registrar la cancelación. Verifique el estado de la cotización.')
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div class="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
      <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
      <div>
        <p class="text-sm font-bold text-[var(--dh-text)]">
          {{ rateCode || 'Cotización aceptada' }}
        </p>
        <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
          Indique por qué se cancela una cotización que ya estaba aceptada.
          Se conservarán el número QUO, el IDTRA y el historial de revisiones.
        </p>
      </div>
    </div>

    <div class="space-y-2">
      <p class="text-sm font-bold text-[var(--dh-text)]">Resultado de la cotización</p>
      <div class="flex flex-wrap gap-2">
        <DhButton
          type="button"
          size="sm"
          :variant="form.decision === 'Cancelled' ? 'danger' : 'secondary'"
          :disabled="form.saving"
          @click="form.decision = 'Cancelled'"
        >Cancelada</DhButton>
        <DhButton
          type="button"
          size="sm"
          :variant="form.decision === 'RejectedByClient' ? 'danger' : 'secondary'"
          :disabled="form.saving"
          @click="form.decision = 'RejectedByClient'"
        >Rechazada por el cliente</DhButton>
      </div>
    </div>

    <DhTextarea
      v-model="form.reason"
      label="Motivo de cancelación (obligatorio)"
      :rows="5"
      placeholder="Ej.: El cliente canceló el embarque después de aceptar la cotización."
      :error="reasonError"
    />
    <p class="text-right text-xs font-semibold text-[var(--dh-text-muted)]">
      {{ reason.length }} / 1000 caracteres
    </p>

    <div class="flex flex-wrap justify-end gap-2">
      <DhButton
        type="button"
        label="Volver"
        variant="secondary"
        :disabled="form.saving"
        @click="modalStore.close()"
      />
      <DhButton
        type="submit"
        :label="form.decision === 'Cancelled' ? 'Confirmar cancelación' : 'Confirmar rechazo'"
        variant="danger"
        :loading="form.saving"
        :disabled="form.saving || !reason || reason.length > 1000"
      />
    </div>
  </form>
</template>
