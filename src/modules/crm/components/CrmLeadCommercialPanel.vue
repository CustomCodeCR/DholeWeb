<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import CrmCatalogPicker from './CrmCatalogPicker.vue'
import { commercialRateStatusLabel } from '@/modules/pricing/utils/pricingFormat'
import { crmError, crmPath, crmRequest, crmUuid, type CrmPage, type CrmRow } from '../services/crmApi'

const props = defineProps<{ lead: CrmRow }>()
const auth = useAuthStore()
const { locale } = useI18n()
const can = (scope: string) => auth.hasScope(scope)
const canReadAnalyses = computed(() => can('crm.analysis.read'))
const canManageAnalyses = computed(() => can('crm.analysis.manage'))
const canReadQuotes = computed(() => can('crm.quote.read') && (can('crm.opportunity.read') || can('crm.opportunity.read-all')))
const canLinkQuotes = computed(() => can('crm.quote.link') && can('crm.opportunity.update'))
const canCreateOpportunity = computed(() => can('crm.opportunity.create'))

const analyses = ref<CrmRow[]>([])
const selectedAnalysisId = ref('')
const analysisRoutes = ref<CrmRow[]>([])
const quotes = ref<CrmRow[]>([])
const quoteTotal = ref(0)
const quotePage = ref(1)
const opportunities = ref<CrmRow[]>([])
const opportunityId = ref('')
const busy = ref(false)
const error = ref('')
const success = ref('')
const loadError = ref('')
const quoteError = ref('')
const analysisLoading = ref(false)
const quotesLoading = ref(false)
const newMarket = ref('')
const newObservations = ref('')
const newVolume = ref('')
const newVolumeUnit = ref('TEU')
const requiresCustoms = ref(false)
const routeDraft = reactive({
  polCode: '', poeCode: '', podCode: '',
  originCountryCode: '', destinationCountryCode: '', frequencyPerMonth: '', notes: '',
})
const opportunityTitle = ref('')
const opportunityCurrency = ref('USD')
const quoteId = ref('')
const requestId = ref('')
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
let analysisGeneration = 0
let routesGeneration = 0
let quoteGeneration = 0
let opportunitiesGeneration = 0
const chosenAnalysis = computed(() => analyses.value.find(x => String(x.id) === selectedAnalysisId.value))
const selectedOpportunity = computed(() => opportunities.value.find(x => String(x.id) === opportunityId.value))
const quotePages = computed(() => Math.max(1, Math.ceil(quoteTotal.value / 25)))
const quoteLink = (id: unknown) => '/pricing/rates?rateId=' + encodeURIComponent(String(id || ''))
const opportunityLink = (id: unknown) => '/crm/opportunities/' + encodeURIComponent(String(id || ''))

async function loadAnalyses() {
  const generation = ++analysisGeneration
  const leadId = String(props.lead.id)
  if (!canReadAnalyses.value) return
  analysisLoading.value = true
  loadError.value = ''
  try {
    const result = await crmRequest<CrmPage>(crmPath('analyses') +
      '?leadId=' + encodeURIComponent(leadId) + '&page=1&pageSize=100')
    if (generation !== analysisGeneration || leadId !== props.lead.id) return
    analyses.value = result.items ?? []
    if (!analyses.value.some(x => String(x.id) === selectedAnalysisId.value))
      selectedAnalysisId.value = String(analyses.value[0]?.id ?? '')
    if (selectedAnalysisId.value) await loadRoutes(selectedAnalysisId.value)
    else analysisRoutes.value = []
  } catch (cause) {
    if (generation === analysisGeneration) loadError.value = crmError(cause)
  } finally {
    if (generation === analysisGeneration) analysisLoading.value = false
  }
}
async function loadRoutes(analysisId: string) {
  const generation = ++routesGeneration
  analysisRoutes.value = []
  if (!analysisId || !canReadAnalyses.value) return
  try {
    const result = await crmRequest<CrmRow[]>(crmPath('analyses', analysisId, 'routes'))
    if (generation !== routesGeneration || analysisId !== selectedAnalysisId.value) return
    analysisRoutes.value = result
  } catch (cause) {
    if (generation === routesGeneration) loadError.value = crmError(cause)
  }
}
async function loadQuotes() {
  const generation = ++quoteGeneration
  const leadId = String(props.lead.id)
  if (!canReadQuotes.value) return
  quotesLoading.value = true
  quoteError.value = ''
  try {
    const result = await crmRequest<CrmPage>(crmPath('leads', leadId, 'quotes') +
      '?page=' + quotePage.value + '&pageSize=25')
    if (generation !== quoteGeneration || leadId !== props.lead.id) return
    quotes.value = result.items ?? []
    quoteTotal.value = result.total ?? 0
  } catch (cause) {
    if (generation === quoteGeneration) quoteError.value = crmError(cause)
  } finally {
    if (generation === quoteGeneration) quotesLoading.value = false
  }
}
async function loadOpportunities() {
  const generation = ++opportunitiesGeneration
  const leadId = String(props.lead.id)
  if (!canReadQuotes.value) return
  try {
    const list = await crmRequest<CrmRow[]>(crmPath('leads', leadId, 'opportunities'))
    if (generation !== opportunitiesGeneration || leadId !== props.lead.id) return
    opportunities.value = list
    if (!list.some(x => x.id === opportunityId.value))
      opportunityId.value = String(list[0]?.id ?? '')
  } catch (cause) {
    if (generation === opportunitiesGeneration) quoteError.value = crmError(cause)
  }
}
function resetAndLoad() {
  ++analysisGeneration; ++routesGeneration; ++quoteGeneration; ++opportunitiesGeneration
  analyses.value = []; selectedAnalysisId.value = ''; analysisRoutes.value = []
  quotes.value = []; quoteTotal.value = 0; quotePage.value = 1
  opportunities.value = []; opportunityId.value = ''
  loadError.value = ''; quoteError.value = ''; error.value = ''; success.value = ''
  void Promise.all([loadAnalyses(), loadQuotes(), loadOpportunities()])
}
watch(() => props.lead.id, resetAndLoad, { immediate: true })
watch(selectedAnalysisId, value => { void loadRoutes(value) })

async function createAnalysis() {
  if (!canManageAnalyses.value || busy.value) return
  if (!newMarket.value) { error.value = 'Seleccioná el mercado desde Config.'; return }
  busy.value = true; error.value = ''; success.value = ''
  try {
    const created = await crmRequest<CrmRow>(crmPath('analyses'), 'POST', {
      accountId: null, leadId: props.lead.id, opportunityId: null, ownerUserId: null,
      marketCode: newMarket.value, customsNationalizationRequired: requiresCustoms.value,
      observations: newObservations.value.trim() || null,
      estimatedMonthlyVolume: newVolume.value ? Number(newVolume.value) : null,
      volumeUnit: newVolume.value ? newVolumeUnit.value : null,
    }, crmUuid())
    selectedAnalysisId.value = String(created.id)
    newMarket.value = ''; newObservations.value = ''; newVolume.value = ''
    await loadAnalyses()
    success.value = 'Análisis comercial agregado al prospecto.'
  } catch (cause) { error.value = crmError(cause) }
  finally { busy.value = false }
}
async function addRoute() {
  if (!canManageAnalyses.value || busy.value || !selectedAnalysisId.value) return
  if (![routeDraft.polCode, routeDraft.poeCode, routeDraft.podCode,
        routeDraft.originCountryCode, routeDraft.destinationCountryCode].some(Boolean)) {
    error.value = 'Seleccioná al menos un puerto o país para registrar la ruta.'
    return
  }
  busy.value = true; error.value = ''; success.value = ''
  try {
    await crmRequest(crmPath('analyses', selectedAnalysisId.value, 'routes'), 'POST', {
      polCode: routeDraft.polCode || null, poeCode: routeDraft.poeCode || null,
      podCode: routeDraft.podCode || null,
      originCountryCode: routeDraft.originCountryCode || null,
      destinationCountryCode: routeDraft.destinationCountryCode || null,
      frequencyPerMonth: routeDraft.frequencyPerMonth ? Number(routeDraft.frequencyPerMonth) : null,
      notes: routeDraft.notes.trim() || null,
    }, crmUuid())
    Object.assign(routeDraft, { polCode: '', poeCode: '', podCode: '',
      originCountryCode: '', destinationCountryCode: '', frequencyPerMonth: '', notes: '' })
    await loadRoutes(selectedAnalysisId.value)
    success.value = 'Ruta vinculada al análisis comercial.'
  } catch (cause) { error.value = crmError(cause) }
  finally { busy.value = false }
}
async function createOpportunity() {
  if (!canCreateOpportunity.value || busy.value || !opportunityTitle.value.trim()) return
  if (!opportunityCurrency.value) { error.value = 'Seleccioná la moneda de Config.'; return }
  busy.value = true; error.value = ''; success.value = ''
  try {
    const created = await crmRequest<CrmRow>(crmPath('opportunities'), 'POST', {
      accountId: null, leadId: props.lead.id, title: opportunityTitle.value.trim(),
      executiveUserId: null, pipelineId: null, stageId: null,
      amountEstimated: 0, currencyCode: opportunityCurrency.value,
      expectedCloseAt: null, description: null,
    }, crmUuid())
    opportunityId.value = String(created.id)
    opportunityTitle.value = ''
    await loadOpportunities()
    success.value = 'Oportunidad creada para vincular cotizaciones.'
  } catch (cause) { error.value = crmError(cause) }
  finally { busy.value = false }
}
async function linkQuote() {
  if (!canLinkQuotes.value || busy.value) return
  if (!opportunityId.value) { error.value = 'Primero seleccioná o creá una oportunidad.'; return }
  if (!uuidPattern.test(quoteId.value) || (requestId.value && !uuidPattern.test(requestId.value))) {
    error.value = 'Ingresá un UUID válido de la cotización de Pricing y, si corresponde, de su solicitud.'
    return
  }
  busy.value = true; error.value = ''; success.value = ''
  try {
    await crmRequest(crmPath('opportunities', opportunityId.value, 'quotes'), 'POST', {
      pricingQuoteId: quoteId.value,
      pricingRequestId: requestId.value || null,
    }, crmUuid())
    quoteId.value = ''; requestId.value = ''
    quotePage.value = 1
    await loadQuotes()
    success.value = 'Cotización vinculada a la oportunidad de este prospecto.'
  } catch (cause) { error.value = crmError(cause) }
  finally { busy.value = false }
}
function quotePageChange(delta: number) {
  const next = quotePage.value + delta
  if (next < 1 || next > quotePages.value) return
  quotePage.value = next
  void loadQuotes()
}
</script>

<template>
  <section v-if="canReadAnalyses" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5 space-y-4" data-crm-lead-analyses>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-base font-extrabold">Análisis comercial del prospecto</h2>
        <p class="text-xs text-[var(--dh-text-muted)]">Registrá mercados, volumen previsto y rutas POL / POE / POD antes de convertirlo en cliente.</p>
      </div>
      <span class="text-xs text-[var(--dh-text-muted)]">{{ analyses.length }} análisis</span>
    </div>
    <p v-if="loadError" role="alert" class="text-sm text-red-500">{{ loadError }}</p>
    <p v-if="analysisLoading" class="text-xs text-[var(--dh-text-muted)]">Cargando análisis…</p>
    <form v-if="canManageAnalyses" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" @submit.prevent="createAnalysis">
      <CrmCatalogPicker v-model="newMarket" label="Mercado (Config) *" catalog-group-slug="crm-markets" value-kind="code" />
      <label class="crm-lead-field">Volumen mensual previsto
        <input v-model="newVolume" class="crm-lead-input" type="number" min="0" step="any" />
      </label>
      <label class="crm-lead-field">Unidad
        <select v-model="newVolumeUnit" class="crm-lead-input">
          <option v-for="unit in ['TEU','CBM','CFT','KG','LB']" :key="unit">{{ unit }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs font-semibold text-[var(--dh-text)]">
        <input v-model="requiresCustoms" type="checkbox" /> Requiere nacionalización
      </label>
      <label class="crm-lead-field sm:col-span-2 xl:col-span-3">Observaciones
        <textarea v-model="newObservations" rows="2" class="crm-lead-input" />
      </label>
      <button class="crm-lead-action self-end" type="submit" :disabled="busy || !newMarket">Agregar análisis</button>
    </form>
    <p v-if="!analyses.length && !analysisLoading" class="text-sm text-[var(--dh-text-muted)]">Sin análisis comercial registrado.</p>
    <template v-if="analyses.length">
      <label class="crm-lead-field max-w-xl">Análisis registrado
        <select v-model="selectedAnalysisId" class="crm-lead-input">
          <option v-for="analysis in analyses" :key="String(analysis.id)" :value="String(analysis.id)">
            {{ String(analysis.marketCode || 'Mercado') }} · {{ String(analysis.estimatedMonthlyVolume ?? '—') }} {{ String(analysis.volumeUnit || '') }}
          </option>
        </select>
      </label>
      <p v-if="chosenAnalysis?.observations" class="whitespace-pre-wrap text-sm">{{ chosenAnalysis.observations }}</p>
      <div class="space-y-2">
        <h3 class="text-sm font-bold">Rutas de este análisis ({{ analysisRoutes.length }})</h3>
        <p v-if="!analysisRoutes.length" class="text-sm text-[var(--dh-text-muted)]">Aún no se han añadido rutas.</p>
        <div v-for="route in analysisRoutes" :key="String(route.id)" class="rounded-xl border border-[var(--dh-border)] p-3 text-sm">
          <strong>{{ String(route.polCode || 'POL —') }} → {{ String(route.poeCode || 'POE —') }} → {{ String(route.podCode || 'POD —') }}</strong>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ String(route.originCountryCode || 'Origen —') }} · {{ String(route.destinationCountryCode || 'Destino —') }} · {{ String(route.frequencyPerMonth ?? '—') }} movimientos/mes</p>
          <p v-if="route.notes" class="mt-1 whitespace-pre-wrap text-xs">{{ route.notes }}</p>
        </div>
      </div>
      <form v-if="canManageAnalyses" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" @submit.prevent="addRoute">
        <CrmCatalogPicker v-model="routeDraft.polCode" label="POL · Puerto origen" catalog-group-slug="pol" value-kind="code" />
        <CrmCatalogPicker v-model="routeDraft.poeCode" label="POE · Puerto entrada" catalog-group-slug="poe" value-kind="code" />
        <CrmCatalogPicker v-model="routeDraft.podCode" label="POD · Puerto destino" catalog-group-slug="pod" value-kind="code" />
        <CrmCatalogPicker v-model="routeDraft.originCountryCode" label="País origen" catalog-group-slug="countries" value-kind="code" />
        <CrmCatalogPicker v-model="routeDraft.destinationCountryCode" label="País destino" catalog-group-slug="countries" value-kind="code" />
        <label class="crm-lead-field">Movimientos por mes
          <input v-model="routeDraft.frequencyPerMonth" class="crm-lead-input" type="number" min="0" step="any" />
        </label>
        <label class="crm-lead-field sm:col-span-2">Notas de la ruta
          <textarea v-model="routeDraft.notes" rows="2" class="crm-lead-input" />
        </label>
        <button type="submit" class="crm-lead-action self-end" :disabled="busy">Añadir ruta</button>
      </form>
    </template>
  </section>

  <section v-if="canReadQuotes" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5 space-y-4" data-crm-lead-quotes>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-base font-extrabold">Cotizaciones del prospecto</h2>
        <p class="text-xs text-[var(--dh-text-muted)]">Cotizaciones de Pricing vinculadas a las oportunidades de este prospecto.</p>
      </div>
      <span class="text-xs text-[var(--dh-text-muted)]">{{ quoteTotal }} cotizaciones</span>
    </div>
    <p v-if="quoteError" role="alert" class="text-sm text-red-500">{{ quoteError }}</p>
    <p v-if="quotesLoading" class="text-xs text-[var(--dh-text-muted)]">Cargando cotizaciones…</p>
    <p v-if="!quotes.length && !quotesLoading" class="text-sm text-[var(--dh-text-muted)]">Todavía no existen cotizaciones vinculadas.</p>
    <div v-for="quote in quotes" :key="String(quote.id)" class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] p-3">
      <div class="min-w-0">
        <RouterLink :to="quoteLink(quote.pricingQuoteId)" class="text-sm font-bold text-[var(--dh-primary)] hover:underline">{{ String(quote.quoteNumberSnapshot || 'Cotización') }}</RouterLink>
        <p class="text-xs text-[var(--dh-text-muted)]">{{ commercialRateStatusLabel(quote.commercialStatusSnapshot, locale) }} · {{ quote.shipmentModeSnapshot }}</p>
        <RouterLink :to="opportunityLink(quote.opportunityId)" class="text-xs text-[var(--dh-primary)] hover:underline">{{ String(quote.opportunityTitle || 'Ver oportunidad') }}</RouterLink>
      </div>
    </div>
    <div v-if="quoteTotal > 25" class="flex items-center justify-end gap-3 text-xs">
      <button type="button" class="crm-lead-action" :disabled="quotePage <= 1" @click="quotePageChange(-1)">Anterior</button>
      <span>{{ quotePage }} / {{ quotePages }}</span>
      <button type="button" class="crm-lead-action" :disabled="quotePage >= quotePages" @click="quotePageChange(1)">Siguiente</button>
    </div>
    <div v-if="canLinkQuotes || canCreateOpportunity" class="space-y-3 border-t border-[var(--dh-border)] pt-4">
      <h3 class="text-sm font-bold">Gestionar cotizaciones</h3>
      <form v-if="canCreateOpportunity" class="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]" @submit.prevent="createOpportunity">
        <label class="crm-lead-field">Nueva oportunidad
          <input v-model="opportunityTitle" class="crm-lead-input" required maxlength="250" placeholder="Nombre de la oportunidad" />
        </label>
        <CrmCatalogPicker v-model="opportunityCurrency" label="Moneda" catalog-group-slug="currencies" value-kind="value" />
        <button class="crm-lead-action self-end" type="submit" :disabled="busy || !opportunityTitle.trim()">Crear oportunidad</button>
      </form>
      <form v-if="canLinkQuotes" class="grid gap-3 sm:grid-cols-2" @submit.prevent="linkQuote">
        <label class="crm-lead-field sm:col-span-2">Oportunidad a la que se vincula la cotización
          <select v-model="opportunityId" class="crm-lead-input" required>
            <option value="">Seleccionar oportunidad</option>
            <option v-for="opportunity in opportunities" :key="String(opportunity.id)" :value="String(opportunity.id)">
              {{ String(opportunity.title || opportunity.id) }}
            </option>
          </select>
        </label>
        <label class="crm-lead-field">UUID de cotización de Pricing
          <input v-model.trim="quoteId" class="crm-lead-input" required placeholder="ID de la QUO" />
        </label>
        <label class="crm-lead-field">UUID de solicitud de Pricing (opcional)
          <input v-model.trim="requestId" class="crm-lead-input" placeholder="ID de solicitud" />
        </label>
        <p class="text-xs text-[var(--dh-text-muted)] sm:col-span-2">
          La cotización debe existir en Pricing. CRM valida la cotización y los permisos comerciales antes de vincularla.
          {{ selectedOpportunity ? 'Oportunidad seleccionada: ' + String(selectedOpportunity.title) : '' }}
        </p>
        <button type="submit" class="crm-lead-action justify-self-start sm:col-span-2" :disabled="busy || !opportunityId || !quoteId">Vincular cotización</button>
      </form>
    </div>
  </section>
  <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
  <p v-if="success" role="status" class="text-sm text-emerald-600">{{ success }}</p>
</template>

<style scoped>
.crm-lead-field{display:flex;flex-direction:column;gap:.45rem;font-size:.78rem;font-weight:700;color:var(--dh-text-muted)}
.crm-lead-input{min-width:0;width:100%;min-height:42px;background:var(--dh-input);color:var(--dh-text);border:1px solid var(--dh-border);border-radius:.75rem;padding:.6rem;font-size:.9rem;font-weight:500}
.crm-lead-action{border:1px solid var(--dh-border);border-radius:.75rem;padding:.65rem .95rem;font-size:.82rem;font-weight:700;min-height:42px;color:var(--dh-text)}
.crm-lead-action:disabled{opacity:.45}
</style>
