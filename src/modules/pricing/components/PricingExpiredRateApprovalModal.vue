<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { RateDto } from '@/core/interfaces/pricing'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import {
  expiredRateApprovalService,
  type ExpiredRateApproval,
  type ExpiredRateApprovalStatus,
} from '@/modules/pricing/services/expiredRateApprovalService'

const props = defineProps<{
  rate?: RateDto
  mode?: 'request' | 'review'
  onSaved?: () => void | Promise<void>
}>()

const toast = useToastStore()
const modal = useModalStore()
const reason = ref('')
const busy = ref(false)
const loading = ref(true)
const current = ref<ExpiredRateApprovalStatus | null>(null)
const pending = ref<ExpiredRateApproval[]>([])
const decisions = reactive<Record<string, string>>({})

async function refresh() {
  loading.value = true
  try {
    if (props.mode === 'review') pending.value = await expiredRateApprovalService.pending()
    else if (props.rate) current.value = await expiredRateApprovalService.forRate(props.rate.id)
  } catch (error) {
    toast.backendError(error, 'No se pudieron consultar las autorizaciones.')
  } finally {
    loading.value = false
  }
}

async function requestApproval() {
  if (!props.rate || busy.value) return
  const explanation = reason.value.trim()
  if (explanation.length < 15) {
    toast.warning('Justificación obligatoria', 'Explique por qué dejó vencer la tarifa, con al menos 15 caracteres.')
    return
  }
  busy.value = true
  try {
    await expiredRateApprovalService.request(props.rate.id, explanation)
    toast.success('Autorización solicitada', 'Roy y José Pablo recibirán la solicitud por sistema y correo.')
    await refresh()
    await props.onSaved?.()
  } catch (error) {
    toast.backendError(error, 'No se pudo solicitar la autorización.')
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
        Solicitudes de tarifas vencidas que necesitan la aprobación de Roy o José Pablo.
        Solo la jefatura autorizada puede resolverlas.
      </template>
      <template v-else>
        La tarifa {{ rate?.quoNumber || rate?.rateCode }} venció.
        Para actualizarla, indique por qué no se renovó antes del vencimiento.
        Roy o José Pablo deberán autorizar la modificación.
      </template>
    </p>

    <p v-if="loading" class="text-sm">Consultando autorizaciones…</p>

    <template v-else-if="mode === 'review'">
      <div v-if="pending.length === 0" class="rounded-xl border border-[var(--dh-border)] p-4 text-sm">
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

    <template v-else-if="current">
      <div
        v-if="current.currentApproval?.status === 'Pending'"
        class="rounded-xl border border-amber-500/40 p-4 text-sm"
      >
        <strong>Pendiente de autorización.</strong>
        <p class="mt-1 whitespace-pre-wrap">Motivo: {{ current.currentApproval.reason }}</p>
      </div>
      <div
        v-else-if="current.canUpdate"
        class="rounded-xl border border-[var(--dh-border)] p-4 text-sm"
      >
        La actualización está autorizada. Regrese a la tarifa y seleccione Editar.
      </div>
      <template v-else>
        <label class="block space-y-1 text-sm font-semibold">
          ¿Por qué se dejó vencer la tarifa? *
          <textarea
            v-model="reason"
            rows="5"
            maxlength="4000"
            class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-bg)] p-3 text-sm text-[var(--dh-text)]"
            placeholder="Describa qué ocurrió, por qué no se renovó a tiempo y qué necesita actualizar."
          />
        </label>
        <p class="text-xs text-[var(--dh-text-muted)]">
          El motivo y la decisión quedarán registrados en el historial de la tarifa.
          La edición permanecerá bloqueada mientras no exista aprobación.
        </p>
        <button
          type="button"
          :disabled="busy || reason.trim().length < 15"
          class="w-full rounded-lg bg-[var(--dh-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          @click="requestApproval"
        >Solicitar autorización</button>
      </template>

      <div v-if="current.history.length" class="space-y-2 border-t border-[var(--dh-border)] pt-4">
        <h3 class="text-sm font-bold">Historial de vencimientos y autorizaciones</h3>
        <div v-for="entry in current.history" :key="entry.id" class="rounded-lg border border-[var(--dh-border)] p-3 text-xs">
          <strong>{{ entry.status === 'Pending' ? 'Pendiente' : entry.status === 'Approved' ? 'Aprobada' : 'Rechazada' }}</strong>
          <span class="ml-2">Rev. {{ entry.revisionNumber }} · {{ new Date(entry.requestedAtUtc).toLocaleString('es-CR') }}</span>
          <p class="mt-1 whitespace-pre-wrap break-words">{{ entry.reason }}</p>
          <p v-if="entry.decisionReason" class="mt-1 whitespace-pre-wrap break-words">Jefatura: {{ entry.decisionReason }}</p>
        </div>
      </div>
    </template>

    <div class="flex justify-end pt-2">
      <button type="button" class="rounded-lg border border-[var(--dh-border)] px-4 py-2 text-sm" @click="modal.close()">
        Cerrar
      </button>
    </div>
  </section>
</template>
