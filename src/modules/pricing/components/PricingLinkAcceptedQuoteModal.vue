<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchClient } from '@/core/api/fetchConfig'
import { DhButton, DhInput } from '@/shared/components/atoms'
import type { RateDto } from '@/core/interfaces/pricing'
import { PricingService } from '@/core/services/pricingService'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'

interface QuoteChoice {
  id: string
  number: string
  status: 'Sent' | 'AcceptedByClient'
  mode: string
  route: string
}
interface CrmQuoteRow {
  pricingQuoteId: string
  quoteNumberSnapshot?: string | null
  commercialStatusSnapshot?: string | null
  shipmentModeSnapshot?: string | null
  polName?: string | null
  poeName?: string | null
  podName?: string | null
  clientAccountId?: string | null
  clientLeadId?: string | null
}
interface ClientQuotePage { items: CrmQuoteRow[]; total: number }

const props = defineProps<{
  rateId: string
  onLinked?: () => void | Promise<void>
}>()

const authStore = useAuthStore()
const modalStore = useModalStore()
const toastStore = useToastStore()
const source = ref<RateDto | null>(null)
const loading = ref(true)
const loadingCandidates = ref(false)
const saving = ref(false)
const search = ref('')
const selectedRateId = ref('')
const candidateRates = ref<QuoteChoice[]>([])
const errorMessage = ref('')

const allowedStatuses = new Set([
  'Open', 'Sent', 'RequestedByClient', 'Expired', 'RejectedByClient', 'Closed', 'QUOVinculada',
])
const canEdit = computed(() =>
  authStore.hasScope(PRICING_SCOPES.rates.update)
  || authStore.hasScope(PRICING_SCOPES.rates.approveLowMargin),
)
const canLink = computed(() =>
  Boolean(source.value
    && allowedStatuses.has(source.value.status)
    && !(source.value.rateType === 'Tariff'
      && String(source.value.clientName ?? '').toLocaleUpperCase().includes('TARIFARIO')))
  && canEdit.value,
)

function sameClient(a: RateDto, b: RateDto): boolean {
  if (a.clientAccountId || b.clientAccountId)
    return Boolean(a.clientAccountId && a.clientAccountId === b.clientAccountId)
  if (a.clientLeadId || b.clientLeadId)
    return Boolean(a.clientLeadId && a.clientLeadId === b.clientLeadId)
  return Boolean(a.clientName?.trim() &&
    a.clientName.trim().toLocaleUpperCase() === b.clientName?.trim().toLocaleUpperCase())
}

const selectedQuote = computed(() => candidateRates.value.find(rate => rate.id === selectedRateId.value))
const canConfirm = computed(() =>
  Boolean(selectedQuote.value?.status === 'AcceptedByClient' && canLink.value && !saving.value),
)
const filteredQuotes = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return candidateRates.value.filter(rate =>
    !term || [rate.number, rate.mode, rate.route, rate.status].join(' ').toLocaleLowerCase().includes(term))
})

function routeLabel(pol?: string | null, poe?: string | null, pod?: string | null): string {
  return [pol, poe, pod].filter(Boolean).join(' → ') || 'Sin ruta'
}

function fromCrmQuote(rate: CrmQuoteRow): QuoteChoice | null {
  if (!source.value || rate.pricingQuoteId === source.value.id) return null
  if (source.value.clientAccountId && source.value.clientAccountId !== rate.clientAccountId) return null
  if (source.value.clientLeadId && source.value.clientLeadId !== rate.clientLeadId) return null
  if (rate.commercialStatusSnapshot !== 'Sent' && rate.commercialStatusSnapshot !== 'AcceptedByClient') return null
  return {
    id: rate.pricingQuoteId,
    number: rate.quoteNumberSnapshot || 'QUO sin número',
    status: rate.commercialStatusSnapshot,
    mode: rate.shipmentModeSnapshot || 'Sin modalidad',
    route: routeLabel(rate.polName, rate.poeName, rate.podName),
  }
}

function fromRate(rate: RateDto): QuoteChoice | null {
  if (!source.value || rate.id === source.value.id || !sameClient(source.value, rate)
    || (rate.status !== 'Sent' && rate.status !== 'AcceptedByClient')
    || !(rate.quoNumber || rate.rateCode?.startsWith('QUO-'))) return null
  return {
    id: rate.id,
    number: rate.quoNumber || rate.rateCode,
    status: rate.status,
    mode: rate.shipmentMode,
    route: routeLabel(rate.polName, rate.poeName, rate.podName),
  }
}

async function loadCandidates() {
  const current = source.value
  if (!current || !canLink.value || loadingCandidates.value) return
  loadingCandidates.value = true
  errorMessage.value = ''
  try {
    const all: QuoteChoice[] = []
    const accountId = current.clientAccountId
    const leadId = current.clientLeadId
    if (accountId || leadId) {
      // The existing Pricing endpoints filter by real CRM identity before pagination.
      const path = '/api/pricing/rates/' + (accountId ? 'crm-account/' : 'crm-lead/')
        + encodeURIComponent(accountId || leadId || '')
      for (let page = 1; ; page++) {
        const response = await fetchClient<ClientQuotePage>(
          path + '?page=' + page + '&pageSize=100', { method: 'GET' },
        )
        if (source.value?.id !== current.id) return
        all.push(...(response.items || []).map(fromCrmQuote).filter((row): row is QuoteChoice => row !== null))
        if (!response.items?.length || page * 100 >= response.total) break
      }
    } else if (current.clientName?.trim()) {
      // Historical quotes lacking a CRM ID need all pages and exact client verification.
      for (let page = 1; ; page++) {
        const response = await PricingService.browseRates({
          search: current.clientName.trim(),
          statuses: ['Sent', 'AcceptedByClient'],
          pageNumber: page,
          pageSize: 100,
        })
        if (source.value?.id !== current.id) return
        all.push(...response.items.map(fromRate).filter((row): row is QuoteChoice => row !== null))
        if (!response.items.length || page * 100 >= (response.totalCount ?? 0)) break
      }
    } else {
      errorMessage.value = 'No hay una identidad de cliente para consultar sus tarifas.'
    }
    candidateRates.value = Array.from(new Map(all.map(rate => [rate.id, rate])).values())
      .sort((a, b) => Number(b.status === 'AcceptedByClient') - Number(a.status === 'AcceptedByClient')
        || b.number.localeCompare(a.number))
    selectedRateId.value = candidateRates.value.some(rate => rate.id === current.linkedAcceptedRateId)
      ? current.linkedAcceptedRateId || '' : ''
  } catch (error) {
    candidateRates.value = []
    selectedRateId.value = ''
    errorMessage.value = 'No fue posible cargar las cotizaciones de este cliente.'
    toastStore.backendError(error, errorMessage.value)
  } finally {
    loadingCandidates.value = false
  }
}

async function loadSource() {
  loading.value = true
  try {
    source.value = await PricingService.getRate(props.rateId)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo consultar la QUO original.')
    errorMessage.value = 'No se pudo cargar la cotización. Cierre esta ventana e inténtelo nuevamente.'
  } finally {
    loading.value = false
  }
  await loadCandidates()
}

async function saveLink() {
  const current = source.value
  if (!current || !canConfirm.value || saving.value) {
    errorMessage.value = 'Seleccione una QUO aceptada del mismo cliente.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    // Revalidate at save time. A sent quote cannot be linked before acceptance.
    const target = await PricingService.getRate(selectedRateId.value)
    if (target.status !== 'AcceptedByClient' || target.id === current.id || !sameClient(current, target))
      throw new Error('La QUO seleccionada ya no es una aceptada válida de este cliente.')
    await PricingService.setRateStatus(current.id, {
      status: 'QUOVinculada',
      linkedAcceptedRateId: target.id,
    })
    await props.onLinked?.()
    toastStore.success('QUO vinculada', 'La cotización original quedó vinculada a ' +
      (target.quoNumber || target.rateCode) + '. No contará como vencida o no aceptada.')
    modalStore.close()
  } catch (error) {
    errorMessage.value = 'No se pudo guardar el vínculo. Revise que la QUO ganadora esté aceptada.'
    toastStore.backendError(error, errorMessage.value)
  } finally {
    saving.value = false
  }
}

onMounted(loadSource)
</script>

<template>
  <section class="space-y-4">
    <p v-if="loading" class="text-sm font-semibold text-[var(--dh-text-muted)]">Consultando la cotización...</p>
    <template v-else-if="source">
      <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-[10px] font-black uppercase tracking-widest text-[var(--dh-text-muted)]">QUO que será vinculada</p>
        <p class="mt-1 text-base font-black text-[var(--dh-text)]">{{ source.quoNumber || source.rateCode }}</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ source.clientName || 'Cliente sin nombre' }}</p>
        <p class="mt-2 text-xs font-semibold">Estado actual: {{ source.status }}</p>
      </div>
      <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
        Seleccione la QUO ganadora de este cliente. Se muestran automáticamente todas las tarifas
        enviadas y aceptadas; solo una QUO aceptada puede quedar vinculada.
      </p>
      <template v-if="canLink">
        <div class="flex flex-wrap items-end gap-2">
          <div class="min-w-[220px] flex-1">
            <DhInput v-model="search" label="Filtrar las QUO de este cliente" placeholder="Buscar por número, ruta o modalidad" />
          </div>
          <DhButton variant="secondary" :loading="loadingCandidates" :disabled="saving || loadingCandidates" @click="loadCandidates">Actualizar lista</DhButton>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs font-black">Cotizaciones enviadas y aceptadas</p>
          <p class="text-xs text-[var(--dh-text-muted)]">{{ filteredQuotes.length }} de {{ candidateRates.length }} tarifas</p>
        </div>
        <p v-if="loadingCandidates" role="status" class="text-xs text-[var(--dh-text-muted)]">Cargando las tarifas del cliente...</p>
        <p v-else-if="!candidateRates.length" class="rounded-xl border border-[var(--dh-border)] p-4 text-xs text-[var(--dh-text-muted)]">No hay otras tarifas enviadas o aceptadas para este cliente.</p>
        <p v-else-if="!filteredQuotes.length" class="rounded-xl border border-[var(--dh-border)] p-4 text-xs text-[var(--dh-text-muted)]">Ninguna tarifa coincide con el filtro.</p>
        <div v-else class="max-h-80 space-y-2 overflow-y-auto pr-1" role="list" aria-label="Tarifas del cliente">
          <DhButton
            v-for="rate in filteredQuotes"
            :key="rate.id"
            variant="secondary"
            class="!w-full !max-w-none !justify-start !text-left"
            :class="selectedRateId === rate.id ? '!border-[var(--dh-primary)] !bg-[var(--dh-card-hover)]' : ''"
            :disabled="saving || loadingCandidates"
            @click="selectedRateId = rate.id"
          >
            <span class="flex w-full min-w-0 flex-col items-start gap-1 text-left">
              <span class="flex w-full flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-black">{{ rate.number }}</span>
                <span class="rounded-lg border border-[var(--dh-border)] px-2 py-1 text-[10px] font-bold">{{ rate.status === 'AcceptedByClient' ? 'Aceptada' : 'Enviada' }}</span>
              </span>
              <span class="text-xs text-[var(--dh-text-muted)]">{{ rate.mode }} · {{ rate.route }}</span>
              <span v-if="selectedRateId === rate.id" class="text-[11px] font-bold text-[var(--dh-primary)]">Seleccionada</span>
            </span>
          </DhButton>
        </div>
        <p v-if="selectedQuote?.status === 'Sent'" role="status" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-600">Esta QUO está enviada, pero aún no aceptada. Primero debe marcarse como Aceptada para vincularla.</p>
        <div class="flex flex-wrap justify-end gap-2">
          <DhButton variant="secondary" :disabled="saving" @click="modalStore.close()">Cancelar</DhButton>
          <DhButton :loading="saving" :disabled="!canConfirm || loadingCandidates" @click="saveLink">Confirmar vínculo</DhButton>
        </div>
      </template>
      <p v-else class="text-xs font-bold text-amber-600">La QUO no permite este cambio de estado o el usuario no tiene permisos para modificarlo.</p>
    </template>
    <p v-if="errorMessage" role="alert" class="rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-xs font-bold text-red-500">{{ errorMessage }}</p>
  </section>
</template>
