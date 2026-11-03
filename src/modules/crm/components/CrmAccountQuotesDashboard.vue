<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { crmPath, crmRequest } from '../services/crmApi'

interface QuoteDashboard {
  total: number
  sent: number
  approved: number
  rejected: number
  cancelled: number
  other: number
  pendingSync: number
  lastSyncAt: string | null
  linkedOnly: boolean
}
const props = defineProps<{ accountId: string }>()
const stats = ref<QuoteDashboard | null>(null)
const loading = ref(false)
const error = ref('')
const donutCanvas = ref<HTMLCanvasElement | null>(null)
const barCanvas = ref<HTMLCanvasElement | null>(null)
let donut: Chart | null = null
let bars: Chart | null = null
let generation = 0

const palette = ['#028a75', '#16a34a', '#ea580c', '#dc2626', '#64748b']
const labels = ['Enviadas', 'Aprobadas', 'No aprobadas', 'Canceladas', 'Otros estados']
const values = computed(() => stats.value
  ? [stats.value.sent, stats.value.approved, stats.value.rejected,
    stats.value.cancelled, stats.value.other] : [0, 0, 0, 0, 0])
const approvedRate = computed(() => {
  const s = stats.value
  return s && s.approved + s.rejected > 0
    ? Math.round(s.approved * 100 / (s.approved + s.rejected)) : null
})
const kpis = computed(() => stats.value ? [
  { label: 'Enviadas', value: stats.value.sent, color: palette[0] },
  { label: 'Aprobadas', value: stats.value.approved, color: palette[1] },
  { label: 'No aprobadas', value: stats.value.rejected, color: palette[2] },
  { label: 'Canceladas', value: stats.value.cancelled, color: palette[3] },
] : [])

function disposeCharts() {
  donut?.destroy()
  bars?.destroy()
  donut = null
  bars = null
}

function renderCharts() {
  disposeCharts()
  if (!stats.value?.total || !donutCanvas.value || !barCanvas.value) return
  const amounts = values.value
  donut = new Chart(donutCanvas.value, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: amounts,
        backgroundColor: palette,
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#64748b', usePointStyle: true, boxWidth: 9, padding: 14 },
        },
        tooltip: { callbacks: {
          label: context => `${context.label}: ${context.parsed} cotizaciones`,
        } },
      },
    },
  })
  bars = new Chart(barCanvas.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: amounts,
        backgroundColor: palette,
        borderRadius: 6,
        maxBarThickness: 24,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: '#64748b' },
          grid: { color: 'rgba(148,163,184,.15)' },
        },
        y: {
          ticks: { color: '#64748b' },
          grid: { display: false },
        },
      },
    },
  })
}

async function loadDashboard() {
  const requestId = ++generation
  stats.value = null
  error.value = ''
  disposeCharts()
  if (!props.accountId) return
  loading.value = true
  try {
    const result = await crmRequest<QuoteDashboard>(
      crmPath('accounts', props.accountId, 'quote-dashboard'))
    if (requestId !== generation) return
    stats.value = result
  } catch (cause) {
    if (requestId !== generation) return
    error.value = cause instanceof Error ? cause.message : 'No fue posible cargar las estadísticas.'
  } finally {
    if (requestId === generation) loading.value = false
  }
}
watch(() => props.accountId, () => { void loadDashboard() }, { immediate: true })
watch(stats, async () => {
  await nextTick()
  renderCharts()
}, { flush: 'post' })
onBeforeUnmount(() => { ++generation; disposeCharts() })
</script>

<template>
  <div class="mb-5 space-y-4" aria-label="Dashboard de cotizaciones del cliente">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-extrabold">Indicadores de cotizaciones del cliente</h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Estados comerciales por cuenta. Se considera cada cotización una sola vez.
        </p>
      </div>
      <button type="button" class="hub-outline-button hub-small"
        :disabled="loading" @click="loadDashboard">
        {{ loading ? 'Actualizando…' : 'Actualizar indicadores' }}
      </button>
    </div>
    <div v-if="error" role="alert" class="rounded-xl border border-amber-400/40 p-4 text-sm text-amber-700 dark:text-amber-300">
      {{ error }}
    </div>
    <p v-if="loading" class="py-6 text-center text-sm text-[var(--dh-text-muted)]">
      Consultando indicadores de esta cuenta…
    </p>
    <template v-else-if="stats">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="item in kpis" :key="item.label"
          class="rounded-xl border border-[var(--dh-border)] p-4">
          <p class="flex items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]">
            <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: item.color }"></span>
            {{ item.label }}
          </p>
          <strong class="mt-3 block text-3xl font-extrabold tabular-nums">{{ item.value }}</strong>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-4 text-xs text-[var(--dh-text-muted)]">
        <span><strong class="text-[var(--dh-text)]">{{ stats.total }}</strong> cotizaciones vinculadas en total</span>
        <span v-if="approvedRate !== null"><strong class="text-[var(--dh-text)]">{{ approvedRate }}%</strong> aprobación sobre decisiones del cliente</span>
        <span v-if="stats.other">{{ stats.other }} en preparación, cerradas u otros estados</span>
      </div>
      <div v-if="stats.total" class="grid gap-4 lg:grid-cols-2">
        <section class="min-w-0 rounded-xl border border-[var(--dh-border)] p-4">
          <h4 class="mb-4 text-sm font-bold">Distribución por estado</h4>
          <div class="relative h-[285px]"><canvas ref="donutCanvas" role="img" aria-label="Gráfico circular de cotizaciones según estado"></canvas></div>
        </section>
        <section class="min-w-0 rounded-xl border border-[var(--dh-border)] p-4">
          <h4 class="mb-4 text-sm font-bold">Cantidad por estado</h4>
          <div class="relative h-[285px]"><canvas ref="barCanvas" role="img" aria-label="Gráfico de barras de cotizaciones según estado"></canvas></div>
        </section>
      </div>
      <p v-else class="rounded-xl border border-dashed border-[var(--dh-border)] p-5 text-center text-sm text-[var(--dh-text-muted)]">
        Aún no hay cotizaciones vinculadas a las oportunidades visibles de esta cuenta.
      </p>
      <p v-if="stats.pendingSync" class="text-xs text-amber-700 dark:text-amber-300">
        {{ stats.pendingSync }} cotización(es) con actualización de estado pendiente desde Pricing.
      </p>
      <p class="text-xs text-[var(--dh-text-muted)]">
        Datos de cotizaciones vinculadas formalmente al CRM; no se atribuyen tarifas por coincidencia de nombre.
        Se utiliza el último estado sincronizado por Pricing. “Enviadas” incluye enviadas,
        solicitadas por el cliente y vencidas. “Aprobadas” significa aceptadas por el cliente.
      </p>
    </template>
  </div>
</template>
