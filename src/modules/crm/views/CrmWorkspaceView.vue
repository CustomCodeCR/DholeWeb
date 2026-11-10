<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, nextTick } from 'vue'
import { BriefcaseBusiness, Plus, RefreshCw, Building2, ContactRound, Search, CalendarClock, Route, Wallet, ArrowRight } from 'lucide-vue-next'
import { DhButton, DhInput, DhMultiSelect, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import CrmReferencePicker from '../components/CrmReferencePicker.vue'
import CrmExecutivePicker from '../components/CrmExecutivePicker.vue'
import CrmRelationshipPicker from '../components/CrmRelationshipPicker.vue'
import CrmCatalogPicker from '../components/CrmCatalogPicker.vue'
import CrmHaciendaLookup, { type HaciendaResult } from '../components/CrmHaciendaLookup.vue'
import CrmPhoneInput from '../components/CrmPhoneInput.vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
import { useRequiredFieldFeedback } from '@/core/composables/useRequiredFieldFeedback'
import { useI18n } from 'vue-i18n'
import { CRM_MODULES, crmDefaults, crmPayload, type CrmSection } from '../model/crmForms'
import { identificationOptionsForCountry, normalizeIdentificationType } from '../model/crmIdentification'
import { crmAction, crmCreate, crmEnabled, crmError, crmList, crmPatch,
  crmRequest, crmUuid, crmPath, fromUtc, type CrmRow } from '../services/crmApi'
import { crmSectionScope } from '../model/crmForms'
import { crmAgendaDays, crmAgendaRecordsForDay } from '../model/crmAgenda'
import { crmAgendaClientName, crmAgendaExecutiveName, crmAgendaIdentityIds,
  type CrmAgendaIdentityLabels } from '../model/crmAgendaIdentity'
import CrmSalesCalendar from '../components/CrmSalesCalendar.vue'
import CrmAccountViewerManager from '../components/CrmAccountViewerManager.vue'
import CrmArchiveAction from '../components/CrmArchiveAction.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { t, locale } = useI18n()
const section = computed(() => String(route.meta.crmSection || 'dashboard') as CrmSection)
const model = computed(() => CRM_MODULES[section.value])
const pageTitle = computed(() => section.value === 'dashboard' ? t('crm.dashboard') : section.value === 'finance' ? t('crm.finance') : model.value?.title ?? t('crm.title'))
const formTitle = computed(() => `${edited.value ? t('common.edit') : t('common.create')} · ${model.value?.title ?? ''}`)
const referenceResources: Record<string, 'accounts' | 'leads' | 'opportunities'> = {
  accountId: 'accounts', leadId: 'leads', opportunityId: 'opportunities',
}
const referenceScopes: Record<string, string[]> = {
  accountId: ['crm.account.read', 'crm.account.read-all'],
  leadId: ['crm.lead.read', 'crm.lead.read-all'],
  opportunityId: ['crm.opportunity.read', 'crm.opportunity.read-all'],
}
const canSelectReference = (key: string) => (referenceScopes[key] ?? []).some(scope => auth.hasScope(scope))
const catalogFields: Record<string, { slug: string; kind: 'id' | 'code' | 'value' }> = {
  countryId: { slug: 'countries', kind: 'id' },
  currencyCode: { slug: 'currencies', kind: 'value' },
}
function upperAccountName(value: unknown): string {
  return String(value ?? '').toLocaleUpperCase('es-CR')
}

function applyHacienda(result: HaciendaResult) {
  // Every explicit tax lookup replaces the stale account name.
  if (String(form.taxId ?? '').replace(/[\s-]/g, '') !== result.identification.replace(/[\s-]/g, '')) return
  form.legalName = upperAccountName(result.name)
  form.displayName = upperAccountName(result.name)
  if (result.identificationType) form.taxIdTypeCode = normalizeIdentificationType(result.identificationType)
}

function applyLeadHacienda(result: HaciendaResult) {
  if (String(form.taxId ?? '').replace(/[\s-]/g, '') !== result.identification.replace(/[\s-]/g, '')) return
  form.companyName = upperAccountName(result.name)
  if (!String(form.name ?? '').trim()) form.name = upperAccountName(result.name)
}

const columns = computed<DhTableColumn<CrmRow>[]>(() => {
  const action = { key: 'actions', label: t('common.actions'), align: 'right' as const }
  if (section.value === 'accounts') return [
    { key: '_crmTitle', label: 'Cliente' },
    { key: '_crmDescription', label: 'Razón social' },
    { key: '_crmTax', label: 'Identificación' },
    { key: '_crmCountry', label: 'País' },
    { key: '_crmType', label: 'Tipo de cliente' },
    { key: '_crmSeller', label: 'Vendedor asignado' },
    { key: '_crmCategory', label: 'Categoría' },
    { key: '_crmStatus', label: t('common.status') },
    action,
  ]
  if (section.value === 'leads') return [
    { key: '_crmTitle', label: 'Cliente potencial' },
    { key: '_crmDescription', label: 'Empresa' },
    { key: '_crmSeller', label: 'Vendedor asignado' },
    { key: '_crmEmail', label: 'Correo' },
    { key: '_crmPhone', label: 'Teléfono' },
    { key: '_crmStatus', label: 'Calificación' },
    action,
  ]
  if (section.value === 'opportunities') return [
    { key: '_crmTitle', label: 'Oportunidad' },
    { key: '_crmAmount', label: 'Venta estimada' },
    { key: '_crmDue', label: 'Cierre previsto' },
    { key: '_crmStatus', label: 'Etapa / estado' },
    action,
  ]
  if (section.value === 'activities') return [
    { key: '_crmTitle', label: 'Actividad' },
    { key: '_crmChannel', label: 'Tipo' },
    { key: '_crmDue', label: 'Fecha y hora' },
    { key: '_crmStatus', label: 'Estado' },
    action,
  ]
  if (section.value === 'followups') return [
    { key: '_crmTitle', label: 'Actividad o seguimiento' },
    { key: '_crmClient', label: 'Cliente' },
    { key: '_crmExecutive', label: 'Ejecutivo comercial' },
    { key: '_crmChannel', label: 'Tipo' },
    { key: '_crmDue', label: 'Próxima gestión' },
    { key: '_crmStatus', label: 'Estado' },
    action,
  ]
  if (section.value === 'analyses') return [
    { key: '_crmTitle', label: 'Mercado' },
    { key: '_crmDescription', label: 'Observaciones' },
    { key: '_crmAmount', label: 'Volumen mensual' },
    action,
  ]
  return [
    { key: '_crmTitle', label: t('common.name') },
    { key: '_crmDescription', label: t('common.description') },
    { key: '_crmStatus', label: t('common.status') },
    action,
  ]
})
function accountCategoryLabel(item: CrmRow): string {
  const types: Record<string,string> = {
    CUSTOMER: 'Cliente', NVOCC: 'Agente / NVOCC', LITTLE: 'Cargas Little',
  }
  const type = String(item.categoryType ?? '')
  const label = types[type] ?? 'Cuenta'
  const tier = String(item.categoryCode ?? '')
  return label + (type !== 'LITTLE' && ['A','B','C','D'].includes(tier)
    ? ' categoría ' + tier : '')
}
const tableRows = computed(() => (section.value === 'finance' || section.value === 'settings'
  ? rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
  : rows.value).map(item => ({
  ...item,
  _crmResource: item._crmResource,
  _crmConvertedAccountId: item.convertedAccountId,
  _crmTitle: section.value === 'followups'
    ? String(item.subject || (item._crmResource === 'followups' ? 'Seguimiento comercial' : 'Actividad comercial'))
    : String(item[model.value?.primary ?? 'contractNumber'] ?? item.contractNumber ?? item.id),
  _crmClient: section.value !== 'followups' ? '—'
    : agendaIdentityLoading.value && Boolean(item.accountId || item.leadId)
      ? 'Consultando…' : crmAgendaClientName(item, agendaIdentityLabels.value),
  _crmExecutive: section.value !== 'followups' ? '—'
    : agendaIdentityLoading.value && Boolean(item._crmResource === 'followups'
      ? item.assignedUserId : item.ownerUserId)
      ? 'Consultando…' : crmAgendaExecutiveName(item, agendaIdentityLabels.value, String(auth.userId ?? '')),
  _crmDescription: String(item[model.value?.secondary ?? 'paymentTerms'] ?? '—'),
  _crmStatus: section.value === 'followups'
    ? ({Scheduled:'Programada',Pending:'Pendiente',Overdue:'Vencida',Completed:'Completada',Cancelled:'Cancelada'} as Record<string,string>)[String(item.status)] || String(item.status ?? '—')
    : String(item.status ?? item.qualificationStatus ?? '—'),
  _crmTax: String(item.taxId ?? '—'),
  _crmCountry: countryLabels.value[String(item.countryId ?? '')] || '—',
  _crmSeller: section.value === 'accounts' || section.value === 'leads'
    ? (sellerNames.value[String(item.id)] ?? 'Consultando vendedor…') : '—',
  _crmCategory: accountCategoryLabel(item),
  _crmType: item.customerTypeCode === 'credit' ? 'Crédito' : item.customerTypeCode === 'cash' ? 'Contado' : '—',
  _crmEmail: String(item.contactEmail ?? '—'),
  _crmPhone: String(item.phone ?? '—'),
  _crmChannel: section.value === 'followups'
    ? ({VISIT:'Visita',CALL:'Llamada',EMAIL:'Correo',MEETING:'Reunión',OTHER:'Actividad',FOLLOWUP:'Seguimiento',SYSTEM:'Seguimiento'} as Record<string,string>)[String(item._crmResource === 'followups' ? 'FOLLOWUP' : item.type ?? 'OTHER')] || 'Actividad'
    : String(item.type ?? item.channel ?? '—'),
  _crmAmount: section.value === 'analyses'
    ? String(item.estimatedMonthlyVolume ?? '—') + ' ' + String(item.volumeUnit ?? '')
    : item.amountEstimated == null ? '—' :
      Number(item.amountEstimated).toLocaleString(locale.value === 'en' ? 'en-US' : 'es-CR', { maximumFractionDigits: 2 }) + ' ' + String(item.currencyCode ?? ''),
  _crmDue: (() => {
    const value = item.expectedCloseAt ?? item.scheduledStartAt ?? item.dueAt
    if (typeof value !== 'string' || !value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale.value === 'en' ? 'en-US' : 'es-CR',
      { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  })(),
})))
const can = (scope: string) => auth.hasScope(scope)
const allowed = computed(() => crmEnabled() && crmSectionScope[section.value].some(can))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const rows = ref<CrmRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(25)
const search = ref('')
const agendaStatusFilter = ref('')
const agendaSourceFilter = ref('')
const agendaTruncated = ref(false)
const agendaView = ref<'list' | 'calendar'>('list')
const agendaIdentityLabels = ref<CrmAgendaIdentityLabels>({ accounts: {}, leads: {}, owners: {} })
const agendaIdentityLoading = ref(false)
let agendaIdentityGeneration = 0
const agendaUpcoming = computed(() => rows.value.filter(item => ['Scheduled','Pending','Overdue'].includes(String(item.status))).length)
const agendaCompleted = computed(() => rows.value.filter(item => String(item.status)==='Completed').length)
const showForm = ref(false)
const pendingCreateKey = ref(crmUuid())
const edited = ref<CrmRow | null>(null)
const form = reactive<Record<string, unknown>>({})
const requiredFields = computed(() => (model.value?.fields ?? [])
  .filter(field => field.required && (form[field.key] == null || String(form[field.key]).trim() === ''))
  .map(field => ({ key: field.key, label: field.label })))
const { fieldError, isInvalid, resetValidation, validateRequiredFields } =
  useRequiredFieldFeedback(() => requiredFields.value)
const pipelineStages = ref<CrmRow[]>([])
const pipelineId = ref('')
const viewMode = ref<'table' | 'kanban' | 'week'>('table')
const selectedAccount = ref('')
const financeQuery = ref('')
const financeAccounts = ref<CrmRow[]>([])
const financeAccountsTotal = ref(0)
const financeAccountsLoading = ref(false)
const financeTab = ref<'credit' | 'contracts'>(can('crm.credit.read') ? 'credit' : 'contracts')
const dashboard = reactive({ accounts: 0, leads: 0, opportunities: 0, activities: 0, weighted: 0, loaded: false })
const configWarning = ref('')
const accountTypeFilter = ref<string[]>([])
const accountCategoryFilter = ref<string[]>([])
const accountSellerFilter = ref<string[]>([])
const accountRelationFilter = ref<string[]>([])
const accountTypeOptions = [
  { value: 'cash', label: 'Contado' },
  { value: 'credit', label: 'Crédito' },
]
const accountCategoryOptions = ['A', 'B', 'C', 'D']
  .map(value => ({ value, label: `Categoría ${value}` }))
const accountSellerOptions = ref<{ value: string; label: string }[]>([])
const accountFilterOptionsError = ref('')
// Match the values in CrmRelationshipPicker. A multi-relationship account
// must match any exact selected relationship, not just its first value.
const accountRelationOptions = [
  'Cliente', 'Consignee', 'Shipper', 'Notify', 'Proveedor', 'Competidor',
  'Colaborador', 'Agente', 'Transportista', 'Otro',
].map(value => ({ value, label: value }))
const hasAccountFilters = computed(() => Boolean(
  search.value.trim() || accountTypeFilter.value.length || accountCategoryFilter.value.length ||
  accountSellerFilter.value.length || accountRelationFilter.value.length,
))
async function loadAccountFilterOptions() {
  accountFilterOptionsError.value = ''
  try {
    const result = await crmRequest<{ sellers: { value: string; label: string }[] }>(
      crmPath('accounts', 'filter-options'))
    accountSellerOptions.value = result.sellers ?? []
  } catch (cause) {
    accountFilterOptionsError.value = 'No se pudo cargar la lista de vendedores: ' + crmError(cause)
  }
}
function clearAccountFilters() {
  accountTypeFilter.value = []
  accountCategoryFilter.value = []
  accountSellerFilter.value = []
  accountRelationFilter.value = []
}
function refreshWorkspace() {
  void load()
  if (section.value === 'accounts') void loadAccountFilterOptions()
}
const accountFormTab = ref<'identity' | 'commercial'>('identity')
const sellerNames = ref<Record<string, string>>({})
let sellerRequestGeneration = 0
async function loadAccountSellers(accounts: CrmRow[]) {
  const generation = ++sellerRequestGeneration
  const labels: Record<string, string> = {}
  const needLookup: string[] = []
  for (const account of accounts) {
    const id = String(account.id ?? '')
    if (!id) continue
    if (account.isCastroFallasExecutive === true) labels[id] = 'Castro Fallas'
    else if (!account.executiveUserId) labels[id] = 'Sin asignar'
    else { labels[id] = 'Consultando…'; needLookup.push(id) }
  }
  sellerNames.value = labels
  if (!needLookup.length) return
  try {
    // The CRM endpoint checks account visibility and resolves Auth names server-side.
    // One batched request per page avoids exposing Auth user-directory permissions.
    const result = await crmRequest<{ sellers: Record<string, string> }>(
      crmPath('accounts', 'assigned-executives') + '?ids=' +
        encodeURIComponent(needLookup.join(',')))
    if (generation !== sellerRequestGeneration || section.value !== 'accounts') return
    const updated = { ...labels }
    for (const id of needLookup) updated[id] = result.sellers?.[id] || 'Vendedor no disponible'
    sellerNames.value = updated
  } catch {
    if (generation !== sellerRequestGeneration || section.value !== 'accounts') return
    const updated = { ...labels }
    for (const id of needLookup) updated[id] = 'No se pudo consultar'
    sellerNames.value = updated
  }
}
async function loadLeadSellers(leads: CrmRow[]) {
  const generation = ++sellerRequestGeneration
  const ids = leads.map(lead => String(lead.id ?? '')).filter(Boolean)
  sellerNames.value = Object.fromEntries(ids.map(id => [id, 'Consultando vendedor…']))
  if (!ids.length) return
  try {
    // Lookup is scoped by CRM so no Auth directory permission is needed to view names.
    const response = await crmRequest<{ sellers: Record<string, string> }>(
      crmPath('leads', 'assigned-executives') + '?ids=' + encodeURIComponent(ids.join(',')))
    if (generation !== sellerRequestGeneration || section.value !== 'leads') return
    sellerNames.value = Object.fromEntries(ids.map(id =>
      [id, response.sellers?.[id] ?? 'Vendedor no disponible']))
  } catch {
    if (generation !== sellerRequestGeneration || section.value !== 'leads') return
    sellerNames.value = Object.fromEntries(ids.map(id => [id, 'No se pudo consultar']))
  }
}
const countryLabels = ref<Record<string, string>>({})
const accountCountryLabels = ref<Record<string, string>>({})
const accountIdentificationOptions = computed(() => {
  const id = String(form.countryId ?? '')
  return identificationOptionsForCountry(accountCountryLabels.value[id] || countryLabels.value[id] || '')
})
function rememberAccountCountry(item: { value: string; label: string }) {
  accountCountryLabels.value = { ...accountCountryLabels.value, [item.value]: item.label }
}
function updateAccountCountry(id: string) {
  if (id !== String(form.countryId ?? '') &&
      !['01', '02'].includes(normalizeIdentificationType(form.taxIdTypeCode))) {
    form.taxIdTypeCode = ''
  }
  form.countryId = id
}
async function loadCountryLabels() {
  try {
    const items = await CatalogItemsService.select({ catalogGroupSlug: 'countries' })
    countryLabels.value = Object.fromEntries(items.map(item => [item.id, String(item.label || item.value || item.code)]))
  } catch { countryLabels.value = {} }
}
// Navigation shortcuts scroll; all sections stay visible.
const accountSections = [
  { key: 'identity', label: 'Identificación' },
  { key: 'commercial', label: 'Perfil comercial' },
] as const
function focusAccountSection(key: typeof accountFormTab.value) {
  accountFormTab.value = key
  void nextTick(() => document.getElementById('crm-account-section-' + key)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}


function beginCreate() {
  resetValidation()
  pendingCreateKey.value = crmUuid()
  edited.value = null
  Object.keys(form).forEach(key => delete form[key])
  Object.assign(form, crmDefaults(section.value))
  if (section.value === 'followups') form.assignedUserId = auth.userId ?? ''
  if (section.value === 'accounts') { form.executiveUserId = auth.userId ?? ''; accountFormTab.value = 'identity' }
  if (section.value === 'leads') form.executiveUserId = ''
  showForm.value = true
}
function beginEdit(item: CrmRow) {
  // Edit accounts in their real record page instead of a separate drawer.
  if (section.value === 'accounts') {
    void router.push({ path: '/crm/accounts/' + encodeURIComponent(item.id), query: { edit: '1' } })
    return
  }
  resetValidation()
  edited.value = item
  accountFormTab.value = 'identity'
  Object.keys(form).forEach(key => delete form[key])
  for (const f of model.value?.fields ?? []) {
    form[f.key] = f.type === 'datetime-local' ? fromUtc(item[f.key]) : item[f.key] ?? (f.type === 'checkbox' ? false : '')
  }
  showForm.value = true
}
function canCreate() {
  return !!model.value?.createScope && can(model.value.createScope)
}
function canEdit() {
  return !!model.value?.updateScope && can(model.value.updateScope)
}
function details(item: CrmRow) {
  const resource = section.value === 'followups' && item._crmResource === 'activities' ? 'activities' : section.value
  router.push({ path: '/crm/' + resource + '/' + encodeURIComponent(item.id) })
}
async function loadDashboard() {
  const modules = ['accounts', 'leads', 'opportunities', 'activities'] as const
  const granted = modules.filter(name => crmSectionScope[name].some(can))
  // Only ask for data that the authenticated user is already allowed to query.
  const replies = await Promise.allSettled(granted.map(async key => {
    const response = await crmList(key, { page: 1, pageSize: 100 })
    return { key, response }
  }))
  dashboard.accounts = 0; dashboard.leads = 0
  dashboard.opportunities = 0; dashboard.activities = 0; dashboard.weighted = 0
  configWarning.value = ''
  for (const reply of replies) {
    if (reply.status !== 'fulfilled') {
      configWarning.value = t('crm.partialDashboard')
      continue
    }
    const { key, response } = reply.value
    if (key === 'accounts') dashboard.accounts = response.total
    if (key === 'leads') dashboard.leads = response.total
    if (key === 'opportunities') {
      dashboard.opportunities = response.total
      // Not a forecast for the entire organization if pagination truncates results.
      if (response.total <= response.items.length) {
        dashboard.weighted = response.items.reduce((sum, item) =>
          sum + Number(item.amountEstimated || 0) * Number(item.probabilityPct || 0) / 100, 0)
      } else configWarning.value = t('crm.partialDashboard')
    }
    if (key === 'activities') dashboard.activities = response.total
  }
  dashboard.loaded = true
}
async function loadFinanceAccounts() {
  if (!can('crm.account.read') && !can('crm.account.read-all')) {
    financeAccounts.value = []
    financeAccountsTotal.value = 0
    return
  }
  financeAccountsLoading.value = true
  try {
    // Search is always scoped server-side to the user's authorized account records.
    const result = await crmList('accounts', { q: financeQuery.value.trim(), page: 1, pageSize: 50 })
    financeAccounts.value = result.items
    financeAccountsTotal.value = result.total
    if (selectedAccount.value && !result.items.some(account => account.id === selectedAccount.value)) {
      selectedAccount.value = ''
    }
  } catch (e) {
    financeAccounts.value = []
    financeAccountsTotal.value = 0
    error.value = crmError(e)
  } finally {
    financeAccountsLoading.value = false
  }
}
async function loadFinance() {
  if (!selectedAccount.value) { rows.value = []; total.value = 0; return }
  const endpoint = '/api/crm/accounts/' + encodeURIComponent(selectedAccount.value) +
    (financeTab.value === 'credit' ? '/credit-profiles' : '/credit-contracts')
  const list = await crmRequest<CrmRow[]>(endpoint)
  rows.value = list
  total.value = list.length
}
async function loadStages() {
  if (!crmSectionScope.opportunities.some(can)) return
  const pipelines = await crmRequest<CrmRow[]>(crmPath('pipelines'))
  const selected = pipelines.find(p => p.isDefault === true) ?? pipelines[0]
  if (selected?.id) {
    pipelineId.value = selected.id
    pipelineStages.value = await crmRequest<CrmRow[]>(crmPath('pipelines', selected.id, 'stages'))
  }
}
async function loadAgendaIdentityLabels(records: CrmRow[]) {
  const generation = ++agendaIdentityGeneration
  const ids = crmAgendaIdentityIds(records)
  const count = Math.max(Math.ceil(ids.accounts.length / 100), Math.ceil(ids.leads.length / 100),
    Math.ceil(ids.owners.length / 100))
  agendaIdentityLabels.value = { accounts: {}, leads: {}, owners: {} }
  agendaIdentityLoading.value = count > 0
  if (!count) return
  // Reuse the server-authorized calendar resolver rather than exposing the Auth directory.
  const replies = await Promise.allSettled(Array.from({ length: count }, async (_, index) => {
    const start = index * 100
    const params = new URLSearchParams({
      accountIds: ids.accounts.slice(start, start + 100).join(','),
      leadIds: ids.leads.slice(start, start + 100).join(','),
      ownerIds: ids.owners.slice(start, start + 100).join(','),
    })
    return crmRequest<CrmAgendaIdentityLabels>(crmPath('calendar/labels') + '?' + params.toString())
  }))
  if (generation !== agendaIdentityGeneration || section.value !== 'followups') return
  const labels: CrmAgendaIdentityLabels = { accounts: {}, leads: {}, owners: {} }
  for (const result of replies) {
    if (result.status !== 'fulfilled') continue
    Object.assign(labels.accounts, result.value.accounts ?? {})
    Object.assign(labels.leads, result.value.leads ?? {})
    Object.assign(labels.owners, result.value.owners ?? {})
  }
  agendaIdentityLabels.value = labels
  agendaIdentityLoading.value = false
}

async function load() {
  error.value = ''; success.value = ''
  if (!allowed.value) return
  loading.value = true
  try {
    if (section.value === 'followups') {
      // Calendar and list must expose the same two backend resources.
      // Each endpoint enforces its own scope and per-user record visibility.
      const resources = [
        ...(can('crm.activity.read') || can('crm.activity.read-all') ? ['activities'] : []),
        ...(can('crm.task.manage') || can('crm.followup.manage') ? ['followups'] : []),
      ]
      const settled = await Promise.allSettled(resources.map(async resource => {
        const found: CrmRow[] = []
        let count = 0
        for (let current = 1; current <= 10; current++) {
          const reply = await crmList(resource, { page: current, pageSize: 100 })
          count = reply.total
          found.push(...reply.items.map(item => ({ ...item, _crmResource: resource })))
          if (!reply.items.length || found.length >= count) break
        }
        return { found, truncated: found.length < count }
      }))
      const combined: CrmRow[] = []
      const failures: string[] = []
      agendaTruncated.value = false
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          combined.push(...result.value.found)
          agendaTruncated.value ||= result.value.truncated
        } else failures.push(resources[index] || 'CRM')
      })
      const term = search.value.trim().toLocaleLowerCase()
      const filtered = combined.filter(item => {
        if (agendaStatusFilter.value && item.status !== agendaStatusFilter.value) return false
        if (agendaSourceFilter.value && item._crmResource !== agendaSourceFilter.value) return false
        return !term || [item.subject, item.type, item.channel, item.status]
          .some(value => String(value ?? '').toLocaleLowerCase().includes(term))
      }).sort((a,b) => Date.parse(String(a.scheduledStartAt ?? a.dueAt ?? a.createdAt ?? ''))
        - Date.parse(String(b.scheduledStartAt ?? b.dueAt ?? b.createdAt ?? '')))
      total.value = filtered.length
      page.value = Math.min(page.value, Math.max(1, Math.ceil(total.value / pageSize.value)))
      rows.value = filtered.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
      void loadAgendaIdentityLabels(rows.value)
      if (failures.length) error.value = 'No se pudieron consultar todos los registros de la agenda (' + failures.join(', ') + ').'
    }
    else if (section.value === 'dashboard') await loadDashboard()
    else if (section.value === 'finance') { await loadFinanceAccounts(); await loadFinance() }
    else if (section.value === 'settings') {
      rows.value = await crmRequest<CrmRow[]>(crmPath('pipelines'))
      total.value = rows.value.length
    } else {
      const response = await crmList(model.value!.resource, {
        page: page.value, pageSize: pageSize.value, q: search.value.trim(),
        ...(section.value === 'accounts' && accountTypeFilter.value.length ? { customerTypeCode: accountTypeFilter.value.join(',') } : {}),
        ...(section.value === 'accounts' && accountCategoryFilter.value.length ? { categoryCode: accountCategoryFilter.value.join(',') } : {}),
        ...(section.value === 'accounts' && accountSellerFilter.value.length ? { seller: accountSellerFilter.value.join(',') } : {}),
        ...(section.value === 'accounts' && accountRelationFilter.value.length ? { relationship: accountRelationFilter.value.join(',') } : {}),
        ...(section.value === 'opportunities' && pipelineId.value ? { pipelineId: pipelineId.value } : {}),
      })
      rows.value = response.items
      total.value = response.total
      if (section.value === 'accounts') void loadAccountSellers(response.items)
      if (section.value === 'leads') void loadLeadSellers(response.items)
      if (section.value === 'opportunities') await loadStages()
    }
  } catch (e) { error.value = crmError(e); rows.value = [] }
  finally { loading.value = false }
}
function changeCrmPage(nextPage: number) {
  const lastPage = Math.max(1, Math.ceil(total.value / pageSize.value))
  if (nextPage < 1 || nextPage > lastPage || nextPage === page.value) return
  page.value = nextPage
  if (section.value !== 'settings' && section.value !== 'finance') void load()
}
function changeCrmPageSize(nextSize: number) {
  if (![10, 25, 50].includes(nextSize) || nextSize === pageSize.value) return
  pageSize.value = nextSize
  page.value = 1
  if (section.value !== 'settings' && section.value !== 'finance') void load()
}
async function save() {
  if (!model.value || saving.value) return
  if (section.value === 'accounts') {
    // Normalize the actual values before validation and the API payload, not just the CSS display.
    form.displayName = upperAccountName(form.displayName).trim()
    form.legalName = upperAccountName(form.legalName).trim()
    if (requiredFields.value.length) {
      const identityFields = ['displayName', 'legalName', 'countryId', 'taxId', 'taxIdTypeCode']
      focusAccountSection(requiredFields.value.some(f => identityFields.includes(f.key)) ? 'identity' : 'commercial')
      await nextTick()
    }
    if (String(form.taxId ?? '').trim() && (!form.countryId || !String(form.taxIdTypeCode ?? '').trim())) {
      focusAccountSection('identity')
      error.value = 'Para registrar identificación fiscal, seleccioná país y tipo de identificación.'
      await nextTick()
      return
    }
  }
  if (section.value === 'leads') {
    form.name = upperAccountName(form.name).trim()
    form.companyName = upperAccountName(form.companyName).trim()
  }
  if (!validateRequiredFields()) return
  error.value = ''; saving.value = true
  try {
    let body = crmPayload(section.value, form, edited.value ?? undefined)
    if (section.value === 'accounts' && !edited.value &&
        form.executiveUserId === '__castro_fallas__') {
      body.executiveUserId = null
      body.assignToCastroFallas = true
    }
    if (section.value === 'followups') body = {
      ...body, assignedUserId: String(form.assignedUserId || auth.userId || ''),
    }
    if (section.value === 'accounts' && edited.value) {
      body.categoryType = edited.value.categoryType
      body.categoryCode = edited.value.categoryCode
    }
    if (section.value === 'leads' && edited.value) {
      body.qualificationStatus = edited.value.qualificationStatus || 'New'
    }
    // Editing activities and followups has dedicated commands, not generic PATCH.
    if (edited.value && ['activities', 'followups'].includes(section.value)) {
      throw new Error(t('crm.useDetailActions'))
    }
    const createdOrUpdated = edited.value
      ? await crmPatch<CrmRow>(model.value.resource, edited.value.id, body)
      : await crmCreate<CrmRow>(model.value.resource, body, pendingCreateKey.value)
    showForm.value = false
    pendingCreateKey.value = crmUuid()
    if (section.value === 'accounts' && createdOrUpdated?.id) {
      const missing: string[] = []
      const accountId = encodeURIComponent(createdOrUpdated.id)
      await router.push({
        path: '/crm/accounts/' + accountId,
        ...(missing.length ? { query: { onboarding: 'partial', missing: missing.join(',') } } : {}),
      })
    } else {
      await load()
      success.value = t('crm.saved')
    }
  } catch (e) { error.value = crmError(e) }
  finally { saving.value = false }
}
async function changeStage(item: CrmRow, stageId: string) {
  if (!stageId || !can('crm.opportunity.update')) return
  try {
    await crmAction('opportunities', item.id, 'move-stage', {
      expectedVersion: item.rowVersion, stageId, reason: 'Cambio en tablero CRM',
    })
    await load()
  } catch (e) { error.value = crmError(e) }
}
const stages = computed(() => pipelineStages.value.filter(x => x.isActive !== false))
const kanbanRows = (stageId: string) => rows.value.filter(x => x.stageId === stageId)
const agendaDays = computed(() => crmAgendaDays(new Date(), locale.value === 'en' ? 'en-US' : 'es-CR'))
const agendaForDay = (dateKey: string) => crmAgendaRecordsForDay(rows.value, dateKey)
const financeAllowed = computed(() =>
  financeTab.value === 'credit' ? can('crm.credit.read') : can('crm.contract.read'))
watch([section, financeTab, pipelineId], () => { page.value = 1; showForm.value = false; void load() })
watch(selectedAccount, () => { if (section.value === 'finance') { page.value = 1; void load() } })
onMounted(() => {
  if (allowed.value) {
    void load()
    if (section.value === 'accounts') void loadAccountFilterOptions()
  }
  void loadCountryLabels()
})
watch(section, value => { if (value === 'accounts' && allowed.value) void loadAccountFilterOptions() })
watch([accountTypeFilter, accountCategoryFilter, accountSellerFilter, accountRelationFilter], () => {
  if (section.value === 'accounts') { page.value = 1; void load() }
})
</script>

<template>
  <main class="mx-auto w-full max-w-[1600px] space-y-5 p-3 text-[var(--dh-text)] sm:p-6" data-crm-page>
    <DhPageHeader :title="pageTitle" :subtitle="section === 'accounts' ? 'CRM · Clientes / Cuentas' : t('crm.title')" :icon="BriefcaseBusiness" hide-excel-export>
      <template #actions>
        <DhButton :icon="RefreshCw" :label="t('common.refresh')" variant="secondary" :disabled="loading" @click="refreshWorkspace" />
        <DhButton v-if="model && canCreate() && section !== 'followups'"
          :icon="Plus" :label="t('common.create')" @click="beginCreate" />

      </template>
    </DhPageHeader>
    <p v-if="!allowed" role="alert" class="crm-alert">{{ t('crm.denied') }}</p>
    <template v-else>
      <p v-if="error" role="alert" class="crm-alert">{{ error }}</p>
      <p v-if="success" role="status" class="text-sm text-emerald-600">{{ success }}</p>
      <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">{{ t('common.loading') }}</p>
      <CrmAccountViewerManager v-if="section === 'accounts' && can('crm.account.assign') && can('auth.users.view')" />
      <template v-if="section === 'dashboard'">
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DhCard v-for="metric in [
            { label: t('crm.accounts'), value: dashboard.accounts },
            { label: t('crm.leads'), value: dashboard.leads },
            { label: t('crm.opportunities'), value: dashboard.opportunities },
            { label: t('crm.activities'), value: dashboard.activities },
            { label: t('crm.weighted'), value: dashboard.weighted.toLocaleString(undefined,{maximumFractionDigits:2}) },
          ]" :key="metric.label">
            <p class="text-xs font-bold text-[var(--dh-text-muted)]">{{ metric.label }}</p>
            <p class="mt-3 text-2xl font-black">{{ dashboard.loaded ? metric.value : '—' }}</p>
          </DhCard>
        </div>
        <p v-if="configWarning" class="text-sm text-amber-700">{{ configWarning }}</p>
        <p class="text-sm text-[var(--dh-text-muted)]">{{ t('crm.dashboardNote') }}</p>
      </template>

      <section v-else-if="section === 'followups'" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
          <div class="flex min-w-0 items-center gap-3">
            <div class="rounded-xl bg-[var(--dh-primary)]/10 p-2.5 text-[var(--dh-primary)]"><CalendarClock class="h-6 w-6" /></div>
            <div>
              <h2 class="text-lg font-extrabold">Agenda comercial</h2>
              <p class="text-xs text-[var(--dh-text-muted)]">Visitas, llamadas, reuniones y tareas en un solo lugar.</p>
            </div>
          </div>
          <div class="inline-flex rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-1">
            <button type="button" class="rounded-lg px-4 py-2 text-xs font-bold"
              :class="agendaView==='list' ? 'bg-[var(--dh-primary)] text-white' : 'text-[var(--dh-text-muted)]'"
              @click="agendaView='list'">Listado</button>
            <button type="button" class="rounded-lg px-4 py-2 text-xs font-bold"
              :class="agendaView==='calendar' ? 'bg-[var(--dh-primary)] text-white' : 'text-[var(--dh-text-muted)]'"
              @click="agendaView='calendar'">Calendario</button>
          </div>
        </div>
        <CrmSalesCalendar v-if="agendaView === 'calendar'" @changed="page=1;load()" />
      </section>

      <template v-else-if="section === 'finance'">
        <DhCard class="space-y-4">
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">{{ t('crm.financeSelectAccount') }}</p>
          <form class="flex flex-wrap items-end gap-2" @submit.prevent="loadFinanceAccounts">
            <DhInput class="min-w-[200px] flex-1" :label="t('crm.searchAccounts')"
              :model-value="financeQuery" :placeholder="t('common.search')" :disabled="financeAccountsLoading"
              @update:model-value="financeQuery = $event" />
            <DhButton :label="t('common.search')" type="submit" variant="secondary" :disabled="financeAccountsLoading" />
          </form>
          <DhSelect :label="t('crm.selectAccount')" class="max-w-xl" :model-value="selectedAccount"
            :placeholder="t('crm.choose')" :options="financeAccounts.map(a => ({value: a.id, label: String(a.displayName ?? a.legalName ?? a.id)}))"
            @update:model-value="selectedAccount = String($event)" />
          <p v-if="financeAccountsTotal > financeAccounts.length" class="text-xs text-[var(--dh-text-muted)]">
            {{ t('crm.searchAccountHint') }}
          </p>
          <div class="flex gap-2">
            <DhButton v-if="can('crm.credit.read')" :label="t('crm.credit')"
              :variant="financeTab === 'credit' ? 'primary' : 'secondary'" @click="financeTab='credit'" />
            <DhButton v-if="can('crm.contract.read')" :label="t('crm.contracts')"
              :variant="financeTab === 'contracts' ? 'primary' : 'secondary'" @click="financeTab='contracts'" />
          </div>
        </DhCard>
        <p v-if="!financeAllowed" class="crm-alert">{{ t('crm.denied') }}</p>
      </template>

      <template v-else>
        <div class="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
          <div v-if="section !== 'settings'" class="flex min-w-[210px] flex-1 items-center gap-2 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] px-3">
            <Search class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
            <input v-model="search" type="search" :aria-label="section === 'accounts' ? 'Buscar cuentas por nombre, razón social o cédula' : t('common.search')" :placeholder="section === 'accounts' ? 'Buscar por nombre, razón social o cédula…' : t('common.search')"
              class="min-w-0 w-full bg-transparent py-2.5 text-sm text-[var(--dh-text)] outline-none"
              @keyup.enter="page=1;load()" />
          </div>
          <DhButton v-if="section !== 'settings'" :label="t('common.search')" variant="secondary"
            @click="page=1;load()" />
          <div v-if="section === 'accounts'" class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" data-crm-account-multi-filters>
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="text-xs font-bold text-[var(--dh-text-muted)]">Filtros de cuentas · Selección múltiple</p>
              <button v-if="accountTypeFilter.length || accountCategoryFilter.length || accountSellerFilter.length || accountRelationFilter.length"
                type="button" class="text-xs font-bold text-[var(--dh-primary)] hover:underline"
                @click="clearAccountFilters">Limpiar filtros</button>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DhMultiSelect v-model="accountTypeFilter" label="Tipo de cliente"
                placeholder="Todos los clientes" :options="accountTypeOptions"
                search-placeholder="Buscar tipo de cliente..." />
              <DhMultiSelect v-model="accountCategoryFilter" label="Categoría"
                placeholder="Todas las categorías" :options="accountCategoryOptions"
                search-placeholder="Buscar categoría..." />
              <DhMultiSelect v-model="accountSellerFilter" label="Vendedor asignado"
                placeholder="Todos los vendedores" :options="accountSellerOptions"
                search-placeholder="Buscar vendedor..." />
              <DhMultiSelect v-model="accountRelationFilter" label="Tipo de relación"
                placeholder="Todas las relaciones" :options="accountRelationOptions"
                search-placeholder="Buscar relación..." />
            </div>
          </div>
          <p v-if="section === 'accounts' && accountFilterOptionsError"
            role="status" class="w-full text-xs text-[var(--dh-text-muted)]">{{ accountFilterOptionsError }}</p>
          <DhButton v-if="section === 'opportunities'"
            :label="viewMode === 'kanban' ? t('crm.table') : t('crm.kanban')"
            :variant="viewMode === 'kanban' ? 'primary' : 'secondary'"
            @click="viewMode=viewMode==='kanban'?'table':'kanban'" />
          <DhButton v-if="section === 'activities'"
            :label="viewMode === 'week' ? t('crm.table') : t('crm.week')"
            :variant="viewMode === 'week' ? 'primary' : 'secondary'"
            @click="viewMode=viewMode==='week'?'table':'week'" />
        </div>
      </template>

      <div v-if="section === 'opportunities' && viewMode === 'kanban'" class="flex gap-4 overflow-x-auto pb-3">
        <DhCard v-for="stage in stages" :key="stage.id" class="min-w-[260px] flex-1">
          <h2 class="font-bold">{{ stage.name }} ({{ kanbanRows(stage.id).length }})</h2>
          <article v-for="item in kanbanRows(stage.id)" :key="item.id" class="mt-3 rounded-xl border border-[var(--dh-border)] p-3">
            <button class="block text-left font-semibold underline" @click="details(item)">{{ item.title }}</button>
            <p class="text-sm text-[var(--dh-text-muted)]">{{ item.amountEstimated }} {{ item.currencyCode }}</p>
            <select v-if="can('crm.opportunity.update')" class="crm-input mt-2" :value="String(item.stageId)"
              :aria-label="t('crm.stage')" @change="changeStage(item,($event.target as HTMLSelectElement).value)">
              <option v-for="s in stages" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </article>
        </DhCard>
      </div>
      <div v-else-if="section === 'activities' && viewMode === 'week'"
        class="space-y-3 rounded-[var(--dh-radius-xl)] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <h2 class="text-lg font-bold">{{ t('crm.week') }}</h2>
        <p v-if="total > rows.length" class="text-sm text-amber-700" role="status">{{ t('crm.partialAgenda', { loaded: rows.length, total }) }}</p>
        <div v-for="day in agendaDays" :key="day.dateKey" class="border-b border-[var(--dh-border)] pb-2">
          <h3 class="text-sm font-bold">{{ day.label }}</h3>
          <button v-for="item in agendaForDay(day.dateKey)" :key="item.id"
            class="block text-sm underline" @click="details(item)">{{ item.subject ?? item.channel }}</button>
        </div>
      </div>
      <div v-else-if="section === 'followups' && agendaView === 'list'" class="space-y-4">
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-extrabold">Actividades y seguimientos registrados</h2>
            <span class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ total }} resultados</span>
          </div>
          <div class="mb-4 grid gap-2 sm:grid-cols-3">
            <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
              <p class="text-[11px] text-[var(--dh-text-muted)]">Registros cargados</p>
              <p class="mt-1 text-xl font-bold">{{ total }}</p>
            </div>
            <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
              <p class="text-[11px] text-[var(--dh-text-muted)]">Por gestionar</p>
              <p class="mt-1 text-xl font-bold">{{ agendaUpcoming }}</p>
            </div>
            <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
              <p class="text-[11px] text-[var(--dh-text-muted)]">Completadas en esta página</p>
              <p class="mt-1 text-xl font-bold">{{ agendaCompleted }}</p>
            </div>
          </div>
          <form class="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_170px_160px_auto]" @submit.prevent="page=1;load()">
            <label class="space-y-1 text-xs font-semibold">
              <span>Buscar actividad</span>
              <input v-model="search" type="search" placeholder="Nombre, tipo, estado…"
                class="h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm" />
            </label>
            <label class="space-y-1 text-xs font-semibold">
              <span>Mostrar</span>
              <select v-model="agendaSourceFilter" class="h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm">
                <option value="">Todas las gestiones</option><option value="activities">Actividades</option><option value="followups">Seguimientos</option>
              </select>
            </label>
            <label class="space-y-1 text-xs font-semibold">
              <span>Estado</span>
              <select v-model="agendaStatusFilter" class="h-11 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 text-sm">
                <option value="">Todos</option><option value="Scheduled">Programada</option><option value="Pending">Pendiente</option>
                <option value="Overdue">Vencida</option><option value="Completed">Completada</option><option value="Cancelled">Cancelada</option>
              </select>
            </label>
            <DhButton type="submit" label="Filtrar" variant="secondary" :disabled="loading" />
          </form>
          <div v-if="search || agendaStatusFilter || agendaSourceFilter" class="mt-2 text-right">
            <button type="button" class="text-xs font-bold text-[var(--dh-primary)]"
              @click="search='';agendaStatusFilter='';agendaSourceFilter='';page=1;load()">Limpiar filtros</button>
          </div>
          <p v-if="agendaTruncated" class="mt-3 text-xs text-amber-500" role="status">Hay más de 1000 registros por tipo. Ajustá el período del calendario para revisar otros eventos.</p>
        </section>
        <div v-if="!loading && !tableRows.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-10 text-center">
          <CalendarClock class="mx-auto h-8 w-8 text-[var(--dh-text-muted)]" />
          <p class="mt-3 font-semibold">No hay actividades con esos filtros</p>
          <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Los eventos del calendario y los seguimientos se consultan desde CRM.</p>
        </div>
        <DhDataTable v-else :columns="columns" :rows="tableRows" :loading="loading"
          empty-text="No hay actividades o seguimientos registrados"
          @row-click="details($event)">
          <template #cell-_crmTitle="{ value }">
            <span class="font-bold text-[var(--dh-text)]">{{ value }}</span>
          </template>
          <template #cell-_crmClient="{ value }">
            <span class="text-sm font-semibold text-[var(--dh-text)]">{{ value }}</span>
          </template>
          <template #cell-_crmExecutive="{ value }">
            <span class="text-sm text-[var(--dh-text)]">{{ value }}</span>
          </template>
          <template #cell-_crmChannel="{ value }">
            <span class="text-sm font-medium">{{ value }}</span>
          </template>
          <template #cell-_crmDue="{ value }">
            <span class="text-sm">{{ value }}</span>
          </template>
          <template #cell-_crmStatus="{ value }">
            <span class="inline-flex rounded-full border border-[var(--dh-border)] px-2.5 py-1 text-xs font-semibold">{{ value }}</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex flex-wrap items-center justify-end gap-2" @click.stop>
              <DhButton label="Abrir" size="sm" variant="secondary" @click="details(row)" />
              <CrmArchiveAction :resource="row._crmResource === 'activities' ? 'activities' : 'followups'"
                :record-id="String(row.id)" :row-version="Number(row.rowVersion)"
                :record-name="String(row._crmTitle)" @archived="page=1;load()" />
            </div>
          </template>
        </DhDataTable>
        <DhPagination :page="page" :page-size="pageSize" :total="total"
          :class="loading ? 'pointer-events-none opacity-60' : ''"
          @update:page="changeCrmPage" @update:page-size="changeCrmPageSize" />
      </div>
      <div v-else-if="section !== 'dashboard' && section !== 'followups'" class="space-y-3">
        <div v-if="section === 'accounts'" class="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">
          <div class="flex items-center gap-2">
            <Building2 class="h-4 w-4 text-[var(--dh-primary)]" />
            <h2 class="text-sm font-extrabold">Cuentas</h2>
            <span class="rounded-lg border border-[var(--dh-border)] px-2 py-0.5 text-xs text-[var(--dh-text-muted)]">{{ total }}</span>
          </div>
          <span class="text-xs text-[var(--dh-text-muted)]">Seleccioná una fila para abrir la ficha completa del cliente</span>
        </div>
        <DhDataTable :columns="columns" :rows="tableRows" :loading="loading" :empty-text="t('common.noData')" @row-click="section !== 'finance' && details($event)">
          <template #cell-_crmTitle="{ value }">
            <span class="font-bold text-[var(--dh-text)]">{{ value }}</span>
          </template>
          <template #cell-_crmDescription="{ value }">
            <span class="line-clamp-2 text-[var(--dh-text-muted)]">{{ value }}</span>
          </template>
          <template #cell-_crmCountry="{ value }">
            <span class="text-xs font-semibold">{{ value }}</span>
          </template>
          <template #cell-_crmType="{ value }">
            <span class="rounded-lg border border-[var(--dh-border)] px-2 py-1 text-xs">{{ value }}</span>
          </template>
          <template #cell-_crmSeller="{ value }">
            <span class="text-xs font-semibold text-[var(--dh-text)]">{{ value }}</span>
          </template>
          <template #cell-_crmStatus="{ value }">
            <span class="inline-flex max-w-48 truncate rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-2.5 py-1 text-xs font-bold">
              {{ value }}
            </span>
          </template>
          <template #cell-actions="{ row }">
            <div v-if="section !== 'finance'" class="flex flex-wrap justify-end gap-1">
              <DhButton :label="t('common.details')" size="sm" variant="ghost" @click="details(row)" />
              <DhButton v-if="canEdit() && !['activities','followups'].includes(section)"
                :label="t('common.edit')" size="sm" variant="secondary" @click="beginEdit(row)" />
              <DhButton v-if="section === 'leads' && !row._crmConvertedAccountId
                  && can('crm.lead.convert') && can('crm.account.create')"
                label="Convertir a cuenta" size="sm" @click="router.push('/crm/leads/' +
                  encodeURIComponent(String(row.id)) + '#crm-lead-conversion')" />
              <CrmArchiveAction v-if="['accounts','leads','contacts','activities','followups'].includes(section)"
                :resource="section as 'accounts' | 'leads' | 'contacts' | 'activities' | 'followups'"
                :record-id="String(row.id)" :row-version="Number(row.rowVersion)"
                :record-name="String(row._crmTitle || 'Registro')"
                @archived="page=1;load()" />
            </div>
          </template>
        </DhDataTable>
        <div v-if="section === 'accounts' && !loading && total === 0" class="rounded-xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-7 text-center">
          <ContactRound class="mx-auto h-7 w-7 text-[var(--dh-primary)]" />
          <h3 class="mt-2 text-sm font-extrabold">{{ hasAccountFilters ? 'No hay resultados para los filtros' : 'Todavía no hay cuentas comerciales registradas' }}</h3>
          <p class="mx-auto mt-2 max-w-md text-xs text-[var(--dh-text-muted)]">El listado usa las cuentas reales autorizadas por el servidor. Los contactos, rutas y condiciones se gestionan dentro de cada ficha.</p>
          <DhButton v-if="canCreate() && !hasAccountFilters" class="mt-4" :icon="Plus" label="Crear primera cuenta" @click="beginCreate" />
        </div>
        <DhPagination :page="page" :page-size="pageSize" :total="total"
          :class="loading ? 'pointer-events-none opacity-60' : ''"
          @update:page="changeCrmPage" @update:page-size="changeCrmPageSize" />
      </div>

      <DhDrawer :open="showForm && Boolean(model)" :title="formTitle" :size="section === 'accounts' ? 'xl' : 'lg'" @close="showForm = false">
        <form v-if="model" class="mx-auto max-w-4xl space-y-5" @submit.prevent="save">
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">{{ t('crm.formHint') }}</p>
          <p v-if="error" role="alert" class="rounded-2xl border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-500">{{ error }}</p>
          <template v-if="section === 'accounts'">
            <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-[10px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Ficha de cuenta comercial</p>
                  <h2 class="mt-1 text-base font-extrabold">{{ edited ? 'Editar datos de la cuenta' : 'Nueva cuenta · Registrar cliente' }}</h2>
                </div>
                <span class="text-xs font-medium text-[var(--dh-text-muted)]">{{ edited ? 'Datos existentes' : 'Dos secciones para crear la cuenta; completá el resto en su ficha' }}</span>
              </div>
              <div class="mt-4 flex flex-wrap gap-2 border-t border-[var(--dh-border)] pt-3" aria-label="Ir a sección">
                <button v-for="item in accountSections" :key="item.key" type="button"
                  class="rounded-lg border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-2 text-xs font-bold hover:text-[var(--dh-primary)]"
                  @click="focusAccountSection(item.key)">{{ item.label }}</button>
              </div>
              <div id="crm-account-section-identity" class="mt-4 scroll-mt-20">
                <h3 class="mb-1 text-sm font-extrabold">Identificación del cliente</h3>
                <p class="mb-4 text-xs text-[var(--dh-text-muted)]">Información general de la empresa. La consulta fiscal de Hacienda está disponible para cuentas de Costa Rica.</p>
                <div class="grid gap-4 md:grid-cols-2">
                  <DhInput label="Nombre de cuenta / comercial *" data-required-field="displayName" :error="fieldError('displayName')"
                    :model-value="String(form.displayName ?? '')" @update:model-value="form.displayName=upperAccountName($event)" />
                  <DhInput label="Razón social *" data-required-field="legalName" :error="fieldError('legalName')"
                    :model-value="String(form.legalName ?? '')" @update:model-value="form.legalName=upperAccountName($event)" />
                  <CrmCatalogPicker v-if="!edited" label="País · catálogo Config" catalog-group-slug="countries" value-kind="id"
                    :model-value="String(form.countryId ?? '')" @resolved-label="rememberAccountCountry" @update:model-value="updateAccountCountry" />
                  <DhInput v-else label="País registrado (solo lectura)" :disabled="true"
                    :model-value="countryLabels[String(form.countryId ?? '')] || String(form.countryId ?? '')" />
                  <DhInput label="Identificación fiscal" :disabled="!!edited" :model-value="String(form.taxId ?? '')" @update:model-value="form.taxId=$event" />
                  <DhSelect label="Tipo de identificación" :disabled="!!edited || !form.countryId"
                    placeholder="Seleccionar tipo de identificación" :options="accountIdentificationOptions"
                    :model-value="normalizeIdentificationType(form.taxIdTypeCode)"
                    @update:model-value="form.taxIdTypeCode=String($event)" />
                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 text-xs text-[var(--dh-text-muted)]">
                    <p class="font-bold text-[var(--dh-text)]">Verificación tributaria</p>
                    <p class="mt-1">Al indicar una identificación, debés seleccionar el país y su tipo. La consulta a Hacienda valida los datos costarricenses.</p>
                  </div>
                </div>
                <div class="mt-4"><CrmHaciendaLookup v-if="!edited"
                    :country-id="String(form.countryId ?? '')" :tax-id="String(form.taxId ?? '')" @resolved="applyHacienda" /></div>
              </div>
              <div id="crm-account-section-commercial" class="mt-6 border-t border-[var(--dh-border)] pt-5 scroll-mt-20">
                <h3 class="mb-1 text-sm font-extrabold">Perfil comercial</h3>
                <p class="mb-4 text-xs text-[var(--dh-text-muted)]">Clasificación, relación, origen y responsable de la cuenta. El historial de asignaciones queda registrado.</p>
                <div class="grid gap-4 md:grid-cols-2">
                  <DhSelect label="Condición comercial *" :model-value="String(form.customerTypeCode ?? 'cash')"
                    :options="[{label:'Contado',value:'cash'},{label:'Crédito',value:'credit'}]"
                    @update:model-value="form.customerTypeCode=$event" />
                  <DhSelect label="Tipo de cuenta" :model-value="String(form.categoryType ?? 'CUSTOMER')" :disabled="!!edited"
                    :options="[{label:'Cliente',value:'CUSTOMER'},{label:'Agente / NVOCC',value:'NVOCC'},{label:'Cargas Little',value:'LITTLE'}]"
                    @update:model-value="form.categoryType=$event;form.categoryCode='A'" />
                  <DhSelect label="Categoría *" data-required-field="categoryCode" :error="fieldError('categoryCode')"
                    :model-value="String(form.categoryCode ?? 'A')" :disabled="!!edited"
                    :options="(String(form.categoryType)==='LITTLE'?['A']:String(form.categoryType)==='NVOCC' ? ['A','B'] : ['A','B','C','D']).map(value=>({label:String(form.categoryType)==='LITTLE'?'Cargas Little':'Categoría '+value,value}))"
                    @update:model-value="form.categoryCode=$event" />
                  <DhInput label="Origen de la cuenta" :model-value="String(form.sourceCode ?? '')" @update:model-value="form.sourceCode=$event" />
                  <CrmRelationshipPicker label="Tipo de relación comercial" :model-value="String(form.relationshipTypeCode ?? '')"
                    @update:model-value="form.relationshipTypeCode=$event" />
                  <CrmExecutivePicker v-if="!edited && can('crm.account.assign') && can('auth.users.view')"
                    :model-value="String(form.executiveUserId ?? '')" label="Ejecutivo de ventas"
                    @update:model-value="form.executiveUserId=$event" />
                </div>
                <p v-if="edited" class="mt-4 text-xs text-[var(--dh-text-muted)]">El tipo y la categoría de cuenta se mantienen según el registro actual. Para reasignar el ejecutivo, utilizá la acción en la ficha.</p>
              </div>
              <p class="mt-5 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4 text-xs text-[var(--dh-text-muted)]">
                Guardá la cuenta para abrir su ficha. Allí podrás agregar el logo, contactos, direcciones, información comercial, rutas, crédito y observaciones sin llenar un formulario interminable.
              </p>
            </div>
          </template>
          <div v-if="section !== 'accounts'" class="grid gap-4 sm:grid-cols-2">
            <div v-for="f in model.fields" :key="f.key" :class="f.type === 'textarea' && 'sm:col-span-2'">
              <DhSelect v-if="f.type === 'select'" :data-required-field="f.key" :error="fieldError(f.key)" :label="f.label" :options="f.options ?? []" placeholder=""
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = section === 'leads' && ['name', 'companyName'].includes(f.key) ? upperAccountName($event) : $event" />
              <DhTextarea v-else-if="f.type === 'textarea'" :data-required-field="f.key" :error="fieldError(f.key)" :label="f.label" :rows="4"
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
              <div v-else-if="f.type === 'checkbox'" :data-required-field="f.key" :class="isInvalid(f.key) ? '!border-red-500 ring-2 ring-red-500/20' : ''" class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
                <DhSwitch :label="f.label" :model-value="Boolean(form[f.key])" @update:model-value="form[f.key] = $event" />
              </div>
              <CrmPhoneInput v-else-if="section === 'leads' && f.key === 'phone'"
                :label="f.label" :country-id="String(form.countryId ?? '')"
                :model-value="String(form.phone ?? '')" @update:model-value="form.phone=$event" />
              <CrmRelationshipPicker v-else-if="section === 'leads' && f.key === 'relationshipTypeCode'"
                :model-value="String(form.relationshipTypeCode ?? '')" :label="f.label"
                @update:model-value="form.relationshipTypeCode=$event" />
              <CrmCatalogPicker v-else-if="catalogFields[f.key]" :data-required-field="f.key" :validation-error="fieldError(f.key)"
                :label="f.label" :catalog-group-slug="catalogFields[f.key]?.slug ?? ''"
                :value-kind="catalogFields[f.key]?.kind ?? 'id'"
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
              <CrmReferencePicker v-else-if="canSelectReference(f.key)" :data-required-field="f.key" :validation-error="fieldError(f.key)"
                :label="f.label" :resource="referenceResources[f.key] ?? 'accounts'"
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
              <DhInput v-else :data-required-field="f.key" :error="fieldError(f.key)" :label="f.label + (f.required ? ' *' : '')"
                :type="f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : f.type === 'datetime-local' ? 'datetime-local' : 'text'"
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
            </div>
            <div v-if="section === 'leads' && !edited" class="sm:col-span-2">
              <CrmExecutivePicker v-if="can('crm.lead.assign') && can('auth.users.view')"
                :model-value="String(form.executiveUserId ?? '')" label="Asignar prospecto a un vendedor"
                :allow-institutional="false"
                @update:model-value="form.executiveUserId = $event" />
              <p v-if="can('crm.lead.assign')" class="mt-2 text-xs text-[var(--dh-text-muted)]">
                Si no seleccionás otro vendedor, el prospecto se asigna a tu usuario.
              </p>
            </div>
            <div v-if="section === 'leads'" class="sm:col-span-2">
              <CrmHaciendaLookup :country-id="String(form.countryId ?? '')"
                :tax-id="String(form.taxId ?? '')" @resolved="applyLeadHacienda" />
              <p class="mt-2 text-xs text-[var(--dh-text-muted)]">La razón social se incorpora desde Hacienda. Después de crear el prospecto se puede convertir en cuenta, conservando su identificación y ejecutivo.</p>
            </div>
            <DhInput v-if="section === 'followups'" :label="t('crm.assignedUser')"
              :model-value="String(form.assignedUserId ?? '')" @update:model-value="form.assignedUserId = $event" />
          </div>
          <div class="mt-6 flex flex-wrap justify-end gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 shadow-sm">
            <DhButton :label="t('common.cancel')" variant="secondary" @click="showForm = false" />
            <DhButton type="submit" :label="section === 'accounts' ? 'Crear cuenta y abrir ficha' : t('common.save')" :loading="saving" />
          </div>
        </form>
      </DhDrawer>
    </template>
  </main>
</template>

<style scoped>
.crm-card{border:1px solid var(--dh-border);border-radius:1.25rem;background:var(--dh-card);box-shadow:var(--dh-shadow-sm)}
.crm-input{display:block;width:100%;background:var(--dh-input);color:var(--dh-text);border:1px solid var(--dh-border);border-radius:1.125rem;padding:.7rem}
.crm-alert{background:var(--dh-card);border:1px solid #d38c6a;border-radius:.8rem;padding:1rem}
</style>
