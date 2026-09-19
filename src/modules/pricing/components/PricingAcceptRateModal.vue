<script setup lang="ts">
import { reactive } from 'vue'
import { CircleCheck, FileCheck2 } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import type { RateDto } from '@/core/interfaces/pricing'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  rate: RateDto
  onSaved?: () => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({
  idtraNumber: props.rate.idtraNumber?.trim() ?? '',
  submitted: false,
  saving: false,
})

async function submit() {
  form.submitted = true
  const idtraNumber = form.idtraNumber.trim()
  if (!idtraNumber) return

  try {
    form.saving = true
    if (props.rate.rateType === 'Tariff' && !props.rate.sourceTariffRateId) {
      const appliedRateId = await PricingService.duplicateRate(props.rate.id, {
        validFrom: props.rate.validFrom.slice(0, 10),
        validTo: props.rate.validTo.slice(0, 10),
        applyTariff: true,
        clientName: props.rate.clientName ?? null,
        executiveName: props.rate.executiveName ?? null,
        idtraNumber,
      })
      const appliedRate = await PricingService.getRate(appliedRateId)
      toastStore.success(
        'Tarifario aplicado al cliente',
        `Se creó ${appliedRate.quoNumber || appliedRate.rateCode} conservando exactamente el tarifario ${props.rate.quoNumber || props.rate.rateCode}.`,
      )
    } else {
      await PricingService.setRateStatus(props.rate.id, {
        status: 'AcceptedByClient',
        idtraNumber,
      })
      toastStore.success('Tarifa aceptada por el cliente', `IDTRA ${idtraNumber} registrado.`)
    }
    modalStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aceptar la tarifa.')
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div class="rounded-[24px] border border-emerald-500/25 bg-emerald-500/10 p-4">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
          <CircleCheck class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-black text-[var(--dh-text)]">{{ rate.rateType === 'Tariff' && !rate.sourceTariffRateId ? 'Aplicar tarifario al cliente' : 'Confirmar aceptación del cliente' }}</p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            <template v-if="rate.rateType === 'Tariff' && !rate.sourceTariffRateId">
              Se generará una nueva QUO exclusiva para este cliente. Se copiarán exactamente el flete, cargos, recargos, vigencia y demás condiciones de esta revisión del tarifario; el tarifario maestro permanecerá disponible.
            </template>
            <template v-else>
              La tarifa pasará a Aceptadas. El IDTRA queda ligado permanentemente a esta tarifa para seguimiento operativo.
            </template>
          </p>
        </div>
      </div>
    </div>

    <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="mb-4 flex items-center gap-2 text-xs font-black text-[var(--dh-primary)]">
        <FileCheck2 class="h-4 w-4" />
        {{ rate.quoNumber || rate.rateCode }}
      </div>
      <DhInput
        v-model="form.idtraNumber"
        label="IDTRA"
        placeholder="Ingrese el IDTRA obligatorio"
        autocomplete="off"
        :error="form.submitted && !form.idtraNumber.trim() ? 'El IDTRA es obligatorio para aceptar la tarifa.' : undefined"
      />
    </div>

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
        :label="rate.rateType === 'Tariff' && !rate.sourceTariffRateId ? 'Crear QUO para cliente' : 'Aceptar tarifa'"
        :loading="form.saving"
      />
    </div>
  </form>
</template>
