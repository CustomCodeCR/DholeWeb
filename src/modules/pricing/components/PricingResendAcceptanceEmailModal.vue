<script setup lang="ts">
import { ref } from 'vue'
import { MailCheck } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  rateId: string
  quoteNumber: string
}>()

const modal = useModalStore()
const toast = useToastStore()
const sending = ref(false)
// Se mantiene estable incluso si una respuesta de red se pierde: reintentar
// este mismo diálogo nunca genera otro evento de Outbox.
const requestId = crypto.randomUUID()

async function resend() {
  if (sending.value) return
  sending.value = true
  try {
    await PricingService.resendAcceptedRateEmail(props.rateId, requestId)
    toast.success(
      'Notificación en cola',
      'Se preparó el reenvío a Apertura con copia a Pricing y al ejecutivo. La entrega la realiza Notifications.',
    )
    modal.close()
  } catch (error) {
    toast.backendError(error, 'No se pudo preparar el reenvío. Puede reintentar sin duplicar esta operación.')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="resend">
    <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="flex items-start gap-3">
        <MailCheck class="mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" />
        <div>
          <p class="text-sm font-black text-[var(--dh-text)]">{{ quoteNumber }}</p>
          <p class="mt-2 text-sm font-semibold text-[var(--dh-text)]">
            ¿Reenviar la notificación de aceptación?
          </p>
          <p class="mt-2 text-xs leading-5 text-[var(--dh-text-muted)]">
            Se generará un nuevo correo para Apertura de Trámite con copia al equipo de Pricing
            y al ejecutivo asignado. Incluirá el PDF y los respaldos disponibles.
          </p>
          <p class="mt-2 text-xs leading-5 text-[var(--dh-text-muted)]">
            Es un reenvío manual: si el correo anterior ya se entregó, los destinatarios recibirán otro.
            No modifica la aceptación, el IDTRA ni la revisión de la QUO.
          </p>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap justify-end gap-2">
      <DhButton type="button" label="Cancelar" variant="secondary" :disabled="sending" @click="modal.close()" />
      <DhButton type="submit" label="Confirmar reenvío" :loading="sending" :disabled="sending" />
    </div>
  </form>
</template>
