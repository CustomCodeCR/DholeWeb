<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { crmPath, crmRequest, crmUuid, toUtc, type CrmRow } from '../services/crmApi'
import CrmCatalogPicker from './CrmCatalogPicker.vue'
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
const router = useRouter()
const auth = useAuthStore()
const { locale } = useI18n()
const has = (scope: string) => auth.hasScope(scope)
const lang = computed(() => locale.value === 'en' ? 'en-US' : 'es-CR')
const activeTab = ref<Section>('summary')
const tabs = computed(() => [
  { key: 'summary' as const, label: locale.value === 'en' ? 'Customer' : 'Cliente', icon: UserRound },
  { key: 'commercial' as const, label: locale.value === 'en' ? 'Commercial profile' : 'Ficha comercial', icon: Route },
  { key: 'quotes' as const, label: locale.value === 'en' ? 'Quotes & routes' : 'Tarifas y rutas', icon: Truck },
  { key: 'agenda' as const, label: locale.value === 'en' ? 'Activity & follow-up' : 'Visitas y llamadas', icon: CalendarClock },
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
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="stat in [
        {label: locale === 'en' ? 'Linked quotes' : 'Tarifas vinculadas', value: recentQuotes.length, icon: FileText},
        {label: locale === 'en' ? 'Usual routes' : 'Rutas habituales', value: activeRoutes.length, icon: Route},
        {label: locale === 'en' ? 'Activities' : 'Actividades', value: activityCount, icon: Activity},
        {label: locale === 'en' ? 'Pending follow-ups' : 'Seguimientos pendientes', value: pendingCount, icon: Clock3},
      ]" :key="stat.label" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ stat.label }}</span>
          <component :is="stat.icon" class="h-4 w-4 text-[var(--dh-primary)]" />
        </div>
        <p class="mt-2 text-2xl font-extrabold">{{ stat.value }}</p>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <nav class="flex max-w-full flex-1 gap-1 overflow-x-auto border-b border-[var(--dh-border)]" :aria-label="locale === 'en' ? 'Account sections' : 'Secciones del cliente'">
        <button v-for="tab in tabs" :key="tab.key" type="button" role="tab"
          :aria-selected="activeTab === tab.key" :aria-controls="'crm-account-' + tab.key"
          class="inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-bold transition sm:text-sm"
          :class="activeTab === tab.key ? 'border-[var(--dh-primary)] text-[var(--dh-primary)]' : 'border-transparent text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]'"
          @click="activeTab = tab.key">
          <component :is="tab.icon" class="h-4 w-4" />{{ tab.label }}
        </button>
      </nav>
      <button class="inline-flex items-center gap-2 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-bold hover:bg-[var(--dh-card)]"
        :disabled="loading" @click="load"><RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />{{ locale === 'en' ? 'Refresh' : 'Actualizar' }}</button>
    </div>
    <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 p-3 text-sm text-red-500">{{ error }}</p>
    <p v-if="saved" role="status" class="text-sm text-emerald-500">{{ saved }}</p>
    <p v-if="loading" role="status" class="text-xs text-[var(--dh-text-muted)]">{{ locale === 'en' ? 'Loading account data…' : 'Cargando datos de la cuenta…' }}</p>

    <div v-if="activeTab === 'summary'" id="crm-account-summary" role="tabpanel" class="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <h2 class="mb-4 flex items-center gap-2 text-sm font-extrabold"><UserRound class="h-4 w-4 text-[var(--dh-primary)]" />{{ locale === 'en' ? 'Customer identification' : 'Información del cliente' }}</h2>
        <dl class="grid gap-4 sm:grid-cols-2">
          <div v-for="item in [
            {label: 'Nombre comercial', value: account.displayName},
            {label: 'Razón social', value: account.legalName},
            {label: 'País', value: countryName || '—'},
            {label: 'Identificación fiscal', value: account.taxId},
            {label: 'Tipo de identificación', value: account.taxIdTypeCode},
            {label: 'Tipo de cliente', value: account.customerTypeCode === 'credit' ? 'Crédito' : 'Contado'},
            {label: 'Categoría', value: String(account.categoryType ?? '') + ' · ' + String(account.categoryCode ?? '')},
            {label: 'Relación comercial', value: account.relationshipTypeCode},
            {label: 'Origen', value: account.sourceCode},
            {label: 'Validación fiscal', value: account.verificationStatus},
          ]" :key="item.label">
            <dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ item.label }}</dt>
            <dd class="break-words text-sm font-medium">{{ text(item.value) }}</dd>
          </div>
        </dl>
      </section>
      <div class="space-y-4">
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-extrabold"><UsersRound class="h-4 w-4 text-[var(--dh-primary)]" />Contactos ({{ contacts.length }})</h2>
          <p v-if="!contacts.length" class="text-sm text-[var(--dh-text-muted)]">No hay contactos registrados.</p>
          <button v-for="c in contacts.slice(0,8)" :key="c.id" type="button"
            class="flex w-full items-center justify-between border-b border-[var(--dh-border)] py-3 text-left last:border-0 hover:text-[var(--dh-primary)]"
            @click="router.push('/crm/contacts/' + encodeURIComponent(rowId(c.id)))">
            <span class="min-w-0"><span class="block truncate text-sm font-bold">{{ text(c.name) }}</span>
              <span class="block truncate text-xs text-[var(--dh-text-muted)]">{{ text(c.jobTitle) }} · {{ text(c.email) }}</span></span>
            <Phone class="h-4 w-4 shrink-0" />
          </button>
        </section>
        <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-extrabold"><MapPin class="h-4 w-4 text-[var(--dh-primary)]" />{{ locale === 'en' ? 'Addresses' : 'Direcciones' }}</h2>
          <p v-if="!addresses.length" class="text-sm text-[var(--dh-text-muted)]">Sin direcciones registradas.</p>
          <div v-for="a in addresses.slice(0,5)" :key="a.id" class="border-b border-[var(--dh-border)] py-2 text-sm last:border-0">
            <p class="text-xs text-[var(--dh-text-muted)]">{{ text(a.addressType) }}</p><p>{{ text(a.addressText) }}</p>
          </div>
        </section>
      </div>
    </div>

    <div v-else-if="activeTab === 'commercial'" id="crm-account-commercial" role="tabpanel" class="space-y-4">
      <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 class="font-extrabold">{{ locale === 'en' ? 'Usual services and routes' : 'Servicios y rutas habituales' }}</h2>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Origen → destino · servicio · frecuencia · volumen</p></div>
          <button v-if="has('crm.analysis.manage')" class="inline-flex items-center gap-2 rounded-xl bg-[var(--dh-primary)] px-3 py-2 text-xs font-bold text-white"
            @click="routeEditor = !routeEditor"><Plus class="h-4 w-4" />{{ locale === 'en' ? 'Add route' : 'Añadir ruta' }}</button>
        </div>
        <form v-if="routeEditor" class="mb-5 grid gap-3 rounded-xl border border-[var(--dh-border)] p-4 sm:grid-cols-2" @submit.prevent="saveRoute">
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
      <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <h2 class="mb-3 font-extrabold">Análisis comercial ({{ overview.analyses.length }})</h2>
        <p v-if="!overview.analyses.length" class="text-sm text-[var(--dh-text-muted)]">No hay análisis registrados.</p>
        <button v-for="a in overview.analyses" :key="a.id" class="flex w-full items-center justify-between gap-3 border-b border-[var(--dh-border)] py-3 text-left text-sm last:border-0 hover:text-[var(--dh-primary)]"
          @click="router.push('/crm/analyses/' + encodeURIComponent(rowId(a.id)))">
          <span>{{ text(a.marketCode) }} · {{ a.customsNationalizationRequired ? 'Incluye aduanas' : 'Sin aduanas' }}</span>
          <span class="text-xs text-[var(--dh-text-muted)]">{{ a.estimatedMonthlyVolume ?? '—' }} {{ a.volumeUnit }}</span>
        </button>
      </section>
    </div>

    <section v-else-if="activeTab === 'quotes'" id="crm-account-quotes" role="tabpanel" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
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

    <section v-else-if="activeTab === 'agenda'" id="crm-account-agenda" role="tabpanel" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 class="font-extrabold">Actividad comercial y seguimientos</h2>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Visitas, llamadas, tareas y recordatorios en una sola línea de tiempo.</p></div>
        <div class="flex flex-wrap gap-2">
          <button v-if="has('crm.activity.create')" class="crm-action inline-flex items-center gap-1" @click="newActivity('CALL')"><Phone class="h-4 w-4" />Llamada</button>
          <button v-if="has('crm.activity.create')" class="crm-action inline-flex items-center gap-1" @click="newActivity('VISIT')"><Plus class="h-4 w-4" />Visita</button>
          <button v-if="has('crm.task.manage') || has('crm.followup.manage')" class="rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-bold" @click="newActivity('FOLLOWUP')">Seguimiento</button>
        </div>
      </div>
      <form v-if="editor" class="mb-5 grid gap-3 rounded-xl border border-[var(--dh-primary)]/30 p-4 sm:grid-cols-2" @submit.prevent="saveActivity">
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

    <div v-else-if="activeTab === 'finance'" id="crm-account-finance" role="tabpanel" class="grid gap-4 lg:grid-cols-2">
      <section v-if="has('crm.credit.read')" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
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
      <section v-if="has('crm.contract.read')" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <h2 class="mb-3 font-extrabold">Contratos y renovaciones</h2>
        <p v-if="!contracts.length" class="text-sm text-[var(--dh-text-muted)]">No hay contratos registrados.</p>
        <div v-for="c in contracts" :key="c.id" class="border-b border-[var(--dh-border)] py-3 text-sm last:border-0">
          <p class="font-bold">{{ text(c.contractNumber) }} · {{ text(c.status) }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Renovación: {{ date(c.renewalDate) }} · Vencimiento: {{ date(c.expiryDate) }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
