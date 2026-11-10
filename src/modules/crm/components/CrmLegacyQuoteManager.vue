<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchClient } from '@/core/api/fetchConfig'
import { commercialRateStatusLabel } from '@/modules/pricing/utils/pricingFormat'
import { DhDataTable, DhPagination } from '@/shared/components/molecules'

type Quote = Record<string, unknown> & {
  pricingQuoteId: string
  quoteNumberSnapshot: string
  clientName?: string | null
  clientAccountId?: string | null
  clientLeadId?: string | null
  shipmentModeSnapshot: string
  commercialStatusSnapshot: string
  createdAtUtc?: string | null
  linkedAt?: string | null
  polName?: string | null
  poeName?: string | null
  podName?: string | null
}
type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

const props = withDefaults(defineProps<{
  accountId: string
  clientName: string
  executiveName?: string
  view?: 'quotes' | 'history'
}>(), { view: 'quotes' })
const emit = defineEmits<{ changed: [] }>()
const base = '/api/pricing/rates'
const { locale } = useI18n()

const quotes = ref<Quote[]>([])
const quotesPage = ref(1)
const quotesPageSize = ref(10)
const quotesTotal = ref(0)
const linkedLoading = ref(false)
const catalog = ref<Quote[]>([])
const catalogTotal = ref(0)
const catalogPage = ref(1)
const catalogPageSize = ref(10)
const catalogSearch = ref('')
const appliedSearch = ref('')
const catalogLoading = ref(false)
const selected = ref<string[]>([])
const confirmed = ref(false)
const busy = ref(false)
const selectionLoading = ref(false)
const error = ref('')
const success = ref('')
let linkedRequestGeneration = 0
let catalogRequestGeneration = 0

const catalogRows = computed(() => catalog.value.map(quote => ({
  ...quote,
  id: quote.pricingQuoteId,
  actions: '',
  route: '',
  linkState: '',
  select: '',
})))
const linkedRows = computed(() => quotes.value.map(quote => ({
  ...quote, id: quote.pricingQuoteId, actions: '',
})))
const catalogColumns = [
  { key: 'select', label: 'Seleccionar', width: '7%' },
  { key: 'quoteNumberSnapshot', label: 'N.º de QUO' },
  { key: 'clientName', label: 'Cliente histórico' },
  { key: 'route', label: 'Ruta' },
  { key: 'shipmentModeSnapshot', label: 'Modalidad' },
  { key: 'createdAtUtc', label: 'Fecha' },
  { key: 'commercialStatusSnapshot', label: 'Estado' },
  { key: 'actions', label: 'Acciones' },
]
const linkedColumns = [
  { key: 'quoteNumberSnapshot', label: 'QUO' },
  { key: 'clientName', label: 'Cliente CRM' },
  { key: 'executiveName', label: 'Ejecutivo' },
  { key: 'shipmentModeSnapshot', label: 'Modalidad' },
  { key: 'commercialStatusSnapshot', label: 'Estado' },
  { key: 'linkedAt', label: 'Fecha' },
  { key: 'actions', label: 'Acciones' },
]
const pageSelectable = computed(() => catalog.value.filter(canSelect).map(quote => quote.pricingQuoteId))
const allPageSelected = computed(() => pageSelectable.value.length > 0 &&
  pageSelectable.value.every(id => selected.value.includes(id)))
const ready = computed(() => selected.value.length > 0 && selected.value.length <= 1000 &&
  confirmed.value && !busy.value && !selectionLoading.value)
const canSelect = (quote: Quote) => !quote.clientAccountId && !quote.clientLeadId
const quoteUrl = (quote: Quote) => '/pricing/rates?rateId=' + encodeURIComponent(quote.pricingQuoteId)
function formatDate(value?: string | null) {
  if (!value) return '—'
  const time = new Date(value)
  return Number.isNaN(time.getTime()) ? '—' : time.toLocaleDateString('es-CR')
}
function clearSelection() {
  selected.value = []
  confirmed.value = false
}
function toggle(id: string, checked: boolean) {
  selected.value = checked ? [...new Set([...selected.value, id])] : selected.value.filter(value => value !== id)
  confirmed.value = false
}
function selectCurrentPage() {
  const ids = pageSelectable.value
  selected.value = allPageSelected.value
    ? selected.value.filter(id => !ids.includes(id))
    : [...new Set([...selected.value, ...ids])]
  confirmed.value = false
}
// "Seleccionar todos" spans every page of the current search. Require a specific
// filter: otherwise this operation could attach other companies' historical quotes.
async function selectAllMatching() {
  const query = appliedSearch.value.trim()
  if (!query || catalogTotal.value < 1 || catalogTotal.value > 1000 ||
      busy.value || selectionLoading.value) return
  selectionLoading.value = true
  error.value = ''
  confirmed.value = false
  const expectedAccount = props.accountId
  try {
    const result: Quote[] = []
    for (let page = 1; page <= Math.ceil(catalogTotal.value / 100); page++) {
      const params = new URLSearchParams({ q: query, linkStatus: 'unlinked',
        page: String(page), pageSize: '100' })
      const data = await fetchClient<Page<Quote>>(base + '/crm-legacy-catalog?' + params, { method: 'GET' })
      if (props.accountId !== expectedAccount || appliedSearch.value !== query)
        throw new Error('Cambió la cuenta o búsqueda. Vuelva a seleccionar las QUO.')
      if (data.total > 1000 || data.total !== catalogTotal.value)
        throw new Error('Cambió la lista de pendientes. Actualice antes de seleccionarlas.')
      result.push(...(data.items || []).filter(canSelect))
    }
    if (result.length !== catalogTotal.value)
      throw new Error('Algunas QUO ya se vincularon. Actualice la lista antes de continuar.')
    selected.value = [...new Set(result.map(quote => quote.pricingQuoteId))]
  } catch (cause) {
    clearSelection()
    error.value = cause instanceof Error ? cause.message : 'No se pudieron seleccionar todas las QUO.'
  } finally {
    selectionLoading.value = false
  }
}

async function refresh() {
  const generation = ++linkedRequestGeneration
  linkedLoading.value = true
  try {
    const params = new URLSearchParams({
      page: String(quotesPage.value), pageSize: String(quotesPageSize.value),
    })
    const result = await fetchClient<Page<Quote>>(
      base + '/crm-account/' + encodeURIComponent(props.accountId) + '?' + params, { method: 'GET' })
    if (generation !== linkedRequestGeneration) return
    quotes.value = result.items || []
    quotesTotal.value = result.total || 0
  } catch (cause) {
    if (generation !== linkedRequestGeneration) return
    quotes.value = []
    error.value = cause instanceof Error ? cause.message : 'No fue posible consultar las cotizaciones vinculadas.'
  } finally {
    if (generation === linkedRequestGeneration) linkedLoading.value = false
  }
}
async function searchLegacy() {
  const generation = ++catalogRequestGeneration
  catalogLoading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      q: appliedSearch.value,
      linkStatus: 'unlinked',
      page: String(catalogPage.value),
      pageSize: String(catalogPageSize.value),
    })
    const result = await fetchClient<Page<Quote>>(base + '/crm-legacy-catalog?' + params, { method: 'GET' })
    if (generation !== catalogRequestGeneration) return
    catalog.value = result.items || []
    catalogTotal.value = result.total || 0
    // Reconcile can empty the last page. Move to the actual last page rather
    // than leaving a blank view when there are still older pending quotations.
    if (!catalog.value.length && catalogPage.value > 1 && catalogTotal.value > 0) {
      catalogPage.value = Math.max(1, Math.ceil(catalogTotal.value / catalogPageSize.value))
      void searchLegacy()
    }
  } catch (cause) {
    if (generation !== catalogRequestGeneration) return
    catalog.value = []
    catalogTotal.value = 0
    error.value = cause instanceof Error ? cause.message : 'No fue posible consultar todas las QUO.'
  } finally {
    if (generation === catalogRequestGeneration) catalogLoading.value = false
  }
}
function applyCatalogFilters() {
  clearSelection()
  appliedSearch.value = catalogSearch.value.trim()
  catalogPage.value = 1
  void searchLegacy()
}
function changeCatalogPage(page: number) {
  if (page === catalogPage.value) return
  catalogPage.value = page
  void searchLegacy()
}
function changeCatalogPageSize(pageSize: number) {
  catalogPageSize.value = pageSize
  catalogPage.value = 1
  void searchLegacy()
}
function changeLinkedPage(page: number) {
  if (page === quotesPage.value) return
  quotesPage.value = page
  void refresh()
}
function changeLinkedPageSize(pageSize: number) {
  quotesPageSize.value = pageSize
  quotesPage.value = 1
  void refresh()
}
async function reloadAll() {
  await Promise.all([refresh(), searchLegacy()])
}
async function syncLinkedClient() {
  if (busy.value || !props.accountId || !props.clientName.trim()) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await fetchClient<{ updated: number; total: number }>(
      base + '/crm-account/' + encodeURIComponent(props.accountId) + '/sync-client', {
        method: 'POST',
        body: {
          clientName: props.clientName,
          executiveName: props.executiveName || null,
          confirmedForAccount: true,
        },
      })
    await reloadAll()
    success.value = `Datos del CRM sincronizados en ${result.total} QUO vinculada(s); ${result.updated} actualizada(s).`
    emit('changed')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No fue posible actualizar el cliente en las tarifas.'
  } finally {
    busy.value = false
  }
}
async function reconcile() {
  if (!ready.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await fetchClient<{ linked: number; total: number }>(
      base + '/crm-legacy-reconcile', {
        method: 'POST',
        body: {
          accountId: props.accountId,
          clientName: props.clientName,
          executiveName: props.executiveName || null,
          rateIds: [...selected.value],
          confirmedForAccount: true,
        },
      })
    clearSelection()
    quotesPage.value = 1
    catalogPage.value = 1
    await reloadAll()
    success.value = `${result.linked} QUO vinculada(s) a ${props.clientName}. Ya no aparecen entre las pendientes; la tarifa muestra ahora el cliente CRM y el ejecutivo asignado.`
    emit('changed')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron vincular las cotizaciones.'
  } finally {
    busy.value = false
  }
}
watch(() => [props.accountId, props.clientName], () => {
  quotesPage.value = 1
  catalogPage.value = 1
  catalogSearch.value = ''
  appliedSearch.value = ''
  clearSelection()
  success.value = ''
  void reloadAll()
}, { immediate: true })
</script>

<template>
  <section class="space-y-4 rounded-2xl border border-[var(--dh-border)] p-4" aria-label="Todas las cotizaciones de Pricing para CRM">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-extrabold">Historial de cotizaciones Pricing</h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Cotizaciones históricas que aún no tienen cuenta o prospecto CRM. Seleccione las que pertenecen a
          <strong>{{ clientName }}</strong>; al vincularlas dejarán esta lista y aparecerán en el historial del cliente y en Pricing con sus datos CRM.
        </p>
      </div>
      <button type="button" class="hub-outline-button hub-small" :disabled="catalogLoading || linkedLoading || busy" @click="reloadAll">
        Actualizar
      </button>
    </div>

    <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="text-sm text-[var(--dh-primary)]">{{ success }}</p>

    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label class="block min-w-0 text-xs font-bold">Buscar QUO, cliente histórico o ruta
        <input v-model="catalogSearch" class="crm-input mt-1 w-full" maxlength="200"
          placeholder="Número de QUO, cliente, POL, POE o POD..." @keyup.enter.prevent="applyCatalogFilters" />
      </label>
      <button type="button" class="hub-outline-button" :disabled="catalogLoading" @click="applyCatalogFilters">Buscar</button>
    </div>
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <button type="button" class="hub-outline-button hub-small" :disabled="!pageSelectable.length || catalogLoading || busy || selectionLoading"
        @click="selectCurrentPage">
        {{ allPageSelected ? 'Deseleccionar página' : 'Seleccionar toda la página (' + pageSelectable.length + ')' }}
      </button>
      <button type="button" class="hub-outline-button hub-small"
        :disabled="!appliedSearch.trim() || catalogTotal < 1 || catalogTotal > 1000 || catalogLoading || busy || selectionLoading"
        @click="selectAllMatching">
        {{ selectionLoading ? 'Seleccionando…' : 'Seleccionar todos los resultados (' + catalogTotal + ')' }}
      </button>
      <button v-if="selected.length" type="button" class="hub-text-link" :disabled="busy || selectionLoading"
        @click="clearSelection">Limpiar selección ({{ selected.length }})</button>
      <p class="text-[var(--dh-text-muted)]">Para seleccionar entre varias páginas, busque primero el cliente o identificación.
        Solo se seleccionan QUO sin vincular (máximo 1000 por operación).</p>
    </div>

    <DhDataTable :columns="catalogColumns" :rows="catalogRows" :loading="catalogLoading"
      empty-text="No quedan QUO pendientes con esta búsqueda. Las ya vinculadas están en el historial de su cuenta CRM.">
      <template #cell-select="{ row }">
        <input type="checkbox" :aria-label="'Seleccionar ' + row.quoteNumberSnapshot"
          :checked="selected.includes(row.pricingQuoteId)" :disabled="!canSelect(row) || busy || selectionLoading"
          @change="toggle(row.pricingQuoteId, ($event.target as HTMLInputElement).checked)" />
      </template>
      <template #cell-quoteNumberSnapshot="{ row }">
        <RouterLink :to="quoteUrl(row)" class="hub-text-link font-extrabold">{{ row.quoteNumberSnapshot }}</RouterLink>
      </template>
      <template #cell-clientName="{ row }">
        <span>{{ row.clientName || 'Sin cliente histórico' }}</span>
      </template>
      <template #cell-route="{ row }">
        <span class="text-xs">{{ row.polName || 'Sin POL' }} → {{ row.podName || row.poeName || 'Sin destino' }}</span>
      </template>
      <template #cell-createdAtUtc="{ row }">{{ formatDate(row.createdAtUtc) }}</template>
      <template #cell-commercialStatusSnapshot="{ row }">{{ commercialRateStatusLabel(row.commercialStatusSnapshot, locale) }}</template>
      <template #cell-actions="{ row }">
        <button v-if="canSelect(row)" type="button" class="hub-outline-button hub-small"
          :disabled="busy || selectionLoading" @click="toggle(row.pricingQuoteId, !selected.includes(row.pricingQuoteId))">
          {{ selected.includes(row.pricingQuoteId) ? 'Quitar' : 'Seleccionar' }}
        </button>
        <RouterLink v-else :to="quoteUrl(row)" class="hub-text-link">Abrir</RouterLink>
      </template>
    </DhDataTable>

    <DhPagination v-if="catalogTotal > 0" :page="catalogPage" :page-size="catalogPageSize"
      :total="catalogTotal" :class="catalogLoading ? 'pointer-events-none opacity-60' : ''"
      @update:page="changeCatalogPage" @update:page-size="changeCatalogPageSize" />

    <div v-if="selected.length" class="space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
      <p class="text-sm font-bold">{{ selected.length }} QUO seleccionada(s) para {{ clientName }}</p>
      <p class="text-xs text-[var(--dh-text-muted)]">Revise que todas las cotizaciones seleccionadas pertenezcan a este cliente antes de vincularlas; la selección masiva no comprueba nombres automáticamente.</p>
      <label class="flex items-start gap-2 text-xs">
        <input v-model="confirmed" type="checkbox" class="mt-0.5" />
        <span>Confirmo que revisé cada QUO seleccionada, su cliente histórico y su ruta, y que todas corresponden a esta cuenta CRM. Esta acción no modifica valores comerciales ni reasigna cotizaciones de otras cuentas.</span>
      </label>
      <button type="button" class="crm-action" :disabled="!ready" @click="reconcile">
        {{ busy ? 'Vinculando…' : 'Vincular ' + selected.length + ' QUO a este cliente' }}
      </button>
    </div>

    <details class="border-t border-[var(--dh-border)] pt-3">
      <summary class="cursor-pointer text-sm font-bold">
        Cotizaciones vinculadas a esta cuenta ({{ quotesTotal }})
      </summary>
      <div class="mt-3 space-y-3">
        <button type="button" class="hub-outline-button hub-small" :disabled="busy || linkedLoading || !quotesTotal || !clientName.trim()" @click="syncLinkedClient">
          Sincronizar cliente y ejecutivo CRM en tarifas existentes
        </button>
        <DhDataTable :columns="linkedColumns" :rows="linkedRows" :loading="linkedLoading"
          empty-text="Esta cuenta todavía no tiene cotizaciones vinculadas.">
          <template #cell-quoteNumberSnapshot="{ row }">
            <RouterLink class="hub-text-link font-bold" :to="quoteUrl(row)">{{ row.quoteNumberSnapshot }}</RouterLink>
          </template>
          <template #cell-linkedAt="{ row }">{{ formatDate(row.linkedAt) }}</template>
          <template #cell-commercialStatusSnapshot="{ row }">{{ commercialRateStatusLabel(row.commercialStatusSnapshot, locale) }}</template>
          <template #cell-actions="{ row }">
            <RouterLink class="hub-text-link" :to="quoteUrl(row)">Abrir</RouterLink>
          </template>
        </DhDataTable>
        <DhPagination v-if="quotesTotal > 0" :page="quotesPage" :page-size="quotesPageSize"
          :total="quotesTotal" :class="linkedLoading ? 'pointer-events-none opacity-60' : ''"
          @update:page="changeLinkedPage" @update:page-size="changeLinkedPageSize" />
      </div>
    </details>
  </section>
</template>
