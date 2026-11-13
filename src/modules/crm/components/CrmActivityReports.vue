<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, FileText, RefreshCw } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { downloadExcelWorkbook } from '@/core/utils/excel'
import { useAuthStore } from '@/core/stores/authStore'
import { crmError, crmPath, crmRequest } from '../services/crmApi'
import type { CrmAgendaIdentityLabels } from '../model/crmAgendaIdentity'

type Summary = { total: number; completed: number; pending: number; overdue: number; cancelled: number; completionRate: number }
type Entry = {
  id: string; source: 'activities' | 'followups'; ownerUserId: string
  accountId: string | null; leadId: string | null; type: string
  subject: string; status: string; at: string
}
type Report = {
  from: string; to: string; allSellers: boolean; summary: Summary
  sellers: Array<{ ownerUserId: string; count: number; summary: Summary }>
  types: Array<{ type: string; count: number }>
  daily: Array<{ date: string; total: number; completed: number }>
  items: Entry[]
}

const auth = useAuthStore()
const localDate = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}
const today = new Date()
const monthAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
const from = ref(localDate(monthAgo))
const to = ref(localDate(today))
const ownerId = ref('')
const source = ref('')
const status = ref('')
const type = ref('')
const loading = ref(false)
const error = ref('')
const report = ref<Report | null>(null)
const labels = ref<CrmAgendaIdentityLabels>({ accounts: {}, leads: {}, owners: {} })
const sellerOptions = ref<Array<{ value: string; label: string }>>([])
const typeOptions = ref<string[]>([])
const detailLimit = ref(100)
let generation = 0

const visibleRows = computed(() => report.value?.items.slice(0, detailLimit.value) ?? [])
const sellerName = (id: string) => labels.value.owners[id] || (id === auth.userId ? 'Mi usuario' : 'Vendedor no disponible')
const clientName = (row: Entry) => row.accountId
  ? labels.value.accounts[row.accountId] || 'Cliente no disponible'
  : row.leadId ? labels.value.leads[row.leadId] || 'Prospecto no disponible' : 'Sin cliente vinculado'
const typeLabels: Record<string, string> = {
  VISIT: 'Visita', CALL: 'Llamada', PHONE: 'Llamada telefónica',
  MEETING: 'Reunión', EMAIL: 'Correo', WHATSAPP: 'WhatsApp',
  FOLLOWUP: 'Seguimiento', COMMERCIAL_FOLLOWUP: 'Seguimiento comercial',
  RECOMMENDATION: 'Recomendación', OFFER: 'Oferta', OTHER: 'Otra actividad',
}
const typeName = (key: string) => typeLabels[key] || key.replaceAll('_', ' ')
const statusName = (key: string) => ({
  Scheduled: 'Programada', Pending: 'Pendiente', Overdue: 'Vencida',
  Completed: 'Completada', Cancelled: 'Cancelada',
} as Record<string, string>)[key] || key
const rowStatus = (row: Entry) => ['Pending', 'Scheduled'].includes(row.status) &&
  new Date(row.at).getTime() < Date.now() ? 'Vencida' : statusName(row.status)
const sourceName = (row: Entry) => row.source === 'followups' ? 'Seguimiento' : 'Actividad / bitácora'
const formatDate = (value: string) => new Intl.DateTimeFormat('es-CR', {
  dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value))
const proportion = (count: number, total: number) =>
  total ? Math.max(2, Math.round(count * 100 / total)) + '%' : '0%'

async function loadLabels(items: Entry[], requestGeneration: number) {
  const unique = (values: Array<string | null>) => [...new Set(values.filter((x): x is string => Boolean(x)))]
  const accounts = unique(items.map(row => row.accountId))
  const leads = unique(items.map(row => row.leadId))
  const owners = unique(items.map(row => row.ownerUserId))
  const batches = Math.max(Math.ceil(accounts.length / 100), Math.ceil(leads.length / 100), Math.ceil(owners.length / 100))
  const requests = Array.from({ length: batches }, (_, n) => {
    const params = new URLSearchParams({
      accountIds: accounts.slice(n * 100, n * 100 + 100).join(','),
      leadIds: leads.slice(n * 100, n * 100 + 100).join(','),
      ownerIds: owners.slice(n * 100, n * 100 + 100).join(','),
    })
    return crmRequest<CrmAgendaIdentityLabels>(crmPath('calendar/labels') + '?' + params)
  })
  const replies = await Promise.allSettled(requests)
  if (requestGeneration !== generation) return
  const values: CrmAgendaIdentityLabels = { accounts: {}, leads: {}, owners: {} }
  for (const result of replies) {
    if (result.status !== 'fulfilled') continue
    Object.assign(values.accounts, result.value.accounts)
    Object.assign(values.leads, result.value.leads)
    Object.assign(values.owners, result.value.owners)
  }
  labels.value = values
  const current = (report.value?.sellers ?? []).map(seller => ({
    value: seller.ownerUserId, label: sellerName(seller.ownerUserId),
  }))
  const choices = ownerId.value ? [...sellerOptions.value, ...current] : current
  sellerOptions.value = [...new Map(choices.map(choice => [choice.value, choice])).values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

async function load() {
  const requestGeneration = ++generation
  error.value = ''
  if (!from.value || !to.value || from.value > to.value) {
    error.value = 'Seleccioná fechas válidas para generar el reporte.'
    return
  }
  loading.value = true
  try {
    const [fromYear, fromMonth, fromDay] = from.value.split('-').map(Number)
    const [toYear, toMonth, toDay] = to.value.split('-').map(Number)
    const first = new Date(fromYear!, fromMonth! - 1, fromDay!)
    const last = new Date(toYear!, toMonth! - 1, toDay! + 1)
    if ((last.getTime() - first.getTime()) / 86400000 > 366) {
      error.value = 'El período máximo por reporte es de 366 días.'
      return
    }
    const params = new URLSearchParams({ from: first.toISOString(), to: last.toISOString() })
    if (ownerId.value) params.set('ownerId', ownerId.value)
    if (source.value) params.set('source', source.value)
    if (status.value) params.set('status', status.value)
    if (type.value) params.set('type', type.value)
    const response = await crmRequest<Report>(crmPath('activities/report') + '?' + params)
    if (requestGeneration !== generation) return
    report.value = response
    detailLimit.value = 100
    if (!ownerId.value) typeOptions.value = [...new Set(response.items.map(row => row.type))].sort()
    await loadLabels(response.items, requestGeneration)
    if (ownerId.value) sellerOptions.value = [
      ...sellerOptions.value.filter(option => option.value !== ownerId.value),
      { value: ownerId.value, label: sellerName(ownerId.value) },
    ].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  } catch (e) {
    if (requestGeneration === generation) {
      report.value = null
      error.value = crmError(e)
    }
  } finally {
    if (requestGeneration === generation) loading.value = false
  }
}

function clearFilters() {
  ownerId.value = ''
  source.value = ''
  status.value = ''
  type.value = ''
  void load()
}

function exportExcel() {
  const data = report.value
  if (!data) return
  const safe = (value: string) => /^[\s]*[=+@-]/.test(value) ? "'" + value : value
  const columns = (values: Array<[string, string]>) => values.map(([key, label]) => ({ key, label }))
  downloadExcelWorkbook({
    fileName: 'CRM-Actividades-Vendedores-' + from.value + '-a-' + to.value + '.xlsx',
    sheets: [
      { name: 'Consolidado', columns: columns([['indicador','Indicador'], ['valor','Valor']]), rows: [
        { indicador: 'Gestiones totales', valor: data.summary.total },
        { indicador: 'Completadas', valor: data.summary.completed },
        { indicador: 'Pendientes', valor: data.summary.pending },
        { indicador: 'Vencidas', valor: data.summary.overdue },
        { indicador: 'Canceladas', valor: data.summary.cancelled },
        { indicador: 'Cumplimiento %', valor: data.summary.completionRate },
      ] },
      { name: 'Por vendedor', columns: columns([
        ['vendedor','Vendedor'], ['total','Total'], ['completadas','Completadas'],
        ['pendientes','Pendientes'], ['vencidas','Vencidas'], ['cumplimiento','Cumplimiento %'],
      ]), rows: data.sellers.map(x => ({
        vendedor: safe(sellerName(x.ownerUserId)), total: x.summary.total,
        completadas: x.summary.completed, pendientes: x.summary.pending,
        vencidas: x.summary.overdue, cumplimiento: x.summary.completionRate,
      })) },
      { name: 'Por tipo', columns: columns([['tipo','Tipo'], ['total','Total']]),
        rows: data.types.map(x => ({ tipo: typeName(x.type), total: x.count })) },
      { name: 'Detalle', columns: columns([
        ['fecha','Fecha'], ['vendedor','Vendedor'], ['cliente','Cliente / prospecto'],
        ['actividad','Actividad'], ['tipo','Tipo'], ['origen','Origen'], ['estado','Estado'],
      ]), rows: data.items.map(x => ({
        fecha: formatDate(x.at), vendedor: safe(sellerName(x.ownerUserId)),
        cliente: safe(clientName(x)), actividad: safe(x.subject),
        tipo: safe(typeName(x.type)), origen: sourceName(x), estado: rowStatus(x),
      })) },
    ],
  })
}

function printPdf() {
  const data = report.value
  if (!data) return
  const escape = (input: unknown) => String(input ?? '').replace(/[&<>"']/g, character =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' } as Record<string,string>)[character]!)
  const table = (headers: string[], rows: Array<Array<string | number>>) =>
    '<table><thead><tr>' + headers.map(x => '<th>' + escape(x) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(x => '<td>' + escape(x) + '</td>').join('') +
    '</tr>').join('') + '</tbody></table>'
  const popup = window.open('', '_blank', 'width=1100,height=850')
  if (!popup) {
    error.value = 'El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes para generar el PDF.'
    return
  }
  const content = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte CRM</title>' +
    '<style>body{font:12px Arial,sans-serif;color:#172025;padding:24px}h1{font-size:22px}h2{font-size:16px;margin-top:28px}' +
    'table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:7px;border-bottom:1px solid #ccc;text-align:left}' +
    'th{background:#e6f5f0}tr{break-inside:avoid}@page{size:landscape;margin:14mm}</style></head><body>' +
    '<h1>Reporte de actividades comerciales</h1><p>Período: ' + escape(from.value) + ' al ' + escape(to.value) + '</p>' +
    '<p>Total: ' + data.summary.total + ' | Completadas: ' + data.summary.completed +
    ' | Pendientes: ' + data.summary.pending + ' | Vencidas: ' + data.summary.overdue +
    ' | Cumplimiento: ' + data.summary.completionRate + '%</p>' +
    '<h2>Por vendedor</h2>' + table(['Vendedor','Total','Completadas','Pendientes','Vencidas','Cumplimiento %'],
      data.sellers.map(x => [sellerName(x.ownerUserId), x.summary.total, x.summary.completed,
        x.summary.pending, x.summary.overdue, x.summary.completionRate])) +
    '<h2>Detalle de gestiones</h2>' + table(['Fecha','Vendedor','Cliente','Actividad','Tipo','Estado'],
      data.items.map(x => [formatDate(x.at), sellerName(x.ownerUserId), clientName(x),
        x.subject, typeName(x.type), rowStatus(x)])) + '</body></html>'
  popup.document.write(content)
  popup.document.close()
  popup.addEventListener('load', () => { popup.focus(); popup.print() }, { once: true })
}

onMounted(() => { void load() })
</script>

<template>
  <section class="space-y-4">
    <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-extrabold">Reporte de actividades comerciales</h2>
          <p class="text-xs text-[var(--dh-text-muted)]">Gestiones, visitas, llamadas, bitácora y recordatorios. Indicadores calculados en CRM, sin límite de paginación de la agenda.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <DhButton :icon="Download" label="Excel" variant="secondary" :disabled="!report || loading" @click="exportExcel" />
          <DhButton :icon="FileText" label="Imprimir / PDF" variant="secondary" :disabled="!report || loading" @click="printPdf" />
          <DhButton :icon="RefreshCw" label="Actualizar" variant="secondary" :disabled="loading" @click="load" />
        </div>
      </div>
      <form class="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-6" @submit.prevent="load">
        <label class="space-y-1 text-xs font-semibold"><span>Desde</span>
          <input v-model="from" type="date" required class="h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm" />
        </label>
        <label class="space-y-1 text-xs font-semibold"><span>Hasta</span>
          <input v-model="to" type="date" required class="h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm" />
        </label>
        <label class="space-y-1 text-xs font-semibold"><span>Vendedor</span>
          <select v-model="ownerId" :disabled="!report?.allSellers" class="h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm">
            <option value="">{{ report?.allSellers ? 'Todos los vendedores' : 'Mis gestiones' }}</option>
            <option v-for="seller in sellerOptions" :key="seller.value" :value="seller.value">{{ seller.label }}</option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-semibold"><span>Origen</span>
          <select v-model="source" class="h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm">
            <option value="">Todos</option><option value="activities">Actividades y bitácora</option><option value="followups">Seguimientos</option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-semibold"><span>Estado</span>
          <select v-model="status" class="h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm">
            <option value="">Todos</option><option value="Completed">Completada</option>
            <option value="Scheduled">Programada</option><option value="Pending">Pendiente</option>
            <option value="Overdue">Vencida</option><option value="Cancelled">Cancelada</option>
          </select>
        </label>
        <label class="space-y-1 text-xs font-semibold"><span>Tipo</span>
          <select v-model="type" class="h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm">
            <option value="">Todos</option><option v-for="item in typeOptions" :key="item" :value="item">{{ typeName(item) }}</option>
          </select>
        </label>
        <div class="flex flex-wrap items-center gap-3 xl:col-span-6">
          <DhButton type="submit" label="Generar reporte" :disabled="loading" />
          <button type="button" class="text-xs font-semibold text-[var(--dh-primary)]" @click="clearFilters">Restablecer filtros</button>
        </div>
      </form>
      <p v-if="error" role="alert" class="mt-3 text-sm text-red-400">{{ error }}</p>
      <p v-if="loading" role="status" class="mt-3 text-sm text-[var(--dh-text-muted)]">Consultando actividades…</p>
    </div>

    <template v-if="report && !loading">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <article v-for="metric in [
          { label: 'Gestiones', value: report.summary.total },
          { label: 'Completadas', value: report.summary.completed },
          { label: 'Pendientes', value: report.summary.pending },
          { label: 'Vencidas', value: report.summary.overdue },
          { label: 'Cumplimiento', value: report.summary.completionRate + '%' },
        ]" :key="metric.label" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs text-[var(--dh-text-muted)]">{{ metric.label }}</p>
          <p class="mt-2 text-2xl font-extrabold text-[var(--dh-text)]">{{ metric.value }}</p>
        </article>
      </div>
      <div class="grid gap-4 xl:grid-cols-2">
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
          <h3 class="mb-4 font-extrabold">Actividades por vendedor</h3>
          <p v-if="!report.sellers.length" class="text-sm text-[var(--dh-text-muted)]">Sin vendedores con gestiones en este período.</p>
          <div v-for="seller in report.sellers" :key="seller.ownerUserId" class="mb-4">
            <div class="mb-1 flex items-center justify-between gap-3 text-sm">
              <span class="min-w-0 truncate font-semibold">{{ sellerName(seller.ownerUserId) }}</span>
              <span class="shrink-0 tabular-nums">{{ seller.count }} · {{ seller.summary.completionRate }}%</span>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-[var(--dh-shell)]">
              <div class="h-full rounded-full bg-[var(--dh-primary)]" :style="{ width: proportion(seller.count, report.summary.total) }" />
            </div>
          </div>
        </section>
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
          <h3 class="mb-4 font-extrabold">Distribución por tipo</h3>
          <p v-if="!report.types.length" class="text-sm text-[var(--dh-text-muted)]">Sin actividades en este período.</p>
          <div v-for="item in report.types" :key="item.type" class="mb-4">
            <div class="mb-1 flex justify-between gap-3 text-sm"><span>{{ typeName(item.type) }}</span><strong>{{ item.count }}</strong></div>
            <div class="h-2.5 overflow-hidden rounded-full bg-[var(--dh-shell)]">
              <div class="h-full rounded-full bg-[var(--dh-primary)]" :style="{ width: proportion(item.count, report.summary.total) }" />
            </div>
          </div>
        </section>
      </div>
      <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-extrabold">Detalle de actividades y seguimientos</h3>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ report.items.length }} registros · Excel y PDF incluyen todo el período</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px] text-left text-sm">
            <thead class="border-b border-[var(--dh-border)] text-xs uppercase text-[var(--dh-text-muted)]">
              <tr><th class="p-3">Fecha</th><th class="p-3">Vendedor</th><th class="p-3">Cliente o prospecto</th>
                <th class="p-3">Gestión</th><th class="p-3">Tipo</th><th class="p-3">Estado</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in visibleRows" :key="item.source + ':' + item.id" class="border-b border-[var(--dh-border)]">
                <td class="whitespace-nowrap p-3">{{ formatDate(item.at) }}</td>
                <td class="p-3 font-semibold">{{ sellerName(item.ownerUserId) }}</td>
                <td class="p-3">{{ clientName(item) }}</td>
                <td class="max-w-[360px] p-3">{{ item.subject }}</td>
                <td class="p-3">{{ typeName(item.type) }}</td>
                <td class="p-3">{{ rowStatus(item) }}</td>
              </tr>
              <tr v-if="!visibleRows.length"><td colspan="6" class="p-6 text-center text-[var(--dh-text-muted)]">No hay gestiones que coincidan con los filtros.</td></tr>
            </tbody>
          </table>
        </div>
        <div v-if="report.items.length > visibleRows.length" class="mt-3 text-center">
          <DhButton label="Mostrar más registros" variant="secondary" @click="detailLimit += 100" />
        </div>
      </section>
    </template>
  </section>
</template>
