<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Clock3, PlayCircle, RefreshCcw } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type { SystemNotificationPush } from '@/core/realtime/notificationRealtime'
import { useToastStore } from '@/core/stores/toastStore'

type Priority = 'Green' | 'Yellow' | 'Red'

type RequestPayload = {
  form?: Record<string, unknown>
  requestContext?: Record<string, unknown>
}

interface RateRequestDto {
  id: string
  priority: Priority
  status: 'Open' | 'Completed' | 'Cancelled'
  requestedAtUtc: string
  dueAtUtc: string
  rateId?: string | null
  sellerName?: string | null
  clientName?: string | null
  executiveName?: string | null
  shipmentMode?: string | null
  equipmentType?: string | null
  originName?: string | null
  destinationName?: string | null
  payload?: RequestPayload | null
}

const router = useRouter()
const toast = useToastStore()
const loading = ref(false)
const requests = ref<RateRequestDto[]>([])
const now = ref(Date.now())
let timer: number | undefined

const sortedRequests = computed(() => {
  const order: Record<Priority, number> = { Green: 0, Yellow: 1, Red: 2 }
  return [...requests.value].sort((left, right) =>
    order[left.priority] - order[right.priority]
    || new Date(left.dueAtUtc).getTime() - new Date(right.dueAtUtc).getTime()
  )
})

function priorityLabel(priority: Priority) {
  return priority === 'Green' ? 'Verde · 24 h' : priority === 'Yellow' ? 'Amarillo · 48 h' : 'Rojo · 72 h'
}

function priorityVariant(priority: Priority): 'success' | 'warning' | 'danger' {
  return priority === 'Green' ? 'success' : priority === 'Yellow' ? 'warning' : 'danger'
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
  const difference = new Date(request.dueAtUtc).getTime() - now.value
  return difference >= 0
    ? `Restan ${formatDuration(difference)}`
    : `Vencida hace ${formatDuration(Math.abs(difference))}`
}

function isOverdue(request: RateRequestDto) {
  return new Date(request.dueAtUtc).getTime() <= now.value
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

async function load() {
  try {
    loading.value = true
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rate-requests/open',
      headers: { Accept: 'application/json' },
    })
    requests.value = unwrapListResponse<RateRequestDto>(response)
  } catch (error) {
    toast.backendError(error, 'No se pudieron cargar las solicitudes abiertas de vendedores.')
  } finally {
    loading.value = false
  }
}

function continueRequest(request: RateRequestDto) {
  router.push({ name: 'pricing-rate-request-resume', params: { requestId: request.id } })
}

function handleRealtimeNotification(event: Event) {
  const notification = (event as CustomEvent<SystemNotificationPush>).detail
  if (!['pricing.rate-request.created', 'pricing.rate-request.sla-overdue'].includes(notification?.notificationType ?? '')) return

  now.value = Date.now()
  void load()
}

onMounted(() => {
  void load()
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
          <h2 class="text-lg font-black">Solicitudes de tarifas de vendedores</h2>
        </div>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          Pricing ve todas las solicitudes con los datos operativos necesarios y su límite de atención.
        </p>
      </div>
      <DhButton variant="secondary" :disabled="loading" @click="load">
        <RefreshCcw class="h-4 w-4" /> Actualizar
      </DhButton>
    </div>

    <div v-if="loading && !requests.length" class="py-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
      Cargando solicitudes…
    </div>
    <div v-else-if="!sortedRequests.length" class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
      No hay solicitudes abiertas pendientes de atender.
    </div>
    <div v-else class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)]">
      <table class="min-w-[1780px] w-full text-left text-sm">
        <thead class="bg-[var(--dh-card-hover)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
          <tr>
            <th class="px-4 py-3">Vendedor</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Contenedor</th>
            <th class="px-4 py-3">Cantidad</th>
            <th class="px-4 py-3">Modalidad</th>
            <th class="px-4 py-3">Ruta</th>
            <th class="px-4 py-3">Tipo</th>
            <th class="px-4 py-3">Incoterm</th>
            <th class="px-4 py-3">Tiempo</th>
            <th class="px-4 py-3">Límite</th>
            <th class="px-4 py-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in sortedRequests" :key="request.id" class="border-t border-[var(--dh-border)]">
            <td class="px-4 py-3"><strong>{{ request.executiveName || request.sellerName || 'Vendedor' }}</strong></td>
            <td class="px-4 py-3"><strong>{{ request.clientName || 'Cliente sin definir' }}</strong></td>
            <td class="px-4 py-3"><strong>{{ equipmentLabel(request) }}</strong></td>
            <td class="px-4 py-3 font-black">{{ equipmentQuantity(request) }}</td>
            <td class="px-4 py-3 font-bold">{{ modalityLabel(request) }}</td>
            <td class="px-4 py-3 font-bold">{{ request.originName || 'Origen' }} → {{ request.destinationName || 'Destino' }}</td>
            <td class="px-4 py-3"><DhBadge :label="priorityLabel(request.priority)" :variant="priorityVariant(request.priority)" /></td>
            <td class="px-4 py-3 font-bold">{{ incotermLabel(request) }}</td>
            <td class="px-4 py-3"><strong>{{ elapsed(request) }}</strong></td>
            <td class="px-4 py-3">
              <strong :class="isOverdue(request) ? 'text-red-600 dark:text-red-300' : 'text-[var(--dh-text)]'">{{ remaining(request) }}</strong>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ new Date(request.dueAtUtc).toLocaleString('es-CR') }}</p>
            </td>
            <td class="px-4 py-3 text-right">
              <DhButton @click="continueRequest(request)"><PlayCircle class="h-4 w-4" /> Continuar tarifa</DhButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
