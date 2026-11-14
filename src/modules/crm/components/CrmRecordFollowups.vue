<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshCw, Search, Clock3 } from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { crmError, crmList, crmPath, crmRequest, type CrmRow } from '../services/crmApi'

type Source = 'activity' | 'bitacora' | 'followup'
type Entry = {
  id: string
  source: Source
  subject: string
  notes: string
  type: string
  status: string
  date: string
  ownerId: string
  href: string
}
const props = withDefaults(defineProps<{
  accountId?: string
  accountIds?: string[]
  leadId?: string
}>(), { accountId: '', leadId: '', accountIds: () => [] })
const auth = useAuthStore()
const can = (scope: string) => auth.hasScope(scope)
const readActivities = computed(() => can('crm.activity.read') || can('crm.activity.read-all'))
const readBitacora = computed(() => readActivities.value ||
  can('crm.bitacora.read') || can('crm.bitacora.read-all'))
const readFollowups = computed(() => readActivities.value ||
  can('crm.task.manage') || can('crm.followup.manage'))
const accounts = computed(() => [...new Set([props.accountId, ...props.accountIds].filter(Boolean))])
const rows = ref<Entry[]>([])
const owners = ref<Record<string, string>>({})
const loading = ref(false)
const error = ref('')
const incomplete = ref(false)
const search = ref('')
const sourceFilter = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 20
let generation = 0

function recordBelongsTo(item: CrmRow): boolean {
  if (props.leadId) return String(item.leadId ?? '') === props.leadId
  return accounts.value.includes(String(item.accountId ?? ''))
}
const sources: Array<{ resource: string; source: Source }> = [
  { resource: 'activities', source: 'activity' },
  { resource: 'activities/bitacora', source: 'bitacora' },
  { resource: 'followups', source: 'followup' },
]
function toEntry(item: CrmRow, source: Source): Entry | null {
  if (!recordBelongsTo(item)) return null
  const id = String(item.id ?? '')
  if (!id) return null
  const date = String(source === 'followup'
    ? item.completedAt ?? item.dueAt ?? item.createdAt ?? ''
    : source === 'bitacora'
      ? item.occurredAt ?? item.createdAt ?? ''
      : item.occurredAt ?? item.scheduledStartAt ?? item.createdAt ?? '')
  const subject = String(item.subject ?? item.title ?? (source === 'followup'
    ? 'Seguimiento comercial' : 'Gestión comercial'))
  return {
    id, source, subject,
    notes: String(item.minutes ?? item.agreements ?? item.noteText ?? item.summary ?? item.description ?? ''),
    type: source === 'followup' ? 'FOLLOWUP' : String(item.type ?? 'OTHER'),
    status: String(item.status ?? (source === 'bitacora' ? 'Completed' : '')),
    date,
    ownerId: String(source === 'followup' ? item.assignedUserId ?? '' : item.ownerUserId ?? ''),
    href: '/crm/' + (source === 'followup' ? 'followups' : 'activities') + '/' + encodeURIComponent(id) +
      (props.accountId ? '?fromAccount=' + encodeURIComponent(props.accountId) : ''),
  }
}
async function fetchSource(resource: string, source: Source, accountId: string | undefined) {
  const items: Entry[] = []
  let incompleteSource = false
  // Pagination is per source: neither a busy calendar nor a busy client may
  // hide the other source's historical interactions.
  for (let next = 1; next <= 20; next++) {
    const result = await crmList(resource, {
      page: next, pageSize: 100,
      accountId, leadId: props.leadId || undefined,
      agendaOnly: source === 'activity' ? 'true' : undefined,
    })
    for (const item of result.items ?? []) {
      const row = toEntry(item, source)
      if (row) items.push(row)
    }
    if (next * 100 >= result.total || !result.items.length) break
    if (next === 20) incompleteSource = true
  }
  return { items, incompleteSource }
}
async function load() {
  const current = ++generation
  rows.value = []
  owners.value = {}
  error.value = ''
  incomplete.value = false
  if (!props.leadId && !props.accountId) return
  const requests = sources
    .filter(item => item.source === 'bitacora' ? readBitacora.value
      : item.source === 'followup' ? readFollowups.value : readActivities.value)
    .flatMap(item => (props.leadId ? [undefined] : accounts.value)
      .map(accountId => fetchSource(item.resource, item.source, accountId)))
  if (!requests.length) {
    error.value = 'No tenés permiso para consultar los seguimientos de este registro.'
    return
  }
  loading.value = true
  try {
    const results = await Promise.allSettled(requests)
    if (current !== generation) return
    const byKey = new Map<string, Entry>()
    let denied = 0
    for (const result of results) {
      if (result.status === 'rejected') { denied++; continue }
      incomplete.value ||= result.value.incompleteSource
      for (const row of result.value.items) {
        // A completed activity may also be returned by the Bitácora endpoint.
        const key = (row.source === 'followup' ? 'followup' : 'activity') + ':' + row.id
        if (!byKey.has(key) || row.source === 'bitacora') byKey.set(key, row)
      }
    }
    rows.value = [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date))
    if (denied) error.value = 'No se pudieron consultar todas las gestiones. Revisá tus permisos y volvé a actualizar.'
    const ownerIds = [...new Set(rows.value.map(item => item.ownerId).filter(Boolean))]
    if (ownerIds.length) {
      const merged: Record<string, string> = {}
      for (let i = 0; i < ownerIds.length; i += 100) {
        const query = new URLSearchParams({ ownerIds: ownerIds.slice(i, i + 100).join(',') })
        try {
          const result = await crmRequest<{ owners: Record<string, string> }>(
            crmPath('calendar/labels') + '?' + query.toString())
          Object.assign(merged, result.owners ?? {})
        } catch { /* Fallback avoids disclosing unresolvable user IDs. */ }
      }
      if (current === generation) owners.value = merged
    }
  } catch (cause) {
    if (current === generation) error.value = crmError(cause)
  } finally {
    if (current === generation) loading.value = false
  }
}
// The universal CRM hub emits invalidation hints; REST remains authoritative.
// This also refreshes after local CRM writes without introducing new flags.
let refreshTimer: ReturnType<typeof setTimeout> | null = null
function onCrmDataChanged(event: Event) {
  const detail = (event as CustomEvent<{ endpoint?: string; method?: string }>).detail
  const endpoint = String(detail?.endpoint ?? '')
  const method = String(detail?.method ?? '')
  if ((endpoint !== '/api/crm' && !endpoint.startsWith('/api/crm/')) ||
      !['SIGNALR', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return
  if (refreshTimer !== null) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void load()
  }, 350)
}
onMounted(() => window.addEventListener('dhole:data:changed', onCrmDataChanged))
onBeforeUnmount(() => {
  ++generation
  if (refreshTimer !== null) clearTimeout(refreshTimer)
  window.removeEventListener('dhole:data:changed', onCrmDataChanged)
})
const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('es')
  return rows.value.filter(item =>
    (!sourceFilter.value || item.source === sourceFilter.value) &&
    (!statusFilter.value || item.status === statusFilter.value) &&
    (!term || [item.subject, item.notes, typeLabel(item.type)]
      .some(value => value.toLocaleLowerCase('es').includes(term))))
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([search, sourceFilter, statusFilter], () => { page.value = 1 })
watch([() => props.leadId, () => props.accountId, () => props.accountIds], () => {
  page.value = 1
  void load()
}, { immediate: true, deep: true })
function typeLabel(type: string) {
  return ({ FOLLOWUP: 'Recordatorio', COMMERCIAL_FOLLOWUP: 'Seguimiento comercial',
    CALL: 'Llamada', VISIT: 'Visita', MEETING: 'Reunión',
    WHATSAPP: 'WhatsApp', OFFER: 'Oferta', RECOMMENDATION: 'Recomendación',
    OTHER: 'Gestión comercial' } as Record<string, string>)[type] ?? type
}
function sourceLabel(source: Source) {
  return source === 'bitacora' ? 'Bitácora' : source === 'followup' ? 'Recordatorio' : 'Actividad'
}
function statusLabel(status: string) {
  return ({ Completed: 'Completado', Pending: 'Pendiente', Scheduled: 'Programado',
    Overdue: 'Vencido', Cancelled: 'Cancelado' } as Record<string, string>)[status] ?? status
}
function ownerLabel(ownerId: string) {
  return owners.value[ownerId] || (ownerId === auth.userId ? 'Mi usuario' : 'Responsable asignado')
}
function formattedDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Fecha no disponible'
}
</script>

<template>
  <section data-crm-record-followups class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-extrabold">Historial de seguimientos</h2>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Gestiones realizadas y compromisos registrados para este cliente o prospecto.
          Consultá el detalle sin mezclarlo con la agenda de próximas tareas.
        </p>
      </div>
      <button type="button" class="inline-flex items-center gap-2 rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-bold"
        :disabled="loading" @click="load"><RefreshCw class="h-4 w-4" /> Actualizar</button>
    </div>
    <div class="grid gap-3 sm:grid-cols-3">
      <label class="relative block">
        <span class="sr-only">Buscar seguimiento</span>
        <Search class="absolute left-3 top-3 h-4 w-4 text-[var(--dh-text-muted)]" />
        <input v-model="search" type="search" placeholder="Buscar por asunto o detalle"
          class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] py-2.5 pl-9 pr-3 text-sm" />
      </label>
      <label>
        <span class="sr-only">Tipo de registro</span>
        <select v-model="sourceFilter" class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-sm">
          <option value="">Todos los tipos</option>
          <option value="activity">Actividades</option>
          <option value="bitacora">Bitácora</option>
          <option value="followup">Recordatorios</option>
        </select>
      </label>
      <label>
        <span class="sr-only">Estado del seguimiento</span>
        <select v-model="statusFilter" class="w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2.5 text-sm">
          <option value="">Todos los estados</option>
          <option value="Completed">Completados</option>
          <option value="Pending">Pendientes</option>
          <option value="Scheduled">Programados</option>
          <option value="Overdue">Vencidos</option>
          <option value="Cancelled">Cancelados</option>
        </select>
      </label>
    </div>
    <p v-if="error" role="alert" class="text-sm text-amber-600">{{ error }}</p>
    <p v-if="incomplete" role="status" class="text-xs text-amber-600">
      El historial es muy extenso. Se muestran hasta 2.000 registros por origen y cuenta; ampliá la consulta desde el módulo Agenda y seguimientos.
    </p>
    <p v-if="loading" role="status" class="py-6 text-center text-sm text-[var(--dh-text-muted)]">Consultando historial…</p>
    <p v-else-if="!visible.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm text-[var(--dh-text-muted)]">
      No hay seguimientos que coincidan con los filtros.
    </p>
    <ol v-else class="space-y-3">
      <li v-for="item in visible" :key="item.source + ':' + item.id"
        class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <RouterLink :to="item.href" class="text-sm font-bold text-[var(--dh-primary)] hover:underline">{{ item.subject }}</RouterLink>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ typeLabel(item.type) }} · {{ sourceLabel(item.source) }} · {{ statusLabel(item.status) }}</p>
          </div>
          <span class="inline-flex items-center gap-1 text-xs text-[var(--dh-text-muted)]">
            <Clock3 class="h-3.5 w-3.5" /> {{ formattedDate(item.date) }}
          </span>
        </div>
        <p v-if="item.notes" class="mt-3 whitespace-pre-wrap text-sm">{{ item.notes }}</p>
        <p class="mt-3 text-xs text-[var(--dh-text-muted)]">Responsable: {{ ownerLabel(item.ownerId) }}</p>
      </li>
    </ol>
    <div v-if="!loading && filtered.length > pageSize" class="flex items-center justify-between gap-3 text-xs">
      <span>{{ filtered.length }} gestiones · Página {{ page }} de {{ pages }}</span>
      <div class="flex gap-2">
        <button type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-2" :disabled="page === 1" @click="page--">Anterior</button>
        <button type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-2" :disabled="page === pages" @click="page++">Siguiente</button>
      </div>
    </div>
  </section>
</template>
