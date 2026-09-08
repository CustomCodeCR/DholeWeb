<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Clock3, FileDown, PlayCircle, RefreshCcw } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { fetchBlobClient } from '@/core/api/fetchBlobClient'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type { SystemNotificationPush } from '@/core/realtime/notificationRealtime'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'

type Priority = 'Green' | 'Yellow' | 'Red'
type RequestStatus = 'Open' | 'Completed' | 'Cancelled'

type RequestPayload = {
  form?: Record<string, unknown>
  requestContext?: Record<string, unknown>
}

interface RateRequestDto {
  id: string
  priority: Priority
  status: RequestStatus
  requestedAtUtc: string
  dueAtUtc: string
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
const exporting = ref(false)
const requests = ref<RateRequestDto[]>([])
const now = ref(Date.now())
let timer: number | undefined

const canViewAll = computed(() => authStore.hasScope('pricing.rate-request.view-all'))

const sortedRequests = computed(() => {
  const order: Record<Priority, number> = { Green: 0, Yellow: 1, Red: 2 }
  return [...requests.value].sort((left, right) =>
    (left.status === 'Open' ? 0 : 1) - (right.status === 'Open' ? 0 : 1)
    || order[left.priority] - order[right.priority]
    || new Date(left.dueAtUtc).getTime() - new Date(right.dueAtUtc).getTime()
  )
})

function priorityLabel(priority: Priority) {
  return priority === 'Green' ? 'Verde · 24 h' : priority === 'Yellow' ? 'Amarillo · 48 h' : 'Rojo · 72 h'
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

function equipmentLabel(request: RateRequestDto) {
  return request.equipmentType?.trim()
    || stringValue(request, 'equipmentType', 'equipmentSize')
    || (request.shipmentMode?.toUpperCase() === 'LCL' ? 'LCL' : 'Sin definir')
}

function equipmentQuantity(request: RateRequestDto) {
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

function podMissing(request: RateRequestDto) {
  return request.shipmentMode?.toUpperCase() === 'LCL' && podLabel(request) === 'No indicado'
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

function continueRequest(request: RateRequestDto) {
  if (request.status !== 'Open') return
  router.push({ name: 'pricing-rate-request-resume', params: { requestId: request.id } })
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
  timer = window.setInterval(() => { now.value = Date.now() }, 30000)
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
            <th class="px-4 py-3">Contenedor</th>
            <th class="px-4 py-3">Cantidad</th>
            <th class="px-4 py-3">Modalidad</th>
            <th class="px-4 py-3">POL</th>
            <th class="px-4 py-3">POE</th>
            <th class="px-4 py-3">POD</th>
            <th class="px-4 py-3">Tipo</th>
            <th class="px-4 py-3">Incoterm</th>
            <th class="px-4 py-3">Tiempo</th>
            <th class="px-4 py-3">Límite</th>
            <th class="px-4 py-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in sortedRequests" :key="request.id" class="border-t border-[var(--dh-border)]">
            <td class="px-4 py-3"><DhBadge :label="statusLabel(request.status)" :variant="statusVariant(request.status)" /></td>
            <td class="px-4 py-3"><strong>{{ request.executiveName || request.sellerName || 'Vendedor' }}</strong></td>
            <td class="px-4 py-3"><strong>{{ request.clientName || 'Cliente sin definir' }}</strong></td>
            <td class="px-4 py-3"><strong>{{ equipmentLabel(request) }}</strong></td>
            <td class="px-4 py-3 font-black">{{ equipmentQuantity(request) }}</td>
            <td class="px-4 py-3 font-bold">{{ modalityLabel(request) }}</td>
            <td class="px-4 py-3 font-bold">{{ request.originName || 'Origen no indicado' }}</td>
            <td class="px-4 py-3 font-bold">{{ poeLabel(request) }}</td>
            <td class="px-4 py-3">
              <DhBadge v-if="!podMissing(request)" :label="podLabel(request)" variant="primary" />
              <DhBadge v-else label="POD no indicado" variant="danger" />
            </td>
            <td class="px-4 py-3"><DhBadge :label="priorityLabel(request.priority)" :variant="priorityVariant(request.priority)" /></td>
            <td class="px-4 py-3 font-bold">{{ incotermLabel(request) }}</td>
            <td class="px-4 py-3"><strong>{{ elapsed(request) }}</strong></td>
            <td class="px-4 py-3">
              <strong :class="isOverdue(request) ? 'text-red-600 dark:text-red-300' : 'text-[var(--dh-text)]'">{{ remaining(request) }}</strong>
              <p v-if="request.status === 'Open'" class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ new Date(request.dueAtUtc).toLocaleString('es-CR') }}</p>
            </td>
            <td class="px-4 py-3 text-right">
              <DhButton v-if="request.status === 'Open'" @click="continueRequest(request)"><PlayCircle class="h-4 w-4" /> Continuar tarifa</DhButton>
              <span v-else class="text-xs font-bold text-[var(--dh-text-muted)]">Sin acción pendiente</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
