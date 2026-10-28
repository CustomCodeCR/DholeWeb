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
import { DhModal } from '@/shared/components/organisms'
import { AI_SCOPES, PRICING_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { MarketPricingService } from '@/core/services/marketPricingService'
import { PricingService } from '@/core/services/pricingService'
import PricingCompetitorTariffFileModal from '@/modules/pricing/components/PricingCompetitorTariffFileModal.vue'
import { AiService } from '@/core/services/aiService'
import type { RateDto, ShipmentMode } from '@/core/interfaces/pricing'
import type {
  AutoPricingCalculationDto,
  AutoPricingDecisionDto,
  MarketBenchmarkDto,
  MarketBenchmarkObservationDto,
  MarketCoverageDto,
  CalculateMarketBenchmarkRequest,
} from '@/core/interfaces/marketPricing'
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'

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
  draftCostTotalUsd?: number
  draftSaleTotalUsd?: number
  minimumMarginPercentage?: number
}>(), {
  rateId: null,
  rate: null,
  viewOnly: false,
  draftCostTotalUsd: 0,
  draftSaleTotalUsd: 0,
  minimumMarginPercentage: 12,
})

const emit = defineEmits<{
  refreshed: []
  applyDraftSuggestion: [suggestedSaleTotalUsd: number]
}>()

const authStore = useAuthStore()
const toastStore = useToastStore()
const pricingCatalogs = usePricingCatalogs()

const benchmark = ref<MarketBenchmarkDto | null>(null)
const marketCoverage = ref<MarketCoverageDto | null>(null)
const marketCoverageLoading = ref(false)
const marketCoverageError = ref('')
const calculation = ref<AutoPricingCalculationDto | null>(null)
const decision = ref<AutoPricingDecisionDto | null>(null)
const loading = ref(false)
const action = ref('')
const showObservations = ref(false)
const showDraftSuggestionConfirmation = ref(false)
const hasAutoOpenedDraftSuggestion = ref(false)
const sourceStorageId = ref<string | null>(null)
const sourceFileLoadingId = ref<string | null>(null)
let sourceFileRequestId = 0
const showCalculation = ref(false)
const showAdjustments = ref(false)
const showOverride = ref(false)
const overrideReason = ref('')
const overrideSales = reactive<Record<string, number>>({})
const baselineSales = reactive<Record<string, number>>({})
const baselineRateId = ref('')

const aiDraftSuggestion = ref<{
  suggestedSaleTotalUsd: number
  reason: string
  risk: string
  modelName: string
} | null>(null)
const aiDraftAnalyzing = ref(false)
const aiDraftAnalysisError = ref('')

const selectedEquipmentId = ref<string | null>(props.context.containerTypeId ?? null)
let draftBenchmarkRequestId = 0
let aiDraftRequestId = 0

const canViewBenchmark = computed(() => authStore.hasScope(PRICING_SCOPES.marketBenchmark.view))
const canCalculateBenchmark = computed(() => authStore.hasScope(PRICING_SCOPES.marketBenchmark.calculate))
const canViewAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.view))
const canCalculateAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.calculate))
const canApplyAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.apply))
const canOverrideAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.override))
const canApproveAutoPricing = computed(() => authStore.hasScope(PRICING_SCOPES.autoPricing.approve))
const canExecuteMarketAi = computed(() => authStore.hasScope(AI_SCOPES.executions.execute))

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

function localTodayIso() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

const marketReferenceDay = computed(() => {
  const selected = props.context.referenceDate?.slice(0, 10) || ''
  const today = localTodayIso()
  return selected > today ? selected : today
})

const marketUpcomingCutoff = computed(() => {
  const date = new Date(marketReferenceDay.value + 'T12:00:00')
  date.setDate(date.getDate() + 7)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
})

function observationIncotermValue(observation: MarketBenchmarkObservationDto) {
  const incoterm = pricingCatalogs.incoterms.value.find(item =>
    (observation.incotermId && item.id === observation.incotermId)
    || (observation.incotermCode && item.code.toUpperCase() === observation.incotermCode.toUpperCase()),
  )
  // Codes are internal identifiers (e.g. INC-2026-004), not business values.
  return incoterm?.value || '—'
}

const marketObservations = computed<MarketBenchmarkObservationDto[]>(() => {
  const rows = calculation.value?.benchmark.observations
    ?? benchmark.value?.observations
    ?? decision.value?.observations
    ?? []
  // The backend inclusion flag is authoritative: no excluded or outlier
  // observation should appear in the tariffs actually used by Average.
  return rows.filter(observation => observation.wasIncluded && !observation.isOutlier)
})

async function openCompetitorSource(observation: MarketBenchmarkObservationDto) {
  const tariffId = observation.competitorTariffId
  if (!tariffId) {
    toastStore.error('Documento no disponible', 'Esta observación no tiene un tarifario de origen asociado.')
    return
  }

  const requestId = ++sourceFileRequestId
  sourceFileLoadingId.value = observation.competitorRateObservationId
  try {
    const tariff = await PricingService.getCompetitorTariff(tariffId)
    if (requestId !== sourceFileRequestId) return
    if (!tariff.storageId) {
      toastStore.error('Documento no disponible', 'El tarifario no tiene un archivo original asociado.')
      return
    }
    sourceStorageId.value = tariff.storageId
  } catch (error) {
    if (requestId === sourceFileRequestId) {
      toastStore.backendError(error, 'No se pudo abrir el archivo original de la tarifa.')
    }
  } finally {
    if (requestId === sourceFileRequestId) sourceFileLoadingId.value = null
  }
}

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

const marketCoverageRows = computed(() =>
  [...(marketCoverage.value?.documents ?? [])]
    .sort((a, b) => b.matchingPolCount - a.matchingPolCount
      || b.eligibleCount - a.eligibleCount)
    .slice(0, 12),
)

const draftLowMarketTarget = computed(() => {
  if (props.rateId) return null
  const source = calculation.value?.benchmark ?? benchmark.value
  if (!source) return null

  return source.p40
    ?? source.p50
    ?? source.weightedAverage
    ?? source.median
    ?? source.targetMarketPrice
    ?? null
})

const draftMinimumSalePrice = computed(() => {
  const cost = Math.max(0, Number(props.draftCostTotalUsd || 0))
  if (cost <= 0) return 0

  const margin = Math.min(99.99, Math.max(0, Number(props.minimumMarginPercentage || 0))) / 100
  return cost / (1 - margin)
})

const draftCostFloorPrice = computed(() =>
  Math.max(0, Number(props.draftCostTotalUsd || 0)),
)

const draftSuggestedSalePrice = computed(() => {
  const marketSuggestion = aiDraftSuggestion.value?.suggestedSaleTotalUsd
    ?? draftLowMarketTarget.value

  if (marketSuggestion == null || marketSuggestion <= 0) return null

  // The 12% margin is an approval threshold, not a reason to inflate a market
  // suggestion beyond competitor reality. Never recommend a loss, but keep the
  // price as close as possible to the comparable market.
  return Math.max(draftCostFloorPrice.value, marketSuggestion)
})


const hasAvailableAverage = computed(() =>
  Boolean(
    !props.rateId
    && benchmark.value
    && marketStats.value.observationCount > 0
    && marketObservations.value.length > 0,
  ),
)

// Compare the same fixed cost against current and suggested SALE (without IVA).
// The 12% threshold is informative; it must never inflate Average's sale target.
const draftSaleComparison = computed(() => {
  const cost = draftCostFloorPrice.value
  const currentSale = Math.max(0, Number(props.draftSaleTotalUsd || 0))
  const suggestedSale = draftSuggestedSalePrice.value
  if (!hasAvailableAverage.value || suggestedSale == null || !Number.isFinite(suggestedSale)) {
    return null
  }

  const currentMargin = currentSale > 0 ? ((currentSale - cost) / currentSale) * 100 : 0
  const suggestedMargin = suggestedSale > 0 ? ((suggestedSale - cost) / suggestedSale) * 100 : 0
  const marginDifference = suggestedMargin - currentMargin
  return {
    cost,
    currentSale,
    suggestedSale,
    currentMargin,
    suggestedMargin,
    marginDifference,
    saleDifference: suggestedSale - currentSale,
    direction: marginDifference > 0.005 ? 'higher' : marginDifference < -0.005 ? 'lower' : 'equal',
  } as const
})

const draftSuggestionSource = computed(() =>
  aiDraftSuggestion.value ? 'IA + Average' : 'Average',
)

const draftRequiresLowMarginApproval = computed(() => {
  const suggestion = draftSuggestedSalePrice.value
  if (!suggestion || suggestion <= 0) return false

  const cost = draftCostFloorPrice.value
  const margin = ((suggestion - cost) / suggestion) * 100
  return margin + 0.0001 < Number(props.minimumMarginPercentage || 0)
})

function clampDraftAiSuggestion(value: number) {
  const stats = marketStats.value
  const lowerMarket = stats.p25 ?? draftLowMarketTarget.value ?? 0
  const upperMarket =
    stats.p50
    ?? stats.p60
    ?? stats.competitiveCeiling
    ?? draftLowMarketTarget.value
    ?? lowerMarket

  // When our cost is already above the competitive range, the closest
  // non-loss recommendation is the cost itself. Margin approval is handled
  // separately instead of pushing the price all the way to 12%.
  const lower = Math.max(draftCostFloorPrice.value, lowerMarket)
  const upper = Math.max(lower, upperMarket)

  return Math.min(upper, Math.max(lower, value))
}

async function analyzeDraftMarketWithAi() {
  aiDraftSuggestion.value = null
  aiDraftAnalysisError.value = ''

  if (
    props.rateId
    || props.viewOnly
    || !benchmark.value
    || benchmark.value.observationCount <= 0
    || !canExecuteMarketAi.value
  ) {
    return
  }

  const aiRequestId = ++aiDraftRequestId
  aiDraftAnalyzing.value = true
  try {
    const included = marketObservations.value
      .filter((observation) => observation.wasIncluded && !observation.isOutlier)
      .slice(0, 30)
      .map((observation) => ({
        competitor: observation.competitorCompanyName,
        normalizedAmount: observation.normalizedAmount,
        comparabilityScore: observation.comparabilityScore,
        finalWeight: observation.finalWeight,
      }))

    const result = await AiService.executeStructured({
      profileKey: 'assistant',
      correlationId: crypto.randomUUID(),
      messages: [
        {
          role: 'system',
          content:
            'Actúe como analista de pricing logístico. Debe recomendar únicamente el TOTAL DE VENTA en USD. '
            + 'El costo es inmutable y jamás debe sugerir modificarlo. Priorice una venta cercana a la parte baja-media '
            + 'del mercado comparable (aprox. P25-P50). El margen mínimo es un UMBRAL DE APROBACIÓN, no un piso que '
            + 'permita alejar artificialmente la venta del mercado. Nunca recomiende vender por debajo del costo. '
            + 'Si el costo ya está por encima del mercado, recomiende el precio sin pérdida más cercano posible y explique '
            + 'que requiere revisión/aprobación por margen bajo. No invente tarifas ni datos.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            route: {
              incoterm: props.context.incotermLabel,
              pol: props.context.polLabel,
              poe: props.context.poeLabel,
              pod: props.context.podLabel,
              mode: props.context.mode,
              carrier: props.context.carrierLabel,
              equipment: props.context.containerLabel,
            },
            immutableCostTotalUsd: Number(props.draftCostTotalUsd || 0),
            currentSaleTotalUsd: Number(props.draftSaleTotalUsd || 0),
            minimumMarginPercentage: Number(props.minimumMarginPercentage || 0),
            approvalThresholdSaleUsd: draftMinimumSalePrice.value,
            nonLossFloorUsd: draftCostFloorPrice.value,
            market: {
              p25: marketStats.value.p25,
              p40: marketStats.value.p40,
              p50: marketStats.value.p50,
              p60: marketStats.value.p60,
              p65: marketStats.value.p65,
              p75: marketStats.value.p75,
              median: marketStats.value.median,
              weightedAverage: marketStats.value.weightedAverage,
              competitiveCeiling: marketStats.value.competitiveCeiling,
              confidenceScore: marketStats.value.confidenceScore,
              observationCount: marketStats.value.observationCount,
              competitorCount: marketStats.value.competitorCount,
            },
            comparableObservations: included,
          }),
        },
      ],
      jsonSchemaOverride: JSON.stringify({
        type: 'object',
        additionalProperties: false,
        required: ['suggestedSaleTotalUsd', 'reason', 'risk'],
        properties: {
          suggestedSaleTotalUsd: { type: 'number', minimum: 0 },
          reason: { type: 'string' },
          risk: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
          },
        },
      }),
    })

    const parsed = JSON.parse(result.jsonContent) as {
      suggestedSaleTotalUsd?: number
      reason?: string
      risk?: string
    }
    const rawSuggestion = Number(parsed.suggestedSaleTotalUsd)
    if (!Number.isFinite(rawSuggestion) || rawSuggestion <= 0) return

    if (aiRequestId !== aiDraftRequestId) return
    aiDraftSuggestion.value = {
      suggestedSaleTotalUsd: clampDraftAiSuggestion(rawSuggestion),
      reason: String(parsed.reason || '').trim()
        || 'Sugerencia basada en el rango bajo-medio del mercado comparable.',
      risk: String(parsed.risk || 'medium'),
      modelName: result.modelName,
    }
  } catch {
    if (aiRequestId !== aiDraftRequestId) return
    // Average sigue siendo el fallback autoritativo si IA no está disponible.
    aiDraftAnalysisError.value =
      'IA no disponible; la sugerencia se calculó de forma determinística con Average.'
  } finally {
    if (aiRequestId === aiDraftRequestId) aiDraftAnalyzing.value = false
  }
}

const position = computed(() => {
  if (calculation.value) return calculation.value.position

  if (!decision.value) {
    const suggested = draftSuggestedSalePrice.value
    if (props.rateId || suggested == null) return null

    const cost = Math.max(0, Number(props.draftCostTotalUsd || 0))
    const originalSale = Math.max(0, Number(props.draftSaleTotalUsd || 0))
    const suggestedMargin = suggested > 0 ? ((suggested - cost) / suggested) * 100 : 0
    const currentMargin = originalSale > 0 ? ((originalSale - cost) / originalSale) * 100 : 0
    const ceiling = marketStats.value.competitiveCeiling
    const lowerMarket = marketStats.value.p25

    let status = 'Competitive'
    if (draftRequiresLowMarginApproval.value) status = 'BelowMinimumMargin'
    else if (ceiling != null && suggested > ceiling) status = 'AboveCompetitiveRange'
    else if (lowerMarket != null && suggested < lowerMarket) status = 'BelowCompetitiveRange'

    return {
      cost,
      originalSale,
      minimumSalePrice: draftMinimumSalePrice.value,
      marketMedian: marketStats.value.median,
      weightedMarketAverage: marketStats.value.weightedAverage,
      targetMarketPrice: draftLowMarketTarget.value,
      competitiveCeiling: ceiling,
      suggestedSalePrice: suggested,
      currentMargin,
      suggestedMargin,
      availableHeadroom: suggested - originalSale,
      confidenceScore: marketStats.value.confidenceScore,
      status,
    }
  }

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

// Pantalla 7 creates this component on entry. Wait for the asynchronous
// Average calculation to finish before opening the confirmation. Once dismissed
// or accepted, never reopen automatically during the same visit; the button
// remains available for an explicit manual review.
watch(
  [draftSaleComparison, working],
  ([comparison, isWorking]) => {
    if (
      hasAutoOpenedDraftSuggestion.value
      || props.rateId
      || props.viewOnly
      || isWorking
      || !comparison
    ) return

    hasAutoOpenedDraftSuggestion.value = true
    showDraftSuggestionConfirmation.value = true
  },
  { immediate: true, flush: 'post' },
)

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
    const savedDecision = await MarketPricingService.getAutoPricing(props.rateId)
    const savedRows = savedDecision?.observations ?? []
    const includesStaleRate = savedRows.some(row =>
      row.wasIncluded
      && (
        (row.validTo && row.validTo.slice(0, 10) < marketReferenceDay.value)
        || (row.validFrom && row.validFrom.slice(0, 10) > marketUpcomingCutoff.value)
      ),
    )
    // Old persisted benchmarks can contain quotations that have since expired.
    // Recalculate them instead of showing stale market targets and percentiles.
    decision.value = includesStaleRate ? null : savedDecision
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
  const requestId = ++draftBenchmarkRequestId

  try {
    action.value = 'benchmark'
    const payload: CalculateMarketBenchmarkRequest = {
      incotermId: props.context.incotermId!,
      polId: props.context.polId!,
      poeId: props.context.poeId || null,
      podId: props.context.podId || null,
      containerTypeId: selectedEquipmentId.value,
      mode: props.context.mode,
      carrierId: props.context.carrierId || null,
      referenceDate: props.context.referenceDate || null,
      amountKind: 'AllIn',
      targetPercentile: 40,
      competitiveCeilingPercentile: 65,
    }
    const nextBenchmark = await MarketPricingService.calculateMarketBenchmark(payload)
    if (requestId !== draftBenchmarkRequestId) return
    benchmark.value = nextBenchmark
    showDraftSuggestionConfirmation.value = false
    marketCoverage.value = null
    marketCoverageError.value = ''
    // No silent zero: list which recently imported source documents were
    // rejected by market filtering, without using them for automatic pricing.
    if (nextBenchmark.observationCount === 0) {
      marketCoverageLoading.value = true
      try {
        const result = await MarketPricingService.diagnoseMarketCoverage(payload)
        if (requestId === draftBenchmarkRequestId) marketCoverage.value = result
      } catch {
        if (requestId === draftBenchmarkRequestId) {
          marketCoverageError.value = 'No se pudo consultar el estado de las tarifas cargadas.'
        }
      } finally {
        if (requestId === draftBenchmarkRequestId) marketCoverageLoading.value = false
      }
    }
    // The deterministic benchmark is the immediate recommendation.
    // AI is opt-in only and cannot delay a quote.
  } catch (error) {
    if (requestId === draftBenchmarkRequestId) {
      toastStore.backendError(error, 'No se pudo calcular el benchmark de mercado.')
    }
  } finally {
    if (requestId === draftBenchmarkRequestId) action.value = ''
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

function applyDraftSuggestedPrice() {
  // When there is no real Average sample, there is nothing to confirm or apply.
  if (props.rateId || props.viewOnly || !draftSaleComparison.value || working.value) return
  showDraftSuggestionConfirmation.value = true
}

function confirmDraftSuggestedPrice() {
  if (props.rateId || props.viewOnly || working.value || !draftSaleComparison.value) {
    showDraftSuggestionConfirmation.value = false
    return
  }

  const target = draftSaleComparison.value.suggestedSale
  showDraftSuggestionConfirmation.value = false
  emit('applyDraftSuggestion', target)
  toastStore.success(
    'Sugerencia aplicada a ventas',
    `Venta objetivo ${money(target)}. Los costos no fueron modificados.`,
  )
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
      && props.context.mode !== 'Ftl'
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
    showDraftSuggestionConfirmation.value = false

    if (props.rateId) {
      if (!props.viewOnly && props.context.mode !== 'Ftl' && canCalculateAutoPricing.value) {
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

watch(
  () => [
    props.context.incotermId,
    props.context.polId,
    props.context.poeId,
    props.context.podId,
    props.context.mode,
    props.context.carrierId,
    props.context.referenceDate,
  ].join('|'),
  (_value, _oldValue, onCleanup) => {
    if (props.rateId) return
    draftBenchmarkRequestId += 1
    aiDraftRequestId += 1
    aiDraftAnalyzing.value = false
    benchmark.value = null
    showDraftSuggestionConfirmation.value = false
    marketCoverage.value = null
    marketCoverageError.value = ''
    marketCoverageLoading.value = false
    aiDraftSuggestion.value = null
    aiDraftAnalysisError.value = ''
    const handle = setTimeout(() => {
      if (canCalculateBenchmark.value && canDraftBenchmark.value) {
        void calculateDraftBenchmark()
      }
    }, 180)
    onCleanup(() => clearTimeout(handle))
  },
)

onMounted(() => {
  void pricingCatalogs.loadAll().catch(() => {})
  void initialize()
})
</script>

<template>
  <section class="market-panel space-y-5">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="market-icon"><BarChart3 class="h-5 w-5" /></span>
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">
              Average · precio automático
            </p>
            <h3 class="mt-1 text-lg font-black text-[var(--dh-text)]">
              Sugerencia comercial contra mercado comparable
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
        <p v-if="!rateId" class="mt-3 max-w-3xl text-xs font-semibold text-[var(--dh-text-muted)]">
          Dhole analiza las tarifas comparables y busca una venta competitiva baja dentro del mercado.
          El costo es una referencia fija: la sugerencia nunca modifica costos, únicamente valores de venta.
        </p>
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
      v-if="!rateId && benchmark && (aiDraftSuggestion || aiDraftAnalyzing || aiDraftAnalysisError)"
      class="rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.24)] bg-[rgb(var(--dh-primary-rgb)/0.06)] p-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">
            Análisis IA opcional
          </p>
          <p v-if="aiDraftAnalyzing" class="mt-1 text-sm font-bold">
            Analizando con IA sin detener el cálculo de Average…
          </p>
          <template v-else-if="aiDraftSuggestion">
            <p class="mt-1 text-lg font-black">
              Venta sugerida {{ money(draftSuggestedSalePrice) }}
            </p>
            <p class="mt-1 max-w-3xl text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ aiDraftSuggestion.reason }}
            </p>
          </template>
          <p v-else class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ aiDraftAnalysisError }}
          </p>
        </div>
        <div class="text-right text-xs font-bold text-[var(--dh-text-muted)]">
          <span class="block">{{ draftSuggestionSource }}</span>
          <span v-if="aiDraftSuggestion?.modelName" class="mt-1 block">
            {{ aiDraftSuggestion.modelName }} · riesgo {{ aiDraftSuggestion.risk }}
          </span>
        </div>
      </div>
      <p class="mt-3 text-[11px] font-black text-[var(--dh-text)]">
        Costo fijo {{ money(draftCostTotalUsd) }} · nunca se modifica.
      </p>
      <p
        v-if="draftRequiresLowMarginApproval"
        class="mt-1 text-[11px] font-black text-amber-700 dark:text-amber-300"
      >
        La sugerencia queda por debajo del {{ minimumMarginPercentage }}% de margen: requiere aprobación, pero no se infla por encima del mercado.
      </p>
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
        v-if="!rateId && benchmark && marketStats.observationCount === 0"
        class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card-hover)] p-4"
      >
        <p class="text-xs font-black uppercase tracking-wide text-[var(--dh-text)]">
          Diagnóstico de tarifas de competencia
        </p>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
          Se revisan los documentos importados y se indica por qué sus filas no participan en Average. No se inventan rutas ni precios.
        </p>
        <p v-if="marketCoverageLoading" class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">
          Revisando registros importados…
        </p>
        <p v-else-if="marketCoverageError" class="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
          {{ marketCoverageError }}
        </p>
        <template v-else-if="marketCoverage">
          <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
            {{ marketCoverage.documentsExamined }} archivos revisados ·
            {{ marketCoverage.eligibleObservations }} observaciones que superan el diagnóstico de elegibilidad.
            Fecha de comparación: {{ formatDate(marketCoverage.referenceDate) }}.
          </p>
          <div v-if="marketCoverageRows.length" class="mt-3 overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-[var(--dh-border)] text-[var(--dh-text-muted)]">
                  <th class="px-2 py-2">Tarifario</th>
                  <th class="px-2 py-2">Estado</th>
                  <th class="px-2 py-2 text-right">POL</th>
                  <th class="px-2 py-2 text-right">Elegibles</th>
                  <th class="px-2 py-2">Motivo principal</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in marketCoverageRows"
                  :key="item.competitorTariffId"
                  class="border-b border-[var(--dh-border)]"
                >
                  <td class="max-w-44 px-2 py-2">
                    <span class="block font-bold">{{ item.competitorCompanyName }}</span>
                    <span class="block truncate text-[var(--dh-text-muted)]" :title="item.originalFileName">
                      {{ item.originalFileName }}
                    </span>
                  </td>
                  <td class="px-2 py-2">{{ item.importStatus }}</td>
                  <td class="px-2 py-2 text-right">{{ item.matchingPolCount }}</td>
                  <td class="px-2 py-2 text-right">{{ item.eligibleCount }}</td>
                  <td class="px-2 py-2">{{ item.mainReason || 'Sin bloqueos detectados' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="mt-3 text-xs text-[var(--dh-text-muted)]">
            No hay tarifarios recientes de esta modalidad registrados en Pricing.
          </p>
          <p
            v-if="marketCoverage.eligibleObservations > 0"
            class="mt-3 text-xs font-bold text-amber-700 dark:text-amber-300"
          >
            Existen observaciones aparentemente elegibles, pero Average devuelve cero:
            se requiere revisar los filtros finales del benchmark.
          </p>
        </template>
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
          <span>Target competitivo bajo (P40)</span>
          <strong class="text-[var(--dh-primary)]">{{ money(draftLowMarketTarget ?? marketStats.p40) }}</strong>
        </div>
        <div class="market-stat">
          <span>Target P60</span>
          <strong>{{ money(marketStats.p60) }}</strong>
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
              <span>Costo base · no se modifica</span>
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
            Objetivo competitivo bajo {{ money(draftLowMarketTarget ?? marketStats.targetMarketPrice) }} · techo competitivo
            {{ money(marketStats.competitiveCeiling) }}. La recomendación corresponde únicamente a venta y busca permanecer cerca del mercado sin vender por debajo del costo.
          </p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <DhButton
          v-if="!rateId && !viewOnly && draftSaleComparison"
          :disabled="working"
          @click="applyDraftSuggestedPrice"
        >
          <WandSparkles class="h-4 w-4" />
          Aplicar sugerencia solo a ventas
        </DhButton>
        <DhButton
          v-if="!rateId && benchmark && canExecuteMarketAi && !viewOnly"
          variant="secondary"
          size="sm"
          :disabled="working || aiDraftAnalyzing"
          @click="analyzeDraftMarketWithAi"
        >
          <WandSparkles class="h-4 w-4" /> {{ aiDraftAnalyzing ? 'Analizando con IA…' : 'Análisis IA opcional' }}
        </DhButton>
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
          <div><span class="market-label">Target competitivo bajo P40</span><strong class="block mt-1">{{ money(draftLowMarketTarget ?? marketStats.p40) }}</strong></div>
          <div><span class="market-label">Target P60</span><strong class="block mt-1">{{ money(marketStats.p60) }}</strong></div>
          <div><span class="market-label">Competitive Ceiling</span><strong class="block mt-1">{{ money(marketStats.competitiveCeiling) }}</strong></div>
          <div><span class="market-label">Umbral de venta para {{ minimumMarginPercentage }}%</span><strong class="block mt-1">{{ money(position?.minimumSalePrice) }}</strong></div>
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
            Solo se muestran las tarifas que realmente fueron incluidas en el cálculo del Average.
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
                <td class="px-3 py-3">
                  <button
                    type="button"
                    class="text-left font-bold text-sky-700 underline decoration-dotted underline-offset-4 hover:text-sky-600 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-wait disabled:opacity-60 dark:text-sky-300 dark:hover:text-sky-200"
                    :disabled="Boolean(sourceFileLoadingId)"
                    :aria-label="`Abrir archivo original de ${observation.competitorCompanyName || 'la tarifa'}`"
                    @click="openCompetitorSource(observation)"
                  >
                    {{ sourceFileLoadingId === observation.competitorRateObservationId ? 'Abriendo…' : (observation.competitorCompanyName || '—') }}
                  </button>
                </td>
                <td class="px-3 py-3">{{ observationIncotermValue(observation) }}</td>
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
  <DhModal
    :open="showDraftSuggestionConfirmation && Boolean(draftSaleComparison)"
    title="Confirmar venta sugerida por Average"
    size="lg"
    @close="showDraftSuggestionConfirmation = false"
  >
    <div v-if="draftSaleComparison" class="space-y-5">
      <p class="text-sm font-semibold text-[var(--dh-text-muted)]">
        Revise la venta recomendada antes de aplicarla a los rubros de la cotización.
        El costo permanece fijo y no se modifica ningún monto sin su confirmación.
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-[var(--dh-text-muted)]">Venta actual</p>
          <strong class="mt-2 block text-xl">{{ money(draftSaleComparison.currentSale) }}</strong>
          <p class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">Margen actual</p>
          <strong class="mt-1 block text-lg">{{ percentage(draftSaleComparison.currentMargin) }}</strong>
        </div>
        <div class="rounded-2xl border border-[var(--dh-border-strong)] bg-[var(--dh-card-hover)] p-4">
          <p class="text-[10px] font-black uppercase tracking-widest text-[var(--dh-text-muted)]">Venta sugerida · {{ draftSuggestionSource }}</p>
          <strong class="mt-2 block text-xl text-[var(--dh-primary)]">{{ money(draftSaleComparison.suggestedSale) }}</strong>
          <p class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">Margen sugerido</p>
          <strong class="mt-1 block text-lg text-[var(--dh-primary)]">{{ percentage(draftSaleComparison.suggestedMargin) }}</strong>
        </div>
      </div>

      <div
        class="rounded-xl border p-4 text-sm font-semibold"
        :class="draftSaleComparison.direction === 'lower'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
          : draftSaleComparison.direction === 'higher'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
            : 'border-[var(--dh-border)] bg-[var(--dh-card-hover)] text-[var(--dh-text)]'"
      >
        <p v-if="draftSaleComparison.direction === 'higher'">
          El margen de utilidad aumentará {{ percentage(draftSaleComparison.marginDifference) }} (puntos porcentuales).
        </p>
        <p v-else-if="draftSaleComparison.direction === 'lower'">
          El margen de utilidad disminuirá {{ percentage(Math.abs(draftSaleComparison.marginDifference)) }} (puntos porcentuales).
          Confirme si desea aceptar una venta con menor margen.
        </p>
        <p v-else>El margen de utilidad prácticamente no cambia.</p>
        <p class="mt-2 text-xs">
          Variación de venta: {{ draftSaleComparison.saleDifference >= 0 ? '+' : '−' }}{{ money(Math.abs(draftSaleComparison.saleDifference)) }}.
          Costo sin cambios: {{ money(draftSaleComparison.cost) }}.
        </p>
      </div>

      <p
        v-if="draftSaleComparison.suggestedMargin + 0.0001 < minimumMarginPercentage"
        class="text-xs font-bold text-amber-700 dark:text-amber-300"
      >
        Atención: el margen sugerido es inferior al mínimo de {{ percentage(minimumMarginPercentage) }}.
        La aplicación no omite las aprobaciones de Pricing.
      </p>

      <div class="flex flex-wrap justify-end gap-2 border-t border-[var(--dh-border)] pt-4">
        <DhButton variant="secondary" @click="showDraftSuggestionConfirmation = false">
          Mantener venta actual
        </DhButton>
        <DhButton :disabled="working || !draftSaleComparison" @click="confirmDraftSuggestedPrice">
          Confirmar y aplicar venta sugerida
        </DhButton>
      </div>
    </div>
  </DhModal>

  <PricingCompetitorTariffFileModal
    :open="Boolean(sourceStorageId)"
    :storage-id="sourceStorageId"
    @close="sourceStorageId = null"
  />
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
