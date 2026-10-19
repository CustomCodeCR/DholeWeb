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
type ModificationItem = { action: 'Add' | 'Change' | 'Remove'; field: string; details: string }
type WorkRequest = {
  id: string
  kind?: 'Modification' | 'New'
  rateId?: string | null
  payload?: {
    kind?: string
    modification?: { sourceRevisionNumber?: number; items?: ModificationItem[]; notes?: string }
  }
}
const router = useRouter()
const toast = useToastStore()
const workRequest = ref<WorkRequest | null>(null)
const finishing = ref(false)
const isModification = computed(() =>
  workRequest.value?.kind === 'Modification' || workRequest.value?.payload?.kind === 'Modification'
)
function actionName(action: ModificationItem['action']) {
  return action === 'Add' ? 'Agregar' : action === 'Remove' ? 'Eliminar' : 'Modificar'
}
function openRateEditor() {
  const rateId = workRequest.value?.rateId
  if (!rateId) return
  const href = router.resolve({ name: 'pricing-rate-wizard', params: { rateId }, query: { mode: 'edit' } }).href
  window.open(href, '_blank', 'noopener,noreferrer')
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
    const lease = await RateRequestLeaseService.claim(id)
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
          Revise cada cambio, abra la tarifa original en una pestaña nueva y guarde una nueva revisión.
          Mantenga abierta esta pantalla para conservar la reserva de trabajo.
        </p>
        <p class="mt-2 text-sm font-bold">Tarifa: {{ workRequest?.rateId }} · Revisión de origen: {{ workRequest?.payload?.modification?.sourceRevisionNumber }}</p>
      </div>
      <div v-for="(item, index) in workRequest?.payload?.modification?.items ?? []" :key="index" class="rounded-xl border border-[var(--dh-border)] p-3 text-sm">
        <strong>{{ index + 1 }}. {{ actionName(item.action) }} · {{ item.field }}</strong>
        <p class="mt-1 whitespace-pre-wrap text-[var(--dh-text-muted)]">{{ item.details }}</p>
      </div>
      <p v-if="workRequest?.payload?.modification?.notes" class="whitespace-pre-wrap text-sm">Observaciones: {{ workRequest.payload.modification.notes }}</p>
      <div class="flex flex-wrap gap-2">
        <DhButton label="Abrir tarifa para modificar" @click="openRateEditor" />
        <DhButton label="Enviar revisión al vendedor" :loading="finishing" variant="secondary" @click="completeModification" />
        <DhButton label="Volver al dashboard" variant="secondary" @click="router.push('/home')" />
      </div>
      <p class="text-xs text-[var(--dh-text-muted)]">Solo podrá finalizar después de que la tarifa tenga una revisión mayor que la indicada. El envío adjunta el PDF y conserva el historial.</p>
    </section>
    <PricingAlternativeWizardCrystal v-else :rate-request-id="requestId" />
  </div>
</template>
