<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, Clock3, RefreshCcw, Send, UsersRound, XCircle } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type { RateDto } from '@/core/interfaces/pricing'
import { useToastStore } from '@/core/stores/toastStore'

interface SellerRateRequestDto {
  id: string
  priority: 'Green' | 'Yellow' | 'Red'
  status: string
  requestedAtUtc: string
  dueAtUtc: string
  completedAtUtc?: string | null
  rateId?: string | null
  clientName?: string | null
  executiveName?: string | null
  shipmentMode?: string | null
  equipmentType?: string | null
  equipmentQuantity?: number | null
  modality?: string | null
  incotermName?: string | null
  originName?: string | null
  destinationName?: string | null
}

const toast = useToastStore()
const loading = ref(false)
const updatingRateId = ref('')
const requests = ref<SellerRateRequestDto[]>([])
const rates = ref<RateDto[]>([])

const pendingRequests = computed(() => requests.value.filter((item) => !item.rateId).length)
const sentRates = computed(() => rates.value.filter((item) => item.status === 'Sent').length)
const acceptedRates = computed(() => rates.value.filter((item) => item.status === 'AcceptedByClient').length)
const rejectedRates = computed(() => rates.value.filter((item) => ['RejectedByClient', 'Closed'].includes(item.status)).length)
const expiredRates = computed(() => rates.value.filter((item) => item.status === 'Expired').length)
const clients = computed(() => new Set([
  ...requests.value.map((item) => item.clientName?.trim()).filter(Boolean),
  ...rates.value.map((item) => item.clientName?.trim()).filter(Boolean),
]).size)

const latestRequests = computed(() => requests.value.slice(0, 8))
const latestRates = computed(() => rates.value.slice(0, 8))

function priorityLabel(priority: SellerRateRequestDto['priority']) {
  if (priority === 'Green') return 'Verde · 24 h'
  if (priority === 'Yellow') return 'Amarillo · 48 h'
  return 'Rojo · 72 h'
}

function priorityVariant(priority: SellerRateRequestDto['priority']): 'success' | 'warning' | 'danger' {
  return priority === 'Green' ? 'success' : priority === 'Yellow' ? 'warning' : 'danger'
}

function requestState(request: SellerRateRequestDto) {
  if (request.rateId) return 'Tarifa creada'
  if (new Date(request.dueAtUtc).getTime() < Date.now()) return 'Fuera de tiempo'
  return 'En Pricing'
}

function requestStateVariant(request: SellerRateRequestDto): 'success' | 'warning' | 'danger' | 'neutral' {
  if (request.rateId) return 'success'
  return new Date(request.dueAtUtc).getTime() < Date.now() ? 'danger' : 'warning'
}

function customerProgress(rate: RateDto) {
  switch (rate.status) {
    case 'Sent': return 'Esperando respuesta del cliente'
    case 'RequestedByClient': return 'Esperando respuesta del cliente'
    case 'AcceptedByClient': return 'Aceptada por el cliente'
    case 'RejectedByClient':
    case 'Closed': return 'No aceptada por el cliente'
    case 'Expired': return 'Vencida'
    default: return 'En preparación'
  }
}

function progressVariant(rate: RateDto): 'success' | 'warning' | 'danger' | 'neutral' {
  if (rate.status === 'AcceptedByClient') return 'success'
  if (['RejectedByClient', 'Closed', 'Expired'].includes(rate.status)) return 'danger'
  if (['Sent', 'RequestedByClient'].includes(rate.status)) return 'warning'
  return 'neutral'
}

function routeLabel(rate: RateDto) {
  return [rate.polName, rate.poeName, rate.podName].filter(Boolean).join(' → ')
}

function canRespondToRate(rate: RateDto) {
  return ['Sent', 'RequestedByClient'].includes(rate.status)
}

async function setCustomerDecision(rate: RateDto, status: 'AcceptedByClient' | 'RejectedByClient') {
  let reason: string | null = null
  let idtraNumber: string | null = null

  if (status === 'AcceptedByClient') {
    const value = window.prompt(
      'Ingrese el IDTRA para registrar la aceptación del cliente:',
      rate.idtraNumber?.trim() ?? '',
    )
    if (value === null) return
    idtraNumber = value.trim()
    if (!idtraNumber) {
      toast.warning('IDTRA requerido', 'Debe registrar el IDTRA para marcar la tarifa como aceptada.')
      return
    }
  }

  if (status === 'RejectedByClient') {
    const value = window.prompt('Indique el motivo por el que el cliente rechazó la tarifa:')
    if (value === null) return
    reason = value.trim()
    if (!reason) {
      toast.warning('Motivo requerido', 'Debe indicar por qué el cliente rechazó la tarifa.')
      return
    }
  }

  try {
    updatingRateId.value = rate.id
    await callEndpoint<unknown>(
      {
        method: 'PATCH',
        path: `/api/pricing/seller-rates/${rate.id}/status`,
        headers: { Accept: 'application/json' },
      },
      {
        body: {
          status,
          reason,
          idtraNumber,
        },
      },
    )
    toast.success(
      status === 'AcceptedByClient' ? 'Tarifa aceptada' : 'Tarifa rechazada',
      status === 'AcceptedByClient'
        ? `Se registró la aceptación del cliente${idtraNumber ? ` con IDTRA ${idtraNumber}` : ''}.`
        : 'Se registró el rechazo del cliente.',
    )
    await load()
  } catch (error) {
    toast.backendError(error, 'No se pudo actualizar la respuesta del cliente.')
  } finally {
    updatingRateId.value = ''
  }
}

async function load() {
  try {
    loading.value = true
    const [requestResponse, rateResponse] = await Promise.all([
      callEndpoint<unknown>({ method: 'GET', path: '/api/pricing/rate-requests/mine', headers: { Accept: 'application/json' } }),
      callEndpoint<unknown>({ method: 'GET', path: '/api/pricing/seller-rates', headers: { Accept: 'application/json' } }),
    ])
    requests.value = unwrapListResponse<SellerRateRequestDto>(requestResponse)
    rates.value = unwrapListResponse<RateDto>(rateResponse)
  } catch (error) {
    toast.backendError(error, 'No se pudo cargar el seguimiento comercial del vendedor.')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-sm font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">Dashboard de vendedor</p>
        <h2 class="mt-2 text-2xl font-black">Mis solicitudes, tarifas y clientes</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Seguimiento únicamente de su propia gestión comercial.</p>
      </div>
      <DhButton variant="secondary" :disabled="loading" @click="load"><RefreshCcw class="h-4 w-4" /> Actualizar</DhButton>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <article class="dh-glass rounded-3xl p-4"><Clock3 class="h-5 w-5 text-[var(--dh-primary)]" /><strong class="mt-3 block text-3xl">{{ pendingRequests }}</strong><span class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">En Pricing</span></article>
      <article class="dh-glass rounded-3xl p-4"><Send class="h-5 w-5 text-[var(--dh-primary)]" /><strong class="mt-3 block text-3xl">{{ sentRates }}</strong><span class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Enviadas</span></article>
      <article class="dh-glass rounded-3xl p-4"><CheckCircle2 class="h-5 w-5 text-[var(--dh-primary)]" /><strong class="mt-3 block text-3xl">{{ acceptedRates }}</strong><span class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Aceptadas</span></article>
      <article class="dh-glass rounded-3xl p-4"><XCircle class="h-5 w-5 text-[var(--dh-primary)]" /><strong class="mt-3 block text-3xl">{{ rejectedRates }}</strong><span class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">No aceptadas</span></article>
      <article class="dh-glass rounded-3xl p-4"><Clock3 class="h-5 w-5 text-[var(--dh-primary)]" /><strong class="mt-3 block text-3xl">{{ expiredRates }}</strong><span class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Vencidas</span></article>
      <article class="dh-glass rounded-3xl p-4"><UsersRound class="h-5 w-5 text-[var(--dh-primary)]" /><strong class="mt-3 block text-3xl">{{ clients }}</strong><span class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Clientes</span></article>
    </div>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <h3 class="text-lg font-black">Mis solicitudes recientes</h3>
      <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Qué solicitó y en qué etapa se encuentra con Pricing.</p>
      <div v-if="!latestRequests.length" class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Todavía no ha creado solicitudes.</div>
      <div v-else class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)]">
        <table class="min-w-[980px] w-full text-left text-sm">
          <thead class="bg-[var(--dh-card-hover)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]"><tr><th class="px-4 py-3">Cliente</th><th class="px-4 py-3">Ruta</th><th class="px-4 py-3">Equipo</th><th class="px-4 py-3">Tipo</th><th class="px-4 py-3">Solicitada</th><th class="px-4 py-3">Estado</th></tr></thead>
          <tbody>
            <tr v-for="request in latestRequests" :key="request.id" class="border-t border-[var(--dh-border)]">
              <td class="px-4 py-3 font-bold">{{ request.clientName || 'Cliente sin definir' }}</td>
              <td class="px-4 py-3 font-bold">{{ request.originName || 'Origen' }} → {{ request.destinationName || 'Destino' }}</td>
              <td class="px-4 py-3">{{ request.equipmentQuantity || 1 }} × {{ request.equipmentType || request.shipmentMode || 'Equipo' }}</td>
              <td class="px-4 py-3"><DhBadge :label="priorityLabel(request.priority)" :variant="priorityVariant(request.priority)" /></td>
              <td class="px-4 py-3">{{ new Date(request.requestedAtUtc).toLocaleString('es-CR') }}</td>
              <td class="px-4 py-3"><DhBadge :label="requestState(request)" :variant="requestStateVariant(request)" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <h3 class="text-lg font-black">Mis tarifas y seguimiento de clientes</h3>
      <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Permite ver rápidamente cuáles esperan al cliente y registrar directamente si fueron aceptadas o rechazadas.</p>
      <div v-if="!latestRates.length" class="mt-4 rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">Aún no hay tarifas creadas a partir de sus solicitudes.</div>
      <div v-else class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)]">
        <table class="min-w-[1160px] w-full text-left text-sm">
          <thead class="bg-[var(--dh-card-hover)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]"><tr><th class="px-4 py-3">Tarifa</th><th class="px-4 py-3">Cliente</th><th class="px-4 py-3">Ruta</th><th class="px-4 py-3">Equipo</th><th class="px-4 py-3">Vigencia</th><th class="px-4 py-3">Seguimiento cliente</th><th class="px-4 py-3">Acción</th></tr></thead>
          <tbody>
            <tr v-for="rate in latestRates" :key="rate.id" class="border-t border-[var(--dh-border)]">
              <td class="px-4 py-3 font-black">{{ rate.quoNumber || rate.rateCode }}</td>
              <td class="px-4 py-3 font-bold">{{ rate.clientName || 'Cliente sin definir' }}</td>
              <td class="px-4 py-3 font-bold">{{ routeLabel(rate) }}</td>
              <td class="px-4 py-3">{{ rate.containerQuantity }} × {{ rate.containerTypeName || rate.shipmentMode }}</td>
              <td class="px-4 py-3">{{ new Date(rate.validTo).toLocaleDateString('es-CR') }}</td>
              <td class="px-4 py-3"><DhBadge :label="customerProgress(rate)" :variant="progressVariant(rate)" /></td>
              <td class="px-4 py-3">
                <div v-if="canRespondToRate(rate)" class="flex min-w-[210px] gap-2">
                  <DhButton
                    size="sm"
                    :disabled="updatingRateId === rate.id"
                    @click="setCustomerDecision(rate, 'AcceptedByClient')"
                  >Aceptar</DhButton>
                  <DhButton
                    size="sm"
                    variant="danger"
                    :disabled="updatingRateId === rate.id"
                    @click="setCustomerDecision(rate, 'RejectedByClient')"
                  >Rechazar</DhButton>
                </div>
                <span v-else class="text-xs font-bold text-[var(--dh-text-muted)]">Sin acción pendiente</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
