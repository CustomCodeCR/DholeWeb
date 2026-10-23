<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import { fetchProtectedBlob } from '@/core/api/fetchConfig'
import type { RateDto } from '@/core/interfaces/pricing'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { sellerRateCurrencyValue, type SellerRateCurrency } from '@/modules/pricing/utils/sellerRateCurrency'
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import SellerRateDecisionModal from '@/modules/dashboard/components/SellerRateDecisionModal.vue'


const route = useRoute()
const router = useRouter()
const modal = useModalStore()
const toast = useToastStore()

const rateId = computed(() => String(route.params.rateId || ''))
const rate = ref<RateDto | null>(null)
const currencies = ref<CatalogItemSelectDto[]>([])
const loading = ref(false)
const receiving = ref(false)
const downloading = ref(false)
const loadError = ref('')
const pendingModification = ref(false)

const isSent = computed(() => ['Sent', 'RequestedByClient'].includes(rate.value?.status || ''))
const revisionPending = computed(() => Boolean(rate.value?.revisionPending))
const isReceived = computed(() => Boolean(rate.value?.sellerReceivedAtUtc))
const isCastroFallas = computed(() => rate.value?.executiveName?.trim().toLocaleLowerCase() === 'castro fallas')
const canReceive = computed(() => isSent.value && !revisionPending.value && !isReceived.value && !isCastroFallas.value)
const canRequestModification = computed(() => Boolean(rate.value
  && !revisionPending.value && rate.value.status !== 'Closed' && rate.value.status !== 'Cancelled'
  && (rate.value.sellerReceivedAtUtc
    || ['Sent', 'RequestedByClient', 'AcceptedByClient', 'RejectedByClient', 'Expired'].includes(rate.value.status))))

function requestModification() {
  if (!rate.value || !canRequestModification.value || pendingModification.value) return
  void router.push({
    name: 'pricing-seller-rate-request',
    query: { modifyRateId: rate.value.id },
  })
}

const statusText = computed(() => {
  if (!rate.value) return ''
  if (revisionPending.value) return 'En modificación por Pricing'
  if (rate.value.status === 'AcceptedByClient') return 'Aceptada por cliente'
  if (rate.value.status === 'RejectedByClient') return 'No aceptada por cliente'
  if (rate.value.status === 'Cancelled') return 'Cancelada'
  if (rate.value.status === 'Expired') return 'Vencida'
  return isReceived.value ? 'Recibida por vendedor' : isSent.value ? 'Enviada al vendedor' : 'En preparación'
})
const formattedRoute = computed(() => [rate.value?.polName, rate.value?.poeName, rate.value?.podName].filter(Boolean).join(' → '))
const money = (amount: number, currency: SellerRateCurrency, fallbackCurrency?: SellerRateCurrency) => {
  const currencyValue = sellerRateCurrencyValue(currency, currencies.value, fallbackCurrency)
  const numericAmount = Number(amount) || 0
  return currencyValue
    ? formatMoney(numericAmount, currencyValue)
    : numericAmount.toLocaleString('es-CR', { maximumFractionDigits: 2 })
}

async function loadCurrencies() {
  try {
    currencies.value = await CatalogItemsService.select({ catalogGroupSlug: 'currencies' })
  } catch {
    // The saved currency name can still supply a valid ISO fallback.
    currencies.value = []
  }
}

async function load() {
  if (!rateId.value) return
  loading.value = true
  loadError.value = ''
  try {
    rate.value = await callEndpoint<RateDto>({
      method: 'GET',
      path: `/api/pricing/seller-rates/${encodeURIComponent(rateId.value)}`,
      headers: { Accept: 'application/json' },
    })
    try {
      const response = await callEndpoint<unknown>({
        method: 'GET',
        path: '/api/pricing/rate-requests/mine',
        headers: { Accept: 'application/json' },
      })
      pendingModification.value = unwrapListResponse<{
        rateId?: string | null
        kind?: string
        status: string
        completedAtUtc?: string | null
        preparedRevisionNumber?: number | null
        payload?: { modification?: { sourceRevisionNumber?: number | null } } | null
      }>(response).some(request => {
        if (request.rateId !== rateId.value || request.kind !== 'Modification') return false
        if (request.status === 'Open') return true
        // Legacy prematurely-completed work cannot be considered delivered
        // without an explicitly prepared and completed revision.
        return request.status === 'Completed'
          && (!request.completedAtUtc || Number(request.preparedRevisionNumber || 0) <=
            Number(request.payload?.modification?.sourceRevisionNumber || 0))
      })
    } catch {
      pendingModification.value = false
    }
  } catch (error) {
    rate.value = null
    loadError.value = 'No fue posible abrir esta tarifa. Verifique que esté asignada a su usuario.'
    toast.backendError(error, loadError.value)
  } finally {
    loading.value = false
  }
}

async function markReceived() {
  if (!rate.value || !canReceive.value || receiving.value) return
  receiving.value = true
  try {
    await callEndpoint<unknown>({
      method: 'PATCH',
      path: `/api/pricing/seller-rates/${rate.value.id}/received`,
      headers: { Accept: 'application/json' },
    })
    toast.success('Tarifa recibida', 'Se registró su confirmación de recepción.')
    await load()
  } catch (error) {
    toast.backendError(error, 'No se pudo marcar la tarifa como recibida.')
  } finally {
    receiving.value = false
  }
}

async function downloadPdf() {
  if (!rate.value || downloading.value) return
  downloading.value = true
  try {
    const blob = await fetchProtectedBlob(`/api/pricing/seller-rates/${rate.value.id}/document`)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${(rate.value.quoNumber || rate.value.rateCode || 'cotizacion').replace(/[^a-z0-9-_]/gi, '_')}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  } catch (error) {
    toast.backendError(error, 'No se pudo descargar el PDF comercial.')
  } finally {
    downloading.value = false
  }
}

function clientDecision(decision: 'AcceptedByClient' | 'RejectedByClient') {
  if (!rate.value || !isSent.value || revisionPending.value) return
  modal.open({
    title: decision === 'AcceptedByClient' ? 'Registrar aceptación del cliente' : 'Registrar rechazo del cliente',
    component: SellerRateDecisionModal,
    size: 'md',
    props: { rate: rate.value, decision, onSaved: load },
  })
}

watch(rateId, () => { void load() })
onMounted(() => { void load(); void loadCurrencies() })
</script>

<template>
  <section class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-black uppercase tracking-wider text-[var(--dh-primary)]">Mi gestión comercial</p>
        <h1 class="mt-1 text-2xl font-black text-[var(--dh-text)]">Cotización asignada</h1>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Acceso directo a la cotización enviada por Pricing.</p>
      </div>
      <DhButton label="Volver al dashboard" variant="secondary" @click="router.push('/home')" />
    </div>

    <div v-if="loading && !rate" class="rounded-2xl border border-[var(--dh-border)] p-8 text-center text-sm">
      Cargando cotización...
    </div>
    <div v-else-if="loadError" class="rounded-2xl border border-red-500/25 bg-red-500/5 p-5 font-semibold text-[var(--dh-text)]">
      {{ loadError }}
      <div class="mt-3"><DhButton label="Reintentar" variant="secondary" @click="load" /></div>
    </div>
    <template v-else-if="rate">
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 space-y-2">
            <h2 class="break-words text-xl font-black text-[var(--dh-text)]">{{ rate.quoNumber || rate.rateCode }}</h2>
            <p class="text-base font-bold text-[var(--dh-text)]">{{ rate.clientName || 'Cliente no indicado' }}</p>
            <p class="text-sm text-[var(--dh-text-muted)]">Vendedor: {{ rate.executiveName || 'Sin asignar' }}</p>
            <div class="flex flex-wrap gap-2">
              <DhBadge :label="statusText" :variant="isReceived ? 'success' : 'warning'" />
              <DhBadge v-if="isReceived" label="Recepción confirmada" variant="success" />
            </div>
            <p v-if="revisionPending" class="text-xs font-bold text-amber-500">Pricing está preparando una nueva revisión. Se muestra la última cotización enviada, no los precios del borrador.</p>
            <p v-if="pendingModification" class="text-xs font-bold text-amber-500">Pricing tiene una solicitud de modificación pendiente para esta tarifa.</p>
            <p v-if="rate.sellerReceivedAtUtc" class="text-xs text-[var(--dh-text-muted)]">
              Confirmación: {{ new Date(rate.sellerReceivedAtUtc).toLocaleString('es-CR') }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <DhButton label="Descargar PDF" variant="secondary" :loading="downloading" :disabled="revisionPending" @click="downloadPdf" />
            <DhButton v-if="canRequestModification" :label="pendingModification ? 'Modificación pendiente' : 'Solicitar modificación'" variant="secondary" :disabled="pendingModification" @click="requestModification" />
            <DhButton v-if="canReceive" label="Marcar como recibida" :loading="receiving" @click="markReceived" />
          </div>
        </div>
        <p v-if="canReceive" class="mt-4 text-xs font-semibold text-[var(--dh-text-muted)]">
          Confirme que recibió la cotización. Esto no registra aceptación del cliente ni cambia la venta.
        </p>
      </div>

      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs font-bold uppercase text-[var(--dh-text-muted)]">Ruta</p>
          <p class="mt-2 font-semibold text-[var(--dh-text)]">{{ formattedRoute || 'Por confirmar' }}</p>
        </div>
        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs font-bold uppercase text-[var(--dh-text-muted)]">Modalidad y vigencia</p>
          <p class="mt-2 font-semibold text-[var(--dh-text)]">{{ rate.shipmentMode }} · {{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}</p>
        </div>
        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs font-bold uppercase text-[var(--dh-text-muted)]">Venta total cotizada</p>
          <p class="mt-2 text-lg font-black text-[var(--dh-text)]">{{ money(rate.totalSaleAmount, rate) }}</p>
        </div>
      </div>

      <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <h3 class="text-base font-black text-[var(--dh-text)]">Detalle comercial</h3>
        <div v-if="rate.rateDetails?.length" class="mt-3 overflow-x-auto">
          <table class="w-full min-w-[520px] text-left text-sm">
            <thead class="text-xs uppercase text-[var(--dh-text-muted)]">
              <tr><th class="py-2">Concepto</th><th class="py-2">Cantidad</th><th class="py-2 text-right">Venta</th></tr>
            </thead>
            <tbody class="divide-y divide-[var(--dh-border)]">
              <tr v-for="line in rate.rateDetails.filter(item => Number(item.saleAmount) > 0)" :key="line.id">
                <td class="py-3 font-semibold text-[var(--dh-text)]">{{ line.name }}</td>
                <td class="py-3 text-[var(--dh-text-muted)]">{{ line.quantity }}</td>
                <td class="py-3 text-right font-bold text-[var(--dh-text)]">{{ money(line.saleAmount, line, rate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="mt-3 text-sm text-[var(--dh-text-muted)]">Revise el detalle completo en el PDF adjunto al correo.</p>
      </section>

      <section class="grid gap-3 md:grid-cols-3">
        <div v-for="term in [
          { title: 'Incluye', text: rate.includes },
          { title: 'Sujeto a', text: rate.subjectTo },
          { title: 'No incluye', text: rate.excludes },
        ]" :key="term.title" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <h3 class="text-sm font-bold text-[var(--dh-text)]">{{ term.title }}</h3>
          <p class="mt-2 whitespace-pre-line text-sm text-[var(--dh-text-muted)]">{{ term.text || 'No indicado' }}</p>
        </div>
      </section>
      <div v-if="isSent && !revisionPending" class="flex flex-wrap items-center gap-2">
        <p class="w-full text-xs text-[var(--dh-text-muted)]">Solo registre una decisión cuando el cliente responda a la cotización.</p>
        <DhButton label="Aceptada por cliente" @click="clientDecision('AcceptedByClient')" />
        <DhButton label="Rechazada por cliente" variant="danger" @click="clientDecision('RejectedByClient')" />
      </div>
    </template>
  </section>
</template>
