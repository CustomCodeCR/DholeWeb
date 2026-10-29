<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { crmPath, crmRequest, crmUuid, toUtc, type CrmRow } from '../services/crmApi'
import CrmCatalogPicker from './CrmCatalogPicker.vue'
import { DhDrawer } from '@/shared/components/organisms'
import {
  Activity, CalendarClock, CheckCircle2, Clock3, FileText, MapPin, Phone,
  Plus, RefreshCw, Route, Truck, UserRound, UsersRound, Wallet,
} from 'lucide-vue-next'

type Section = 'summary' | 'commercial' | 'quotes' | 'agenda' | 'finance'
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
const props = defineProps<{ account: CrmRow }>()
const emit = defineEmits<{ (e: 'change-executive'): void }>()
const router = useRouter()
const auth = useAuthStore()
const { locale } = useI18n()
const has = (scope: string) => auth.hasScope(scope)
const lang = computed(() => locale.value === 'en' ? 'en-US' : 'es-CR')
const activeTab = ref<Section>('summary')
const compactRow = (label: string, value: unknown) => ({ label, value })
const tabs = computed(() => [
  { key: 'summary' as const, label: locale.value === 'en' ? 'Customer' : 'Cliente', icon: UserRound },
  { key: 'commercial' as const, label: locale.value === 'en' ? 'Customer profile' : 'Ficha cliente', icon: Route },
  { key: 'quotes' as const, label: locale.value === 'en' ? 'Quotes & routes' : 'Tarifas y rutas', icon: Truck },
  { key: 'agenda' as const, label: locale.value === 'en' ? 'Activity & follow-up' : 'Seguimientos', icon: CalendarClock },
  ...(has('crm.credit.read') || has('crm.contract.read')
    ? [{ key: 'finance' as const, label: locale.value === 'en' ? 'Credit & contacts' : 'Crédito / contactos', icon: Wallet }]
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
const countryName = ref('')
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
    // Permissioned lookups are independent; a forbidden credit profile never blocks
    // the commercial parts of a customer record or exposes a hidden field.
    const jobs: Promise<void>[] = []
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
  countryName.value = ''
  activeTab.value = 'summary'
  void load()
}, { immediate: true })

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
    <header class="hub-record-header sticky top-1 z-20 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-primary)]/10 text-lg font-black text-[var(--dh-primary)]" aria-hidden="true">
            {{ text(account.displayName || account.legalName).slice(0, 2).toUpperCase() }}
          </div>
          <div class="min-w-0">
            <div class="mb-1 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--dh-text-muted)]">CRM · {{ locale === 'en' ? 'Account record' : 'Cuenta comercial' }}</div>
            <h1 class="truncate text-lg font-extrabold tracking-tight sm:text-xl">{{ text(account.displayName || account.legalName) }}</h1>
            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--dh-text-muted)]">
              <span class="inline-flex items-center gap-1"><MapPin class="h-3.5 w-3.5" />{{ countryName || 'País sin definir' }}</span>
              <span>{{ text(account.taxId) }}</span>
              <span>{{ account.customerTypeCode === 'credit' ? 'Cliente crédito' : 'Cliente contado' }}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="has('crm.account.assign') && has('auth.users.view')" type="button"
            class="hub-outline-button" @click="emit('change-executive')"><UsersRound class="h-4 w-4" />Asignar ejecutivo</button>
          <button type="button" class="hub-outline-button" :disabled="loading" @click="load">
            <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />{{ locale === 'en' ? 'Refresh' : 'Actualizar' }}
          </button>
        </div>
      </div>
      <div class="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--dh-border)] px-4 py-2 text-[11px] sm:px-5">
        <span class="hub-header-meta"><FileText class="h-3.5 w-3.5" />{{ recentQuotes.length }} {{ locale === 'en' ? 'linked quotes' : 'tarifas vinculadas' }}</span>
        <span class="hub-header-meta"><Route class="h-3.5 w-3.5" />{{ activeRoutes.length }} rutas</span>
        <span class="hub-header-meta"><Activity class="h-3.5 w-3.5" />{{ activityCount }} actividades</span>
        <span class="hub-header-meta"><Clock3 class="h-3.5 w-3.5" />{{ pendingCount }} pendientes</span>
        <span class="ml-auto text-[var(--dh-text-muted)]">ID {{ String(account.id).slice(0, 8) }}</span>
      </div>
      <nav role="tablist" class="flex max-w-full overflow-x-auto border-t border-[var(--dh-border)] px-2 sm:px-3"
        :aria-label="locale === 'en' ? 'Account sections' : 'Secciones del cliente'">
        <button v-for="tab in tabs" :key="tab.key" type="button" role="tab"
          :aria-selected="activeTab === tab.key" :aria-controls="'crm-account-' + tab.key"
          class="hub-tab" :class="activeTab === tab.key ? 'hub-tab-active' : ''" @click="activeTab = tab.key">
          <component :is="tab.icon" class="h-3.5 w-3.5" />{{ tab.label }}
        </button>
      </nav>
    </header>
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
            <div class="hub-mini-stat"><span>Oportunidades</span><strong>{{ overview.opportunities.length }}</strong></div>
          </div>
          <h3 class="hub-section-heading mt-4">Mercados y operaciones</h3>
          <p v-if="!overview.analyses.length" class="hub-empty">Sin análisis comercial registrado.</p>
          <dl v-for="analysis in overview.analyses.slice(0,2)" :key="analysis.id" class="divide-y divide-[var(--dh-border)]">
            <div class="hub-kv"><dt>Mercado</dt><dd>{{ text(analysis.marketCode) }}</dd></div>
            <div class="hub-kv"><dt>Nacionalización</dt><dd>{{ analysis.customsNationalizationRequired ? 'Sí' : 'No' }}</dd></div>
            <div class="hub-kv"><dt>Volumen estimado</dt><dd>{{ analysis.estimatedMonthlyVolume ?? '—' }} {{ text(analysis.volumeUnit) }}</dd></div>
          </dl>
          <h3 class="hub-section-heading mt-4">Rutas frecuentes · POL / POE / POD</h3>
          <p v-if="!activeRoutes.length && !overview.analysisRoutes.length" class="hub-empty">No hay rutas frecuentes registradas.</p>
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
          <td class="px-3 py-3"><RouterLink :to="quoteLink(q)" class="font-bold text-[var(--dh-primary)] hover:underline">Abrir tarifa</RouterLink></td>
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
  </div>
</template>

<style scoped>
.hub-record-header{backdrop-filter:blur(16px)}
.hub-tab{display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;padding:.85rem .95rem;font-size:.75rem;font-weight:700;color:var(--dh-text-muted);border-bottom:2px solid transparent;transition:color .15s,border-color .15s}
.hub-tab:hover,.hub-tab:focus-visible{color:var(--dh-text);background:var(--dh-primary-light,transparent);outline-offset:-2px}
.hub-tab-active{color:var(--dh-primary);border-bottom-color:var(--dh-primary)}
.hub-header-meta{display:inline-flex;align-items:center;gap:.35rem;color:var(--dh-text-muted);font-weight:600}
.hub-panel{min-width:0;border:1px solid var(--dh-border);border-radius:1rem;background:var(--dh-card);padding:1rem;box-shadow:var(--dh-shadow-sm)}
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
