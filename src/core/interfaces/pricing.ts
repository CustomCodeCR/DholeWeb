import type { PagedResponse } from '@/core/api/apiResponse'

export interface CostDto extends Record<string, unknown> {
  id: string
  name: string
  rateType: string
  carrierId?: string | null
  carrierNameSnapshot?: string | null
  carrierCodeSnapshot?: string | null
  portId?: string | null
  portNameSnapshot?: string | null
  portCodeSnapshot?: string | null
  portRole: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  amount: number
  saleAmount: number
  isFixed: boolean
  requiresManualAmount: boolean
  isActive: boolean
}

export interface CostSelectDto extends Record<string, unknown> {
  id: string
  name: string
  rateType: string
  carrierId?: string | null
  carrierNameSnapshot?: string | null
  carrierCodeSnapshot?: string | null
  portId?: string | null
  portNameSnapshot?: string | null
  portCodeSnapshot?: string | null
  portRole: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  amount: number
  saleAmount: number
  isFixed: boolean
  requiresManualAmount: boolean
}

export interface CreateCostRequest extends Record<string, unknown> {
  name: string
  rateType: string
  carrierId?: string | null
  carrierNameSnapshot?: string | null
  carrierCodeSnapshot?: string | null
  portId?: string | null
  portNameSnapshot?: string | null
  portCodeSnapshot?: string | null
  portRole: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  amount: number
  saleAmount?: number | null
  isFixed: boolean
  requiresManualAmount: boolean
}

export interface UpdateCostRequest extends CreateCostRequest {}
export interface SetCostActiveRequest extends Record<string, unknown> { isActive: boolean }

export interface ImportFclRateDto extends Record<string, unknown> {
  id: string
  importBatchId: string
  sourceType: string
  pol: string
  pod: string
  carrier: string
  containerType: string
  currency: string
  amount: number
  freeDays?: number | null
  validFrom?: string | null
  validTo?: string | null
  extractionConfidence?: number | null
  status: string
  errorMessage?: string | null
  rawDataJson?: string | null
  createdAsRateHeaderId?: string | null
}

export interface ImportFclRateSelectDto extends Record<string, unknown> {
  id: string
  label: string
  carrier: string
  pol: string
  pod: string
  containerType: string
  currency: string
  amount: number
  status: string
}

export interface CreateImportFclRateRequest extends Record<string, unknown> {
  sourceType: string
  pol: string
  pod: string
  carrier: string
  containerType: string
  currency: string
  amount: number
  freeDays?: number | null
  validFrom?: string | null
  validTo?: string | null
  extractionConfidence?: number | null
  rawDataJson?: string | null
}

export interface RejectImportFclRateRequest extends Record<string, unknown> { errorMessage: string }

export interface ExtractImportFclRatesIssueDto extends Record<string, unknown> {
  code: string
  message: string
  isBlocking: boolean
  sourceSheetName?: string | null
  sourceRowNumber?: number | null
  columnName?: string | null
  rawValue?: string | null
}

export interface ExtractImportFclRatesResultDto extends Record<string, unknown> {
  success: boolean
  pricingImportId: string
  correlationId: string
  totalRows: number
  validRows: number
  warningRows: number
  invalidRows: number
  createdRows: number
  skippedRows: number
  hasIssues: boolean
  importFclRateIds: string[]
  issues: ExtractImportFclRatesIssueDto[]
  errorCode?: string | null
  errorMessage?: string | null
}

export interface FclRateDetailDto extends Record<string, unknown> {
  id: string
  rateHeaderId: string
  sourceImportFclRateId?: string | null
  carrierId: string
  carrierNameSnapshot: string
  carrierCodeSnapshot: string
  originPortId: string
  originPortNameSnapshot: string
  originPortCodeSnapshot: string
  destinationPortId: string
  destinationPortNameSnapshot: string
  destinationPortCodeSnapshot: string
  containerTypeId: string
  containerTypeNameSnapshot: string
  containerTypeCodeSnapshot: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  amount: number
  freeDays?: number | null
  validFrom?: string | null
  validTo?: string | null
  notes?: string | null
  saleAmount?: number | null
  marginPercentage?: number | null
}

export interface RateCostDetailDto extends Record<string, unknown> {
  id: string
  rateHeaderId: string
  costId?: string | null
  name: string
  costType: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  amount: number
  saleAmount?: number | null
  isFixed: boolean
  isManual: boolean
  notes?: string | null
}


export interface MarginApprovalDto extends Record<string, unknown> {
  id: string
  rateHeaderId: string
  requestedMargin: number
  minimumMargin: number
  requestedBy?: string | null
  approvedBy?: string | null
  status: string
  reason?: string | null
  createdAt: string
  approvedAt?: string | null
}

export interface ApproveMarginApprovalRequest extends Record<string, unknown> {
  reason?: string | null
}

export interface RejectMarginApprovalRequest extends Record<string, unknown> {
  reason: string
}

export interface RateHeaderDto extends Record<string, unknown> {
  id: string
  sourceImportFclRateId?: string | null
  clientId?: string | null
  clientNameSnapshot?: string | null
  rateType: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  validFrom?: string | null
  validTo?: string | null
  totalCostAmount: number
  saleAmount: number
  marginAmount: number
  marginPercentage: number
  requiresApproval: boolean
  status: string
  isActive: boolean
  fclRateDetails: FclRateDetailDto[]
  costDetails: RateCostDetailDto[]
  marginApprovals: MarginApprovalDto[]
}

export interface RateHeaderSelectDto extends Record<string, unknown> {
  id: string
  label: string
  rateType: string
  status: string
  isActive: boolean
}

export interface CreateRateHeaderRequest extends Record<string, unknown> {
  sourceImportFclRateId?: string | null
  clientId?: string | null
  clientNameSnapshot?: string | null
  rateType: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  validFrom?: string | null
  validTo?: string | null
}

export interface UpdateRateHeaderRequest extends Record<string, unknown> {
  clientId?: string | null
  clientNameSnapshot?: string | null
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  validFrom?: string | null
  validTo?: string | null
}

export interface SetRateHeaderAmountsRequest extends Record<string, unknown> {
  totalCostAmount: number
  saleAmount: number
}

export interface SetRateHeaderActiveRequest extends Record<string, unknown> { isActive: boolean }

export interface DuplicateRateHeaderRequest extends Record<string, unknown> {
  clientId?: string | null
  clientNameSnapshot?: string | null
  marginPercentage?: number | null
  saleAmount?: number | null
}

export interface CreateFclRateDetailRequest extends Record<string, unknown> {
  sourceImportFclRateId?: string | null
  carrierId: string
  carrierNameSnapshot: string
  carrierCodeSnapshot: string
  originPortId: string
  originPortNameSnapshot: string
  originPortCodeSnapshot: string
  destinationPortId: string
  destinationPortNameSnapshot: string
  destinationPortCodeSnapshot: string
  containerTypeId: string
  containerTypeNameSnapshot: string
  containerTypeCodeSnapshot: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  amount: number
  freeDays?: number | null
  validFrom?: string | null
  validTo?: string | null
  notes?: string | null
}

export interface UpdateFclRateDetailRequest extends CreateFclRateDetailRequest {
  sourceImportFclRateId?: string | null
}

export interface CreateRateCostDetailRequest extends Record<string, unknown> {
  costId?: string | null
  name: string
  costType: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  amount: number
  saleAmount?: number | null
  isFixed: boolean
  isManual: boolean
  notes?: string | null
}

export interface UpdateRateCostDetailRequest extends CreateRateCostDetailRequest {}

export interface CreateRateFromImportFclRateRequest extends Record<string, unknown> {
  clientId?: string | null
  clientNameSnapshot?: string | null
  carrierId: string
  carrierNameSnapshot: string
  carrierCodeSnapshot: string
  originPortId: string
  originPortNameSnapshot: string
  originPortCodeSnapshot: string
  destinationPortId: string
  destinationPortNameSnapshot: string
  destinationPortCodeSnapshot: string
  containerTypeId: string
  containerTypeNameSnapshot: string
  containerTypeCodeSnapshot: string
  currencyId: string
  currencyNameSnapshot: string
  currencyCodeSnapshot: string
  validFrom?: string | null
  validTo?: string | null
  notes?: string | null
  saleAmount?: number | null
  marginPercentage?: number | null
}

export interface BrowseCostsQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string | null
  rateType?: string | null
  carrierId?: string | null
  portId?: string | null
  portRole?: string | null
  currencyId?: string | null
  isFixed?: boolean | null
  requiresManualAmount?: boolean | null
  isActive?: boolean | null
}

export interface BrowseImportFclRatesQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string | null
  sourceType?: string | null
  status?: string | null
  carrier?: string | null
  pol?: string | null
  pod?: string | null
  containerType?: string | null
  currency?: string | null
  validFrom?: string | null
  validTo?: string | null
}

export interface BrowseRateHeadersQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string | null
  rateType?: string | null
  status?: string | null
  clientId?: string | null
  currencyId?: string | null
  isActive?: boolean | null
  requiresApproval?: boolean | null
  carrierId?: string | null
  originPortId?: string | null
  destinationPortId?: string | null
  containerTypeId?: string | null
  validFrom?: string | null
  validTo?: string | null
}

export interface PricingDashboardDto extends Record<string, unknown> {
  activeRates: number
  importsInReview: number
  costs: number
  lowMarginRates: number
}

export type CostPagedResponse = PagedResponse<CostDto>
export type ImportFclRatePagedResponse = PagedResponse<ImportFclRateDto>
export type RateHeaderPagedResponse = PagedResponse<RateHeaderDto>

export interface DeleteBatchRequest extends Record<string, unknown> {
  ids: string[]
}
