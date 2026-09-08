<script setup lang="ts">
import { computed, reactive } from 'vue'
import { CheckCircle2, FileCheck2, XCircle } from 'lucide-vue-next'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import type { RateDto } from '@/core/interfaces/pricing'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

const props = defineProps<{
  rate: RateDto
  decision: 'AcceptedByClient' | 'RejectedByClient'
  onSaved?: () => void | Promise<void>
}>()

const modalStore = useModalStore()
const toastStore = useToastStore()
const form = reactive({
  reason: '',
  submitted: false,
  saving: false,
})

const isAccept = computed(() => props.decision === 'AcceptedByClient')
const reference = computed(() => props.rate.quoNumber || props.rate.rateCode || 'Tarifa')

async function submit() {
  form.submitted = true

  const reason = form.reason.trim()
  if (!isAccept.value && !reason) return

  try {
    form.saving = true

    await callEndpoint<unknown>(
      {
        method: 'PATCH',
        path: `/api/pricing/seller-rates/${props.rate.id}/status`,
        headers: { Accept: 'application/json' },
      },
      {
        body: {
          status: props.decision,
          idtraNumber: null,
          reason: isAccept.value ? null : reason,
        },
      },
    )

    toastStore.success(
      isAccept.value ? 'Tarifa aceptada por el cliente' : 'Tarifa no aceptada por el cliente',
      isAccept.value
        ? 'La aceptación quedó registrada. El IDTRA podrá incorporarse posteriormente cuando esté disponible.'
        : 'El motivo de rechazo quedó registrado para seguimiento.',
    )

    modalStore.close()
    await props.onSaved?.()
  } catch (error) {
    toastStore.backendError(
      error,
      isAccept.value
        ? 'No se pudo registrar la aceptación del cliente.'
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
            {{ isAccept ? 'Confirmar aceptación del cliente' : 'Registrar rechazo del cliente' }}
          </p>
          <p class="mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            {{ isAccept
              ? 'La tarifa pasará a Aceptadas. No necesita tener el IDTRA para registrar la aceptación; podrá agregarse posteriormente.'
              : 'La tarifa pasará a No aceptadas y el motivo quedará disponible para seguimiento y auditoría.' }}
          </p>
        </div>
      </div>
    </div>

    <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div class="flex items-center gap-2 text-xs font-black text-[var(--dh-primary)]" :class="{ 'mb-4': !isAccept }">
        <FileCheck2 class="h-4 w-4" />
        {{ reference }}
      </div>

      <p
        v-if="isAccept"
        class="mt-3 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]"
      >
        Confirme que el cliente aceptó esta tarifa. No se solicitará información adicional al vendedor.
      </p>

      <DhTextarea
        v-else
        v-model="form.reason"
        label="Motivo del rechazo"
        :rows="4"
        placeholder="Explique por qué el cliente no aceptó la tarifa..."
        :error="form.submitted && !form.reason.trim() ? 'El motivo es obligatorio.' : undefined"
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
        :label="isAccept ? 'Aceptar tarifa' : 'Registrar rechazo'"
        :variant="isAccept ? undefined : 'danger'"
        :loading="form.saving"
      />
    </div>
  </form>
</template>
