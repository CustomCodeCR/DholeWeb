<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { CheckCircle2, FileCheck2, XCircle } from 'lucide-vue-next'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import type { RateDto } from '@/core/interfaces/pricing'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  rate: RateDto
  decision: 'AcceptedByClient' | 'RejectedByClient' | 'Cancelled'
  onSaved?: () => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({
  reason: '',
  observations: '',
  submitted: false,
  saving: false,
})

type SellerGroupOption = {
  rateId: string
  suffix: string
  status: string
  rateStatus: string
  poeName: string
  podName?: string | null
  carrierName: string
}
type SellerGroupSnapshot = {
  parentQuoteNumber: string
  selectedRateId?: string | null
  alternatives: SellerGroupOption[]
}
const quoteGroup = ref<SellerGroupSnapshot | null>(null)
const selectedOptionId = ref('')
const optionsLoading = ref(false)
const optionsError = ref('')
const groupedQuote = computed(() => (props.rate.groupAlternativeCount ?? 0) > 1)
const optionsReady = computed(() =>
  !groupedQuote.value || (!!quoteGroup.value && quoteGroup.value.alternatives.length > 1))
const quoteOptionRequired = computed(() =>
  props.decision === 'AcceptedByClient' && groupedQuote.value)
onMounted(async () => {
  if (!groupedQuote.value) return
  optionsLoading.value = true
  try {
    const response = await callEndpoint<SellerGroupSnapshot>({
      method: 'GET',
      path: `/api/pricing/seller-rates/${encodeURIComponent(props.rate.id)}/options`,
      headers: { Accept: 'application/json' },
    })
    quoteGroup.value = unwrapApiResponse<SellerGroupSnapshot>(response as never)
    selectedOptionId.value = quoteGroup.value.selectedRateId || ''
    if (quoteGroup.value.alternatives.length < 2)
      optionsError.value = 'No se pudieron cargar todas las opciones de la cotización.'
  } catch (error) {
    optionsError.value = 'No se pudieron consultar las opciones de la cotización. Intente nuevamente.'
    toastStore.backendError(error, optionsError.value)
  } finally {
    optionsLoading.value = false
  }
})
const isAccept = computed(() => props.decision === 'AcceptedByClient')
const isCancel = computed(() => props.decision === 'Cancelled')
const reference = computed(() => props.rate.quoNumber || props.rate.rateCode || 'Tarifa')

async function submit() {
  form.submitted = true

  const reason = form.reason.trim()
  if (!isAccept.value && (!reason || reason.length > 1000)) return
  if (isAccept.value && form.observations.trim().length > 2000) return
  if (quoteOptionRequired.value && (!optionsReady.value || !selectedOptionId.value)) {
    optionsError.value = 'Elija una de las opciones de esta misma cotización antes de aceptarla.'
    return
  }

  try {
    form.saving = true

    const chosenRateId = quoteOptionRequired.value ? selectedOptionId.value : props.rate.id
    if (quoteOptionRequired.value && !quoteGroup.value?.selectedRateId) {
      // Seller ownership is checked on this endpoint; it uses the same
      // serializable parent-row lock as Pricing's group selector.
      await callEndpoint<unknown>({
        method: 'POST',
        path: `/api/pricing/seller-rates/${encodeURIComponent(chosenRateId)}/group-select`,
        headers: { Accept: 'application/json' },
      })
    }
    await callEndpoint<unknown>(
      {
        method: 'PATCH',
        path: `/api/pricing/seller-rates/${encodeURIComponent(chosenRateId)}/status`,
        headers: { Accept: 'application/json' },
      },
      {
        body: {
          status: props.decision,
          idtraNumber: null,
          reason: isAccept.value ? null : reason,
          observations: isAccept.value ? form.observations.trim() || null : null,
        },
      },
    )

    toastStore.success(
      isAccept.value ? 'Tarifa aceptada por el cliente' : isCancel.value ? 'Cotización cancelada' : 'Tarifa no aceptada por el cliente',
      isAccept.value
        ? 'La aceptación quedó registrada y las observaciones se incluirán en el aviso de apertura de trámite cuando corresponda. El IDTRA podrá agregarse posteriormente.'
        : isCancel.value
          ? 'La cotización quedó cancelada y el motivo se registró para seguimiento y auditoría.'
          : 'El motivo de rechazo quedó registrado para seguimiento.',
    )

    modalStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(
      error,
      isAccept.value
        ? 'No se pudo registrar la aceptación del cliente.'
        : isCancel.value
          ? 'No se pudo cancelar la cotización.'
          : 'No se pudo registrar el rechazo del cliente.',
    )
  } finally {
    form.saving = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div
      class="rounded-[24px] border p-4"
      :class="isAccept
        ? 'border-emerald-500/25 bg-emerald-500/10'
        : 'border-red-500/25 bg-red-500/10'"
    >
      <div class="flex items-start gap-3">
        <span
          class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
          :class="isAccept
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
            : 'bg-red-500/15 text-red-600 dark:text-red-300'"
        >
          <CheckCircle2 v-if="isAccept" class="h-5 w-5" />
          <XCircle v-else class="h-5 w-5" />
        </span>

        <div class="min-w-0">
          <p class="text-sm font-black text-[var(--dh-text)]">
            {{ isAccept ? 'Confirmar aceptación del cliente' : isCancel ? 'Confirmar cancelación de cotización' : 'Registrar rechazo del cliente' }}
          </p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            {{ isAccept
              ? 'La tarifa pasará a Aceptadas. No necesita tener el IDTRA para registrar la aceptación; podrá agregarse posteriormente.'
              : isCancel
                ? 'Esta cotización pasará a Canceladas. El motivo será obligatorio y quedará registrado en la auditoría. Esta acción no equivale a un rechazo del cliente.'
                : 'La tarifa pasará a No aceptadas y el motivo quedará disponible para seguimiento y auditoría.' }}
          </p>
        </div>
      </div>
    </div>

    <p v-if="props.rate.status === 'Expired'" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-semibold text-[var(--dh-text)]">
      Esta cotización está vencida. Registrar la decisión no renueva su vigencia; confirme las condiciones comerciales con Pricing.
    </p>

    <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="flex items-center gap-2 text-xs font-black text-[var(--dh-primary)]" :class="{ 'mb-4': !isAccept }">
        <FileCheck2 class="h-4 w-4" />
        {{ reference }}
      </div>

      <div v-if="quoteOptionRequired" class="mt-4 space-y-3">
        <p class="text-sm font-bold text-[var(--dh-text)]">
          Cotización {{ quoteGroup?.parentQuoteNumber || reference }}: seleccione la opción aceptada
        </p>
        <p v-if="optionsLoading" class="text-xs text-[var(--dh-text-muted)]">Cargando opciones de la QUO…</p>
        <div v-for="option in quoteGroup?.alternatives || []" :key="option.rateId"
          class="rounded-xl border p-3 transition-colors"
          :class="selectedOptionId === option.rateId
            ? 'border-[var(--dh-primary)] bg-[var(--dh-card-hover)]'
            : 'border-[var(--dh-border)] bg-[var(--dh-card)]'">
          <button type="button" class="w-full text-left"
            :disabled="!!quoteGroup?.selectedRateId && quoteGroup.selectedRateId !== option.rateId"
            :aria-pressed="selectedOptionId === option.rateId"
            @click="selectedOptionId = option.rateId; optionsError = ''">
            <span class="block text-sm font-black text-[var(--dh-text)]">Opción {{ option.suffix }} · {{ option.carrierName }}</span>
            <span class="mt-1 block text-xs text-[var(--dh-text-muted)]">{{ option.poeName }} → {{ option.podName || 'Destino por confirmar' }}</span>
            <span v-if="quoteGroup?.selectedRateId === option.rateId" class="mt-1 block text-xs font-bold text-[var(--dh-primary)]">Opción elegida</span>
            <span v-else-if="quoteGroup?.selectedRateId" class="mt-1 block text-xs text-[var(--dh-text-muted)]">No seleccionada, no rechazada</span>
          </button>
        </div>
        <p v-if="optionsError" role="alert" class="text-xs font-semibold text-red-600 dark:text-red-400">{{ optionsError }}</p>
        <p class="text-xs text-[var(--dh-text-muted)]">Se aceptará una sola QUO. La otra opción no se registrará como rechazada.</p>
      </div>
      <p
        v-if="isAccept"
        class="mt-3 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]"
      >
        Confirme que el cliente aceptó esta tarifa. Puede agregar instrucciones para el equipo de apertura de trámite.
      </p>
      <div v-if="isAccept" class="mt-4">
        <DhTextarea
          v-model="form.observations"
          label="Observaciones para apertura de trámite (opcional)"
          :rows="4"
          maxlength="2000"
          placeholder="Instrucciones especiales, documentación pendiente, contactos o indicaciones del cliente..."
          :error="form.observations.trim().length > 2000 ? 'Máximo 2000 caracteres.' : undefined"
        />
        <p class="mt-2 text-xs text-[var(--dh-text-muted)]">Se incluirán en el correo de apertura de trámite. No se agregan al PDF de la cotización.</p>
      </div>

      <DhTextarea
        v-else
        v-model="form.reason"
        :label="isCancel ? 'Motivo de cancelación' : 'Motivo del rechazo'"
        :rows="4"
        :placeholder="isCancel ? 'Explique por qué se cancela esta cotización...' : 'Explique por qué el cliente no aceptó la tarifa...'"
        maxlength="1000"
        :error="form.submitted && !form.reason.trim() ? 'El motivo es obligatorio.' : form.reason.trim().length > 1000 ? 'Máximo 1000 caracteres.' : undefined"
      />
    </div>

    <div class="flex justify-end gap-2">
      <DhButton
        type="button"
        label="Volver"
        variant="secondary"
        :disabled="form.saving"
        @click="modalStore.close()"
      />
      <DhButton
        type="submit"
        :label="isAccept ? 'Aceptar tarifa' : isCancel ? 'Cancelar cotización' : 'Registrar rechazo'"
        :variant="isAccept ? undefined : 'danger'"
        :loading="form.saving"
        :disabled="form.saving || (quoteOptionRequired && (optionsLoading || !optionsReady || !selectedOptionId))"
      />
    </div>
  </form>
</template>
