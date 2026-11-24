<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { RateDto } from '@/core/interfaces/pricing'
import { DhButton, DhTextarea } from '@/shared/components/atoms'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import {
  expiredRateApprovalService,
  type ExpiredRateApproval,
  type ExpiredRateApprovalStatus,
} from '@/modules/pricing/services/expiredRateApprovalService'

const props = defineProps<{
  rate?: RateDto
  rateId?: string
  mode?: 'request' | 'review' | 'history'
  onSaved?: () => void | Promise<void>
  onContinue?: () => void
}>()

const toast = useToastStore()
const modal = useModalStore()
const reason = ref('')
const busy = ref(false)
const loading = ref(true)
const loadError = ref('')
const submitError = ref('')
const submittedReason = ref('')
let refreshSequence = 0
const current = ref<ExpiredRateApprovalStatus | null>(null)
const pending = ref<ExpiredRateApproval[]>([])
const decisions = reactive<Record<string, string>>({})

async function refresh() {
  const sequence = ++refreshSequence
  loading.value = true
  loadError.value = ''
  try {
    if (props.mode === 'review') {
      const rows = await expiredRateApprovalService.pending()
      if (sequence === refreshSequence) pending.value = rows
    } else if (props.rate?.id || props.rateId) {
      const status = await expiredRateApprovalService.forRate(props.rate?.id || props.rateId!)
      if (sequence === refreshSequence) {
        current.value = status
        submittedReason.value = ''
      }
    } else {
      throw new Error('No se identificó la tarifa.')
    }
  } catch (error) {
    if (sequence !== refreshSequence) return
    loadError.value = 'No se pudo consultar el estado de la autorización. Puede reintentar la consulta.'
    toast.backendError(error, loadError.value)
  } finally {
    if (sequence === refreshSequence) loading.value = false
  }
}

async function requestApproval() {
  if (!props.rate || busy.value || loading.value || submittedReason.value
    || current.value?.currentApproval?.status === 'Pending' || current.value?.canUpdate) return
  const explanation = reason.value.trim()
  if (explanation.length < 15 || explanation.length > 4000) {
    toast.warning('Justificación obligatoria', 'Explique por qué dejó vencer la tarifa, con 15 a 4000 caracteres.')
    return
  }
  busy.value = true
  submitError.value = ''
  try {
    await expiredRateApprovalService.request(props.rate.id, explanation)
    submittedReason.value = explanation
    toast.success('Autorización solicitada', 'La jefatura recibirá la solicitud por sistema y correo.')
    await refresh()
    await props.onSaved?.()
  } catch (error) {
    submitError.value = 'No se pudo confirmar la solicitud. El motivo escrito se conserva; consulte el estado o vuelva a intentarlo.'
    toast.backendError(error, submitError.value)
  } finally {
    busy.value = false
  }
}

async function decide(item: ExpiredRateApproval, approve: boolean) {
  if (busy.value) return
  const comment = (decisions[item.id] ?? '').trim()
  if (!approve && comment.length < 5) {
    toast.warning('Motivo de rechazo', 'Indique el motivo del rechazo antes de continuar.')
    return
  }
  busy.value = true
  try {
    await expiredRateApprovalService.decide(item.id, approve, comment)
    toast.success(approve ? 'Actualización autorizada' : 'Solicitud rechazada',
      'La decisión se registró y se notificó al solicitante.')
    await refresh()
    await props.onSaved?.()
  } catch (error) {
    toast.backendError(error, 'No se pudo registrar la decisión.')
  } finally {
    busy.value = false
  }
}

function continueApprovedRenewal() {
  if (!current.value?.canUpdate || !props.onContinue) return
  modal.close()
  props.onContinue()
}

function realtimeRefresh(event: Event) {
  const detail = (event as CustomEvent<{ notificationType?: string }>).detail
  if (detail?.notificationType?.startsWith('pricing.rate.expired-update.')) void refresh()
}

onMounted(() => {
  void refresh()
  window.addEventListener('dhole:notification:received', realtimeRefresh)
})
onBeforeUnmount(() => window.removeEventListener('dhole:notification:received', realtimeRefresh))
</script>

<template>
  <section class="space-y-4 text-[var(--dh-text)]">
    <p class="text-sm text-[var(--dh-text-muted)]">
      <template v-if="mode === 'review'">
        Solicitudes de tarifas vencidas pendientes de aprobación de jefatura.
      </template>
      <template v-else-if="mode === 'history'">
        Consulte los motivos de vencimiento y las decisiones de jefatura de todas las revisiones de esta cotización.
      </template>
      <template v-else>
        La tarifa {{ rate?.quoNumber || rate?.rateCode }} venció.
        Para actualizarla, indique por qué no se renovó antes del vencimiento.
        La jefatura deberá autorizar la actualización.
      </template>
    </p>

    <p v-if="loading" class="text-sm" role="status">Consultando autorizaciones…</p>
    <div v-if="loadError" role="alert" class="space-y-2 text-sm text-[var(--dh-text-muted)]">
      <p>{{ loadError }}</p>
      <DhButton variant="secondary" size="sm" label="Reintentar consulta" :loading="loading" @click="refresh" />
    </div>

    <template v-if="mode === 'review'">
      <div v-if="!loading && !loadError && pending.length === 0" class="rounded-xl border border-[var(--dh-border)] p-4 text-sm">
        No hay autorizaciones pendientes.
      </div>
      <article
        v-for="item in pending"
        :key="item.id"
        class="space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong>Tarifa {{ item.rateId }}</strong>
          <span class="text-xs text-[var(--dh-text-muted)]">
            Revisión {{ item.revisionNumber }} · {{ new Date(item.requestedAtUtc).toLocaleString('es-CR') }}
          </span>
        </div>
        <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Motivo por el que se dejó vencer:</p>
        <p class="whitespace-pre-wrap break-words text-sm">{{ item.reason }}</p>
        <label class="block space-y-1 text-xs font-semibold">
          Observación de jefatura (obligatoria para rechazar)
          <textarea
            v-model="decisions[item.id]"
            rows="2"
            maxlength="4000"
            class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-bg)] p-3 text-sm text-[var(--dh-text)]"
            placeholder="Explique la decisión"
          />
        </label>
        <div class="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            :disabled="busy"
            class="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
            @click="decide(item, false)"
          >Rechazar</button>
          <button
            type="button"
            :disabled="busy"
            class="rounded-lg bg-[var(--dh-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            @click="decide(item, true)"
          >Autorizar actualización</button>
        </div>
      </article>
    </template>

    <template v-else-if="mode === 'history'">
      <p v-if="!loading && !loadError && current && !current.history.length" class="text-sm text-[var(--dh-text-muted)]">
        No hay solicitudes de actualización por vencimiento registradas.
      </p>
    </template>
    <template v-else>
      <div
        v-if="submittedReason || current?.currentApproval?.status === 'Pending'"
        class="rounded-xl border border-amber-500/40 p-4 text-sm"
      >
        <strong>Pendiente de autorización.</strong>
        <p class="mt-1 whitespace-pre-wrap">Motivo: {{ submittedReason || current?.currentApproval?.reason }}</p>
      </div>
      <div
        v-else-if="current?.canUpdate"
        class="rounded-xl border border-[var(--dh-border)] p-4 text-sm"
      >
        La actualización está autorizada.
        <template v-if="onContinue">
          <p class="mt-1">Puede solicitar a Pricing la renovación sin modificar los datos de carga.</p>
          <DhButton class="mt-3" label="Continuar con actualización" @click="continueApprovedRenewal" />
        </template>
        <template v-else> Regrese a la tarifa y seleccione Editar.</template>
      </div>
      <template v-else>
        <DhTextarea
          v-model="reason"
          label="¿Por qué se dejó vencer la tarifa? *"
          :rows="5"
          :disabled="busy"
          placeholder="Describa qué ocurrió, por qué no se renovó a tiempo y qué necesita actualizar."
          :error="reason.length > 4000 ? 'Máximo 4000 caracteres.' : undefined"
        />
        <p class="text-xs text-[var(--dh-text-muted)]">{{ reason.trim().length }} / 4000 caracteres · mínimo 15</p>
        <p class="text-xs text-[var(--dh-text-muted)]">
          El motivo y la decisión quedarán registrados en el historial de la tarifa.
          La edición permanecerá bloqueada mientras no exista aprobación.
        </p>
        <p v-if="submitError" role="alert" class="text-sm text-red-600">{{ submitError }}</p>
        <DhButton
          class="w-full"
          label="Solicitar autorización"
          :loading="busy"
          :disabled="loading || !rate || reason.trim().length < 15 || reason.trim().length > 4000"
          @click="requestApproval"
        />
      </template>

    </template>

      <div v-if="mode !== 'review' && current && current.history.length" class="space-y-2 border-t border-[var(--dh-border)] pt-4">
        <h3 class="text-sm font-bold">Historial de vencimientos y autorizaciones</h3>
        <div v-for="entry in current.history" :key="entry.id" class="rounded-lg border border-[var(--dh-border)] p-3 text-xs">
          <strong>{{ entry.status === 'Pending' ? 'Pendiente' : entry.status === 'Approved' ? 'Aprobada' : 'Rechazada' }}</strong>
          <span class="ml-2">Rev. {{ entry.revisionNumber }} · {{ new Date(entry.requestedAtUtc).toLocaleString('es-CR') }}</span>
          <p class="mt-1 whitespace-pre-wrap break-words">{{ entry.reason }}</p>
          <p v-if="entry.decisionReason" class="mt-1 whitespace-pre-wrap break-words">Jefatura: {{ entry.decisionReason }}</p>
        </div>
      </div>

    <div class="flex justify-end pt-2">
      <button type="button" class="rounded-lg border border-[var(--dh-border)] px-4 py-2 text-sm" @click="modal.close()">
        Cerrar
      </button>
    </div>
  </section>
</template>
