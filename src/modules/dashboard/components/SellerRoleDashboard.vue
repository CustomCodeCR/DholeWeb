<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircle2, Clock3, RefreshCcw, Send, UsersRound, XCircle, FileText, TrendingUp, TimerOff, Wallet, Search, CalendarClock, FileSpreadsheet } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type { RateDto } from '@/core/interfaces/pricing'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useAuthStore } from '@/core/stores/authStore'
import SellerRateDecisionModal from './SellerRateDecisionModal.vue'

import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'

// La vista de administrador es de solo lectura: el servidor valida SuperUsuario/view-all.
const props = withDefaults(defineProps<{ adminPreview?: boolean; enableSellerActions?: boolean }>(), { adminPreview: false, enableSellerActions: false })
const selectedSellerId = ref('')

interface SellerRateRequestDto {
  id: string
  priority: 'Green' | 'Yellow' | 'Red'
  status: string
  workStatus?: 'Working' | 'RequestedFromProvider' | null
  workStatusUpdatedAtUtc?: string | null
  requestedAtUtc: string
  dueAtUtc: string
  completedAtUtc?: string | null
  rateId?: string | null
  kind?: 'New' | 'Modification'
  sellerUserId?: string | null
  sellerName?: string | null
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

const router = useRouter()
const authStore = useAuthStore()
const modalStore = useModalStore()
const toast = useToastStore()
const loading = ref(false)
const hasLoaded = ref(false)
const loadError = ref(false)
const allRequests = ref<SellerRateRequestDto[]>([])
const requests = computed(() => props.adminPreview && selectedSellerId.value
  ? allRequests.value.filter((request) => request.sellerUserId === selectedSellerId.value)
  : allRequests.value,
)

const sellerOptions = computed(() => {
  const sellers = new Map<string, string>()
  for (const request of allRequests.value) {
    if (!request.sellerUserId) continue
    sellers.set(request.sellerUserId, request.sellerName?.trim() || request.sellerUserId)
  }
  return Array.from(sellers, ([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
})
const rates = ref<RateDto[]>([])
// En supervisión conservamos la visibilidad global y consultamos por separado
// las tarifas/solicitudes autorizadas para operar con la identidad actual.
const ownRates = ref<RateDto[]>([])
const ownRequests = ref<SellerRateRequestDto[]>([])
const ownRatesById = computed(() => new Map(ownRates.value.map(rate => [rate.id, rate])))
const ownRequestIds = computed(() => new Set(ownRequests.value.map(request => request.id)))
const receivingIds = ref<string[]>([])

function canActOnRate(rate: RateDto): boolean {
  return !props.adminPreview || (props.enableSellerActions && ownRatesById.value.has(rate.id))
}


// El endpoint seller-rates determina la propiedad por SellerUserId del token, no por texto del vendedor.
type SellerCommercialStatus = 'Open' | 'Sent' | 'AcceptedByClient' | 'RejectedByClient' | 'Cancelled' | 'Expired'
type SellerStatusFilter = 'All' | SellerCommercialStatus
const search = ref('')
const statusFilter = ref<SellerStatusFilter>('All')
const currentPage = ref(1)
const pageSize = 10

function commercialStatus(rate: RateDto): SellerCommercialStatus {
  if (rate.status === 'AcceptedByClient') return 'AcceptedByClient'
  if (rate.status === 'Cancelled') return 'Cancelled'
  if (rate.status === 'RejectedByClient' || rate.status === 'Closed') return 'RejectedByClient'
  if (rate.status === 'Expired') return 'Expired'
  if (rate.status === 'Sent' || rate.status === 'RequestedByClient') return 'Sent'
  return 'Open'
}

function statusLabel(status: SellerCommercialStatus) {
  const labels: Record<SellerCommercialStatus, string> = {
    Open: 'Abierta · En preparación',
    Sent: 'Enviada · Esperando cliente',
    AcceptedByClient: 'Aceptada',
    RejectedByClient: 'Rechazada',
    Cancelled: 'Cancelada',
    Expired: 'Vencida',
  }
  return labels[status]
}

function sellerStatusLabel(rate: RateDto) {
  if (rate.revisionPending) return 'En modificación por Pricing'
  return commercialStatus(rate) === 'Sent' && rate.sellerReceivedAtUtc
    ? 'Recibida · Esperando cliente'
    : statusLabel(commercialStatus(rate))
}

function statusVariant(rate: RateDto): 'success' | 'warning' | 'danger' | 'neutral' {
  const status = commercialStatus(rate)
  if (status === 'AcceptedByClient') return 'success'
  if (status === 'RejectedByClient' || status === 'Cancelled' || status === 'Expired') return 'danger'
  if (status === 'Sent') return 'warning'
  return 'neutral'
}

const myRates = computed(() => {
  const allowedRateIds = props.adminPreview && selectedSellerId.value
    ? new Set(requests.value.map((request) => request.rateId).filter(Boolean))
    : null
  return [...new Map(rates.value.map((rate) => [rate.id, ownRatesById.value.get(rate.id) ?? rate])).values()]
    .filter((rate) => !allowedRateIds || allowedRateIds.has(rate.id))
})
const pendingRequests = computed(() => requests.value.filter((request) =>
  request.status === 'Open' && (!request.rateId || request.kind === 'Modification')).length)
const countStatus = (status: SellerCommercialStatus) =>
  myRates.value.filter((rate) => commercialStatus(rate) === status).length

const openRates = computed(() => countStatus('Open'))
const sentRates = computed(() => countStatus('Sent'))
const acceptedRates = computed(() => countStatus('AcceptedByClient'))
const rejectedRates = computed(() => countStatus('RejectedByClient'))
const cancelledRates = computed(() => countStatus('Cancelled'))
const expiredRates = computed(() => countStatus('Expired'))
const totalRates = computed(() => myRates.value.length)

const clients = computed(() => new Set([
  ...requests.value.map((request) => request.clientName?.trim().toLocaleLowerCase()).filter(Boolean),
  ...myRates.value.map((rate) => rate.clientName?.trim().toLocaleLowerCase()).filter(Boolean),
]).size)

const closedDecisions = computed(() => acceptedRates.value + rejectedRates.value)
const acceptancePercent = computed(() =>
  closedDecisions.value ? (acceptedRates.value * 100 / closedDecisions.value) : 0,
)

const statusCards = computed(() => [
  { label: 'Total de tarifas', count: totalRates.value, filter: 'All' as SellerStatusFilter, icon: FileText },
  { label: 'Abiertas', count: openRates.value, filter: 'Open' as SellerStatusFilter, icon: Clock3 },
  { label: 'Enviadas', count: sentRates.value, filter: 'Sent' as SellerStatusFilter, icon: Send },
  { label: 'Aceptadas', count: acceptedRates.value, filter: 'AcceptedByClient' as SellerStatusFilter, icon: CheckCircle2 },
  { label: 'Rechazadas', count: rejectedRates.value, filter: 'RejectedByClient' as SellerStatusFilter, icon: XCircle },
  { label: 'Canceladas', count: cancelledRates.value, filter: 'Cancelled' as SellerStatusFilter, icon: XCircle },
  { label: 'Vencidas', count: expiredRates.value, filter: 'Expired' as SellerStatusFilter, icon: TimerOff },
])

function cleanSearch(value: string | null | undefined) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

const requestDateByRate = computed(() => {
  const result = new Map<string, number>()
  for (const request of requests.value) {
    if (!request.rateId) continue
    const timestamp = Date.parse(request.requestedAtUtc)
    if (Number.isFinite(timestamp) && timestamp > (result.get(request.rateId) ?? 0))
      result.set(request.rateId, timestamp)
  }
  return result
})

function rateOrderTime(rate: RateDto) {
  const requestedAt = requestDateByRate.value.get(rate.id)
  if (requestedAt) return requestedAt
  const validFrom = Date.parse(rate.validFrom)
  return Number.isFinite(validFrom) ? validFrom : 0
}

const filteredRates = computed(() => myRates.value
  .filter((rate) => statusFilter.value === 'All' || commercialStatus(rate) === statusFilter.value)
  .filter((rate) => {
    const term = cleanSearch(search.value)
    if (!term) return true
    return cleanSearch([
      rate.quoNumber, rate.rateCode, rate.idtraNumber, rate.clientName,
      rate.polName, rate.poeName, rate.podName, rate.shipmentMode,
      rate.containerTypeName, rate.executiveName,
    ].filter(Boolean).join(' ')).includes(term)
  })
  .sort((a, b) => rateOrderTime(b) - rateOrderTime(a)),
)

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRates.value.length / pageSize)))
const pagedRates = computed(() => filteredRates.value.slice(
  (currentPage.value - 1) * pageSize,
  currentPage.value * pageSize,
))
watch([search, statusFilter, selectedSellerId], () => { currentPage.value = 1 })

// Misma navegación que el dashboard de Pricing: abre la página Tarifas con el estado seleccionado.
function openStatusRates(filter: SellerStatusFilter) {
  void router.push({
    name: 'pricing-rates',
    ...(filter === 'All' ? {} : { query: { status: filter } }),
  })
}

function currencyOf(rate: RateDto) {
  const name = String(rate.currencyName || rate.currencyCode || '').trim().toUpperCase()
  if (name === 'USD' || name.includes('DÓLAR') || name.includes('DOLLAR')) return 'USD'
  if (name === 'CRC' || name.includes('COLÓN') || name.includes('COLON')) return 'CRC'
  return name || 'SIN MONEDA'
}

// Importes de cotización (no cobros). Se agrupan por moneda y se contabiliza cada tarifa una vez.
const salesByCurrency = computed(() => {
  const map = new Map<string, {
    currency: string
    accepted: number
    inClientReview: number
    inPreparation: number
    rejected: number
    quoted: number
  }>()
  for (const rate of myRates.value) {
    const currency = currencyOf(rate)
    const totals = map.get(currency) ?? {
      currency, accepted: 0, inClientReview: 0, inPreparation: 0, rejected: 0, quoted: 0,
    }
    const rawAmount = Number(rate.totalSaleAmount)
    const amount = Number.isFinite(rawAmount) ? rawAmount : 0
    const status = commercialStatus(rate)
    totals.quoted += amount
    if (status === 'AcceptedByClient') totals.accepted += amount
    if (status === 'Sent') totals.inClientReview += amount
    if (status === 'Open') totals.inPreparation += amount
    if (status === 'RejectedByClient') totals.rejected += amount
    map.set(currency, totals)
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency))
})

function money(amount: number, currency: string) {
  return currency === 'SIN MONEDA'
    ? Number(amount).toLocaleString('es-CR', { maximumFractionDigits: 2 })
    : formatMoney(amount, currency)
}

const latestRequests = computed(() => [...requests.value]
  .sort((a, b) => Date.parse(b.requestedAtUtc) - Date.parse(a.requestedAtUtc)))

function modalityLabel(mode: RateDto['shipmentMode']) {
  const labels: Record<string, string> = {
    Fcl: 'FCL · Marítimo completo',
    Lcl: 'LCL · Marítimo consolidado',
    Ftl: 'FTL · Terrestre completo',
    Ltl: 'LTL · Terrestre consolidado',
    Air: 'Aéreo',
    AirConsol: 'Aéreo consolidado',
  }
  return labels[mode] || String(mode)
}

function equipmentLabel(rate: RateDto) {
  if (['Lcl', 'Ltl', 'Air', 'AirConsol'].includes(rate.shipmentMode))
    return modalityLabel(rate.shipmentMode)
  return (Number(rate.containerQuantity) || 1) + ' × ' + (rate.containerTypeName || rate.shipmentMode)
}

function priorityLabel(priority: SellerRateRequestDto['priority']) {
  if (priority === 'Green') return 'Verde · 48–72 h'
  if (priority === 'Yellow') return 'Amarillo · 24–48 h'
  return 'Rojo · 0–24 h'
}

function priorityVariant(priority: SellerRateRequestDto['priority']): 'success' | 'warning' | 'danger' {
  return priority === 'Green' ? 'success' : priority === 'Yellow' ? 'warning' : 'danger'
}

function requestEquipmentLabel(request: SellerRateRequestDto) {
  const mode = String(request.shipmentMode || '').toLowerCase()
  if (mode === 'lcl') return 'LCL · Consolidado marítimo'
  if (mode === 'ltl') return 'LTL · Consolidado terrestre'
  if (mode === 'air' || mode === 'airconsol') return 'Aéreo consolidado'
  return (request.equipmentQuantity || 1) + ' × ' + (request.equipmentType || request.shipmentMode || 'Equipo')
}

function canEditRequest(request: SellerRateRequestDto) {
  return (!props.adminPreview || (props.enableSellerActions && ownRequestIds.value.has(request.id)))
    && request.status === 'Open' && !request.rateId
}

function editRequest(request: SellerRateRequestDto) {
  if (!canEditRequest(request)) return
  void router.push({ name: 'pricing-seller-rate-request-edit', params: { requestId: request.id } })
}

function requestState(request: SellerRateRequestDto) {
  if (request.status === 'Cancelled') return 'Cancelada'
  if (request.status === 'Completed') return request.kind === 'Modification' ? 'Modificación atendida' : 'Completada'
  if (request.workStatus === 'RequestedFromProvider') return 'Solicitado a proveedor'
  if (request.workStatus === 'Working') return 'Trabajando'
  if (request.kind === 'Modification') return 'Modificación pendiente'
  if (request.rateId) return 'Tarifa creada'
  if (new Date(request.dueAtUtc).getTime() < Date.now()) return 'Fuera de tiempo'
  return 'En Pricing'
}

function requestStateVariant(request: SellerRateRequestDto): 'success' | 'warning' | 'danger' | 'neutral' {
  if (request.status === 'Cancelled') return 'neutral'
  if (request.status === 'Completed') return 'success'
  if (request.workStatus === 'RequestedFromProvider') return 'warning'
  if (request.workStatus === 'Working') return 'success'
  if (request.kind === 'Modification') return 'warning'
  if (request.rateId) return 'success'
  return new Date(request.dueAtUtc).getTime() < Date.now() ? 'danger' : 'warning'
}

function routeLabel(rate: RateDto) {
  return [rate.polName, rate.poeName, rate.podName].filter(Boolean).join(' → ')
}

function canRespondToRate(rate: RateDto) {
  return canActOnRate(rate) && !rate.revisionPending && ['Sent', 'RequestedByClient'].includes(rate.status)
}

function pendingModification(rate: RateDto): boolean {
  return requests.value.some(request => request.rateId === rate.id
    && request.kind === 'Modification' && request.status === 'Open')
}

function canRequestModification(rate: RateDto): boolean {
  if (!canActOnRate(rate) || rate.revisionPending || ['Cancelled', 'Closed'].includes(rate.status)) return false
  return Boolean(rate.sellerReceivedAtUtc)
    || ['Sent', 'RequestedByClient', 'AcceptedByClient', 'RejectedByClient', 'Expired'].includes(rate.status)
}

function openModification(rate: RateDto) {
  if (!canRequestModification(rate) || pendingModification(rate)) return
  void router.push({
    name: 'pricing-seller-rate-request',
    query: { modifyRateId: rate.id },
  })
}

function canMarkReceived(rate: RateDto) {
  return canActOnRate(rate)
    && !rate.revisionPending
    && ['Sent', 'RequestedByClient'].includes(rate.status)
    && !rate.sellerReceivedAtUtc
    && !!rate.executiveName?.trim()
    && rate.executiveName.trim().toLowerCase() !== 'castro fallas'
}

async function markReceived(rate: RateDto) {
  if (!canMarkReceived(rate) || receivingIds.value.includes(rate.id)) return
  receivingIds.value = [...receivingIds.value, rate.id]
  try {
    await callEndpoint<unknown>({
      method: 'PATCH',
      path: `/api/pricing/seller-rates/${rate.id}/received`,
      headers: { Accept: 'application/json' },
    })
    toast.success('Tarifa recibida', 'Se guardó su confirmación de recepción.')
    await load()
  } catch (error) {
    toast.backendError(error, 'No se pudo confirmar la recepción de la tarifa.')
  } finally {
    receivingIds.value = receivingIds.value.filter((id) => id !== rate.id)
  }
}

function openSellerRate(rate: RateDto) {
  if (!canActOnRate(rate)) return
  void router.push({ name: 'pricing-seller-rate-detail', params: { rateId: rate.id } })
}

function openCustomerDecision(rate: RateDto, decision: 'AcceptedByClient' | 'RejectedByClient') {
  if (!canActOnRate(rate)) return
  modalStore.open({
    title: decision === 'AcceptedByClient'
      ? 'Registrar aceptación del cliente'
      : 'Registrar rechazo del cliente',
    component: SellerRateDecisionModal,
    size: 'md',
    props: {
      rate,
      decision,
      onSaved: load,
    },
  })
}

async function load() {
  try {
    loading.value = true
    loadError.value = false
    const [requestResponse, rateResponse] = await Promise.all([
      callEndpoint<unknown>({
        method: 'GET',
        path: props.adminPreview ? '/api/pricing/rate-requests/dashboard' : '/api/pricing/rate-requests/mine',
        headers: { Accept: 'application/json' },
      }),
      callEndpoint<unknown>({
        method: 'GET',
        path: props.adminPreview ? '/api/pricing/seller-rates/dashboard' : '/api/pricing/seller-rates',
        headers: { Accept: 'application/json' },
      }),
    ])
    allRequests.value = unwrapListResponse<SellerRateRequestDto>(requestResponse)
    rates.value = unwrapListResponse<RateDto>(rateResponse)
    if (props.adminPreview && props.enableSellerActions) {
      // La API de supervisión no incluye los datos de recepción ni acredita
      // titularidad. La API personal resuelve ambas cosas en el servidor.
      const [ownRequestResult, ownRateResult] = await Promise.allSettled([
        callEndpoint<unknown>({ method: 'GET', path: '/api/pricing/rate-requests/mine', headers: { Accept: 'application/json' } }),
        callEndpoint<unknown>({ method: 'GET', path: '/api/pricing/seller-rates', headers: { Accept: 'application/json' } }),
      ])
      ownRequests.value = ownRequestResult.status === 'fulfilled'
        ? unwrapListResponse<SellerRateRequestDto>(ownRequestResult.value) : []
      ownRates.value = ownRateResult.status === 'fulfilled'
        ? unwrapListResponse<RateDto>(ownRateResult.value) : []
      if (ownRequestResult.status === 'rejected' || ownRateResult.status === 'rejected')
        toast.info('Acciones comerciales limitadas', 'No se pudieron verificar todas sus asignaciones. Intente actualizar el dashboard.')
    } else {
      ownRequests.value = props.adminPreview ? [] : allRequests.value
      ownRates.value = props.adminPreview ? [] : rates.value
    }
  } catch (error) {
    loadError.value = true
    toast.backendError(error, 'No se pudo cargar el seguimiento comercial del vendedor.')
  } finally {
    loading.value = false
    hasLoaded.value = true
  }
}

// Poll only the lightweight request list: new statuses appear without refreshing the
// entire commercial dashboard or requiring the seller to reload the page.
let requestStatusTimer: number | undefined
let requestStatusRefreshing = false
async function refreshRequestStatuses() {
  if (document.hidden || loading.value || !hasLoaded.value || requestStatusRefreshing) return
  requestStatusRefreshing = true
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: props.adminPreview ? '/api/pricing/rate-requests/dashboard' : '/api/pricing/rate-requests/mine',
      headers: { Accept: 'application/json' },
    })
    allRequests.value = unwrapListResponse<SellerRateRequestDto>(response)
  } catch {
    // Transient network failures must not clear the last confirmed status.
  } finally {
    requestStatusRefreshing = false
  }
}
function refreshWhenVisible() {
  if (!document.hidden) void refreshRequestStatuses()
}
onMounted(() => {
  void load()
  requestStatusTimer = window.setInterval(refreshWhenVisible, 5000)
  document.addEventListener('visibilitychange', refreshWhenVisible)
  window.addEventListener('focus', refreshWhenVisible)
})
onBeforeUnmount(() => {
  if (requestStatusTimer) window.clearInterval(requestStatusTimer)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
  window.removeEventListener('focus', refreshWhenVisible)
})
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--dh-primary)]">Dashboard por rol</p>
        <h2 class="mt-1 text-2xl font-black text-[var(--dh-text)]">{{ props.adminPreview ? 'Dashboard de Ventas' : 'Mi gestión comercial' }}</h2>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
          {{ props.adminPreview
            ? 'Vista administrativa del equipo comercial. Seleccione un vendedor para revisar sus indicadores.'
            : 'Seguimiento de solicitudes, cotizaciones y resultados con clientes.' }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DhButton
          v-if="authStore.hasScope('pricing.rate-request.view-all')"
          label="Reporte de cotizaciones"
          :icon="FileSpreadsheet"
          @click="router.push({ name: 'pricing-commercial-report' })"
        />
        <DhButton label="Actualizar" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
      </div>
    </div>

    <section v-if="props.adminPreview" class="flex flex-col gap-3 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-black text-[var(--dh-text)]">Vista de supervisión comercial</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Datos de todas las solicitudes de vendedores o de un vendedor seleccionado. Solo lectura; no modifica su identidad ni permite aceptar o rechazar tarifas ajenas.
        </p>
      </div>
      <select
        v-model="selectedSellerId"
        aria-label="Seleccionar vendedor"
        class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-sm font-semibold text-[var(--dh-text)] sm:w-72"
      >
        <option value="">Todos los vendedores</option>
        <option v-for="seller in sellerOptions" :key="seller.id" :value="seller.id">
          {{ seller.name }}
        </option>
      </select>
    </section>

    <div v-if="loading && !hasLoaded" class="rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-10 text-center text-sm font-bold text-[var(--dh-text-muted)]">
      Cargando mi gestión comercial...
    </div>

    <template v-else>
      <div v-if="loadError" class="rounded-2xl border border-red-500/25 bg-red-500/5 p-4 text-sm font-semibold text-[var(--dh-text)]">
        No se pudieron actualizar mis tarifas y solicitudes. Presione Actualizar para intentar nuevamente.
      </div>

      <section class="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6">
        <button
          v-for="card in statusCards"
          :key="card.filter"
          type="button"
          class="group min-w-0 rounded-[20px] border bg-[var(--dh-card)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--dh-primary)]"
          :class="statusFilter === card.filter ? 'border-[var(--dh-primary)] shadow-md' : 'border-[var(--dh-border)]'"
          :aria-label="`Ver ${card.label.toLowerCase()} en Tarifas`"
          @click="openStatusRates(card.filter)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.1)] text-[var(--dh-primary)]">
              <component :is="card.icon" class="h-4 w-4" />
            </span>
            <strong class="text-2xl font-black tabular-nums text-[var(--dh-text)]">{{ card.count }}</strong>
          </div>
          <p class="mt-2 truncate text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ card.label }}</p>
        </button>
      </section>

      <section class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article class="min-w-0 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex items-center gap-2">
            <Wallet class="h-5 w-5 text-[var(--dh-primary)]" />
            <div>
              <h3 class="font-black text-[var(--dh-text)]">Resultado de ventas</h3>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                Importes de tarifas cotizadas, separados por moneda. No representan ingresos cobrados.
              </p>
            </div>
          </div>

          <div v-if="salesByCurrency.length" class="mt-3 grid gap-3">
            <div
              v-for="summary in salesByCurrency"
              :key="summary.currency"
              class="min-w-0 rounded-[18px] bg-[var(--dh-input)] p-3"
            >
              <div class="flex items-center justify-between">
                <strong class="text-base font-black text-[var(--dh-text)]">{{ summary.currency }}</strong>
                <span class="text-[10px] font-black uppercase tracking-wide text-[var(--dh-text-muted)]">Mi cartera</span>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-2">
                <div class="rounded-xl bg-black/[0.025] p-2.5 dark:bg-white/[0.035]">
                  <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Venta aceptada</p>
                  <p class="mt-1 break-words text-base font-black text-green-600 dark:text-green-400">
                    {{ money(summary.accepted, summary.currency) }}
                  </p>
                </div>
                <div class="rounded-xl bg-black/[0.025] p-2.5 dark:bg-white/[0.035]">
                  <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">En espera del cliente</p>
                  <p class="mt-1 break-words text-base font-black text-[var(--dh-text)]">
                    {{ money(summary.inClientReview, summary.currency) }}
                  </p>
                </div>
                <div class="rounded-xl bg-black/[0.025] p-2.5 dark:bg-white/[0.035]">
                  <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">En preparación</p>
                  <p class="mt-1 break-words text-sm font-black text-[var(--dh-text)]">
                    {{ money(summary.inPreparation, summary.currency) }}
                  </p>
                </div>
                <div class="rounded-xl bg-black/[0.025] p-2.5 dark:bg-white/[0.035]">
                  <p class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Total cotizado</p>
                  <p class="mt-1 break-words text-sm font-black text-[var(--dh-text)]">
                    {{ money(summary.quoted, summary.currency) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="mt-3 rounded-xl border border-dashed border-[var(--dh-border)] p-5 text-center text-sm text-[var(--dh-text-muted)]">
            Todavía no hay tarifas vinculadas a sus solicitudes.
          </p>
        </article>

        <article class="min-w-0 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex items-center gap-2">
            <TrendingUp class="h-5 w-5 text-[var(--dh-primary)]" />
            <h3 class="font-black text-[var(--dh-text)]">Desempeño comercial</h3>
          </div>
          <div class="mt-4 flex items-end gap-3">
            <strong class="text-4xl font-black tabular-nums text-[var(--dh-text)]">{{ acceptancePercent.toFixed(1) }}%</strong>
            <span class="pb-1 text-xs font-semibold text-[var(--dh-text-muted)]">tasa de aceptación</span>
          </div>
          <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--dh-input)]">
            <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: acceptancePercent + '%' }" />
          </div>
          <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ acceptedRates }} aceptadas de {{ closedDecisions }} decididas (aceptadas + rechazadas). No incluye vencidas.
          </p>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <div class="rounded-[16px] bg-[var(--dh-input)] p-3">
              <UsersRound class="h-4 w-4 text-[var(--dh-primary)]" />
              <p class="mt-2 text-2xl font-black tabular-nums text-[var(--dh-text)]">{{ clients }}</p>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Clientes gestionados</p>
            </div>
            <div class="rounded-[16px] bg-[var(--dh-input)] p-3">
              <CalendarClock class="h-4 w-4 text-[var(--dh-primary)]" />
              <p class="mt-2 text-2xl font-black tabular-nums text-[var(--dh-text)]">{{ pendingRequests }}</p>
              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Solicitudes pendientes de tarifa</p>
            </div>
          </div>
          <p class="mt-4 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]">
            Las abiertas incluyen tarifas en elaboración; las enviadas esperan respuesta del cliente. Los indicadores muestran el estado actual de su cartera.
          </p>
        </article>
      </section>

      <section class="overflow-hidden rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)]">
        <div class="flex flex-col gap-3 border-b border-[var(--dh-border)] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 class="font-black text-[var(--dh-text)]">{{ props.adminPreview ? 'Tarifas del equipo y seguimiento de ventas' : 'Mis tarifas y seguimiento de ventas' }}</h3>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ props.adminPreview ? 'Tarifas vinculadas a las solicitudes de vendedores, filtradas por persona.' : 'Se muestran todas las tarifas vinculadas a sus solicitudes, no solo las recientes.' }}
            </p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row">
            <div class="relative min-w-0 sm:w-64">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]" />
              <input
                v-model="search"
                type="search"
                aria-label="Buscar mis tarifas"
                placeholder="Cliente, código, ruta..."
                class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]"
              />
            </div>
            <select
              v-model="statusFilter"
              aria-label="Filtrar mis tarifas por estado"
              class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-sm text-[var(--dh-text)]"
            >
              <option value="All">Todos los estados</option>
              <option value="Open">Abiertas</option>
              <option value="Sent">Enviadas</option>
              <option value="AcceptedByClient">Aceptadas</option>
              <option value="RejectedByClient">Rechazadas</option>
              <option value="Cancelled">Canceladas</option>
              <option value="Expired">Vencidas</option>
            </select>
          </div>
        </div>

        <div v-if="!pagedRates.length" class="p-8 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
          No hay tarifas para los filtros seleccionados.
        </div>
        <template v-else>
          <div class="grid gap-2.5 p-3 lg:hidden">
            <article v-for="rate in pagedRates" :key="'mobile-' + rate.id" class="min-w-0 rounded-[18px] border border-[var(--dh-border)] p-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p class="break-all text-xs font-black text-[var(--dh-text)]">{{ rate.quoNumber || rate.rateCode }}</p>
                  <p class="mt-1 text-sm font-bold text-[var(--dh-text)]">{{ rate.clientName || 'Cliente sin definir' }}</p>
                </div>
                <DhBadge :label="sellerStatusLabel(rate)" :variant="statusVariant(rate)" />
              </div>
              <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">{{ routeLabel(rate) }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ equipmentLabel(rate) }}</p>
              <div class="mt-2 flex items-center justify-between gap-2">
                <span class="text-xs text-[var(--dh-text-muted)]">Vigencia hasta {{ formatDate(rate.validTo) }}</span>
                <strong class="text-sm text-[var(--dh-text)]">{{ money(rate.totalSaleAmount, currencyOf(rate)) }}</strong>
              </div>
              <div v-if="canActOnRate(rate)" class="mt-3 flex flex-wrap gap-2">
                <DhButton label="Ver tarifa" size="sm" variant="secondary" @click="openSellerRate(rate)" />
                <DhButton v-if="canRequestModification(rate)" :label="pendingModification(rate) ? 'Modificación pendiente' : 'Solicitar modificación'" size="sm" variant="secondary" :disabled="pendingModification(rate)" @click="openModification(rate)" />
                <DhButton v-if="canMarkReceived(rate)" label="Marcar recibida" size="sm"
                  :loading="receivingIds.includes(rate.id)" @click="markReceived(rate)" />
                <template v-if="canRespondToRate(rate)">
                <DhButton label="Aceptar" size="sm" @click="openCustomerDecision(rate, 'AcceptedByClient')" />
                <DhButton label="Rechazar" size="sm" variant="danger" @click="openCustomerDecision(rate, 'RejectedByClient')" />
                </template>
              </div>
            </article>
          </div>
          <div class="hidden overflow-x-auto lg:block">
            <table class="w-full min-w-[1060px] text-left text-xs">
              <thead class="bg-[var(--dh-input)] text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">
                <tr>
                  <th class="px-4 py-3">Tarifa</th>
                  <th class="px-4 py-3">Cliente</th>
                  <th class="px-4 py-3">Modalidad y ruta</th>
                  <th class="px-4 py-3">Venta cotizada</th>
                  <th class="px-4 py-3">Vigencia</th>
                  <th class="px-4 py-3">Estado</th>
                  <th class="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--dh-border)]">
                <tr v-for="rate in pagedRates" :key="rate.id">
                  <td class="px-4 py-3 font-black text-[var(--dh-text)]">{{ rate.quoNumber || rate.rateCode }}</td>
                  <td class="px-4 py-3 font-semibold text-[var(--dh-text)]">{{ rate.clientName || 'Sin cliente' }}</td>
                  <td class="px-4 py-3">
                    <p class="font-bold text-[var(--dh-text)]">{{ equipmentLabel(rate) }}</p>
                    <p class="mt-1 max-w-72 text-[11px] text-[var(--dh-text-muted)]">{{ routeLabel(rate) }}</p>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap font-black text-[var(--dh-text)]">
                    {{ money(rate.totalSaleAmount, currencyOf(rate)) }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-[var(--dh-text)]">{{ formatDate(rate.validTo) }}</td>
                  <td class="px-4 py-3"><DhBadge :label="sellerStatusLabel(rate)" :variant="statusVariant(rate)" /></td>
                  <td class="px-4 py-3">
                    <div v-if="canActOnRate(rate)" class="flex flex-wrap gap-1.5">
                      <DhButton label="Ver tarifa" size="sm" variant="secondary" @click="openSellerRate(rate)" />
                      <DhButton v-if="canRequestModification(rate)" :label="pendingModification(rate) ? 'Modificación pendiente' : 'Solicitar modificación'" size="sm" variant="secondary" :disabled="pendingModification(rate)" @click="openModification(rate)" />
                      <DhButton v-if="canMarkReceived(rate)" label="Marcar recibida" size="sm"
                        :loading="receivingIds.includes(rate.id)" @click="markReceived(rate)" />
                      <template v-if="canRespondToRate(rate)">
                      <DhButton label="Aceptar" size="sm" @click="openCustomerDecision(rate, 'AcceptedByClient')" />
                      <DhButton label="Rechazar" size="sm" variant="danger" @click="openCustomerDecision(rate, 'RejectedByClient')" />
                      </template>
                    </div>
                    <span v-else class="whitespace-nowrap text-[11px] text-[var(--dh-text-muted)]">Solo lectura</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--dh-border)] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]">
            <span>{{ filteredRates.length }} tarifas · Página {{ currentPage }} de {{ totalPages }}</span>
            <div class="flex gap-2">
              <DhButton label="Anterior" size="sm" variant="secondary" :disabled="currentPage <= 1" @click="currentPage--" />
              <DhButton label="Siguiente" size="sm" variant="secondary" :disabled="currentPage >= totalPages" @click="currentPage++" />
            </div>
          </div>
        </template>
      </section>

      <section class="overflow-hidden rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)]">
        <div class="border-b border-[var(--dh-border)] px-4 py-3.5">
          <h3 class="font-black text-[var(--dh-text)]">{{ props.adminPreview ? 'Solicitudes a Pricing' : 'Mis solicitudes a Pricing' }}</h3>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Estado de los requerimientos enviados al equipo de Pricing.</p>
        </div>
        <p v-if="!latestRequests.length" class="p-6 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
          Todavía no hay solicitudes registradas.
        </p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[820px] text-left text-xs">
            <thead class="bg-[var(--dh-input)] text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">
              <tr><th class="px-4 py-3">Cliente</th><th class="px-4 py-3">Origen → Destino</th><th class="px-4 py-3">Equipo</th><th class="px-4 py-3">Prioridad</th><th class="px-4 py-3">Solicitada</th><th class="px-4 py-3">Estado</th><th v-if="!props.adminPreview || props.enableSellerActions" class="px-4 py-3">Acción</th></tr>
            </thead>
            <tbody class="divide-y divide-[var(--dh-border)]">
              <tr v-for="request in latestRequests" :key="request.id">
                <td class="px-4 py-3 font-bold text-[var(--dh-text)]">{{ request.clientName || 'Sin cliente' }}<span v-if="request.kind === 'Modification'" class="mt-1 block text-xs text-amber-500">Modificación de tarifa</span></td>
                <td class="px-4 py-3 text-[var(--dh-text)]">{{ request.originName || 'Origen' }} → {{ request.destinationName || 'Destino' }}</td>
                <td class="px-4 py-3 text-[var(--dh-text)]">{{ requestEquipmentLabel(request) }}</td>
                <td class="px-4 py-3"><DhBadge :label="priorityLabel(request.priority)" :variant="priorityVariant(request.priority)" /></td>
                <td class="px-4 py-3 whitespace-nowrap text-[var(--dh-text)]">{{ new Date(request.requestedAtUtc).toLocaleDateString('es-CR') }}</td>
                <td class="px-4 py-3">
                  <DhBadge :label="requestState(request)" :variant="requestStateVariant(request)" />
                  <p v-if="request.workStatusUpdatedAtUtc && request.status === 'Open'" class="mt-1 text-[10px] font-semibold text-[var(--dh-text-muted)]">
                    Actualizado {{ new Date(request.workStatusUpdatedAtUtc).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) }}
                  </p>
                </td>
                <td v-if="!props.adminPreview || props.enableSellerActions" class="px-4 py-3">
                  <DhButton
                    v-if="canEditRequest(request)"
                    label="Editar solicitud"
                    size="sm"
                    variant="secondary"
                    @click="editRequest(request)"
                  />
                  <span v-else class="text-[11px] text-[var(--dh-text-muted)]">Solo lectura</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
