<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MailCheck, AlertCircle } from 'lucide-vue-next'
import { DhButton, DhSelect } from '@/shared/components/atoms'
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
const notificationType = ref('opening')
// El UUID permanece estable por selección mientras se reintenta la misma operación.
const requestId = ref(crypto.randomUUID())
const errorMessage = ref('')

const options = [
  { value: 'opening', label: 'Aceptación / Apertura de trámite (PDF y respaldos)' },
  { value: 'quote', label: 'Cotización enviada (destinatarios configurados)' },
  { value: 'notice', label: 'Aviso de aceptación SIN PDF (emergencia)' },
]

const explanation = computed(() => {
  switch (notificationType.value) {
    case 'opening':
      return 'Envía a Apertura de Trámite, con copia a Pricing y al vendedor asignado. Requiere generar PDF y adjunta los respaldos disponibles.'
    case 'quote':
      return 'Reenvía la cotización comercial al vendedor o a los contactos del cliente, según las preferencias vigentes de la cuenta CRM. Puede llegar al cliente.'
    case 'notice':
      return 'Envía a Apertura un aviso explícitamente marcado SIN PDF, con copia a Pricing y al vendedor. Solo para avisar la aceptación mientras se resuelve un fallo de Reports. No sustituye el PDF obligatorio para apertura.'
  }
})

watch(notificationType, () => {
  requestId.value = crypto.randomUUID()
  errorMessage.value = ''
})

async function resend() {
  if (sending.value) return
  sending.value = true
  errorMessage.value = ''
  try {
    await PricingService.resendAcceptedRateEmail(props.rateId, requestId.value, notificationType.value)
    toast.success(
      'Notificación encolada',
      notificationType.value === 'notice'
        ? 'Aviso SIN PDF preparado en Outbox. La apertura requiere completar el expediente.'
        : 'El correo seleccionado quedó preparado en Outbox. Notifications gestionará su entrega.',
    )
    modal.close()
  } catch (error) {
    errorMessage.value = 'No se confirmó el envío a Outbox. Consulte el detalle del error y reintente con la misma selección, o elija un aviso sin PDF si falló Reports.'
    toast.backendError(error, 'No se pudo preparar la notificación seleccionada.')
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
        <div class="min-w-0 space-y-1">
          <p class="text-sm font-black text-[var(--dh-text)]">{{ quoteNumber }}</p>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            Seleccione la notificación que desea reenviar.
          </p>
        </div>
      </div>

      <DhSelect
        v-model="notificationType"
        class="mt-4"
        label="Tipo de notificación"
        placeholder=""
        :options="options"
        :disabled="sending"
      />

      <p class="mt-3 text-xs leading-5 text-[var(--dh-text-muted)]">{{ explanation }}</p>
      <p v-if="notificationType === 'notice'" class="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-700 dark:text-amber-300">
        Aviso preliminar: no contiene PDF ni respaldos y no reemplaza el correo de apertura completo.
      </p>
      <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
        Un reenvío manual puede hacer que un correo ya entregado llegue nuevamente.
        No modifica el estado, IDTRA ni la revisión de la QUO.
      </p>
    </div>

    <div v-if="errorMessage" class="flex items-start gap-2 rounded-xl border border-red-500/30 p-3 text-xs font-semibold text-red-600 dark:text-red-300" role="alert">
      <AlertCircle class="h-4 w-4 shrink-0" />
      <p>{{ errorMessage }}</p>
    </div>

    <div class="flex flex-wrap justify-end gap-2">
      <DhButton type="button" label="Cancelar" variant="secondary" :disabled="sending" @click="modal.close()" />
      <DhButton type="submit" label="Confirmar reenvío" :loading="sending" :disabled="sending" />
    </div>
  </form>
</template>
