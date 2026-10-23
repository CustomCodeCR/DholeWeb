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
type WorkStatus = 'Working' | 'RequestedFromProvider'
type WorkRequest = {
  workStatus?: WorkStatus | null
  workStatusUpdatedAtUtc?: string | null
  preparedRevisionNumber?: number | null
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
const workStatusSaving = ref(false)
const isModification = computed(() =>
  workRequest.value?.kind === 'Modification' || workRequest.value?.payload?.kind === 'Modification'
)
const modificationPrepared = computed(() => isModification.value
  && Number(workRequest.value?.preparedRevisionNumber || 0) >
     Number(workRequest.value?.payload?.modification?.sourceRevisionNumber || 0))
function onModificationPrepared(event: Event) {
  const detail = (event as CustomEvent<{ requestId: string; preparedRevisionNumber: number }>).detail
  if (detail?.requestId !== requestId.value || !workRequest.value || !ready.value) return
  workRequest.value.preparedRevisionNumber = detail.preparedRevisionNumber
}
async function completeModification() {
  const rateId = workRequest.value?.rateId
  if (!rateId || !modificationPrepared.value || finishing.value) return
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

async function setWorkStatus(nextStatus: WorkStatus) {
  if (!ready.value || workStatusSaving.value || !workRequest.value || workRequest.value.workStatus === nextStatus) return
  const id = requestId.value
  workStatusSaving.value = true
  try {
    const updated = await RateRequestLeaseService.setWorkStatus(id, nextStatus)
    if (currentId !== id || !workRequest.value) return
    workRequest.value.workStatus = updated.workStatus
    workRequest.value.workStatusUpdatedAtUtc = updated.workStatusUpdatedAtUtc
    toast.success('Estado actualizado', nextStatus === 'Working' ? 'El vendedor verá Trabajando.' : 'El vendedor verá Solicitado a proveedor.')
  } catch (cause) {
    toast.backendError(cause, 'No se pudo actualizar el estado de trabajo.')
  } finally {
    workStatusSaving.value = false
  }
}

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
  const id = currentId
  currentId = ''
  if (id) void RateRequestLeaseService.release(id).catch(() => undefined)
}

onMounted(() => {
  window.addEventListener('dhole:pricing:modification-prepared', onModificationPrepared)
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
  window.removeEventListener('dhole:pricing:modification-prepared', onModificationPrepared)
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

    <section class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">
      <div class="min-w-0">
        <p class="text-sm font-black text-[var(--dh-text)]">Estado visible para Ventas</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Cambie el estado conforme avanza la cotización. El vendedor lo verá automáticamente en su dashboard.</p>
      </div>
      <div role="group" aria-label="Estado de trabajo de la solicitud" class="flex flex-wrap items-center gap-2">
        <button type="button" :disabled="workStatusSaving"
          :aria-pressed="workRequest?.workStatus === 'Working'"
          class="rounded-xl border px-3 py-2 text-xs font-black transition-colors disabled:opacity-60"
          :class="workRequest?.workStatus === 'Working' ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text)]'"
          @click="setWorkStatus('Working')">Trabajando</button>
        <button type="button" :disabled="workStatusSaving"
          :aria-pressed="workRequest?.workStatus === 'RequestedFromProvider'"
          class="rounded-xl border px-3 py-2 text-xs font-black transition-colors disabled:opacity-60"
          :class="workRequest?.workStatus === 'RequestedFromProvider' ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text)]'"
          @click="setWorkStatus('RequestedFromProvider')">Solicitado a proveedor</button>
        <span v-if="workStatusSaving" role="status" class="text-xs text-[var(--dh-text-muted)]">Guardando…</span>
      </div>
    </section>

    <!-- Same wizard used by "Continuar tarifa": no separate comparison screen. -->
    <section v-if="isModification" class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">
      <div class="min-w-0">
        <p class="text-sm font-black">Continuar modificación · {{ workRequest?.payload?.modification?.quote || workRequest?.rateId }}</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Revisión original {{ workRequest?.payload?.modification?.sourceRevisionNumber ?? 1 }}.
          Compare los cambios en el wizard, guarde la nueva revisión y después envíela al vendedor.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <DhButton
          label="Enviar revisión al vendedor"
          :loading="finishing"
          :disabled="!workRequest?.rateId || !modificationPrepared || finishing"
          @click="completeModification"
        />
        <span v-if="!modificationPrepared" class="text-xs font-semibold text-amber-500">Primero guarde los cambios de la nueva revisión en pantalla 8.</span>
        <DhButton label="Volver al dashboard" variant="secondary" @click="router.push('/home')" />
      </div>
    </section>

    <PricingAlternativeWizardCrystal
      v-if="isModification && workRequest?.rateId"
      :key="'modification:' + requestId"
      :rate-id="workRequest.rateId"
      :modification-request-id="requestId"
    />
    <PricingAlternativeWizardCrystal v-else-if="!isModification" :key="'original:' + requestId" :rate-request-id="requestId" />
    <p v-else class="dh-glass rounded-xl p-4 text-sm text-[var(--dh-text-muted)]">
      No se encontró la tarifa asociada a esta modificación. Revise la solicitud desde el dashboard.
    </p>
  </div>
</template>
