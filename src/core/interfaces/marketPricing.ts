import type { ShipmentMode } from '@/core/interfaces/pricing'

export type MarketBenchmarkAmountKind = 'AllIn' | 'OceanFreight' | 'NormalizedAmount'

export interface MarketBenchmarkObservationDto {
  competitorRateObservationId: string
  competitorCompanyId?: string | null
  competitorCompanyName: string
  incotermId?: string | null
  incotermCode?: string | null
  polId?: string | null
  polName?: string | null
  polCode?: string | null
  poeId?: string | null
  poeName?: string | null
  poeCode?: string | null
  podId?: string | null
  podName?: string | null
  podCode?: string | null
  containerTypeId?: string | null
  containerTypeCode?: string | null
  mode: string
  carrierId?: string | null
  carrierName?: string | null
  carrierCode?: string | null
  validFrom: string
  validTo: string
  originalAmount?: number | null
  normalizedAmount?: number | null
  comparabilityScore: number
  recencyWeight: number
  finalWeight: number
  isPrimaryCarrierMarket: boolean
  isOutlier: boolean
  wasIncluded: boolean
  exclusionReason?: string | null
  outlierReason?: string | null
}

export interface MarketBenchmarkDto {
  candidateCount: number
  observationCount: number
  competitorCount: number
  outlierCount: number
  average?: number | null
  weightedAverage?: number | null
  median?: number | null
  minimum?: number | null
  maximum?: number | null
  standardDeviation?: number | null
  p25?: number | null
  p40?: number | null
  p50?: number | null
  p60?: number | null
  p65?: number | null
  p75?: number | null
  lowerMarket?: number | null
  upperMarket?: number | null
  targetPercentile: number
  competitiveCeilingPercentile: number
  targetMarketPrice?: number | null
  competitiveCeiling?: number | null
  confidenceScore: number
  hasSufficientMarketData: boolean
  carrierFallbackUsed: boolean
  algorithmVersion: string
  observations: MarketBenchmarkObservationDto[]
}

export interface AutoPricingPositionDto {
  cost: number
  originalSale: number
  minimumSalePrice: number
  marketMedian?: number | null
  weightedMarketAverage?: number | null
  targetMarketPrice?: number | null
  competitiveCeiling?: number | null
  suggestedSalePrice: number
  currentMargin: number
  suggestedMargin: number
  availableHeadroom: number
  confidenceScore: number
  status: string
}

export interface AutoPricingAdjustmentDto {
  rateDetailId: string
  chargeCode: string
  currencyCode: string
  quantity: number
  originalUnitSaleAmount: number
  suggestedUnitSaleAmount: number
  originalTotalSaleUsd: number
  suggestedTotalSaleUsd: number
  adjustmentAmountUsd: number
  wasAdjusted: boolean
  isProtected: boolean
  adjustmentPriority?: number | null
  adjustmentStrategy?: string | null
  protectionReason?: string | null
}

export interface AutoPricingValidationIssueDto {
  code: string
  message: string
  isBlocking: boolean
}

export interface AutoPricingCalculationDto {
  decisionId: string
  rateId: string
  status: string
  applicationMode: string
  canApply: boolean
  shouldAutoApply: boolean
  requiresReview: boolean
  desiredSalePrice: number
  appliedAdjustmentAmount: number
  unallocatedAdjustmentAmount: number
  marketDeviationPercentage: number
  algorithmVersion: string
  position: AutoPricingPositionDto
  benchmark: MarketBenchmarkDto
  adjustments: AutoPricingAdjustmentDto[]
  validationIssues: AutoPricingValidationIssueDto[]
}

export interface AutoPricingDecisionDto {
  id: string
  rateId: string
  calculatedAtUtc: string
  comparisonIncotermId?: string | null
  comparisonPolId: string
  comparisonPoeId?: string | null
  comparisonPodId?: string | null
  comparisonContainerTypeId?: string | null
  comparisonMode: string
  comparisonCarrierId?: string | null
  costTotal: number
  originalSaleTotal: number
  suggestedSaleTotal: number
  finalSaleTotal: number
  average?: number | null
  weightedAverage?: number | null
  median?: number | null
  p25?: number | null
  p40?: number | null
  p50?: number | null
  p60?: number | null
  p65?: number | null
  p75?: number | null
  targetMarketPrice?: number | null
  competitiveCeiling?: number | null
  competitorCount: number
  observationCount: number
  confidenceScore: number
  algorithmVersion: string
  wasAutoApplied: boolean
  wasManuallyModified: boolean
  reviewedByUserId?: string | null
  reviewedAtUtc?: string | null
  createdAtUtc: string
  observations: MarketBenchmarkObservationDto[]
}

export interface AutoPricingApplyDto {
  decisionId: string
  rateId: string
  adjustedChargeCount: number
  previousSaleTotal: number
  appliedSaleTotal: number
  appliedMarginPercentage: number
  status: string
}

export interface AutoPricingOverrideDto {
  decisionId: string
  rateId: string
  finalSaleTotal: number
  marginPercentage: number
  reason: string
}

export interface AutoPricingApprovalDto {
  decisionId: string
  rateId: string
  reviewedByUserId: string
  reviewedAtUtc: string
  outcome: string
}

export interface CalculateMarketBenchmarkRequest {
  incotermId: string
  polId: string
  poeId?: string | null
  podId?: string | null
  containerTypeId?: string | null
  mode: ShipmentMode
  carrierId?: string | null
  referenceDate?: string | null
  amountKind?: MarketBenchmarkAmountKind | null
  targetPercentile?: number | null
  competitiveCeilingPercentile?: number | null
}

export interface CalculateAutoPricingRequest {
  profileCode?: string | null
  referenceDate?: string | null
  minimumMarginPercentage?: number | null
  benchmarkAmountKind?: MarketBenchmarkAmountKind | null
  containerTypeId?: string | null
}

export interface ApplyAutoPricingRequest extends CalculateAutoPricingRequest {
  decisionId: string
}

export interface AutoPricingOverrideDetailRequest {
  rateDetailId: string
  saleAmount: number
}

export interface OverrideAutoPricingRequest {
  decisionId: string
  reason: string
  details: AutoPricingOverrideDetailRequest[]
}

export interface ApproveAutoPricingRequest {
  decisionId: string
}
