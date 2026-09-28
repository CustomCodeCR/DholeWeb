<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  CheckCircle2,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  Undo2,
  WandSparkles,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhTextarea } from '@/shared/components/atoms'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { MarketPricingService } from '@/core/services/marketPricingService'
import type { RateDto, ShipmentMode } from '@/core/interfaces/pricing'
import type {
  AutoPricingCalculationDto,
  AutoPricingDecisionDto,
  MarketBenchmarkDto,
  MarketBenchmarkObservationDto,
} from '@/core/interfaces/marketPricing'
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'

interface MarketPricingContext {
  incotermId?: string | null
  incotermLabel?: string | null
  polId?: string | null
  polLabel?: string | null
  poeId?: string | null
  poeLabel?: string | null
  podId?: string | null
  podLabel?: string | null
  containerTypeId?: string | null
  containerLabel?: string | null
  mode: ShipmentMode
  carrierId?: string | null
  carrierLabel?: string | null
  referenceDate?: string | null
}

const props = withDefaults(defineProps<{
  rateId?: string | null
  rate?: RateDto | null
  context: MarketPricingContext
  viewOnly?: boolean
}>(), {
  rateId: null,
  rate: null,
  viewOnly: false,
})

const emit = defineEmits<{
  refreshed: []
}>()

const authStore = useAuthStore()
const toastStore = useToastStore()

const benchmark = ref<MarketBenchmarkDto | null>(null)
const calculation = ref<AutoPricingCalculationDto | null>(null)
const decision = ref<AutoPricingDecisionDto | null>(null)
const loading = ref(false)
const action = ref('')
const showObservations = ref(false)
const showCalculation = ref(false)
const showAdjustments = ref(false)
const showOverride = ref(false)
const overrideReason = ref('')
const overrideSales = reactive<Record<string, number>>({})
const baselineSales = reactive<Record<string, number>>({})
const baselineRateId = ref('')

const selectedEquipmentId = ref<string | null>(props.context.containerTypeId ?? null)

const canViewBenchmark = computed(() => authStore.hasScope(PRICING_SCOPES.marketBenchmark.view))
const canCalculateBenchmark = computed(() => authStore.hasScope(PRICING_SCOPES.marketBenchmark.calculate))
const canViewAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.view))
const canCalculateAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.calculate))
const canApplyAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.apply))
const canOverrideAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.override))
const canApproveAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.approve))

const equipmentOptions = computed(() => {
  const persisted = (props.rate?.containers ?? [])
    .filter((item) => item.containerTypeId && item.quantity > 0)
    .map((item) => ({
      id: item.containerTypeId,
      label: `${item.quantity} × ${item.containerTypeName || item.containerTypeCode}`,
    }))

  if (persisted.length) {
    return [...new Map(persisted.map((item) => [item.id, item])).values()]
  }

  if (props.context.containerTypeId) {
    return [{
      id: props.context.containerTypeId,
      label: props.context.containerLabel || 'Equipo seleccionado',
    }]
  }

  return []
})

const hasMultipleEquipment = computed(() => equipmentOptions.value.length > 1)

watch(
  equipmentOptions,
  (items) => {
    if (!items.length) {
      selectedEquipmentId.value = props.context.containerTypeId ?? null
      return
    }

    if (!items.some((item) => item.id === selectedEquipmentId.value)) {
      selectedEquipmentId.value = items[0]?.id ?? null
    }
  },
  { immediate: true },
)

const activeDecisionId = computed(() => calculation.value?.decisionId ?? decision.value?.id ?? null)

const marketObservations = computed<MarketBenchmarkObservationDto[]>(() =>
  calculation.value?.benchmark.observations
  ?? benchmark.value?.observations
  ?? decision.value?.observations
  ?? [],
)

const marketStats = computed(() => {
  const source = calculation.value?.benchmark ?? benchmark.value

  return {
    candidateCount: source?.candidateCount ?? decision.value?.observationCount ?? 0,
    observationCount: source?.observationCount ?? decision.value?.observationCount ?? 0,
    competitorCount: source?.competitorCount ?? decision.value?.competitorCount ?? 0,
    outlierCount:
      source?.outlierCount
      ?? decision.value?.observations.filter((item) => item.isOutlier).length
      ?? 0,
    p25: source?.p25 ?? decision.value?.p25 ?? null,
    p40: source?.p40 ?? decision.value?.p40 ?? null,
    p50: source?.p50 ?? decision.value?.p50 ?? null,
    p60: source?.p60 ?? decision.value?.p60 ?? null,
    p65: source?.p65 ?? decision.value?.p65 ?? null,
    p75: source?.p75 ?? decision.value?.p75 ?? null,
    median: source?.median ?? decision.value?.median ?? null,
    weightedAverage: source?.weightedAverage ?? decision.value?.weightedAverage ?? null,
    targetMarketPrice: source?.targetMarketPrice ?? decision.value?.targetMarketPrice ?? null,
    competitiveCeiling: source?.competitiveCeiling ?? decision.value?.competitiveCeiling ?? null,
    confidenceScore: source?.confidenceScore ?? decision.value?.confidenceScore ?? 0,
    carrierFallbackUsed: source?.carrierFallbackUsed ?? false,
    hasSufficientMarketData: source?.hasSufficientMarketData ?? null,
    algorithmVersion: source?.algorithmVersion ?? decision.value?.algorithmVersion ?? '',
  }
})

const position = computed(() => {
  if (calculation.value) return calculation.value.position

  if (!decision.value) return null

  const suggested = decision.value.suggestedSaleTotal
  const cost = decision.value.costTotal
  const suggestedMargin = suggested > 0 ? ((suggested - cost) / suggested) * 100 : 0

  return {
    cost,
    originalSale: decision.value.originalSaleTotal,
    minimumSalePrice: 0,
    marketMedian: decision.value.median,
    weightedMarketAverage: decision.value.weightedAverage,
    targetMarketPrice: decision.value.targetMarketPrice,
    competitiveCeiling: decision.value.competitiveCeiling,
    suggestedSalePrice: suggested,
    currentMargin: Number(props.rate?.marginPercentage ?? 0),
    suggestedMargin,
    availableHeadroom: suggested - decision.value.originalSaleTotal,
    confidenceScore: decision.value.confidenceScore,
    status: decision.value.wasManuallyModified
      ? 'ManuallyAdjusted'
      : decision.value.wasAutoApplied
        ? 'AutoApplied'
        : 'Calculated',
  }
})

const displayStatus = computed(() =>
  calculation.value?.status
  ?? (decision.value?.wasManuallyModified
    ? 'ManuallyAdjusted'
    : decision.value?.wasAutoApplied
      ? 'AutoApplied'
      : decision.value
        ? 'Calculated'
        : 'NotCalculated'),
)

const confidenceTone = computed(() => {
  const value = marketStats.value.confidenceScore
  if (value >= 80) return 'success'
  if (value >= 60) return 'warning'
  return 'danger'
})

const marketPositionTone = computed(() => {
  const status = String(position.value?.status ?? '').toLowerCase()
  if (status.includes('competitive') && !status.includes('above') && !status.includes('below')) {
    return 'success'
  }
  if (status.includes('insufficient')) return 'warning'
  if (status.includes('above') || status.includes('belowminimum')) return 'danger'
  return 'neutral'
})

const canDraftBenchmark = computed(() =>
  Boolean(
    props.context.incotermId
    && props.context.polId
    && props.context.mode
    && (
      !['Fcl', 'Ftl'].includes(props.context.mode)
      || selectedEquipmentId.value
    ),
  ),
)

const working = computed(() => loading.value || Boolean(action.value))

function money(value?: number | null) {
  return value == null ? '—' : formatMoney(value, 'USD')
}

function percentage(value?: number | null) {
  return value == null ? '—' : `${Number(value).toFixed(2)}%`
}

function weight(value?: number | null) {
  return value == null ? '—' : Number(value).toFixed(4)
}

function captureBaselineSales() {
  const rateId = props.rate?.id ?? ''
  if (!rateId || baselineRateId.value === rateId) return

  Object.keys(baselineSales).forEach((key) => delete baselineSales[key])
  for (const detail of props.rate?.rateDetails ?? []) {
    if (detail.costType === 'Fixed') continue
    baselineSales[detail.id] = Number(detail.saleAmount || 0)
  }
  baselineRateId.value = rateId
}

watch(() => props.rate, captureBaselineSales, { immediate: true })

async function loadLatestDecision(silent = true) {
  if (!props.rateId || !canViewAutoPricing.value) return

  try {
    loading.value = true
    decision.value = await MarketPricingService.getAutoPricing(props.rateId)
  } catch (error) {
    decision.value = null
    if (!silent) {
      toastStore.backendError(error, 'No se pudo cargar la decisión de Auto Pricing.')
    }
  } finally {
    loading.value = false
  }
}

async function calculateDraftBenchmark() {
  if (!canCalculateBenchmark.value || !canDraftBenchmark.value) return

  try {
    action.value = 'benchmark'
    benchmark.value = await MarketPricingService.calculateMarketBenchmark({
      incotermId: props.context.incotermId!,
      polId: props.context.polId!,
      poeId: props.context.poeId || null,
      podId: props.context.podId || null,
      containerTypeId: selectedEquipmentId.value,
      mode: props.context.mode,
      carrierId: props.context.carrierId || null,
      referenceDate: props.context.referenceDate || null,
      amountKind: 'AllIn',
      targetPercentile: 60,
      competitiveCeilingPercentile: 65,
    })
  } catch (error) {
    toastStore.backendError(error, 'No se pudo calcular el benchmark de mercado.')
  } finally {
    action.value = ''
  }
}

async function calculateAutoPricing(recalculate = false) {
  if (!props.rateId || !canCalculateAutoPricing.value) return

  try {
    action.value = recalculate ? 'recalculate' : 'calculate'
    const payload = {
      referenceDate: props.context.referenceDate || null,
      benchmarkAmountKind: 'AllIn' as const,
      containerTypeId: selectedEquipmentId.value,
    }

    calculation.value = recalculate
      ? await MarketPricingService.recalculateAutoPricing(props.rateId, payload)
      : await MarketPricingService.calculateAutoPricing(props.rateId, payload)

    decision.value = null
    benchmark.value = calculation.value.benchmark
    toastStore.success(
      recalculate ? 'Auto Pricing recalculado' : 'Auto Pricing calculado',
      `Precio sugerido ${money(calculation.value.position.suggestedSalePrice)} · confianza ${percentage(calculation.value.benchmark.confidenceScore)}.`,
    )
  } catch (error) {
    toastStore.backendError(
      error,
      recalculate
        ? 'No se pudo recalcular Auto Pricing.'
        : 'No se pudo calcular Auto Pricing.',
    )
  } finally {
    action.value = ''
  }
}

async function applySuggestedPrice() {
  if (
    !props.rateId
    || !activeDecisionId.value
    || !calculation.value
    || !canApplyAutoPricing.value
  ) return

  try {
    action.value = 'apply'
    const result = await MarketPricingService.applyAutoPricing(props.rateId, {
      decisionId: activeDecisionId.value,
      referenceDate: props.context.referenceDate || null,
      benchmarkAmountKind: 'AllIn',
      containerTypeId: selectedEquipmentId.value,
    })

    toastStore.success(
      'Precio sugerido aplicado',
      `Venta ${money(result.appliedSaleTotal)} · margen ${percentage(result.appliedMarginPercentage)}.`,
    )

    calculation.value = null
    emit('refreshed')
    await loadLatestDecision()
  } catch (error) {
    toastStore.backendError(
      error,
      'No se pudo aplicar el precio sugerido. Si la tarifa cambió, recalcule primero.',
    )
  } finally {
    action.value = ''
  }
}

function openOverride() {
  if (!props.rate?.rateDetails?.length) return

  Object.keys(overrideSales).forEach((key) => delete overrideSales[key])
  for (const detail of props.rate.rateDetails) {
    overrideSales[detail.id] = Number(detail.saleAmount || 0)
  }
  overrideReason.value = ''
  showOverride.value = true
}

async function submitOverride() {
  if (
    !props.rateId
    || !activeDecisionId.value
    || !canOverrideAutoPricing.value
    || !overrideReason.value.trim()
  ) return

  try {
    action.value = 'override'
    const result = await MarketPricingService.overrideAutoPricing(props.rateId, {
      decisionId: activeDecisionId.value,
      reason: overrideReason.value.trim(),
      details: (props.rate?.rateDetails ?? [])
        .filter((detail) => detail.costType !== 'Fixed')
        .map((detail) => ({
          rateDetailId: detail.id,
          saleAmount: Math.max(0, Number(overrideSales[detail.id] ?? detail.saleAmount ?? 0)),
        })),
    })

    toastStore.success(
      'Ajuste manual guardado',
      `Venta final ${money(result.finalSaleTotal)} · margen ${percentage(result.marginPercentage)}.`,
    )
    showOverride.value = false
    calculation.value = null
    emit('refreshed')
    await loadLatestDecision()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el ajuste manual.')
  } finally {
    action.value = ''
  }
}

async function restoreOriginalValues() {
  if (
    !props.rateId
    || !activeDecisionId.value
    || !canOverrideAutoPricing.value
    || !Object.keys(baselineSales).length
  ) return

  try {
    action.value = 'restore'
    await MarketPricingService.overrideAutoPricing(props.rateId, {
      decisionId: activeDecisionId.value,
      reason: 'Restauración de valores originales desde Market Benchmark.',
      details: Object.entries(baselineSales).map(([rateDetailId, saleAmount]) => ({
        rateDetailId,
        saleAmount,
      })),
    })

    toastStore.success('Valores originales restaurados.')
    calculation.value = null
    emit('refreshed')
    await loadLatestDecision()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron restaurar los valores originales.')
  } finally {
    action.value = ''
  }
}

async function approveDecision() {
  if (
    !props.rateId
    || !activeDecisionId.value
    || !canApproveAutoPricing.value
  ) return

  try {
    action.value = 'approve'
    await MarketPricingService.approveAutoPricing(props.rateId, {
      decisionId: activeDecisionId.value,
    })

    toastStore.success('Auto Pricing aprobado', 'La decisión quedó registrada como revisada.')
    await loadLatestDecision(false)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aprobar la decisión de Auto Pricing.')
  } finally {
    action.value = ''
  }
}

async function initialize() {
  captureBaselineSales()

  if (props.rateId) {
    await loadLatestDecision()

    if (
      !decision.value
      && !props.viewOnly
      && canCalculateAutoPricing.value
    ) {
      await calculateAutoPricing(false)
    }

    return
  }

  if (canCalculateBenchmark.value && canDraftBenchmark.value) {
    await calculateDraftBenchmark()
  }
}

watch(
  () => props.rateId,
  () => void initialize(),
)

watch(
  selectedEquipmentId,
  async (value, previous) => {
    if (!value || value === previous) return
    calculation.value = null
    decision.value = null
    benchmark.value = null

    if (props.rateId) {
      if (!props.viewOnly && canCalculateAutoPricing.value) {
        await calculateAutoPricing(false)
      } else if (canViewBenchmark.value) {
        try {
          action.value = 'benchmark'
          benchmark.value = await MarketPricingService.getRateMarketBenchmark(
            props.rateId,
            {
              containerTypeId: value,
              referenceDate: props.context.referenceDate || null,
              amountKind: 'AllIn',
              targetPercentile: 60,
              competitiveCeilingPercentile: 65,
            },
          )
        } catch (error) {
          toastStore.backendError(error, 'No se pudo cargar el benchmark del equipo seleccionado.')
        } finally {
          action.value = ''
        }
      }
    } else {
      await calculateDraftBenchmark()
    }
  },
)

onMounted(() => void initialize())
</script>

<template>
  <section class="market-panel space-y-5">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="market-icon"><BarChart3 class="h-5 w-5" /></span>
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">
              Market Benchmark
            </p>
            <h3 class="mt-1 text-lg font-black text-[var(--dh-text)]">
              Posición de Dhole contra mercado comparable
            </h3>
          </div>
          <DhBadge :variant="confidenceTone">
            Confianza {{ percentage(marketStats.confidenceScore) }}
          </DhBadge>
          <DhBadge v-if="displayStatus !== 'NotCalculated'" variant="neutral">
            {{ displayStatus }}
          </DhBadge>
        </div>

        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          <span><strong>Incoterm:</strong> {{ context.incotermLabel || '—' }}</span>
          <span>
            <strong>Ruta:</strong>
            {{ [context.polLabel, context.poeLabel, context.podLabel].filter(Boolean).join(' → ') || '—' }}
          </span>
          <span><strong>Modalidad:</strong> {{ context.mode }}</span>
          <span><strong>Naviera:</strong> {{ context.carrierLabel || 'Mercado general' }}</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <DhButton
          v-if="!rateId && canCalculateBenchmark"
          variant="secondary"
          :disabled="working || !canDraftBenchmark"
          @click="calculateDraftBenchmark"
        >
          <Calculator class="h-4 w-4" />
          {{ action === 'benchmark' ? 'Calculando…' : 'Calcular mercado' }}
        </DhButton>

        <DhButton
          v-if="rateId && canCalculateAutoPricing && !viewOnly"
          variant="secondary"
          :disabled="working"
          @click="calculateAutoPricing(Boolean(activeDecisionId))"
        >
          <RefreshCw class="h-4 w-4" />
          {{ action === 'recalculate' ? 'Recalculando…' : activeDecisionId ? 'Recalcular' : 'Calcular Auto Pricing' }}
        </DhButton>
      </div>
    </div>

    <div
      v-if="hasMultipleEquipment"
      class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card-hover)] p-4"
    >
      <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
        Benchmark por equipo
      </p>
      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
        La cotización tiene varios tipos de equipo. Revise cada línea de mercado por separado.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="equipment in equipmentOptions"
          :key="equipment.id"
          type="button"
          class="rounded-xl border px-3 py-2 text-xs font-black transition"
          :class="
            selectedEquipmentId === equipment.id
              ? 'border-[rgb(var(--dh-primary-rgb)/0.45)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]'
              : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-soft)] hover:bg-[var(--dh-card-hover)]'
          "
          @click="selectedEquipmentId = equipment.id"
        >
          {{ equipment.label }}
        </button>
      </div>
    </div>

    <div
      v-if="loading"
      class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card-hover)] px-4 py-8 text-center text-sm font-bold text-[var(--dh-text-muted)]"
    >
      Cargando decisión de mercado…
    </div>

    <template v-else-if="marketStats.observationCount || calculation || decision || benchmark">
      <div
        v-if="marketStats.hasSufficientMarketData === false"
        class="flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-semibold text-amber-800 dark:text-amber-200"
      >
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <strong>No existe suficiente mercado comparable para auto-aplicar una tarifa.</strong>
          <p class="mt-1 text-xs">
            La referencia puede revisarse manualmente, pero Dhole no debe inventar un precio de alta confianza.
          </p>
        </div>
      </div>

      <div
        v-if="marketStats.carrierFallbackUsed"
        class="rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] px-4 py-3 text-xs font-bold text-amber-700 dark:text-amber-300"
      >
        No hubo suficiente muestra con la naviera principal. Se usó mercado secundario y la confianza fue reducida.
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="market-stat">
          <span>Competidores</span>
          <strong>{{ marketStats.competitorCount }}</strong>
        </div>
        <div class="market-stat">
          <span>Tarifas comparables</span>
          <strong>{{ marketStats.observationCount }}</strong>
        </div>
        <div class="market-stat">
          <span>P25</span>
          <strong>{{ money(marketStats.p25) }}</strong>
        </div>
        <div class="market-stat">
          <span>Rango P25–P75</span>
          <strong>{{ money(marketStats.p25) }} – {{ money(marketStats.p75) }}</strong>
        </div>
        <div class="market-stat">
          <span>Mediana</span>
          <strong>{{ money(marketStats.median) }}</strong>
        </div>
        <div class="market-stat">
          <span>Weighted Average</span>
          <strong>{{ money(marketStats.weightedAverage) }}</strong>
        </div>
        <div class="market-stat">
          <span>Target P60</span>
          <strong class="text-[var(--dh-primary)]">{{ money(marketStats.targetMarketPrice) }}</strong>
        </div>
        <div class="market-stat">
          <span>Competitive Ceiling</span>
          <strong>{{ money(marketStats.competitiveCeiling) }}</strong>
        </div>
        <div class="market-stat">
          <span>P65</span>
          <strong>{{ money(marketStats.p65) }}</strong>
        </div>
        <div class="market-stat">
          <span>Outliers</span>
          <strong>{{ marketStats.outlierCount }}</strong>
        </div>
        <div class="market-stat">
          <span>Confidence</span>
          <strong>{{ percentage(marketStats.confidenceScore) }}</strong>
        </div>
      </div>

      <div v-if="position" class="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
                Market Position
              </p>
              <h4 class="mt-1 text-base font-black">Nuestra posición</h4>
            </div>
            <DhBadge :variant="marketPositionTone">{{ position.status }}</DhBadge>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div class="market-money">
              <span>Costo Dhole</span>
              <strong>{{ money(position.cost) }}</strong>
            </div>
            <div class="market-money">
              <span>Venta original</span>
              <strong>{{ money(position.originalSale) }}</strong>
            </div>
            <div class="market-money market-money--primary">
              <span>Venta sugerida</span>
              <strong>{{ money(position.suggestedSalePrice) }}</strong>
            </div>
            <div class="market-money">
              <span>Margen actual</span>
              <strong>{{ percentage(position.currentMargin) }}</strong>
            </div>
            <div class="market-money">
              <span>Margen sugerido</span>
              <strong>{{ percentage(position.suggestedMargin) }}</strong>
            </div>
            <div class="market-money">
              <span>Available Headroom</span>
              <strong>{{ money(position.availableHeadroom) }}</strong>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.3)] bg-[rgb(var(--dh-primary-rgb)/0.07)] p-5">
          <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
            Suggested Price
          </p>
          <p class="mt-3 text-3xl font-black text-[var(--dh-primary)]">
            {{ money(position.suggestedSalePrice) }}
          </p>
          <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
            Target de mercado {{ money(marketStats.targetMarketPrice) }} · techo competitivo
            {{ money(marketStats.competitiveCeiling) }}.
          </p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <DhButton variant="secondary" size="sm" @click="showObservations = !showObservations">
          <Eye class="h-4 w-4" /> Ver tarifas utilizadas
        </DhButton>
        <DhButton variant="secondary" size="sm" @click="showCalculation = !showCalculation">
          <Calculator class="h-4 w-4" /> Ver cálculo
        </DhButton>
        <DhButton
          v-if="calculation?.adjustments?.length"
          variant="secondary"
          size="sm"
          @click="showAdjustments = !showAdjustments"
        >
          <SlidersHorizontal class="h-4 w-4" /> Ver ajustes realizados
        </DhButton>
      </div>

      <div
        v-if="showCalculation"
        class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"
      >
        <div class="flex items-center gap-2">
          <WandSparkles class="h-5 w-5 text-[var(--dh-primary)]" />
          <h4 class="font-black">¿Por qué Dhole eligió este precio?</h4>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm">
          <div><span class="market-label">Observaciones usadas</span><strong class="block mt-1">{{ marketStats.observationCount }}</strong></div>
          <div><span class="market-label">Competidores</span><strong class="block mt-1">{{ marketStats.competitorCount }}</strong></div>
          <div><span class="market-label">Weighted Average</span><strong class="block mt-1">{{ money(marketStats.weightedAverage) }}</strong></div>
          <div><span class="market-label">Target P60</span><strong class="block mt-1">{{ money(marketStats.targetMarketPrice) }}</strong></div>
          <div><span class="market-label">Competitive Ceiling</span><strong class="block mt-1">{{ money(marketStats.competitiveCeiling) }}</strong></div>
          <div><span class="market-label">Minimum sale by margin</span><strong class="block mt-1">{{ money(position?.minimumSalePrice) }}</strong></div>
          <div><span class="market-label">Selected</span><strong class="block mt-1 text-[var(--dh-primary)]">{{ money(position?.suggestedSalePrice) }}</strong></div>
          <div><span class="market-label">Algoritmo</span><strong class="block mt-1 break-all text-xs">{{ marketStats.algorithmVersion || '—' }}</strong></div>
        </div>
      </div>

      <div
        v-if="showAdjustments && calculation?.adjustments?.length"
        class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5"
      >
        <h4 class="font-black">Ajustes automáticos</h4>
        <div class="mt-4 grid gap-2">
          <div
            v-for="adjustment in calculation.adjustments"
            :key="adjustment.rateDetailId"
            class="grid gap-2 rounded-xl bg-[var(--dh-card-hover)] px-3 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          >
            <div>
              <strong>{{ adjustment.chargeCode }}</strong>
              <p v-if="adjustment.protectionReason" class="mt-0.5 text-[10px] text-[var(--dh-text-muted)]">
                Protegido: {{ adjustment.protectionReason }}
              </p>
            </div>
            <span>{{ money(adjustment.originalTotalSaleUsd) }}</span>
            <strong :class="adjustment.adjustmentAmountUsd > 0 ? 'text-emerald-600' : adjustment.adjustmentAmountUsd < 0 ? 'text-rose-600' : ''">
              {{ adjustment.adjustmentAmountUsd > 0 ? '+' : '' }}{{ money(adjustment.adjustmentAmountUsd) }}
            </strong>
          </div>
        </div>
        <div class="mt-3 flex justify-end border-t border-[var(--dh-border)] pt-3 text-sm">
          <strong>Ajuste total: {{ money(calculation.appliedAdjustmentAmount) }}</strong>
        </div>
      </div>

      <div
        v-if="showObservations"
        class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]"
      >
        <div class="border-b border-[var(--dh-border)] px-4 py-3">
          <h4 class="font-black">Competitor Observations</h4>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            Cada fila conserva match, peso y motivo de exclusión para auditoría.
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-[1280px] w-full text-left text-xs">
            <thead class="bg-[var(--dh-card-hover)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
              <tr>
                <th class="px-3 py-3">Empresa</th>
                <th class="px-3 py-3">Incoterm</th>
                <th class="px-3 py-3">POL</th>
                <th class="px-3 py-3">POE</th>
                <th class="px-3 py-3">POD</th>
                <th class="px-3 py-3">Equipo</th>
                <th class="px-3 py-3">Modalidad</th>
                <th class="px-3 py-3">Naviera</th>
                <th class="px-3 py-3 text-right">Tarifa</th>
                <th class="px-3 py-3">Vigencia</th>
                <th class="px-3 py-3 text-right">Match %</th>
                <th class="px-3 py-3 text-right">Peso</th>
                <th class="px-3 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="observation in marketObservations"
                :key="observation.competitorRateObservationId"
                class="border-t border-[var(--dh-border)]"
              >
                <td class="px-3 py-3 font-bold">{{ observation.competitorCompanyName || '—' }}</td>
                <td class="px-3 py-3">{{ observation.incotermCode || '—' }}</td>
                <td class="px-3 py-3">{{ observation.polName || observation.polCode || '—' }}</td>
                <td class="px-3 py-3">{{ observation.poeName || observation.poeCode || '—' }}</td>
                <td class="px-3 py-3">{{ observation.podName || observation.podCode || '—' }}</td>
                <td class="px-3 py-3">{{ observation.containerTypeCode || '—' }}</td>
                <td class="px-3 py-3">{{ observation.mode || '—' }}</td>
                <td class="px-3 py-3">{{ observation.carrierName || observation.carrierCode || '—' }}</td>
                <td class="px-3 py-3 text-right font-black">{{ money(observation.normalizedAmount) }}</td>
                <td class="px-3 py-3">{{ observation.validFrom ? formatDate(observation.validFrom) : '—' }} → {{ observation.validTo ? formatDate(observation.validTo) : '—' }}</td>
                <td class="px-3 py-3 text-right">{{ Number(observation.comparabilityScore || 0).toFixed(1) }}%</td>
                <td class="px-3 py-3 text-right">{{ weight(observation.finalWeight) }}</td>
                <td class="px-3 py-3">
                  <DhBadge :variant="observation.wasIncluded ? 'success' : observation.isOutlier ? 'warning' : 'neutral'">
                    {{ observation.wasIncluded ? 'Included' : observation.isOutlier ? 'Outlier' : 'Excluded' }}
                  </DhBadge>
                  <p v-if="observation.exclusionReason" class="mt-1 max-w-[240px] text-[10px] text-[var(--dh-text-muted)]">
                    {{ observation.exclusionReason }}
                  </p>
                </td>
              </tr>
              <tr v-if="!marketObservations.length">
                <td colspan="13" class="px-4 py-8 text-center font-semibold text-[var(--dh-text-muted)]">
                  No hay observaciones comparables para mostrar.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        v-if="calculation?.validationIssues?.length"
        class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4"
      >
        <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">
          Validaciones
        </p>
        <div class="mt-3 space-y-2">
          <div
            v-for="issue in calculation.validationIssues"
            :key="issue.code"
            class="rounded-xl px-3 py-2 text-xs font-semibold"
            :class="issue.isBlocking ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'bg-amber-400/10 text-amber-700 dark:text-amber-300'"
          >
            <strong>{{ issue.code }}</strong> · {{ issue.message }}
          </div>
        </div>
      </div>

      <div
        v-if="rateId && activeDecisionId && !viewOnly"
        class="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card-hover)] p-4"
      >
        <DhButton
          v-if="canApplyAutoPricing && calculation"
          :disabled="working || !calculation.canApply"
          @click="applySuggestedPrice"
        >
          <WandSparkles class="h-4 w-4" />
          {{ action === 'apply' ? 'Aplicando…' : 'Aplicar precio sugerido' }}
        </DhButton>

        <DhButton
          v-if="canOverrideAutoPricing"
          variant="secondary"
          :disabled="working || !rate?.rateDetails?.length"
          @click="openOverride"
        >
          <SlidersHorizontal class="h-4 w-4" /> Ajustar manualmente
        </DhButton>

        <DhButton
          v-if="canOverrideAutoPricing && Object.keys(baselineSales).length"
          variant="secondary"
          :disabled="working"
          @click="restoreOriginalValues"
        >
          <Undo2 class="h-4 w-4" />
          {{ action === 'restore' ? 'Restaurando…' : 'Restaurar valores originales' }}
        </DhButton>

        <DhButton
          v-if="canApproveAutoPricing"
          variant="secondary"
          :disabled="working || Boolean(decision?.reviewedAtUtc)"
          @click="approveDecision"
        >
          <CheckCircle2 class="h-4 w-4" />
          {{ action === 'approve' ? 'Aprobando…' : decision?.reviewedAtUtc ? 'Auto Pricing aprobado' : 'Aprobar tarifa' }}
        </DhButton>
      </div>

      <div
        v-if="showOverride"
        class="rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.28)] bg-[rgb(var(--dh-primary-rgb)/0.05)] p-5"
      >
        <h4 class="font-black">Ajuste manual</h4>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
          La sugerencia automática se conserva. Estos valores se registran como override auditado.
        </p>

        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DhInput
            v-for="detail in rate?.rateDetails ?? []"
            :key="detail.id"
            :model-value="overrideSales[detail.id] ?? null"
            type="number"
            @update:model-value="(value) => { overrideSales[detail.id] = Math.max(0, Number(value ?? 0)) }"
            min="0"
            step="0.01"
            :label="`${detail.name} · ${detail.currencyCode}`"
            :disabled="detail.costType === 'Fixed'"
          />
        </div>

        <DhTextarea
          v-model="overrideReason"
          class="mt-4"
          label="Motivo del ajuste"
          :rows="3"
          placeholder="Explique por qué Pricing se aparta de la sugerencia automática."
        />

        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <DhButton variant="secondary" :disabled="working" @click="showOverride = false">
            Cancelar
          </DhButton>
          <DhButton :disabled="working || !overrideReason.trim()" @click="submitOverride">
            {{ action === 'override' ? 'Guardando…' : 'Guardar ajuste manual' }}
          </DhButton>
        </div>
      </div>
    </template>

    <div
      v-else
      class="rounded-2xl border border-dashed border-[var(--dh-border-strong)] bg-[var(--dh-card-hover)] px-5 py-7 text-center"
    >
      <Calculator class="mx-auto h-7 w-7 text-[var(--dh-text-muted)]" />
      <p class="mt-3 font-black">
        {{ rateId ? 'Todavía no existe una decisión de Auto Pricing.' : 'Benchmark listo para calcular.' }}
      </p>
      <p class="mx-auto mt-1 max-w-2xl text-xs font-semibold text-[var(--dh-text-muted)]">
        {{
          rateId
            ? 'Calcule el mercado para obtener precio sugerido, confidence, observaciones y ajustes.'
            : 'En una tarifa nueva Dhole puede calcular el mercado desde el borrador. El Auto Pricing completo se activa una vez guardada la tarifa.'
        }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.market-panel {
  border: 1px solid color-mix(in srgb, var(--dh-border-strong) 82%, transparent);
  border-radius: 24px;
  background: color-mix(in srgb, var(--dh-card) 96%, var(--dh-text) 4%);
  box-shadow: 0 20px 54px rgb(15 23 42 / 0.10), inset 0 1px 0 rgb(255 255 255 / 0.28);
  padding: 1.25rem;
  backdrop-filter: blur(28px) saturate(140%);
  -webkit-backdrop-filter: blur(28px) saturate(140%);
}

.market-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  background: rgb(var(--dh-primary-rgb) / 0.10);
  color: var(--dh-primary);
}

.market-stat,
.market-money {
  border: 1px solid var(--dh-border);
  border-radius: 16px;
  background: var(--dh-card-hover);
  padding: 0.85rem 1rem;
}

.market-stat span,
.market-money span,
.market-label {
  display: block;
  font-size: 0.625rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dh-text-muted);
}

.market-stat strong,
.market-money strong {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.95rem;
}

.market-money--primary {
  border-color: rgb(var(--dh-primary-rgb) / 0.32);
  background: rgb(var(--dh-primary-rgb) / 0.07);
}

.market-money--primary strong {
  color: var(--dh-primary);
}

@media (max-width: 640px) {
  .market-panel {
    padding: 1rem;
    border-radius: 20px;
  }
}
</style>
