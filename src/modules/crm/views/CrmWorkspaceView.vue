<script setup lang="ts">
import CrmModuleNavigation from '../components/CrmModuleNavigation.vue'
import { computed, onMounted, reactive, ref, watch, nextTick } from 'vue'
import { BriefcaseBusiness, Plus, RefreshCw, Building2, ContactRound, Filter, Search, CalendarClock, Route, Wallet, ArrowRight } from 'lucide-vue-next'
import { DhButton, DhInput, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms'
import { DhCard, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhDrawer, DhPageHeader } from '@/shared/components/organisms'
import CrmReferencePicker from '../components/CrmReferencePicker.vue'
import CrmExecutivePicker from '../components/CrmExecutivePicker.vue'
import CrmCatalogPicker from '../components/CrmCatalogPicker.vue'
import CrmHaciendaLookup, { type HaciendaResult } from '../components/CrmHaciendaLookup.vue'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/core/stores/authStore'
import { useRequiredFieldFeedback } from '@/core/composables/useRequiredFieldFeedback'
import { useI18n } from 'vue-i18n'
import { CRM_MODULES, crmDefaults, crmPayload, type CrmSection } from '../model/crmForms'
import { crmAction, crmCreate, crmEnabled, crmError, crmList, crmPatch,
  crmRequest, crmUuid, crmPath, fromUtc, type CrmRow } from '../services/crmApi'
import { crmSectionScope } from '../model/crmForms'
import { crmAgendaDays, crmAgendaRecordsForDay } from '../model/crmAgenda'

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
function applyHacienda(result: HaciendaResult) {
  // Every explicit tax lookup replaces the stale account name.
  if (String(form.taxId ?? '').replace(/[\s-]/g, '') !== result.identification.replace(/[\s-]/g, '')) return
  form.legalName = result.name
  form.displayName = result.name
  if (result.identificationType) form.taxIdTypeCode = result.identificationType
}

const columns = computed<DhTableColumn<CrmRow>[]>(() => {
  const action = { key: 'actions', label: t('common.actions'), align: 'right' as const }
  if (section.value === 'accounts') return [
    { key: '_crmTitle', label: 'Cliente' },
    { key: '_crmDescription', label: 'Razón social' },
    { key: '_crmTax', label: 'Identificación' },
    { key: '_crmCountry', label: 'País' },
    { key: '_crmType', label: 'Tipo de cliente' },
    { key: '_crmCategory', label: 'Categoría' },
    { key: '_crmStatus', label: t('common.status') },
    action,
  ]
  if (section.value === 'leads') return [
    { key: '_crmTitle', label: 'Cliente potencial' },
    { key: '_crmDescription', label: 'Empresa' },
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
    { key: '_crmTitle', label: 'Seguimiento' },
    { key: '_crmChannel', label: 'Canal' },
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
const tableRows = computed(() => rows.value.map(item => ({
  ...item,
  _crmTitle: String(item[model.value?.primary ?? 'contractNumber'] ?? item.contractNumber ?? item.id),
  _crmDescription: String(item[model.value?.secondary ?? 'paymentTerms'] ?? '—'),
  _crmStatus: String(item.status ?? item.qualificationStatus ?? '—'),
  _crmTax: String(item.taxId ?? '—'),
  _crmCountry: countryLabels.value[String(item.countryId ?? '')] || '—',
  _crmCategory: [item.categoryType, item.categoryCode].filter(Boolean).join(' · ') || '—',
  _crmType: item.customerTypeCode === 'credit' ? 'Crédito' : item.customerTypeCode === 'cash' ? 'Contado' : '—',
  _crmEmail: String(item.contactEmail ?? '—'),
  _crmPhone: String(item.phone ?? '—'),
  _crmChannel: String(item.type ?? item.channel ?? '—'),
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
const search = ref('')
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
const accountTypeFilter = ref('')
const accountCategoryFilter = ref('')
const accountFormTab = ref<'identity' | 'commercial' | 'company' | 'related'>('identity')
const companyDraft = reactive({
  phone: '', email: '', website: '', sector: '', businessActivity: '',
  products: '', companyHistory: '', billingEmail: '', marketingEmail: '',
  commercialObservations: '', operationalInstructions: '',
  activeServices: '', presenceCountries: '', commercialStrategy: '',
  projectsOfInterest: '', pricingObservations: '', tariffMonitoringNotes: '',
  tariffSendingNotes: '', customsInstructions: '', cargoCollectionInstructions: '',
  documentReviewInstructions: '', assignedOperations: '', competitorObservations: '',
  tradeAgreementNotes: '', webCustomerReference: '',
})
const companyExtraFields = [
  { key: 'activeServices', label: 'Servicios activos' },
  { key: 'presenceCountries', label: 'Países con presencia' },
  { key: 'commercialStrategy', label: 'Estrategia comercial' },
  { key: 'projectsOfInterest', label: 'Proyectos de interés' },
  { key: 'pricingObservations', label: 'Observaciones Pricing' },
  { key: 'tariffMonitoringNotes', label: 'Tarifas por enviar' },
  { key: 'tariffSendingNotes', label: 'Observaciones tarifas enviadas' },
  { key: 'customsInstructions', label: 'Instrucciones de aduanas' },
  { key: 'cargoCollectionInstructions', label: 'Recolección de carga' },
  { key: 'documentReviewInstructions', label: 'Revisión documental' },
  { key: 'assignedOperations', label: 'Operativa asignada' },
  { key: 'competitorObservations', label: 'Análisis de competidores' },
  { key: 'tradeAgreementNotes', label: 'Tratados y acuerdos comerciales' },
  { key: 'webCustomerReference', label: 'Referencia web (sin contraseñas)' },
] as const
const companyProfileVersion = ref<number | null>(null)
const companyProfileSnapshot = ref('')
const companyProfileLoading = ref(false)
const companyProfileError = ref('')
async function loadEditableCompanyProfile(accountId: string) {
  companyProfileLoading.value = true
  companyProfileError.value = ''
  try {
    const profile = await crmRequest<CrmRow | null>('/api/crm/accounts/' +
      encodeURIComponent(accountId) + '/business-profile')
    if (!showForm.value || edited.value?.id !== accountId) return
    companyProfileVersion.value = profile?.rowVersion ?? null
    for (const key of Object.keys(companyDraft) as Array<keyof typeof companyDraft>) {
      companyDraft[key] = typeof profile?.[key] === 'string' ? String(profile[key]) : ''
    }
    companyProfileSnapshot.value = JSON.stringify(companyDraft)
  } catch (cause) { companyProfileError.value = crmError(cause) }
  finally { companyProfileLoading.value = false }
}
function resetCompanyDraft() {
  Object.keys(companyDraft).forEach(key => {
    companyDraft[key as keyof typeof companyDraft] = ''
  })
}
const relatedDraft = reactive({ contactName: '', contactJobTitle: '', contactEmail: '', contactPhone: '', addressText: '' })
function resetRelatedDraft() {
  Object.assign(relatedDraft, { contactName: '', contactJobTitle: '', contactEmail: '', contactPhone: '', addressText: '' })
}
const countryLabels = ref<Record<string, string>>({})
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
  { key: 'company', label: 'Datos empresariales' },
  { key: 'related', label: 'Contactos y logística' },
] as const
function focusAccountSection(key: typeof accountFormTab.value) {
  accountFormTab.value = key
  void nextTick(() => document.getElementById('crm-account-section-' + key)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}


function beginCreate() {
  resetValidation()
  resetRelatedDraft()
  resetCompanyDraft()
  companyProfileVersion.value = null
  companyProfileError.value = ''
  companyProfileSnapshot.value = JSON.stringify(companyDraft)
  pendingCreateKey.value = crmUuid()
  edited.value = null
  Object.keys(form).forEach(key => delete form[key])
  Object.assign(form, crmDefaults(section.value))
  if (section.value === 'followups') form.assignedUserId = auth.userId ?? ''
  if (section.value === 'accounts') { form.executiveUserId = auth.userId ?? ''; accountFormTab.value = 'identity' }
  showForm.value = true
}
function beginEdit(item: CrmRow) {
  resetValidation()
  resetRelatedDraft()
  resetCompanyDraft()
  companyProfileVersion.value = null
  companyProfileError.value = ''
  companyProfileSnapshot.value = JSON.stringify(companyDraft)
  edited.value = item
  accountFormTab.value = 'identity'
  Object.keys(form).forEach(key => delete form[key])
  for (const f of model.value?.fields ?? []) {
    form[f.key] = f.type === 'datetime-local' ? fromUtc(item[f.key]) : item[f.key] ?? (f.type === 'checkbox' ? false : '')
  }
  showForm.value = true
  if (section.value === 'accounts' && (can('crm.account.read') || can('crm.account.read-all'))) void loadEditableCompanyProfile(item.id)
}
function canCreate() {
  return !!model.value?.createScope && can(model.value.createScope)
}
function canEdit() {
  return !!model.value?.updateScope && can(model.value.updateScope)
}
function details(item: CrmRow) {
  router.push({ path: '/crm/' + section.value + '/' + encodeURIComponent(item.id) })
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
async function load() {
  error.value = ''; success.value = ''
  if (!allowed.value) return
  loading.value = true
  try {
    if (section.value === 'dashboard') await loadDashboard()
    else if (section.value === 'finance') { await loadFinanceAccounts(); await loadFinance() }
    else if (section.value === 'settings') {
      rows.value = await crmRequest<CrmRow[]>(crmPath('pipelines'))
      total.value = rows.value.length
    } else {
      const response = await crmList(model.value!.resource, {
        page: page.value, pageSize: 25, q: search.value.trim(),
        ...(section.value === 'accounts' && accountTypeFilter.value ? { customerTypeCode: accountTypeFilter.value } : {}),
        ...(section.value === 'accounts' && accountCategoryFilter.value ? { categoryCode: accountCategoryFilter.value } : {}),
        ...(section.value === 'opportunities' && pipelineId.value ? { pipelineId: pipelineId.value } : {}),
      })
      rows.value = response.items
      total.value = response.total
      if (section.value === 'opportunities') await loadStages()
    }
  } catch (e) { error.value = crmError(e); rows.value = [] }
  finally { loading.value = false }
}
async function save() {
  if (!model.value || saving.value) return
  if (section.value === 'accounts') {
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
  if (section.value === 'accounts' && !edited.value && (relatedDraft.contactEmail.trim() || relatedDraft.contactPhone.trim()) &&
      !relatedDraft.contactName.trim()) {
    focusAccountSection('related')
    error.value = 'Si registrás correo o teléfono, completá también el nombre del contacto.'
    return
  }
  if (section.value === 'accounts' && edited.value && companyProfileLoading.value) {
    error.value = 'La ficha empresarial se está cargando. Revisá los datos antes de guardar.'
    return
  }
  if (section.value === 'accounts' && edited.value && companyProfileError.value &&
      JSON.stringify(companyDraft) !== companyProfileSnapshot.value) {
    error.value = 'No se pudo consultar la versión actual de la ficha empresarial. Actualizá antes de guardarla.'
    return
  }
  if (!validateRequiredFields()) return
  error.value = ''; saving.value = true
  try {
    let body = crmPayload(section.value, form, edited.value ?? undefined)
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
      if (can('crm.account.update') &&
          (!edited.value ? Object.values(companyDraft).some(value => value.trim())
            : !companyProfileError.value && JSON.stringify(companyDraft) !== companyProfileSnapshot.value)) {
        try {
          await crmRequest('/api/crm/accounts/' + accountId + '/business-profile', 'PUT', {
            ...companyDraft, expectedVersion: edited.value ? companyProfileVersion.value : null,
          }, crmUuid())
        } catch { missing.push('datos empresariales') }
      }
      if (!edited.value && relatedDraft.contactName.trim() && can('crm.contact.create')) {
        try {
          await crmRequest('/api/crm/accounts/' + accountId + '/contacts', 'POST', {
            name: relatedDraft.contactName.trim(),
            jobTitle: relatedDraft.contactJobTitle.trim() || null,
            email: relatedDraft.contactEmail.trim() || null,
            phone: relatedDraft.contactPhone.trim() || null,
            countryId: form.countryId || null, relationRole: 'CONTACT', isPrimary: true,
          }, crmUuid())
        } catch { missing.push('contactos') }
      }
      if (!edited.value && relatedDraft.addressText.trim() && can('crm.account.update')) {
        try {
          await crmRequest('/api/crm/accounts/' + accountId + '/addresses', 'POST', {
            contactId: null, countryId: form.countryId || null,
            addressType: 'WORK', addressText: relatedDraft.addressText.trim(), location: null,
          }, crmUuid())
        } catch { missing.push('direcciones') }
      }
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
watch(selectedAccount, () => { if (section.value === 'finance') void load() })
onMounted(() => { if (allowed.value) void load(); void loadCountryLabels() })
watch([accountTypeFilter, accountCategoryFilter], () => { if (section.value === 'accounts') { page.value = 1; void load() } })
</script>

<template>
  <main class="mx-auto w-full max-w-[1600px] space-y-5 p-3 text-[var(--dh-text)] sm:p-6" data-crm-page>
    <CrmModuleNavigation />
    <DhPageHeader :title="pageTitle" :subtitle="section === 'accounts' ? 'CRM · Clientes / Cuentas' : t('crm.title')" :icon="BriefcaseBusiness" hide-excel-export>
      <template #actions>
        <DhButton :icon="RefreshCw" :label="t('common.refresh')" variant="secondary" :disabled="loading" @click="load" />
        <DhButton v-if="model && canCreate() && section !== 'followups'"
          :icon="Plus" :label="t('common.create')" @click="beginCreate" />
        <DhButton v-if="section === 'followups' && can('crm.followup.manage')"
          :icon="Plus" :label="t('crm.newFollowup')" @click="beginCreate" />
      </template>
    </DhPageHeader>
    <p v-if="!allowed" role="alert" class="crm-alert">{{ t('crm.denied') }}</p>
    <template v-else>
      <p v-if="error" role="alert" class="crm-alert">{{ error }}</p>
      <p v-if="success" role="status" class="text-sm text-emerald-600">{{ success }}</p>
      <p v-if="loading" role="status" class="text-sm text-[var(--dh-text-muted)]">{{ t('common.loading') }}</p>
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
            <input v-model="search" type="search" :aria-label="t('common.search')" :placeholder="section === 'accounts' ? 'Buscar cliente o razón social…' : t('common.search')"
              class="min-w-0 w-full bg-transparent py-2.5 text-sm text-[var(--dh-text)] outline-none"
              @keyup.enter="page=1;load()" />
          </div>
          <DhButton v-if="section !== 'settings'" :label="t('common.search')" variant="secondary"
            @click="page=1;load()" />
          <div v-if="section === 'accounts'" class="flex min-w-0 flex-wrap items-center gap-2 border-[var(--dh-border)] lg:border-l lg:pl-3">
            <Filter class="h-4 w-4 text-[var(--dh-text-muted)]" />
            <select v-model="accountTypeFilter" aria-label="Filtrar por tipo de cliente"
              class="max-w-[170px] rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-xs font-semibold">
              <option value="">Todos los clientes</option><option value="cash">Contado</option><option value="credit">Crédito</option>
            </select>
            <select v-model="accountCategoryFilter" aria-label="Filtrar por categoría"
              class="max-w-[150px] rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-xs font-semibold">
              <option value="">Toda categoría</option>
              <option v-for="value in ['A','B','C','D']" :key="value" :value="value">Categoría {{ value }}</option>
            </select>
            <button v-if="accountTypeFilter || accountCategoryFilter" type="button"
              class="text-xs font-bold text-[var(--dh-primary)] hover:underline"
              @click="accountTypeFilter='';accountCategoryFilter=''">Limpiar</button>
          </div>
          <DhButton v-if="section === 'opportunities'"
            :label="viewMode === 'kanban' ? t('crm.table') : t('crm.kanban')"
            :variant="viewMode === 'kanban' ? 'primary' : 'secondary'"
            @click="viewMode=viewMode==='kanban'?'table':'kanban'" />
          <DhButton v-if="section === 'followups' || section === 'activities'"
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
      <div v-else-if="section === 'activities' || section === 'followups' ? viewMode === 'week' : false"
        class="space-y-3 rounded-[var(--dh-radius-xl)] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <h2 class="text-lg font-bold">{{ t('crm.week') }}</h2>
        <p v-if="total > rows.length" class="text-sm text-amber-700" role="status">{{ t('crm.partialAgenda', { loaded: rows.length, total }) }}</p>
        <div v-for="day in agendaDays" :key="day.dateKey" class="border-b border-[var(--dh-border)] pb-2">
          <h3 class="text-sm font-bold">{{ day.label }}</h3>
          <button v-for="item in agendaForDay(day.dateKey)" :key="item.id"
            class="block text-sm underline" @click="details(item)">{{ item.subject ?? item.channel }}</button>
        </div>
      </div>
      <div v-else-if="section !== 'dashboard'" class="space-y-3">
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
            </div>
          </template>
        </DhDataTable>
        <div v-if="section === 'accounts' && !loading && total === 0" class="rounded-xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-7 text-center">
          <ContactRound class="mx-auto h-7 w-7 text-[var(--dh-primary)]" />
          <h3 class="mt-2 text-sm font-extrabold">{{ search || accountTypeFilter || accountCategoryFilter ? 'No hay resultados para los filtros' : 'Todavía no hay cuentas comerciales registradas' }}</h3>
          <p class="mx-auto mt-2 max-w-md text-xs text-[var(--dh-text-muted)]">El listado usa las cuentas reales autorizadas por el servidor. Los contactos, rutas y condiciones se gestionan dentro de cada ficha.</p>
          <DhButton v-if="canCreate() && !search && !accountTypeFilter && !accountCategoryFilter" class="mt-4" :icon="Plus" label="Crear primera cuenta" @click="beginCreate" />
        </div>
        <footer v-if="section !== 'settings' && section !== 'finance'" class="flex flex-wrap items-center justify-between gap-3 px-2 text-sm text-[var(--dh-text-muted)]">
          <span>{{ rows.length }} / {{ total }}</span>
          <div class="flex items-center gap-2">
            <DhButton :disabled="page <= 1 || loading" label="‹" variant="secondary" size="sm" @click="page--;load()" />
            <span class="min-w-6 text-center font-bold">{{ page }}</span>
            <DhButton :disabled="page*25 >= total || loading" label="›" variant="secondary" size="sm" @click="page++;load()" />
          </div>
        </footer>
      </div>

      <DhDrawer :open="showForm && Boolean(model)" :title="formTitle" :size="section === 'accounts' ? 'full' : 'lg'" @close="showForm = false">
        <form v-if="model" class="mx-auto max-w-7xl space-y-6" @submit.prevent="save">
          <p class="text-sm font-medium text-[var(--dh-text-muted)]">{{ t('crm.formHint') }}</p>
          <p v-if="error" role="alert" class="rounded-2xl border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-500">{{ error }}</p>
          <template v-if="section === 'accounts'">
            <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-[10px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Ficha de cuenta comercial</p>
                  <h2 class="mt-1 text-base font-extrabold">{{ edited ? 'Editar datos de la cuenta' : 'Nueva cuenta · Registrar cliente' }}</h2>
                </div>
                <span class="text-xs font-medium text-[var(--dh-text-muted)]">{{ edited ? 'Datos existentes' : 'Completá todos los apartados en una sola pantalla' }}</span>
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
                    :model-value="String(form.displayName ?? '')" @update:model-value="form.displayName=$event" />
                  <DhInput label="Razón social *" data-required-field="legalName" :error="fieldError('legalName')"
                    :model-value="String(form.legalName ?? '')" @update:model-value="form.legalName=$event" />
                  <CrmCatalogPicker v-if="!edited" label="País · catálogo Config" catalog-group-slug="countries" value-kind="id"
                    :model-value="String(form.countryId ?? '')" @update:model-value="form.countryId=$event" />
                  <DhInput v-else label="País registrado (solo lectura)" :disabled="true"
                    :model-value="countryLabels[String(form.countryId ?? '')] || String(form.countryId ?? '')" />
                  <DhInput label="Identificación fiscal" :disabled="!!edited" :model-value="String(form.taxId ?? '')" @update:model-value="form.taxId=$event" />
                  <DhInput label="Tipo de identificación" :disabled="!!edited" :model-value="String(form.taxIdTypeCode ?? '')" @update:model-value="form.taxIdTypeCode=$event" />
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
                    :options="[{label:'Cliente',value:'CUSTOMER'},{label:'Agente / NVOCC',value:'NVOCC'}]"
                    @update:model-value="form.categoryType=$event;form.categoryCode='A'" />
                  <DhSelect label="Categoría *" data-required-field="categoryCode" :error="fieldError('categoryCode')"
                    :model-value="String(form.categoryCode ?? 'A')" :disabled="!!edited"
                    :options="(String(form.categoryType)==='NVOCC' ? ['A','B'] : ['A','B','C','D']).map(value=>({label:'Categoría '+value,value}))"
                    @update:model-value="form.categoryCode=$event" />
                  <DhInput label="Origen de la cuenta" :model-value="String(form.sourceCode ?? '')" @update:model-value="form.sourceCode=$event" />
                  <DhInput label="Tipo de relación comercial" :model-value="String(form.relationshipTypeCode ?? '')" @update:model-value="form.relationshipTypeCode=$event" />
                  <CrmExecutivePicker v-if="!edited && can('crm.account.assign') && can('auth.users.view')"
                    :model-value="String(form.executiveUserId ?? '')" label="Ejecutivo de ventas"
                    @update:model-value="form.executiveUserId=$event" />
                </div>
                <p v-if="edited" class="mt-4 text-xs text-[var(--dh-text-muted)]">El tipo y la categoría de cuenta se mantienen según el registro actual. Para reasignar el ejecutivo, utilizá la acción en la ficha.</p>
              </div>
              <div id="crm-account-section-company" class="mt-6 border-t border-[var(--dh-border)] pt-5 scroll-mt-20">
                <h3 class="mb-1 text-sm font-extrabold">Datos empresariales y operativos</h3>
                <p class="mb-4 text-xs text-[var(--dh-text-muted)]">Información para ventas, Pricing y aperturas operativas. La ficha puede completarse después del registro.</p>
                <div class="grid gap-4 md:grid-cols-2">
                  <DhInput v-model="companyDraft.phone" label="Teléfono corporativo" />
                  <DhInput v-model="companyDraft.email" type="email" label="Correo principal" />
                  <DhInput v-model="companyDraft.website" label="Sitio web (https://)" />
                  <DhInput v-model="companyDraft.sector" label="Sector productivo" />
                  <DhInput v-model="companyDraft.billingEmail" type="email" label="Correo de facturación" />
                  <DhInput v-model="companyDraft.marketingEmail" type="email" label="Correo comercial / marketing" />
                  <div class="md:col-span-2"><DhTextarea v-model="companyDraft.businessActivity" label="Actividad de la empresa" :rows="2" /></div>
                  <div class="md:col-span-2"><DhTextarea v-model="companyDraft.products" label="Mercancías y líneas de productos" :rows="2" /></div>
                  <div class="md:col-span-2"><DhTextarea v-model="companyDraft.companyHistory" label="Historia y perfil de la empresa" :rows="2" /></div>
                  <div class="md:col-span-2"><DhTextarea v-model="companyDraft.commercialObservations" label="Observaciones comerciales" :rows="2" /></div>
                  <div class="md:col-span-2"><DhTextarea v-model="companyDraft.operationalInstructions" label="Instrucciones operativas" :rows="2" /></div>
                   <div v-for="field in companyExtraFields" :key="field.key" class="md:col-span-2">
                     <DhTextarea :label="field.label" :model-value="companyDraft[field.key]"
                       @update:model-value="companyDraft[field.key]=$event" :rows="2" />
                   </div>
                </div>
                <p v-if="companyProfileLoading" role="status" class="mt-2 text-xs text-[var(--dh-text-muted)]">Cargando datos empresariales…</p>
                 <p v-if="companyProfileError" role="alert" class="mt-2 text-xs text-red-500">{{ companyProfileError }}</p>
              </div>
              <div id="crm-account-section-related" class="mt-6 border-t border-[var(--dh-border)] pt-5 scroll-mt-20">
                <h3 class="mb-2 text-sm font-extrabold">Contactos, dirección y logística</h3>
                <p class="text-xs leading-relaxed text-[var(--dh-text-muted)]">
                  Podés agregar el contacto principal y la dirección junto con la cuenta. Las rutas, tarifas y seguimientos se gestionan desde su ficha completa.
                </p>
                <div v-if="!edited" class="mt-4 grid items-start gap-3 lg:grid-cols-2">
                  <section v-if="can('crm.contact.create')" class="space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
                    <h4 class="flex items-center gap-2 text-xs font-extrabold"><ContactRound class="h-4 w-4 text-[var(--dh-primary)]" />Contacto principal (opcional)</h4>
                    <DhInput v-model="relatedDraft.contactName" label="Nombre completo" />
                    <DhInput v-model="relatedDraft.contactJobTitle" label="Puesto / departamento" />
                    <DhInput v-model="relatedDraft.contactEmail" label="Correo electrónico" type="email" />
                    <DhInput v-model="relatedDraft.contactPhone" label="Teléfono" />
                  </section>
                  <section v-if="can('crm.account.update')" class="space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
                    <h4 class="flex items-center gap-2 text-xs font-extrabold"><Building2 class="h-4 w-4 text-[var(--dh-primary)]" />Dirección principal (opcional)</h4>
                    <DhTextarea v-model="relatedDraft.addressText" label="Dirección física de la empresa" :rows="5" />
                    <p class="text-xs text-[var(--dh-text-muted)]">La dirección queda vinculada al país seleccionado en identificación.</p>
                  </section>
                  <p v-if="!can('crm.contact.create') && !can('crm.account.update')" class="text-xs text-[var(--dh-text-muted)]">
                    No tenés permisos para registrar contactos o direcciones. Podés guardar la cuenta y solicitar acceso.
                  </p>
                </div>
                <div v-else class="mt-4 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4">
                  <p class="text-xs">Los contactos y direcciones existentes se administran desde la ficha del cliente para evitar sobrescribir registros relacionados.</p>
                  <RouterLink :to="'/crm/accounts/' + encodeURIComponent(edited.id)" class="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[var(--dh-primary)]">Ir a ficha completa <ArrowRight class="h-4 w-4" /></RouterLink>
                </div>
                <div class="mt-4 grid gap-3 sm:grid-cols-3">
                  <div v-for="item in [
                    { title:'POL / POE / POD', detail:'Catálogos de Config y rutas comerciales', icon: Route },
                    { title:'Visitas y llamadas', detail:'Agenda y próximos seguimientos', icon: CalendarClock },
                    { title:'Tarifas y crédito', detail:'Cotizaciones, preferencias y contratos', icon: Wallet },
                  ]" :key="item.title" class="rounded-xl border border-[var(--dh-border)] p-3">
                    <component :is="item.icon" class="mb-2 h-4 w-4 text-[var(--dh-primary)]" />
                    <p class="text-xs font-bold">{{ item.title }}</p>
                    <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">{{ item.detail }}</p>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-if="section !== 'accounts'" class="grid gap-4 sm:grid-cols-2">
            <div v-for="f in model.fields" :key="f.key" :class="f.type === 'textarea' && 'sm:col-span-2'">
              <DhSelect v-if="f.type === 'select'" :data-required-field="f.key" :error="fieldError(f.key)" :label="f.label" :options="f.options ?? []" placeholder=""
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
              <DhTextarea v-else-if="f.type === 'textarea'" :data-required-field="f.key" :error="fieldError(f.key)" :label="f.label" :rows="4"
                :model-value="String(form[f.key] ?? '')" @update:model-value="form[f.key] = $event" />
              <div v-else-if="f.type === 'checkbox'" :data-required-field="f.key" :class="isInvalid(f.key) ? '!border-red-500 ring-2 ring-red-500/20' : ''" class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3">
                <DhSwitch :label="f.label" :model-value="Boolean(form[f.key])" @update:model-value="form[f.key] = $event" />
              </div>
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
            <DhInput v-if="section === 'followups'" :label="t('crm.assignedUser')"
              :model-value="String(form.assignedUserId ?? '')" @update:model-value="form.assignedUserId = $event" />
          </div>
          <div class="sticky bottom-0 z-10 -mx-3 flex flex-wrap justify-end gap-2 border-t border-[var(--dh-border)] bg-[var(--dh-bg)] px-3 py-4 sm:-mx-5 sm:px-5">
            <DhButton :label="t('common.cancel')" variant="secondary" @click="showForm = false" />
            <DhButton type="submit" :label="section === 'accounts' ? 'Guardar y abrir ficha' : t('common.save')" :loading="saving" />
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
