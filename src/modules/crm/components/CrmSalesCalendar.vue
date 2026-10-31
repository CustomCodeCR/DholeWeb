<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
import { ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw, Search, X } from 'lucide-vue-next'
import { crmList, crmPath, crmRequest, crmError, type CrmRow } from '../services/crmApi'

type CalendarMode = 'month' | 'week' | 'day' | 'list'
type Source = 'activity' | 'followup'
interface CalendarEvent {
  key: string
  source: Source
  id: string
  subject: string
  type: string
  status: string
  at: Date
  accountId: string
  leadId: string
  ownerId: string
  rowVersion: number
  reminderLeadMinutes: number | null
  reminderChannelStrategy: string
}
const router = useRouter()
const auth = useAuthStore()
const can = (scope: string) => auth.hasScope(scope)
const mode = ref<CalendarMode>('month')
const selected = ref(new Date())
const creationOpen = ref(false)
const active = ref<CalendarEvent | null>(null)
const rows = ref<CalendarEvent[]>([])
const accounts = ref<CrmRow[]>([])
const leads = ref<CrmRow[]>([])
const contactRows = ref<CrmRow[]>([])
const accountQuery = ref('')
const pending = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const partial = ref(false)
let loadGeneration = 0
const editor = ref({
  type: 'VISIT',
  subject: '',
  accountId: '',
  leadId: '',
  contactId: '',
  ownerId: '',
  start: '',
  end: '',
  location: '',
  reminderMinutes: 60,
  channel: 'BOTH',
})
const eventTypes = [
  { value: 'VISIT', label: 'Visita' },
  { value: 'CALL', label: 'Llamada' },
  { value: 'MEETING', label: 'Reunión' },
  { value: 'EMAIL', label: 'Correo' },
  { value: 'FOLLOWUP', label: 'Seguimiento' },
  { value: 'OTHER', label: 'Tarea' },
] as const
const reminderOptions = [
  { value: 5, label: '5 minutos antes' }, { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' }, { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 día antes' }, { value: 10080, label: '7 días antes' },
]
const dateKey = (d: Date) => [
  d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'),
].join('-')
function localInput(d: Date): string {
  return dateKey(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
function dayOffset(date: Date, count: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + count)
  return result
}
function weekStart(d: Date) { return dayOffset(d, -((d.getDay() + 6) % 7)) }
function normalizeTime(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
const monthFirst = computed(() => new Date(selected.value.getFullYear(), selected.value.getMonth(), 1))
const rangeStart = computed(() => mode.value === 'day'
  ? dayOffset(selected.value, 0) : mode.value === 'week'
    ? weekStart(selected.value) : weekStart(monthFirst.value))
const rangeEnd = computed(() => mode.value === 'day'
  ? dayOffset(rangeStart.value, 1) : mode.value === 'week'
    ? dayOffset(rangeStart.value, 7) : dayOffset(rangeStart.value, 42))
const rangeKey = computed(() => rangeStart.value.toISOString() + '|' + rangeEnd.value.toISOString())
const visibleDays = computed(() => {
  const count = mode.value === 'day' ? 1 : mode.value === 'week' ? 7 : 42
  return Array.from({ length: count }, (_, i) => dayOffset(rangeStart.value, i))
})
const heading = computed(() => {
  if (mode.value === 'day') return selected.value.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (mode.value === 'week') return rangeStart.value.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' }) +
    ' – ' + dayOffset(rangeStart.value, 6).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })
  return selected.value.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })
})
const eventsByDay = computed(() => {
  const result: Record<string, CalendarEvent[]> = {}
  for (const row of rows.value) (result[dateKey(row.at)] ??= []).push(row)
  for (const bucket of Object.values(result)) bucket.sort((a, b) => a.at.getTime() - b.at.getTime())
  return result
})
const listDays = computed(() => visibleDays.value
  .map(day => ({ day, events: eventsByDay.value[dateKey(day)] ?? [] }))
  .filter(item => item.events.length > 0))
const pendingCount = computed(() => rows.value.filter(x => x.status === 'Pending' || x.status === 'Scheduled' || x.status === 'Overdue').length)
const selectedAccount = computed(() => accounts.value.find(x => x.id === editor.value.accountId))
const assignees = computed(() => {
  const mine = String(auth.userId ?? '')
  const seller = editor.value.accountId && selectedAccount.value?.isCastroFallasExecutive !== true
    ? String(selectedAccount.value?.executiveUserId ?? '') : ''
  return [...new Set([mine, seller].filter(Boolean))]
})
function labelFor(event: CalendarEvent) {
  return eventTypes.find(type => type.value === event.type)?.label ?? event.type
}
function statusLabel(status: string) {
  return ({ Pending: 'Pendiente', Scheduled: 'Programado', Overdue: 'Vencido',
    Completed: 'Completado', Cancelled: 'Cancelado' } as Record<string, string>)[status] ?? status
}
function eventTone(event: CalendarEvent) {
  return event.status === 'Completed' ? 'border-emerald-500/30 bg-emerald-500/10'
    : event.status === 'Cancelled' ? 'border-[var(--dh-border)] opacity-60'
      : event.status === 'Overdue' ? 'border-amber-500/50 bg-amber-500/10'
        : event.type === 'VISIT' ? 'border-blue-500/30 bg-blue-500/10'
          : event.type === 'CALL' ? 'border-violet-500/30 bg-violet-500/10'
            : 'border-[var(--dh-border)] bg-[var(--dh-shell)]'
}
function navigate(step: number) {
  if (mode.value === 'day') selected.value = dayOffset(selected.value, step)
  else if (mode.value === 'week') selected.value = dayOffset(selected.value, 7 * step)
  else selected.value = new Date(selected.value.getFullYear(), selected.value.getMonth() + step, 1)
}
function openCreation(date?: Date) {
  const when = date ? new Date(date) : new Date()
  when.setSeconds(0, 0)
  if (!date) when.setMinutes(Math.ceil(when.getMinutes() / 15) * 15)
  else when.setHours(9, 0, 0, 0)
  editor.value = {
    type: 'VISIT', subject: '', accountId: '', leadId: '', contactId: '',
    ownerId: String(auth.userId ?? ''), start: localInput(when),
    end: localInput(new Date(when.getTime() + 30 * 60000)),
    location: '', reminderMinutes: 60, channel: 'BOTH',
  }
  error.value = ''
  creationOpen.value = true
}
async function searchAccounts() {
  try {
    const result = await crmList('accounts', { q: accountQuery.value.trim(), page: 1, pageSize: 100 })
    accounts.value = result.items
  } catch (cause) { error.value = crmError(cause) }
}
async function searchLeads() {
  if (!can('crm.lead.read') && !can('crm.lead.read-all')) return
  try { leads.value = (await crmList('leads', { page: 1, pageSize: 100 })).items }
  catch { leads.value = [] }
}
async function loadContacts() {
  contactRows.value = []
  if (!editor.value.accountId || !can('crm.contact.read')) return
  try {
    const linked = await crmRequest<Array<CrmRow & { contact?: CrmRow }>>(
      crmPath('accounts', editor.value.accountId, 'contacts'))
    contactRows.value = linked.map(item => item.contact ?? item)
  } catch { contactRows.value = [] }
}
watch(() => editor.value.accountId, () => {
  editor.value.contactId = ''
  if (editor.value.accountId) {
    editor.value.leadId = ''
    const ownerId = selectedAccount.value?.isCastroFallasExecutive === true
      ? String(auth.userId ?? '') : String(selectedAccount.value?.executiveUserId ?? auth.userId ?? '')
    editor.value.ownerId = (can('crm.activity.read-all') || can('crm.account.read-all'))
      ? ownerId : String(auth.userId ?? '')
  }
  void loadContacts()
})
watch(() => editor.value.leadId, leadId => {
  if (leadId) { editor.value.accountId = ''; editor.value.contactId = '' }
})
async function fetchAll(resource: string, from: string, to: string): Promise<{ items: CrmRow[]; truncated: boolean }> {
  const all: CrmRow[] = []
  let total = 0
  for (let page = 1; page <= 10; page++) {
    const response = await crmList(resource, { from, to, page, pageSize: 100 })
    total = response.total
    all.push(...response.items)
    if (all.length >= total || !response.items.length) break
  }
  return { items: all, truncated: all.length < total }
}
async function load() {
  const generation = ++loadGeneration
  pending.value = true
  error.value = ''
  const from = rangeStart.value.toISOString()
  const to = rangeEnd.value.toISOString()
  const tasks: Promise<{ items: CrmRow[]; truncated: boolean }>[] = []
  const sources: Source[] = []
  if (can('crm.activity.read') || can('crm.activity.read-all')) {
    tasks.push(fetchAll('activities', from, to)); sources.push('activity')
  }
  if (can('crm.task.manage') || can('crm.followup.manage')) {
    tasks.push(fetchAll('followups', from, to)); sources.push('followup')
  }
  const results = await Promise.allSettled(tasks)
  if (generation !== loadGeneration) return
  partial.value = false
  const events: CalendarEvent[] = []
  for (let index = 0; index < results.length; index++) {
    const result = results[index]
    if (!result || result.status === 'rejected') {
      error.value = 'No se pudieron cargar todas las actividades. Revisá tus permisos e intentá actualizar.'
      continue
    }
    partial.value ||= result.value.truncated
    for (const item of result.value.items) {
      const source = sources[index]
      if (!source) continue
      const at = normalizeTime(source === 'activity'
        ? item.scheduledStartAt ?? item.occurredAt : item.dueAt)
      if (!at) continue
      events.push({
        key: source + ':' + item.id, source, id: String(item.id),
        subject: String(item.subject ?? (source === 'followup' ? 'Seguimiento comercial' : 'Actividad')),
        type: source === 'followup' ? 'FOLLOWUP' : String(item.type ?? 'OTHER'),
        status: String(item.status ?? ''), at,
        accountId: String(item.accountId ?? ''), leadId: String(item.leadId ?? ''),
        ownerId: String(source === 'followup' ? item.assignedUserId ?? '' : item.ownerUserId ?? ''),
        rowVersion: Number(item.rowVersion ?? 0),
        reminderLeadMinutes: typeof item.reminderLeadMinutes === 'number' ? item.reminderLeadMinutes : null,
        reminderChannelStrategy: String(item.reminderChannelStrategy ?? 'BOTH'),
      })
    }
  }
  rows.value = events.sort((a, b) => a.at.getTime() - b.at.getTime())
  pending.value = false
}
watch(rangeKey, () => void load(), { immediate: true })
async function create() {
  const data = editor.value
  if (saving.value) return
  if (!data.subject.trim() || (!data.accountId && !data.leadId)) {
    error.value = 'Ingresá un título y seleccioná una cuenta o prospecto.'; return
  }
  const start = new Date(data.start)
  const end = new Date(data.end)
  if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() - 60000 ||
    (data.type !== 'FOLLOWUP' && (!Number.isFinite(end.getTime()) || end <= start))) {
    error.value = 'Ingresá fechas futuras válidas; la hora de finalización debe ser posterior al inicio.'; return
  }
  saving.value = true
  error.value = ''
  try {
    const common = {
      accountId: data.accountId || null, leadId: data.leadId || null, opportunityId: null,
      reminderLeadMinutes: data.reminderMinutes, reminderChannelStrategy: data.channel,
    }
    if (data.type === 'FOLLOWUP') {
      await crmRequest(crmPath('followups'), 'POST', {
        ...common, subject: data.subject.trim(), channel: 'SYSTEM',
        assignedUserId: data.ownerId || auth.userId, dueAt: start.toISOString(),
      })
    } else {
      await crmRequest(crmPath('activities'), 'POST', {
        ...common, contactId: data.contactId || null, ownerUserId: data.ownerId || auth.userId,
        type: data.type, subject: data.subject.trim(), scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(), occurredAt: null, locationText: data.location.trim() || null,
      })
    }
    creationOpen.value = false
    selected.value = start
    notice.value = 'Actividad creada. El recordatorio se programará para el vendedor asignado.'
    await load()
  } catch (cause) { error.value = crmError(cause) }
  finally { saving.value = false }
}
function detail(event: CalendarEvent) { void router.push('/crm/' + (event.source === 'activity' ? 'activities' : 'followups') + '/' + encodeURIComponent(event.id)) }
function openEvent(event: CalendarEvent) { active.value = event; error.value = ''; notice.value = '' }
</script>

<template>
  <section class="space-y-4" data-crm-sales-calendar>
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-wide text-[var(--dh-primary)]">Agenda comercial</p>
        <h2 class="mt-1 text-xl font-extrabold capitalize">{{ heading }}</h2>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ pendingCount }} actividades pendientes en este período · Fechas en tu zona horaria</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="calendar-btn" @click="selected=new Date()">Hoy</button>
        <button type="button" class="calendar-btn" aria-label="Período anterior" @click="navigate(-1)"><ChevronLeft class="h-4 w-4" /></button>
        <button type="button" class="calendar-btn" aria-label="Período siguiente" @click="navigate(1)"><ChevronRight class="h-4 w-4" /></button>
        <button type="button" class="calendar-btn" :disabled="pending" @click="load"><RefreshCw class="h-4 w-4" /></button>
        <button v-if="can('crm.activity.create') || can('crm.followup.manage') || can('crm.task.manage')"
          type="button" class="calendar-btn calendar-primary" @click="openCreation()"><Plus class="h-4 w-4" /> Nueva actividad</button>
      </div>
    </div>
    <div class="flex flex-wrap gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2">
      <button v-for="item in [{id:'month',label:'Mes'},{id:'week',label:'Semana'},{id:'day',label:'Día'},{id:'list',label:'Lista'}]"
        :key="item.id" type="button" class="calendar-btn" :aria-pressed="mode===item.id"
        :class="mode===item.id?'bg-[var(--dh-primary)]/15 text-[var(--dh-primary)]':''"
        @click="mode=item.id as CalendarMode">{{ item.label }}</button>
      <span v-if="pending" role="status" class="ml-auto self-center text-xs text-[var(--dh-text-muted)]">Cargando agenda…</span>
    </div>
    <p v-if="error && !creationOpen" role="alert" class="rounded-xl border border-red-500/30 px-4 py-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="notice" role="status" class="rounded-xl border border-emerald-500/30 px-4 py-3 text-sm text-emerald-600">{{ notice }}</p>
    <p v-if="partial" role="status" class="text-sm text-amber-500">Hay más de 1000 registros en este período; afiná las fechas para consultar el resto.</p>
    <div v-if="mode==='month' || mode==='week' || mode==='day'"
      class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div :class="mode==='day'?'grid grid-cols-1':'grid grid-cols-7'">
        <div v-for="day in visibleDays.slice(0,mode==='day'?1:7)" :key="'header'+dateKey(day)"
          class="border-b border-[var(--dh-border)] p-3 text-center text-xs font-bold capitalize text-[var(--dh-text-muted)]">
          {{ day.toLocaleDateString('es-CR',{weekday:'short'}) }}
        </div>
      </div>
      <div :class="mode==='day'?'grid grid-cols-1':'grid grid-cols-7'">
        <div v-for="day in visibleDays" :key="dateKey(day)"
          class="min-w-0 border-b border-r border-[var(--dh-border)] p-1.5 sm:p-2"
          :class="mode==='month'?'min-h-[115px]':mode==='week'?'min-h-[280px]':'min-h-[320px]'">
          <button type="button" :aria-label="'Crear actividad el '+dateKey(day)"
            class="mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
            :class="[dateKey(day)===dateKey(new Date())?'bg-[var(--dh-primary)] text-white':'hover:bg-[var(--dh-shell)]',
              mode==='month'&&day.getMonth()!==selected.getMonth()?'opacity-40':'']"
            @click="selected=day;openCreation(day)">{{ day.getDate() }}</button>
          <button v-for="event in (eventsByDay[dateKey(day)] ?? []).slice(0,mode==='month'?3:100)"
            :key="event.key" type="button" :title="event.subject" @click="openEvent(event)"
            class="mb-1 block w-full truncate rounded-md border px-1.5 py-1 text-left text-[11px] font-semibold"
            :class="eventTone(event)">
            <span class="tabular-nums">{{ event.at.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'}) }}</span>
            {{ event.subject }}
          </button>
          <button v-if="mode==='month' && (eventsByDay[dateKey(day)] ?? []).length>3"
            type="button" class="text-xs font-bold text-[var(--dh-primary)]"
            @click="selected=day;mode='day'">+{{ (eventsByDay[dateKey(day)] ?? []).length-3 }} más</button>
        </div>
      </div>
    </div>
    <div v-else class="space-y-3">
      <p v-if="!listDays.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-8 text-center text-sm text-[var(--dh-text-muted)]">Sin actividades programadas en este período.</p>
      <section v-for="item in listDays" :key="dateKey(item.day)" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <h3 class="mb-3 text-sm font-extrabold capitalize">{{ item.day.toLocaleDateString('es-CR',{weekday:'long',day:'numeric',month:'long'}) }}</h3>
        <button v-for="event in item.events" :key="event.key" type="button" @click="openEvent(event)"
          class="mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left last:mb-0" :class="eventTone(event)">
          <Clock3 class="h-4 w-4 shrink-0" />
          <span class="min-w-0 flex-1"><strong class="block truncate text-sm">{{ event.subject }}</strong>
            <span class="text-xs text-[var(--dh-text-muted)]">{{ labelFor(event) }} · {{ statusLabel(event.status) }}</span>
          </span>
          <span class="text-xs tabular-nums">{{ event.at.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'}) }}</span>
        </button>
      </section>
    </div>
    <div v-if="active" class="rounded-2xl border border-[var(--dh-primary)]/35 bg-[var(--dh-card)] p-4" role="region" aria-label="Detalle de actividad">
      <div class="flex justify-between gap-3">
        <div><h3 class="font-extrabold">{{ active.subject }}</h3>
          <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ labelFor(active) }} · {{ statusLabel(active.status) }} · {{ active.at.toLocaleString('es-CR') }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Recordatorio: {{ active.reminderLeadMinutes ?? 60 }} minutos antes · {{ active.reminderChannelStrategy==='BOTH'?'Sistema y correo':active.reminderChannelStrategy==='EMAIL'?'Correo':'Sistema' }}</p>
        </div>
        <button type="button" aria-label="Cerrar detalle" @click="active=null"><X class="h-4 w-4" /></button>
      </div>
      <button type="button" class="calendar-btn mt-3" @click="detail(active)">Abrir y gestionar actividad</button>
    </div>
    <div v-if="creationOpen" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 shadow-lg" aria-label="Nueva actividad comercial">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div><h3 class="text-lg font-extrabold">Programar actividad</h3>
          <p class="text-xs text-[var(--dh-text-muted)]">El vendedor asignado recibirá recordatorios por los canales seleccionados.</p>
        </div>
        <button type="button" aria-label="Cancelar creación" @click="creationOpen=false"><X class="h-4 w-4" /></button>
      </div>
      <p v-if="error" role="alert" class="mb-3 text-sm text-red-500">{{ error }}</p>
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="create">
        <label class="calendar-label">Tipo de actividad
          <select v-model="editor.type" class="calendar-input" required>
            <option v-for="item in eventTypes.filter(x=>x.value==='FOLLOWUP'?(can('crm.followup.manage')||can('crm.task.manage')):can('crm.activity.create'))"
              :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="calendar-label">Asunto o motivo
          <input v-model.trim="editor.subject" class="calendar-input" required maxlength="250" placeholder="Ej. Visita de seguimiento comercial" />
        </label>
        <div class="sm:col-span-2 space-y-2">
          <label class="calendar-label">Buscar cuenta
            <div class="flex gap-2">
              <input v-model="accountQuery" class="calendar-input min-w-0 flex-1" placeholder="Nombre del cliente" @keyup.enter.prevent="searchAccounts" />
              <button class="calendar-btn" type="button" @click="searchAccounts"><Search class="h-4 w-4" /> Buscar</button>
            </div>
          </label>
          <select v-model="editor.accountId" class="calendar-input" aria-label="Cuenta vinculada">
            <option value="">Sin cuenta — seleccionar un prospecto</option>
            <option v-for="item in accounts" :key="item.id" :value="item.id">{{ item.displayName || item.legalName }}</option>
          </select>
        </div>
        <label v-if="can('crm.lead.read')||can('crm.lead.read-all')" class="calendar-label">Prospecto (si no hay cuenta)
          <select v-model="editor.leadId" class="calendar-input" @focus="searchLeads">
            <option value="">Ninguno</option>
            <option v-for="item in leads" :key="item.id" :value="item.id">{{ item.name || item.companyName }}</option>
          </select>
        </label>
        <label v-if="editor.accountId && editor.type!=='FOLLOWUP' && can('crm.contact.read')" class="calendar-label">Contacto de la cuenta
          <select v-model="editor.contactId" class="calendar-input">
            <option value="">Sin contacto específico</option>
            <option v-for="contact in contactRows" :key="contact.id" :value="contact.id">{{ contact.name }}</option>
          </select>
        </label>
        <label class="calendar-label">Vendedor responsable
          <select v-model="editor.ownerId" class="calendar-input" required>
            <option v-for="owner in assignees" :key="owner" :value="owner">
              {{ owner===auth.userId?'Mi agenda':owner===selectedAccount?.executiveUserId?'Vendedor de la cuenta':owner }}
            </option>
          </select>
        </label>
        <label class="calendar-label">Inicio
          <input v-model="editor.start" type="datetime-local" class="calendar-input" required />
        </label>
        <label v-if="editor.type!=='FOLLOWUP'" class="calendar-label">Finalización
          <input v-model="editor.end" type="datetime-local" class="calendar-input" required />
        </label>
        <label v-if="editor.type!=='FOLLOWUP'" class="calendar-label">Lugar o enlace
          <input v-model="editor.location" class="calendar-input" maxlength="500" placeholder="Oficina, cliente o videollamada" />
        </label>
        <label class="calendar-label">Recordar
          <select v-model.number="editor.reminderMinutes" class="calendar-input">
            <option v-for="item in reminderOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="calendar-label">Canal de recordatorio
          <select v-model="editor.channel" class="calendar-input">
            <option value="BOTH">Sistema y correo</option>
            <option value="SYSTEM">Solo sistema</option>
            <option value="EMAIL">Solo correo</option>
          </select>
        </label>
        <div class="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <button type="button" class="calendar-btn" @click="creationOpen=false">Cancelar</button>
          <button type="submit" class="calendar-btn calendar-primary" :disabled="saving || !editor.ownerId">
            {{ saving?'Guardando…':'Guardar y programar recordatorio' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.calendar-btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border:1px solid var(--dh-border);border-radius:.7rem;padding:.6rem .8rem;font-size:.8rem;font-weight:750;min-height:38px;transition:background .15s}
.calendar-btn:hover:not(:disabled){background:var(--dh-card-hover)}
.calendar-btn:disabled{opacity:.55}
.calendar-primary{background:var(--dh-primary);border-color:var(--dh-primary);color:white}
.calendar-primary:hover:not(:disabled){filter:brightness(1.12);background:var(--dh-primary)}
.calendar-label{display:flex;flex-direction:column;gap:.4rem;font-size:.75rem;font-weight:700;color:var(--dh-text-muted)}
.calendar-input{width:100%;min-width:0;border:1px solid var(--dh-border);border-radius:.7rem;padding:.7rem .8rem;color:var(--dh-text);background:var(--dh-input);font-size:.85rem}
.calendar-input:focus{outline:2px solid var(--dh-primary);outline-offset:1px}
</style>
