<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CalendarDays, Download, FileSpreadsheet, RefreshCcw } from 'lucide-vue-next'
import { callEndpoint } from '@/core/api/callEndpoint'
import { fetchBlobClient } from '@/core/api/fetchBlobClient'
import { unwrapListResponse } from '@/core/api/apiResponse'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { useToastStore } from '@/core/stores/toastStore'

interface BasicRateRow {
  id: string
  quo: string
  client: string
  details: string
  idtra: string
  currency: string
  sale: number
  cost: number
  createdAtUtc: string
}

const toast = useToastStore()
const rows = ref<BasicRateRow[]>([])
const loading = ref(false)
const exporting = ref(false)

// The report uses Costa Rica calendar dates, not the browser's local timezone.
const dateParts = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Costa_Rica',
}).formatToParts(new Date())
const part = (name: string) => dateParts.find((item) => item.type === name)?.value ?? ''
const today = part('year') + '-' + part('month') + '-' + part('day')
const from = ref(today.slice(0, 7) + '-01')
const to = ref(today)

const validRange = computed(() => !from.value || !to.value || from.value <= to.value)
const reportQuery = () => {
  const params = new URLSearchParams()
  if (from.value) params.set('from', from.value)
  if (to.value) params.set('to', to.value)
  const value = params.toString()
  return value ? '?' + value : ''
}

const totals = computed(() => {
  const groups = new Map<string, { currency: string; sale: number; cost: number }>()
  for (const row of rows.value) {
    const currency = row.currency?.trim().toUpperCase() || 'SIN MONEDA'
    const total = groups.get(currency) ?? { currency, sale: 0, cost: 0 }
    total.sale += Number(row.sale || 0)
    total.cost += Number(row.cost || 0)
    groups.set(currency, total)
  }
  return [...groups.values()].sort((left, right) => left.currency.localeCompare(right.currency))
})
const formatMoney = (value: number, currency: string) =>
  (currency || '—') + ' ' + Number(value || 0).toLocaleString('es-CR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
function formattedDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Costa_Rica',
  }).format(date)
}

async function load() {
  if (!validRange.value) {
    rows.value = []
    toast.error('Rango inválido', 'La fecha inicial no puede ser posterior a la fecha final.')
    return
  }
  loading.value = true
  try {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: '/api/pricing/rates/basic-report' + reportQuery(),
      headers: { Accept: 'application/json' },
    })
    rows.value = unwrapListResponse<BasicRateRow>(response)
  } catch (error) {
    rows.value = []
    toast.backendError(error, 'No se pudo cargar el reporte de tarifas.')
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  if (exporting.value || loading.value || !validRange.value) return
  exporting.value = true
  try {
    const blob = await fetchBlobClient('/api/pricing/rates/basic-report.xlsx' + reportQuery(), {
      method: 'GET',
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'reporte-tarifas-' + (from.value || 'inicio') + '-a-' + (to.value || 'hoy') + '.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Reporte generado', 'El Excel incluye los registros del período seleccionado.')
  } catch (error) {
    toast.backendError(error, 'No se pudo descargar el reporte de tarifas.')
  } finally {
    exporting.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="min-w-0 space-y-5">
    <DhPageHeader
      title="Reporte básico de tarifas"
      subtitle="Consulta de cotizaciones por fecha de creación: QUO, cliente, detalle, IDTRA, venta y costo."
      :icon="FileSpreadsheet"
      :hide-excel-export="true"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <DhButton label="Actualizar" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
          <DhButton label="Exportar Excel" :icon="Download" :loading="exporting" :disabled="loading || !validRange" @click="exportExcel" />
        </div>
      </template>
    </DhPageHeader>

    <section class="space-y-4 rounded-3xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex items-center gap-2 pb-2 text-sm font-bold text-[var(--dh-text)]">
          <CalendarDays :size="18" class="text-[var(--dh-primary)]" />
          Período
        </div>
        <label class="flex min-w-[155px] flex-col gap-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Desde
          <input v-model="from" type="date" :max="to || undefined"
            class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-sm text-[var(--dh-text)]"
            @change="load" />
        </label>
        <label class="flex min-w-[155px] flex-col gap-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          Hasta
          <input v-model="to" type="date" :min="from || undefined"
            class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-sm text-[var(--dh-text)]"
            @change="load" />
        </label>
        <span class="pb-2 text-sm font-semibold text-[var(--dh-text-muted)]">{{ rows.length }} tarifas</span>
      </div>
      <p v-if="!validRange" role="alert" class="text-sm font-semibold text-red-500">
        La fecha inicial no puede superar la fecha final.
      </p>

      <div v-if="totals.length" class="flex flex-wrap gap-3">
        <div v-for="total in totals" :key="total.currency"
          class="min-w-[195px] rounded-xl border border-[var(--dh-border)] bg-[var(--dh-bg)] p-3">
          <span class="block text-xs font-bold text-[var(--dh-text-muted)]">{{ total.currency }}</span>
          <div class="mt-2 flex justify-between gap-4 text-sm text-[var(--dh-text)]">
            <span>Venta</span><strong>{{ formatMoney(total.sale, total.currency) }}</strong>
          </div>
          <div class="mt-1 flex justify-between gap-4 text-sm text-[var(--dh-text)]">
            <span>Costo</span><strong>{{ formatMoney(total.cost, total.currency) }}</strong>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[1040px] text-left text-sm">
          <thead class="border-b border-[var(--dh-border)] text-xs uppercase tracking-wide text-[var(--dh-text-muted)]">
            <tr>
              <th class="px-3 py-3">Fecha</th>
              <th class="px-3 py-3">QUO</th>
              <th class="px-3 py-3">Cliente</th>
              <th class="px-3 py-3">Detalle de tarifa</th>
              <th class="px-3 py-3">IDTRA</th>
              <th class="px-3 py-3 text-right">Venta</th>
              <th class="px-3 py-3 text-right">Costo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="border-b border-[var(--dh-border)] align-top text-[var(--dh-text)]">
              <td class="whitespace-nowrap px-3 py-3 text-[var(--dh-text-muted)]">{{ formattedDate(row.createdAtUtc) }}</td>
              <td class="whitespace-nowrap px-3 py-3 font-bold">{{ row.quo }}</td>
              <td class="px-3 py-3">{{ row.client || '—' }}</td>
              <td class="max-w-[380px] px-3 py-3">{{ row.details || '—' }}</td>
              <td class="max-w-[180px] break-words px-3 py-3">{{ row.idtra || 'Pendiente' }}</td>
              <td class="whitespace-nowrap px-3 py-3 text-right font-bold">{{ formatMoney(row.sale, row.currency) }}</td>
              <td class="whitespace-nowrap px-3 py-3 text-right">{{ formatMoney(row.cost, row.currency) }}</td>
            </tr>
            <tr v-if="loading">
              <td colspan="7" class="px-3 py-12 text-center text-[var(--dh-text-muted)]">Cargando tarifas...</td>
            </tr>
            <tr v-else-if="!rows.length">
              <td colspan="7" class="px-3 py-12 text-center text-[var(--dh-text-muted)]">
                No hay tarifas para las fechas seleccionadas.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
