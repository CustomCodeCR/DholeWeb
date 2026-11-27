<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { useToastStore } from '@/core/stores/toastStore'
import PricingAlternativeWizardCrystal from '@/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
import { PricingService } from '@/core/services/pricingService'
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
    sellerRouteOriginal?: { polName?: string; poeName?: string; podName?: string }
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
const workStatusSaving = ref(false)
const savedRevisionAvailable = ref<number | null>(null)
// Only compare with the persisted source revision, never an already-updated QUO.
const originalRateHeader = ref<{ modality: string; shipmentMode: string } | null>(null)
const recoveringSavedRevision = ref(false)
const isModification = computed(() =>
  workRequest.value?.kind === 'Modification' || workRequest.value?.payload?.kind === 'Modification'
)
function normalizedHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function headerLabel(key: 'modality' | 'shipmentMode', value: string): string {
  if (key === 'shipmentMode') return value.toUpperCase()
  return ({
    maritime: 'Marítimo', air: 'Aéreo', land: 'Terrestre', multimodal: 'Multimodal',
  } as Record<string, string>)[normalizedHeader(value)] ?? value
}

const modificationChanges = computed<ModificationChange[]>(() => {
  const changes = workRequest.value?.payload?.modification?.changes ?? []
  // Blank historical LCL header fields are not valid deletion instructions.
  const mandatoryHeaders = new Set(['modalidad', 'tipo de embarque', 'tipo de equipo', 'vigencia'])
  const visible = changes.filter(change => !(normalizedHeader(change.action) === 'eliminar'
    && mandatoryHeaders.has(normalizedHeader(change.field))))

  // Older requests may omit transport-header differences from the comparison.
  // Backfill ONLY when the original persisted revision can be verified.
  const original = originalRateHeader.value
  const requested = workRequest.value?.payload?.form
  if (!original || !requested) return visible
  const headerFields = [
    { field: 'Modalidad', key: 'modality' as const },
    { field: 'Tipo de embarque', key: 'shipmentMode' as const },
  ]
  const missing = headerFields.flatMap(({ field, key }) => {
    const before = original[key]
    const after = String(requested[key] ?? '').trim()
    if (!before || !after || normalizedHeader(before) === normalizedHeader(after)
      || visible.some(change => normalizedHeader(change.field) === normalizedHeader(field))) return []
    return [{
      field, action: 'Modificar',
      original: headerLabel(key, before), requested: headerLabel(key, after),
    }]
  })
  return [...missing, ...visible]
})
const modificationSnapshot = computed(() => {
  const request = workRequest.value
  const payload = request?.payload
  const context = payload?.requestContext ?? {}
  const originalRoute = payload?.sellerRouteOriginal
  const form = payload?.form ?? {}
  return {
    form,
    context,
    sellerContext: payload?.sellerContext ?? {},
    pickupLocations: payload?.pickupLocations ?? [],
    documents: (payload?.supportDocuments ?? []).filter(file => !!file.id && !!file.fileName),
    clientName: request?.clientName || String(form.clientName || ''),
    executiveName: request?.executiveName || request?.sellerName || String(form.executiveName || ''),
    originName: String(originalRoute?.polName || context.originName || request?.originName || ''),
    destinationName: String(originalRoute?.poeName || context.destinationName || request?.destinationName || ''),
    poeName: String(originalRoute?.poeName || context.poeName || request?.poeName || context.destinationName || ''),
    podName: String(originalRoute?.podName || context.podName || request?.podName || ''),
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
const requestId = computed(() => String(route.params.requestId ?? ''))
const ready = ref(false)
const checking = ref(false)
const error = ref('')
const ownerName = ref('')
const leaseWarning = ref('')
let heartbeatTimer: number | undefined
let currentId = ''
let generation = 0
let heartbeatInFlight: Promise<void> | null = null
let beginInFlight: Promise<void> | null = null
let pendingRequestId = ''
let stopInFlight: Promise<void> | null = null

// Renew while the user is working. Background tabs may throttle timers; if
// our lease expired, reclaim it with the same token only when nobody else
// took the request. Keep the wizard mounted to preserve unsaved work.
async function renewLease(id: string, version: number) {
  if (heartbeatInFlight || version !== generation || currentId !== id || !ready.value) return
  // A failed heartbeat NEVER triggers an automatic claim. Re-claiming a
  // released request was the cause of phantom locks on the Pricing dashboard.
  const renewal = (async () => {
    try {
      await RateRequestLeaseService.heartbeat(id)
      if (version === generation && currentId === id) leaseWarning.value = ''
    } catch {
      if (version === generation && currentId === id)
        leaseWarning.value = 'La reserva ya no está vigente o falló la conexión. Recupérela manualmente antes de guardar.'
    }
  })()
  heartbeatInFlight = renewal
  try {
    await renewal
  } finally {
    if (heartbeatInFlight === renewal) heartbeatInFlight = null
  }
}
async function recoverLease() {
  const id = currentId
  const version = generation
  if (!id || !ready.value) return
  try {
    await RateRequestLeaseService.claim(id, { recoverOwnLease: true })
    if (version !== generation || currentId !== id) {
      await RateRequestLeaseService.release(id)
      return
    }
    leaseWarning.value = ''
  } catch (cause) {
    toast.backendError(cause, 'No se pudo recuperar la reserva. Otra persona podría estar atendiendo la solicitud.')
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

async function inspectSavedRevision(id: string, version: number) {
  const request = workRequest.value
  if (!request?.rateId || !isModification.value) return
  try {
    const rate = await PricingService.getRate(request.rateId)
    if (version !== generation || id !== currentId) return
    const original = Number(request.payload?.modification?.sourceRevisionNumber || 0)
    savedRevisionAvailable.value = rate.revisionNumber > original ? rate.revisionNumber : null
    const explicitModality = String(rate['transportModality'] ?? rate['modality'] ?? '').trim()
    // Shipment alone cannot distinguish Maritime/Multimodal or Air LCL.
    // Only derive Land for FTL/LTL; otherwise rely on stored metadata.
    const verifiedModality = explicitModality ||
      (['Ftl', 'Ltl'].includes(rate.shipmentMode) ? 'Land' : '')
    originalRateHeader.value = rate.revisionNumber === original
      ? { modality: verifiedModality, shipmentMode: String(rate.shipmentMode) }
      : null
  } catch {
    if (version === generation) savedRevisionAvailable.value = null
  }
}

async function sendAlreadySavedRevision() {
  const id = requestId.value
  const rateId = workRequest.value?.rateId
  const revisionNumber = savedRevisionAvailable.value
  if (!rateId || !revisionNumber || recoveringSavedRevision.value || !ready.value) return

  recoveringSavedRevision.value = true
  try {
    // Explicit recovery only: compare the existing quote with the seller's
    // requested changes before confirming. Never create another revision.
    const rate = await PricingService.getRate(rateId)
    if (rate.revisionNumber !== revisionNumber) {
      throw new Error('La QUO cambió de revisión. Vuelva a revisar los datos antes de enviar.')
    }
    await RateRequestLeaseService.prepareModification(id, rateId, revisionNumber)
    const result = await RateRequestLeaseService.completeRate(
      id, rateId, { confirmSellerModification: true },
    )
    if (result?.status === 'CompletedDeliveryRetryPending') {
      toast.warning('Solicitud completada; entrega pendiente', 'Pricing reintentará el envío del PDF sin crear otra revisión.')
    } else {
      toast.success('Modificación completada', 'La solicitud se eliminó de las pendientes; la revisión y el historial se conservan.')
    }
    await router.replace({ name: 'pricing-rate-wizard', params: { rateId }, query: { mode: 'view' } })
  } catch (cause) {
    toast.backendError(cause, 'No se pudo completar la modificación. La QUO no se guardó nuevamente.')
  } finally {
    recoveringSavedRevision.value = false
  }
}

async function begin(id: string) {
  const version = ++generation
  ready.value = false
  checking.value = true
  error.value = ''
  leaseWarning.value = ''
  savedRevisionAvailable.value = null
  let stage: 'claim' | 'load' = 'claim'
  try {
    const lease = await RateRequestLeaseService.claim(id, { recoverOwnLease: true })
    if (version !== generation) {
      await RateRequestLeaseService.release(id).catch(() => undefined)
      return
    }
    currentId = id
    stage = 'load'
    const response = await callEndpoint<unknown>({
      method: 'GET', path: `/api/pricing/rate-requests/${encodeURIComponent(id)}`,
      headers: { Accept: 'application/json' },
    })
    // The user may have closed the workspace tab while the GET was pending.
    if (version !== generation) {
      await RateRequestLeaseService.release(id).catch(() => undefined)
      return
    }
    workRequest.value = unwrapApiResponse<WorkRequest>(response as never)
    ownerName.value = lease.ownerName
    ready.value = true
    void inspectSavedRevision(id, version)
    heartbeatTimer = window.setInterval(() => { void renewLease(id, version) }, 20000)
  } catch (cause) {
    if (version !== generation) return
    if (currentId === id) {
      await RateRequestLeaseService.release(id).catch(() => undefined)
      currentId = ''
    }
    const failure = cause as {
      message?: string
      status?: number
      data?: { traceId?: string; code?: string }
    }
    const title = stage === 'claim'
      ? 'No se pudo reservar la solicitud'
      : 'La reserva se obtuvo, pero no se pudieron cargar los datos'
    const status = failure.status ? ` (HTTP ${failure.status})` : ''
    const generic = !failure.message || /an unexpected error occurred|error interno del servidor/i.test(failure.message)
    const detail = generic
      ? 'El servidor devolvió un error. Intente nuevamente o comunique el código de seguimiento a soporte.'
      : failure.message
    const reference = failure.data?.traceId ? ` Referencia: ${failure.data.traceId}.` : ''
    error.value = `${title}${status}. ${detail}${reference}`
  } finally {
    if (version === generation) checking.value = false
  }
}

async function stop() {
  if (stopInFlight) return stopInFlight
  ++generation
  if (heartbeatTimer) window.clearInterval(heartbeatTimer)
  heartbeatTimer = undefined
  ready.value = false
  workRequest.value = null
  savedRevisionAvailable.value = null
  originalRateHeader.value = null
  const id = currentId || pendingRequestId
  currentId = ''
  // Wait for any in-flight claim/heartbeat before releasing. Releasing first
  // allows a stale retry to re-claim the request after the user closes it.
  const pendingClaim = beginInFlight
  const pendingHeartbeat = heartbeatInFlight
  const cleanup = (async () => {
    await Promise.all([
      pendingClaim?.catch(() => undefined),
      pendingHeartbeat?.catch(() => undefined),
    ])
    if (id) await RateRequestLeaseService.release(id)
  })()
  stopInFlight = cleanup
  try {
    await cleanup
  } finally {
    if (stopInFlight === cleanup) stopInFlight = null
  }
}

function start(id: string) {
  if (beginInFlight || stopInFlight) return
  pendingRequestId = id
  const operation = begin(id)
  beginInFlight = operation
  void operation.finally(() => {
    if (beginInFlight === operation) {
      beginInFlight = null
      pendingRequestId = ''
    }
  })
}

onMounted(() => {
  window.addEventListener('focus', renewOnFocus)
  document.addEventListener('visibilitychange', renewOnVisibilityChange)
  start(requestId.value)
})
// Await unlock before moving to another workspace tab.
onBeforeRouteLeave(async () => {
  try {
    await stop()
  } catch (cause) {
    toast.backendError(cause, 'No se pudo liberar la solicitud. Intente nuevamente.')
    return false
  }
})
watch(requestId, async (next, previous) => {
  if (next === previous) return
  try {
    await stop()
    start(next)
  } catch (cause) {
    toast.backendError(cause, 'No se pudo liberar la solicitud anterior.')
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', renewOnFocus)
  document.removeEventListener('visibilitychange', renewOnVisibilityChange)
  void stop().catch(() => undefined)
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
      <DhButton @click="start(requestId)">Reintentar</DhButton>
      <DhButton variant="secondary" @click="router.push('/home')">Volver al dashboard</DhButton>
    </div>
  </section>
  <div v-else>
    <div class="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold">
      Solicitud reservada para {{ ownerName }}. Nadie más puede trabajar esta solicitud mientras esté activa.
    </div>
    <div v-if="leaseWarning" role="alert" class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm font-semibold">
      <span>{{ leaseWarning }}</span>
      <DhButton variant="secondary" size="sm" label="Recuperar reserva" @click="recoverLease" />
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
          <span class="rounded-full border border-amber-500/40 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-300">Solicitud de modificación</span>
        </div>
        <p class="text-xs text-[var(--dh-text-muted)]">Compare los valores vigentes con lo pedido por Ventas. El wizard carga los cambios en un borrador; la tarifa original no cambia hasta guardar la revisión.</p>
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
          Compare los cambios en el wizard y guarde la nueva revisión. La solicitud se completará automáticamente;
          el PDF se enviará al vendedor ahora o al aprobar el margen, según corresponda.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <DhButton label="Volver al dashboard" variant="secondary" @click="router.push('/home')" />
      </div>
    </section>

    <section v-if="isModification && savedRevisionAvailable && workRequest?.rateId"
      class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-black">Revisión {{ savedRevisionAvailable }} ya guardada · solicitud pendiente</p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Compruebe que esa revisión contiene los cambios solicitados por Ventas.
          Si ya pulsó Enviar anteriormente, confirme aquí el envío sin volver a modificar ni duplicar la QUO.
        </p>
      </div>
      <DhButton :disabled="recoveringSavedRevision" @click="sendAlreadySavedRevision">
        {{ recoveringSavedRevision ? 'Completando…' : 'Enviar revisión ya guardada' }}
      </DhButton>
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
