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
const activeStep = ref(9)
const steps = ['Modalidad', 'Embarque', 'Ruta', 'Carga', 'Tarifa', 'Proveedor', 'Líneas', 'Borrador', 'Vista completa'] as const
const commercialLines = computed(() => rate.value?.rateDetails?.filter(line => Number(line.saleAmount) > 0) ?? [])

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
        <h1 class="text-2xl font-black text-[var(--dh-text)]">Visualizar tarifa</h1>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">Vista completa de la cotización comercial enviada por Pricing.</p>
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
      <header class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="flex flex-wrap items-center gap-2">
          <DhBadge :label="rate.quoNumber || rate.rateCode" variant="primary" />
          <DhBadge :label="'Revisión ' + (rate.revisionNumber || 1)" variant="neutral" />
          <DhBadge :label="statusText" :variant="isReceived ? 'success' : 'neutral'" />
        </div>
        <h2 class="mt-3 break-words text-lg font-black text-[var(--dh-text)]">
          {{ rate.rateName || (rate.quoNumber || rate.rateCode) + ' - ' + (rate.clientName || 'Cliente sin definir') }}
        </h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          IDTRA: {{ rate.idtraNumber || 'Pendiente de asignar' }} · QUO: {{ rate.quoNumber || rate.rateCode }}
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <DhButton variant="secondary" label="Descargar cotización PDF" :loading="downloading" :disabled="revisionPending" @click="downloadPdf" />
          <DhButton v-if="canRequestModification" :label="pendingModification ? 'Modificación pendiente' : 'Solicitar modificación'" variant="secondary" :disabled="pendingModification" @click="requestModification" />
        </div>
        <div v-if="revisionPending || pendingModification" class="mt-3 space-y-1 text-xs font-semibold text-amber-500">
          <p v-if="revisionPending">Pricing está preparando una nueva revisión. Se muestra únicamente la última cotización enviada, no el borrador.</p>
          <p v-if="pendingModification">Existe una solicitud de modificación pendiente para esta tarifa.</p>
        </div>
      </header>

      <nav class="grid grid-cols-3 gap-2 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-2 sm:grid-cols-3 lg:grid-cols-9" aria-label="Pantallas de la cotización">
        <button v-for="(item, index) in steps" :key="index" type="button"
          class="min-w-0 rounded-xl border px-2.5 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dh-primary)]"
          :class="activeStep === index + 1 ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-text)]' : 'border-transparent bg-[var(--dh-input)] text-[var(--dh-text-muted)] hover:border-[var(--dh-border)]'"
          :aria-current="activeStep === index + 1 ? 'step' : undefined"
          @click="activeStep = index + 1">
          <span class="block text-[10px] font-black tracking-wide">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="mt-1 block text-[11px] font-bold">{{ item }}</span>
        </button>
      </nav>

      <main class="space-y-5 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Pantalla {{ activeStep }}</p>
            <h2 class="mt-1 text-2xl font-black text-[var(--dh-text)]">
              {{ activeStep === 9 ? 'Vista completa de la tarifa' : steps[activeStep - 1] }}
            </h2>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
              {{ activeStep === 9 ? 'Resumen de la revisión enviada, condiciones, líneas comerciales y total de venta.' : 'Información comercial de la cotización, en modo de consulta.' }}
            </p>
          </div>
          <DhButton v-if="activeStep === 9" variant="secondary" label="Descargar cotización PDF"
            :loading="downloading" :disabled="revisionPending" @click="downloadPdf" />
        </div>

        <section v-if="activeStep === 9" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4 sm:p-5">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Estado comercial</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <DhBadge :label="statusText" :variant="isReceived ? 'success' : 'warning'" />
                <DhBadge v-if="isReceived" label="Recibida por vendedor" variant="success" />
                <DhBadge :label="'REV ' + (rate.revisionNumber || 1)" variant="neutral" />
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <DhButton v-if="canReceive" label="Marcar como recibida" :loading="receiving" @click="markReceived" />
              <template v-if="isSent && !revisionPending">
                <DhButton label="Aceptada" @click="clientDecision('AcceptedByClient')" />
                <DhButton label="Rechazada" variant="danger" @click="clientDecision('RejectedByClient')" />
              </template>
            </div>
          </div>
          <p v-if="canReceive" class="mt-3 text-xs text-[var(--dh-text-muted)]">Confirmar la recepción no significa aceptar la cotización por parte del cliente.</p>
          <p v-if="isSent && !revisionPending" class="mt-2 text-xs text-[var(--dh-text-muted)]">Registre la aceptación o el rechazo únicamente cuando el cliente comunique su decisión.</p>
          <p v-if="isReceived && rate.sellerReceivedAtUtc" class="mt-2 text-xs text-[var(--dh-text-muted)]">Recepción confirmada: {{ new Date(rate.sellerReceivedAtUtc).toLocaleString('es-CR') }}</p>
        </section>

        <section v-if="[1, 2, 3, 9].includes(activeStep)" class="grid gap-3 md:grid-cols-3">
          <div v-if="[1, 9].includes(activeStep)" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
            <p class="text-[11px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Identificación y modalidad</p>
            <p class="mt-2 break-words text-sm font-black text-[var(--dh-text)]">{{ rate.quoNumber || rate.rateCode }}</p>
            <p class="mt-1 text-sm text-[var(--dh-text)]">{{ rate.shipmentMode }} · {{ rate.incotermName || rate.incotermCode || 'Incoterm no indicado' }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Revisión {{ rate.revisionNumber || 1 }}</p>
          </div>
          <div v-if="[2, 9].includes(activeStep)" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
            <p class="text-[11px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Cliente y operación</p>
            <p class="mt-2 text-sm font-black text-[var(--dh-text)]">{{ rate.clientName || 'Sin cliente' }}</p>
            <p class="mt-1 text-sm text-[var(--dh-text)]">Vendedor: {{ rate.executiveName || 'Sin asignar' }}</p>
          </div>
          <div v-if="[2, 9].includes(activeStep)" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
            <p class="text-[11px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Vigencia</p>
            <p class="mt-2 text-sm font-bold text-[var(--dh-text)]">{{ formatDate(rate.validFrom) }} → {{ formatDate(rate.validTo) }}</p>
            <p v-if="rate.transitTime" class="mt-1 text-xs text-[var(--dh-text-muted)]">Tránsito: {{ rate.transitTime }}</p>
          </div>
          <div v-if="[3, 9].includes(activeStep)" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4 md:col-span-3">
            <p class="text-[11px] font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Ruta · POL → POE → POD</p>
            <p class="mt-2 text-sm font-black text-[var(--dh-text)]">{{ formattedRoute || 'Por confirmar' }}</p>
            <div class="mt-3 grid gap-2 text-xs text-[var(--dh-text-muted)] sm:grid-cols-3">
              <p>Origen (POL): <strong class="text-[var(--dh-text)]">{{ rate.polName || 'No indicado' }}</strong></p>
              <p>Entrada (POE): <strong class="text-[var(--dh-text)]">{{ rate.poeName || 'No indicado' }}</strong></p>
              <p>Destino (POD): <strong class="text-[var(--dh-text)]">{{ rate.podName || 'No indicado' }}</strong></p>
            </div>
          </div>
        </section>

        <section v-if="[4, 9].includes(activeStep)" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <h3 class="text-sm font-black text-[var(--dh-text)]">Carga y equipo</h3>
          <div class="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p class="text-xs text-[var(--dh-text-muted)]">Equipo</p><p class="font-bold text-[var(--dh-text)]">{{ rate.containerQuantity || 1 }} × {{ rate.containerTypeName || rate.shipmentMode }}</p></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">Bultos</p><p class="font-bold text-[var(--dh-text)]">{{ rate.totalPackages ?? 'No indicado' }}</p></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">Peso</p><p class="font-bold text-[var(--dh-text)]">{{ rate.totalWeightKg ?? 0 }} kg</p></div>
            <div><p class="text-xs text-[var(--dh-text-muted)]">Volumen</p><p class="font-bold text-[var(--dh-text)]">{{ rate.totalVolumeCbm ?? 0 }} CBM</p></div>
          </div>
        </section>

        <section v-if="[5, 9].includes(activeStep)" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <p class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Venta total cotizada</p>
          <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ money(rate.totalSaleAmount, rate) }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">Únicamente importes comerciales; no se muestran costos ni márgenes internos de Pricing.</p>
        </section>

        <section v-if="[6, 9].includes(activeStep)" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <p class="text-xs font-black uppercase tracking-wider text-[var(--dh-text-muted)]">Proveedor y transporte</p>
          <p class="mt-2 text-sm font-bold text-[var(--dh-text)]">{{ rate.carrierName || rate.agentName || 'No indicado en la cotización comercial' }}</p>
        </section>

        <section v-if="[7, 9].includes(activeStep)" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
          <h3 class="text-base font-black text-[var(--dh-text)]">Líneas de la cotización</h3>
          <div v-if="commercialLines.length" class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[480px] text-left text-sm">
              <thead class="text-xs uppercase text-[var(--dh-text-muted)]">
                <tr><th scope="col" class="py-2">Concepto</th><th scope="col" class="py-2">Cantidad</th><th scope="col" class="py-2 text-right">Venta</th></tr>
              </thead>
              <tbody class="divide-y divide-[var(--dh-border)]">
                <tr v-for="line in commercialLines" :key="line.id">
                  <td class="py-3 font-semibold text-[var(--dh-text)]">{{ line.name }}</td>
                  <td class="py-3 text-[var(--dh-text-muted)]">{{ line.quantity }}</td>
                  <td class="py-3 text-right font-bold text-[var(--dh-text)]">{{ money(line.saleAmount, line, rate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="mt-3 text-sm text-[var(--dh-text-muted)]">El desglose comercial está disponible en el PDF de la cotización.</p>
        </section>

        <section v-if="[8, 9].includes(activeStep)" class="grid gap-3 md:grid-cols-3">
          <div v-for="term in [
            { title: 'Incluye', text: rate.includes },
            { title: 'Sujeto a', text: rate.subjectTo },
            { title: 'No incluye', text: rate.excludes },
          ]" :key="term.title" class="rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
            <h3 class="text-sm font-black text-[var(--dh-text)]">{{ term.title }}</h3>
            <p class="mt-2 whitespace-pre-line text-sm text-[var(--dh-text-muted)]">{{ term.text || 'No indicado' }}</p>
          </div>
        </section>
      </main>
    </template>
  </section>
</template>
