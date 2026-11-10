<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchClient } from '@/core/api/fetchConfig'
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
  view?: 'quotes' | 'history'
}>(), { view: 'quotes' })
const emit = defineEmits<{ changed: [] }>()
const base = '/api/pricing/rates'

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
const linkStatus = ref<'all' | 'unlinked' | 'linked'>('all')
const catalogLoading = ref(false)
const selected = ref<string[]>([])
const confirmed = ref(false)
const busy = ref(false)
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
  { key: 'linkState', label: 'Vinculación' },
  { key: 'actions', label: 'Acciones' },
]
const linkedColumns = [
  { key: 'quoteNumberSnapshot', label: 'QUO' },
  { key: 'shipmentModeSnapshot', label: 'Modalidad' },
  { key: 'commercialStatusSnapshot', label: 'Estado' },
  { key: 'linkedAt', label: 'Fecha' },
  { key: 'actions', label: 'Acciones' },
]
const ready = computed(() => selected.value.length > 0 && confirmed.value && !busy.value &&
  selected.value.every(id => catalog.value.some(quote =>
    quote.pricingQuoteId === id && !quote.clientAccountId && !quote.clientLeadId)))
const canSelect = (quote: Quote) => !quote.clientAccountId && !quote.clientLeadId
const linkedToThisAccount = (quote: Quote) =>
  quote.clientAccountId?.toLowerCase() === props.accountId.toLowerCase()
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
  clearSelection()
  error.value = ''
  try {
    const params = new URLSearchParams({
      q: appliedSearch.value,
      linkStatus: linkStatus.value,
      page: String(catalogPage.value),
      pageSize: String(catalogPageSize.value),
    })
    const result = await fetchClient<Page<Quote>>(base + '/crm-legacy-catalog?' + params, { method: 'GET' })
    if (generation !== catalogRequestGeneration) return
    catalog.value = result.items || []
    catalogTotal.value = result.total || 0
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
          clientName: '',
          rateIds: [...selected.value],
          confirmedForAccount: true,
        },
      })
    clearSelection()
    quotesPage.value = 1
    await reloadAll()
    success.value = `${result.linked} cotización(es) vinculada(s) a ${props.clientName}. Se conservaron importes, fechas, revisiones y estado comercial.`
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
  linkStatus.value = 'all'
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
          Todas las QUO creadas hasta la fecha, incluidas las ya vinculadas. Seleccione las que pertenecen a
          <strong>{{ clientName }}</strong> para completar su identidad CRM; no se modifican importes ni estados.
        </p>
      </div>
      <button type="button" class="hub-outline-button hub-small" :disabled="catalogLoading || linkedLoading || busy" @click="reloadAll">
        Actualizar
      </button>
    </div>

    <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="text-sm text-[var(--dh-primary)]">{{ success }}</p>

    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
      <label class="block min-w-0 text-xs font-bold">Buscar QUO, cliente histórico o ruta
        <input v-model="catalogSearch" class="crm-input mt-1 w-full" maxlength="200"
          placeholder="Número de QUO, cliente, POL, POE o POD..." @keyup.enter.prevent="applyCatalogFilters" />
      </label>
      <label class="block text-xs font-bold">Vinculación
        <select v-model="linkStatus" class="crm-input mt-1 w-full" @change="applyCatalogFilters">
          <option value="all">Todas las QUO</option>
          <option value="unlinked">Sin vincular</option>
          <option value="linked">Ya vinculadas</option>
        </select>
      </label>
      <button type="button" class="hub-outline-button" :disabled="catalogLoading" @click="applyCatalogFilters">Buscar</button>
    </div>

    <DhDataTable :columns="catalogColumns" :rows="catalogRows" :loading="catalogLoading"
      empty-text="No se encontraron QUO con estos filtros.">
      <template #cell-select="{ row }">
        <input type="checkbox" :aria-label="'Seleccionar ' + row.quoteNumberSnapshot"
          :checked="selected.includes(row.pricingQuoteId)" :disabled="!canSelect(row) || busy"
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
      <template #cell-linkState="{ row }">
        <span v-if="linkedToThisAccount(row)" class="text-xs font-bold text-[var(--dh-primary)]">Esta cuenta</span>
        <span v-else-if="row.clientAccountId || row.clientLeadId" class="text-xs text-[var(--dh-text-muted)]">
          {{ row.clientLeadId ? 'Prospecto CRM' : 'Otra cuenta CRM' }}
        </span>
        <span v-else class="text-xs">Sin vincular</span>
      </template>
      <template #cell-actions="{ row }">
        <button v-if="canSelect(row)" type="button" class="hub-outline-button hub-small"
          :disabled="busy" @click="toggle(row.pricingQuoteId, !selected.includes(row.pricingQuoteId))">
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
        Cotizaciones ya vinculadas a esta cuenta ({{ quotesTotal }})
      </summary>
      <div class="mt-3 space-y-3">
        <DhDataTable :columns="linkedColumns" :rows="linkedRows" :loading="linkedLoading"
          empty-text="Esta cuenta todavía no tiene cotizaciones vinculadas.">
          <template #cell-quoteNumberSnapshot="{ row }">
            <RouterLink class="hub-text-link font-bold" :to="quoteUrl(row)">{{ row.quoteNumberSnapshot }}</RouterLink>
          </template>
          <template #cell-linkedAt="{ row }">{{ formatDate(row.linkedAt) }}</template>
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
