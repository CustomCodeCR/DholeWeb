<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { useToastStore } from '@/core/stores/toastStore'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import { RateRequestLeaseService } from '@/modules/pricing/services/rateRequestLeaseService'

const route = useRoute()
type WorkRequest = {
  id: string
  kind?: 'Modification' | 'New'
  rateId?: string | null
  payload?: {
    kind?: string
    modification?: {
      sourceRevisionNumber?: number
      changes?: Array<{ field: string; action: string; original: string; requested: string }>
      quote?: string
      notes?: string
    }
  }
}
const router = useRouter()
const toast = useToastStore()
const workRequest = ref<WorkRequest | null>(null)
const finishing = ref(false)
const showRateEditor = ref(false)
const isModification = computed(() =>
  workRequest.value?.kind === 'Modification' || workRequest.value?.payload?.kind === 'Modification'
)
// Pricing guardó solicitudes anteriores con PascalCase (Field/Action/Original/Requested).
// Normalize in the UI: the already submitted quote must not need resubmitting.
const modificationChanges = computed(() =>
  (workRequest.value?.payload?.modification?.changes ?? [])
    .map(raw => {
      const row = raw as Record<string, unknown>
      const value = (camel: string, pascal: string) => String(row[camel] ?? row[pascal] ?? '').trim()
      return {
        field: value('field', 'Field'),
        action: value('action', 'Action'),
        original: value('original', 'Original'),
        requested: value('requested', 'Requested'),
      }
    })
    .filter(change => change.field || change.action || change.original || change.requested)
)
async function openRateEditor() {
  if (!workRequest.value?.rateId) return
  if (showRateEditor.value) {
    showRateEditor.value = false
    return
  }
  try {
    // Stay on the reserved request: a second tab would lose the heartbeat,
    // leave the original work item locked, and orphan the completion step.
    await router.replace({
      name: 'pricing-rate-request-resume',
      params: { requestId: requestId.value },
      query: { ...route.query, modificationRequestId: requestId.value },
    })
    showRateEditor.value = true
    lastInteractionAt = Date.now()
  } catch (error) {
    toast.backendError(error, 'No se pudo abrir la tarifa dentro de la solicitud reservada.')
  }
}
async function completeModification() {
  const rateId = workRequest.value?.rateId
  if (!rateId || finishing.value) return
  finishing.value = true
  try {
    await RateRequestLeaseService.completeRate(requestId.value, rateId)
    toast.success('Modificación completada', 'Se generó la revisión y se notificó al vendedor con el PDF actualizado.')
    await router.push('/home')
  } catch (error) {
    toast.backendError(error, 'Primero guarde una revisión nueva y luego vuelva a enviar la tarifa.')
  } finally {
    finishing.value = false
  }
}
const requestId = computed(() => String(route.params.requestId ?? ''))
const ready = ref(false)
const checking = ref(false)
const error = ref('')
const ownerName = ref('')
let heartbeatTimer: number | undefined
let currentId = ''
let generation = 0
let lastInteractionAt = Date.now()
const idleTimeoutMs = 15 * 60 * 1000
function recordActivity() { if (ready.value) lastInteractionAt = Date.now() }

async function begin(id: string) {
  const version = ++generation
  ready.value = false
  checking.value = true
  error.value = ''
  try {
    const lease = await RateRequestLeaseService.claim(id, { recoverOwnLease: true })
    if (version !== generation) {
      void RateRequestLeaseService.release(id).catch(() => undefined)
      return
    }
    currentId = id
    const response = await callEndpoint<unknown>({
      method: 'GET', path: `/api/pricing/rate-requests/${encodeURIComponent(id)}`,
      headers: { Accept: 'application/json' },
    })
    workRequest.value = unwrapApiResponse<WorkRequest>(response as never)
    ownerName.value = lease.ownerName
    lastInteractionAt = Date.now()
    ready.value = true
    heartbeatTimer = window.setInterval(() => {
      if (Date.now() - lastInteractionAt >= idleTimeoutMs) {
        stop()
        error.value = 'La reserva se liberó tras 15 minutos de inactividad. Puede volver a intentar tomarla.'
        return
      }
      void RateRequestLeaseService.heartbeat(id).catch(() => {
        if (version !== generation) return
        ready.value = false
        error.value = 'Se perdió la reserva de esta solicitud. Ya no puede editarla. Regrese al dashboard.'
        if (heartbeatTimer) window.clearInterval(heartbeatTimer)
        heartbeatTimer = undefined
        // Conserve the original tab token so a reconnect can renew its own lease.
      })
    }, 20000)
  } catch (cause) {
    if (version !== generation) return
    if (currentId === id) {
      await RateRequestLeaseService.release(id).catch(() => undefined)
      currentId = ''
    }
    const serverMessage = (cause as { message?: string })?.message
    error.value = serverMessage || 'Otro usuario está atendiendo esta solicitud.'
  } finally {
    if (version === generation) checking.value = false
  }
}

function stop() {
  ++generation
  if (heartbeatTimer) window.clearInterval(heartbeatTimer)
  heartbeatTimer = undefined
  ready.value = false
  workRequest.value = null
  showRateEditor.value = false
  const id = currentId
  currentId = ''
  if (id) void RateRequestLeaseService.release(id).catch(() => undefined)
}

onMounted(() => {
  window.addEventListener('pointerdown', recordActivity)
  window.addEventListener('keydown', recordActivity)
  window.addEventListener('wheel', recordActivity)
  void begin(requestId.value)
})
watch(requestId, (next, previous) => {
  if (next === previous) return
  stop()
  void begin(next)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', recordActivity)
  window.removeEventListener('keydown', recordActivity)
  window.removeEventListener('wheel', recordActivity)
  stop()
})
</script>

<template>
  <section v-if="checking" class="dh-glass rounded-2xl p-6 text-sm font-semibold">
    Reservando solicitud de tarifa…
  </section>
  <section v-else-if="!ready" class="dh-glass rounded-2xl p-6">
    <h2 class="text-lg font-black">Solicitud no disponible</h2>
    <p class="mt-2 text-sm">{{ error || 'No fue posible obtener la reserva.' }}</p>
    <div class="mt-4 flex flex-wrap gap-2">
      <DhButton @click="begin(requestId)">Reintentar</DhButton>
      <DhButton variant="secondary" @click="router.push('/home')">Volver al dashboard</DhButton>
    </div>
  </section>
  <div v-else>
    <div class="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold">
      Solicitud reservada para {{ ownerName }}. Nadie más puede trabajar esta solicitud mientras esté activa.
    </div>
    <section v-if="isModification" class="mb-4 space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div>
        <h2 class="text-lg font-black">Solicitud de modificación de tarifa</h2>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
          Revise las diferencias y abra la tarifa en este mismo flujo. Puede editarla
          sin perder la reserva y luego enviar la nueva revisión al vendedor.
        </p>
        <p class="mt-2 text-sm font-bold">Tarifa: {{ workRequest?.payload?.modification?.quote || workRequest?.rateId }} · Revisión de origen: {{ workRequest?.payload?.modification?.sourceRevisionNumber }}</p>
      </div>
      <div class="overflow-x-auto rounded-xl border border-[var(--dh-border)]">
        <table class="w-full min-w-[660px] text-left text-sm">
          <thead class="bg-[var(--dh-card-hover)] text-xs uppercase text-[var(--dh-text-muted)]">
            <tr><th class="p-3">Cambio</th><th class="p-3">Original (Pricing)</th><th class="p-3">Solicitado (Ventas)</th></tr>
          </thead>
          <tbody class="divide-y divide-[var(--dh-border)]">
            <tr v-for="(change, index) in modificationChanges :key="index">
              <td class="p-3 font-bold">{{ change.action }} · {{ change.field }}</td>
              <td class="p-3 whitespace-pre-wrap text-[var(--dh-text-muted)]">{{ change.original }}</td>
              <td class="p-3 whitespace-pre-wrap font-semibold text-[var(--dh-text)]">{{ change.requested }}</td>
            </tr>
            <tr v-if="!modificationChanges.length"><td colspan="3" class="p-4 text-center text-[var(--dh-text-muted)]">No hay diferencias disponibles para mostrar.</td></tr>
          </tbody>
        </table>
      </div>
      <p v-if="workRequest?.payload?.modification?.notes" class="whitespace-pre-wrap text-sm">Observaciones: {{ workRequest?.payload?.modification?.notes }}</p>
      <div class="flex flex-wrap gap-2">
        <DhButton :label="showRateEditor ? 'Ocultar editor' : 'Continuar modificación de tarifa'" @click="openRateEditor" />
        <DhButton label="Enviar revisión al vendedor" :loading="finishing" variant="secondary" @click="completeModification" />
        <DhButton label="Volver al dashboard" variant="secondary" @click="router.push('/home')" />
      </div>
      <p class="text-xs text-[var(--dh-text-muted)]">Solo podrá finalizar después de que la tarifa tenga una revisión mayor que la indicada. El envío adjunta el PDF y conserva el historial.</p>
    </section>
    <PricingAlternativeWizardCrystal
      v-if="isModification && showRateEditor && workRequest?.rateId"
      :rate-id="workRequest.rateId"
    />
    <PricingAlternativeWizardCrystal v-else-if="!isModification" :rate-request-id="requestId" />
  </div>
</template>
