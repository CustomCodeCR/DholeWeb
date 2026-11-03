<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { DhModal } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw, Search, X } from 'lucide-vue-next'
import { crmList, crmPath, crmRequest, crmError, type CrmRow } from '../services/crmApi'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { crmAgreementDrafts, type CrmAgreementDraft } from '../model/crmAgreementParser'

type CalendarMode = 'month' | 'week' | 'day' | 'list'
type Source = 'activity' | 'followup'
const props = withDefaults(defineProps<{
  accountId?: string; accountName?: string; leadId?: string; leadName?: string
}>(), { accountId: '', accountName: '', leadId: '', leadName: '' })
const scopedAccount = computed(() => Boolean(props.accountId))
const scopedLead = computed(() => Boolean(props.leadId))
const scopedRecord = computed(() => scopedAccount.value || scopedLead.value)
const emit = defineEmits<{ changed: [] }>()
interface CalendarEvent {
  key: string
  source: Source
  id: string
  subject: string
  type: string
  status: string
  at: Date
  endsAt: Date | null
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
const agreementDrafts = ref<CrmAgreementDraft[]>([])
const calendarLabels = ref<{
  accounts: Record<string, string>; leads: Record<string, string>; owners: Record<string, string>
}>({ accounts: {}, leads: {}, owners: {} })
const ownerFilter = ref('')
const clientFilter = ref('')
const isManagerCalendar = computed(() => !scopedRecord.value &&
  (can('crm.activity.read-all') || can('crm.account.read-all') || can('crm.lead.read-all')))
const sellerPalette = ['#047857', '#2563eb', '#7c3aed', '#c2410c', '#b45309',
  '#0891b2', '#be185d', '#4f46e5', '#65a30d', '#0f766e']
function sellerColor(userId: string): string {
  let hash = 0
  for (const char of userId) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
  return sellerPalette[hash % sellerPalette.length] ?? sellerPalette[0]!
}
function ownerName(event: CalendarEvent): string {
  return calendarLabels.value.owners[event.ownerId] ||
    (event.ownerId === auth.userId ? 'Mi agenda' : 'Vendedor asignado')
}
function clientName(event: CalendarEvent): string {
  return calendarLabels.value.accounts[event.accountId] ||
    calendarLabels.value.leads[event.leadId] || 'Cliente vinculado'
}
function clientKey(event: CalendarEvent): string {
  return event.accountId ? 'a:' + event.accountId : 'l:' + event.leadId
}
const ownerChoices = computed(() => [...new Set(rows.value.map(x => x.ownerId).filter(Boolean))]
  .sort((a,b) => (calendarLabels.value.owners[a] || a)
    .localeCompare(calendarLabels.value.owners[b] || b)))
const clientChoices = computed(() => {
  const names = new Map<string, string>()
  for (const item of rows.value) names.set(clientKey(item), clientName(item))
  return [...names].sort((a,b) => a[1].localeCompare(b[1]))
})
const visibleRows = computed(() => rows.value.filter(row =>
  (!isManagerCalendar.value || !ownerFilter.value || row.ownerId === ownerFilter.value) &&
  (!isManagerCalendar.value || !clientFilter.value || clientKey(row) === clientFilter.value)))
function sellerEventStyle(event: CalendarEvent) {
  const color = sellerColor(event.ownerId)
  return { borderLeftColor: color, borderLeftWidth: '5px', backgroundColor: color + '15' }
}
const accounts = ref<CrmRow[]>([])
const leads = ref<CrmRow[]>([])
const contactRows = ref<CrmRow[]>([])
const accountQuery = ref('')
const leadQuery = ref('')
const leadSearchLoading = ref(false)
const leadSearchError = ref('')
const pending = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const partial = ref(false)
const draggedKey = ref('')
const dropKey = ref('')
const moving = ref(false)
const moveAt = ref('')
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
  involved: '',
  agreements: '',
  nextCommitment: '',
  commitmentDue: '',
  reminderMinutes: 60,
  channel: 'BOTH',
})
watch(() => editor.value.agreements, (text) => {
  const reference = new Date(editor.value.start || Date.now())
  const parsed = crmAgreementDrafts(text, Number.isFinite(reference.getTime()) ? reference : new Date())
  agreementDrafts.value = parsed.map(row => {
    const previous = agreementDrafts.value.find(d => d.source === row.source)
    return previous ? { ...row, title: previous.title, dueLocal: previous.dueLocal,
      hasExplicitTime: previous.hasExplicitTime } : row
  })
})

const eventTypes = [
  { value: 'VISIT', label: 'Visita' },
  { value: 'CALL', label: 'Llamada' },
  { value: 'MEETING', label: 'Reunión / Teams' },
  { value: 'EMAIL', label: 'Correo electrónico' },
  { value: 'FOLLOWUP', label: 'Seguimiento' },
  { value: 'OTHER', label: 'Tarea' },
] as const
const configuredActivityTypes = ref<Array<{ value: string; label: string }>>([])
const activityTypesLoading = ref(false)
const activityTypesError = ref('')
let activityTypesFetched = false
// Validate against Config instead of sending static VISIT/CALL/MEETING values
// that the CRM API may reject as "Unknown activity type in Config".
async function loadConfiguredActivityTypes() {
  if (activityTypesLoading.value || (activityTypesFetched && configuredActivityTypes.value.length)) return
  activityTypesLoading.value = true
  activityTypesError.value = ''
  try {
    const groupSlugs = ['crm-activity-types', 'activity-types', 'crm-activities', 'activity-type']
    for (const catalogGroupSlug of groupSlugs) {
      const items = await CatalogItemsService.select({ catalogGroupSlug }).catch(() => [])
      if (!items.length) continue
      const values: Array<{ value: string; label: string }> = []
      for (const item of items) {
        if (item.isActive === false) continue
        // CRM checks the exact Config item CODE with GetCatalogItemByCode,
        // and CommercialRules only accepts these five canonical codes.
        const code = String(item.code ?? '').trim().toUpperCase()
        const known = eventTypes.find(type => type.value === code && code !== 'FOLLOWUP')
        if (known) values.push({ value: code, label: known.label })
      }
      if (values.length) {
        configuredActivityTypes.value = Array.from(new Map(values.map(x => [x.value, x])).values())
        activityTypesFetched = true
        break
      }
    }
    if (!configuredActivityTypes.value.length) {
      activityTypesError.value = 'No hay tipos de actividad disponibles en Config. El administrador debe configurar Visita, Llamada y Reunión en el catálogo de tipos de actividad para poder registrarlos.'
      if (can('crm.followup.manage') || can('crm.task.manage')) editor.value.type = 'FOLLOWUP'
    } else if (!configuredActivityTypes.value.some(type => type.value === editor.value.type)) {
      editor.value.type = configuredActivityTypes.value[0]?.value ?? 'FOLLOWUP'
    }
  } finally { activityTypesLoading.value = false }
}
const selectableActivityTypes = computed(() => [
  ...configuredActivityTypes.value.filter(() => can('crm.activity.create')),
  ...(can('crm.followup.manage') || can('crm.task.manage')
    ? [{ value: 'FOLLOWUP', label: 'Seguimiento' }] : []),
])
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
const timeSlots = Array.from({ length: 28 }, (_, index) => ({
  hour: 7 + Math.floor(index / 2), minute: (index % 2) * 30,
  label: String(7 + Math.floor(index / 2)).padStart(2,'0') +
    ':' + (index % 2 ? '30' : '00'),
}))
function slotDate(day: Date, slot: { hour: number; minute: number }): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), slot.hour, slot.minute)
}
function slotEvents(day: Date, slot: { hour: number; minute: number }): CalendarEvent[] {
  return (eventsByDay.value[dateKey(day)] ?? []).filter(item =>
    item.at.getHours() === slot.hour &&
    Math.floor(item.at.getMinutes() / 30) === slot.minute / 30)
}
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
  for (const row of visibleRows.value) (result[dateKey(row.at)] ??= []).push(row)
  for (const bucket of Object.values(result)) bucket.sort((a, b) => a.at.getTime() - b.at.getTime())
  return result
})
const outsideOfficeHours = computed(() => visibleRows.value.filter(item =>
  (item.at.getHours() < 7 || item.at.getHours() >= 21) &&
  item.at >= rangeStart.value && item.at < rangeEnd.value))
const listDays = computed(() => visibleDays.value
  .map(day => ({ day, events: eventsByDay.value[dateKey(day)] ?? [] }))
  .filter(item => item.events.length > 0))
const pendingCount = computed(() => visibleRows.value.filter(x => x.status === 'Pending' || x.status === 'Scheduled' || x.status === 'Overdue').length)
const selectedAccount = computed(() => accounts.value.find(x => x.id === editor.value.accountId))
const selectedLead = computed(() => leads.value.find(x => x.id === editor.value.leadId))
const assignees = computed(() => {
  const mine = String(auth.userId ?? '')
  const seller = editor.value.accountId && selectedAccount.value?.isCastroFallasExecutive !== true
    ? String(selectedAccount.value?.executiveUserId ?? '')
    : editor.value.leadId ? String(selectedLead.value?.executiveUserId ?? '') : ''
  return [...new Set([mine, seller].filter(Boolean))]
})
function labelFor(event: CalendarEvent) {
  return eventTypes.find(type => type.value === event.type)?.label ?? event.type
}
function effectiveStatus(event: CalendarEvent): string {
  if ((event.status === 'Scheduled' || event.status === 'Pending') &&
      (event.endsAt ?? event.at).getTime() < Date.now()) return 'Overdue'
  return event.status
}
const overdueCount = computed(() => visibleRows.value.filter(item => effectiveStatus(item) === 'Overdue').length)
const completedCount = computed(() => visibleRows.value.filter(item => item.status === 'Completed').length)
function statusLabel(status: string) {
  return ({ Pending: 'Pendiente', Scheduled: 'Programado', Overdue: 'Vencido',
    Completed: 'Completado', Cancelled: 'Cancelado' } as Record<string, string>)[status] ?? status
}
function eventTone(event: CalendarEvent) {
  const status = effectiveStatus(event)
  return status === 'Completed' ? 'border-emerald-500/30 bg-emerald-500/10'
    : status === 'Cancelled' ? 'border-[var(--dh-border)] opacity-60'
      : status === 'Overdue' ? 'border-amber-500/50 bg-amber-500/10'
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
  const now = new Date()
  const when = date
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), now.getHours(), now.getMinutes())
    : now
  when.setSeconds(0, 0)
  editor.value = {
    type: 'VISIT', subject: '', accountId: props.accountId, leadId: props.leadId, contactId: '',
    ownerId: String(auth.userId ?? ''), start: localInput(when),
    end: localInput(new Date(when.getTime() + 60 * 60000)),
    location: '', involved: '', agreements: '', nextCommitment: '', commitmentDue: '',
    reminderMinutes: 60, channel: 'BOTH',
  }
  agreementDrafts.value = []
  error.value = ''
  creationOpen.value = true
  void loadConfiguredActivityTypes()
  // Account-local calendars must preselect the real assigned commercial seller.
  if (props.accountId && (can('crm.account.read') || can('crm.account.read-all'))) {
    void crmRequest<CrmRow>(crmPath('accounts', props.accountId)).then(account => {
      if (!creationOpen.value || editor.value.accountId !== account.id) return
      accounts.value = [account]
      const assigned = String(account.executiveUserId ?? auth.userId ?? '')
      if (can('crm.activity.read-all') && assigned) editor.value.ownerId = assigned
    }).catch(() => { /* Keep the form usable for an authorized account seller. */ })
  }
  if (!scopedRecord.value) {
    if (can('crm.lead.read') || can('crm.lead.read-all')) void searchLeads()
    void searchAccounts()
  } else if (scopedLead.value && (can('crm.lead.read') || can('crm.lead.read-all'))) {
    void crmRequest<CrmRow>(crmPath('leads', props.leadId)).then(item => {
      if (editor.value.leadId === item.id) leads.value = [item]
    }).catch(() => { /* Keep the preselected prospect even if a refresh is denied. */ })
  }
}
watch(() => editor.value.start, value => {
  const when = new Date(value)
  if (Number.isFinite(when.getTime()))
    editor.value.end = localInput(new Date(when.getTime() + 60 * 60000))
})
async function searchAccounts() {
  try {
    const result = await crmList('accounts', { q: accountQuery.value.trim(), page: 1, pageSize: 100 })
    accounts.value = result.items
  } catch (cause) { error.value = crmError(cause) }
}
async function searchLeads() {
  if (!can('crm.lead.read') && !can('crm.lead.read-all')) return
  leadSearchLoading.value = true
  leadSearchError.value = ''
  try {
    const list = await crmList('leads', { q: leadQuery.value.trim() || undefined, page: 1, pageSize: 100 })
    leads.value = list.items
    if (!list.items.length) leadSearchError.value = 'No se encontraron prospectos asignados para esta búsqueda.'
    else if (list.total > list.items.length) leadSearchError.value = 'Mostrando los primeros 100 prospectos. Escribí parte del nombre para encontrar otro.'
  } catch (cause) { leadSearchError.value = crmError(cause); leads.value = [] }
  finally { leadSearchLoading.value = false }
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
  if (leadId) {
    editor.value.accountId = ''; editor.value.contactId = ''
    const executiveId = String(selectedLead.value?.executiveUserId ?? auth.userId ?? '')
    editor.value.ownerId = (can('crm.activity.read-all') || can('crm.lead.read-all'))
      ? executiveId : String(auth.userId ?? '')
  }
})
async function fetchAll(resource: string, from: string, to: string): Promise<{ items: CrmRow[]; truncated: boolean }> {
  const all: CrmRow[] = []
  let total = 0
  for (let page = 1; page <= 10; page++) {
    const response = await crmList(resource, { from, to, page, pageSize: 100,
      accountId: props.accountId || undefined,
      leadId: props.leadId || undefined })
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
      // Followups API currently exposes accountId but not leadId as a query param.
      // Filter the authorized date-bounded results locally for the lead record.
      if (props.leadId && source === 'followup' && String(item.leadId ?? '') !== props.leadId) continue
      const at = normalizeTime(source === 'activity'
        ? item.scheduledStartAt ?? item.occurredAt : item.dueAt)
      if (!at) continue
      events.push({
        key: source + ':' + item.id, source, id: String(item.id),
        subject: String(item.subject ?? (source === 'followup' ? 'Seguimiento comercial' : 'Actividad')),
        type: source === 'followup' ? 'FOLLOWUP' : String(item.type ?? 'OTHER'),
        status: String(item.status ?? ''), at,
        endsAt: source === 'activity' ? normalizeTime(item.scheduledEndAt) : null,
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
  void loadCalendarLabels(events, generation)
}
async function loadCalendarLabels(events: CalendarEvent[], generation: number) {
  const accounts = [...new Set(events.map(e => e.accountId).filter(Boolean))]
  const leads = [...new Set(events.map(e => e.leadId).filter(Boolean))]
  const owners = [...new Set(events.map(e => e.ownerId).filter(Boolean))]
  const merged = { accounts: {} as Record<string,string>,
    leads: {} as Record<string,string>, owners: {} as Record<string,string> }
  const batches = Math.max(1, Math.ceil(accounts.length / 100),
    Math.ceil(leads.length / 100), Math.ceil(owners.length / 100))
  for (let i = 0; i < batches; i++) {
    if (generation !== loadGeneration) return
    const params = new URLSearchParams({
      accountIds: accounts.slice(i * 100, (i + 1) * 100).join(','),
      leadIds: leads.slice(i * 100, (i + 1) * 100).join(','),
      ownerIds: owners.slice(0, 100).join(','),
    })
    try {
      const result = await crmRequest<typeof merged>(crmPath('calendar/labels') + '?' + params.toString())
      Object.assign(merged.accounts, result.accounts ?? {})
      Object.assign(merged.leads, result.leads ?? {})
      Object.assign(merged.owners, result.owners ?? {})
    } catch { /* Calendar still works if a label provider is unavailable. */ }
  }
  if (generation === loadGeneration) calendarLabels.value = merged
}

watch([rangeKey, () => props.accountId, () => props.leadId], () => void load(), { immediate: true })
async function create() {
  const data = editor.value
  if (saving.value) return
  if (activityTypesLoading.value) { error.value = 'Consultando los tipos de actividad de Config…'; return }
  if (data.type !== 'FOLLOWUP' && !configuredActivityTypes.value.some(item => item.value === data.type)) {
    error.value = activityTypesError.value || 'El tipo de actividad no existe en Config. Actualizá el catálogo y volvé a intentar.'
    return
  }
  if (!data.subject.trim() || (!data.accountId && !data.leadId)) {
    error.value = 'Ingresá un título y seleccioná una cuenta o prospecto.'; return
  }
  const start = new Date(data.start)
  const end = new Date(data.end)
  const commitmentDue = data.nextCommitment.trim() ? new Date(data.commitmentDue) : null
  if (data.type !== 'FOLLOWUP' && agreementDrafts.value.some(item =>
      !item.title.trim() || !item.dueLocal ||
      !Number.isFinite(new Date(item.dueLocal).getTime()) ||
      new Date(item.dueLocal).getTime() < Date.now())) {
    error.value = 'Revisá cada acuerdo y asignale una fecha futura válida antes de guardar.'
    return
  }
  if (data.type !== 'FOLLOWUP' && data.nextCommitment.trim() &&
      (!commitmentDue || !Number.isFinite(commitmentDue.getTime()) ||
       commitmentDue.getTime() <= end.getTime())) {
    error.value = 'Indicá una fecha límite posterior a la actividad para el compromiso.'; return
  }
  if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() - 60000 ||
    (data.type !== 'FOLLOWUP' && (!Number.isFinite(end.getTime()) || end <= start))) {
    error.value = 'Ingresá fechas futuras válidas; la hora de finalización debe ser posterior al inicio.'; return
  }
  saving.value = true
  error.value = ''
  try {
    const common = {
      accountId: data.accountId || null, leadId: data.leadId || null, opportunityId: null,
      reminderLeadMinutes: data.reminderMinutes, reminderChannelStrategy: 'BOTH',
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
        involved: data.involved.trim() || null, agreements: data.agreements.trim() || null,
        nextCommitment: data.nextCommitment.trim() || null,
        commitmentDueAt: commitmentDue?.toISOString() ?? null,
        agreementCommitments: agreementDrafts.value.map(item => ({
          subject: item.title.trim(), dueAt: new Date(item.dueLocal).toISOString(),
        })),
      })
    }
    creationOpen.value = false
    selected.value = start
    notice.value = 'Actividad y acuerdos registrados. Se programaron ' +
      (agreementDrafts.value.length + (data.nextCommitment.trim() ? 1 : 0)) +
      ' compromisos en el calendario del cliente y del vendedor.'
    emit('changed')
    await load()
  } catch (cause) { error.value = crmError(cause) }
  finally { saving.value = false }
}
function canMove(item: CalendarEvent): boolean {
  if (moving.value) return false
  if (item.source === 'activity')
    return item.status === 'Scheduled' && can('crm.activity.update')
  return (item.status === 'Pending' || item.status === 'Overdue') &&
    (can('crm.followup.manage') || can('crm.task.manage'))
}
function onDragStart(e: DragEvent, item: CalendarEvent) {
  if (!canMove(item) || !e.dataTransfer) { e.preventDefault(); return }
  draggedKey.value = item.key
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', item.key)
}
function onDragEnd() { draggedKey.value = ''; dropKey.value = '' }
function onSlotOver(e: DragEvent, slot: Date) {
  if (!draggedKey.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropKey.value = slot.toISOString()
}
function onSlotDrop(e: DragEvent, slot: Date) {
  e.preventDefault()
  const key = e.dataTransfer?.getData('text/plain') || draggedKey.value
  const item = rows.value.find(row => row.key === key)
  onDragEnd()
  if (item && canMove(item)) void reschedule(item, slot)
}
function onDragOver(e: DragEvent, day: Date) {
  if (!draggedKey.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropKey.value = dateKey(day)
}
async function reschedule(item: CalendarEvent, proposed: Date) {
  if (!canMove(item) || Number.isNaN(proposed.getTime())) return
  if (proposed.getTime() <= Date.now()) {
    error.value = 'La nueva fecha y hora debe estar en el futuro.'
    return
  }
  if (item.at.getTime() === proposed.getTime()) return
  moving.value = true
  error.value = ''; notice.value = ''
  try {
    if (item.source === 'activity') {
      const durationMs = item.endsAt ? item.endsAt.getTime() - item.at.getTime() : 30 * 60000
      await crmRequest(crmPath('activities', item.id, 'reschedule'), 'POST', {
        expectedVersion: item.rowVersion,
        scheduledStartAt: proposed.toISOString(),
        scheduledEndAt: new Date(proposed.getTime() + Math.max(60000, durationMs)).toISOString(),
        reason: 'Reprogramación desde el calendario CRM',
      })
    } else {
      await crmRequest(crmPath('followups', item.id, 'reschedule'), 'POST', {
        expectedVersion: item.rowVersion, dueAt: proposed.toISOString(),
        reason: 'Reprogramación desde el calendario CRM',
      })
    }
    active.value = null
    selected.value = proposed
    notice.value = 'Actividad reprogramada y guardada. Se actualizarán sus recordatorios.'
    emit('changed')
    await load()
  } catch (cause) {
    error.value = crmError(cause)
    await load()
  } finally { moving.value = false; onDragEnd() }
}
function onDrop(e: DragEvent, day: Date) {
  e.preventDefault()
  const key = e.dataTransfer?.getData('text/plain') || draggedKey.value
  const item = rows.value.find(row => row.key === key)
  onDragEnd()
  if (!item || !canMove(item)) return
  const proposed = new Date(day.getFullYear(), day.getMonth(), day.getDate(),
    item.at.getHours(), item.at.getMinutes(), item.at.getSeconds())
  void reschedule(item, proposed)
}
function applyManualMove() {
  if (!active.value || !moveAt.value) return
  void reschedule(active.value, new Date(moveAt.value))
}
function detail(item: CalendarEvent) {
  void router.push({
    path: '/crm/' + (item.source === 'activity' ? 'activities' : 'followups') + '/' + encodeURIComponent(item.id),
    query: props.accountId ? { fromAccount: props.accountId } : undefined,
  })
}
function openEvent(item: CalendarEvent) {
  active.value = item; moveAt.value = localInput(item.at)
  error.value = ''; notice.value = ''
}
</script>

<template>
  <section class="space-y-4" data-crm-sales-calendar>
    <div class="sticky top-[112px] z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-sm">
      <div>
        <p class="text-xs font-bold uppercase tracking-wide text-[var(--dh-primary)]">Agenda comercial</p>
        <h2 class="mt-1 text-xl font-extrabold capitalize">{{ heading }}</h2>
        <p v-if="scopedAccount" class="mt-1 text-xs font-bold text-[var(--dh-primary)]">Calendario de {{ accountName || 'esta cuenta' }}</p>
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
    <div v-if="isManagerCalendar" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
      <p class="mb-3 text-sm font-bold">Vista general de compromisos · Todos los clientes y vendedores autorizados</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="calendar-label">Filtrar por vendedor
          <select v-model="ownerFilter" class="calendar-input">
            <option value="">Todos los vendedores</option>
            <option v-for="ownerId in ownerChoices" :key="ownerId" :value="ownerId">
              {{ calendarLabels.owners[ownerId] || (ownerId===auth.userId?'Mi agenda':'Vendedor asignado') }}
            </option>
          </select>
        </label>
        <label class="calendar-label">Filtrar por cliente
          <select v-model="clientFilter" class="calendar-input">
            <option value="">Todos los clientes</option>
            <option v-for="[key, name] in clientChoices" :key="key" :value="key">{{ name }}</option>
          </select>
        </label>
      </div>
      <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <span v-for="ownerId in ownerChoices" :key="ownerId"
          class="inline-flex items-center gap-2 text-xs text-[var(--dh-text-muted)]">
          <span class="h-2.5 w-2.5 rounded-full" :style="{backgroundColor:sellerColor(ownerId)}"></span>
          {{ calendarLabels.owners[ownerId] || (ownerId===auth.userId?'Mi agenda':'Vendedor asignado') }}
        </span>
      </div>
    </div>
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
        <p class="text-xs text-[var(--dh-text-muted)]">Compromisos pendientes</p>
        <strong class="mt-1 block text-xl">{{ pendingCount }}</strong>
      </div>
      <div class="rounded-xl border border-amber-500/30 bg-[var(--dh-card)] p-3">
        <p class="text-xs text-[var(--dh-text-muted)]">Sin atender / vencidos</p>
        <strong class="mt-1 block text-xl text-amber-600">{{ overdueCount }}</strong>
      </div>
      <div class="rounded-xl border border-emerald-500/30 bg-[var(--dh-card)] p-3">
        <p class="text-xs text-[var(--dh-text-muted)]">Completados</p>
        <strong class="mt-1 block text-xl text-emerald-600">{{ completedCount }}</strong>
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
    <p class="text-xs text-[var(--dh-text-muted)]">Arrastrá una visita, llamada o seguimiento pendiente a otro día para reprogramarlo. También podés elegir fecha y hora desde el detalle.</p>
    <p v-if="moving" role="status" class="text-sm text-[var(--dh-primary)]">Guardando nueva fecha en CRM…</p>
    <div v-if="mode==='month'"
      class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div class="grid grid-cols-7">
        <div v-for="day in visibleDays.slice(0,7)" :key="'header'+dateKey(day)"
          class="border-b border-[var(--dh-border)] p-3 text-center text-xs font-bold capitalize text-[var(--dh-text-muted)]">
          {{ day.toLocaleDateString('es-CR',{weekday:'short'}) }}
        </div>
      </div>
      <div class="grid grid-cols-7">
        <div v-for="day in visibleDays" :key="dateKey(day)"
          class="min-w-0 cursor-pointer border-b border-r border-[var(--dh-border)] p-1.5 transition-colors hover:bg-[var(--dh-shell)] sm:p-2"
          :class="['min-h-[115px]',
            dropKey===dateKey(day)?'bg-[var(--dh-primary)]/15 ring-2 ring-inset ring-[var(--dh-primary)]':'']"
          @dragover="onDragOver($event,day)" @dragenter.prevent="onDragOver($event,day)"
          @dragleave="dropKey=''" @drop="onDrop($event,day)"
          @click.self="selected=day;openCreation(day)">
          <button type="button" :aria-label="'Crear actividad el '+dateKey(day)"
            class="mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
            :class="[dateKey(day)===dateKey(new Date())?'bg-[var(--dh-primary)] text-white':'hover:bg-[var(--dh-shell)]',
              mode==='month'&&day.getMonth()!==selected.getMonth()?'opacity-40':'']"
            @click="selected=day;openCreation(day)">{{ day.getDate() }}</button>
          <button v-for="event in (eventsByDay[dateKey(day)] ?? []).slice(0,mode==='month'?3:100)"
            :key="event.key" type="button" :title="event.subject"
            :draggable="canMove(event)" :aria-label="event.subject + (canMove(event)?' · arrastrable':'')"
            @dragstart="onDragStart($event,event)" @dragend="onDragEnd"
            @click="openEvent(event)"
            class="mb-1 block w-full truncate rounded-md border px-1.5 py-1 text-left text-[11px] font-semibold"
            :class="eventTone(event)" :style="sellerEventStyle(event)">
            <span class="tabular-nums">{{ event.at.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'}) }}</span>
            {{ event.subject }}
            <span v-if="isManagerCalendar" class="block truncate text-[10px] opacity-80">
              {{ clientName(event) }} · {{ ownerName(event) }}
            </span>
          </button>
          <button v-if="mode==='month' && (eventsByDay[dateKey(day)] ?? []).length>3"
            type="button" class="text-xs font-bold text-[var(--dh-primary)]"
            @click="selected=day;mode='day'">+{{ (eventsByDay[dateKey(day)] ?? []).length-3 }} más</button>
        </div>
      </div>
    </div>
    <div v-else-if="mode==='week' || mode==='day'"
      class="max-h-[680px] overflow-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
      <div :class="mode==='week'?'min-w-[750px]':'min-w-[300px]'">
        <div class="sticky top-0 z-10 grid border-b border-[var(--dh-border)] bg-[var(--dh-card)]"
          :style="{ gridTemplateColumns: '70px repeat(' + (mode==='week'?7:1) + ', minmax(0,1fr))' }">
          <div class="border-r border-[var(--dh-border)] p-3 text-xs font-bold text-[var(--dh-text-muted)]">Hora</div>
          <div v-for="day in visibleDays" :key="dateKey(day)"
            class="border-r border-[var(--dh-border)] p-3 text-center text-xs font-bold capitalize">
            {{ day.toLocaleDateString('es-CR',{weekday:'short',day:'numeric',month:'short'}) }}
          </div>
        </div>
        <div v-for="slot in timeSlots" :key="slot.label" class="grid"
          :style="{ gridTemplateColumns: '70px repeat(' + (mode==='week'?7:1) + ', minmax(0,1fr))' }">
          <div class="border-b border-r border-[var(--dh-border)] p-2 text-right text-[11px] tabular-nums text-[var(--dh-text-muted)]">{{ slot.label }}</div>
          <div v-for="day in visibleDays" :key="dateKey(day)"
            class="min-h-[52px] border-b border-r border-[var(--dh-border)] p-1"
            :class="dropKey===slotDate(day,slot).toISOString()?'bg-[var(--dh-primary)]/15 ring-2 ring-inset ring-[var(--dh-primary)]':''"
            @dragover="onSlotOver($event,slotDate(day,slot))"
            @dragenter.prevent="onSlotOver($event,slotDate(day,slot))"
            @dragleave="dropKey=''" @drop="onSlotDrop($event,slotDate(day,slot))"
            tabindex="0" :aria-label="'Agendar actividad el '+dateKey(day)+' a las '+slot.label"
            @click.self="openCreation(slotDate(day,slot))"
            @keydown.enter.self="openCreation(slotDate(day,slot))">
            <button v-for="item in slotEvents(day,slot)" :key="item.key" type="button"
              :draggable="canMove(item)" :title="item.subject"
              @dragstart="onDragStart($event,item)" @dragend="onDragEnd"
              @click="openEvent(item)"
              class="mb-1 block w-full truncate rounded-lg border p-2 text-left text-xs font-bold"
              :class="eventTone(item)" :style="sellerEventStyle(item)">
              {{ item.at.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'}) }} · {{ item.subject }}
              <span v-if="isManagerCalendar" class="block truncate text-[10px] opacity-80">
                {{ clientName(item) }} · {{ ownerName(item) }}
              </span>
            </button>
          </div>
        </div>
        <div v-if="outsideOfficeHours.length" class="space-y-2 border-t border-[var(--dh-border)] p-3">
          <p class="text-xs font-bold">Eventos fuera del horario de 07:00 a 21:00</p>
          <button v-for="item in outsideOfficeHours" :key="item.key" type="button"
            class="calendar-btn mr-2" @click="openEvent(item)">
            {{ item.at.toLocaleString('es-CR') }} · {{ item.subject }}
          </button>
        </div>
      </div>
    </div>
    <div v-else class="space-y-3">
      <p v-if="!listDays.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-8 text-center text-sm text-[var(--dh-text-muted)]">Sin actividades programadas en este período.</p>
      <section v-for="item in listDays" :key="dateKey(item.day)" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <h3 class="mb-3 text-sm font-extrabold capitalize">{{ item.day.toLocaleDateString('es-CR',{weekday:'long',day:'numeric',month:'long'}) }}</h3>
        <button v-for="event in item.events" :key="event.key" type="button" @click="openEvent(event)"
          class="mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left last:mb-0" :class="eventTone(event)" :style="sellerEventStyle(event)">
          <Clock3 class="h-4 w-4 shrink-0" />
          <span class="min-w-0 flex-1"><strong class="block truncate text-sm">{{ event.subject }}</strong>
            <span class="text-xs text-[var(--dh-text-muted)]">
              {{ labelFor(event) }} · {{ statusLabel(effectiveStatus(event)) }} · {{ clientName(event) }} · {{ ownerName(event) }}
            </span>
          </span>
          <span class="text-xs tabular-nums">{{ event.at.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'}) }}</span>
        </button>
      </section>
    </div>
    <DhModal :open="Boolean(active)" title="Detalle de actividad comercial" size="lg" @close="active=null">
      <div v-if="active" class="space-y-3">
      <div class="flex justify-between gap-3">
        <div><h3 class="font-extrabold">{{ active.subject }}</h3>
          <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ labelFor(active) }} · {{ statusLabel(effectiveStatus(active)) }} · {{ active.at.toLocaleString('es-CR') }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Cliente: {{ clientName(active) }} · Vendedor: {{ ownerName(active) }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Recordatorios: 24 horas, 1 hora, al inicio y cada 24 horas si vence. Siempre sistema y correo.</p>
        </div>
        <button type="button" aria-label="Cerrar detalle" @click="active=null"><X class="h-4 w-4" /></button>
      </div>
      <div v-if="canMove(active)" class="mt-3 flex flex-wrap items-end gap-2">
        <label class="calendar-label">Cambiar fecha y hora
          <input v-model="moveAt" class="calendar-input" type="datetime-local" />
        </label>
        <button type="button" class="calendar-btn calendar-primary" :disabled="moving || !moveAt"
          @click="applyManualMove">Reprogramar</button>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="calendar-btn" @click="detail(active)">Abrir y gestionar actividad</button>
        <button v-if="active.accountId" type="button" class="calendar-btn"
          @click="router.push('/crm/accounts/'+encodeURIComponent(active.accountId))">Volver a la cuenta</button>
      </div>
      </div>
    </DhModal>
    <DhModal :open="creationOpen" title="Programar visita, llamada o seguimiento" size="lg" @close="creationOpen=false">
      <div class="space-y-4">
      <p class="text-xs text-[var(--dh-text-muted)]">El vendedor recibirá avisos por sistema y correo. Si no atiende el compromiso, se informará a jmesen después del vencimiento.</p>
      <div v-if="activityTypesLoading" role="status" class="text-xs text-[var(--dh-text-muted)]">Consultando tipos de actividades en Config…</div>
      <div v-if="activityTypesError" role="alert" class="rounded-xl border border-amber-500/40 p-3 text-xs text-amber-600">
        {{ activityTypesError }}
        <button type="button" class="ml-2 font-bold underline" @click="loadConfiguredActivityTypes">Reintentar consulta</button>
      </div>
      <p v-if="error" role="alert" class="mb-3 text-sm text-red-500">{{ error }}</p>
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="create">
        <label class="calendar-label">Tipo de actividad
          <select v-model="editor.type" class="calendar-input" required>
            <option v-if="!selectableActivityTypes.some(item => item.value === editor.type)" :value="editor.type" disabled>Seleccionar tipo disponible</option>
            <option v-for="item in selectableActivityTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="calendar-label">Asunto o motivo
          <input v-model.trim="editor.subject" class="calendar-input" required maxlength="250" placeholder="Ej. Visita de seguimiento comercial" />
        </label>
        <div v-if="!scopedRecord" class="sm:col-span-2 space-y-2">
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
        <div v-if="!scopedRecord && (can('crm.lead.read')||can('crm.lead.read-all'))" class="sm:col-span-2 space-y-2">
          <label class="calendar-label">Buscar prospecto por nombre o empresa
            <div class="flex gap-2">
              <input v-model.trim="leadQuery" type="search" class="calendar-input min-w-0 flex-1"
                placeholder="Buscar prospecto asignado…" @keyup.enter.prevent="searchLeads" />
              <button type="button" class="calendar-btn" :disabled="leadSearchLoading" @click="searchLeads">
                <Search class="h-4 w-4" /> Buscar
              </button>
            </div>
          </label>
          <label class="calendar-label">Prospecto (si no hay cuenta)
            <select v-model="editor.leadId" class="calendar-input" @focus="!leads.length && searchLeads()">
              <option value="">Seleccionar prospecto</option>
              <option v-for="item in leads" :key="item.id" :value="item.id">{{ item.name || item.companyName }}</option>
            </select>
          </label>
          <p v-if="leadSearchError" role="status" class="text-xs text-[var(--dh-text-muted)]">{{ leadSearchError }}</p>
        </div>
        <div v-if="scopedLead" class="sm:col-span-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 text-xs">
          Prospecto: <strong>{{ leadName || selectedLead?.name || 'Prospecto actual' }}</strong>. 
        </div>
        <label v-if="!scopedRecord && editor.accountId && editor.type!=='FOLLOWUP' && can('crm.contact.read')" class="calendar-label">Contacto de la cuenta
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
        <div class="calendar-label">
          Canal obligatorio
          <p class="calendar-input flex items-center text-sm">Sistema y correo electrónico</p>
        </div>
        <template v-if="editor.type!=='FOLLOWUP'">
          <label class="calendar-label sm:col-span-2">Involucrados
            <input v-model.trim="editor.involved" class="calendar-input" maxlength="1500" placeholder="Personas del cliente, equipos internos y responsables" />
          </label>
          <label class="calendar-label sm:col-span-2">Acuerdos alcanzados
            <textarea v-model.trim="editor.agreements" class="calendar-input min-h-24" maxlength="6000" placeholder="Resumen de acuerdos de la llamada, visita, correo o reunión" />
          </label>
          <div v-if="agreementDrafts.length" class="sm:col-span-2 rounded-xl border border-[var(--dh-border)] p-3">
            <p class="text-sm font-bold">Compromisos detectados en los acuerdos ({{ agreementDrafts.length }})</p>
            <p class="mb-3 text-xs text-[var(--dh-text-muted)]">
              Revisá cada compromiso antes de guardar. Cuando no se especificó hora, se propone 09:00, editable.
              Sin una fecha válida, el acuerdo no puede programarse.
            </p>
            <div v-for="(item, index) in agreementDrafts" :key="index"
              class="mb-3 grid gap-2 rounded-lg border border-[var(--dh-border)] p-2 last:mb-0 sm:grid-cols-[1fr_210px]">
              <label class="calendar-label">Acuerdo {{ index + 1 }}
                <input v-model.trim="item.title" class="calendar-input" maxlength="250" required />
              </label>
              <label class="calendar-label">Fecha límite
                <input v-model="item.dueLocal" type="datetime-local" class="calendar-input" required />
              </label>
              <p v-if="!item.dueLocal" class="text-xs text-amber-600 sm:col-span-2">
                No se detectó una fecha. Seleccioná cuándo debe cumplirse este acuerdo.
              </p>
              <p v-else-if="!item.hasExplicitTime" class="text-xs text-[var(--dh-text-muted)] sm:col-span-2">
                Hora sugerida, no confirmada por el cliente.
              </p>
            </div>
          </div>
          <label class="calendar-label sm:col-span-2">Próximo compromiso
            <input v-model.trim="editor.nextCommitment" class="calendar-input" maxlength="250" placeholder="Ej. Enviar propuesta y confirmar recepción" />
          </label>
          <label v-if="editor.nextCommitment" class="calendar-label sm:col-span-2">Fecha límite del compromiso
            <input v-model="editor.commitmentDue" type="datetime-local" class="calendar-input" required />
          </label>
          <p class="sm:col-span-2 text-xs text-[var(--dh-text-muted)]">
            Cada acuerdo con fecha confirmada se registra por separado en el calendario del cliente y del vendedor.
            El campo «Próximo compromiso» permite agregar una tarea adicional, independiente de los acuerdos.
            Los pendientes vencidos activan recordatorios por sistema y correo y su escalamiento a jmesen.
          </p>
        </template>
        <div class="flex flex-wrap justify-end gap-2 sm:col-span-2">
          <button type="button" class="calendar-btn" @click="creationOpen=false">Cancelar</button>
          <button type="submit" class="calendar-btn calendar-primary" :disabled="saving || activityTypesLoading || !editor.ownerId || !selectableActivityTypes.some(item => item.value === editor.type)">
            {{ saving?'Guardando…':'Guardar y programar recordatorio' }}
          </button>
        </div>
      </form>
      </div>
    </DhModal>
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
