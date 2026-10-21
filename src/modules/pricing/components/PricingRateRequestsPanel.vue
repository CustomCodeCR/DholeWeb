<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Ban, CheckCircle2, Clock3, FileDown, PlayCircle, RefreshCcw } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { fetchBlobClient } from '@/core/api/fetchBlobClient'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type { SystemNotificationPush } from '@/core/realtime/notificationRealtime'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'
import { RateRequestLeaseService } from '@/modules/pricing/services/rateRequestLeaseService'
import { PricingService } from '@/core/services/pricingService'
import type { RateDto } from '@/core/interfaces/pricing'

type Priority = 'Green' | 'Yellow' | 'Red'
type CancellationReason = 'Duplicate' | 'CustomerCancelled' | 'SellerCancelled' | 'Other'
type RequestStatus = 'Open' | 'Completed' | 'Cancelled'

type ModificationItem = { action: 'Add' | 'Change' | 'Remove'; field: string; details: string }
type RequestPayload = {
  kind?: string
  modification?: { sourceRevisionNumber?: number; items?: ModificationItem[]; notes?: string }
  form?: Record<string, unknown>
  requestContext?: Record<string, unknown>
}

interface RateRequestDto {
  id: string
  priority: Priority
  kind?: 'New' | 'Modification'
  status: RequestStatus
  requestedAtUtc: string
  dueAtUtc: string
  cancelledAtUtc?: string | null
  cancelledByName?: string | null
  cancellationReason?: CancellationReason | null
  cancellationDetails?: string | null
  lockedByUserId?: string | null
  lockedByName?: string | null
  lockExpiresAtUtc?: string | null
  completedAtUtc?: string | null
  rateId?: string | null
  sellerName?: string | null
  sellerEmail?: string | null
  clientName?: string | null
  executiveName?: string | null
  shipmentMode?: string | null
  equipmentType?: string | null
  originName?: string | null
  destinationName?: string | null
  poeId?: string | null
  poeName?: string | null
  podId?: string | null
  podName?: string | null
  payload?: RequestPayload | null
}

const router = useRouter()
const authStore = useAuthStore()
const toast = useToastStore()
const pricingCatalogs = usePricingCatalogs()
const loading = ref(false)
const completingRequestId = ref<string | null>(null)
const cancellationTarget = ref<RateRequestDto | null>(null)
const cancellationReason = ref<CancellationReason>('Duplicate')
const cancellationDetails = ref('')
const cancellingRequestId = ref<string | null>(null)
const claimingRequestId = ref<string | null>(null)
const recoveryTarget = ref<RateRequestDto | null>(null)
const recoverySearch = ref('')
const recoveryRates = ref<RateDto[]>([])
const recoveryRateId = ref('')
const recoveryLoading = ref(false)
const recoverySaving = ref(false)
const exporting = ref(false)
const requests = ref<RateRequestDto[]>([])
const now = ref(Date.now())
let timer: number | undefined

const canViewAll = computed(() => authStore.hasScope('pricing.rate-request.view-all'))

const sortedRequests = computed(() => {
  // Urgentes primero. Dentro de una prioridad, FIFO por fecha de recepción.
  const order: Record<Priority, number> = { Red: 0, Yellow: 1, Green: 2 }
  return [...requests.value].sort((left, right) =>
    (left.status === 'Open' ? 0 : 1) - (right.status === 'Open' ? 0 : 1)
    || order[left.priority] - order[right.priority]
    || new Date(left.requestedAtUtc).getTime() - new Date(right.requestedAtUtc).getTime()
    || left.id.localeCompare(right.id)
  )
})

function priorityLabel(priority: Priority) {
  return priority === 'Green' ? 'Verde · Regular (48–72 h)' : priority === 'Yellow' ? 'Amarillo · Prioritario (24–48 h)' : 'Rojo · Urgente (0–24 h)'
}

function priorityVariant(priority: Priority): 'success' | 'warning' | 'danger' {
  return priority === 'Green' ? 'success' : priority === 'Yellow' ? 'warning' : 'danger'
}

function statusLabel(status: RequestStatus) {
  if (status === 'Open') return 'Pendiente'
  if (status === 'Completed') return 'Completada'
  return 'Cancelada'
}

function statusVariant(status: RequestStatus): 'primary' | 'success' | 'danger' {
  if (status === 'Completed') return 'success'
  if (status === 'Cancelled') return 'danger'
  return 'primary'
}

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} d ${hours} h ${minutes} min`
  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

function elapsed(request: RateRequestDto) {
  return formatDuration(now.value - new Date(request.requestedAtUtc).getTime())
}

function remaining(request: RateRequestDto) {
  if (request.status !== 'Open') return request.completedAtUtc ? `Completada ${new Date(request.completedAtUtc).toLocaleString('es-CR')}` : statusLabel(request.status)
  const difference = new Date(request.dueAtUtc).getTime() - now.value
  return difference >= 0
    ? `Restan ${formatDuration(difference)}`
    : `Vencida hace ${formatDuration(Math.abs(difference))}`
}

function isOverdue(request: RateRequestDto) {
  return request.status === 'Open' && new Date(request.dueAtUtc).getTime() <= now.value
}

function objectValue(request: RateRequestDto, key: string): unknown {
  const context = request.payload?.requestContext
  if (context && context[key] != null && String(context[key]).trim()) return context[key]
  const form = request.payload?.form
  return form?.[key]
}

function stringValue(request: RateRequestDto, ...keys: string[]) {
  for (const key of keys) {
    const raw = objectValue(request, key)
    const value = String(raw ?? '').trim()
    if (value) return value
  }
  return ''
}

function shipmentMode(request: RateRequestDto): string {
  return (request.shipmentMode?.trim() || stringValue(request, 'shipmentMode')).toUpperCase()
}

function isConsolidated(request: RateRequestDto): boolean {
  return ['LCL', 'LTL'].includes(shipmentMode(request))
}

function equipmentLabel(request: RateRequestDto) {
  if (isConsolidated(request)) {
    return shipmentMode(request) === 'LTL' ? 'LTL · Consolidado terrestre' : 'LCL · Consolidado'
  }
  return request.equipmentType?.trim()
    || stringValue(request, 'equipmentType', 'equipmentSize')
    || 'Sin definir'
}

function equipmentQuantity(request: RateRequestDto) {
  if (isConsolidated(request)) return '—'
  const raw = objectValue(request, 'equipmentQuantity')
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : 1
}

function modalityLabel(request: RateRequestDto) {
  return stringValue(request, 'modality') || request.shipmentMode || 'Sin definir'
}

function incotermLabel(request: RateRequestDto) {
  return stringValue(request, 'incotermName', 'incotermCode') || 'Sin definir'
}

function poeLabel(request: RateRequestDto) {
  return request.poeName?.trim()
    || stringValue(request, 'poeName')
    || request.destinationName?.trim()
    || 'POE no indicado'
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
}

function podLabel(request: RateRequestDto) {
  const directName = request.podName?.trim() || stringValue(request, 'podName')
  if (directName && !isUuidLike(directName)) return directName

  const candidateIds = [
    request.podId?.trim(),
    stringValue(request, 'podId'),
    directName && isUuidLike(directName) ? directName : '',
  ].filter((value): value is string => Boolean(value))

  for (const id of candidateIds) {
    const catalogPod = pricingCatalogs.findById(pricingCatalogs.podPorts.value, id)
    if (catalogPod?.name?.trim()) return catalogPod.name.trim()
  }

  return 'No indicado'
}

function podOptionalForAirLcl(request: RateRequestDto) {
  return request.shipmentMode?.toUpperCase() === 'LCL'
    && modalityLabel(request).trim().toUpperCase() === 'AIR'
}

function podMissing(request: RateRequestDto) {
  return request.shipmentMode?.toUpperCase() === 'LCL'
    && !podOptionalForAirLcl(request)
    && podLabel(request) === 'No indicado'
}

async function load() {
  try {
    loading.value = true
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: canViewAll.value ? '/api/pricing/rate-requests/all' : '/api/pricing/rate-requests/open',
      headers: { Accept: 'application/json' },
    })
    requests.value = unwrapListResponse<RateRequestDto>(response)
  } catch (error) {
    toast.backendError(error, canViewAll.value
      ? 'No se pudieron cargar todas las solicitudes de vendedores.'
      : 'No se pudieron cargar las solicitudes abiertas de vendedores.')
  } finally {
    loading.value = false
  }
}

async function exportRequestedRates() {
  if (!canViewAll.value || exporting.value) return
  try {
    exporting.value = true
    const blob = await fetchBlobClient('/api/pricing/rate-requests/export.xlsx', { method: 'GET' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `tarifas-solicitadas-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    toast.backendError(error, 'No se pudo descargar el reporte Excel de tarifas solicitadas.')
  } finally {
    exporting.value = false
  }
}

function isModification(request: RateRequestDto): boolean {
  return request.kind === 'Modification' || request.payload?.kind === 'Modification'
}

function modificationItems(request: RateRequestDto): ModificationItem[] {
  return request.payload?.modification?.items ?? []
}
function actionLabel(action: ModificationItem['action']) {
  return action === 'Add' ? 'Agregar' : action === 'Remove' ? 'Eliminar' : 'Modificar'
}

function isLocked(request: RateRequestDto): boolean {
  return Boolean(request.lockedByUserId && request.lockExpiresAtUtc
    && new Date(request.lockExpiresAtUtc).getTime() > now.value)
}

function isOwnLock(request: RateRequestDto): boolean {
  return isLocked(request) && Boolean(authStore.userId)
    && request.lockedByUserId?.toLowerCase() === authStore.userId?.toLowerCase()
}

async function continueRequest(request: RateRequestDto) {
  if (request.status !== 'Open') return
  if (claimingRequestId.value || (isLocked(request) && !isOwnLock(request))) return
  claimingRequestId.value = request.id
  try {
    // The resume view obtains (or safely recovers) the lease after navigation.
    // A failed navigation must never reserve a request without opening it.
    await router.push({ name: 'pricing-rate-request-resume', params: { requestId: request.id } })
  } catch (error) {
    toast.backendError(error, 'La solicitud ya está siendo atendida por otra persona.')
    await load()
  } finally {
    claimingRequestId.value = null
  }
}

async function completeRequest(request: RateRequestDto) {
  if (request.status !== 'Open' || completingRequestId.value || isLocked(request)) return
  try {
    completingRequestId.value = request.id
    await RateRequestLeaseService.claim(request.id)
    if (isModification(request) && request.rateId) {
      await RateRequestLeaseService.completeRate(request.id, request.rateId)
      toast.success('Revisión enviada', 'Se notificó al vendedor y se entregó el PDF actualizado.')
    } else {
      await RateRequestLeaseService.complete(request.id)
      toast.success('Solicitud marcada como completada.')
    }
    await load()
  } catch (error) {
    toast.backendError(error, 'No se pudo marcar la solicitud como completada.')
  } finally {
    await RateRequestLeaseService.release(request.id).catch(() => undefined)
    completingRequestId.value = null
  }
}

function openRecovery(request: RateRequestDto) {
  if (request.status !== 'Open' || isModification(request)
    || (isLocked(request) && !isOwnLock(request))) return
  recoveryTarget.value = request
  recoverySearch.value = ''
  recoveryRates.value = []
  recoveryRateId.value = ''
}

function closeRecovery() {
  if (recoverySaving.value) return
  recoveryTarget.value = null
}

async function searchExistingRates() {
  if (!recoveryTarget.value || recoveryLoading.value) return
  const search = recoverySearch.value.trim()
  if (search.length < 3) {
    toast.error('Búsqueda requerida', 'Indique al menos tres caracteres del código de la tarifa existente.')
    return
  }
  recoveryLoading.value = true
  recoveryRateId.value = ''
  recoveryRates.value = []
  try {
    const result = await PricingService.browseRates({ search, pageNumber: 1, pageSize: 20 })
    recoveryRates.value = result.items || []
    if (!recoveryRates.value.length) {
      toast.warning('Sin resultados', 'No se encontraron tarifas. Busque por el código QUO completo.')
    }
  } catch (error) {
    toast.backendError(error, 'No se pudieron consultar las tarifas existentes.')
  } finally {
    recoveryLoading.value = false
  }
}

function normalizeClient(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

async function confirmRecovery() {
  const request = recoveryTarget.value
  const rate = recoveryRates.value.find(candidate => candidate.id === recoveryRateId.value)
  if (!request || !rate || recoverySaving.value) return
  if (normalizeClient(request.clientName) && normalizeClient(rate.clientName)
    && normalizeClient(request.clientName) !== normalizeClient(rate.clientName)) {
    toast.error('Cliente diferente', 'La tarifa seleccionada pertenece a otro cliente. No se vinculó la solicitud.')
    return
  }

  recoverySaving.value = true
  try {
    await RateRequestLeaseService.claim(request.id, { recoverOwnLease: isOwnLock(request) })
    // complete-rate both associates an approved quote and delivers its PDF.
    // Pending-approval quotes are linked and finalized automatically when approved.
    await RateRequestLeaseService.completeRate(request.id, rate.id)
    recoveryTarget.value = null
    toast.success('Solicitud vinculada', 'Se recuperó la tarifa existente sin crear una cotización duplicada.')
    await load()
  } catch (error) {
    toast.backendError(error, 'No se pudo vincular la tarifa existente. La solicitud no se completó.')
    await load()
  } finally {
    await RateRequestLeaseService.release(request.id).catch(() => undefined)
    recoverySaving.value = false
  }
}

const cancellationReasons: { value: CancellationReason; label: string }[] = [
  { value: 'Duplicate', label: 'Solicitud duplicada' },
  { value: 'CustomerCancelled', label: 'Cancelada por el cliente' },
  { value: 'SellerCancelled', label: 'Cancelada por Ventas' },
  { value: 'Other', label: 'Otro motivo' },
]

function cancellationReasonLabel(reason?: CancellationReason | null) {
  return cancellationReasons.find((item) => item.value === reason)?.label ?? 'Sin motivo'
}

function openCancellation(request: RateRequestDto) {
  if (request.status !== 'Open' || isLocked(request)
    || claimingRequestId.value || completingRequestId.value || cancellingRequestId.value) return
  cancellationTarget.value = request
  cancellationReason.value = 'Duplicate'
  cancellationDetails.value = ''
}

function closeCancellation() {
  if (cancellingRequestId.value) return
  cancellationTarget.value = null
}

async function confirmCancellation() {
  const request = cancellationTarget.value
  if (!request || request.status !== 'Open' || cancellingRequestId.value || isLocked(request)) return
  const details = cancellationDetails.value.trim()
  if (cancellationReason.value === 'Other' && !details) {
    toast.error('Detalle requerido', 'Describa por qué se está cancelando la solicitud.')
    return
  }

  cancellingRequestId.value = request.id
  try {
    // The same exclusive lease used to continue a request prevents cancellation
    // while another pricing operator is preparing the quote.
    await RateRequestLeaseService.claim(request.id)
    await RateRequestLeaseService.cancel(request.id, { reason: cancellationReason.value, details })
    cancellationTarget.value = null
    toast.success('Solicitud cancelada', 'Se conservó en el historial con su motivo de cancelación.')
    await load()
  } catch (error) {
    toast.backendError(error, 'No se pudo cancelar la solicitud. Compruebe si está siendo atendida.')
    await load()
  } finally {
    await RateRequestLeaseService.release(request.id).catch(() => undefined)
    cancellingRequestId.value = null
  }
}

function handleRealtimeNotification(event: Event) {
  const notification = (event as CustomEvent<SystemNotificationPush>).detail
  if (!['pricing.rate-request.created', 'pricing.rate-request.sla-overdue'].includes(notification?.notificationType ?? '')) return

  now.value = Date.now()
  void load()
}

onMounted(async () => {
  await Promise.all([
    pricingCatalogs.loadAll().catch(() => undefined),
    load(),
  ])
  window.addEventListener('dhole:notification:received', handleRealtimeNotification)
  timer = window.setInterval(() => {
    now.value = Date.now()
    if (!loading.value) void load()
  }, 15000)
})

onBeforeUnmount(() => {
  window.removeEventListener('dhole:notification:received', handleRealtimeNotification)
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <section class="dh-glass dh-liquid rounded-[32px] p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <Clock3 class="h-5 w-5 text-[var(--dh-primary)]" />
          <h2 class="text-lg font-black">{{ canViewAll ? 'Todas las tarifas solicitadas' : 'Solicitudes de tarifas de vendedores' }}</h2>
        </div>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          {{ canViewAll
            ? 'Vista global habilitada por el scope pricing.rate-request.view-all.'
            : 'Pricing ve POL, POE y POD definidos por Ventas antes de continuar la tarifa.' }}
        </p>
        <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">Orden de atención: <span class="text-red-500">Rojo · Urgente (0–24 h)</span> → <span class="text-amber-500">Amarillo · Prioritario (24–48 h)</span> → <span class="text-emerald-500">Verde · Regular (48–72 h)</span>. Primero las solicitudes más antiguas de cada prioridad.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <DhButton v-if="canViewAll" variant="secondary" :disabled="exporting" @click="exportRequestedRates">
          <FileDown class="h-4 w-4" /> {{ exporting ? 'Generando…' : 'Exportar Excel' }}
        </DhButton>
        <DhButton variant="secondary" :disabled="loading" @click="load">
          <RefreshCcw class="h-4 w-4" /> Actualizar
        </DhButton>
      </div>
    </div>

    <div v-if="loading && !requests.length" class="py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
      Cargando solicitudes…
    </div>
    <div v-else-if="!sortedRequests.length" class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
      No hay solicitudes para mostrar.
    </div>
    <div v-else class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)]">
      <table class="min-w-[2150px] w-full text-left text-sm">
        <thead class="bg-[var(--dh-card-hover)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
          <tr>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Vendedor</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Embarque / equipo</th>
            <th class="px-4 py-3">Cant. equipos</th>
            <th class="px-4 py-3">Modalidad</th>
            <th class="px-4 py-3">POL</th>
            <th class="px-4 py-3">POE</th>
            <th class="px-4 py-3">POD</th>
            <th class="px-4 py-3">Prioridad</th>
            <th class="px-4 py-3">Atendida por</th>
            <th class="px-4 py-3">Incoterm</th>
            <th class="px-4 py-3">Tiempo</th>
            <th class="px-4 py-3">Límite</th>
            <th class="px-4 py-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in sortedRequests" :key="request.id" class="border-t border-[var(--dh-border)]" :class="request.priority === 'Red' ? 'bg-red-500/10' : request.priority === 'Yellow' ? 'bg-amber-500/10' : 'bg-emerald-500/5'">
            <td class="px-4 py-3">
              <DhBadge :label="statusLabel(request.status)" :variant="statusVariant(request.status)" />
              <div v-if="request.status === 'Cancelled'" class="mt-1 max-w-64 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ cancellationReasonLabel(request.cancellationReason) }}
                <p v-if="request.cancellationDetails" class="mt-1 whitespace-normal">{{ request.cancellationDetails }}</p>
                <p v-if="request.cancelledByName">Por: {{ request.cancelledByName }}</p>
              </div>
            </td>
            <td class="px-4 py-3"><strong>{{ request.executiveName || request.sellerName || 'Vendedor' }}</strong></td>
            <td class="px-4 py-3">
              <strong>{{ request.clientName || 'Cliente sin definir' }}</strong>
              <div v-if="isModification(request)" class="mt-1 text-xs">
                <DhBadge :label="`Modificación de REV ${request.payload?.modification?.sourceRevisionNumber || 1}`" variant="warning" />
                <div v-for="(item, index) in modificationItems(request).slice(0, 3)" :key="index" class="mt-1 max-w-72 whitespace-normal text-[var(--dh-text-muted)]">
                  {{ actionLabel(item.action) }} · {{ item.field }}: {{ item.details }}
                </div>
                <p v-if="modificationItems(request).length > 3" class="mt-1">+ {{ modificationItems(request).length - 3 }} cambios</p>
              </div>
            </td>
            <td class="px-4 py-3"><strong>{{ equipmentLabel(request) }}</strong></td>
            <td class="px-4 py-3 font-black">{{ equipmentQuantity(request) }}</td>
            <td class="px-4 py-3 font-bold">{{ modalityLabel(request) }}</td>
            <td class="px-4 py-3 font-bold">{{ request.originName || 'Origen no indicado' }}</td>
            <td class="px-4 py-3 font-bold">{{ poeLabel(request) }}</td>
            <td class="px-4 py-3">
              <DhBadge v-if="!podMissing(request)" :label="podOptionalForAirLcl(request) && podLabel(request) === 'No indicado' ? 'POD opcional' : podLabel(request)" :variant="podOptionalForAirLcl(request) && podLabel(request) === 'No indicado' ? 'neutral' : 'primary'" />
              <DhBadge v-else label="POD no indicado" variant="danger" />
            </td>
            <td class="border-l-4 px-4 py-3" :class="request.priority === 'Red' ? 'border-red-500' : request.priority === 'Yellow' ? 'border-amber-500' : 'border-emerald-500'"><DhBadge :label="priorityLabel(request.priority)" :variant="priorityVariant(request.priority)" /></td>
            <td class="px-4 py-3">
              <span v-if="isLocked(request)" class="font-bold text-amber-600 dark:text-amber-300">
                {{ request.lockedByName || 'Otro usuario' }}
                <span class="block text-xs font-medium">{{ isOwnLock(request) ? 'Reservada por usted · Puede retomarla' : 'En proceso · Bloqueada' }}</span>
              </span>
              <span v-else class="font-semibold text-emerald-600 dark:text-emerald-400">Disponible</span>
            </td>
            <td class="px-4 py-3 font-bold">{{ incotermLabel(request) }}</td>
            <td class="px-4 py-3"><strong>{{ elapsed(request) }}</strong><p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Recibida: {{ new Date(request.requestedAtUtc).toLocaleString('es-CR') }}</p></td>
            <td class="px-4 py-3">
              <strong :class="isOverdue(request) ? 'text-red-600 dark:text-red-300' : 'text-[var(--dh-text)]'">{{ remaining(request) }}</strong>
              <p v-if="request.status === 'Open'" class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ new Date(request.dueAtUtc).toLocaleString('es-CR') }}</p>
            </td>
            <td class="px-4 py-3 text-right">
              <div v-if="request.status === 'Open'" class="flex items-center justify-end gap-2">
                <DhButton :disabled="(isLocked(request) && !isOwnLock(request)) || Boolean(claimingRequestId) || Boolean(cancellingRequestId)" @click="continueRequest(request)">
                  <PlayCircle class="h-4 w-4" />
                  {{ claimingRequestId === request.id ? 'Abriendo…' : isOwnLock(request) ? 'Retomar mi trabajo' : isLocked(request) ? 'En proceso' : isModification(request) ? 'Revisar cambios' : 'Continuar tarifa' }}
                </DhButton>
                <DhButton v-if="!isModification(request) && !request.rateId" variant="secondary"
                  :disabled="(isLocked(request) && !isOwnLock(request)) || Boolean(completingRequestId) || Boolean(claimingRequestId) || Boolean(cancellingRequestId)"
                  @click="openRecovery(request)">
                  Vincular existente
                </DhButton>
                <DhButton variant="secondary" :disabled="isLocked(request) || Boolean(completingRequestId) || Boolean(claimingRequestId) || Boolean(cancellingRequestId)" @click="completeRequest(request)">
                  <CheckCircle2 class="h-4 w-4" /> {{ completingRequestId === request.id ? 'Completando…' : isModification(request) ? 'Enviar revisión' : 'Marcar completada' }}
                </DhButton>
                <DhButton
                  variant="secondary"
                  class="!text-red-600 dark:!text-red-400"
                  :disabled="isLocked(request) || Boolean(claimingRequestId) || Boolean(completingRequestId) || Boolean(cancellingRequestId)"
                  @click="openCancellation(request)"
                >
                  <Ban class="h-4 w-4" /> Cancelar
                </DhButton>
              </div>
              <span v-else class="text-xs font-bold text-[var(--dh-text-muted)]">Sin acción pendiente</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Teleport to="body">
      <div
        v-if="cancellationTarget"
        data-dh-overlay="modal"
        class="fixed inset-0 z-[150] flex items-center justify-center bg-black/65 p-2 sm:p-4"
        @click.self="closeCancellation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-rate-request-title"
          class="dh-glass dh-liquid flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-[var(--dh-border)] shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
        >
          <div class="dh-scrollbar min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <div class="flex items-center gap-3">
              <Ban class="h-6 w-6 text-red-500" />
              <h3 id="cancel-rate-request-title" class="text-xl font-black">Cancelar solicitud de tarifa</h3>
            </div>
            <p class="mt-3 text-sm font-semibold text-[var(--dh-text-muted)]">
              {{ cancellationTarget.clientName || 'Cliente sin definir' }} ·
              {{ cancellationTarget.originName || 'Origen' }} →
              {{ cancellationTarget.podName || cancellationTarget.destinationName || 'Destino' }}
            </p>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">
              La solicitud dejará de estar pendiente. No se eliminará ninguna cotización ya generada.
            </p>
            <label for="rate-request-cancel-reason" class="mt-5 block text-sm font-bold">
              Motivo de cancelación <span class="text-red-500">*</span>
            </label>
            <select id="rate-request-cancel-reason" v-model="cancellationReason"
              :disabled="Boolean(cancellingRequestId)"
              class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-sm font-semibold text-[var(--dh-text)]">
              <option v-for="reason in cancellationReasons" :key="reason.value" :value="reason.value">{{ reason.label }}</option>
            </select>
            <label for="rate-request-cancel-details" class="mt-4 block text-sm font-bold">
              Observación {{ cancellationReason === 'Other' ? '(obligatoria)' : '(opcional)' }}
            </label>
            <textarea id="rate-request-cancel-details" v-model="cancellationDetails"
              :disabled="Boolean(cancellingRequestId)" maxlength="500" rows="3"
              placeholder="Indique más información para el historial…"
              class="mt-2 w-full resize-y rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-sm text-[var(--dh-text)]"
            />
            <div class="mt-6 flex flex-wrap justify-end gap-2">
              <DhButton variant="secondary" :disabled="Boolean(cancellingRequestId)" @click="closeCancellation">Volver</DhButton>
              <DhButton
                class="!bg-red-600 !text-white hover:!bg-red-700"
                :disabled="Boolean(cancellingRequestId) || (cancellationReason === 'Other' && !cancellationDetails.trim())"
                @click="confirmCancellation"
              >
                <Ban class="h-4 w-4" /> {{ cancellingRequestId ? 'Cancelando…' : 'Confirmar cancelación' }}
              </DhButton>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="recoveryTarget" data-dh-overlay="modal"
        class="fixed inset-0 z-[150] flex items-center justify-center bg-black/65 p-2 sm:p-4"
        @click.self="closeRecovery">
        <div role="dialog" aria-modal="true" aria-labelledby="recover-rate-request-title"
          class="dh-glass dh-liquid flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-[var(--dh-border)] shadow-2xl">
          <div class="dh-scrollbar min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <h3 id="recover-rate-request-title" class="text-xl font-black">Vincular una tarifa ya creada</h3>
            <p class="text-sm text-[var(--dh-text-muted)]">
              Solicitud de <strong>{{ recoveryTarget.clientName }}</strong>.
              Busque la tarifa existente por su código QUO y verifique el cliente y la ruta antes de vincularla.
              No se creará una segunda cotización.
            </p>
            <div class="flex gap-2">
              <input v-model="recoverySearch" type="search" placeholder="Ej. QUO-00000-000319"
                class="min-w-0 flex-1 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-sm text-[var(--dh-text)]"
                :disabled="recoveryLoading || recoverySaving" @keydown.enter.prevent="searchExistingRates" />
              <DhButton :disabled="recoveryLoading || recoverySaving" @click="searchExistingRates">
                {{ recoveryLoading ? 'Buscando…' : 'Buscar' }}
              </DhButton>
            </div>
            <div v-if="recoveryRates.length" class="max-h-64 space-y-2 overflow-y-auto">
              <label v-for="rate in recoveryRates" :key="rate.id"
                class="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--dh-border)] p-3 text-sm">
                <input v-model="recoveryRateId" type="radio" :value="rate.id" name="recovery-rate"
                  :disabled="recoverySaving" class="mt-1" />
                <span class="min-w-0">
                  <strong class="block">{{ rate.quoNumber || rate.rateCode }}</strong>
                  <span class="block">{{ rate.clientName || 'Cliente sin definir' }}</span>
                  <span class="block text-xs text-[var(--dh-text-muted)]">
                    {{ rate.status }} · {{ rate.originName || rate.polName || 'Origen' }} →
                    {{ rate.poeName || rate.destinationName || 'Destino' }}
                  </span>
                </span>
              </label>
            </div>
            <div class="flex flex-wrap justify-end gap-2">
              <DhButton variant="secondary" :disabled="recoverySaving" @click="closeRecovery">Cancelar</DhButton>
              <DhButton :disabled="!recoveryRateId || recoverySaving || recoveryLoading" @click="confirmRecovery">
                {{ recoverySaving ? 'Vinculando…' : 'Confirmar vinculación' }}
              </DhButton>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
