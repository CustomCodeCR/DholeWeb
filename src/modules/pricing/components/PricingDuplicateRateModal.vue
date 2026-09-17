<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Copy, FileSearch2, RefreshCw, Route, Ship } from 'lucide-vue-next'
import { DhButton, DhInput } from '@/shared/components/atoms'
import { PricingService } from '@/core/services/pricingService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import type { RateDto } from '@/core/interfaces/pricing'
import { rateDisplayName, routeLabel, toDateInput } from '@/modules/pricing/utils/pricingFormat'

const props = defineProps<{
  rate: RateDto
  onDuplicated?: (rateId: string) => void | Promise<void>
}>()

const router = useRouter()
const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({
  validFrom: toDateInput(props.rate.validFrom),
  validTo: toDateInput(props.rate.validTo),
  submitted: false,
  saving: false,
})

const validRange = computed(() => Boolean(form.validFrom && form.validTo && form.validTo >= form.validFrom))
const isFcl = computed(() => String(props.rate.shipmentMode ?? '').trim().toLowerCase() === 'fcl')
const submitLabel = computed(() => isFcl.value ? 'Duplicar y escoger flete' : 'Duplicar y revisar')

async function submit() {
  form.submitted = true
  if (!validRange.value) return

  try {
    form.saving = true
    const duplicatedRateId = await PricingService.duplicateRate(props.rate.id, {
      validFrom: form.validFrom,
      validTo: form.validTo,
    })

    toastStore.success(
      'Tarifa duplicada',
      isFcl.value
        ? 'La nueva vigencia quedó guardada. Debe seleccionar un flete marítimo vigente; luego Dhole recargará cargos y recargos con la configuración actual.'
        : 'La copia conserva la ruta y la nueva vigencia y se abrirá para revisión.',
    )
    modalStore.close()

    // El modal garantiza la navegación aunque el listado/drawer no inyecte callback.
    // Para FCL duplicateReview obliga al wizard a ir a Tarifa, descartar el flete anterior
    // y reconstruir cargos/recargos después de seleccionar el nuevo flete.
    await props.onDuplicated?.(duplicatedRateId)
    await router.push({
      name: 'pricing-rate-wizard',
      params: { rateId: duplicatedRateId },
      query: isFcl.value
        ? { mode: 'edit', duplicateReview: '1' }
        : { mode: 'edit' },
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo duplicar la tarifa.')
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="flex items-start gap-3">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
          <Copy class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="text-base font-black text-[var(--dh-text)]">Duplicar y revisar</p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            Se conserva la configuración general y la ruta. Puede definir una nueva vigencia sin reutilizar datos comerciales que pueden haber cambiado.
          </p>
        </div>
      </div>

      <div class="mt-4 rounded-2xl bg-[var(--dh-input)] p-4">
        <div class="flex items-center gap-2 text-xs font-black text-[var(--dh-primary)]">
          <Route class="h-4 w-4" /> {{ rate.quoNumber || rate.rateCode }}
        </div>
        <p class="mt-2 text-sm font-black text-[var(--dh-text)]">{{ rateDisplayName(rate) }}</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ routeLabel(rate) }}</p>
      </div>

      <div v-if="isFcl" class="mt-4 grid gap-2 text-xs font-semibold text-[var(--dh-text-muted)]">
        <div class="flex items-start gap-2 rounded-xl border border-[var(--dh-border)] px-3 py-2.5">
          <FileSearch2 class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
          <span>La vigencia de la copia será la que indique abajo.</span>
        </div>
        <div class="flex items-start gap-2 rounded-xl border border-[var(--dh-border)] px-3 py-2.5">
          <Ship class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
          <span>El flete marítimo anterior no se reutiliza: deberá escoger uno vigente con disponibilidad.</span>
        </div>
        <div class="flex items-start gap-2 rounded-xl border border-[var(--dh-border)] px-3 py-2.5">
          <RefreshCw class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
          <span>Al escoger el nuevo flete se vuelven a consultar los cargos y recargos vigentes.</span>
        </div>
      </div>
    </section>

    <section class="rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-4 flex items-center gap-2">
        <FileSearch2 class="h-4 w-4 text-[var(--dh-primary)]" />
        <p class="text-sm font-black text-[var(--dh-text)]">Nueva vigencia</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <DhInput
          v-model="form.validFrom"
          type="date"
          label="Válida desde"
          :error="form.submitted && !form.validFrom ? 'La fecha inicial es obligatoria.' : undefined"
        />
        <DhInput
          v-model="form.validTo"
          type="date"
          label="Válida hasta"
          :error="form.submitted && (!form.validTo || form.validTo < form.validFrom) ? 'La fecha final debe ser igual o posterior a la inicial.' : undefined"
        />
      </div>
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
        :label="submitLabel"
        :icon="Copy"
        :loading="form.saving"
      />
    </div>
  </form>
</template>
