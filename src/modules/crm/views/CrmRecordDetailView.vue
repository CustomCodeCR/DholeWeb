<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useResourceRealtime } from '@/core/realtime/useResourceRealtime'
import { ArrowLeft, BriefcaseBusiness, Plus, ChevronDown, UsersRound, MapPin,
  Activity, Route, Wallet, FileText, CalendarClock, Settings2, Mail, Phone } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhTextarea } from '@/shared/components/atoms'
import { DhPagination } from '@/shared/components/molecules'
import { DhDrawer, DhModal, DhPageHeader } from '@/shared/components/organisms'
import CrmCatalogPicker from '../components/CrmCatalogPicker.vue'
import CrmExecutivePicker from '../components/CrmExecutivePicker.vue'
import CrmAccountHub from '../components/CrmAccountHub.vue'
import CrmLeadCommercialPanel from '../components/CrmLeadCommercialPanel.vue'
import CrmSalesCalendar from '../components/CrmSalesCalendar.vue'
import CrmDocumentsPanel from '../components/CrmDocumentsPanel.vue'
import CrmActivityCollaboration from '../components/CrmActivityCollaboration.vue'
import CrmActivityFullEditor from '../components/CrmActivityFullEditor.vue'
import CrmArchiveAction from '../components/CrmArchiveAction.vue'
import type { HaciendaResult } from '../components/CrmHaciendaLookup.vue'
import CrmAccountEditor from '../components/CrmAccountEditor.vue'
import CrmContactForm from '../components/CrmContactForm.vue'
import CrmAddressLocationFields from '../components/CrmAddressLocationFields.vue'
import { emptyAddressLocation } from '../model/crmAddressLocation'
import CrmCreditCoveragePicker from '../components/CrmCreditCoveragePicker.vue'
import CrmContractFileDropzone from '../components/CrmContractFileDropzone.vue'
import { creditCoverageLabel } from '../model/crmCreditCoverage'
import { StorageService } from '@/core/services/storageService'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
import { hasCrmCalendarAdministratorRole } from '../model/crmCalendarAdministrator'
import { useI18n } from 'vue-i18n'
import { crmEnabled, crmError, crmGet, crmPath, crmRequest,
  crmUuid, toUtc, fromUtc, type CrmRow } from '../services/crmApi'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const section = computed(() => String(route.meta.crmSection ?? 'accounts'))
const id = computed(() => String(route.params.id ?? ''))
const record = ref<CrmRow | null>(null)
const originActivity = ref<CrmRow | null>(null)
const error = ref('')
const success = ref('')
const loading = ref(false)
const saving = ref(false)
// Only a confirmed conversion may navigate while the conversion request is unwinding.
const conversionRedirectAllowed = ref(false)
const pendingCreateKeys = new Map<string, string>()
const relationRows = ref<CrmRow[]>([])
const relationPage = ref(1)
const relationPageSize = ref(25)
const pagedRelationRows = computed(() => relationRows.value.slice(
  (relationPage.value - 1) * relationPageSize.value,
  relationPage.value * relationPageSize.value,
))
const relation = ref('')
const showRelationForm = ref(false)
const creditIncluded = ref<string[]>([])
const creditExcluded = ref<string[]>([])
const signedContractFile = ref<File | null>(null)
const newlyCreatedContractId = ref('')
const contractCreateKey = ref(crmUuid())
const contractRenewalDrafts = ref<Record<string, string>>({})
const contractFiles = ref<Record<string, File | null>>({})
const documentBusy = ref(false)
const documentStatus = ref('')
const showAdvancedAccountManagement = ref(false)
const showExecutiveDrawer = ref(false)
const showAccountEditor = ref(false)
const accountEditingDirty = ref(false)

// F4 candidate: only accounts are subscribed. No other CRM resource receives
// a generic broadcast until its owner authorization and F6 adapter are ready.
const liveAccountId = computed(() => section.value === 'accounts' ? id.value : '')
const realtimeAccount = useResourceRealtime<CrmRow>({
  kind: 'crm.account',
  id: liveAccountId,
  visible: () => document.visibilityState === 'visible',
  dirty: () => accountEditingDirty.value || showAccountEditor.value ||
    showRelationForm.value || saving.value || documentBusy.value,
  fetchSnapshot: async (accountId) => {
    const snapshot = await crmGet('accounts', accountId)
    const rawVersion = Number(snapshot.rowVersion)
    return { value: snapshot, version: Number.isSafeInteger(rawVersion) ? rawVersion : null }
  },
  applySnapshot: ({ value }) => {
    if (section.value !== 'accounts' || value.id !== id.value) return
    record.value = value
    if (relation.value && !showRelationForm.value) void loadRelation()
  },
  onDenied: () => {
    // Scope/ownership revoked: do not keep presenting previously authorized CRM data.
    record.value = null
    relationRows.value = []
    showAccountEditor.value = false
    accountEditingDirty.value = false
    error.value = 'Ya no tenés permiso para consultar esta cuenta.'
  },
  onError: () => { /* existing REST view remains usable */ },
})
const discardOpen = ref(false)
let discardAction: (() => void) | null = null
let navigationDecision: ((allowed: boolean) => void) | null = null
const selectedExecutive = ref('')
const leadExecutiveName = ref('Consultando vendedor…')
let leadExecutiveGeneration = 0
const leadTaxTypeLoading = ref(false)
const leadTaxTypeMessage = ref('')
const executiveReason = ref('')
const createRelationPermissions: Record<string, string> = {
  'accounts:addresses': 'crm.account.update',
  'accounts:followup-policy': 'crm.followup.manage',
  'accounts:contacts': 'crm.contact.create',
  'accounts:credit-profiles': 'crm.credit.manage',
  'accounts:credit-contracts': 'crm.contract.manage',
  'activities:notes': 'crm.activity.update',
  'analyses:services': 'crm.analysis.manage',
  'analyses:routes': 'crm.analysis.manage',
  'opportunities:negotiations': 'crm.opportunity.update',
  'opportunities:quotes': 'crm.quote.link',
  'opportunities:rate-requests': 'crm.quote.link',
  'settings:stages': 'crm.settings.manage',
}
const accountRelationOptions = [
  { key: 'contacts', label: 'Contactos', subtitle: 'Personas y responsables', icon: UsersRound,
    description: 'Gestioná las personas vinculadas con esta empresa y sus medios de comunicación.',
    empty: 'Todavía no hay contactos relacionados con esta cuenta.' },
  { key: 'addresses', label: 'Direcciones', subtitle: 'Sedes y ubicaciones', icon: MapPin,
    description: 'Registrá las direcciones de la empresa para operaciones y facturación.',
    empty: 'No hay direcciones registradas para este cliente.' },
  { key: 'business-activities', label: 'Actividades económicas', subtitle: 'Giro del negocio', icon: Activity,
    description: 'Actividades económicas registradas para la cuenta.',
    empty: 'No hay actividades económicas vinculadas.' },
  { key: 'trade-profiles', label: 'Rutas habituales', subtitle: 'Mercados y logística', icon: Route,
    description: 'Historial y perfiles de rutas de esta cuenta.',
    empty: 'Todavía no hay rutas habituales registradas.' },
  { key: 'credit-profiles', label: 'Perfiles de crédito', subtitle: 'Condiciones financieras', icon: Wallet,
    description: 'Consultá y gestioná propuestas de crédito según tus permisos.',
    empty: 'Este cliente todavía no tiene un perfil de crédito.' },
  { key: 'credit-contracts', label: 'Contratos de crédito', subtitle: 'Documentos y vigencias', icon: FileText,
    description: 'Documentos, condiciones y vigencias de contratos del cliente.',
    empty: 'No hay contratos de crédito vinculados.' },
  { key: 'followup-policy', label: 'Política de seguimiento', subtitle: 'Agenda del cliente', icon: CalendarClock,
    description: 'Configurá el seguimiento comercial de la cuenta, no de contactos individuales.',
    empty: 'No hay una política de seguimiento configurada para esta cuenta.' },
]
const accountRelationInfo = computed(() =>
  accountRelationOptions.find(option => option.key === relation.value))

const canAddRelation = computed(() => {
  const scope = createRelationPermissions[`${section.value}:${relation.value}`]
  return !!scope && auth.hasScope(scope)
})
const drafts = reactive({
  note: '', reason: '', outcome: 'Completed', date: '',
  taxIdTypeCode: '', conversionCustomerType: 'cash', conversionCategoryType: 'CUSTOMER', conversionCategoryCode: 'D',
  stageId: '', status: '', contactName: '', contactEmail: '',
  quoteId: '', pricingRequestId: '', priority: 'Green', shipmentMode: 'Fcl',
  originName: '', destinationName: '', payload: '{}', serviceCode: '', volume: '1',
  polCode: '', poeCode: '', podCode: '', creditDays: '30', creditLimit: '0',
  monthlyFinancingPct: '0', lateInterestMonthlyPct: '0', currencyCode: 'USD', paymentConditions: '',
  contractNumber: '', renewalDate: '', expiryDate: '', startDate: '',
  marketCode: 'OTHER', decisionRole: 'INFLUENCER', timezoneId: 'America/Costa_Rica',
  channelStrategy: 'BOTH', frequencyDays: '7', reminderLeadMinutes: '60',
  assignedUserId: String(auth.userId || ''), operationId: crmUuid(),
  addressText: '', addressType: 'WORK', transportModeCode: 'SEA', modalityCode: 'FCL',
  summary: '',
})
const addressLocation = ref(emptyAddressLocation())
const addressFormVersion = ref(0)
const stages = ref<CrmRow[]>([])
const can = (scope: string) => auth.hasScope(scope)

type LeadTab = 'summary' | 'profile' | 'analysis' | 'quotes' | 'history' | 'agenda' | 'conversion' | 'documents'
const leadTab = ref<LeadTab>('summary')
const leadTabs = computed(() => [
  { key: 'summary' as const, label: 'Prospecto', icon: BriefcaseBusiness },
  { key: 'profile' as const, label: 'Ficha prospecto', icon: FileText },
  ...(can('crm.analysis.read') ? [{ key: 'analysis' as const, label: 'Análisis comercial', icon: Route }] : []),
  ...(can('crm.quote.read')
    ? [{ key: 'quotes' as const, label: 'Cotizaciones', icon: FileText }] : []),
  ...(can('crm.analysis.read') ? [{ key: 'history' as const, label: 'Historial de rutas', icon: Route }] : []),
  { key: 'documents' as const, label: 'Documentos', icon: FileText },
  ...(can('crm.activity.read') || can('crm.activity.read-all') || can('crm.task.manage') || can('crm.followup.manage')
    ? [{ key: 'agenda' as const, label: 'Seguimientos', icon: CalendarClock }] : []),
  ...(can('crm.lead.convert') && can('crm.account.create')
    ? [{ key: 'conversion' as const, label: 'Convertir a cuenta', icon: UsersRound }] : []),
])
function showLeadTab(tab: LeadTab) {
  if (section.value !== 'leads' || !leadTabs.value.some(item => item.key === tab)) return
  leadTab.value = tab
  const hash = tab === 'conversion' ? '#crm-lead-conversion' : ''
  if (route.hash === '#crm-lead-conversion' || hash) {
    if (route.hash !== hash) void router.replace({ path: route.path, query: route.query, hash })
  }
}


const calendarAdmin = computed(() => hasCrmCalendarAdministratorRole(role => auth.hasRole(role)))

interface AgendaLabels {
  accounts: Record<string, string>
  leads: Record<string, string>
  owners: Record<string, string>
}
interface AgendaParent {
  activityId: string | null
  activitySubject?: string
  sourceType?: 'POLICY' | 'ACTIVITY' | 'MANUAL' | 'UNAVAILABLE'
  policyOccurrenceAt?: string | null
  policy?: {
    frequencyDays: number
    timezoneId: string
    channelStrategy: string
    reminderLeadMinutes: number
    enabled: boolean
    pausedUntil?: string | null
    nextDueAt?: string | null
  } | null
}
const agendaLabels = ref<AgendaLabels>({ accounts: {}, leads: {}, owners: {} })
const agendaContactName = ref('')
const agendaOpportunityName = ref('')
const agendaNotes = ref<CrmRow[]>([])
const agendaCommitments = ref<CrmRow[]>([])
const commitmentSaving = ref('')
const canCompleteCommitments = computed(() =>
  can('crm.task.manage') || can('crm.followup.manage') ||
  (section.value === 'activities' && can('crm.activity.update') &&
    (String(record.value?.ownerUserId ?? '') === String(auth.userId ?? '') ||
      can('crm.activity.read-all') ||
      (can('crm.account.read-all') && can('crm.lead.read-all')))))
const agendaParent = ref<AgendaParent | null>(null)
const agendaLinkedActivityNotes = ref<CrmRow[]>([])
const agendaFollowupTitle = computed(() => {
  const item = record.value
  const saved = String(item?.subject ?? '').trim()
  const periodical = Boolean(item?.policyId) || agendaParent.value?.sourceType === 'POLICY'
  const title = saved || (periodical ? 'Seguimiento periódico' : 'Seguimiento comercial')
  const client = agendaClientName()
  return periodical && client && client !== 'Sin cliente vinculado' && !client.includes('no disponible')
    ? title + ' · ' + client : title
})
const agendaDetailsWarning = ref('')
let agendaDetailsGeneration = 0
function agendaClientName(): string {
  const item = record.value
  if (!item) return '—'
  const account = String(item.accountId ?? '')
  const lead = String(item.leadId ?? '')
  if (account) return agendaLabels.value.accounts[account] || String(item.accountName ?? 'Cliente vinculado (nombre no disponible)')
  if (lead) return agendaLabels.value.leads[lead] || String(item.leadName ?? 'Prospecto vinculado (nombre no disponible)')
  return 'Sin cliente vinculado'
}
function agendaOwnerName(): string {
  const item = record.value
  const owner = String(section.value === 'followups' ? item?.assignedUserId ?? '' : item?.ownerUserId ?? '')
  return agendaLabels.value.owners[owner] ||
    (owner && owner === String(auth.userId ?? '') ? 'Mi usuario' : owner ? 'Responsable vinculado (nombre no disponible)' : 'Sin asignar')
}
function agendaCadence(value: unknown, unit: 'días' | 'minutos'): string {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) && amount > 0
    ? amount + ' ' + (unit === 'días' && amount === 1 ? 'día' : unit === 'minutos' && amount === 1 ? 'minuto' : unit)
    : 'No se repite'
}
const agendaFields = computed(() => {
  const item = record.value
  if (!item || (section.value !== 'activities' && section.value !== 'followups')) return []
  const activity = section.value === 'activities'
  const fields: [string, string][] = [
    ['Cliente', agendaClientName()],
    ['Ejecutivo comercial', agendaOwnerName()],
    ['Tipo de gestión', activity ? agendaLabel(item.type, 'type') : 'Seguimiento'],
    ['Estado', agendaLabel(item.status)],
    ['Inicio programado', agendaDate(activity ? item.scheduledStartAt : item.dueAt)],
  ]
  if (activity) {
    fields.push(
      ['Finalización', agendaDate(item.scheduledEndAt)],
      ['Contacto', item.contactId ? agendaContactName.value || 'Contacto vinculado (nombre no disponible)' : 'Sin contacto seleccionado'],
      ['Ubicación', String(item.locationText || 'No especificada')],
    )
  }
  if (item.opportunityId) fields.push(['Oportunidad', agendaOpportunityName.value || 'Oportunidad vinculada'])
  fields.push(
    ['Notificar por', agendaLabel(item.reminderChannelStrategy ?? (activity ? 'BOTH' : agendaParent.value?.policy?.channelStrategy ?? 'BOTH'), 'channel')],
    ['Avisar antes', String(item.reminderLeadMinutes ?? (activity ? 60 : agendaParent.value?.policy?.reminderLeadMinutes ?? 60)) + ' minutos'],
  )
  if (activity) {
    fields.push(
      ['Repetir actividad', agendaCadence(item.repeatEveryDays, 'días')],
      ['Repetir recordatorios', agendaCadence(item.reminderRepeatMinutes, 'minutos')],
      ['Finalización real', agendaDate(item.occurredAt)],
    )
  }
  if (!activity) {
    if (item.policyId || agendaParent.value?.sourceType === 'POLICY') {
      fields.push(
        ['Origen', 'Seguimiento automático de la política del cliente'],
        ['Fecha programada por la política', agendaDate(item.policyOccurrenceAt ?? agendaParent.value?.policyOccurrenceAt)],
      )
      const policy = agendaParent.value?.policy
      if (policy) fields.push(
        ['Frecuencia de la política actual', policy.frequencyDays === 1 ? 'Cada día' : 'Cada ' + policy.frequencyDays + ' días'],
        ['Zona horaria de la política', policy.timezoneId],
        ['Próxima fecha programada', agendaDate(policy.nextDueAt)],
        ['Política', policy.enabled ? 'Activa' : 'Desactivada'],
      )
    } else {
      fields.push(['Origen', agendaParent.value?.activityId ? 'Compromiso de actividad comercial' : 'Seguimiento individual'])
    }
  }
  fields.push(
    ['Resultado', String(item.outcome || 'Pendiente de completar')],
    ['Creada', agendaDate(item.createdAt)],
  )
  return fields
})
async function loadAgendaDetails(item: CrmRow, resource: string) {
  const generation = ++agendaDetailsGeneration
  agendaLabels.value = { accounts: {}, leads: {}, owners: {} }
  agendaContactName.value = ''
  agendaOpportunityName.value = ''
  agendaNotes.value = []
  agendaCommitments.value = []
  agendaParent.value = null
  agendaLinkedActivityNotes.value = []
  agendaDetailsWarning.value = ''
  if (resource !== 'activities' && resource !== 'followups') return
  const accountId = String(item.accountId ?? '')
  const leadId = String(item.leadId ?? '')
  const ownerId = String(resource === 'activities' ? item.ownerUserId ?? '' : item.assignedUserId ?? '')
  const query = new URLSearchParams()
  if (accountId) query.set('accountIds', accountId)
  if (leadId) query.set('leadIds', leadId)
  if (ownerId) query.set('ownerIds', ownerId)
  const emptyLabels: AgendaLabels = { accounts: {}, leads: {}, owners: {} }
  const labelRequest = query.size
    ? crmRequest<AgendaLabels>(crmPath('calendar/labels') + '?' + query.toString())
    : Promise.resolve(emptyLabels)
  const contactRequest = resource === 'activities' && item.contactId && (can('crm.contact.read') || calendarAdmin.value)
    ? crmRequest<CrmRow>(crmPath('contacts', String(item.contactId)))
    : Promise.resolve(null)
  const opportunityRequest = item.opportunityId && can('crm.opportunity.read')
    ? crmRequest<CrmRow>(crmPath('opportunities', String(item.opportunityId)))
    : Promise.resolve(null)
  const noteRequest = resource === 'activities'
    ? crmRequest<CrmRow[]>(crmPath('activities', String(item.id), 'notes'))
    : Promise.resolve([])
  const commitmentsRequest = resource === 'activities'
    ? crmRequest<CrmRow[]>(crmPath('activities', String(item.id), 'commitments'))
    : Promise.resolve([])
  const parentRequest = resource === 'followups'
    ? crmRequest<AgendaParent>(crmPath('followups', String(item.id), 'parent-activity'))
    : Promise.resolve(null)
  const results = await Promise.allSettled([
    labelRequest, contactRequest, opportunityRequest, noteRequest, commitmentsRequest, parentRequest,
  ])
  if (generation !== agendaDetailsGeneration) return
  if (results[0]?.status === 'fulfilled')
    agendaLabels.value = results[0].value as AgendaLabels
  const contact = results[1]?.status === 'fulfilled' ? results[1].value as CrmRow | null : null
  if (contact) agendaContactName.value = String(contact.name ?? contact.fullName ?? contact.displayName ?? '')
  const opportunity = results[2]?.status === 'fulfilled' ? results[2].value as CrmRow | null : null
  if (opportunity) agendaOpportunityName.value = String(opportunity.title ?? opportunity.name ?? '')
  if (results[3]?.status === 'fulfilled') agendaNotes.value = results[3].value as CrmRow[]
  if (results[4]?.status === 'fulfilled') agendaCommitments.value = results[4].value as CrmRow[]
  if (results[5]?.status === 'fulfilled') agendaParent.value = results[5].value as AgendaParent | null
  if (results[0]?.status === 'rejected' ||
      (resource === 'activities' && (results[3]?.status === 'rejected' || results[4]?.status === 'rejected')) ||
      (resource === 'followups' && results[5]?.status === 'rejected'))
    agendaDetailsWarning.value = 'Algunos datos vinculados no pudieron cargarse. Actualizá para volver a consultarlos.'
  if (resource === 'followups' && agendaParent.value?.activityId) {
    try {
      const notes = await crmRequest<CrmRow[]>(crmPath('activities', agendaParent.value.activityId, 'notes'))
      if (generation === agendaDetailsGeneration) agendaLinkedActivityNotes.value = notes
    } catch {
      if (generation === agendaDetailsGeneration)
        agendaDetailsWarning.value = 'No se pudo consultar la minuta de la actividad principal. Revisá tus permisos.'
    }
  }
}

async function markCommitmentCompleted(commitment: CrmRow) {
  if (!canCompleteCommitments.value || commitmentSaving.value ||
      !['Pending', 'Overdue'].includes(String(commitment.status ?? '')) ||
      !record.value || section.value !== 'activities') return
  commitmentSaving.value = String(commitment.id)
  agendaDetailsWarning.value = ''
  try {
    await crmRequest(crmPath('followups', String(commitment.id), 'complete'), 'POST', {
      expectedVersion: Number(commitment.rowVersion ?? 0),
      outcome: 'Compromiso completado desde la actividad principal',
      nextFollowupAt: null,
    }, crmUuid())
    await loadAgendaDetails(record.value, 'activities')
  } catch (cause) {
    agendaDetailsWarning.value = crmError(cause)
  } finally {
    commitmentSaving.value = ''
  }
}

const agendaEditable = computed(() => section.value === 'activities'
  ? record.value?.status === 'Scheduled'
  : ['Pending','Overdue'].includes(String(record.value?.status ?? '')))
const agendaStatusChoices = computed(() => section.value === 'activities'
  ? [{value:'Scheduled',label:'Programada'},{value:'Completed',label:'Completada'},{value:'Cancelled',label:'Cancelada'}]
  : [{value:'Pending',label:'Pendiente'},{value:'Overdue',label:'Vencida'},{value:'Completed',label:'Completada'},{value:'Cancelled',label:'Cancelada'}])
function agendaLabel(value: unknown, kind: 'status' | 'type' | 'channel' = 'status'): string {
  const labels: Record<string, Record<string,string>> = {
    status: {Scheduled:'Programada',Pending:'Pendiente',Overdue:'Vencida',Completed:'Completada',Cancelled:'Cancelada'},
    type: {VISIT:'Visita',CALL:'Llamada',EMAIL:'Correo',MEETING:'Reunión',OTHER:'Actividad'},
    channel: {BOTH:'Correo y sistema',EMAIL:'Correo',SYSTEM:'Sistema'}
  }
  return (labels[kind] ?? {})[String(value ?? '')] || String(value || '—')
}
function agendaDate(value: unknown): string {
  const when = typeof value === 'string' ? new Date(value) : null
  return when && Number.isFinite(when.getTime())
    ? new Intl.DateTimeFormat('es-CR',{dateStyle:'long',timeStyle:'short'}).format(when)
    : '—'
}
async function saveAgendaStatus() {
  if (!record.value || !agendaEditable.value || saving.value) return
  if (drafts.status === 'Completed') {
    if (section.value === 'activities') await completeActivity()
    else await completeFollowup()
  } else if (drafts.status === 'Cancelled') {
    if (!drafts.reason.trim()) { error.value = 'Ingresá el motivo de cancelación.'; return }
    await perform('cancel',{expectedVersion:version(),reason:drafts.reason},section.value === 'activities' ? 'crm.activity.update' : 'crm.task.manage')
  } else if (drafts.date && drafts.date !== fromUtc(
    section.value === 'activities' ? record.value.scheduledStartAt : record.value.dueAt)) {
    if (section.value === 'activities') await rescheduleActivity()
    else await rescheduleFollowup()
  } else {
    error.value = 'Elegí un estado distinto o modificá la fecha para reprogramar.'
  }
}
const tabs = computed(() => {
  if (section.value === 'accounts') return ['contacts', 'addresses', 'business-activities', 'trade-profiles', 'credit-profiles', 'credit-contracts', 'followup-policy']
  // Activities are a top-level /activities?leadId= endpoint, not /leads/{id}/activities.
  // The prospect's calendar below owns the activity and followup history.
  if (section.value === 'leads') return []
  if (section.value === 'opportunities') return ['stage-history', 'quotes', 'rate-requests', 'negotiations', 'contacts']
  if (section.value === 'activities') return [] // Handled by the dedicated collaboration panel.
  if (section.value === 'followups') return ['history']
  if (section.value === 'analyses') return ['routes', 'services']
  if (section.value === 'settings') return ['stages']
  return []
})
function permitted(tab: string) {
  if (tab === 'credit-profiles') return can('crm.credit.read')
  if (tab === 'credit-contracts') return can('crm.contract.read')
  if (tab === 'contacts' || tab === 'participants') return can('crm.contact.read') || section.value !== 'accounts'
  if (tab === 'followup-policy') return can('crm.followup.manage') || calendarAdmin.value
  if (tab === 'business-activities') return can('crm.account.read') || can('crm.account.read-all')
  if (tab === 'trade-profiles') return can('crm.analysis.read')
  if (tab === 'quotes' || tab === 'rate-requests') return can('crm.quote.read')
  return true
}
function endpoint(tab: string) {
  if (tab === 'stages') return crmPath('pipelines', id.value, 'stages')
  if (tab === 'contacts' && section.value === 'accounts') return crmPath('accounts', id.value, 'contacts')
  if (tab === 'contacts') return crmPath('opportunities', id.value, 'contacts')
  if (tab === 'addresses' || tab === 'business-activities' || tab === 'trade-profiles' || tab === 'credit-profiles' ||
      tab === 'credit-contracts' || tab === 'followup-policy')
    return crmPath('accounts', id.value, tab)
  return crmPath(section.value, id.value, tab)
}
async function loadRelation() {
  relationPage.value = 1
  relationRows.value = []
  if (!permitted(relation.value)) return
  try {
    const res = await crmRequest<CrmRow[] | CrmRow>(endpoint(relation.value))
    if (Array.isArray(res)) relationRows.value = res.map(row => row.contact ? row.contact as CrmRow : row)
    else if (res && typeof res === 'object') relationRows.value = [res]
    if (relation.value === 'followup-policy') {
      const policy = res && !Array.isArray(res) ? res : null
      drafts.assignedUserId = String(policy?.ownerUserId ?? auth.userId ?? '')
      drafts.date = policy?.nextDueAt ? fromUtc(policy.nextDueAt) : fromUtc(new Date(Date.now() + 7 * 86400000).toISOString())
      drafts.timezoneId = String(policy?.timezoneId ?? 'America/Costa_Rica')
      drafts.frequencyDays = String(policy?.frequencyDays ?? 7)
      drafts.reminderLeadMinutes = String(policy?.reminderLeadMinutes ?? 60)
      drafts.channelStrategy = String(policy?.channelStrategy ?? 'BOTH')
    }
  } catch (e) { error.value = crmError(e) }
}
async function load() {
  loading.value = true; error.value = ''; success.value = ''
  try {
    if (section.value === 'settings') {
      const list = await crmRequest<CrmRow[]>(crmPath('pipelines'))
      record.value = list.find(x => x.id === id.value) ?? null
      if (!record.value) throw new Error('Pipeline no encontrado')
    } else {
      record.value = await crmGet(section.value, id.value)
    }
    originActivity.value = null
    if (section.value === 'followups' && record.value) {
      try {
        originActivity.value = await crmRequest<CrmRow | null>(crmPath('followups', id.value, 'origin'))
      } catch { /* Existing unlinked followups remain usable. */ }
    }
    if (section.value === 'leads') {
      void loadLeadExecutive()
      // Do not ask for a tax ID again: this is the fiscal identity saved with the lead.
      // Hacienda's identificationType was not stored on the original prospect model.
      // Refresh it on demand using the existing ID and country, without changing the lead.
      if (record.value?.taxId && record.value?.countryId && !drafts.taxIdTypeCode.trim())
        void populateLeadTaxType()
    }
    if (section.value === 'opportunities') {
      const pipelineId = String(record.value?.pipelineId ?? '')
      if (pipelineId) stages.value = await crmRequest<CrmRow[]>(crmPath('pipelines', pipelineId, 'stages'))
    }
    if (record.value) await loadAgendaDetails(record.value, section.value)
    if (record.value && (section.value === 'activities' || section.value === 'followups')) {
      drafts.status = String(record.value.status ?? '')
      drafts.date = fromUtc(section.value === 'activities' ? record.value.scheduledStartAt : record.value.dueAt)
      drafts.reason = ''
      drafts.note = ''
    }
    if (!tabs.value.includes(relation.value)) relation.value = tabs.value.find(permitted) ?? ''
    if (relation.value) await loadRelation()
  } catch (e) { record.value = null; error.value = crmError(e) }
  finally { loading.value = false }
}
async function perform(action: string, body: unknown, scope: string, path?: string) {
  if (!record.value || !can(scope) || saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    await crmRequest(path ?? crmPath(section.value, id.value, action), 'POST', body, crmUuid())
    await load()
    success.value = t('crm.saved')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
function closeEditorWithoutPrompt() {
  accountEditingDirty.value = false
  showAccountEditor.value = false
  const query = { ...route.query }
  delete query.edit
  void router.replace({ path: route.path, query, hash: route.hash })
}
function confirmDiscard() {
  const action = discardAction
  discardAction = null
  discardOpen.value = false
  if (action) action()
  const decision = navigationDecision
  navigationDecision = null
  decision?.(true)
}
function cancelDiscard() {
  discardAction = null
  discardOpen.value = false
  const decision = navigationDecision
  navigationDecision = null
  decision?.(false)
}
function leaveAccountEditing(): boolean {
  if (accountEditingDirty.value) {
    discardAction = closeEditorWithoutPrompt
    discardOpen.value = true
    return false
  }
  closeEditorWithoutPrompt()
  return true
}
function toggleAccountEditing() {
  if (!can('crm.account.update')) return
  if (showAccountEditor.value) {
    leaveAccountEditing()
  } else {
    accountEditingDirty.value = false
    showAccountEditor.value = true
    void router.replace({ path: route.path, query: { ...route.query, edit: '1' }, hash: route.hash })
  }
}
function openRelationCreation() {
  if (section.value === 'accounts' && relation.value === 'addresses') {
    // Use the account's country for every new address, as with phone prefixes.
    // Reset previous address selections when opening a new drawer.
    addressLocation.value = {
      ...emptyAddressLocation(),
      countryId: String(record.value?.countryId ?? ''),
    }
    addressFormVersion.value++
    drafts.addressText = ''
    drafts.addressType = 'WORK'
  }
  error.value = ''
  showRelationForm.value = true
}

function openContractCreation() {
  if (!can('crm.contract.manage')) return
  showAdvancedAccountManagement.value = true
  relation.value = 'credit-contracts'
  error.value = ''
  // The relation watcher closes stale drawers when the selected section changes.
  // Reopen after that watcher runs, so the new-contract action always works.
  void nextTick(() => { showRelationForm.value = true })
}
function openRelatedManagement() {
  const manage = () => {
    closeEditorWithoutPrompt()
    showAdvancedAccountManagement.value = true
    window.requestAnimationFrame(() => document.getElementById('crm-related-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  if (accountEditingDirty.value) {
    discardAction = manage
    discardOpen.value = true
    return
  }
  manage()
}
async function loadLeadExecutive() {
  const leadId = String(record.value?.id ?? '')
  if (section.value !== 'leads' || !leadId) return
  const generation = ++leadExecutiveGeneration
  leadExecutiveName.value = 'Consultando vendedor…'
  try {
    const data = await crmRequest<{ sellers: Record<string, string> }>(
      crmPath('leads', 'assigned-executives') + '?ids=' + encodeURIComponent(leadId))
    if (generation !== leadExecutiveGeneration || String(record.value?.id ?? '') !== leadId) return
    leadExecutiveName.value = data.sellers?.[leadId] ?? 'Vendedor no disponible'
  } catch {
    if (generation === leadExecutiveGeneration) leadExecutiveName.value = 'No se pudo consultar'
  }
}
function openExecutiveDrawer() {
  selectedExecutive.value = record.value?.isCastroFallasExecutive === true
    ? '__castro_fallas__'
    : String(record.value?.executiveUserId ?? '')
  executiveReason.value = ''
  showExecutiveDrawer.value = true
}
async function reassignExecutive() {
  if (!record.value || !selectedExecutive.value || saving.value) return
  if (section.value === 'accounts' && !can('crm.account.assign')) return
  if (section.value === 'leads' && (!can('crm.lead.assign') || record.value.convertedAccountId)) return
  if (!['accounts', 'leads'].includes(section.value)) return
  saving.value = true
  error.value = ''; success.value = ''
  try {
    if (section.value === 'leads') {
      await crmRequest(crmPath('leads', id.value, 'assign'), 'POST', {
        expectedVersion: version(),
        executiveUserId: selectedExecutive.value === '__castro_fallas__' ? null : selectedExecutive.value,
        assignToCastroFallas: selectedExecutive.value === '__castro_fallas__',
      }, crmUuid())
    } else {
      await crmRequest(crmPath('accounts', id.value, 'assign'), 'POST', {
        expectedVersion: version(),
        executiveUserId: selectedExecutive.value === '__castro_fallas__' ? null : selectedExecutive.value,
        assignToCastroFallas: selectedExecutive.value === '__castro_fallas__',
        reason: executiveReason.value.trim() || null,
      }, crmUuid())
    }
    showExecutiveDrawer.value = false
    await load()
    success.value = t('crm.saved')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
function version() { return Number(record.value?.rowVersion ?? 0) }
async function createRelation(tab: string, body: unknown, requiredScope: string) {
  if (!can(requiredScope) || saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    const fingerprint = endpoint(tab) + ':' + JSON.stringify(body)
    const key = pendingCreateKeys.get(fingerprint) ?? crmUuid()
    pendingCreateKeys.set(fingerprint, key)
    await crmRequest(endpoint(tab), 'POST', body, key)
    pendingCreateKeys.delete(fingerprint)
    await loadRelation(); success.value = t('crm.saved'); showRelationForm.value = false
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
function onLinkedContactSaved() {
  showRelationForm.value = false
  success.value = t('crm.saved')
  void loadRelation()
  void load()
}
async function populateLeadTaxType() {
  const lead = record.value
  if (!lead?.taxId || !lead?.countryId || leadTaxTypeLoading.value) return
  const leadId = String(lead.id)
  leadTaxTypeLoading.value = true
  leadTaxTypeMessage.value = ''
  try {
    const params = new URLSearchParams({ identificacion: String(lead.taxId).replace(/[\\s-]/g, ''), countryId: String(lead.countryId) })
    const response = await crmRequest<HaciendaResult>('/api/crm/hacienda/lookup?' + params)
    if (record.value?.id !== leadId) return
    if (response.identificationType) drafts.taxIdTypeCode = response.identificationType
    else leadTaxTypeMessage.value = 'Hacienda no devolvió el tipo de identificación. Seleccionalo antes de convertir.'
  } catch {
    if (record.value?.id === leadId)
      leadTaxTypeMessage.value = 'No se pudo recuperar el tipo de identificación de Hacienda. Podés indicarlo manualmente.'
  } finally { leadTaxTypeLoading.value = false }
}
async function convertLead() {
  if (!record.value || !can('crm.lead.convert') || !can('crm.account.create') || saving.value) return
  if (record.value.convertedAccountId) {
    // An already-converted lead must reuse its linked account, never create another.
    await router.push('/crm/accounts/' + encodeURIComponent(String(record.value.convertedAccountId)))
    return
  }
  if (record.value.taxId && !drafts.taxIdTypeCode.trim()) {
    error.value = 'No es necesario volver a ingresar la cédula. Seleccioná únicamente el tipo de identificación si Hacienda no lo completó.'
    return
  }
  saving.value = true; error.value = ''; success.value = ''
  try {
    const conversion = await crmRequest<{
      leadId: string; accountId: string | null; alreadyConverted: boolean
    }>(crmPath('leads', id.value, 'convert'), 'POST', {
      existingAccountId: null, notes: drafts.reason.trim() || null,
      taxIdTypeCode: drafts.taxIdTypeCode.trim() || null,
      customerTypeCode: drafts.conversionCustomerType,
      categoryType: drafts.conversionCategoryType,
      categoryCode: can('crm.account.category.manage') ? drafts.conversionCategoryCode :
        (drafts.conversionCategoryType === 'NVOCC' ? 'B' : drafts.conversionCategoryType === 'LITTLE' ? 'A' : 'D'),
    }, crmUuid())
    if (!conversion.accountId) {
      error.value = 'El prospecto figura como convertido, pero CRM no devolvió la cuenta vinculada. Revisá el registro antes de repetir la conversión.'
      await load()
      return
    }
    // This is a successful, deliberate redirect. Other navigation while saving
    // remains blocked by onBeforeRouteLeave.
    conversionRedirectAllowed.value = true
    const target = '/crm/accounts/' + encodeURIComponent(conversion.accountId)
    const failure = await router.push(target)
    if (failure) {
      error.value = 'El prospecto ya fue convertido. Abrí la cuenta vinculada desde el detalle; no repitás la conversión.'
      await load()
    }
  } catch (cause) { error.value = crmError(cause) }
  finally {
    conversionRedirectAllowed.value = false
    saving.value = false
  }
}
async function stageMove() {
  if (!drafts.stageId) return
  await perform('move-stage', { expectedVersion: version(), stageId: drafts.stageId,
    reason: drafts.reason || null }, 'crm.opportunity.update')
}
async function closeOpportunity() {
  const stage = stages.value.find(s => s.id === drafts.stageId)
  if (!stage || (!stage.isWon && !stage.isLost)) {
    error.value = t('crm.selectTerminalStage'); return
  }
  await perform('close', { expectedVersion: version(), stageId: drafts.stageId,
    lossReasonCode: stage.isLost ? 'OTHER' : null, reason: drafts.reason || null }, 'crm.opportunity.close')
}
async function completeActivity() {
  await perform('complete', { expectedVersion: version(), outcome: drafts.outcome,
    occurredAt: new Date().toISOString(), note: drafts.note || null }, 'crm.activity.update')
}
async function rescheduleActivity() {
  if (!drafts.date) return
  await perform('reschedule', { expectedVersion: version(), scheduledStartAt: toUtc(drafts.date),
    scheduledEndAt: null, reason: drafts.reason || 'Reprogramación comercial' }, 'crm.activity.update')
}
async function completeFollowup() {
  await perform('complete', { expectedVersion: version(), outcome: drafts.outcome,
    nextFollowupAt: drafts.date ? toUtc(drafts.date) : null }, 'crm.task.manage')
}
async function rescheduleFollowup() {
  if (!drafts.date) return
  await perform('reschedule', { expectedVersion: version(), dueAt: toUtc(drafts.date),
    reason: drafts.reason || 'Reprogramación comercial' }, 'crm.task.manage')
}
async function linkQuote() {
  await createRelation('quotes', {
    pricingQuoteId: drafts.quoteId, pricingRequestId: drafts.pricingRequestId || null,
  }, 'crm.quote.link')
}
async function createPricingRequest() {
  let payload: unknown
  try { payload = JSON.parse(drafts.payload) }
  catch { error.value = t('crm.invalidJson'); return }
  if (!drafts.shipmentMode.trim() || !drafts.originName.trim()) {
    error.value = t('crm.required'); return
  }
  await createRelation('rate-requests', {
    priority: drafts.priority, shipmentMode: drafts.shipmentMode,
    originName: drafts.originName, destinationName: drafts.destinationName,
    poeId: null, poeName: null, podId: null, podName: null, payload,
  }, 'crm.quote.link')
}
async function createCredit() {
  if (!can('crm.credit.manage') || saving.value) return
  if (creditIncluded.value.some(code => creditExcluded.value.includes(code))) {
    error.value = 'Un concepto no puede estar incluido y excluido del crédito simultáneamente.'
    return
  }
  saving.value = true; error.value = ''; success.value = ''
  let created = false
  try {
    const profile = await crmRequest<CrmRow>(crmPath('accounts', id.value, 'credit-profiles'), 'POST', {
      creditEnabled: true, creditDays: Number(drafts.creditDays), creditLimit: Number(drafts.creditLimit),
      currencyCode: drafts.currencyCode, monthlyFinancingPct: Number(drafts.monthlyFinancingPct),
      lateInterestMonthlyPct: Number(drafts.lateInterestMonthlyPct),
      paymentConditions: drafts.paymentConditions, effectiveFrom: new Date().toISOString(),
      reviewAt: drafts.renewalDate ? toUtc(drafts.renewalDate) : null,
    }, crmUuid())
    created = true
    for (const [kind, codes] of [['INCLUDED', creditIncluded.value], ['EXCLUDED', creditExcluded.value]] as const) {
      for (const code of codes) {
        const current = await crmRequest<CrmRow>(crmPath('credit-profiles', String(profile.id)))
        await crmRequest(crmPath('credit-profiles', String(profile.id), 'coverages'), 'POST', {
          expectedVersion: current.rowVersion,
          serviceCode: code, coverageType: kind, description: creditCoverageLabel(code),
        }, crmUuid())
      }
    }
    showRelationForm.value = false
    creditIncluded.value = []; creditExcluded.value = []
    await loadRelation()
    success.value = 'Solicitud de crédito pendiente de aprobación. El responsable debe tener permiso crm.credit.approve.'
  } catch (cause) {
    await loadRelation()
    error.value = crmError(cause) + (created ? ' La propuesta sí se creó: revisá y completá las coberturas antes de aprobar; no creés otra solicitud.' : '')
  } finally { saving.value = false }
}
function contractDate(value: unknown): string {
  // Contract dates are civil dates; do not shift them one day through timezone conversion.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  return match ? match[3] + '/' + match[2] + '/' + match[1] : '—'
}
async function uploadSignedContract(contractId: string, file: File) {
  if (file.size > 25 * 1024 * 1024) throw new Error('El documento no debe superar los 25 MB.')
  const uploaded = await StorageService.uploadFile({
    file, sourceService: 'DholeCRMService', entityType: 'CreditContract',
    entityId: contractId,
  })
  const current = await crmRequest<CrmRow>(crmPath('credit-contracts', contractId))
  await crmRequest(crmPath('credit-contracts', contractId, 'signed-document'), 'POST', {
    expectedVersion: current.rowVersion, fileId: uploaded.id,
  })
}
function selectExistingContractFile(item: CrmRow, file: File | null) {
  contractFiles.value[String(item.id)] = file
  if (file) void attachExistingContract(item, file)
}
async function attachExistingContract(item: CrmRow, file: File | null) {
  if (!file || !can('crm.contract.manage') || documentBusy.value) return
  documentBusy.value = true; documentStatus.value = ''; error.value = ''
  try {
    await uploadSignedContract(String(item.id), file)
    contractFiles.value[String(item.id)] = null
    await loadRelation()
    documentStatus.value = 'Documento firmado adjuntado correctamente al contrato.'
  } catch (cause) { error.value = crmError(cause) }
  finally { documentBusy.value = false }
}
async function downloadSignedContract(fileId: string) {
  error.value = ''
  try {
    const stored = await StorageService.getFile(fileId)
    await StorageService.downloadFile({
      id: stored.id, fileName: stored.originalFileName,
      contentType: stored.contentType, extension: stored.extension,
    })
  } catch (cause) { error.value = crmError(cause) }
}
async function createContract() {
  if (!can('crm.contract.manage') || saving.value) return
  if (!drafts.startDate || !drafts.renewalDate) {
    error.value = 'Indicá la fecha de inicio y la próxima renovación.'
    return
  }
  const startDate = new Date(drafts.startDate).getTime()
  const renewalDate = new Date(drafts.renewalDate).getTime()
  const expiryDate = drafts.expiryDate ? new Date(drafts.expiryDate).getTime() : null
  if (!Number.isFinite(startDate) || !Number.isFinite(renewalDate) ||
      renewalDate < startDate || (expiryDate !== null &&
      (!Number.isFinite(expiryDate) || expiryDate < startDate))) {
    error.value = 'Revisá las fechas: la renovación y el vencimiento no pueden ser anteriores al inicio.'
    return
  }
  if (signedContractFile.value && signedContractFile.value.size > 25 * 1024 * 1024) {
    error.value = 'El documento supera los 25 MB permitidos.'
    return
  }
  saving.value = true; error.value = ''; success.value = ''
  try {
    // Never create a second contract if the first creation succeeded but
    // the separate Storage upload / signed-document association failed.
    if (!newlyCreatedContractId.value) {
      const contract = await crmRequest<CrmRow>(crmPath('accounts', id.value, 'credit-contracts'), 'POST', {
        creditProfileId: null, contractNumber: drafts.contractNumber.trim() || null,
        startDate: toUtc(drafts.startDate), renewalDate: toUtc(drafts.renewalDate),
        expiryDate: drafts.expiryDate ? toUtc(drafts.expiryDate) : null,
        paymentTerms: drafts.paymentConditions, autoRenew: false,
      }, contractCreateKey.value)
      newlyCreatedContractId.value = String(contract.id)
    }
    const hasSignedFile = Boolean(signedContractFile.value)
    if (signedContractFile.value)
      await uploadSignedContract(newlyCreatedContractId.value, signedContractFile.value)
    signedContractFile.value = null
    newlyCreatedContractId.value = ''
    contractCreateKey.value = crmUuid()
    showRelationForm.value = false
    await loadRelation()
    success.value = 'Contrato creado correctamente' + (hasSignedFile ? ' con su documento firmado.' : '.') 
  } catch (cause) {
    await loadRelation()
    error.value = crmError(cause) + (newlyCreatedContractId.value
      ? ' El contrato ya está creado. Volvé a intentar asociar el archivo; no se generará otro contrato.'
      : ' Verificá los datos e intentá nuevamente.')
  } finally { saving.value = false }
}
async function createRoute() {
  await createRelation('routes', {
    polCode: drafts.polCode || null, poeCode: drafts.poeCode || null, podCode: drafts.podCode || null,
    originCountryCode: null, destinationCountryCode: null,
    frequencyPerMonth: null, notes: drafts.note || null,
  }, 'crm.analysis.manage')
}
async function createStage() {
  await createRelation('stages', {
    name: drafts.contactName, sortOrder: Number(drafts.volume),
    defaultWinProbability: 0, isWon: false, isLost: false,
  }, 'crm.settings.manage')
}
async function actOnChild(item: CrmRow, action: string, required: string, body: Record<string, unknown>) {
  if (!can(required) || saving.value) return
  saving.value = true; error.value = ''; success.value = ''
  try {
    await crmRequest(crmPath(relation.value === 'credit-profiles' ? 'credit-profiles' : 'credit-contracts',
      item.id, action), 'POST', { expectedVersion: item.rowVersion, ...body }, crmUuid())
    drafts.operationId = crmUuid()
    await loadRelation()
    success.value = t('crm.saved')
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
function savePolicy() {
  const policy = relationRows.value[0]
  if (!drafts.date) { error.value = t('crm.required'); return }
  saving.value = true; error.value = ''
  void crmRequest(crmPath('accounts', id.value, 'followup-policy'), 'PUT', {
    expectedVersion: policy?.rowVersion ?? null, enabled: true,
    ownerUserId: drafts.assignedUserId || auth.userId,
    channelStrategy: drafts.channelStrategy, frequencyDays: Number(drafts.frequencyDays),
    nextDueAt: toUtc(drafts.date), timezoneId: drafts.timezoneId,
    reminderLeadMinutes: Number(drafts.reminderLeadMinutes), pausedUntil: null,
  }).then(async () => { await loadRelation(); success.value = t('crm.saved') })
    .catch(e => { error.value = crmError(e) }).finally(() => { saving.value = false })
}
function addService() {
  return createRelation('services', {
    serviceCode: drafts.serviceCode, modalityCode: drafts.modalityCode,
    transportModeCode: drafts.transportModeCode, requiresCustoms: false,
    cargoTypeCode: null, volume: Number(drafts.volume), volumeUnit: 'CBM',
    containerTypeCode: null, equipmentQuantity: null,
    expectedMovementsPerMonth: null, notes: drafts.note || null,
  }, 'crm.analysis.manage')
}
async function addAddress() {
  const geo = addressLocation.value
  await createRelation('addresses', {
    contactId: null, countryId: geo.countryId || record.value?.countryId || null,
    countryCode: geo.countryCode || null,
    admin1Code: geo.admin1Code || null, admin1Name: geo.admin1Name || null,
    admin2Code: geo.admin2Code || null, admin2Name: geo.admin2Name || null,
    admin3Code: geo.admin3Code || null, admin3Name: geo.admin3Name || null,
    postalCode: geo.postalCode.trim() || null,
    addressType: drafts.addressType, addressText: drafts.addressText, location: null,
  }, 'crm.account.update')
  if (!showRelationForm.value) {
    addressLocation.value = emptyAddressLocation()
    drafts.addressText = ''
  }
}
function addNote() {
  return createRelation('notes', { noteText: drafts.note }, 'crm.activity.update')
}
function addNegotiation() {
  return createRelation('negotiations', {
    pricingQuoteId: drafts.quoteId || null, status: 'Open',
    changeSummary: drafts.summary, agreedTerms: null, nextActionAt: null,
  }, 'crm.opportunity.update')
}

function back() {
  const source = typeof route.query.fromAccount === 'string' ? route.query.fromAccount : ''
  if (section.value !== 'accounts' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(source))
    void router.push('/crm/accounts/' + encodeURIComponent(source))
  else void router.push('/crm/' + section.value)
}
onBeforeRouteLeave(() => {
  if (saving.value && !conversionRedirectAllowed.value) {
    error.value = 'Hay un guardado en curso. No se puede salir hasta que termine.'
    return false
  }
  if (!accountEditingDirty.value) return true
  discardOpen.value = true
  discardAction = null
  return new Promise<boolean>(resolve => { navigationDecision = resolve })
})
watch([id, section], () => {
  leadTab.value = section.value === 'leads' && route.hash === '#crm-lead-conversion' ? 'conversion' : 'summary'
  void load()
})
watch(() => route.hash, hash => {
  if (section.value === 'leads' && hash === '#crm-lead-conversion') leadTab.value = 'conversion'
}, { immediate: true })
watch(() => [route.query.edit, section.value], ([edit]) => {
  showAccountEditor.value = section.value === 'accounts' && edit === '1' && can('crm.account.update')
}, { immediate: true })
watch(relation, () => { showRelationForm.value = false; if (relation.value) void loadRelation() })
watch(success, value => { if (value) showRelationForm.value = false })
watch([accountEditingDirty, showAccountEditor, showRelationForm, saving], () => {
  if (!accountEditingDirty.value && !showAccountEditor.value &&
      !showRelationForm.value && !saving.value)
    realtimeAccount.reconcileAfterEditorClose()
})
onMounted(() => { if (crmEnabled()) void load() })
</script>

<template>
  <main class="mx-auto w-full text-[var(--dh-text)]" :class="section === 'accounts' ? 'max-w-[1750px] space-y-3 p-2 sm:p-4' : 'max-w-6xl space-y-5 p-3 sm:p-6'" data-crm-detail>
    <div
      v-if="realtimeAccount.conflict.value"
      class="rounded-lg border border-amber-500/25 px-3 py-2 text-xs text-[var(--dh-text)]"
      role="status"
      data-realtime-unsaved-conflict
    >
      Esta cuenta cambió en el servidor. Tus cambios sin guardar se conservaron.
      Guardá o descartá la edición para volver a sincronizar; no se reemplazó el formulario.
    </div>
    <DhModal :open="discardOpen" title="Cambios sin guardar" size="sm" @close="cancelDiscard">
      <p class="text-sm text-[var(--dh-text-muted)]">Hay cambios en la ficha sin guardar. Si salís, los cambios no se conservarán.</p>
      <div class="mt-5 flex justify-end gap-2">
        <DhButton label="Continuar editando" variant="secondary" @click="cancelDiscard" />
        <DhButton label="Descartar cambios" @click="confirmDiscard" />
      </div>
    </DhModal>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <DhButton :label="section !== 'accounts' && route.query.fromAccount ? 'Volver a la cuenta' : t('crm.back')" :icon="ArrowLeft" variant="secondary" @click="back" />
      <a v-if="record && section === 'leads' && !record.convertedAccountId &&
            can('crm.lead.convert') && can('crm.account.create')"
          href="#crm-lead-conversion" @click.prevent="showLeadTab('conversion')"
          class="inline-flex items-center rounded-lg bg-[var(--dh-primary)] px-4 py-2 text-sm font-bold text-white">
          Convertir a cuenta
        </a>
      <DhButton v-if="record && section === 'leads' && !record.convertedAccountId &&
            can('crm.lead.assign') && can('auth.users.view')"
        label="Asignar vendedor" variant="secondary" @click="openExecutiveDrawer" />
      <CrmArchiveAction v-if="record && ['accounts','leads','contacts','activities','followups'].includes(section)"
        :resource="section as 'accounts' | 'leads' | 'contacts' | 'activities' | 'followups'"
        :record-id="id" :row-version="Number(record.rowVersion)"
        :record-name="section === 'followups' ? agendaFollowupTitle : String(record.displayName || record.name || record.subject || 'Registro')"
        @archived="router.push('/crm/' + (section === 'activities' ? 'followups' : section))" />
    </div>
    <p v-if="error" role="alert" class="crm-error">{{ error }}</p>
    <p v-if="section === 'accounts' && route.query.onboarding === 'partial'" role="alert"
      class="rounded-xl border border-amber-500/40 bg-[var(--dh-card)] p-3 text-xs text-[var(--dh-text)]">
      La cuenta se guardó correctamente, pero no se pudo agregar {{ String(route.query.missing || 'algún registro relacionado') }}.
      Podés completar esos datos desde «Gestionar contactos, crédito, contratos y otros registros», sin crear otra cuenta.
    </p>
    <p v-if="success" role="status" class="text-sm text-emerald-600">{{ success }}</p>
    <p v-if="loading" role="status">{{ t('common.loading') }}</p>
    <template v-if="record">
      <section :class="section === 'accounts' ? 'space-y-0' : 'crm-panel space-y-3 p-4 sm:p-5'">
        <DhPageHeader v-if="section !== 'accounts'" :icon="BriefcaseBusiness"
          :title="section === 'followups' ? agendaFollowupTitle : String(record.displayName ?? record.name ?? record.title ?? record.subject ?? record.marketCode ?? 'Actividad comercial')"
          :subtitle="section === 'activities' ? 'Actividad comercial' : section === 'followups' ? 'Seguimiento comercial' : t('crm.version') + ' ' + record.rowVersion + ' · ID ' + record.id" hide-excel-export />
        <DhDrawer :open="showExecutiveDrawer" :title="section === 'leads' ? 'Asignar vendedor al prospecto' : 'Asignar ejecutivo comercial'" size="md" @close="showExecutiveDrawer=false">
          <form class="space-y-4" @submit.prevent="reassignExecutive">
            <CrmExecutivePicker :model-value="selectedExecutive" label="Ejecutivo"
              @update:model-value="selectedExecutive=$event" />
            <label v-if="section === 'accounts'" class="block text-xs font-bold text-[var(--dh-text-muted)]">
              Motivo de reasignación
              <input v-model.trim="executiveReason" class="crm-input mt-2" maxlength="1000" />
            </label>
            <div class="flex justify-end gap-2">
              <DhButton label="Cancelar" variant="secondary" @click="showExecutiveDrawer=false" />
              <DhButton label="Asignar" type="submit" :loading="saving" :disabled="!selectedExecutive" />
            </div>
          </form>
        </DhDrawer>
        <nav v-if="section === 'leads'" role="tablist" aria-label="Secciones del prospecto"
          class="crm-lead-tabs sticky z-20 flex max-w-full flex-wrap gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-3 shadow-md sm:px-4"
          data-crm-lead-tabs>
          <button v-for="tab in leadTabs" :key="tab.key" type="button" role="tab"
            :aria-selected="leadTab === tab.key" :aria-controls="'crm-lead-panel-' + tab.key"
            class="crm-lead-tab" :class="leadTab === tab.key && 'crm-lead-tab-active'"
            @click="showLeadTab(tab.key)">
            <component :is="tab.icon" class="h-3.5 w-3.5" />{{ tab.label }}
          </button>
        </nav>
        <CrmAccountHub v-if="section === 'accounts'" :account="record"
          :editing="showAccountEditor && can('crm.account.update')"
          @change-executive="openExecutiveDrawer" @edit-account="toggleAccountEditing"
          @manage-related="openRelatedManagement" @create-contract="openContractCreation" @logo-updated="load" @credit-updated="load" />
        <CrmAccountEditor v-if="section === 'accounts' && showAccountEditor && can('crm.account.update')"
          :account="record" :open="true" @close="leaveAccountEditing"
          @dirty-change="accountEditingDirty=$event"
          @saved="load" @manage-related="openRelatedManagement" />
        <dl v-else-if="section === 'leads' && leadTab === 'summary'" id="crm-lead-panel-summary" role="tabpanel" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div v-for="[label,value] in [
            ['Prospecto',record.name],['Empresa',record.companyName],['Vendedor asignado',leadExecutiveName],['Identificación fiscal',record.taxId],
            ['Correo',record.contactEmail],['Teléfono',record.phone],['Estado',record.qualificationStatus],
            ['Origen',record.sourceCode],['Relación comercial',record.relationshipTypeCode]
          ]" :key="String(label)" class="rounded-xl border border-[var(--dh-border)] p-3">
            <dt class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ label }}</dt>
            <dd class="break-words text-sm">{{ value || '—' }}</dd>
          </div>
        </dl>
        <dl v-else-if="section === 'activities' || section === 'followups'" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="[label,value] in agendaFields" :key="label"
            class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3.5">
            <dt class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ label }}</dt>
            <dd class="mt-1 break-words text-sm font-semibold">
              <RouterLink v-if="label === 'Cliente' && record.accountId && (can('crm.account.read') || can('crm.account.read-all'))"
                :to="'/crm/accounts/' + encodeURIComponent(String(record.accountId))"
                class="text-[var(--dh-primary)] hover:underline">{{ value }}</RouterLink>
              <RouterLink v-else-if="label === 'Cliente' && record.leadId && (can('crm.lead.read') || can('crm.lead.read-all'))"
                :to="'/crm/leads/' + encodeURIComponent(String(record.leadId))"
                class="text-[var(--dh-primary)] hover:underline">{{ value }}</RouterLink>
              <span v-else>{{ value }}</span>
            </dd>
          </div>
        </dl>
        <div v-if="section === 'followups' && originActivity"
          class="mt-4 rounded-xl border border-[var(--dh-primary)]/40 bg-[var(--dh-shell)] p-4">
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Actividad principal asociada</p>
          <RouterLink :to="'/crm/activities/'+encodeURIComponent(String(originActivity.id))"
            class="mt-1 block text-sm font-bold text-[var(--dh-primary)] hover:underline">
            {{ originActivity.subject }}
          </RouterLink>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
            {{ agendaLabel(originActivity.type,'type') }} · {{ agendaDate(originActivity.scheduledStartAt) }}
          </p>
        </div>
        <dl v-else-if="section !== 'accounts' && section !== 'leads' && section !== 'activities' && section !== 'followups'" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <template v-for="[key, value] in Object.entries(record).filter(([key]) =>
            !['id','rowVersion','createdByUserId','updatedByUserId'].includes(key) &&
            !key.toLowerCase().includes('hash') && !key.toLowerCase().includes('payload'))" :key="key">
            <div class="rounded-xl border border-[var(--dh-border)] p-3">
              <dt class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ key }}</dt>
              <dd class="break-words text-sm">{{ value ?? '—' }}</dd>
            </div>
          </template>
        </dl>
      </section>


      <CrmDocumentsPanel v-if="section === 'contacts'" kind="contact" :record-id="id" />
      <CrmDocumentsPanel v-if="section === 'activities' || section === 'followups'"
        :kind="section === 'activities' ? 'activity' : 'followup'" :record-id="id" />

      <section v-if="section === 'leads' && leadTab === 'profile'"
        id="crm-lead-panel-profile" role="tabpanel"
        class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5 space-y-4">
        <div>
          <h2 class="text-base font-extrabold">Ficha del prospecto</h2>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Información comercial y de contacto guardada en CRM, antes de convertirlo en cuenta.</p>
        </div>
        <dl class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div v-for="[label,value] in [
            ['Nombre del prospecto',record.name],['Razón social',record.companyName],
            ['Vendedor asignado',leadExecutiveName],['Cédula',record.taxId],
            ['Correo',record.contactEmail],['Teléfono',record.phone],
            ['Estado de calificación',record.qualificationStatus],
            ['Origen',record.sourceCode],['Relación comercial',record.relationshipTypeCode],
            ['Versión',record.rowVersion],['Creado',record.createdAt],['Última actualización',record.updatedAt]
          ]" :key="String(label)" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
            <dt class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ label }}</dt>
            <dd class="mt-1 break-words text-sm font-semibold">{{ value || '—' }}</dd>
          </div>
        </dl>
      </section>
      <div v-if="section === 'leads' && leadTab === 'analysis'"
        id="crm-lead-panel-analysis" role="tabpanel" class="min-w-0">
        <CrmLeadCommercialPanel :lead="record" :seller-name="leadExecutiveName" view="analysis" />
      </div>
      <div v-if="section === 'leads' && leadTab === 'quotes'"
        id="crm-lead-panel-quotes" role="tabpanel" class="min-w-0">
        <CrmLeadCommercialPanel :lead="record" :seller-name="leadExecutiveName" view="quotes" />
      </div>
      <div v-if="section === 'leads' && leadTab === 'history'"
        id="crm-lead-panel-history" role="tabpanel" class="min-w-0">
        <CrmLeadCommercialPanel :lead="record" :seller-name="leadExecutiveName" view="history" />
      </div>
      <div v-if="section === 'leads' && leadTab === 'documents'" id="crm-lead-panel-documents" role="tabpanel">
        <CrmDocumentsPanel kind="lead" :record-id="id" />
      </div>
      <section v-if="section === 'activities' || section === 'followups'"
        class="crm-panel space-y-4 p-4 sm:p-5" data-crm-activity-full-detail>
        <div>
          <h2 class="text-base font-bold">{{ section === 'activities' ? 'Minuta, acuerdos y compromisos' : 'Actividad principal y compromiso' }}</h2>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Información registrada en esta gestión, conservada en el historial del CRM.</p>
        </div>
        <p v-if="agendaDetailsWarning" role="alert" class="text-sm text-amber-600">{{ agendaDetailsWarning }}</p>
        <template v-if="section === 'activities'">
          <CrmActivityFullEditor :activity="record" :notes="agendaNotes" :commitments="agendaCommitments"
            :can-manage="can('crm.activity.update')" @saved="load" />
          <div v-if="agendaNotes.length" class="space-y-3">
            <article v-for="note in agendaNotes" :key="String(note.id)"
              class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
              <p class="whitespace-pre-wrap break-words text-sm leading-relaxed">{{ note.noteText ?? 'Sin contenido' }}</p>
              <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ agendaDate(note.createdAt) }}</p>
            </article>
          </div>
          <p v-else class="text-sm text-[var(--dh-text-muted)]">Todavía no se han registrado minutas, acuerdos u observaciones.</p>
          <div class="space-y-2">
            <h3 class="text-sm font-bold">Compromisos vinculados ({{ agendaCommitments.length }})</h3>
            <div v-for="commitment in agendaCommitments" :key="String(commitment.id)"
              class="flex items-start gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
              <input type="checkbox" :checked="commitment.status === 'Completed'"
                :disabled="!canCompleteCommitments || Boolean(commitmentSaving) ||
                  !['Pending', 'Overdue'].includes(String(commitment.status ?? ''))"
                @change="markCommitmentCompleted(commitment)"
                class="mt-1 h-4 w-4 shrink-0 accent-[var(--dh-primary)]" aria-label="Compromiso completado" />
              <div class="min-w-0 flex-1">
                <RouterLink :to="'/crm/followups/' + encodeURIComponent(String(commitment.id))"
                  class="text-sm font-semibold text-[var(--dh-primary)] hover:underline">
                  {{ commitment.subject || 'Compromiso sin título' }}
                </RouterLink>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
                  {{ agendaLabel(commitment.status) }} · Vence: {{ agendaDate(commitment.dueAt) }}
                </p>
              </div>
            </div>
            <p v-if="!agendaCommitments.length" class="text-sm text-[var(--dh-text-muted)]">No hay compromisos con fecha vinculados a esta actividad.</p>
          </div>
        </template>
        <template v-else>
          <div v-if="agendaParent?.activityId" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
            <p class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">Actividad principal asociada</p>
            <RouterLink :to="'/crm/activities/' + encodeURIComponent(String(agendaParent.activityId))"
              class="text-sm font-bold text-[var(--dh-primary)] hover:underline">
              {{ agendaParent.activitySubject || 'Ver actividad principal' }}
            </RouterLink>
          </div>
          <div v-if="record.policyId" class="space-y-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
            <h3 class="text-sm font-bold">Seguimiento periódico del cliente</h3>
            <p class="text-sm">Este seguimiento fue creado automáticamente por la política de seguimiento de la cuenta.</p>
            <p class="text-xs text-[var(--dh-text-muted)]">Su fecha original y las opciones de aviso aparecen arriba. La frecuencia y la próxima fecha corresponden a la configuración actual de la política, que puede haber cambiado desde la creación.</p>
            <p class="text-xs text-[var(--dh-text-muted)]">La política no registra por sí misma una minuta o acuerdos. Esos datos solo aparecen cuando fueron guardados en una actividad comercial.</p>
          </div>
          <div v-if="agendaParent?.activityId && agendaLinkedActivityNotes.length" class="space-y-2">
            <h3 class="text-sm font-bold">Minuta y observaciones de la actividad principal</h3>
            <article v-for="note in agendaLinkedActivityNotes" :key="String(note.id)"
              class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
              <p class="whitespace-pre-wrap break-words text-sm">{{ note.noteText ?? 'Sin contenido' }}</p>
              <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ agendaDate(note.createdAt) }}</p>
            </article>
          </div>
          <p v-if="!record.policyId && !agendaParent?.activityId" class="text-sm text-[var(--dh-text-muted)]">
            No hay una actividad principal vinculada a este seguimiento.
          </p>
        </template>
      </section>
      <section v-if="section === 'leads' && leadTab === 'agenda' && (can('crm.activity.read') || can('crm.activity.read-all') || can('crm.task.manage') || can('crm.followup.manage'))"
        id="crm-lead-panel-agenda" role="tabpanel" class="crm-panel space-y-3 p-4">
        <h2 class="text-base font-extrabold">Agenda y seguimiento del prospecto</h2>
        <p class="text-xs text-[var(--dh-text-muted)]">Programá visitas, llamadas, reuniones y seguimientos. Se asocian a este prospecto y se muestran en el calendario comercial, sin volver a ingresar la cédula.</p>
        <CrmSalesCalendar :lead-id="id" :lead-name="String(record.name || record.companyName || '')" />
      </section>
      <section id="crm-lead-panel-conversion" v-if="section === 'leads' && leadTab === 'conversion' && can('crm.lead.convert') && can('crm.account.create')"
        role="tabpanel" data-crm-lead-conversion class="crm-panel scroll-mt-32 space-y-3 p-4">
        <h2 id="crm-lead-conversion" class="font-bold scroll-mt-32">Convertir prospecto en cuenta</h2>
        <template v-if="record.convertedAccountId">
          <p class="text-sm text-[var(--dh-text-muted)]">Este prospecto ya fue convertido.</p>
          <DhButton label="Ver cuenta creada" @click="router.push('/crm/accounts/'+encodeURIComponent(String(record.convertedAccountId)))" />
        </template>
        <form v-else class="grid gap-3 sm:grid-cols-2" @submit.prevent="convertLead">
          <div v-if="record.taxId" class="sm:col-span-2 space-y-2 rounded-xl border border-[var(--dh-border)] p-3">
            <p class="text-xs text-[var(--dh-text-muted)]">Cédula del prospecto (ya registrada)</p>
            <p class="text-sm font-bold">{{ record.taxId }}</p>
            <p class="text-xs text-[var(--dh-text-muted)]">No se solicita nuevamente: se conserva al convertir la cuenta.</p>
          </div>
          <div v-if="record.taxId" class="space-y-2">
            <DhInput v-model="drafts.taxIdTypeCode" label="Tipo de identificación *" placeholder="Hacienda: física, jurídica, DIMEX u otra" />
            <p v-if="leadTaxTypeMessage" role="status" class="text-xs text-[var(--dh-text-muted)]">{{ leadTaxTypeMessage }}</p>
            <DhButton v-if="!drafts.taxIdTypeCode" label="Consultar tipo en Hacienda" variant="secondary"
              :loading="leadTaxTypeLoading" @click="populateLeadTaxType" />
          </div>
          <DhSelect label="Condición comercial" v-model="drafts.conversionCustomerType"
            :options="[{value:'cash',label:'Contado'},{value:'credit',label:'Crédito'}]" />
          <DhSelect label="Tipo de cuenta" v-model="drafts.conversionCategoryType"
            :options="[{value:'CUSTOMER',label:'Cliente'},{value:'NVOCC',label:'Agente / NVOCC'},{value:'LITTLE',label:'Cargas Little'}]"
            @update:model-value="drafts.conversionCategoryCode=can('crm.account.category.manage') ? 'A' : (drafts.conversionCategoryType==='NVOCC'?'B':drafts.conversionCategoryType==='LITTLE'?'A':'D')" />
          <DhSelect label="Categoría" :disabled="!can('crm.account.category.manage')"
            :model-value="can('crm.account.category.manage') ? drafts.conversionCategoryCode : (drafts.conversionCategoryType==='NVOCC'?'B':drafts.conversionCategoryType==='LITTLE'?'A':'D')"
            @update:model-value="drafts.conversionCategoryCode=String($event)"
            :options="(drafts.conversionCategoryType==='LITTLE'?['A']:drafts.conversionCategoryType==='NVOCC'?['A','B']:['A','B','C','D']).map(value=>({value,label:drafts.conversionCategoryType==='LITTLE'?'Cargas Little':'Cliente '+value}))" />
          <DhTextarea v-model="drafts.reason" label="Observaciones de conversión" />
          <div class="sm:col-span-2 flex justify-end">
            <DhButton type="submit" :loading="saving" label="Convertir y abrir cuenta" />
          </div>
        </form>
      </section>

      <section v-if="section === 'opportunities'" class="crm-panel space-y-3 p-4">
        <h2 class="font-bold">{{ t('crm.pipeline') }}</h2>
        <div class="grid gap-3 sm:grid-cols-[1fr,2fr,auto]">
          <select v-model="drafts.stageId" class="crm-input" :aria-label="t('crm.stage')">
            <option value="">{{ t('crm.choose') }}</option>
            <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <input v-model="drafts.reason" class="crm-input" :placeholder="t('crm.reason')" />
          <button v-if="can('crm.opportunity.update')" class="crm-action" :disabled="saving" @click="stageMove">{{ t('crm.moveStage') }}</button>
        </div>
        <button v-if="can('crm.opportunity.close')" class="crm-action" :disabled="saving" @click="closeOpportunity">{{ t('crm.closeOpportunity') }}</button>
      </section>

      <section v-if="(section === 'activities' && can('crm.activity.update')) || (section === 'followups' && can('crm.task.manage'))"
        class="crm-panel space-y-4 p-4 sm:p-5">
        <div>
          <h2 class="text-base font-bold">Gestionar {{ section === 'activities' ? 'actividad' : 'seguimiento' }}</h2>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Actualizá el estado o reprogramá la gestión. Se conserva su historial.</p>
        </div>
        <template v-if="agendaEditable">
          <DhSelect v-model="drafts.status" label="Estado" :options="agendaStatusChoices" />
          <DhInput v-if="drafts.status === 'Completed' && section === 'activities'"
            v-model="drafts.outcome" label="Resultado (código configurado)" />
          <DhTextarea v-if="drafts.status === 'Completed' && section === 'activities'"
            v-model="drafts.note" label="Observaciones" />
          <label v-if="drafts.status !== 'Completed' && drafts.status !== 'Cancelled'" class="block space-y-1.5 text-sm font-semibold">
            Nueva fecha y hora
            <input v-model="drafts.date" type="datetime-local" class="crm-input w-full" />
          </label>
          <DhTextarea v-if="drafts.status === 'Cancelled' || drafts.status === 'Scheduled' || drafts.status === 'Pending' || drafts.status === 'Overdue'"
            v-model="drafts.reason" :label="drafts.status === 'Cancelled' ? 'Motivo de cancelación' : 'Motivo de reprogramación'" />
          <div class="flex justify-end">
            <DhButton label="Guardar cambios" :loading="saving" :disabled="saving" @click="saveAgendaStatus" />
          </div>
        </template>
        <p v-else class="text-sm text-[var(--dh-text-muted)]">Esta gestión ya está finalizada y no puede modificarse.</p>
      </section>

      <section v-if="section === 'accounts' && !showAccountEditor" id="crm-related-management"
        class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]"
        data-crm-account-advanced>
        <div class="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div class="flex min-w-0 items-start gap-3">
            <div class="rounded-xl bg-[var(--dh-primary)]/10 p-2.5 text-[var(--dh-primary)]">
              <Settings2 class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <h2 class="text-sm font-extrabold sm:text-base">Gestión de la cuenta</h2>
              <p class="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--dh-text-muted)]">
                Contactos, direcciones, actividad comercial, crédito y seguimientos: todo vinculado al cliente.
              </p>
            </div>
          </div>
          <button type="button"
            class="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-bold hover:border-[var(--dh-primary)] hover:text-[var(--dh-primary)]"
            :aria-expanded="showAdvancedAccountManagement" aria-controls="crm-advanced-sections"
            @click="showAdvancedAccountManagement = !showAdvancedAccountManagement">
            {{ showAdvancedAccountManagement ? 'Ocultar secciones' : 'Ver y gestionar secciones' }}
            <ChevronDown class="h-4 w-4 transition-transform" :class="showAdvancedAccountManagement && 'rotate-180'" />
          </button>
        </div>
        <div v-if="showAdvancedAccountManagement" id="crm-advanced-sections"
          class="border-t border-[var(--dh-border)] p-3 sm:p-4">
          <p class="mb-3 text-xs leading-relaxed text-[var(--dh-text-muted)]">
            Elegí qué información querés consultar o actualizar. Los registros se guardan en esta cuenta.
          </p>
          <nav class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-label="Secciones de gestión de la cuenta">
            <button v-for="option in accountRelationOptions.filter(item => permitted(item.key))" :key="option.key"
              type="button" :aria-current="relation === option.key ? 'page' : undefined"
              :aria-pressed="relation === option.key"
              class="group flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
              :class="relation === option.key
                ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10 text-[var(--dh-primary)] shadow-sm'
                : 'border-[var(--dh-border)] bg-[var(--dh-shell)] hover:border-[var(--dh-primary)]/50'"
              @click="relation = option.key">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--dh-card)]">
                <component :is="option.icon" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-xs font-extrabold">{{ option.label }}</span>
                <span class="mt-1 block text-[11px] leading-snug text-[var(--dh-text-muted)]">{{ option.subtitle }}</span>
              </span>
              <ChevronDown class="h-3.5 w-3.5 shrink-0 -rotate-90 text-[var(--dh-text-muted)]" />
            </button>
          </nav>
        </div>
      </section>
      <CrmActivityCollaboration v-if="section === 'activities'" :activity-id="id"
        :account-id="record.accountId ? String(record.accountId) : null"
        :can-manage="can('crm.activity.update')" :parent-subject="String(record.subject || '')" />
      <nav v-if="section !== 'accounts' && section !== 'activities'" class="flex flex-wrap gap-2" aria-label="CRM">
        <button v-for="tab in tabs.filter(permitted)" :key="tab" class="crm-action"
          :aria-pressed="relation===tab" @click="relation=tab">
          {{ ({
            contacts: 'Contactos',
            addresses: 'Direcciones',
            'business-activities': 'Actividades económicas',
            'trade-profiles': 'Rutas habituales',
            'credit-profiles': 'Perfiles de crédito',
            'credit-contracts': 'Contratos de crédito',
            'followup-policy': 'Política de seguimiento',
            routes: 'Rutas', services: 'Servicios',
          } as Record<string, string>)[tab] ?? tab }}
        </button>
      </nav>
      <section v-if="relation && permitted(relation) && (section !== 'accounts' || (showAdvancedAccountManagement && !showAccountEditor))"
        class="crm-panel space-y-4 p-4 sm:p-5" :data-crm-advanced-content="section === 'accounts' ? relation : undefined">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dh-border)] pb-4">
          <div class="min-w-0">
            <p v-if="section === 'accounts'" class="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--dh-primary)]">Información complementaria</p>
            <h3 class="text-base font-extrabold">
              {{ section === 'accounts' ? (accountRelationInfo?.label ?? relation) : relation }}
              <span class="ml-1 text-xs font-medium text-[var(--dh-text-muted)]">({{ relationRows.length }})</span>
            </h3>
            <p v-if="section === 'accounts'" class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ accountRelationInfo?.description }}</p>
          </div>
          <DhButton v-if="canAddRelation" :icon="Plus"
            :label="section === 'accounts' && relation === 'contacts' ? 'Nuevo contacto' :
              relation === 'credit-profiles' ? 'Añadir crédito' :
              relation === 'credit-contracts' ? 'Nuevo contrato' : t('common.create')"
            @click="openRelationCreation" />
        </div>
        <p v-if="documentStatus && relation==='credit-contracts'" role="status" class="text-sm text-emerald-500">{{ documentStatus }}</p>
        <div v-if="!relationRows.length"
          class="rounded-xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-8 text-center">
          <p class="text-sm font-semibold">{{ section === 'accounts' ? (accountRelationInfo?.empty ?? 'Sin información registrada.') : t('common.noData') }}</p>
          <p v-if="section === 'accounts' && canAddRelation" class="mt-2 text-xs text-[var(--dh-text-muted)]">Podés agregar el primer registro con el botón de arriba.</p>
        </div>
        <div v-for="item in pagedRelationRows" :key="item.id"
          class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 text-sm sm:p-4">
          <template v-if="section === 'accounts' && relation === 'contacts'">
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dh-primary)]/10 text-xs font-extrabold text-[var(--dh-primary)]">
                {{ String(item.name ?? '?').trim().slice(0,2).toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1 space-y-1">
                <RouterLink v-if="can('crm.contact.read')" :to="'/crm/contacts/' + encodeURIComponent(String(item.id))"
                  class="block truncate text-sm font-extrabold hover:text-[var(--dh-primary)] hover:underline">
                  {{ item.name || 'Contacto' }}
                </RouterLink>
                <p v-else class="font-extrabold">{{ item.name || 'Contacto' }}</p>
                <p v-if="item.jobTitle" class="text-xs text-[var(--dh-text-muted)]">{{ item.jobTitle }}</p>
              </div>
              <span v-if="item.isPrimary" class="rounded-full border border-[var(--dh-primary)]/40 bg-[var(--dh-primary)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--dh-primary)]">Contacto principal</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-3 border-t border-[var(--dh-border)] pt-3 text-xs">
              <a v-if="item.email" :href="'mailto:' + String(item.email)"
                class="inline-flex items-center gap-1.5 text-[var(--dh-text-muted)] hover:text-[var(--dh-primary)]">
                <Mail class="h-3.5 w-3.5" />{{ item.email }}
              </a>
              <a v-if="item.phone" :href="'tel:' + String(item.phone)"
                class="inline-flex items-center gap-1.5 text-[var(--dh-text-muted)] hover:text-[var(--dh-primary)]">
                <Phone class="h-3.5 w-3.5" />{{ item.phone }}
              </a>
              <span v-if="!item.email && !item.phone" class="text-[var(--dh-text-muted)]">Sin medios de contacto</span>
            </div>
          </template>
          <template v-else-if="relation === 'business-activities'">
            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]"><Activity class="h-4 w-4" /></div>
              <div class="min-w-0">
                <p class="text-sm font-extrabold">{{ item.activityCode ?? item.code ?? 'Actividad económica' }}</p>
                <p class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ item.activityDescription ?? item.description ?? 'Sin descripción registrada' }}</p>
              </div>
            </div>
          </template>
          <template v-else-if="relation === 'addresses'">
            <div class="flex items-start gap-3">
              <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-[var(--dh-primary)]" />
              <div class="min-w-0"><p class="text-sm font-bold">{{ item.addressText ?? 'Dirección sin especificar' }}</p>
                <p v-if="item.admin1Name || item.admin2Name || item.admin3Name || item.postalCode"
                  class="mt-1 text-xs text-[var(--dh-text-muted)]">
                  {{ [item.admin3Name, item.admin2Name, item.admin1Name, item.postalCode].filter(Boolean).join(' · ') }}
                </p>
                <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ item.addressType === 'WORK' ? 'Oficina / trabajo' : item.addressType === 'BILLING' ? 'Facturación' : item.addressType ?? 'Dirección de la cuenta' }}</p>
              </div>
            </div>
          </template>
          <template v-else-if="relation === 'credit-contracts'">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h4 class="text-sm font-extrabold">Contrato {{ item.contractNumber || 'sin número de referencia' }}</h4>
              <span class="rounded-full border border-[var(--dh-border)] px-3 py-1 text-xs font-bold">{{ item.status === 'Draft' ? 'Borrador' : item.status === 'Active' ? 'Vigente' : item.status }}</span>
            </div>
            <dl class="mt-3 grid gap-3 text-xs sm:grid-cols-3">
              <div><dt class="text-[var(--dh-text-muted)]">Inicio</dt><dd class="mt-1 font-semibold">{{ item.startDate ? contractDate(item.startDate) : '—' }}</dd></div>
              <div><dt class="text-[var(--dh-text-muted)]">Próxima renovación</dt><dd class="mt-1 font-semibold">{{ item.renewalDate ? contractDate(item.renewalDate) : '—' }}</dd></div>
              <div><dt class="text-[var(--dh-text-muted)]">Vencimiento</dt><dd class="mt-1 font-semibold">{{ item.expiryDate ? contractDate(item.expiryDate) : 'Sin definir' }}</dd></div>
            </dl>
            <p v-if="item.paymentTerms" class="mt-3 text-xs text-[var(--dh-text-muted)]">{{ item.paymentTerms }}</p>
          </template>
          <template v-else-if="section === 'followups' && relation === 'history'">
            <p class="font-bold">{{ ({Created:'Creado',Overdue:'Vencido',Rescheduled:'Reprogramado',Completed:'Completado',Cancelled:'Cancelado',Archived:'Archivado'} as Record<string,string>)[String(item.action ?? '')] ?? String(item.action || 'Cambio de estado') }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ agendaDate(item.createdAt) }}</p>
            <p v-if="item.reason" class="mt-2 whitespace-pre-wrap break-words text-sm">
              {{ item.reason === 'Policy scheduler' ? 'Generado automáticamente por la política de seguimiento del cliente.' :
                 item.reason === 'Past due; execution was not assumed' ? 'La fecha venció sin que se registrara su finalización.' : item.reason }}
            </p>
            <p v-if="item.previousDueAt || item.newDueAt" class="mt-2 text-xs text-[var(--dh-text-muted)]">
              {{ item.previousDueAt ? 'Anterior: ' + agendaDate(item.previousDueAt) : '' }}
              {{ item.newDueAt ? ' · Fecha: ' + agendaDate(item.newDueAt) : '' }}
            </p>
          </template>
          <template v-else>
            <p class="font-bold">{{ item.name ?? item.activityCode ?? item.quoteNumberSnapshot ?? item.serviceCode ?? item.status ?? item.addressText ?? 'Registro' }}</p>
            <p v-if="item.activityDescription || item.email || item.reason || item.paymentTerms || item.statusSnapshot"
              class="mt-1 text-xs leading-relaxed text-[var(--dh-text-muted)]">
              {{ item.activityDescription ?? item.email ?? item.reason ?? item.paymentTerms ?? item.statusSnapshot }}
            </p>
          </template>
          <button v-if="relation==='credit-contracts' && item.signedDocumentFileId" type="button"
            class="crm-action mt-2 text-xs" @click="downloadSignedContract(String(item.signedDocumentFileId))">
            Descargar contrato firmado
          </button>
          <div v-if="relation==='credit-profiles' && section==='accounts' && item.status==='PendingApproval'
            && can('crm.credit.approve')" class="mt-3 flex flex-wrap gap-2">
            <button :disabled="saving" class="crm-action"
              @click="actOnChild(item,'approve','crm.credit.approve',{reason:drafts.reason||'Aprobación financiera'})">
              {{ t('crm.approveCredit') }}
            </button>
            <button :disabled="saving" class="crm-action"
              @click="actOnChild(item,'reject','crm.credit.approve',{reason:drafts.reason||'Rechazo financiero'})">
              {{ t('crm.rejectCredit') }}
            </button>
          </div>
          <div v-if="relation==='credit-contracts' && section==='accounts' && can('crm.contract.manage')"
            class="mt-3 flex flex-wrap items-center gap-2">
            <CrmContractFileDropzone :model-value="contractFiles[String(item.id)] ?? null"
              label="Documento firmado" :disabled="documentBusy"
              @update:model-value="selectExistingContractFile(item, $event)" />
            <button v-if="item.status==='Draft'" :disabled="saving" class="crm-action"
              @click="actOnChild(item,'activate','crm.contract.manage',{reason:drafts.reason||'Activación'})">
              {{ t('crm.activateContract') }}
            </button>
            <button v-if="item.status==='Active'" :disabled="saving" class="crm-action"
              @click="actOnChild(item,'cancel','crm.contract.manage',{reason:drafts.reason||'Cancelación'})">
              {{ t('crm.cancelContract') }}
            </button>
            <div v-if="item.status==='Active'" class="w-full space-y-2 rounded-xl border border-[var(--dh-border)] p-3">
              <label class="block text-xs font-semibold">Nueva fecha de renovación
                <input v-model="contractRenewalDrafts[String(item.id)]" type="date" class="crm-input mt-2 w-full" />
              </label>
              <button type="button" :disabled="saving || !contractRenewalDrafts[String(item.id)]"
                class="crm-action crm-drawer-primary"
                @click="actOnChild(item,'renew','crm.contract.manage',{
                  operationId:crmUuid(),renewalDate:toUtc(contractRenewalDrafts[String(item.id)]),
                  expiryDate:item.expiryDate ?? null, reason:'Renovación solicitada por el cliente'
                })">Renovar contrato</button>
            </div>
          </div>

        </div>
        <DhPagination v-if="relationRows.length > relationPageSize" :page="relationPage"
          :page-size="relationPageSize" :total="relationRows.length"
          @update:page="relationPage = $event" @update:page-size="relationPageSize = $event; relationPage = 1" />
        <DhDrawer :open="showRelationForm && canAddRelation"
          :title="section === 'accounts'
             ? (relation === 'contacts' ? 'Nuevo contacto' :
                relation === 'credit-contracts' ? 'Registrar contrato de crédito' :
                relation === 'credit-profiles' ? 'Nueva solicitud de crédito' : 'Nuevo · ' + (accountRelationInfo?.label ?? relation))
             : t('common.create') + ' · ' + relation" size="lg" @close="showRelationForm = false">
          <p v-if="error" role="alert" class="mb-3 rounded-xl border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</p>
        <form v-if="section==='accounts' && relation==='addresses' && can('crm.account.update')"
          class="grid gap-4 p-1 sm:grid-cols-2" @submit.prevent="addAddress">
          <label class="crm-drawer-field">Tipo de dirección
            <select v-model="drafts.addressType" class="crm-input" required>
              <option value="WORK">Oficina / trabajo</option><option value="BILLING">Facturación</option>
              <option value="WAREHOUSE">Bodega</option><option value="OTHER">Otra</option>
            </select>
          </label>
          <CrmAddressLocationFields :key="addressFormVersion" v-model="addressLocation"
            :default-country-id="String(record?.countryId ?? '')" />
          <label class="crm-drawer-field sm:col-span-2">Dirección exacta y señas
            <textarea v-model.trim="drafts.addressText" class="crm-input" rows="3" required maxlength="2000" placeholder="Calle, número, edificio, puntos de referencia y señas" />
          </label>
          <div class="flex justify-end gap-2 border-t border-[var(--dh-border)] pt-4 sm:col-span-2">
            <button type="button" class="crm-action" @click="showRelationForm=false">Cancelar</button>
            <button class="crm-action crm-drawer-primary" type="submit" :disabled="saving">{{ saving?'Guardando…':'Guardar dirección' }}</button>
          </div>
        </form>
        <form v-if="section==='accounts' && relation==='followup-policy' && can('crm.followup.manage')"
          class="grid gap-4 p-1 sm:grid-cols-2" @submit.prevent="savePolicy">
          <p class="text-sm text-[var(--dh-text-muted)] sm:col-span-2">
            Definí cada cuánto volver a contactar al cliente y cómo avisar al vendedor.
            Si aún no existe una política, se creará al guardar.
          </p>
          <label class="crm-drawer-field">Responsable del seguimiento
            <select v-model="drafts.assignedUserId" class="crm-input" required>
              <option :value="String(auth.userId || '')">Mi usuario</option>
              <option v-if="record && !record.isCastroFallasExecutive && record.executiveUserId && record.executiveUserId!==auth.userId"
                :value="String(record.executiveUserId)">Vendedor asignado a la cuenta</option>
              <option v-if="relationRows.length && ![String(auth.userId||''),String(record?.executiveUserId||'')].includes(String(relationRows[0]?.ownerUserId))"
                :value="String(relationRows[0]?.ownerUserId)">Responsable actual</option>
            </select>
          </label>
          <label class="crm-drawer-field">Próximo seguimiento
            <input v-model="drafts.date" class="crm-input" type="datetime-local" required />
          </label>
          <label class="crm-drawer-field">Repetir cada (días)
            <input v-model.number="drafts.frequencyDays" class="crm-input" type="number" min="1" max="365" required />
          </label>
          <label class="crm-drawer-field">Recordar antes
            <select v-model.number="drafts.reminderLeadMinutes" class="crm-input">
              <option :value="5">5 minutos</option><option :value="15">15 minutos</option>
              <option :value="30">30 minutos</option><option :value="60">1 hora</option>
              <option :value="1440">1 día</option><option :value="10080">7 días</option>
            </select>
          </label>
          <label class="crm-drawer-field">Canal de aviso
            <select v-model="drafts.channelStrategy" class="crm-input">
              <option value="BOTH">Sistema y correo</option>
              <option value="SYSTEM">Solo sistema</option><option value="EMAIL">Solo correo</option>
            </select>
          </label>
          <label class="crm-drawer-field">Zona horaria
            <select v-model="drafts.timezoneId" class="crm-input"><option value="America/Costa_Rica">Costa Rica</option><option value="America/Panama">Panamá</option><option value="America/Guatemala">Guatemala</option><option value="UTC">UTC</option></select>
          </label>
          <div class="flex justify-end gap-2 border-t border-[var(--dh-border)] pt-4 sm:col-span-2">
            <button type="button" class="crm-action" @click="showRelationForm=false">Cancelar</button>
            <button class="crm-action crm-drawer-primary" type="submit" :disabled="saving">{{ saving?'Guardando…':'Guardar política' }}</button>
          </div>
        </form>
        <form v-if="section==='activities' && relation==='notes' && can('crm.activity.update')"
          class="grid gap-3 sm:grid-cols-[1fr,auto]" @submit.prevent="addNote">
          <textarea v-model="drafts.note" required class="crm-input" :placeholder="t('crm.notes')" />
          <button type="submit" class="crm-action" :disabled="saving">{{ t('crm.addNote') }}</button>
        </form>
        <form v-if="section==='analyses' && relation==='services' && can('crm.analysis.manage')"
          class="grid gap-3 sm:grid-cols-4" @submit.prevent="addService">
          <input v-model.trim="drafts.serviceCode" required class="crm-input" :placeholder="t('crm.serviceCode')" />
          <input v-model.trim="drafts.modalityCode" required class="crm-input" placeholder="FCL" />
          <input v-model="drafts.volume" type="number" min="0" step=".01" required class="crm-input" />
          <button type="submit" class="crm-action" :disabled="saving">{{ t('crm.addService') }}</button>
        </form>
        <form v-if="section==='opportunities' && relation==='negotiations' && can('crm.opportunity.update')"
          class="grid gap-3 sm:grid-cols-[1fr,auto]" @submit.prevent="addNegotiation">
          <input v-model.trim="drafts.summary" required class="crm-input" :placeholder="t('crm.negotiationSummary')" />
          <button type="submit" class="crm-action" :disabled="saving">{{ t('crm.addNegotiation') }}</button>
        </form>

        <CrmContactForm v-if="section==='accounts' && relation==='contacts' && showRelationForm && can('crm.contact.create')"
          :account-id="id" @saved="onLinkedContactSaved" @cancel="showRelationForm=false" />
        <form v-if="section==='accounts' && relation==='credit-profiles' && can('crm.credit.manage')"
          class="grid gap-4 p-1 sm:grid-cols-2" @submit.prevent="createCredit">
          <label class="crm-drawer-field">Días de crédito
            <input v-model.number="drafts.creditDays" type="number" min="0" max="365" class="crm-input" required />
          </label>
          <label class="crm-drawer-field">Límite de crédito
            <input v-model.number="drafts.creditLimit" type="number" min="0" step=".01" class="crm-input" required />
          </label>
          <label class="crm-drawer-field">Financiamiento mensual (%)
            <input v-model.number="drafts.monthlyFinancingPct" type="number" min="0" max="100" step=".0001" class="crm-input" />
          </label>
          <label class="crm-drawer-field">Interés moratorio mensual (%)
            <input v-model.number="drafts.lateInterestMonthlyPct" type="number" min="0" max="100" step=".0001" class="crm-input" />
          </label>
          <CrmCatalogPicker label="Moneda" catalog-group-slug="currencies" value-kind="value" v-model="drafts.currencyCode" />
          <label class="crm-drawer-field sm:col-span-2">Condiciones generales de pago (texto complementario)
            <textarea v-model="drafts.paymentConditions" class="crm-input" rows="3" placeholder="Condiciones generales de pago" />
          </label>
          <CrmCreditCoveragePicker v-model="creditIncluded" label="Crédito incluye · selección múltiple" />
          <CrmCreditCoveragePicker v-model="creditExcluded" label="Crédito NO incluye · selección múltiple" />
          <p class="text-xs text-[var(--dh-text-muted)] sm:col-span-2">El crédito queda pendiente de aprobación. Un usuario con crm.credit.approve decidirá aprobarlo o rechazarlo.</p>
          <label class="crm-drawer-field">Próxima revisión
            <input v-model="drafts.renewalDate" type="datetime-local" class="crm-input" />
          </label>
          <div class="flex justify-end gap-2 border-t border-[var(--dh-border)] pt-4 sm:col-span-2">
            <button type="button" class="crm-action" @click="showRelationForm=false">Cancelar</button>
            <button class="crm-action crm-drawer-primary" type="submit" :disabled="saving">{{ saving?'Guardando…':'Solicitar aprobación de crédito' }}</button>
          </div>
        </form>
        <form v-if="section==='accounts' && relation==='credit-contracts' && can('crm.contract.manage')"
          class="space-y-5 p-2" data-crm-contract-form @submit.prevent="createContract">
          <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
            <h3 class="text-base font-extrabold">Registrar contrato de crédito</h3>
            <p class="mt-2 text-xs leading-relaxed text-[var(--dh-text-muted)]">Ingresá las fechas y, si ya está firmado, adjuntá el documento. El sistema gestiona los identificadores y lo vincula automáticamente a este cliente.</p>
          </div>
          <section class="space-y-3 rounded-xl border border-[var(--dh-border)] p-4">
            <h4 class="text-sm font-bold">Información principal</h4>
            <label class="crm-drawer-field">Número o referencia del contrato (opcional)
              <input v-model.trim="drafts.contractNumber" class="crm-input" maxlength="100" placeholder="Ej. CR-2026-015" />
            </label>
            <label class="crm-drawer-field">Condiciones del acuerdo (opcional)
              <textarea v-model="drafts.paymentConditions" class="crm-input" rows="3" maxlength="4000" placeholder="Detalle de condiciones y acuerdos comerciales" />
            </label>
          </section>
          <section class="space-y-3 rounded-xl border border-[var(--dh-border)] p-4">
            <h4 class="text-sm font-bold">Fechas y vigencia</h4>
            <p class="text-xs text-[var(--dh-text-muted)]">El inicio y la próxima renovación son obligatorios. El vencimiento se puede completar después.</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="crm-drawer-field">Fecha de inicio *
                <input v-model="drafts.startDate" required type="date" class="crm-input" />
              </label>
              <label class="crm-drawer-field">Próxima renovación *
                <input v-model="drafts.renewalDate" required type="date" class="crm-input" />
              </label>
              <label class="crm-drawer-field sm:col-span-2">Fecha de vencimiento (opcional)
                <input v-model="drafts.expiryDate" type="date" class="crm-input" />
              </label>
            </div>
          </section>
          <section class="space-y-3 rounded-xl border border-[var(--dh-border)] p-4">
            <h4 class="text-sm font-bold">Documento del contrato</h4>
            <CrmContractFileDropzone v-model="signedContractFile"
              label="Contrato firmado (opcional)" :disabled="saving" />
          </section>
          <p v-if="newlyCreatedContractId" role="status" class="rounded-xl border border-amber-500/40 p-3 text-xs text-amber-600">El contrato ya fue creado. Si falló el adjunto, podés volver a guardarlo sin duplicar el registro.</p>
          <div class="sticky bottom-0 flex justify-end gap-3 border-t border-[var(--dh-border)] bg-[var(--dh-card)] py-4">
            <button type="button" class="rounded-xl border border-[var(--dh-border)] px-4 py-2.5 text-sm font-semibold" :disabled="saving" @click="showRelationForm=false">Cancelar</button>
            <button class="rounded-xl bg-[var(--dh-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" type="submit" :disabled="saving">{{ saving?'Guardando…':newlyCreatedContractId?'Reintentar adjunto':'Guardar contrato' }}</button>
          </div>
        </form>
        <form v-if="section==='opportunities' && relation==='quotes' && can('crm.quote.link')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="linkQuote">
          <input v-model.trim="drafts.quoteId" required class="crm-input" :placeholder="t('crm.quoteId')" />
          <input v-model.trim="drafts.pricingRequestId" class="crm-input" :placeholder="t('crm.pricingRequestId')" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.linkQuote') }}</button>
        </form>
        <form v-if="section==='opportunities' && relation==='rate-requests' && can('crm.quote.link')"
          class="grid gap-3 sm:grid-cols-2" @submit.prevent="createPricingRequest">
          <select v-model="drafts.priority" class="crm-input">
            <option v-for="p in ['Green','Yellow','Red']" :key="p">{{ p }}</option>
          </select>
          <input v-model="drafts.shipmentMode" class="crm-input" :placeholder="t('crm.shipmentMode')" required />
          <input v-model="drafts.originName" class="crm-input" :placeholder="t('crm.origin')" required />
          <input v-model="drafts.destinationName" class="crm-input" :placeholder="t('crm.destination')" />
          <textarea v-model="drafts.payload" class="crm-input sm:col-span-2" rows="3" :aria-label="t('crm.pricingPayload')" />
          <p class="text-xs text-[var(--dh-text-muted)] sm:col-span-2">{{ t('crm.pricingRequestWarning') }}</p>
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.createPricingRequest') }}</button>
        </form>
        <form v-if="section==='analyses' && relation==='routes' && can('crm.analysis.manage')"
          class="grid gap-3 sm:grid-cols-4" @submit.prevent="createRoute">
          <CrmCatalogPicker label="POL · Puerto de origen" catalog-group-slug="pol" value-kind="code"
            v-model="drafts.polCode" />
          <CrmCatalogPicker label="POE · Puerto de entrada" catalog-group-slug="poe" value-kind="code"
            v-model="drafts.poeCode" />
          <CrmCatalogPicker label="POD · Puerto de destino" catalog-group-slug="pod" value-kind="code"
            v-model="drafts.podCode" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.addRoute') }}</button>
        </form>
        <form v-if="section==='settings' && relation==='stages' && can('crm.settings.manage')"
          class="grid gap-3 sm:grid-cols-3" @submit.prevent="createStage">
          <input v-model="drafts.contactName" required class="crm-input" :placeholder="t('crm.stageName')" />
          <input v-model="drafts.volume" type="number" min="0" class="crm-input" />
          <button class="crm-action" type="submit" :disabled="saving">{{ t('crm.addStage') }}</button>
        </form>
        </DhDrawer>
      </section>
    </template>
  </main>
</template>

<style scoped>
.crm-lead-tabs{top:84px;backdrop-filter:blur(18px)}
@media(min-width:768px){.crm-lead-tabs{top:144px}}
.crm-lead-tab{display:inline-flex;align-items:center;gap:.45rem;white-space:nowrap;padding:.75rem 1rem;border:1px solid var(--dh-border);border-radius:.7rem;font-size:.8rem;font-weight:800;color:var(--dh-text);background:var(--dh-shell);transition:background .15s,color .15s}
.crm-lead-tab:hover,.crm-lead-tab:focus-visible{color:var(--dh-text);background:var(--dh-primary-light,transparent);outline-offset:-2px}
.crm-lead-tab-active{color:white;background:var(--dh-primary);border-color:var(--dh-primary);box-shadow:0 2px 8px rgba(0,0,0,.12)}

.crm-panel{border:1px solid var(--dh-border);border-radius:1.25rem;background:var(--dh-card)}
.crm-action{border:1px solid var(--dh-border);border-radius:.75rem;padding:.6rem .95rem;font-weight:700;min-height:42px;color:var(--dh-text)}
.crm-action:disabled{opacity:.5}.crm-action[aria-pressed=true]{background:var(--dh-primary);color:#fff}
.crm-input{min-width:0;width:100%;background:var(--dh-card);color:var(--dh-text);border:1px solid var(--dh-border);border-radius:.75rem;padding:.6rem}
.crm-drawer-field{display:flex;flex-direction:column;gap:.45rem;color:var(--dh-text-muted);font-size:.78rem;font-weight:700}
.crm-drawer-field .crm-input{font-size:.9rem;font-weight:500;background:var(--dh-input)}
.crm-drawer-primary{border-color:var(--dh-primary);background:var(--dh-primary);color:white}
.crm-error{border:1px solid #da8d79;border-radius:.75rem;padding:.8rem}
</style>
