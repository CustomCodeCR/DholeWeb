<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchClient } from '@/core/api/fetchConfig'

type Quote = {
  pricingQuoteId: string
  quoteNumberSnapshot: string
  clientName?: string | null
  shipmentModeSnapshot: string
  commercialStatusSnapshot: string
  linkedAt: string
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
const name = ref('')
const quotes = ref<Quote[]>([])
const candidates = ref<Quote[]>([])
const selected = ref<string[]>([])
const confirmed = ref(false)
const quotesPage = ref(1)
const candidatesPage = ref(1)
const quotesTotal = ref(0)
const candidatesTotal = ref(0)
const busy = ref(false)
const loading = ref(false)
const error = ref('')
const success = ref('')
const ready = computed(() => selected.value.length > 0 && confirmed.value && !busy.value)
const base = '/api/pricing/rates'
let requestGeneration = 0

async function refresh() {
  const generation = ++requestGeneration
  loading.value = true
  error.value = ''
  try {
    const query = new URLSearchParams({ page: String(quotesPage.value), pageSize: '20' })
    const result = await fetchClient<Page<Quote>>(
      base + '/crm-account/' + encodeURIComponent(props.accountId) + '?' + query, { method: 'GET' })
    if (generation !== requestGeneration) return
    quotes.value = result.items || []
    quotesTotal.value = result.total || 0
  } catch (cause) {
    if (generation !== requestGeneration) return
    quotes.value = []
    error.value = cause instanceof Error ? cause.message : 'No fue posible consultar Pricing.'
  } finally {
    if (generation === requestGeneration) loading.value = false
  }
}
async function searchLegacy() {
  if (name.value.trim().length < 3) {
    error.value = 'Indique el nombre histórico completo para buscar coincidencias exactas.'
    return
  }
  busy.value = true
  error.value = ''
  success.value = ''
  selected.value = []
  confirmed.value = false
  try {
    const query = new URLSearchParams({
      clientName: name.value.trim(), page: String(candidatesPage.value), pageSize: '30',
    })
    const result = await fetchClient<Page<Quote>>(base + '/crm-legacy-candidates?' + query, { method: 'GET' })
    candidates.value = result.items || []
    candidatesTotal.value = result.total || 0
  } catch (cause) {
    candidates.value = []
    error.value = cause instanceof Error ? cause.message : 'No se pudo consultar el historial.'
  } finally { busy.value = false }
}
function toggle(id: string, checked: boolean) {
  selected.value = checked ? [...selected.value, id] : selected.value.filter(x => x !== id)
  confirmed.value = false
}
async function reconcile() {
  if (!ready.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await fetchClient<{ linked: number; total: number }>(
      base + '/crm-legacy-reconcile', {
        method: 'POST', body: {
          accountId: props.accountId, clientName: name.value.trim(), rateIds: [...selected.value],
        },
      })
    success.value = `${result.linked} cotización(es) vinculada(s). Se conservaron sus montos, fechas y revisiones.`
    selected.value = []
    confirmed.value = false
    candidatesPage.value = 1
    await Promise.all([refresh(), searchLegacy()])
    emit('changed')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudieron vincular las cotizaciones.'
  } finally { busy.value = false }
}
watch(() => [props.accountId, props.clientName], () => {
  name.value = props.clientName
  quotesPage.value = 1
  candidatesPage.value = 1
  candidatesTotal.value = 0
  candidates.value = []
  selected.value = []
  confirmed.value = false
  success.value = ''
  void refresh()
}, { immediate: true })
watch(quotesPage, () => { void refresh() })
watch(candidatesPage, () => { void searchLegacy() })
</script>

<template>
  <section class="space-y-4 rounded-2xl border border-[var(--dh-border)] p-4" aria-label="Cotizaciones de Pricing vinculadas al CRM">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-extrabold">{{ view === 'history' ? 'Historial de cotizaciones Pricing' : 'Cotizaciones por identidad CRM' }}</h3>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Vinculadas por ID de cuenta; no se asignan por similitud del nombre.</p>
      </div>
      <button type="button" class="hub-outline-button hub-small" :disabled="loading" @click="refresh">Actualizar</button>
    </div>
    <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
    <p v-if="success" role="status" class="text-sm text-[var(--dh-primary)]">{{ success }}</p>
    <p v-if="loading" class="text-sm text-[var(--dh-text-muted)]">Consultando cotizaciones…</p>
    <div v-else-if="quotes.length" class="overflow-x-auto">
      <table class="w-full min-w-[520px] text-left text-sm">
        <thead><tr class="border-b border-[var(--dh-border)] text-xs uppercase"><th class="py-2">QUO</th><th>Modalidad</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead>
        <tbody><tr v-for="quote in quotes" :key="quote.pricingQuoteId" class="border-b border-[var(--dh-border)]">
          <td class="py-2 font-bold">{{ quote.quoteNumberSnapshot }}</td>
          <td>{{ quote.shipmentModeSnapshot }}</td><td>{{ quote.commercialStatusSnapshot }}</td>
          <td>{{ quote.linkedAt ? new Date(quote.linkedAt).toLocaleDateString('es-CR') : '—' }}</td>
          <td><RouterLink class="hub-text-link" :to="'/pricing/rates?rateId=' + encodeURIComponent(quote.pricingQuoteId)">Abrir</RouterLink></td>
        </tr></tbody>
      </table>
    </div>
    <p v-else-if="!loading" class="text-xs text-[var(--dh-text-muted)]">No hay cotizaciones asociadas por ID a esta cuenta.</p>
    <div v-if="quotesTotal > 20" class="flex items-center justify-end gap-3 text-xs">
      <button type="button" class="hub-outline-button hub-small" :disabled="quotesPage === 1 || loading" @click="quotesPage--">Anterior</button>
      <span>{{ quotesPage }} · {{ quotesTotal }} cotizaciones</span>
      <button type="button" class="hub-outline-button hub-small" :disabled="quotesPage * 20 >= quotesTotal || loading" @click="quotesPage++">Siguiente</button>
    </div>
    <details class="border-t border-[var(--dh-border)] pt-3">
      <summary class="cursor-pointer text-sm font-bold">Migrar cotizaciones antiguas al nuevo cliente CRM</summary>
      <p class="my-3 text-xs text-[var(--dh-text-muted)]">Busque el nombre usado en las QUO antiguas. Revise los registros y confirme cada vínculo; no se modifican importes ni estados comerciales.</p>
      <div class="flex flex-wrap gap-2">
        <label class="min-w-[220px] flex-1 text-xs font-bold">Nombre histórico del cliente
          <input v-model="name" class="crm-input mt-1 w-full" maxlength="220" placeholder="Nombre exacto en las cotizaciones" @input="candidates=[];selected=[];confirmed=false;candidatesPage=1" />
        </label>
        <button type="button" class="hub-outline-button self-end" :disabled="busy || name.trim().length < 3" @click="candidatesPage=1;searchLegacy()">Buscar QUO antiguas</button>
      </div>
      <p v-if="candidatesTotal" class="my-3 text-xs">{{ candidatesTotal }} candidata(s) sin vínculo de cuenta/prospecto CRM.</p>
      <div v-if="candidates.length" class="mt-2 max-h-64 space-y-2 overflow-y-auto">
        <label v-for="quote in candidates" :key="quote.pricingQuoteId" class="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--dh-border)] p-3 text-xs">
          <input type="checkbox" class="mt-1" :checked="selected.includes(quote.pricingQuoteId)" :disabled="busy" @change="toggle(quote.pricingQuoteId, ($event.target as HTMLInputElement).checked)" />
          <span><strong>{{ quote.quoteNumberSnapshot }}</strong> · {{ quote.clientName }}<span class="block mt-1 text-[var(--dh-text-muted)]">{{ quote.shipmentModeSnapshot }} · {{ quote.polName || 'Sin POL' }} → {{ quote.podName || quote.poeName || 'Sin destino' }} · {{ quote.commercialStatusSnapshot }}</span></span>
        </label>
      </div>
      <div v-if="candidatesTotal > 30" class="my-3 flex items-center justify-end gap-3 text-xs">
        <button type="button" class="hub-outline-button hub-small" :disabled="candidatesPage === 1 || busy" @click="candidatesPage--">Anterior</button>
        <span>{{ candidatesPage }}</span>
        <button type="button" class="hub-outline-button hub-small" :disabled="candidatesPage * 30 >= candidatesTotal || busy" @click="candidatesPage++">Siguiente</button>
      </div>
      <div v-if="selected.length" class="mt-4 space-y-3">
        <label class="flex items-start gap-2 text-xs"><input v-model="confirmed" type="checkbox" class="mt-0.5" />
          <span>Confirmo que las {{ selected.length }} QUO seleccionadas corresponden a esta cuenta CRM y que verifiqué su identidad.</span>
        </label>
        <button type="button" class="crm-action" :disabled="!ready" @click="reconcile">{{ busy ? 'Vinculando…' : 'Vincular ' + selected.length + ' cotización(es)' }}</button>
      </div>
    </details>
  </section>
</template>
