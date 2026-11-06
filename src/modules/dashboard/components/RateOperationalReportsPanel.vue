<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '@/core/stores/locale'
import { AlertTriangle, BarChart3, Clock3, Download, RefreshCw, UsersRound } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { downloadExcelWorkbook } from '@/core/utils/excel'
import { useToastStore } from '@/core/stores/toastStore'
import { DhButton, DhInput, DhSelect, DhSpinner } from '@/shared/components/atoms'

type RequestStatus = 'Open' | 'Completed' | 'Cancelled'
type PendingStage = 'AwaitingReceipt' | 'AwaitingClient' | 'Expired'

interface ResponseRow {
  id: string
  rateId: string | null
  quoNumber: string | null
  status: RequestStatus
  priority: string
  isModification: boolean
  requestedAtUtc: string
  dueAtUtc: string
  completedAtUtc: string | null
  sellerUserId: string | null
  sellerName: string
  clientName: string
  shipmentMode: string
  originName: string
  destinationName: string
}

interface PendingRateRow {
  rateId: string
  quoNumber: string
  clientName: string
  sellerUserId: string | null
  sellerName: string
  shipmentMode: string
  status: string
  pendingStage: PendingStage
  createdAtUtc: string
  validToUtc: string
  sellerReceivedAtUtc: string | null
}

interface ReportDto {
  generatedAtUtc: string
  scope: 'Own' | 'Selected' | 'All'
  requests: ResponseRow[]
  pendingSellerRates: PendingRateRow[]
}

const props = defineProps<{ role: 'pricing' | 'seller' }>()
const router = useRouter()
const localeStore = useLocale()
const toast = useToastStore()
const today = localDay(new Date())
const from = ref(localDay(new Date(Date.now() - 89 * 86_400_000)))
const to = ref(today)
const seller = ref('')
const mode = ref('')
const loading = ref(false)
const errorMessage = ref('')
const report = ref<ReportDto | null>(null)

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function time(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : NaN
  return Number.isFinite(timestamp) ? timestamp : null
}

function hoursBetween(start: string, end: string | null | undefined): number | null {
  const first = time(start)
  const last = time(end)
  return first != null && last != null && last >= first
    ? (last - first) / 3_600_000
    : null
}

function formatHours(value: number | null) {
  return value == null ? '—' : `${value.toLocaleString((localeStore.locale === 'en' ? 'en-US' : 'es-CR'), { maximumFractionDigits: 1 })} h`
}

function dateTime(value: string | null | undefined) {
  const stamp = time(value)
  return stamp == null ? '—' : new Intl.DateTimeFormat((localeStore.locale === 'en' ? 'en-US' : 'es-CR'), {
    dateStyle: 'short', timeStyle: 'short',
  }).format(stamp)
}

function dateOnly(value: string | null | undefined) {
  const stamp = time(value)
  return stamp == null ? '—' : new Intl.DateTimeFormat((localeStore.locale === 'en' ? 'en-US' : 'es-CR'), {
    dateStyle: 'short', timeZone: 'UTC',
  }).format(stamp)
}

const sellerOptions = computed(() => {
  const entries = new Map<string, string>()
  for (const row of [...(report.value?.requests ?? []), ...(report.value?.pendingSellerRates ?? [])]) {
    if (row.sellerUserId) entries.set(row.sellerUserId, row.sellerName || row.sellerUserId)
  }
  return [
    { label: 'Todos los vendedores', value: '' },
    ...[...entries].sort((a, b) => a[1].localeCompare(b[1], 'es'))
      .map(([value, label]) => ({ value, label })),
  ]
})

const modeOptions = computed(() => {
  const modes = new Set<string>()
  for (const row of [...(report.value?.requests ?? []), ...(report.value?.pendingSellerRates ?? [])]) {
    if (row.shipmentMode) modes.add(row.shipmentMode)
  }
  return [
    { label: 'Todas las modalidades', value: '' },
    ...[...modes].sort().map(value => ({ value, label: modeLabel(value) })),
  ]
})

function modeLabel(value: string) {
  return ({
    Fcl: 'FCL', Lcl: 'LCL', Ftl: 'FTL', Ltl: 'LTL',
    Air: 'Aéreo', AirConsol: 'Aéreo consolidado',
  } as Record<string, string>)[value] ?? value
}

const requests = computed(() => (report.value?.requests ?? []).filter(row =>
  (!seller.value || row.sellerUserId === seller.value)
  && (!mode.value || row.shipmentMode === mode.value),
))
const pendingRates = computed(() => (report.value?.pendingSellerRates ?? []).filter(row =>
  (!seller.value || row.sellerUserId === seller.value)
  && (!mode.value || row.shipmentMode === mode.value),
))

const completed = computed(() => requests.value.filter(row =>
  row.status === 'Completed' && hoursBetween(row.requestedAtUtc, row.completedAtUtc) != null,
))
const active = computed(() => requests.value.filter(row => row.status === 'Open'))
const overdue = computed(() => active.value.filter(row =>
  time(row.dueAtUtc) != null && time(row.dueAtUtc)! < Date.now(),
))
const responseHours = computed(() => completed.value
  .map(row => hoursBetween(row.requestedAtUtc, row.completedAtUtc)!)
  .sort((a, b) => a - b))
const averageHours = computed(() => responseHours.value.length
  ? responseHours.value.reduce((a, b) => a + b, 0) / responseHours.value.length : null)
const medianHours = computed(() => {
  const values = responseHours.value
  if (!values.length) return null
  const mid = Math.floor(values.length / 2)
  return values.length % 2 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2
})
const withinSla = computed(() => completed.value.filter(row =>
  time(row.completedAtUtc) != null && time(row.dueAtUtc) != null
  && time(row.completedAtUtc)! <= time(row.dueAtUtc)!,
))
const slaPercent = computed(() => completed.value.length
  ? withinSla.value.length * 100 / completed.value.length : null)

const priorityBuckets = computed(() => ['Red', 'Yellow', 'Green'].map(priority => {
  const values = completed.value
    .filter(row => row.priority === priority)
    .map(row => hoursBetween(row.requestedAtUtc, row.completedAtUtc)!)
  return {
    priority,
    label: ({ Red: 'Roja', Yellow: 'Amarilla', Green: 'Verde' } as Record<string, string>)[priority],
    count: values.length,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
  }
}))
const maxPriorityHours = computed(() => Math.max(1, ...priorityBuckets.value.map(x => x.average)))

const pendingGroups = computed(() => [
  { stage: 'AwaitingReceipt' as PendingStage, label: 'Por recibir', count: pendingRates.value.filter(x => x.pendingStage === 'AwaitingReceipt').length },
  { stage: 'AwaitingClient' as PendingStage, label: 'Esperando cliente', count: pendingRates.value.filter(x => x.pendingStage === 'AwaitingClient').length },
  { stage: 'Expired' as PendingStage, label: 'Vencidas', count: pendingRates.value.filter(x => x.pendingStage === 'Expired').length },
])
const maxPending = computed(() => Math.max(1, ...pendingGroups.value.map(x => x.count)))
const pendingBySeller = computed(() => {
  const groups = new Map<string, { label: string; count: number }>()
  for (const row of pendingRates.value) {
    const key = row.sellerUserId || row.sellerName || 'sin-vendedor'
    const current = groups.get(key) ?? {
      label: row.sellerName || 'Sin vendedor asignado', count: 0,
    }
    current.count += 1
    groups.set(key, current)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
})
const maxSellerPending = computed(() => Math.max(1, ...pendingBySeller.value.map(x => x.count)))


function pendingLabel(value: PendingStage) {
  return ({
    AwaitingReceipt: 'Pendiente de recibido',
    AwaitingClient: 'Pendiente de respuesta del cliente',
    Expired: 'Vencida, requiere seguimiento',
  } as Record<PendingStage, string>)[value]
}

function isLate(row: ResponseRow) {
  const end = row.completedAtUtc ? time(row.completedAtUtc) : Date.now()
  const due = time(row.dueAtUtc)
  return end != null && due != null && end > due && row.status !== 'Cancelled'
}

async function load() {
  if (from.value && to.value && from.value > to.value) {
    errorMessage.value = 'La fecha inicial no puede ser posterior a la final.'
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const query = new URLSearchParams()
    if (from.value) query.set('from', from.value)
    if (to.value) query.set('to', to.value)
    const response = await callEndpoint<ReportDto>({
      method: 'GET',
      path: `/api/pricing/rate-requests/operational-report?${query.toString()}`,
      headers: { Accept: 'application/json' },
    })
    const data = unwrapApiResponse<ReportDto>(response)
    if (!data || !Array.isArray(data.requests) || !Array.isArray(data.pendingSellerRates))
      throw new Error('El servicio no devolvió el formato esperado.')
    report.value = data
    if (seller.value && !sellerOptions.value.some(x => x.value === seller.value)) seller.value = ''
    if (mode.value && !modeOptions.value.some(x => x.value === mode.value)) mode.value = ''
  } catch (error) {
    errorMessage.value = 'No se pudieron cargar los reportes operativos.'
    toast.backendError(error, errorMessage.value)
  } finally {
    loading.value = false
  }
}

function openRate(rateId: string) {
  void router.push({ name: 'pricing-rate-wizard', params: { rateId }, query: { mode: 'view' } })
}

function excelName(label: string) {
  return `dhole-${label}-${localDay(new Date())}.xlsx`
}

function exportResponseExcel() {
  if (!report.value) return
  downloadExcelWorkbook({
    fileName: excelName('tiempos-respuesta-tarifas'),
    sheets: [
      { name: 'Resumen', columns: [
        { key: 'metric', label: 'Indicador' }, { key: 'value', label: 'Valor' },
      ], rows: [
        { metric: 'Desde', value: from.value || 'Sin fecha inicial' },
        { metric: 'Hasta', value: to.value || 'Sin fecha final' },
        { metric: 'Solicitudes completadas', value: completed.value.length },
        { metric: 'Tiempo medio (horas)', value: averageHours.value },
        { metric: 'Mediana (horas)', value: medianHours.value },
        { metric: 'Cumplimiento SLA (%)', value: slaPercent.value },
        { metric: 'Solicitudes abiertas', value: active.value.length },
        { metric: 'Abiertas fuera de SLA', value: overdue.value.length },
      ] },
      { name: 'Tiempo de respuesta', columns: [
        { key: 'quo', label: 'QUO' }, { key: 'id', label: 'ID solicitud' },
        { key: 'kind', label: 'Tipo' }, { key: 'seller', label: 'Vendedor' },
        { key: 'client', label: 'Cliente' }, { key: 'mode', label: 'Modalidad' },
        { key: 'priority', label: 'Prioridad' }, { key: 'status', label: 'Estado' },
        { key: 'start', label: 'Solicitada UTC' }, { key: 'due', label: 'Vence SLA UTC' },
        { key: 'end', label: 'Completada UTC' }, { key: 'hours', label: 'Horas de respuesta' },
        { key: 'late', label: 'Fuera de SLA' }, { key: 'origin', label: 'Origen' },
        { key: 'destination', label: 'Destino' },
      ], rows: requests.value.map(row => ({
        quo: row.quoNumber ?? '', id: row.id,
        kind: row.isModification ? 'Modificación' : 'Nueva',
        seller: row.sellerName, client: row.clientName,
        mode: modeLabel(row.shipmentMode), priority: row.priority, status: row.status,
        start: row.requestedAtUtc, due: row.dueAtUtc,
        end: row.completedAtUtc ?? '', hours: hoursBetween(row.requestedAtUtc, row.completedAtUtc),
        late: isLate(row) ? 'Sí' : 'No',
        origin: row.originName, destination: row.destinationName,
      })) },
    ],
  })
}

function exportPendingExcel() {
  if (!report.value) return
  downloadExcelWorkbook({
    fileName: excelName('tarifas-pendientes-vendedores'),
    sheets: [
      { name: 'Resumen', columns: [
        { key: 'metric', label: 'Indicador' }, { key: 'value', label: 'Cantidad' },
      ], rows: [
        { metric: 'Total pendientes', value: pendingRates.value.length },
        ...pendingGroups.value.map(group => ({ metric: group.label, value: group.count })),
      ] },
      { name: 'Por vendedor', columns: [
        { key: 'seller', label: 'Vendedor' }, { key: 'count', label: 'Pendientes' },
      ], rows: pendingBySeller.value.map(group => ({ seller: group.label, count: group.count })) },
      { name: 'Pendientes vendedores', columns: [
        { key: 'quo', label: 'QUO' }, { key: 'seller', label: 'Vendedor' },
        { key: 'client', label: 'Cliente' }, { key: 'mode', label: 'Modalidad' },
        { key: 'stage', label: 'Pendiente de' }, { key: 'status', label: 'Estado tarifa' },
        { key: 'created', label: 'Fecha creada UTC' },
        { key: 'received', label: 'Recibida UTC' }, { key: 'validTo', label: 'Vigencia hasta UTC' },
        { key: 'rateId', label: 'ID tarifa' },
      ], rows: pendingRates.value.map(row => ({
        quo: row.quoNumber, seller: row.sellerName, client: row.clientName,
        mode: modeLabel(row.shipmentMode), stage: pendingLabel(row.pendingStage),
        status: row.status, created: row.createdAtUtc,
        received: row.sellerReceivedAtUtc ?? '', validTo: row.validToUtc, rateId: row.rateId,
      })) },
    ],
  })
}

watch(() => props.role, () => { seller.value = ''; mode.value = ''; void load() })
onMounted(load)
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <BarChart3 class="h-5 w-5 text-[var(--dh-primary)]" />
        <div>
          <h2 class="text-xl font-black text-[var(--dh-text)]">Reportería de tarifas</h2>
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
            Respuesta de Pricing y tarifas pendientes de gestión comercial.
          </p>
        </div>
      </div>
      <DhButton label="Actualizar" variant="secondary" size="sm" :icon="RefreshCw" :loading="loading" @click="load" />
    </div>

    <div class="grid gap-3 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:grid-cols-2 xl:grid-cols-4">
      <DhInput v-model="from" type="date" label="Solicitadas desde" />
      <DhInput v-model="to" type="date" label="Solicitadas hasta" />
      <DhSelect v-model="seller" label="Vendedor" placeholder="" :options="sellerOptions" />
      <DhSelect v-model="mode" label="Modalidad" placeholder="" :options="modeOptions" />
      <div class="sm:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs text-[var(--dh-text-muted)]">
          Fechas para solicitudes finalizadas; solicitudes abiertas y tarifas pendientes siempre incluyen las anteriores.
          <span v-if="report?.scope === 'Own'"> Solo se muestran datos propios.</span>
        </p>
        <DhButton label="Aplicar fechas" size="sm" :loading="loading" @click="load" />
      </div>
    </div>

    <div v-if="loading && !report" class="flex justify-center rounded-[20px] border border-[var(--dh-border)] p-8">
      <DhSpinner label="Cargando reportes..." />
    </div>
    <div v-else-if="errorMessage && !report" role="alert" class="rounded-xl border border-[var(--dh-border)] p-4 text-sm text-[var(--dh-text)]">
      {{ errorMessage }}
    </div>

    <template v-if="report">
      <p v-if="errorMessage" role="alert" class="text-sm text-[var(--dh-danger)]">{{ errorMessage }}</p>
      <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="flex items-center gap-2 font-black text-[var(--dh-text)]">
              <Clock3 class="h-5 w-5 text-[var(--dh-primary)]" /> Tiempo de respuesta de tarifas
            </h3>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
              Desde la solicitud del vendedor hasta la finalización de Pricing, en horas corridas. Incluye modificaciones.
            </p>
          </div>
          <DhButton label="Exportar Excel" variant="secondary" size="sm" :icon="Download" @click="exportResponseExcel" />
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div v-for="metric in [
            { label: 'Completadas', value: String(completed.length) },
            { label: 'Respuesta media', value: formatHours(averageHours) },
            { label: 'Mediana', value: formatHours(medianHours) },
            { label: 'En plazo SLA', value: slaPercent == null ? '—' : slaPercent.toFixed(1) + '%' },
          ]" :key="metric.label" class="rounded-xl bg-[var(--dh-input)] p-3">
            <p class="text-[11px] font-bold text-[var(--dh-text-muted)]">{{ metric.label }}</p>
            <p class="mt-1 text-xl font-black tabular-nums text-[var(--dh-text)]">{{ metric.value }}</p>
          </div>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div class="rounded-xl bg-[var(--dh-input)] p-4">
            <p class="mb-3 text-sm font-bold text-[var(--dh-text)]">Horas promedio por prioridad</p>
            <div v-for="bucket in priorityBuckets" :key="bucket.priority" class="mb-3 last:mb-0">
              <div class="mb-1 flex justify-between text-xs text-[var(--dh-text-muted)]">
                <span>{{ bucket.label }} ({{ bucket.count }})</span><span>{{ bucket.count ? formatHours(bucket.average) : 'Sin datos' }}</span>
              </div>
              <div class="h-3 overflow-hidden rounded-full bg-[var(--dh-card)]">
                <div class="h-full rounded-full bg-[var(--dh-primary)]" :style="{ width: bucket.count ? `${bucket.average / maxPriorityHours * 100}%` : '0%' }" />
              </div>
            </div>
          </div>
          <div class="flex flex-col justify-center gap-2 rounded-xl bg-[var(--dh-input)] p-4">
            <p class="text-sm font-bold text-[var(--dh-text)]">Solicitudes pendientes en Pricing</p>
            <p class="text-3xl font-black tabular-nums text-[var(--dh-text)]">{{ active.length }}</p>
            <p class="flex items-center gap-1 text-xs text-[var(--dh-text-muted)]">
              <AlertTriangle class="h-4 w-4" /> {{ overdue.length }} fuera del plazo SLA
            </p>
            <p class="text-xs text-[var(--dh-text-muted)]">Se muestran todas las solicitudes abiertas, incluso las anteriores al filtro.</p>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[650px] text-left text-xs">
            <thead class="bg-[var(--dh-input)] text-[var(--dh-text-muted)]">
              <tr><th class="px-3 py-2">Vendedor</th><th class="px-3 py-2">Cliente</th><th class="px-3 py-2">Solicitada</th><th class="px-3 py-2">Completada</th><th class="px-3 py-2 text-right">Tiempo</th><th class="px-3 py-2">SLA</th></tr>
            </thead>
            <tbody class="divide-y divide-[var(--dh-border)]">
              <tr v-for="row in completed.slice(0, 8)" :key="row.id">
                <td class="px-3 py-2 font-semibold text-[var(--dh-text)]">{{ row.sellerName || '—' }}</td>
                <td class="px-3 py-2 text-[var(--dh-text)]">{{ row.clientName || '—' }}</td>
                <td class="px-3 py-2">{{ dateTime(row.requestedAtUtc) }}</td>
                <td class="px-3 py-2">{{ dateTime(row.completedAtUtc) }}</td>
                <td class="px-3 py-2 text-right font-bold tabular-nums">{{ formatHours(hoursBetween(row.requestedAtUtc, row.completedAtUtc)) }}</td>
                <td class="px-3 py-2">{{ isLate(row) ? 'Fuera de plazo' : 'En plazo' }}</td>
              </tr>
              <tr v-if="!completed.length"><td colspan="6" class="px-3 py-5 text-center text-[var(--dh-text-muted)]">No hay solicitudes completadas en este periodo.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="flex items-center gap-2 font-black text-[var(--dh-text)]">
              <UsersRound class="h-5 w-5 text-[var(--dh-primary)]" /> Tarifas pendientes para vendedores
            </h3>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
              Tarifas entregadas sin acuse, a la espera del cliente o vencidas. No incluye borradores de Pricing.
            </p>
          </div>
          <DhButton label="Exportar Excel" variant="secondary" size="sm" :icon="Download" @click="exportPendingExcel" />
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div class="rounded-xl bg-[var(--dh-input)] p-3">
            <p class="text-[11px] font-semibold text-[var(--dh-text-muted)]">Total pendientes</p>
            <p class="mt-1 text-2xl font-black tabular-nums text-[var(--dh-text)]">{{ pendingRates.length }}</p>
          </div>
          <div v-for="group in pendingGroups" :key="group.stage" class="rounded-xl bg-[var(--dh-input)] p-3">
            <p class="text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ group.label }}</p>
            <p class="mt-1 text-2xl font-black tabular-nums text-[var(--dh-text)]">{{ group.count }}</p>
          </div>
        </div>

        <div class="mt-4 grid gap-3 lg:grid-cols-2">
          <div class="rounded-xl bg-[var(--dh-input)] p-4">
            <p class="mb-3 text-sm font-bold text-[var(--dh-text)]">Distribución de pendientes</p>
            <div v-for="group in pendingGroups" :key="group.stage" class="mb-3 last:mb-0">
              <div class="mb-1 flex justify-between text-xs text-[var(--dh-text-muted)]">
                <span>{{ group.label }}</span><span>{{ group.count }}</span>
              </div>
              <div class="h-3 overflow-hidden rounded-full bg-[var(--dh-card)]">
                <div class="h-full rounded-full bg-[var(--dh-primary)]" :style="{ width: `${group.count / maxPending * 100}%` }" />
              </div>
            </div>
          </div>
          <div class="rounded-xl bg-[var(--dh-input)] p-4">
            <p class="mb-3 text-sm font-bold text-[var(--dh-text)]">Pendientes por vendedor</p>
            <div v-for="group in pendingBySeller.slice(0, 10)" :key="group.label" class="mb-3 last:mb-0">
              <div class="mb-1 flex justify-between gap-2 text-xs text-[var(--dh-text-muted)]">
                <span class="truncate">{{ group.label }}</span><span>{{ group.count }}</span>
              </div>
              <div class="h-3 overflow-hidden rounded-full bg-[var(--dh-card)]">
                <div class="h-full rounded-full bg-[var(--dh-primary)]" :style="{ width: `${group.count / maxSellerPending * 100}%` }" />
              </div>
            </div>
            <p v-if="!pendingBySeller.length" class="text-xs text-[var(--dh-text-muted)]">No hay pendientes por vendedor.</p>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[720px] text-left text-xs">
            <thead class="bg-[var(--dh-input)] text-[var(--dh-text-muted)]">
              <tr><th class="px-3 py-2">QUO</th><th class="px-3 py-2">Vendedor</th><th class="px-3 py-2">Cliente</th><th class="px-3 py-2">Modalidad</th><th class="px-3 py-2">Pendiente</th><th class="px-3 py-2">Vigencia</th></tr>
            </thead>
            <tbody class="divide-y divide-[var(--dh-border)]">
              <tr v-for="row in pendingRates.slice(0, 10)" :key="row.rateId">
                <td class="px-3 py-2">
                  <button type="button" class="font-bold text-[var(--dh-primary)] hover:underline" @click="openRate(row.rateId)">{{ row.quoNumber }}</button>
                </td>
                <td class="px-3 py-2 text-[var(--dh-text)]">{{ row.sellerName }}</td>
                <td class="px-3 py-2 text-[var(--dh-text)]">{{ row.clientName || '—' }}</td>
                <td class="px-3 py-2">{{ modeLabel(row.shipmentMode) }}</td>
                <td class="px-3 py-2">{{ pendingLabel(row.pendingStage) }}</td>
                <td class="px-3 py-2">{{ dateOnly(row.validToUtc) }}</td>
              </tr>
              <tr v-if="!pendingRates.length"><td colspan="6" class="px-3 py-5 text-center text-[var(--dh-text-muted)]">No existen tarifas pendientes en este momento.</td></tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-xs text-[var(--dh-text-muted)]">
          El Excel incluye todos los registros del filtro, aunque aquí se muestran solo los primeros 10.
        </p>
      </section>
    </template>
  </section>
</template>
