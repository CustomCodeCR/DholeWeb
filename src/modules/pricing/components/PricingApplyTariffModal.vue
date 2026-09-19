<script setup lang="ts">
import { reactive } from 'vue'
import { FilePlus2, UserRoundPlus } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import type { RateDto } from '@/core/interfaces/pricing'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  rate: RateDto
  onApplied?: (rateId: string) => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()

const form = reactive({
  clientName: props.rate.clientName?.trim() ?? '',
  executiveName: props.rate.executiveName?.trim() ?? '',
  submitted: false,
  saving: false,
})

async function submit() {
  form.submitted = true
  const clientName = form.clientName.trim()
  if (!clientName) return

  if (props.rate.rateType !== 'Tariff' || props.rate.sourceTariffRateId) {
    toastStore.warning(
      'Acción no disponible',
      'Aplicar a cliente solo está disponible para tarifarios maestros.',
    )
    return
  }

  try {
    form.saving = true
    const appliedRateId = await PricingService.duplicateRate(props.rate.id, {
      validFrom: props.rate.validFrom.slice(0, 10),
      validTo: props.rate.validTo.slice(0, 10),
      applyTariff: true,
      clientName,
      executiveName: form.executiveName.trim() || null,
      idtraNumber: null,
    })

    const appliedRate = await PricingService.getRate(appliedRateId)
    toastStore.success(
      'QUO creada para el cliente',
      `${appliedRate.quoNumber || appliedRate.rateCode} quedó abierta para ${clientName}. El tarifario ${props.rate.quoNumber || props.rate.rateCode} permanece disponible.`,
    )

    modalStore.close()
    await props.onApplied?.(appliedRateId)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aplicar el tarifario al cliente.')
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <section class="rounded-[24px] border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.06)] p-4">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
          <UserRoundPlus class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-black text-[var(--dh-text)]">Aplicar tarifario a un cliente</p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            Se creará una nueva QUO abierta copiando exactamente esta revisión: flete, cargos, recargos, vigencia y condiciones. El tarifario maestro no cambia y podrá volver a utilizarse.
          </p>
        </div>
      </div>
    </section>

    <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="mb-4 flex items-center gap-2 text-xs font-black text-[var(--dh-primary)]">
        <FilePlus2 class="h-4 w-4" />
        {{ rate.quoNumber || rate.rateCode }} · TARIFARIO MAESTRO
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <DhInput
          v-model="form.clientName"
          label="Cliente"
          placeholder="Nombre del cliente"
          autocomplete="off"
          :error="form.submitted && !form.clientName.trim() ? 'El cliente es obligatorio.' : undefined"
        />
        <DhInput
          v-model="form.executiveName"
          label="Ejecutivo comercial"
          placeholder="Ejecutivo"
          autocomplete="off"
        />
      </div>

      <p class="mt-3 text-[11px] font-semibold leading-5 text-[var(--dh-text-muted)]">
        La nueva QUO quedará en estado Abierta. Después podrá marcarse Enviada y, únicamente sobre esa QUO del cliente, registrar Aceptada o Rechazada.
      </p>
    </section>

    <div class="flex justify-end gap-2">
      <DhButton
        type="button"
        label="Cancelar"
        variant="secondary"
        :disabled="form.saving"
        @click="modalStore.close()"
      />
      <DhButton
        type="submit"
        label="Crear QUO para cliente"
        :icon="UserRoundPlus"
        :loading="form.saving"
      />
    </div>
  </form>
</template>
