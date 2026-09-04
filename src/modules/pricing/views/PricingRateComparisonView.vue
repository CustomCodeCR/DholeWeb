<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CheckCircle2, GitCompareArrows, RefreshCw, XCircle } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { formatMoney } from '@/modules/pricing/utils/pricingFormat'

interface ComparisonDetail {
  id: string
  costId?: string | null
  name: string
  costDetailType: string
  costType: string
  chargeBasis: string
  currencyCode: string
  baselineCostAmount: number
  baselineSaleAmount: number
  candidateCostAmount: number
  candidateSaleAmount: number
  notes?: string | null
}

interface BaselineRate {
  id: string
  rateCode: string
  rateName: string
  status: string
  clientName?: string | null
  executiveName?: string | null
  agentName?: string | null
  carrierName?: string | null
  polName: string
  poeName: string
  podName?: string | null
  containerTypeName: string
  incotermName?: string | null
  totalCostAmount: number
  totalSaleAmount: number
  marginPercentage: number
  validFrom: string
  validTo: string
}

interface RateComparisonDto {
  id: string
  sourceImportFclRateId: string
  comparedRateHeaderId: string
  comparedRateCode: string
  comparisonType: 'Sent' | 'AcceptedRecent' | string
  status: 'Pending' | 'Created' | 'Dismissed' | string
  polName: string
  poeName: string
  containerTypeName: string
  currencyCode: string
  baselineCostAmount: number
  baselineSaleAmount: number
  candidateCostAmount: number
  candidateSaleAmount: number
  baselineComparedAmount: number
  candidateComparedAmount: number
  savingsAmount: number
  savingsPercent: number
  createdRateHeaderId?: string | null
  createdAtUtc: string
  resolvedAtUtc?: string | null
  baseline?: BaselineRate | null
  details: ComparisonDetail[]
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const comparison = ref<RateComparisonDto | null>(null)
const loading = ref(true)
const processing = ref(false)
const comparisonId = computed(() => String(route.params.comparisonId ?? ''))

const isAdmin = computed(() =>
  authStore.hasRole('Administrador') || authStore.hasRole('Admin') || authStore.hasRole('Administrator'),
)
const canCreate = computed(() =>
  comparison.value?.status === 'Pending'
  && (isAdmin.value || authStore.hasScope(PRICING_SCOPES.rates.create))
  && (isAdmin.value || authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate)),
)
const canDismiss = computed(() =>
  comparison.value?.status === 'Pending'
  && (isAdmin.value || authStore.hasScope(PRICING_SCOPES.rates.update)),
)
const isSentComparison = computed(() => comparison.value?.comparisonType === 'Sent')
const metricLabel = computed(() => isSentComparison.value ? 'Venta completa' : 'Costo completo')
const comparisonTypeLabel = computed(() =>
  isSentComparison.value ? 'Tarifa enviada' : 'Tarifa aceptada en los últimos 7 días',
)

function statusVariant(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'Created') return 'success'
  if (status === 'Pending') return 'warning'
  return 'neutral'
}

function statusLabel(status: string) {
  return ({ Pending: 'Pendiente de decisión', Created: 'Nueva tarifa creada', Dismissed: 'Descartada' } as Record<string, string>)[status] ?? status
}

function detailTypeLabel(value: string) {
  return ({
    Freight: 'Flete',
    OriginCharge: 'Origen',
    DestinationCharge: 'Destino',
    Surcharge: 'Recargo',
    Documentation: 'Documentación',
    InlandTransport: 'Transporte terrestre',
    AgentCharge: 'Agente',
    Other: 'Otro',
  } as Record<string, string>)[value] ?? value
}

async function load() {
  if (!comparisonId.value) return
  try {
    loading.value = true
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: `/api/pricing/rate-comparisons/${comparisonId.value}`,
    })
    comparison.value = unwrapApiResponse<RateComparisonDto>(response)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la comparación de tarifas.')
  } finally {
    loading.value = false
  }
}

async function createRate() {
  if (!comparison.value || !canCreate.value || processing.value) return
  if (!window.confirm('Dhole creará una nueva tarifa usando la tarifa automática de esta comparación. ¿Desea continuar?')) return

  try {
    processing.value = true
    const response = await callEndpoint<unknown>({
      method: 'POST',
      path: `/api/pricing/rate-comparisons/${comparison.value.id}/create-rate`,
    })
    const createdRateId = unwrapApiResponse<string>(response)
    toastStore.success('Tarifa creada', 'La nueva tarifa quedó creada con el flujo normal de Pricing.')
    await load()
    if (createdRateId) {
      await router.push(`/pricing/rates/${createdRateId}/wizard`)
    }
  } catch (error) {
    toastStore.backendError(
      error,
      'No se pudo crear la tarifa. Verifique que la tarifa importada esté preaprobada y que tenga los permisos requeridos.',
    )
  } finally {
    processing.value = false
  }
}

async function dismissComparison() {
  if (!comparison.value || !canDismiss.value || processing.value) return
  if (!window.confirm('¿Descartar esta oportunidad? No se modificará ninguna tarifa existente.')) return

  try {
    processing.value = true
    await callEndpoint<void>({
      method: 'POST',
      path: `/api/pricing/rate-comparisons/${comparison.value.id}/dismiss`,
    })
    toastStore.success('Comparación descartada', 'No se creó ninguna tarifa nueva.')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo descartar la comparación.')
  } finally {
    processing.value = false
  }
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/pricing/imports')
}

onMounted(load)
</script>

<template>
  <section class="min-w-0 space-y-4 p-0.5 sm:space-y-5 sm:p-1">
    <DhPageHeader
      title="Comparación de tarifa automática"
      subtitle="Dhole reconstruyó la cotización completa con la nueva tarifa registrada. La comparación no usa únicamente el flete."
      :icon="GitCompareArrows"
    >
      <template #actions>
        <DhButton label="Volver" :icon="ArrowLeft" variant="secondary" @click="goBack" />
        <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :disabled="loading" @click="load" />
      </template>
    </DhPageHeader>

    <div v-if="loading" class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-8 text-center font-bold text-[var(--dh-text-muted)]">
      Cargando comparación…
    </div>

    <template v-else-if="comparison">
      <article class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <DhBadge :label="comparisonTypeLabel" variant="primary" />
              <DhBadge :label="statusLabel(comparison.status)" :variant="statusVariant(comparison.status)" />
            </div>
            <h2 class="mt-3 text-xl font-black text-[var(--dh-text)]">
              {{ comparison.polName }} → {{ comparison.poeName }} · {{ comparison.containerTypeName }}
            </h2>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
              Comparada contra {{ comparison.comparedRateCode }}
              <span v-if="comparison.baseline?.clientName"> · {{ comparison.baseline.clientName }}</span>
            </p>
          </div>

          <div v-if="comparison.status === 'Pending'" class="flex flex-wrap gap-2">
            <DhButton
              v-if="canDismiss"
              label="No crear tarifa"
              :icon="XCircle"
              variant="secondary"
              :disabled="processing"
              @click="dismissComparison"
            />
            <DhButton
              v-if="canCreate"
              label="Crear nueva tarifa"
              :icon="CheckCircle2"
              :disabled="processing"
              @click="createRate"
            />
          </div>
        </div>
      </article>

      <div class="grid gap-3 md:grid-cols-3">
        <article class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ metricLabel }} anterior</p>
          <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ formatMoney(comparison.baselineComparedAmount, comparison.currencyCode) }}</p>
        </article>
        <article class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">{{ metricLabel }} automática</p>
          <p class="mt-2 text-2xl font-black text-[var(--dh-primary)]">{{ formatMoney(comparison.candidateComparedAmount, comparison.currencyCode) }}</p>
        </article>
        <article class="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">Mejora detectada</p>
          <p class="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">
            {{ formatMoney(comparison.savingsAmount, comparison.currencyCode) }}
          </p>
          <p class="mt-1 text-sm font-black text-emerald-700/80 dark:text-emerald-300/80">{{ comparison.savingsPercent.toFixed(2) }}%</p>
        </article>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <article class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tarifa existente</p>
          <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><p class="font-bold text-[var(--dh-text-muted)]">Costo</p><p class="font-black">{{ formatMoney(comparison.baselineCostAmount, comparison.currencyCode) }}</p></div>
            <div><p class="font-bold text-[var(--dh-text-muted)]">Venta</p><p class="font-black">{{ formatMoney(comparison.baselineSaleAmount, comparison.currencyCode) }}</p></div>
          </div>
        </article>
        <article class="rounded-[24px] border border-[var(--dh-primary)]/20 bg-[var(--dh-card)] p-4">
          <p class="text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-primary)]">Tarifa automática nueva</p>
          <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><p class="font-bold text-[var(--dh-text-muted)]">Costo</p><p class="font-black">{{ formatMoney(comparison.candidateCostAmount, comparison.currencyCode) }}</p></div>
            <div><p class="font-bold text-[var(--dh-text-muted)]">Venta</p><p class="font-black">{{ formatMoney(comparison.candidateSaleAmount, comparison.currencyCode) }}</p></div>
          </div>
        </article>
      </div>

      <article class="overflow-hidden rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)]">
        <div class="border-b border-[var(--dh-border)] p-4 sm:p-5">
          <h3 class="font-black text-[var(--dh-text)]">Detalle de costos y ventas</h3>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)] sm:text-sm">
            Los valores del detalle son totales por rubro para facilitar la comparación directa.
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px] text-left text-sm">
            <thead class="bg-black/[0.035] text-xs uppercase tracking-[0.08em] text-[var(--dh-text-muted)] dark:bg-white/[0.04]">
              <tr>
                <th class="px-4 py-3 font-black">Rubro</th>
                <th class="px-4 py-3 font-black">Tipo</th>
                <th class="px-4 py-3 text-right font-black">Costo anterior</th>
                <th class="px-4 py-3 text-right font-black">Costo nuevo</th>
                <th class="px-4 py-3 text-right font-black">Venta anterior</th>
                <th class="px-4 py-3 text-right font-black">Venta nueva</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--dh-border)]">
              <tr v-for="detail in comparison.details" :key="detail.id">
                <td class="px-4 py-3">
                  <p class="font-black text-[var(--dh-text)]">{{ detail.name }}</p>
                  <p v-if="detail.notes" class="mt-0.5 max-w-[320px] truncate text-xs font-semibold text-[var(--dh-text-muted)]">{{ detail.notes }}</p>
                </td>
                <td class="px-4 py-3 font-semibold text-[var(--dh-text-muted)]">{{ detailTypeLabel(detail.costDetailType) }}</td>
                <td class="px-4 py-3 text-right font-bold">{{ formatMoney(detail.baselineCostAmount, detail.currencyCode) }}</td>
                <td class="px-4 py-3 text-right font-bold">{{ formatMoney(detail.candidateCostAmount, detail.currencyCode) }}</td>
                <td class="px-4 py-3 text-right font-bold">{{ formatMoney(detail.baselineSaleAmount, detail.currencyCode) }}</td>
                <td class="px-4 py-3 text-right font-bold">{{ formatMoney(detail.candidateSaleAmount, detail.currencyCode) }}</td>
              </tr>
              <tr v-if="comparison.details.length === 0">
                <td colspan="6" class="px-4 py-8 text-center font-semibold text-[var(--dh-text-muted)]">No hay desglose disponible.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article v-if="comparison.status === 'Created' && comparison.createdRateHeaderId" class="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4">
        <p class="font-black text-emerald-800 dark:text-emerald-200">La nueva tarifa ya fue creada.</p>
        <DhButton class="mt-3" label="Abrir tarifa creada" size="sm" @click="router.push(`/pricing/rates/${comparison.createdRateHeaderId}/wizard`)" />
      </article>
    </template>

    <article v-else class="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-6">
      <p class="font-black">No se encontró la comparación solicitada.</p>
    </article>
  </section>
</template>
