<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { useToastStore } from '@/core/stores/toastStore'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import { RateRequestLeaseService } from '@/modules/pricing/services/rateRequestLeaseService'
import { StorageService } from '@/core/services/storageService'
import PricingSellerHandoffPreview from '@/modules/pricing/components/PricingSellerHandoffPreview.vue'

const route = useRoute()
type WorkStatus = 'Working' | 'RequestedFromProvider'
type ModificationChange = { field: string; action: string; original: string; requested: string }
type ModificationDocument = { id: string; fileName: string; categoryLabel: string; sizeInBytes: number }
type WorkRequest = {
  workStatus?: WorkStatus | null
  workStatusUpdatedAtUtc?: string | null
  preparedRevisionNumber?: number | null
  id: string
  kind?: 'Modification' | 'New'
  rateId?: string | null
  priority?: string
  clientName?: string | null
  executiveName?: string | null
  sellerName?: string | null
  originName?: string | null
  destinationName?: string | null
  poeName?: string | null
  podName?: string | null
  payload?: {
    kind?: string
    form?: Record<string, unknown>
    requestContext?: Record<string, unknown>
    sellerContext?: Record<string, unknown>
    pickupLocations?: unknown[]
    supportDocuments?: ModificationDocument[]
    modification?: {
      sourceRevisionNumber?: number
      changes?: ModificationChange[]
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
const modificationChanges = computed(() => workRequest.value?.payload?.modification?.changes ?? [])
const modificationSnapshot = computed(() => {
  const request = workRequest.value
  const payload = request?.payload
  const context = payload?.requestContext ?? {}
  const form = payload?.form ?? {}
  return {
    form,
    context,
    sellerContext: payload?.sellerContext ?? {},
    pickupLocations: payload?.pickupLocations ?? [],
    documents: (payload?.supportDocuments ?? []).filter(file => !!file.id && !!file.fileName),
    clientName: request?.clientName || String(form.clientName || ''),
    executiveName: request?.executiveName || request?.sellerName || String(form.executiveName || ''),
    originName: String(context.originName || request?.originName || ''),
    destinationName: String(context.destinationName || request?.destinationName || ''),
    poeName: String(request?.poeName || context.poeName || context.destinationName || ''),
    podName: String(context.podName || request?.podName || ''),
    priority: request?.priority || 'Green',
  }
})
const modificationServiceLabels = computed(() => {
  const value = workRequest.value?.payload?.requestContext?.serviceNames
  return Array.isArray(value) ? value.map(String).filter(Boolean).join(', ') : ''
})
const modificationEquipmentLabel = computed(() =>
  String(workRequest.value?.payload?.requestContext?.equipmentName
    || workRequest.value?.payload?.form?.equipmentType
    || workRequest.value?.payload?.form?.shipmentMode || ''))
const modificationIncotermLabel = computed(() =>
  String(workRequest.value?.payload?.requestContext?.incotermName || ''))
async function downloadModificationDocument(file: ModificationDocument) {
  try {
    await StorageService.downloadFile({ id: file.id, fileName: file.fileName })
  } catch (cause) {
    toast.backendError(cause, 'No se pudo descargar el documento enviado por Ventas.')
  }
}
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
    await RateRequestLeaseService.completeRate(requestId.value, rateId, { confirmSellerModification: true })
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
const leaseWarning = ref('')
let heartbeatTimer: number | undefined
let currentId = ''
let generation = 0
let heartbeatInFlight = false

// Renew while the user is working. Background tabs may throttle timers; if
// our lease expired, reclaim it with the same token only when nobody else
// took the request. Keep the wizard mounted to preserve unsaved work.
async function renewLease(id: string, version: number) {
  if (heartbeatInFlight || version !== generation || currentId !== id || !ready.value) return
  heartbeatInFlight = true
  try {
    try {
      await RateRequestLeaseService.heartbeat(id)
    } catch {
      await RateRequestLeaseService.claim(id)
    }
    if (version === generation && currentId === id) leaseWarning.value = ''
  } catch {
    if (version === generation && currentId === id)
      leaseWarning.value = 'La reserva no pudo renovarse. El formulario permanece abierto. Compruebe la conexión y recupere la reserva antes de guardar.'
  } finally {
    heartbeatInFlight = false
  }
}
function renewOnFocus() {
  if (currentId && ready.value) void renewLease(currentId, generation)
}
function renewOnVisibilityChange() {
  if (document.visibilityState === 'visible') renewOnFocus()
}

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
  leaseWarning.value = ''
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
    ready.value = true
    heartbeatTimer = window.setInterval(() => { void renewLease(id, version) }, 20000)
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
  window.addEventListener('focus', renewOnFocus)
  document.addEventListener('visibilitychange', renewOnVisibilityChange)
  void begin(requestId.value)
})
watch(requestId, (next, previous) => {
  if (next === previous) return
  stop()
  void begin(next)
})
onBeforeUnmount(() => {
  window.removeEventListener('dhole:pricing:modification-prepared', onModificationPrepared)
  window.removeEventListener('focus', renewOnFocus)
  document.removeEventListener('visibilitychange', renewOnVisibilityChange)
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
    <div v-if="leaseWarning" role="alert" class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm font-semibold">
      <span>{{ leaseWarning }}</span>
      <DhButton variant="secondary" size="sm" label="Recuperar reserva" @click="renewOnFocus" />
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

    <!-- Same read-only Sales summary as an original request; show the requested
         values, never silently overwrite the existing quote on opening. -->
    <template v-if="isModification">
      <section class="mb-4 space-y-3 rounded-[26px] border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[var(--dh-card)] p-4 sm:p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-black text-[var(--dh-text)]">Qué solicitó modificar el vendedor</h2>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ workRequest?.payload?.modification?.quote || 'Cotización original' }} ·
              REV {{ workRequest?.payload?.modification?.sourceRevisionNumber || 1 }} ·
              {{ modificationChanges.length }} diferencias solicitadas
            </p>
          </div>
          <span class="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-300">Pendiente de aplicar</span>
        </div>
        <p class="text-xs text-[var(--dh-text-muted)]">Compare los valores vigentes con lo pedido por Ventas. Abrir esta solicitud no aplica cambios ni completa la tarifa.</p>
        <div v-if="modificationChanges.length" class="overflow-x-auto rounded-xl border border-[var(--dh-border)]">
          <table class="w-full min-w-[620px] text-left text-sm">
            <thead class="bg-[var(--dh-card-hover)] text-[11px] font-black uppercase text-[var(--dh-text-muted)]">
              <tr>
                <th class="p-3">Campo</th>
                <th class="p-3">Acción</th>
                <th class="p-3">Original</th>
                <th class="p-3">Solicitado por Ventas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(change, index) in modificationChanges" :key="index" class="border-t border-[var(--dh-border)]">
                <td class="p-3 font-bold">{{ change.field }}</td>
                <td class="p-3 font-semibold text-amber-600 dark:text-amber-300">{{ change.action }}</td>
                <td class="max-w-[300px] break-words p-3 text-[var(--dh-text-muted)]">{{ change.original || '—' }}</td>
                <td class="max-w-[360px] break-words p-3 font-bold text-[var(--dh-text)]">{{ change.requested || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm font-semibold text-amber-600 dark:text-amber-300">La solicitud no contiene un comparativo detallado. Revise los datos enviados por Ventas que aparecen a continuación.</p>
      </section>

      <div class="mb-4">
        <PricingSellerHandoffPreview
          :snapshot="modificationSnapshot"
          :equipment-label="modificationEquipmentLabel"
          :service-labels="modificationServiceLabels"
          :origin-label="modificationSnapshot.originName"
          :destination-label="modificationSnapshot.poeName"
          :pod-label="modificationSnapshot.podName"
          :incoterm-label="modificationIncotermLabel"
          :is-land="modificationSnapshot.form.modality === 'Land'"
          title="Información solicitada por Ventas"
          subtitle="Pantallas 1–4 de la modificación · mismos datos de la solicitud original, solo lectura"
          @download="downloadModificationDocument"
        />
      </div>
    </template>

    <!-- The existing quote wizard remains editable only after Pricing deliberately
         applies the seller's proposal; opening the work item performs no write. -->
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
