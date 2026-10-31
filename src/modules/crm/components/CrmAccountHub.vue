<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { crmPath, crmRequest, crmUuid, toUtc, type CrmRow } from '../services/crmApi'
import CrmCatalogPicker from './CrmCatalogPicker.vue'
import CrmDynamicsAccountSheet from './CrmDynamicsAccountSheet.vue'
import CrmAccountLogo from './CrmAccountLogo.vue'
import CrmCreditCoverageManager from './CrmCreditCoverageManager.vue'
import CrmCommercialBenefitsManager from './CrmCommercialBenefitsManager.vue'
import { DhDrawer } from '@/shared/components/organisms'
import { DhInput, DhTextarea } from '@/shared/components/atoms'
import {
  Activity, CalendarClock, CheckCircle2, Clock3, FileText, MapPin, Phone,
  Plus, RefreshCw, Route, Truck, UserRound, UsersRound, Wallet,
} from 'lucide-vue-next'

type Section = 'summary' | 'profile' | 'contacts' | 'commercial' | 'benefits' | 'quotes' | 'history' | 'agenda' | 'finance'
interface Overview {
  activities: CrmRow[]
  followups: CrmRow[]
  routes: CrmRow[]
  analysisRoutes: CrmRow[]
  analyses: CrmRow[]
  opportunities: CrmRow[]
  quotes: CrmRow[]
  quotesAreLinkedOnly: boolean
}
const props = defineProps<{ account: CrmRow; editing?: boolean }>()
const emit = defineEmits<{
  (e: 'change-executive'): void
  (e: 'edit-account'): void
  (e: 'manage-related'): void
  (e: 'logo-updated'): void
}>()
const router = useRouter()
const auth = useAuthStore()
const { locale } = useI18n()
const has = (scope: string) => auth.hasScope(scope)
const lang = computed(() => locale.value === 'en' ? 'en-US' : 'es-CR')
const activeTab = ref<Section>('summary')
const compactRow = (label: string, value: unknown) => ({ label, value })
const tabs = computed(() => [
  { key: 'summary' as const, label: locale.value === 'en' ? 'Customer' : 'Cliente', icon: UserRound },
  { key: 'profile' as const, label: locale.value === 'en' ? 'Account form' : 'Ficha cliente', icon: FileText },
  { key: 'commercial' as const, label: locale.value === 'en' ? 'Commercial analysis' : 'Análisis comercial', icon: Route },
  { key: 'benefits' as const, label: locale.value === 'en' ? 'Preferred rates' : 'Tarifas preferenciales', icon: Wallet },
  ...(has('crm.contact.read') ? [{ key: 'contacts' as const, label: locale.value === 'en' ? 'Contacts' : 'Contactos', icon: UsersRound }] : []),
  { key: 'quotes' as const, label: locale.value === 'en' ? 'Quotes' : 'Cotizaciones', icon: Truck },
  { key: 'history' as const, label: locale.value === 'en' ? 'Route history' : 'Historial de rutas', icon: Route },
  { key: 'agenda' as const, label: locale.value === 'en' ? 'Activity & follow-up' : 'Seguimientos', icon: CalendarClock },
  ...(has('crm.credit.read') || has('crm.contract.read')
    ? [{ key: 'finance' as const, label: locale.value === 'en' ? 'Credit & contracts' : 'Crédito y contratos', icon: Wallet }]
    : []),
])
const initial = (): Overview => ({
  activities: [], followups: [], routes: [], analysisRoutes: [],
  analyses: [], opportunities: [], quotes: [], quotesAreLinkedOnly: true,
})
const overview = ref<Overview>(initial())
const contacts = ref<CrmRow[]>([])
const addresses = ref<CrmRow[]>([])
const credit = ref<CrmRow[]>([])
const contracts = ref<CrmRow[]>([])
const routeHistory = ref<CrmRow[]>([])
const popularRoutes = ref<CrmRow[]>([])
const quoteRouteSnapshots = ref<CrmRow[]>([])
const quoteRouteTotal = ref(0)
const quoteRoutePage = ref(1)
const quoteRouteLoading = ref(false)
const quoteRouteError = ref('')
const routeHistoryPage = ref(1)
const routeHistoryTotal = ref(0)
const routeHistoryError = ref('')
const routeCaptureOpen = ref(false)
const routeSourceKind = ref<'MEETING' | 'QUOTE'>('MEETING')
const routeSourceId = ref('')
const routePol = ref('')
const routePoe = ref('')
const routePod = ref('')
const routeService = ref('')
const routeNotes = ref('')
const sourceMeetings = computed(() => overview.value.activities.filter(a =>
  ['VISIT','MEETING'].includes(String(a.type)) && String(a.status) === 'Completed'))
const sourceList = computed(() => routeSourceKind.value === 'MEETING'
  ? sourceMeetings.value.map(a => ({
      value: rowId(a.id), label: date(a.occurredAt ?? a.scheduledStartAt) + ' · ' + text(a.subject),
    }))
  : recentQuotes.value.map(q => ({
      value: rowId(q.pricingQuoteId), label: text(q.quoteNumberSnapshot) + ' · ' + text(q.shipmentModeSnapshot),
    })))
const routesCapturedFromMeetings = computed(() =>
  routeHistory.value.filter(x => x.sourceKind === 'MEETING').length)
const routesCapturedFromQuotes = computed(() =>
  routeHistory.value.filter(x => x.sourceKind === 'QUOTE').length)

const countryName = ref('')
const businessProfile = ref<CrmRow | null>(null)
const businessProfileError = ref('')
const profileOpen = ref(false)
const profileSaving = ref(false)
const profileFields = [
  { key: 'phone', label: 'Teléfono corporativo', type: 'text', long: false },
  { key: 'email', label: 'Correo principal', type: 'email', long: false },
  { key: 'website', label: 'Sitio web (https://)', type: 'text', long: false },
  { key: 'sector', label: 'Sector productivo', type: 'text', long: false },
  { key: 'billingEmail', label: 'Correo de facturación', type: 'email', long: false },
  { key: 'marketingEmail', label: 'Correo comercial / marketing', type: 'email', long: false },
  { key: 'businessActivity', label: 'Actividad de la empresa', type: 'text', long: true },
  { key: 'products', label: 'Líneas de productos y mercancías', type: 'text', long: true },
  { key: 'companyHistory', label: 'Historia de la empresa', type: 'text', long: true },
  { key: 'commercialObservations', label: 'Observaciones comerciales', type: 'text', long: true },
  { key: 'operationalInstructions', label: 'Instrucciones operativas', type: 'text', long: true },
  { key: 'activeServices', label: 'Servicios activos', type: 'text', long: true },
  { key: 'presenceCountries', label: 'Países con presencia', type: 'text', long: true },
  { key: 'commercialStrategy', label: 'Estrategia comercial', type: 'text', long: true },
  { key: 'projectsOfInterest', label: 'Proyectos de interés o vinculados', type: 'text', long: true },
  { key: 'pricingObservations', label: 'Observaciones de Pricing', type: 'text', long: true },
  { key: 'tariffMonitoringNotes', label: 'Seguimiento de tarifas por enviar', type: 'text', long: true },
  { key: 'tariffSendingNotes', label: 'Observaciones de tarifas enviadas', type: 'text', long: true },
  { key: 'customsInstructions', label: 'Instrucciones de aduanas y nacionalización', type: 'text', long: true },
  { key: 'cargoCollectionInstructions', label: 'Observaciones de recolección de carga', type: 'text', long: true },
  { key: 'documentReviewInstructions', label: 'Observaciones de revisión documental', type: 'text', long: true },
  { key: 'assignedOperations', label: 'Operativa asignada', type: 'text', long: false },
  { key: 'competitorObservations', label: 'Competidores y contexto comercial', type: 'text', long: true },
  { key: 'tradeAgreementNotes', label: 'Tratados y acuerdos comerciales', type: 'text', long: true },
  { key: 'webCustomerReference', label: 'ID de cliente en la web (sin credenciales)', type: 'text', long: false },
] as const
const profileGroups = [
  { label: 'Información de la empresa y cuenta web', keys: ['phone','email','website','sector','businessActivity','products','companyHistory','billingEmail','marketingEmail','webCustomerReference','presenceCountries','activeServices'] },
  { label: 'Análisis y estrategia comercial', keys: ['commercialObservations','commercialStrategy','projectsOfInterest','pricingObservations','tariffMonitoringNotes','tariffSendingNotes','competitorObservations'] },
  { label: 'Instrucciones operativas y aduaneras', keys: ['operationalInstructions','customsInstructions','cargoCollectionInstructions','documentReviewInstructions','assignedOperations','tradeAgreementNotes'] },
].map(group => ({ label: group.label, fields: profileFields.filter(field => (group.keys as string[]).includes(field.key)) }))
const profileDraft = ref<Record<string, string>>({})
const profileFilled = computed(() => profileFields.filter(f =>
  typeof businessProfile.value?.[f.key] === 'string' &&
  String(businessProfile.value?.[f.key]).trim()).length)

const loading = ref(false)
const busy = ref(false)
const error = ref('')
const saved = ref('')
const editor = ref<'CALL' | 'VISIT' | 'FOLLOWUP' | null>(null)
const subject = ref('')
const scheduled = ref('')
const location = ref('')
const channel = ref('PHONE')
const routeEditor = ref(false)
const serviceCode = ref('')
const originCode = ref('')
const destinationCode = ref('')
const frequency = ref('MONTHLY')
const expectedVolume = ref('0')
const volumeUnit = ref('CBM')
let requestGeneration = 0

function date(value: unknown) {
  if (!value || typeof value !== 'string') return '—'
  const valueDate = new Date(value)
  return Number.isNaN(valueDate.getTime()) ? '—' :
    new Intl.DateTimeFormat(lang.value, {dateStyle: 'medium', timeStyle: 'short'}).format(valueDate)
}
function message(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return locale.value === 'en' ? 'Unable to load this section.' : 'No se pudo cargar esta sección.'
}
function text(value: unknown) { return typeof value === 'string' && value.trim() ? value : '—' }
function rowId(value: unknown) { return typeof value === 'string' ? value : '' }
function quoteLink(quote: CrmRow) {
  return '/pricing/rates?rateId=' + encodeURIComponent(rowId(quote.pricingQuoteId))
}
const activityCount = computed(() => overview.value.activities.length)
const pendingCount = computed(() => overview.value.followups.filter(x =>
  String(x.status ?? '').toLowerCase() === 'pending').length)
const activeRoutes = computed(() => overview.value.routes.filter(x => x.isActive !== false))
const recentQuotes = computed(() => overview.value.quotes)
const visibleTimeline = computed(() => {
  const activities = overview.value.activities.map(x => ({
    id: rowId(x.id), kind: text(x.type), subject: text(x.subject),
    time: String(x.occurredAt ?? x.scheduledStartAt ?? ''), status: text(x.status),
    href: '/crm/activities/' + encodeURIComponent(rowId(x.id)),
  }))
  const followups = overview.value.followups.map(x => ({
    id: rowId(x.id), kind: 'SEGUIMIENTO', subject: text(x.channel),
    time: String(x.dueAt ?? ''), status: text(x.status),
    href: '/crm/followups/' + encodeURIComponent(rowId(x.id)),
  }))
  return [...activities, ...followups].sort((a, b) => b.time.localeCompare(a.time))
})
async function get<T>(endpoint: string): Promise<T> { return crmRequest<T>(endpoint) }
async function load() {
  const generation = ++requestGeneration
  loading.value = true
  error.value = ''
  try {
    const accountId = rowId(props.account.id)
    const response = await get<Overview>(crmPath('accounts', accountId, 'commercial-overview'))
    if (generation !== requestGeneration) return
    overview.value = { ...initial(), ...response }
    routeHistoryPage.value = 1
    // Permissioned lookups are independent; a forbidden credit profile never blocks
    // the commercial parts of a customer record or exposes a hidden field.
    const jobs: Promise<void>[] = []
    if (has('crm.account.read') || has('crm.account.read-all')) jobs.push(
      get<CrmRow | null>(crmPath('accounts', accountId, 'business-profile'))
        .then(result => { if (generation === requestGeneration) {
          businessProfile.value = result
          businessProfileError.value = ''
        }})
        .catch(cause => { if (generation === requestGeneration) {
          businessProfile.value = null
          businessProfileError.value = message(cause)
        }}))
    if (has('crm.contact.read')) jobs.push(
      get<CrmRow[]>(crmPath('accounts', accountId, 'contacts'))
        .then(result => {if (generation === requestGeneration) contacts.value =
          result.map(x => x.contact && typeof x.contact === 'object' ? x.contact as CrmRow : x)})
        .catch(() => { if (generation === requestGeneration) contacts.value = [] }))
    if (has('crm.account.read') || has('crm.account.read-all')) jobs.push(
      get<CrmRow[]>(crmPath('accounts', accountId, 'addresses'))
        .then(result => {if (generation === requestGeneration) addresses.value = result})
        .catch(() => {if (generation === requestGeneration) addresses.value = []}))
    if (has('crm.credit.read')) jobs.push(
      get<CrmRow[]>(crmPath('accounts', accountId, 'credit-profiles'))
        .then(result => {if (generation === requestGeneration) credit.value = result})
        .catch(() => {if (generation === requestGeneration) credit.value = []}))
    if (has('crm.contract.read')) jobs.push(
      get<CrmRow[]>(crmPath('accounts', accountId, 'credit-contracts'))
        .then(result => {if (generation === requestGeneration) contracts.value = result})
        .catch(() => {if (generation === requestGeneration) contracts.value = []}))
    if (props.account.countryId && typeof props.account.countryId === 'string') jobs.push(
      CatalogItemsService.select({ catalogGroupSlug: 'countries' })
        .then(rows => {
          if (generation !== requestGeneration) return
          const country = rows.find(row => row.id === props.account.countryId)
          countryName.value = country?.label || country?.value || ''
        })
        .catch(() => {if (generation === requestGeneration) countryName.value = ''}))
    if (has('crm.analysis.read')) jobs.push(loadRouteHistory(generation))
    await Promise.all(jobs)
  } catch (cause) { if (generation === requestGeneration) error.value = message(cause) }
  finally { if (generation === requestGeneration) loading.value = false }
}
watch(() => props.account.id, () => {
  overview.value = initial()
  contacts.value = []
  addresses.value = []
  credit.value = []
  contracts.value = []
  routeHistory.value = []
  routeHistoryTotal.value = 0
  popularRoutes.value = []
  quoteRouteSnapshots.value = []
  quoteRouteTotal.value = 0
  quoteRoutePage.value = 1
  countryName.value = ''
  businessProfile.value = null
  businessProfileError.value = ''
  activeTab.value = 'summary'
  void load()
}, { immediate: true })

async function loadRouteHistory(generation = requestGeneration) {
  try {
    const result = await get<{ items: CrmRow[], total: number, popularRoutes: CrmRow[] }>(
      crmPath('accounts', rowId(props.account.id), 'route-history') +
      '?page=' + routeHistoryPage.value + '&pageSize=20')
    if (generation !== requestGeneration) return
    routeHistory.value = result.items ?? []
    routeHistoryTotal.value = result.total ?? 0
    popularRoutes.value = result.popularRoutes ?? []
    routeHistoryError.value = ''
  } catch (cause) {
    if (generation === requestGeneration) {
      routeHistoryError.value = message(cause)
      routeHistory.value = []
      routeHistoryTotal.value = 0
      popularRoutes.value = []
    }
  }
}
async function loadQuotedRoutes(generation = requestGeneration) {
  if (!has('crm.quote.read')) return
  quoteRouteLoading.value = true
  try {
    const result = await get<{ items: CrmRow[], total: number }>(
      crmPath('accounts', rowId(props.account.id), 'quote-route-snapshots') +
      '?page=' + quoteRoutePage.value + '&pageSize=8')
    if (generation !== requestGeneration) return
    quoteRouteSnapshots.value = result.items ?? []
    quoteRouteTotal.value = result.total ?? 0
    quoteRouteError.value = ''
  } catch (cause) {
    if (generation === requestGeneration) {
      quoteRouteError.value = message(cause)
      quoteRouteSnapshots.value = []
      quoteRouteTotal.value = 0
    }
  } finally { if (generation === requestGeneration) quoteRouteLoading.value = false }
}
watch(activeTab, tab => {
  if (tab === 'history' && has('crm.quote.read')) void loadQuotedRoutes()
})
function changeQuoteRoutePage(delta: number) {
  quoteRoutePage.value += delta
  void loadQuotedRoutes()
}

function openRouteEvidence(kind: 'MEETING' | 'QUOTE' = 'MEETING', sourceId = '') {
  routeSourceKind.value = kind
  routeSourceId.value = sourceId
  routePol.value = ''
  routePoe.value = ''
  routePod.value = ''
  routeService.value = ''
  routeNotes.value = ''
  routeCaptureOpen.value = true
  activeTab.value = 'history'
}
async function saveRouteEvidence() {
  if (busy.value || !routeSourceId.value || !routePol.value || !routePod.value) return
  busy.value = true
  error.value = ''
  saved.value = ''
  try {
    await crmRequest(crmPath('accounts', rowId(props.account.id), 'route-history'), 'POST', {
      sourceKind: routeSourceKind.value,
      sourceId: routeSourceId.value,
      polCode: routePol.value,
      poeCode: routePoe.value || null,
      podCode: routePod.value,
      serviceCode: routeService.value || null,
      notes: routeNotes.value.trim() || null,
    }, crmUuid())
    routeCaptureOpen.value = false
    routeHistoryPage.value = 1
    await loadRouteHistory()
    saved.value = 'Ruta incorporada al historial con su reunión o cotización de origen.'
  } catch (cause) { error.value = message(cause) }
  finally { busy.value = false }
}
function changeRouteHistoryPage(delta: number) {
  routeHistoryPage.value += delta
  void loadRouteHistory()
}

function openProfileEditor() {
  profileDraft.value = Object.fromEntries(profileFields.map(f =>
    [f.key, String(businessProfile.value?.[f.key] ?? '')]))
  profileOpen.value = true
  error.value = ''
}
async function saveProfile() {
  if (profileSaving.value || !has('crm.account.update')) return
  profileSaving.value = true
  error.value = ''
  try {
    const profile = await crmRequest<CrmRow>(crmPath('accounts', rowId(props.account.id), 'business-profile'),
      'PUT', { ...profileDraft.value, expectedVersion: businessProfile.value?.rowVersion ?? null }, crmUuid())
    businessProfile.value = profile
    profileOpen.value = false
    saved.value = 'Información empresarial actualizada.'
  } catch (cause) { error.value = message(cause) }
  finally { profileSaving.value = false }
}

function newActivity(type: 'CALL' | 'VISIT' | 'FOLLOWUP') {
  editor.value = type
  subject.value = ''
  scheduled.value = ''
  location.value = ''
  channel.value = type === 'VISIT' ? 'VISIT' : 'PHONE'
  error.value = ''
}
async function saveActivity() {
  if (!editor.value || !scheduled.value || busy.value || !auth.userId) return
  const when = toUtc(scheduled.value)
  if (!when || Number.isNaN(new Date(when).getTime())) return
  if (editor.value !== 'FOLLOWUP' && !subject.value.trim()) return
  busy.value = true
  error.value = ''
  saved.value = ''
  try {
    if (editor.value === 'FOLLOWUP') {
      await crmRequest(crmPath('followups'), 'POST', {
        accountId: props.account.id, leadId: null, opportunityId: null,
        assignedUserId: auth.userId, channel: channel.value, dueAt: when,
      }, crmUuid())
    } else {
      await crmRequest(crmPath('activities'), 'POST', {
        accountId: props.account.id, leadId: null, opportunityId: null,
        contactId: null, ownerUserId: auth.userId,
        type: editor.value, subject: subject.value.trim(),
        scheduledStartAt: when, scheduledEndAt: null, occurredAt: null,
        locationText: location.value.trim() || null,
      }, crmUuid())
    }
    editor.value = null
    saved.value = locale.value === 'en' ? 'Activity saved.' : 'Actividad registrada.'
    await load()
    activeTab.value = 'agenda'
  } catch (cause) {error.value = message(cause)}
  finally {busy.value = false}
}
async function saveRoute() {
  if (!routeEditor.value || busy.value || !serviceCode.value || !originCode.value ||
      !destinationCode.value || Number(expectedVolume.value) < 0) return
  busy.value = true
  error.value = ''
  saved.value = ''
  try {
    await crmRequest(crmPath('accounts', rowId(props.account.id), 'trade-profiles'), 'POST', {
      serviceCode: serviceCode.value,
      preferredOriginCode: originCode.value,
      preferredDestinationCode: destinationCode.value,
      frequency: frequency.value,
      expectedVolume: Number(expectedVolume.value),
      volumeUnit: volumeUnit.value,
    }, crmUuid())
    routeEditor.value = false
    saved.value = locale.value === 'en' ? 'Usual route added.' : 'Ruta habitual guardada.'
    await load()
    activeTab.value = 'commercial'
  } catch (cause) { error.value = message(cause) }
  finally {busy.value = false}
}
</script>

<template>
  <div class="space-y-4" data-crm-account-hub>
    <header class="hub-record-header rounded-[1.35rem] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-sm">
      <div class="hub-hero-bar flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <span class="text-xs font-extrabold tracking-wide">Espacio de clientes <span class="ml-2 font-normal opacity-75">/ {{ text(account.displayName || account.legalName) }}</span></span>
        <div class="flex flex-wrap gap-2">
          <button v-if="has('crm.account.update')" type="button"
            :class="editing ? 'hub-outline-button hub-small' : 'hub-primary-button'"
            :aria-pressed="Boolean(editing)" @click="emit('edit-account')">
            <FileText class="h-4 w-4" />{{ editing ? 'Volver al detalle' : 'Editar cuenta' }}
          </button>
          <button v-if="!editing && has('crm.account.assign') && has('auth.users.view')" type="button"
            class="hub-outline-button hub-small" @click="emit('change-executive')"><UsersRound class="h-4 w-4" />Asignar vendedor</button>
          <button v-if="!editing" type="button" class="hub-outline-button hub-small" :disabled="loading" @click="load">
            <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />Actualizar
          </button>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <CrmAccountLogo :account="account" @updated="emit('logo-updated')" />
          <div class="min-w-0">
            <div class="mb-1 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--dh-text-muted)]">CRM · {{ locale === 'en' ? 'Account record' : 'Cuenta comercial' }}</div>
            <h1 class="truncate text-lg font-extrabold tracking-tight sm:text-xl">{{ text(account.displayName || account.legalName) }}</h1>
            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--dh-text-muted)]">
              <span class="inline-flex items-center gap-1"><MapPin class="h-3.5 w-3.5" />{{ countryName || 'País sin definir' }}</span>
              <span>{{ text(account.taxId) }}</span>
              <span>{{ account.customerTypeCode === 'credit' ? 'Cliente crédito' : 'Cliente contado' }}</span>
              <span v-if="account.isCastroFallasExecutive === true" class="font-semibold text-[var(--dh-primary)]">Vendedor: Castro Fallas</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="hub-customer-pill">{{ account.customerTypeCode === 'credit' ? 'Cliente a crédito' : 'Cliente de contado' }}</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 px-4 pb-3 text-[11px] sm:px-5">
        <span class="hub-header-meta"><FileText class="h-3.5 w-3.5" />{{ recentQuotes.length }} {{ locale === 'en' ? 'linked quotes' : 'tarifas vinculadas' }}</span>
        <button type="button" class="hub-header-meta hover:text-[var(--dh-primary)]" @click="activeTab='history'"><Route class="h-3.5 w-3.5" />{{ routeHistoryTotal }} rutas con historial</button>
        <span class="hub-header-meta">{{ activeRoutes.length }} rutas habituales</span>
        <span class="hub-header-meta"><Activity class="h-3.5 w-3.5" />{{ activityCount }} actividades</span>
        <span class="hub-header-meta"><Clock3 class="h-3.5 w-3.5" />{{ pendingCount }} pendientes</span>
        <span class="ml-auto text-[var(--dh-text-muted)]">ID {{ String(account.id).slice(0, 8) }}</span>
      </div>
      <nav v-if="!editing" role="tablist" class="flex max-w-full gap-1 overflow-x-auto border-t border-[var(--dh-border)] px-3 py-2 sm:px-4"
        :aria-label="locale === 'en' ? 'Account sections' : 'Secciones del cliente'">
        <button v-for="tab in tabs" :key="tab.key" type="button" role="tab"
          :aria-selected="activeTab === tab.key" :aria-controls="'crm-account-' + tab.key"
          class="hub-tab" :class="activeTab === tab.key ? 'hub-tab-active' : ''" @click="activeTab = tab.key">
          <component :is="tab.icon" class="h-3.5 w-3.5" />{{ tab.label }}
        </button>
      </nav>
    </header>
    <div v-if="!editing" class="space-y-4">
    <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="saved" role="status" class="text-sm text-emerald-500">{{ saved }}</p>
    <p v-if="loading" role="status" class="text-xs text-[var(--dh-text-muted)]">{{ locale === 'en' ? 'Loading account data…' : 'Cargando datos de la cuenta…' }}</p>

    <div v-if="activeTab === 'summary'" id="crm-account-summary" role="tabpanel"
      class="grid items-start gap-3 xl:grid-cols-[minmax(0,.94fr)_minmax(0,1.14fr)_minmax(265px,.86fr)]">
      <div class="min-w-0 space-y-3">
        <section class="hub-panel">
          <h2 class="hub-panel-heading"><UserRound class="h-4 w-4 text-[var(--dh-primary)]" />Datos de la cuenta</h2>
          <dl class="divide-y divide-[var(--dh-border)]">
            <div v-for="item in [
              compactRow('Razón social', account.legalName),
              compactRow('Nombre comercial', account.displayName),
              compactRow('Identificación', account.taxId),
              compactRow('Tipo identificación', account.taxIdTypeCode),
              compactRow('País', countryName),
              compactRow('Tipo de cliente', account.customerTypeCode === 'credit' ? 'Crédito' : 'Contado'),
              compactRow('Categoría', [account.categoryType, account.categoryCode].filter(Boolean).join(' / ')),
              compactRow('Relación comercial', account.relationshipTypeCode),
              compactRow('Origen de la cuenta', account.sourceCode),
              compactRow('Estado fiscal', account.verificationStatus),
            ]" :key="item.label" class="hub-kv">
              <dt>{{ item.label }}</dt><dd>{{ text(item.value) }}</dd>
            </div>
          </dl>
        </section>
        <section class="hub-panel">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 class="hub-panel-heading mb-0"><UsersRound class="h-4 w-4 text-[var(--dh-primary)]" />Datos empresariales
              <span class="hub-count">{{ profileFilled }} / {{ profileFields.length }}</span>
            </h2>
            <button v-if="has('crm.account.update')" type="button" class="hub-text-link" @click="emit('edit-account')">
              {{ businessProfile ? 'Editar cuenta' : 'Completar cuenta' }}
            </button>
          </div>
          <p v-if="businessProfileError" role="alert" class="text-xs text-amber-600">{{ businessProfileError }}</p>
          <p v-else-if="!businessProfile" class="hub-empty">Añadí teléfono, correo, sitio web, sector, productos e instrucciones operativas para que el equipo cuente con una ficha completa.</p>
          <dl v-else class="divide-y divide-[var(--dh-border)]">
            <div v-for="field in profileFields" :key="field.key" class="hub-kv">
              <dt>{{ field.label }}</dt>
              <dd>{{ text(businessProfile[field.key]) }}</dd>
            </div>
          </dl>
        </section>
        <section class="hub-panel">
          <div class="hub-panel-heading"><MapPin class="h-4 w-4 text-[var(--dh-primary)]" />Direcciones <span class="hub-count">{{ addresses.length }}</span></div>
          <p v-if="!addresses.length" class="hub-empty">Sin direcciones registradas.</p>
          <div v-for="address in addresses.slice(0,6)" :key="address.id" class="hub-list-item">
            <p class="text-[11px] font-bold text-[var(--dh-text-muted)]">{{ text(address.addressType) }}</p>
            <p class="mt-1 text-xs">{{ text(address.addressText) }}</p>
          </div>
        </section>
        <section v-if="has('crm.credit.read')" class="hub-panel">
          <div class="hub-panel-heading"><Wallet class="h-4 w-4 text-[var(--dh-primary)]" />Condiciones financieras</div>
          <p v-if="!credit.length" class="hub-empty">No hay crédito configurado.</p>
          <dl v-for="profile in credit.slice(0,1)" :key="profile.id" class="divide-y divide-[var(--dh-border)]">
            <div class="hub-kv"><dt>Estado</dt><dd>{{ text(profile.status) }}</dd></div>
            <div class="hub-kv"><dt>Días de crédito</dt><dd>{{ profile.creditDays ?? '—' }}</dd></div>
            <div class="hub-kv"><dt>Límite aprobado</dt><dd>{{ profile.creditLimit ?? '—' }} {{ text(profile.currencyCode) }}</dd></div>
            <div class="hub-kv"><dt>Condiciones</dt><dd>{{ text(profile.paymentConditions) }}</dd></div>
          </dl>
          <button type="button" class="hub-text-link mt-3" @click="activeTab='finance'">Ver crédito y contratos</button>
        </section>
      </div>

      <div class="min-w-0 space-y-3">
        <section class="hub-panel">
          <div class="flex items-center justify-between gap-3">
            <h2 class="hub-panel-heading mb-0"><Route class="h-4 w-4 text-[var(--dh-primary)]" />Ficha comercial</h2>
            <button type="button" class="hub-text-link" @click="activeTab='commercial'">Ver ficha completa</button>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <div class="hub-mini-stat"><span>Rutas habituales</span><strong>{{ activeRoutes.length }}</strong></div>
            <div class="hub-mini-stat"><span>Análisis comercial</span><strong>{{ overview.analyses.length }}</strong></div>
          </div>
          <h3 class="hub-section-heading mt-4">Mercados y operaciones</h3>
          <p v-if="!overview.analyses.length" class="hub-empty">Sin análisis comercial registrado.</p>
          <dl v-for="analysis in overview.analyses.slice(0,2)" :key="analysis.id" class="divide-y divide-[var(--dh-border)]">
            <div class="hub-kv"><dt>Mercado</dt><dd>{{ text(analysis.marketCode) }}</dd></div>
            <div class="hub-kv"><dt>Nacionalización</dt><dd>{{ analysis.customsNationalizationRequired ? 'Sí' : 'No' }}</dd></div>
            <div class="hub-kv"><dt>Volumen estimado</dt><dd>{{ analysis.estimatedMonthlyVolume ?? '—' }} {{ text(analysis.volumeUnit) }}</dd></div>
          </dl>
          <div class="mt-4 flex items-center justify-between gap-2">
            <h3 class="hub-section-heading mb-0 border-0">Rutas frecuentes · POL / POE / POD</h3>
            <button type="button" class="hub-text-link" @click="activeTab='history'">Ver historial de reuniones y cotizaciones</button>
          </div>
          <div v-for="route in popularRoutes.slice(0,3)" :key="String(route.polCode)+String(route.podCode)+String(route.poeCode)" class="hub-list-item">
            <p class="text-xs font-extrabold">{{ text(route.polCode) }} → <span v-if="route.poeCode">{{ text(route.poeCode) }} → </span>{{ text(route.podCode) }}</p>
            <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">{{ route.occurrences }} registros · {{ route.meetingCount }} reuniones · {{ route.quoteCount }} cotizaciones</p>
          </div>
          <p v-if="!activeRoutes.length && !overview.analysisRoutes.length && !popularRoutes.length" class="hub-empty">Todavía no hay rutas documentadas. Podés registrarlas a partir de reuniones y cotizaciones vinculadas.</p>
          <div v-for="route in activeRoutes.slice(0,4)" :key="route.id" class="hub-list-item">
            <p class="text-xs font-semibold">{{ text(route.preferredOriginCode) }} <span class="text-[var(--dh-primary)]">→</span> {{ text(route.preferredDestinationCode) }}</p>
            <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">{{ text(route.serviceCode) }} · {{ text(route.frequency) }}</p>
          </div>
          <div v-for="route in overview.analysisRoutes.slice(0,4)" :key="route.id" class="hub-list-item">
            <p class="text-xs font-semibold">{{ text(route.polCode) }} → {{ text(route.poeCode) }} → {{ text(route.podCode) }}</p>
            <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">Ruta de análisis · {{ route.frequencyPerMonth ?? '—' }} al mes</p>
          </div>
        </section>
        <section class="hub-panel">
          <div class="flex items-center justify-between gap-3">
            <h2 class="hub-panel-heading mb-0"><FileText class="h-4 w-4 text-[var(--dh-primary)]" />Historial de tarifas</h2>
            <button type="button" class="hub-text-link" @click="activeTab='quotes'">Ver todas</button>
          </div>
          <p class="mt-2 text-[11px] text-[var(--dh-text-muted)]">Cotizaciones vinculadas a las oportunidades de esta cuenta.</p>
          <p v-if="!recentQuotes.length" class="hub-empty">Todavía no hay cotizaciones vinculadas.</p>
          <div v-for="quote in recentQuotes.slice(0,5)" :key="rowId(quote.pricingQuoteId)"
            class="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--dh-border)] py-3 last:border-0">
            <div class="min-w-0">
              <RouterLink :to="quoteLink(quote)" class="block truncate text-xs font-bold text-[var(--dh-primary)] hover:underline">{{ text(quote.quoteNumberSnapshot) }}</RouterLink>
              <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">{{ text(quote.shipmentModeSnapshot) }} · {{ text(quote.commercialStatusSnapshot) }}</p>
            </div>
            <span class="shrink-0 text-[10px] text-[var(--dh-text-muted)]">{{ date(quote.linkedAt) }}</span>
          </div>
        </section>
      </div>

      <aside class="min-w-0 space-y-3" aria-label="Actividad y registros relacionados">
        <section class="hub-panel">
          <div class="flex items-center justify-between gap-3">
            <h2 class="hub-panel-heading mb-0"><Activity class="h-4 w-4 text-[var(--dh-primary)]" />Escala de tiempo</h2>
            <button type="button" class="hub-text-link" @click="activeTab='agenda'">Ver agenda</button>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button v-if="has('crm.activity.create')" type="button" class="hub-outline-button hub-small" @click="activeTab='agenda';newActivity('CALL')"><Phone class="h-3.5 w-3.5" />Llamada</button>
            <button v-if="has('crm.activity.create')" type="button" class="hub-outline-button hub-small" @click="activeTab='agenda';newActivity('VISIT')"><Plus class="h-3.5 w-3.5" />Visita</button>
            <button v-if="has('crm.task.manage') || has('crm.followup.manage')" type="button" class="hub-outline-button hub-small" @click="activeTab='agenda';newActivity('FOLLOWUP')"><CalendarClock class="h-3.5 w-3.5" />Seguimiento</button>
          </div>
          <div class="mt-3">
            <p v-if="!visibleTimeline.length" class="hub-empty">Aún no se han registrado llamadas, visitas o seguimientos.</p>
            <ol v-else class="hub-timeline">
              <li v-for="entry in visibleTimeline.slice(0,8)" :key="entry.kind + entry.id">
                <RouterLink :to="entry.href" class="block truncate text-xs font-bold hover:text-[var(--dh-primary)]">{{ entry.subject }}</RouterLink>
                <span class="mt-1 block text-[11px] text-[var(--dh-text-muted)]">{{ entry.kind }} · {{ entry.status }}</span>
                <time class="mt-1 block text-[10px] text-[var(--dh-text-muted)]">{{ date(entry.time) }}</time>
              </li>
            </ol>
          </div>
        </section>
        <section class="hub-panel">
          <h2 class="hub-panel-heading"><UsersRound class="h-4 w-4 text-[var(--dh-primary)]" />Contactos relacionados <span class="hub-count">{{ contacts.length }}</span></h2>
          <p v-if="!contacts.length" class="hub-empty">No hay contactos asociados.</p>
          <div v-for="contact in contacts.slice(0,8)" :key="contact.id" class="hub-list-item">
            <RouterLink :to="'/crm/contacts/' + encodeURIComponent(rowId(contact.id))" class="block truncate text-xs font-bold text-[var(--dh-primary)] hover:underline">{{ text(contact.name || contact.displayName) }}</RouterLink>
            <p class="mt-1 truncate text-[11px] text-[var(--dh-text-muted)]">{{ text(contact.jobTitle || contact.email) }}</p>
          </div>
        </section>
        <section v-if="has('crm.contract.read')" class="hub-panel">
          <h2 class="hub-panel-heading"><Wallet class="h-4 w-4 text-[var(--dh-primary)]" />Contratos <span class="hub-count">{{ contracts.length }}</span></h2>
          <p v-if="!contracts.length" class="hub-empty">No hay contratos vinculados.</p>
          <div v-for="contract in contracts.slice(0,3)" :key="contract.id" class="hub-list-item">
            <p class="text-xs font-bold">{{ text(contract.contractNumber) }}</p>
            <p class="text-[11px] text-[var(--dh-text-muted)]">{{ text(contract.status) }} · {{ date(contract.expiryDate) }}</p>
          </div>
        </section>
      </aside>
    </div>

    <CrmDynamicsAccountSheet v-else-if="activeTab === 'profile'" id="crm-account-profile" role="tabpanel"
      :account="account" :profile="businessProfile" :country="countryName"
      :contacts="contacts" :addresses="addresses" :activities="overview.activities"
      :followups="overview.followups" :analyses="overview.analyses" :routes="overview.routes"
      :credit="credit" :contracts="contracts" :can-read-contacts="has('crm.contact.read')"
      :can-read-credit="has('crm.credit.read')" :can-read-contracts="has('crm.contract.read')"
      :can-edit-profile="has('crm.account.update')"
      @edit-profile="openProfileEditor" @open-tab="activeTab=$event" />

    <CrmCommercialBenefitsManager v-else-if="activeTab === 'benefits'" id="crm-account-benefits" role="tabpanel"
      :account-id="String(account.id)" />

    <section v-else-if="activeTab === 'contacts'" id="crm-account-contacts" role="tabpanel" class="hub-panel">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h2 class="font-extrabold">Contactos de la cuenta</h2><p class="mt-1 text-xs text-[var(--dh-text-muted)]">Personas vinculadas realmente a este cliente.</p></div>
        <RouterLink to="/crm/contacts" class="hub-outline-button hub-small"><UsersRound class="h-4 w-4" />Directorio de contactos</RouterLink>
      </div>
      <p v-if="!contacts.length" class="hub-empty">No hay contactos vinculados. Podés administrarlos desde la gestión avanzada de la cuenta.</p>
      <div v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <RouterLink v-for="contact in contacts" :key="contact.id" :to="'/crm/contacts/' + encodeURIComponent(rowId(contact.id))"
          class="rounded-lg border border-[var(--dh-border)] p-4 hover:border-[var(--dh-primary)]">
          <p class="text-sm font-bold text-[var(--dh-primary)]">{{ text(contact.name || contact.displayName) }}</p>
          <p class="mt-2 text-xs">{{ text(contact.jobTitle) }}</p>
          <p class="mt-1 break-words text-xs text-[var(--dh-text-muted)]">{{ text(contact.email) }} · {{ text(contact.phone) }}</p>
        </RouterLink>
      </div>
    </section>

    <div v-else-if="activeTab === 'commercial'" id="crm-account-commercial" role="tabpanel" class="grid items-start gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(255px,.76fr)]">
      <section class="hub-panel">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 class="font-extrabold">{{ locale === 'en' ? 'Usual services and routes' : 'Servicios y rutas habituales' }}</h2>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Origen → destino · servicio · frecuencia · volumen</p></div>
          <button v-if="has('crm.analysis.manage')" class="inline-flex items-center gap-2 rounded-xl bg-[var(--dh-primary)] px-3 py-2 text-xs font-bold text-white"
            @click="routeEditor = !routeEditor"><Plus class="h-4 w-4" />{{ locale === 'en' ? 'Add route' : 'Añadir ruta' }}</button>
        </div>
        <DhDrawer :open="routeEditor" title="Nueva ruta comercial" size="lg" @close="routeEditor=false">
          <form class="grid gap-3 p-2 sm:grid-cols-2" @submit.prevent="saveRoute">
          <CrmCatalogPicker label="Servicio" catalog-group-slug="pricing-services" value-kind="code" v-model="serviceCode" />
          <label class="space-y-2 text-xs font-bold">Frecuencia
            <select v-model="frequency" class="crm-input w-full"><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensual</option><option value="QUARTERLY">Trimestral</option><option value="YEARLY">Anual</option></select>
          </label>
          <CrmCatalogPicker label="POL / Origen" catalog-group-slug="pol" value-kind="code" v-model="originCode" />
          <CrmCatalogPicker label="POD / Destino" catalog-group-slug="pod" value-kind="code" v-model="destinationCode" />
          <label class="text-xs font-bold">Volumen estimado
            <input v-model="expectedVolume" type="number" min="0" step="0.01" class="crm-input mt-2 w-full" /></label>
          <label class="text-xs font-bold">Unidad
            <select v-model="volumeUnit" class="crm-input mt-2 w-full"><option>CBM</option><option>KG</option><option>TEU</option><option>CFT</option></select></label>
          <div class="flex gap-2 sm:col-span-2">
            <button type="submit" :disabled="busy || !serviceCode || !originCode || !destinationCode" class="crm-action">Guardar ruta</button>
            <button type="button" class="rounded-xl border border-[var(--dh-border)] px-4 py-2 text-sm" @click="routeEditor=false">Cancelar</button>
          </div>
          </form>
        </DhDrawer>
        <p v-if="!overview.routes.length && !overview.analysisRoutes.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm text-[var(--dh-text-muted)]">Todavía no hay rutas comerciales registradas.</p>
        <div v-for="r in overview.routes" :key="r.id" class="grid gap-3 border-b border-[var(--dh-border)] py-3 text-sm last:border-0 md:grid-cols-[1fr_1fr_auto]">
          <div class="font-bold">{{ text(r.preferredOriginCode) }} → {{ text(r.preferredDestinationCode) }}</div>
          <div>{{ text(r.serviceCode) }} · {{ text(r.frequency) }}</div>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ r.expectedVolume }} {{ r.volumeUnit }}</span>
        </div>
        <h3 v-if="overview.analysisRoutes.length" class="mt-5 mb-2 text-xs font-extrabold uppercase tracking-wider text-[var(--dh-text-muted)]">Rutas en análisis (POL / POE / POD)</h3>
        <div v-for="r in overview.analysisRoutes" :key="r.id" class="grid gap-2 border-b border-[var(--dh-border)] py-3 text-sm last:border-0 sm:grid-cols-[1fr_auto]">
          <div><b>{{ text(r.polCode) }}</b> → <b>{{ text(r.poeCode) }}</b> → <b>{{ text(r.podCode) }}</b></div>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ r.frequencyPerMonth || '—' }} / mes</span>
        </div>
      </section>
      <section class="hub-panel">
        <h2 class="mb-3 font-extrabold">Análisis comercial ({{ overview.analyses.length }})</h2>
        <p v-if="!overview.analyses.length" class="text-sm text-[var(--dh-text-muted)]">No hay análisis registrados.</p>
        <button v-for="a in overview.analyses" :key="a.id" class="flex w-full items-center justify-between gap-3 border-b border-[var(--dh-border)] py-3 text-left text-sm last:border-0 hover:text-[var(--dh-primary)]"
          @click="router.push('/crm/analyses/' + encodeURIComponent(rowId(a.id)))">
          <span>{{ text(a.marketCode) }} · {{ a.customsNationalizationRequired ? 'Incluye aduanas' : 'Sin aduanas' }}</span>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ a.estimatedMonthlyVolume ?? '—' }} {{ a.volumeUnit }}</span>
        </button>
      </section>
      <aside class="hub-panel">
        <h2 class="hub-panel-heading"><Activity class="h-4 w-4 text-[var(--dh-primary)]" />Última actividad</h2>
        <p v-if="!visibleTimeline.length" class="hub-empty">Sin actividad registrada.</p>
        <ol v-else class="hub-timeline">
          <li v-for="entry in visibleTimeline.slice(0,9)" :key="entry.kind + entry.id">
            <RouterLink :to="entry.href" class="block truncate text-xs font-bold hover:text-[var(--dh-primary)]">{{ entry.subject }}</RouterLink>
            <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">{{ date(entry.time) }}</p>
          </li>
        </ol>
        <button type="button" class="hub-text-link mt-3" @click="activeTab='agenda'">Abrir seguimientos</button>
      </aside>
    </div>

    <section v-else-if="activeTab === 'history'" id="crm-account-history" role="tabpanel" class="space-y-3">
      <div class="hub-panel">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="flex items-center gap-2 text-base font-extrabold"><Route class="h-5 w-5 text-[var(--dh-primary)]" />Historial de rutas del cliente</h2>
            <p class="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--dh-text-muted)]">
              Cada ruta confirma su origen: una reunión completada o una cotización ya vinculada al CRM.
              No se inventan POL, POE o POD a partir del nombre del cliente o de la modalidad.
            </p>
          </div>
          <button v-if="has('crm.analysis.manage') && has('crm.analysis.read')" type="button"
            class="crm-action inline-flex items-center gap-2" @click="openRouteEvidence('MEETING')">
            <Plus class="h-4 w-4" />Documentar una ruta
          </button>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <div class="hub-mini-stat"><span>Rutas verificadas</span><strong>{{ routeHistoryTotal }}</strong></div>
          <div class="hub-mini-stat"><span>Reuniones en esta página</span><strong>{{ routesCapturedFromMeetings }}</strong></div>
          <div class="hub-mini-stat"><span>Cotizaciones en esta página</span><strong>{{ routesCapturedFromQuotes }}</strong></div>
        </div>
      </div>
      <div v-if="has('crm.quote.read')" class="hub-panel">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="hub-panel-heading mb-0"><FileText class="h-4 w-4 text-[var(--dh-primary)]" />Rutas de cotizaciones (Pricing)</h3>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Consulta directa y autorizada de la última cotización comercial publicada; no requiere volver a introducir los puertos.</p>
          </div>
          <button type="button" class="hub-outline-button hub-small" :disabled="quoteRouteLoading" @click="loadQuotedRoutes()">Actualizar</button>
        </div>
        <p v-if="quoteRouteLoading" class="py-2 text-xs text-[var(--dh-text-muted)]">Consultando rutas autorizadas de Pricing…</p>
        <p v-if="quoteRouteError" role="alert" class="py-2 text-xs text-amber-600">{{ quoteRouteError }}</p>
        <p v-if="!quoteRouteLoading && !quoteRouteSnapshots.length && !quoteRouteError" class="hub-empty">No hay cotizaciones vinculadas visibles para consultar.</p>
        <ol v-if="quoteRouteSnapshots.length" class="divide-y divide-[var(--dh-border)]">
          <li v-for="q in quoteRouteSnapshots" :key="rowId(q.pricingQuoteId)" class="flex flex-wrap items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="text-xs font-extrabold text-[var(--dh-primary)]">{{ text(q.quoteNumber) }} <span class="font-medium text-[var(--dh-text-muted)]">· {{ text(q.shipmentMode) }}</span></p>
              <p v-if="q.available" class="mt-1 text-sm font-bold">
                {{ text(q.polName) }} → {{ q.poeName ? text(q.poeName) + ' → ' : '' }}{{ text(q.podName) }}
              </p>
              <p v-else class="mt-1 text-xs text-[var(--dh-text-muted)]">Ruta no disponible para el usuario o sin puertos confirmados en Pricing.</p>
              <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">
                Vinculada: {{ date(q.linkedAt) }}
                <span v-if="q.revisionNumber"> · Revisión {{ q.revisionNumber }}</span>
                <span v-if="q.revisionPending"> · Última revisión enviada (nueva edición en Pricing)</span>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <RouterLink :to="quoteLink({ id: rowId(q.pricingQuoteId), pricingQuoteId: q.pricingQuoteId })" class="hub-outline-button hub-small">Abrir tarifa</RouterLink>
              <button v-if="has('crm.analysis.manage')" type="button" class="hub-text-link" @click="openRouteEvidence('QUOTE',rowId(q.pricingQuoteId))">Documentar ruta</button>
            </div>
          </li>
        </ol>
        <div v-if="quoteRouteTotal > 8" class="mt-3 flex items-center justify-end gap-3 text-xs">
          <button type="button" class="hub-outline-button hub-small" :disabled="quoteRoutePage <= 1 || quoteRouteLoading" @click="changeQuoteRoutePage(-1)">Anterior</button>
          <span>{{ quoteRoutePage }} · {{ quoteRouteTotal }} tarifas vinculadas</span>
          <button type="button" class="hub-outline-button hub-small" :disabled="quoteRoutePage * 8 >= quoteRouteTotal || quoteRouteLoading" @click="changeQuoteRoutePage(1)">Siguiente</button>
        </div>
      </div>
      <div v-if="popularRoutes.length" class="hub-panel">
        <h3 class="hub-panel-heading"><Route class="h-4 w-4 text-[var(--dh-primary)]" />Rutas más utilizadas (registros documentados)</h3>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="(r, idx) in popularRoutes" :key="idx" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
            <p class="text-sm font-extrabold">{{ text(r.polCode) }} → {{ r.poeCode ? text(r.poeCode) + ' → ' : '' }}{{ text(r.podCode) }}</p>
            <div class="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--dh-text-muted)]">
              <span>{{ r.occurrences }} registros</span><span>{{ r.meetingCount }} reuniones</span><span>{{ r.quoteCount }} cotizaciones</span>
            </div>
            <time class="mt-2 block text-[11px] text-[var(--dh-text-muted)]">Último registro: {{ date(r.lastSeenAt) }}</time>
          </div>
        </div>
      </div>
      <div class="hub-panel">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 class="hub-panel-heading mb-0">Cronología de rutas · {{ routeHistoryTotal }} registros</h3>
          <button type="button" class="hub-outline-button hub-small" @click="loadRouteHistory()"><RefreshCw class="h-3.5 w-3.5" />Actualizar</button>
        </div>
        <p v-if="routeHistoryError" role="alert" class="mb-3 rounded-lg border border-red-500/40 p-3 text-xs text-red-500">{{ routeHistoryError }}</p>
        <div v-if="!routeHistory.length && !routeHistoryError" class="rounded-xl border border-dashed border-[var(--dh-border)] p-8 text-center">
          <Route class="mx-auto h-7 w-7 text-[var(--dh-primary)]" />
          <p class="mt-3 text-sm font-extrabold">Todavía no hay rutas con origen documentado</p>
          <p class="mx-auto mt-2 max-w-md text-xs text-[var(--dh-text-muted)]">
            Registrá una visita, marcala como completada y vinculá su ruta. También podés documentar las rutas de cotizaciones ya enlazadas.
          </p>
          <button v-if="has('crm.activity.create')" type="button" class="hub-text-link mt-4" @click="activeTab='agenda';newActivity('VISIT')">Programar una visita</button>
        </div>
        <ol v-else class="divide-y divide-[var(--dh-border)]">
          <li v-for="record in routeHistory" :key="record.id" class="flex flex-wrap items-center justify-between gap-3 py-3">
            <div class="min-w-0">
              <p class="text-sm font-extrabold">{{ text(record.polCode) }} → {{ record.poeCode ? text(record.poeCode) + ' → ' : '' }}{{ text(record.podCode) }}</p>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ record.sourceKind === 'MEETING' ? 'Reunión registrada' : 'Cotización vinculada' }} · {{ date(record.observedAt) }} · {{ text(record.serviceCode) }}</p>
              <p v-if="record.notes" class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ record.notes }}</p>
            </div>
            <RouterLink :to="record.sourceKind === 'MEETING' ? '/crm/activities/' + encodeURIComponent(rowId(record.sourceId)) : quoteLink({ pricingQuoteId: record.sourceId, id: rowId(record.id) })"
              class="hub-outline-button hub-small">{{ record.sourceKind === 'MEETING' ? 'Abrir reunión' : 'Abrir cotización' }}</RouterLink>
          </li>
        </ol>
        <footer v-if="routeHistoryTotal > 20" class="mt-4 flex items-center justify-end gap-3 text-xs">
          <button type="button" class="hub-outline-button hub-small" :disabled="routeHistoryPage === 1" @click="changeRouteHistoryPage(-1)">Anterior</button>
          <span>Página {{ routeHistoryPage }} · {{ routeHistoryTotal }} registros</span>
          <button type="button" class="hub-outline-button hub-small" :disabled="routeHistoryPage * 20 >= routeHistoryTotal" @click="changeRouteHistoryPage(1)">Siguiente</button>
        </footer>
      </div>
      <DhDrawer :open="routeCaptureOpen" title="Documentar ruta de cliente" size="lg" @close="routeCaptureOpen=false">
        <form class="space-y-4 p-2" @submit.prevent="saveRouteEvidence">
          <p class="text-xs text-[var(--dh-text-muted)]">La ruta quedará respaldada por la reunión completada o la cotización vinculada que seleccionés.</p>
          <label class="block space-y-1.5 text-xs font-bold">Origen del historial *
            <select v-model="routeSourceKind" class="crm-input w-full" @change="routeSourceId=''">
              <option value="MEETING">Reunión completada</option>
              <option value="QUOTE">Cotización vinculada</option>
            </select>
          </label>
          <label class="block space-y-1.5 text-xs font-bold">Registro de origen *
            <select v-model="routeSourceId" required class="crm-input w-full">
              <option value="">Seleccionar origen</option>
              <option v-for="option in sourceList" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <p v-if="!sourceList.length" class="text-xs text-amber-600">
            {{ routeSourceKind === 'MEETING' ? 'No hay reuniones completadas visibles en el historial reciente. Abrí Actividades para registrar o completar una visita.' : 'No hay cotizaciones vinculadas a las oportunidades de este cliente.' }}
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <CrmCatalogPicker v-model="routePol" label="POL / Origen *" catalog-group-slug="pol" value-kind="code" />
            <CrmCatalogPicker v-model="routePoe" label="POE / Puerto intermedio" catalog-group-slug="poe" value-kind="code" />
            <CrmCatalogPicker v-model="routePod" label="POD / Destino *" catalog-group-slug="pod" value-kind="code" />
            <CrmCatalogPicker v-model="routeService" label="Servicio" catalog-group-slug="pricing-services" value-kind="code" />
          </div>
          <label class="block space-y-1.5 text-xs font-bold">Observaciones de la ruta
            <textarea v-model="routeNotes" maxlength="2000" rows="3" class="crm-input w-full" placeholder="Información confirmada durante la reunión o cotización"></textarea>
          </label>
          <div class="flex justify-end gap-2 border-t border-[var(--dh-border)] pt-3">
            <button type="button" class="hub-outline-button" @click="routeCaptureOpen=false">Cancelar</button>
            <button type="submit" class="crm-action" :disabled="busy || !routeSourceId || !routePol || !routePod">Guardar ruta con origen</button>
          </div>
        </form>
      </DhDrawer>
    </section>

    <section v-else-if="activeTab === 'quotes'" id="crm-account-quotes" role="tabpanel" class="hub-panel">
      <div class="mb-4">
        <h2 class="font-extrabold">{{ locale === 'en' ? 'Quotation history' : 'Historial de cotizaciones' }}</h2>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Solo se muestran cotizaciones vinculadas a oportunidades de esta cuenta. Pricing conserva el cálculo y el estado oficial.</p>
      </div>
      <p v-if="!recentQuotes.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm text-[var(--dh-text-muted)]">No hay cotizaciones vinculadas a esta cuenta todavía.</p>
      <div v-else class="overflow-x-auto"><table class="w-full min-w-[620px] text-left text-sm">
        <thead class="border-b border-[var(--dh-border)] text-xs uppercase text-[var(--dh-text-muted)]"><tr><th class="px-3 py-3">Cotización</th><th class="px-3 py-3">Modalidad</th><th class="px-3 py-3">Estado</th><th class="px-3 py-3">Vinculada</th><th class="px-3 py-3">Acción</th></tr></thead>
        <tbody><tr v-for="q in recentQuotes" :key="rowId(q.pricingQuoteId)" class="border-b border-[var(--dh-border)] last:border-0">
          <td class="px-3 py-3 font-bold">{{ text(q.quoteNumberSnapshot) }}</td>
          <td class="px-3 py-3">{{ text(q.shipmentModeSnapshot) }}</td>
          <td class="px-3 py-3">{{ text(q.commercialStatusSnapshot) }}</td>
          <td class="px-3 py-3">{{ date(q.linkedAt) }}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap items-center gap-3">
              <RouterLink :to="quoteLink(q)" class="font-bold text-[var(--dh-primary)] hover:underline">Abrir tarifa</RouterLink>
              <button v-if="has('crm.analysis.manage') && has('crm.analysis.read')" type="button" class="hub-text-link" @click="openRouteEvidence('QUOTE', rowId(q.pricingQuoteId))">Registrar ruta</button>
            </div>
          </td>
        </tr></tbody>
      </table></div>
      <p class="mt-3 text-xs text-[var(--dh-text-muted)]">Se muestran hasta 100 vínculos. Las tarifas de Pricing sin vínculo CRM no se incluyen en esta versión.</p>
      <div v-if="overview.opportunities.length" class="mt-6 border-t border-[var(--dh-border)] pt-4">
        <h3 class="mb-2 font-bold">Oportunidades asociadas ({{ overview.opportunities.length }})</h3>
        <div v-for="o in overview.opportunities" :key="o.id" class="flex justify-between gap-3 border-b border-[var(--dh-border)] py-2 text-sm last:border-0">
          <RouterLink :to="'/crm/opportunities/' + encodeURIComponent(rowId(o.id))" class="font-semibold hover:text-[var(--dh-primary)]">{{ text(o.title) }}</RouterLink>
          <span class="text-[var(--dh-text-muted)]">{{ text(o.status) }}</span>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'agenda'" id="crm-account-agenda" role="tabpanel" class="hub-panel">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 class="font-extrabold">Actividad comercial y seguimientos</h2>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Visitas, llamadas, tareas y recordatorios en una sola línea de tiempo.</p></div>
        <div class="flex flex-wrap gap-2">
          <button v-if="has('crm.activity.create')" class="crm-action inline-flex items-center gap-1" @click="newActivity('CALL')"><Phone class="h-4 w-4" />Llamada</button>
          <button v-if="has('crm.activity.create')" class="crm-action inline-flex items-center gap-1" @click="newActivity('VISIT')"><Plus class="h-4 w-4" />Visita</button>
          <button v-if="has('crm.task.manage') || has('crm.followup.manage')" class="rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-bold" @click="newActivity('FOLLOWUP')">Seguimiento</button>
        </div>
      </div>
      <DhDrawer :open="Boolean(editor)" :title="editor === 'CALL' ? 'Registrar llamada' : editor === 'VISIT' ? 'Programar visita' : 'Nuevo seguimiento'" size="md" @close="editor=null">
        <form class="grid gap-3 p-2 sm:grid-cols-2" @submit.prevent="saveActivity">
        <h3 class="font-extrabold sm:col-span-2">{{ editor === 'CALL' ? 'Registrar llamada' : editor === 'VISIT' ? 'Programar visita' : 'Nuevo seguimiento' }}</h3>
        <label v-if="editor !== 'FOLLOWUP'" class="text-xs font-bold">Asunto *
          <input v-model.trim="subject" required maxlength="250" class="crm-input mt-2 w-full" placeholder="Motivo de contacto" /></label>
        <label class="text-xs font-bold">Fecha y hora *
          <input v-model="scheduled" required type="datetime-local" class="crm-input mt-2 w-full" /></label>
        <label v-if="editor === 'VISIT'" class="text-xs font-bold">Lugar
          <input v-model.trim="location" maxlength="200" class="crm-input mt-2 w-full" /></label>
        <label v-if="editor === 'FOLLOWUP'" class="text-xs font-bold">Medio
          <select v-model="channel" class="crm-input mt-2 w-full"><option value="PHONE">Teléfono</option><option value="VISIT">Visita</option><option value="EMAIL">Correo</option><option value="SYSTEM">Notificación</option></select></label>
        <div class="flex gap-2 sm:col-span-2">
          <button class="crm-action" :disabled="busy || !scheduled || (editor !== 'FOLLOWUP' && !subject)">Guardar</button>
          <button type="button" class="rounded-xl border border-[var(--dh-border)] px-3 py-2 text-sm" @click="editor=null">Cancelar</button>
        </div>
        </form>
      </DhDrawer>
      <div v-if="!visibleTimeline.length" class="rounded-xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm text-[var(--dh-text-muted)]">No hay actividades ni seguimientos registrados.</div>
      <ol v-else class="space-y-0">
        <li v-for="entry in visibleTimeline" :key="entry.kind + entry.id" class="relative ml-2 border-l border-[var(--dh-border)] py-4 pl-6">
          <span class="absolute -left-[6px] top-6 h-3 w-3 rounded-full border-2 border-[var(--dh-card)] bg-[var(--dh-primary)]"></span>
          <div class="flex flex-wrap justify-between gap-2">
            <RouterLink :to="entry.href" class="text-sm font-extrabold hover:text-[var(--dh-primary)]">{{ entry.subject }}</RouterLink>
            <span class="text-xs text-[var(--dh-text-muted)]">{{ date(entry.time) }}</span>
          </div>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ entry.kind }} · {{ entry.status }}</p>
          <button v-if="has('crm.analysis.manage') && ['VISIT','MEETING'].includes(entry.kind) && entry.status === 'Completed'"
            type="button" class="hub-text-link mt-2" @click="openRouteEvidence('MEETING', entry.id)">Documentar ruta acordada en esta reunión</button>
        </li>
      </ol>
    </section>

    <div v-else-if="activeTab === 'finance'" id="crm-account-finance" role="tabpanel" class="grid items-start gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <section v-if="has('crm.credit.read')" class="hub-panel">
        <h2 class="mb-3 flex items-center gap-2 font-extrabold"><Wallet class="h-4 w-4 text-[var(--dh-primary)]" />Condiciones de crédito</h2>
        <p v-if="!credit.length" class="text-sm text-[var(--dh-text-muted)]">No hay perfiles de crédito registrados.</p>
        <dl v-for="c in credit.slice(0,3)" :key="c.id" class="grid grid-cols-2 gap-4 border-b border-[var(--dh-border)] py-3 last:border-0">
          <div><dt class="text-xs text-[var(--dh-text-muted)]">Días</dt><dd class="font-bold">{{ c.creditDays }}</dd></div>
          <div><dt class="text-xs text-[var(--dh-text-muted)]">Límite</dt><dd class="font-bold">{{ c.creditLimit }} {{ c.currencyCode }}</dd></div>
          <div><dt class="text-xs text-[var(--dh-text-muted)]">Estado</dt><dd class="font-bold">{{ c.status }}</dd></div>
          <div><dt class="text-xs text-[var(--dh-text-muted)]">Financiación mensual</dt><dd class="font-bold">{{ c.monthlyFinancingPct }}%</dd></div>
          <div class="col-span-2"><dt class="text-xs text-[var(--dh-text-muted)]">Condiciones</dt><dd class="text-sm">{{ text(c.paymentConditions) }}</dd></div>
        </dl>
      </section>
      <section v-if="has('crm.credit.read')" class="hub-panel lg:col-span-2">
        <CrmCreditCoverageManager :account-id="String(account.id)" />
      </section>
      <section v-if="has('crm.contract.read')" class="hub-panel">
        <h2 class="mb-3 font-extrabold">Contratos y renovaciones</h2>
        <p v-if="!contracts.length" class="text-sm text-[var(--dh-text-muted)]">No hay contratos registrados.</p>
        <div v-for="c in contracts" :key="c.id" class="border-b border-[var(--dh-border)] py-3 text-sm last:border-0">
          <p class="font-bold">{{ text(c.contractNumber) }} · {{ text(c.status) }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Renovación: {{ date(c.renewalDate) }} · Vencimiento: {{ date(c.expiryDate) }}</p>
        </div>
      </section>
      <section class="hub-panel">
        <h2 class="hub-panel-heading"><UsersRound class="h-4 w-4 text-[var(--dh-primary)]" />Contactos de la cuenta</h2>
        <p v-if="!contacts.length" class="hub-empty">No hay contactos relacionados.</p>
        <div v-for="contact in contacts" :key="contact.id" class="hub-list-item">
          <RouterLink :to="'/crm/contacts/' + encodeURIComponent(rowId(contact.id))" class="text-xs font-bold text-[var(--dh-primary)] hover:underline">{{ text(contact.name || contact.displayName) }}</RouterLink>
          <p class="mt-1 text-[11px] text-[var(--dh-text-muted)]">{{ text(contact.email) }}</p>
        </div>
      </section>
    </div>
    <DhDrawer :open="profileOpen" title="Datos empresariales y operativos" size="xl" @close="profileOpen=false">
      <form class="space-y-4 p-2" @submit.prevent="saveProfile">
        <p class="text-xs text-[var(--dh-text-muted)]">Información corporativa del cliente. Los contactos personales, direcciones, crédito y rutas se administran como registros separados.</p>
        <fieldset v-for="group in profileGroups" :key="group.label" class="rounded-lg border border-[var(--dh-border)] p-4">
          <legend class="px-2 text-sm font-extrabold">{{ group.label }}</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <div v-for="field in group.fields" :key="field.key" :class="field.long ? 'sm:col-span-2' : ''">
              <DhTextarea v-if="field.long" :model-value="profileDraft[field.key] ?? ''" @update:model-value="profileDraft[field.key] = $event" :label="field.label" :rows="3" />
              <DhInput v-else :model-value="profileDraft[field.key] ?? ''" @update:model-value="profileDraft[field.key] = $event" :label="field.label" :type="field.type === 'email' ? 'email' : 'text'" />
            </div>
          </div>
        </fieldset>
        <div class="flex justify-end gap-2 border-t border-[var(--dh-border)] pt-3">
          <button type="button" class="hub-outline-button" @click="profileOpen=false">Cancelar</button>
          <button type="submit" class="crm-action" :disabled="profileSaving">{{ profileSaving ? 'Guardando…' : 'Guardar datos empresariales' }}</button>
        </div>
      </form>
    </DhDrawer>
    </div>
  </div>
</template>

<style scoped>
.hub-hero-bar{background:linear-gradient(115deg,var(--dh-shell),var(--dh-card));border-radius:1.3rem 1.3rem 0 0}
.hub-primary-button{display:inline-flex;align-items:center;gap:.4rem;padding:.57rem .85rem;background:var(--dh-primary);border-radius:.75rem;color:white;font-size:.75rem;font-weight:800}
.hub-customer-pill{display:inline-flex;align-items:center;border:1px solid var(--dh-border);border-radius:999px;background:var(--dh-shell);padding:.42rem .7rem;font-size:.72rem;font-weight:800;color:var(--dh-text)}
.hub-record-header{overflow:hidden}
.hub-command-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;border:1px solid var(--dh-border);border-radius:.8rem;background:var(--dh-card);padding:.65rem .8rem;box-shadow:var(--dh-shadow-sm)}
.hub-summary-strip{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1rem;border:1px solid var(--dh-border);border-radius:.8rem;background:var(--dh-card);padding:.85rem 1rem;font-size:.75rem;color:var(--dh-text-muted)}
.hub-summary-strip>span:first-child{color:var(--dh-text)}
.hub-record-header{backdrop-filter:blur(16px)}
.hub-tab{display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;padding:.67rem .85rem;border-radius:.65rem;font-size:.74rem;font-weight:700;color:var(--dh-text-muted);transition:background .15s,color .15s}
.hub-tab:hover,.hub-tab:focus-visible{color:var(--dh-text);background:var(--dh-primary-light,transparent);outline-offset:-2px}
.hub-tab-active{color:var(--dh-primary);background:var(--dh-primary-light,var(--dh-shell));box-shadow:inset 0 0 0 1px var(--dh-border)}
.hub-header-meta{display:inline-flex;align-items:center;gap:.35rem;color:var(--dh-text-muted);font-weight:600}
.hub-panel{min-width:0;border:1px solid var(--dh-border);border-radius:1.15rem;background:var(--dh-card);padding:1.15rem;box-shadow:var(--dh-shadow-sm)}
.hub-panel-heading{display:flex;align-items:center;gap:.55rem;margin-bottom:.8rem;font-size:.82rem;font-weight:800;color:var(--dh-text)}
.hub-section-heading{padding-bottom:.45rem;border-bottom:1px solid var(--dh-border);font-size:.72rem;font-weight:800;color:var(--dh-text)}
.hub-kv{display:grid;grid-template-columns:minmax(0,41%) minmax(0,59%);gap:.65rem;align-items:start;padding:.63rem 0;font-size:.75rem;line-height:1.45}
.hub-kv dt{color:var(--dh-text-muted);font-weight:650}
.hub-kv dd{min-width:0;overflow-wrap:anywhere;font-weight:650}
.hub-mini-stat{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.7rem .8rem;border-radius:.65rem;border:1px solid var(--dh-border);background:var(--dh-shell);font-size:.68rem}
.hub-mini-stat span{color:var(--dh-text-muted)}
.hub-mini-stat strong{font-size:1.15rem}
.hub-count{margin-left:auto;border-radius:999px;background:var(--dh-shell);border:1px solid var(--dh-border);padding:.14rem .45rem;font-size:.62rem;color:var(--dh-text-muted)}
.hub-empty{padding:1.15rem .3rem;text-align:center;font-size:.75rem;color:var(--dh-text-muted)}
.hub-list-item{border-bottom:1px solid var(--dh-border);padding:.7rem 0}
.hub-list-item:last-child{border:0}
.hub-text-link{color:var(--dh-primary);font-size:.7rem;font-weight:750;white-space:nowrap}
.hub-text-link:hover{text-decoration:underline}
.hub-outline-button{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;padding:.65rem .8rem;border:1px solid var(--dh-border);border-radius:.7rem;background:var(--dh-shell);font-size:.72rem;font-weight:750;white-space:nowrap}
.hub-outline-button:hover{border-color:var(--dh-primary)}
.hub-outline-button:disabled{opacity:.5}
.hub-small{padding:.45rem .6rem;font-size:.67rem}
.hub-timeline{margin-left:.3rem;border-left:1px solid var(--dh-border)}
.hub-timeline li{position:relative;padding:.55rem .4rem .8rem 1rem}
.hub-timeline li::before{content:'';position:absolute;left:-.3rem;top:.8rem;height:.55rem;width:.55rem;border:2px solid var(--dh-card);border-radius:50%;background:var(--dh-primary)}
@media(min-width:1280px){.hub-panel{padding:1.05rem}.hub-kv{font-size:.74rem}}
@media(max-width:640px){.hub-tab{padding:.7rem .65rem;font-size:.71rem}}
</style>
