<script setup lang="ts">
import { reactive } from 'vue'
import { Copy } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import type { RateDto } from '@/core/interfaces/pricing'
import { toDateInput } from '@/modules/pricing/utils/pricingFormat'

const props = defineProps<{ rate: RateDto; onSaved?: () => void | Promise<void> }>()
const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({
  validFrom: toDateInput(props.rate.validFrom),
  validTo: toDateInput(props.rate.validTo),
  submitted: false,
  saving: false,
})

async function submit() {
  form.submitted = true
  if (!form.validFrom || !form.validTo || form.validTo < form.validFrom) return
  try {
    form.saving = true
    await PricingService.duplicateRate(props.rate.id, {
      validFrom: form.validFrom,
      validTo: form.validTo,
    })
    toastStore.success(
      'Tarifa duplicada',
      'La copia conserva los rubros y permite una vigencia independiente.',
    )
    modalStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo duplicar la tarifa.')
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div
      class="flex items-start gap-3 rounded-[22px] bg-blue-500/10 p-4 text-blue-800 dark:text-blue-200"
    >
      <Copy class="mt-0.5 h-5 w-5 shrink-0" />
      <p class="text-sm font-semibold">
        Se copiarán la ruta, los rubros, costos y ventas. Defina la vigencia de la nueva tarifa.
      </p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <DhInput
        v-model="form.validFrom"
        type="date"
        label="Válida desde"
        :error="form.submitted && !form.validFrom ? 'Indique la fecha.' : undefined"
      />
      <DhInput
        v-model="form.validTo"
        type="date"
        label="Válida hasta"
        :error="
          form.submitted && (!form.validTo || form.validTo < form.validFrom)
            ? 'Revise el rango.'
            : undefined
        "
      />
    </div>
    <div class="flex justify-end gap-2">
      <DhButton
        label="Cancelar"
        variant="secondary"
        :disabled="form.saving"
        @click="modalStore.close()"
      />
      <DhButton label="Duplicar tarifa" :icon="Copy" type="submit" :loading="form.saving" />
    </div>
  </form>
</template>
