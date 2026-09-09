<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ClipboardList, Download, RefreshCw, Search } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { useToastStore } from '@/core/stores/toastStore'
import {
  RateRequestReportService,
  type RequestedRateReportRow,
} from '@/core/services/rateRequestReportService'

const toastStore = useToastStore()
const rows = ref<RequestedRateReportRow[]>([])
const loading = ref(false)
const exporting = ref(false)
const search = ref('')

const filteredRows = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase('es')
  if (!needle) return rows.value
  return rows.value.filter((row) =>
    [
      row.clientName,
      row.sellerName,
      row.sellerEmail,
      row.executiveName,
      row.status,
      row.priority,
      row.shipmentMode,
      row.originName,
      row.poeName,
      row.podName,
      row.destinationName,
      row.rateId,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('es')
      .includes(needle),
  )
})

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    Open: 'Pendiente Pricing',
    Completed: 'Completada',
    Cancelled: 'Cancelada',
  }
  return labels[value] ?? value
}

function priorityLabel(value: string) {
  const labels: Record<string, string> = {
    Normal: 'Normal',
    Urgent: 'Urgente',
  }
  return labels[value] ?? value
}

function route(row: RequestedRateReportRow) {
  return [row.originName, row.poeName, row.podName || row.destinationName]
    .filter(Boolean)
    .join(' → ') || '—'
}

function payloadForm(row: RequestedRateReportRow): Record<string, unknown> {
  const payload = row.payload
  if (!payload || typeof payload !== 'object') return {}
  const nested = payload.form
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : payload
}

function payloadText(row: RequestedRateReportRow, ...keys: string[]) {
  const form = payloadForm(row)
  for (const key of keys) {
    const value = form[key]
    if (Array.isArray(value)) {
      const text = value
        .map((item) => {
          if (typeof item === 'string' || typeof item === 'number') return String(item)
          if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>
            return String(record.name ?? record.label ?? record.code ?? '')
          }
          return ''
        })
        .filter(Boolean)
        .join(', ')
      if (text) return text
    }
    if (typeof value === 'string' || typeof value === 'number') return String(value)
  }
  return '—'
}

async function load() {
  loading.value = true
  try {
    rows.value = await RateRequestReportService.browse()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las tarifas solicitadas.')
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  if (exporting.value) return
  exporting.value = true
  try {
    const { blob, fileName } = await RateRequestReportService.downloadExcel()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toastStore.success('Reporte generado', 'El Excel de tarifas solicitadas se descargó correctamente.')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo generar el reporte de tarifas solicitadas.')
  } finally {
    exporting.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Tarifas solicitadas"
      subtitle="Consulta global de solicitudes enviadas por Ventas a Pricing. El acceso está controlado por el permiso de ver todas las solicitudes."
      :icon="ClipboardList"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <DhButton
            label="Actualizar"
            :icon="RefreshCw"
            variant="secondary"
            :disabled="loading || exporting"
            @click="load"
          />
          <DhButton
            label="Exportar Excel"
            :icon="Download"
            :loading="exporting"
            :disabled="loading"
            @click="exportExcel"
          />
        </div>
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Reporte operativo</p>
          <h2 class="mt-1 text-xl font-black text-[var(--dh-text)]">Todas las solicitudes</h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ filteredRows.length }} de {{ rows.length }} solicitudes visibles.
          </p>
        </div>

        <label class="relative block w-full lg:max-w-md">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dh-text-muted)]" />
          <input
            v-model="search"
            type="search"
            placeholder="Buscar cliente, vendedor, ruta, estado…"
            class="w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] py-3 pl-10 pr-4 text-sm font-semibold text-[var(--dh-text)] outline-none transition focus:border-[var(--dh-primary)]"
          />
        </label>
      </div>

      <div
        v-if="loading"
        class="mt-5 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-14 text-center font-bold text-[var(--dh-text-muted)]"
      >
        Cargando tarifas solicitadas…
      </div>

      <div
        v-else-if="!filteredRows.length"
        class="mt-5 rounded-[24px] border border-dashed border-[var(--dh-border)] px-5 py-14 text-center"
      >
        <p class="font-black text-[var(--dh-text)]">No hay solicitudes que coincidan con la búsqueda.</p>
      </div>

      <div v-else class="mt-5 overflow-x-auto rounded-[24px] border border-[var(--dh-border)]">
        <table class="min-w-[1500px] w-full border-collapse text-sm">
          <thead>
            <tr class="bg-black/[0.035] dark:bg-white/[0.045]">
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Fecha</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Estado</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Prioridad</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Vendedor</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Cliente</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Modalidad</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Ruta</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Contenedor / Equipo</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Cantidad</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Incoterm</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Servicios</th>
              <th class="px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Tarifa asociada</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredRows"
              :key="row.id"
              class="border-t border-[var(--dh-border)] align-top hover:bg-black/[0.02] dark:hover:bg-white/[0.025]"
            >
              <td class="whitespace-nowrap px-3 py-3 font-semibold text-[var(--dh-text-soft)]">{{ formatDate(row.requestedAtUtc) }}</td>
              <td class="px-3 py-3 font-black text-[var(--dh-text)]">{{ statusLabel(row.status) }}</td>
              <td class="px-3 py-3 font-semibold text-[var(--dh-text-soft)]">{{ priorityLabel(row.priority) }}</td>
              <td class="px-3 py-3">
                <p class="font-black text-[var(--dh-text)]">{{ row.sellerName || row.executiveName || '—' }}</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.sellerEmail || '—' }}</p>
              </td>
              <td class="px-3 py-3 font-bold text-[var(--dh-text)]">{{ row.clientName || '—' }}</td>
              <td class="px-3 py-3 font-semibold text-[var(--dh-text-soft)]">{{ row.shipmentMode || '—' }}</td>
              <td class="px-3 py-3 font-semibold text-[var(--dh-text-soft)]">{{ route(row) }}</td>
              <td class="px-3 py-3 font-semibold text-[var(--dh-text-soft)]">{{ payloadText(row, 'equipmentType', 'containerType', 'truckType') }}</td>
              <td class="px-3 py-3 font-semibold text-[var(--dh-text-soft)]">{{ payloadText(row, 'quantity', 'containerQuantity', 'truckQuantity') }}</td>
              <td class="px-3 py-3 font-semibold text-[var(--dh-text-soft)]">{{ payloadText(row, 'incoterm', 'incotermName') }}</td>
              <td class="max-w-[260px] px-3 py-3 font-semibold text-[var(--dh-text-soft)]">{{ payloadText(row, 'services') }}</td>
              <td class="px-3 py-3 font-mono text-xs font-bold text-[var(--dh-text-soft)]">{{ row.rateId || 'Pendiente' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
