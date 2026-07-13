import type { PagedResponse } from '@/core/api/apiResponse'

export type CostType = 'Optional' | 'Fixed' | 'Variable'
export type CostDetailType =
  | 'Freight'
  | 'OriginCharge'
  | 'DestinationCharge'
  | 'PortCharge'
  | 'CustomsCharge'
  | 'InlandTransport'
  | 'AgentCharge'
  | 'Documentation'
  | 'Insurance'
  | 'Other'
export type CostPortRole = 'Any' | 'Pol' | 'Poe' | 'Pod'
export type ImportSourceType = 'Email' | 'Pdf' | 'Excel' | 'Csv' | 'Image'
export type ImportStatus = 'Pending' | 'Approved' | 'Rejected' | 'Created'
export type RateStatus = 'PendingApproval' | 'Approved' | 'Rejected' | 'Draft' | 'Send'

export interface CostDto extends Record<string, unknown> {
  id: string
  name: string
  costType: CostType
  costDetailType: CostDetailType
  carrierId?: string | null
  carrierName?: string | null
  carrierCode?: string | null
  agentId?: string | null
  agentName?: string | null
  agentCode?: string | null
  portId: string
  portName: string
  portCode: string
  portRole: CostPortRole
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: number
  saleAmount: number
  utilityAmount: number
  notes?: string | null
  isActive: boolean
}

// Select responses expose the same commercial fields; IsActive is omitted by
// the API but keeping the DTO shape avoids losing named keys through the
// Record<string, unknown> index signature used by table components.
export type CostSelectDto = CostDto

export interface CreateCostRequest extends Record<string, unknown> {
  name: string
  costType: CostType
  costDetailType: CostDetailType
  carrierId?: string | null
  carrierName?: string | null
  carrierCode?: string | null
  agentId?: string | null
  agentName?: string | null
  agentCode?: string | null
  portId: string
  portName: string
  portCode: string
  portRole: CostPortRole
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: number
  saleAmount: number
  notes?: string | null
}

export type UpdateCostRequest = CreateCostRequest
export interface SetCostActiveRequest extends Record<string, unknown> {
  isActive: boolean
}

export interface ImportRateDto extends Record<string, unknown> {
  id: string
  importBatchId: string
  sourceType: ImportSourceType
  pol: string
  pod: string
  carrier: string
  containerType: string
  currency: string
  freight: number
  freeDays: number
  validFrom: string
  validTo: string
  rawDataJson: string
  status: ImportStatus
  usedAsRateCount: number
}

export type ImportRateSelectDto = ImportRateDto

export interface CatalogSnapshotRequest extends Record<string, unknown> {
  id: string
  name: string
  code: string
  slug: string
}

export interface CreateImportRateRequest extends Record<string, unknown> {
  importBatchId: string
  extractionRecordId: string
  sourceType: ImportSourceType
  profile: CatalogSnapshotRequest
  pol: CatalogSnapshotRequest
  poe: CatalogSnapshotRequest
  pod: CatalogSnapshotRequest
  carrier: CatalogSnapshotRequest
  agent: CatalogSnapshotRequest
  containerType: CatalogSnapshotRequest
  currency: CatalogSnapshotRequest
  commodity?: string | null
  oceanFreight: number
  originCharges: number
  destinationCharges: number
  surcharges: number
  totalCost: number
  totalSale: number
  profit: number
  margin: number
  freeDays: number
  transitDays?: number | null
  validFrom: string
  validTo: string
  rawDataJson?: string | null
}

export interface RejectImportRateRequest extends Record<string, unknown> {
  reason: string
}

export interface ExtractImportRatesIssueDto extends Record<string, unknown> {
  code: string
  message: string
  isBlocking: boolean
  sourceSheetName?: string | null
  sourceRowNumber?: number | null
  columnName?: string | null
  rawValue?: string | null
}

export interface ExtractImportRatesResultDto extends Record<string, unknown> {
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
  issues: ExtractImportRatesIssueDto[]
  errorCode?: string | null
  errorMessage?: string | null
}

export interface RateDetailDto extends Record<string, unknown> {
  id: string
  rateHeaderId: string
  costId?: string | null
  name: string
  costDetailType: CostDetailType
  costType: CostType
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: number
  saleAmount: number
  utilityAmount: number
  notes?: string | null
}

export interface RateDto extends Record<string, unknown> {
  id: string
  sourceImportFclRateId?: string | null
  agentId?: string | null
  agentName?: string | null
  agentCode?: string | null
  carrierId?: string | null
  carrierName?: string | null
  carrierCode?: string | null
  polId: string
  polName: string
  polCode: string
  poeId: string
  poeName: string
  poeCode: string
  podId: string
  podName: string
  podCode: string
  containerTypeId: string
  containerTypeName: string
  containerTypeCode: string
  currencyId: string
  currencyName: string
  currencyCode: string
  freeDays: number
  validFrom: string
  validTo: string
  totalCostAmount: number
  totalSaleAmount: number
  totalUtilityAmount: number
  marginPercentage: number
  requiredApproval: boolean
  status: RateStatus
  rateDetails: RateDetailDto[]
}

export interface RateSelectDto extends Record<string, unknown> {
  id: string
  label: string
  status: RateStatus
  isActive: boolean
}

export interface CreateRateDetailRequest extends Record<string, unknown> {
  costId?: string | null
  name: string
  costDetailType: CostDetailType
  costType: CostType
  currencyId: string
  currencyName: string
  currencyCode: string
  costAmount: number
  saleAmount: number
  notes?: string | null
}

export interface CreateRateRequest extends Record<string, unknown> {
  sourceImportFclRateId?: string | null
  agentId?: string | null
  agentName?: string | null
  agentCode?: string | null
  carrierId?: string | null
  carrierName?: string | null
  carrierCode?: string | null
  polId: string
  polName: string
  polCode: string
  poeId: string
  poeName: string
  poeCode: string
  podId: string
  podName: string
  podCode: string
  containerTypeId: string
  containerTypeName: string
  containerTypeCode: string
  currencyId: string
  currencyName: string
  currencyCode: string
  freeDays: number
  validFrom: string
  validTo: string
  details: CreateRateDetailRequest[]
}

export interface UpsertRateExtraDetailRequest extends CreateRateDetailRequest {
  id?: string | null
}

export interface UpdateRateRequest extends Omit<
  CreateRateRequest,
  'sourceImportFclRateId' | 'details'
> {
  agentId: string
  agentName: string
  agentCode: string
  carrierId: string
  carrierName: string
  carrierCode: string
  extraDetails: UpsertRateExtraDetailRequest[]
  removedExtraDetailIds: string[]
}

export interface DuplicateRateRequest extends Record<string, unknown> {
  validFrom: string
  validTo: string
}

export interface RejectRateMarginRequest extends Record<string, unknown> {
  reason: string
}
export interface DeleteBatchRequest extends Record<string, unknown> {
  ids: string[]
}

export interface BrowseCostsQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string | null
  costType?: CostType | null
  costDetailType?: CostDetailType | null
  carrierId?: string | null
  agentId?: string | null
  portId?: string | null
  portRole?: CostPortRole | null
  currencyId?: string | null
  isActive?: boolean | null
}

export interface BrowseImportRatesQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string | null
  importBatchId?: string | null
  sourceType?: ImportSourceType | null
  status?: ImportStatus | null
  pol?: string | null
  pod?: string | null
  carrier?: string | null
  containerType?: string | null
  currency?: string | null
  quoteDate?: string | null
  validFrom?: string | null
  validTo?: string | null
}

export interface BrowseRatesQuery extends Record<string, unknown> {
  pageNumber?: number
  pageSize?: number
  search?: string | null
  sourceImportFclRateId?: string | null
  agentId?: string | null
  carrierId?: string | null
  polId?: string | null
  poeId?: string | null
  podId?: string | null
  containerTypeId?: string | null
  currencyId?: string | null
  status?: RateStatus | null
  requiredApproval?: boolean | null
  quoteDate?: string | null
  validFrom?: string | null
  validTo?: string | null
}

export type CostPagedResponse = PagedResponse<CostDto>
export type ImportRatePagedResponse = PagedResponse<ImportRateDto>
export type RatePagedResponse = PagedResponse<RateDto>
