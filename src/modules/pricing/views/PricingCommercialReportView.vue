<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, FileSpreadsheet, RefreshCcw } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { fetchBlobClient } from '@/core/api/fetchBlobClient'
import { unwrapListResponse } from '@/core/api/apiResponse'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { useToastStore } from '@/core/stores/toastStore'

type CommercialStatus = 'Sent' | 'AcceptedByClient' | 'RejectedByClient'
type StatusFilter = 'All' | CommercialStatus
interface Quote {
  id: string
  rateCode: string
  quoNumber?: string | null
  idtraNumber?: string | null
  clientName?: string | null
  executiveName?: string | null
  shipmentMode: string
  polName: string
  poeName: string
  podName?: string | null
  containerTypeName?: string | null
  containerQuantity: number
  currencyValue: string
  totalSaleAmount: number
  totalCostAmount: number
  totalUtilityAmount: number
  marginPercentage: number
  createdAtUtc: string
  validFrom: string
  validTo: string
  status: CommercialStatus
}

const toast = useToastStore()
const rows = ref<Quote[]>([])
const loading = ref(false)
const exporting = ref(false)
const search = ref('')
const status = ref<StatusFilter>('All')
const labels: Record<CommercialStatus, string> = {
  Sent: 'Enviadas', AcceptedByClient: 'Aceptadas', RejectedByClient: 'No aceptadas',
}
const statuses: CommercialStatus[] = ['Sent', 'AcceptedByClient', 'RejectedByClient']
const filtered = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('es')
  return rows.value.filter((row) =>
    (status.value === 'All' || status.value === row.status) &&
    (!needle || [
      row.rateCode, row.quoNumber, row.idtraNumber, row.clientName, row.executiveName,
      row.polName, row.poeName, row.podName, row.containerTypeName,
    ].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(needle)),
  )
})
const count = (state: StatusFilter) => state === 'All'
  ? rows.value.length
  : rows.value.filter((row) => row.status === state).length
const filterOptions = computed(() => [
  { key: 'All' as StatusFilter, label: 'Todas', count: count('All') },
  ...statuses.map((key) => ({ key: key as StatusFilter, label: labels[key], count: count(key) })),
])
const totals = computed(() => {
  const values = new Map<string, number>()
  for (const row of filtered.value) {
    const currency = row.currencyValue?.trim().toUpperCase() || 'SIN MONEDA'
    values.set(currency, (values.get(currency) ?? 0) + Number(row.totalSaleAmount || 0))
  }
  return [...values].sort(([a], [b]) => a.localeCompare(b))
})
const amount = (value: number, currency: string) =>
  (currency || '—') + ' ' + Number(value || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function date(value?: string | null) {
  if (!value) return '—'
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(timestamp)
}
function reportQuery() {
  const params = new URLSearchParams()
  if (status.value !== 'All') params.set('status', status.value)
  if (search.value.trim()) params.set('search', search.value.trim())
  const query = params.toString()
  return query ? '?' + query : ''
}
async function load() {
  loading.value = true
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rates/commercial-report',
      headers: { Accept: 'application/json' },
    })
    rows.value = unwrapListResponse<Quote>(response)
  } catch (error) {
    rows.value = []
    toast.backendError(error, 'No se pudieron consultar las cotizaciones de todos los vendedores.')
  } finally {
    loading.value = false
  }
}
async function exportExcel() {
  if (exporting.value) return
  exporting.value = true
  try {
    const blob = await fetchBlobClient('/api/pricing/rates/commercial-report.xlsx' + reportQuery(), {
      method: 'GET',
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'reporte-cotizaciones-' + new Date().toISOString().slice(0, 10) + '.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Reporte generado', 'El Excel contiene las cotizaciones del filtro seleccionado.')
  } catch (error) {
    toast.backendError(error, 'No se pudo exportar el reporte de cotizaciones.')
  } finally {
    exporting.value = false
  }
}
onMounted(load)
</script>

<template>
  <section class="min-w-0 space-y-5">
    <DhPageHeader
      title="Reporte de cotizaciones"
      subtitle="Todas las cotizaciones comerciales del sistema: enviadas, aceptadas y no aceptadas. Los importes se mantienen separados por moneda."
      :icon="FileSpreadsheet"
      :hide-excel-export="true"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <DhButton label="Actualizar" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
          <DhButton label="Exportar Excel" :icon="Download" :loading="exporting" :disabled="loading" @click="exportExcel" />
        </div>
      </template>
    </DhPageHeader>

    <div class="grid gap-3 sm:grid-cols-4">
      <button
        v-for="item in filterOptions" :key="item.key" type="button"
        class="rounded-2xl border p-4 text-left transition hover:border-[var(--dh-primary)]"
        :class="status === item.key ? 'border-[var(--dh-primary)] bg-black/5 dark:bg-white/10' : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
        @click="status = item.key"
      >
        <span class="block text-xs font-bold text-[var(--dh-text-muted)]">{{ item.label }}</span>
        <span class="mt-1 block text-2xl font-black text-[var(--dh-text)]">{{ item.count }}</span>
      </button>
    </div>

    <section class="rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label class="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold text-[var(--dh-text-muted)]">
          Buscar por cotización, cliente, vendedor o ruta
          <input
            v-model="search" type="search" placeholder="Buscar cotizaciones..."
            class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-sm text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]"
          />
        </label>
        <p class="text-sm font-bold text-[var(--dh-text-muted)]">{{ filtered.length }} cotizaciones</p>
      </div>

      <div v-if="totals.length" class="mt-4 flex flex-wrap gap-3">
        <div v-for="[currency, total] in totals" :key="currency" class="rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
          <span class="block text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">Venta cotizada · {{ currency }}</span>
          <span class="text-sm font-black text-[var(--dh-text)]">{{ amount(total, currency) }}</span>
        </div>
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[1050px] text-left text-sm">
          <thead class="border-b border-[var(--dh-border)] text-xs uppercase text-[var(--dh-text-muted)]">
            <tr>
              <th class="px-3 py-3">Cotización</th>
              <th class="px-3 py-3">Cliente / Vendedor</th>
              <th class="px-3 py-3">Ruta / Equipo</th>
              <th class="px-3 py-3">Fecha</th>
              <th class="px-3 py-3">Venta</th>
              <th class="px-3 py-3">Utilidad</th>
              <th class="px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filtered" :key="row.id" class="border-b border-[var(--dh-border)]">
              <td class="px-3 py-3">
                <strong class="block">{{ row.quoNumber || row.rateCode }}</strong>
                <span class="text-xs text-[var(--dh-text-muted)]">{{ row.idtraNumber || row.rateCode }}</span>
              </td>
              <td class="px-3 py-3">
                <span class="block font-semibold">{{ row.clientName || '—' }}</span>
                <span class="text-xs text-[var(--dh-text-muted)]">{{ row.executiveName || 'Sin vendedor indicado' }}</span>
              </td>
              <td class="px-3 py-3">
                <span class="block">{{ [row.polName, row.poeName, row.podName].filter(Boolean).join(' → ') }}</span>
                <span class="text-xs text-[var(--dh-text-muted)]">{{ row.shipmentMode }} · {{ row.containerQuantity }} × {{ row.containerTypeName }}</span>
              </td>
              <td class="px-3 py-3">{{ date(row.createdAtUtc) }}</td>
              <td class="px-3 py-3 font-bold">{{ amount(row.totalSaleAmount, row.currencyValue) }}</td>
              <td class="px-3 py-3">{{ amount(row.totalUtilityAmount, row.currencyValue) }}</td>
              <td class="px-3 py-3 font-bold">{{ labels[row.status] }}</td>
            </tr>
            <tr v-if="!loading && !filtered.length">
              <td colspan="7" class="px-3 py-12 text-center text-[var(--dh-text-muted)]">No hay cotizaciones para los filtros seleccionados.</td>
            </tr>
            <tr v-if="loading">
              <td colspan="7" class="px-3 py-12 text-center text-[var(--dh-text-muted)]">Cargando cotizaciones...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
