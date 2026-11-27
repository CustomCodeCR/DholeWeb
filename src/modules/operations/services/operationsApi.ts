import { fetchClient } from '@/core/api/fetchConfig'

export type OperationsDepartment = 'APERTURAS' | 'COORDINACION_ORIGEN'
export interface OperationsMember {
  userId: string
  capacityPoints: number
  isSupervisor: boolean
  roleCode?: string | null
  isAvailable: boolean
}
export interface OperationsAssignmentTeam {
  id: string
  name: string
  departmentCode: string
  availableReviewers: number
  canAssign: boolean
}
export interface OperationsTeam {
  id: string
  companyId: string
  departmentCode: string
  name: string
  isActive: boolean
  members: OperationsMember[]
  operatorScopes?: string[]
  supervisorScopes?: string[]
  roleProfiles?: Record<string, string[]>
}
export interface OperationsUser { id: string; displayName: string; userName: string }
export interface OperationsAudit {
  eventId: string
  actionCode: string
  actorUserId: string
  beforeJson: string | null
  afterJson: string | null
  occurredAtUtc: string
}
export interface OperationsValidator {
  canReview?: boolean
  id: string
  slot: number
  userId: string
  status: string
  comment?: string | null
  reviewedAtUtc?: string | null
}
export type OperationsCaseRow = {
  id: string
  idtra: string
  accountId: string
  modalityCode: string
  apertureType: 'MANUAL' | 'AUTOMATIC'
  sourceQuoteId: string | null
  sourceQuoteOptionId: string | null
  quoteNumber?: string | null
  executiveUserId: string
  originCountryCode?: string | null
  destinationCountryCode?: string | null
  departmentCode?: string | null
  departmentStatus?: string | null
  originStatusCode?: string | null
  teamName?: string | null
  assignedUserId?: string | null
  pendingValidatorIds?: string[]
  status: string
  priority: number
  createdAtUtc: string
  updatedAtUtc: string
}
export interface OperationsCaseDetail {
  openingDataJson?: string
  id: string
  idtra: string
  accountId: string
  modalityCode: string
  apertureType: 'MANUAL' | 'AUTOMATIC'
  sourceQuoteId: string | null
  sourceQuoteOptionId: string | null
  executiveUserId: string
  originCountryCode: string | null
  destinationCountryCode: string | null
  companyId: string
  version: number
  complexityPoints: number
  status: string
  priority: number
  createdBy?: string
  createdAtUtc: string
  updatedAtUtc: string
  stages: Array<{ id: string; departmentCode: string; status: string; teamId: string | null; version: number }>
}
export interface ApertureRow {
  id: string
  idtra: string
  companyId: string
  accountId: string
  modalityCode: string
  apertureType: 'MANUAL' | 'AUTOMATIC'
  sourceQuoteId: string | null
  sourceQuoteOptionId: string | null
  status: string
  priority: number
  createdAtUtc: string
  validators: OperationsValidator[]
}
export interface ValidationPair {
  stage: { id: string; status: string; teamId: string | null }
  requiredReviewers: number
  validators: OperationsValidator[]
}
export interface OperationsDashboard {
  teams: Array<{ id: string; name: string; departmentCode: string; isActive: boolean; isSupervisor: boolean }>
  stats: { total: number; manual: number; automatic: number; awaitingAssignment: number; inReview: number; approved: number }
  items: Array<{
    id: string; idtra: string; modalityCode: string; status: string; priority: number
    apertureType: 'MANUAL' | 'AUTOMATIC'; sourceQuoteId: string | null
    createdAtUtc: string; teamId: string | null; approvedReviews: number; pendingReviews: number
    departmentCode?: string | null; canReview?: boolean
  }>
}

export type OperationsTabCode = 'RESUMEN' | 'QUO' | 'COORDINACION_ORIGEN' | 'DOCUMENTACION' | 'TRANSITO' | 'PANAMA' | 'COSTA_RICA' | 'FINANZAS'
export type OperationsTabLevel = 'EDITABLE' | 'READ_ONLY' | 'LOCKED' | 'NOT_APPLICABLE'
export interface OperationsCaseTab { code: OperationsTabCode; accessLevel: OperationsTabLevel }
export interface OperationsCaseWorkspace {
  caseId: string
  commercialData?: Record<string, unknown> | null
  people?: Record<string, string>
  stages: Array<{
    id: string; departmentCode: string; status: string; teamId: string | null
    teamName: string | null; assignedUserId: string | null
    assignedAtUtc?: string | null; supervisorUserIds?: string[]
    startedAtUtc: string | null; completedAtUtc: string | null
  }>
  validators: Array<{
    caseStageId: string; userId: string; slot: number; status: string
    assignedAtUtc: string; reviewedAtUtc: string | null
  }>
  quotes: Array<{
    id: string; quoteId: string; quoteOptionId: string | null; quoteNumber: string | null
    status: string; isPrimary: boolean; snapshotVersion: number; linkedAtUtc: string
  }>
  milestones: Array<{
    id: string; caseStageId: string | null; milestoneCode: string
    title: string; status: string; plannedAtUtc: string | null; actualAtUtc: string | null
  }>
  tasks: Array<{
    id: string; caseStageId: string | null; title: string; details: string | null
    status: string; priority: number; assignedUserId: string | null
    dueAtUtc: string | null; completedAtUtc: string | null
  }>
}
export interface OperationsCaseCost {
  id: string; costCode: string; description: string; supplierName: string | null
  currencyCode: string; costAmount: number; saleAmount: number | null; capturedAtUtc: string
}
export interface OperationsSnapshotCost {
  id: string; description: string | null; costCode: string | null; supplierName: string | null
  currencyCode: string | null; currencyName: string | null; quantity: number | null
  unitCost: number | null; costAmount: number | null; saleAmount: number | null
  costDetailType?: string | null; chargeBasis?: string | null
  sourceCostId?: string | null; supplierId?: string | null
  taxAmount?: number | null; saleTotal?: number | null
}
export interface OperationsCommercialConditions {
  includes: string | null; excludes: string | null; subjectTo: string | null
}
export interface OperationsInternalNote {
  id: string; body: string; createdBy: string
  createdAtUtc: string; updatedAtUtc: string; version: number
}
export interface OperationsOriginProgress {
  caseId: string
  stage: { id: string; status: string; version: number }
  progress: {
    statusCode: string; actualDepartureAtUtc: string | null
    departureSource: string | null; version: number
  } | null
}
export interface OperationsServiceReviewDashboard {
  services: Array<{
    id: string; serviceCode: string; serviceName: string; source: 'QUOTED' | 'OPERATIONS_ADDED'
    requiresPricingReview: boolean; reviewStatus: string
  }>
  alerts: Array<{
    id: string; serviceLineId: string; code: string; severity: 'YELLOW' | 'RED' | 'GREEN'
    status: string; createdAtUtc: string; resolvedAtUtc: string | null
  }>
  reviews: Array<{
    id: string; serviceLineId: string; quoteId: string | null; acceptedOptionId: string | null
    reason: string; status: string; requestedAtUtc: string; resolvedAtUtc: string | null
  }>
}

export type OperationsContact = {
  id: string; accountId: string; name: string; firstName?: string | null; lastName?: string | null
  jobTitle?: string | null; email?: string | null; phone?: string | null
  isPrimary: boolean; isOperationsContact: boolean
}
export type OperationsQuoteComparisonRow = {
  field: string; label: string; quoted: string | null; current: string | null
  status: 'MATCH' | 'CHANGED' | 'UNCONFIRMED'
}
export type OperationsQuoteDiscrepancyReview = {
  id: string; fingerprint: string; status: string; reason: string
  requestedAtUtc: string; resolvedAtUtc: string | null; decisionReason: string | null
  commercialRevision: number; differencesJson: string
}
export interface OperationsQuoteComparison {
  hasSnapshot: boolean; fingerprint: string; rows: OperationsQuoteComparisonRow[]
  version: number; severity: 'UNKNOWN' | 'GREEN' | 'YELLOW' | 'RED'
  currentReview: OperationsQuoteDiscrepancyReview | null
  history: OperationsQuoteDiscrepancyReview[]; canRequest: boolean
}
export interface OperationsManualDraftSnapshot {
  id: string
  version: number
  createdAtUtc: string
  updatedAtUtc: string
  draft: Record<string, unknown>
}

export interface OperationsOpeningEdit {
  openingData?: Record<string, unknown>
  expectedVersion: number
  modalityCode: string
  priority: number
  complexityPoints: number
  originCountryCode: string | null
  destinationCountryCode: string | null
}

export interface CrmAccountOption { id: string; displayName: string; legalName?: string }
export interface OperationsCaseFilters { q?: string; status?: string; apertureType?: string; accountId?: string }
function caseQuery(page: number, pageSize: number, filters: OperationsCaseFilters = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.status) params.set('status', filters.status)
  if (filters.apertureType) params.set('apertureType', filters.apertureType)
  if (filters.accountId) params.set('accountId', filters.accountId)
  return params.toString()
}
export interface Paged<T> { page: number; pageSize: number; total: number; items: T[] }

export type OpeningFieldStatus = 'CONFIRMADO' | 'PENDIENTE_PERMITIDO' | 'PENDIENTE_BLOQUEANTE' | 'NO_APLICA'
export interface OpeningFieldValidation {
  fieldCode: string
  completionStatus: OpeningFieldStatus
  reason?: string | null
}
export interface OpeningCompleteness {
  fields: OpeningFieldValidation[]
  missingFields: string[]
  canPassFieldValidation: boolean
  version?: number
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
function request<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  return fetchClient<T>(path, { method, ...(body === undefined ? {} : { body }) })
}
export const operationsApi = {
  idtraSequence: () => request<{ nextNumber: number }>('/api/operations/idtra-sequence'),
  configureIdtraSequence: (nextNumber: number, expectedNextNumber: number, reason: string) =>
    request<{ nextNumber: number }>('/api/operations/idtra-sequence', 'PUT', { nextNumber, expectedNextNumber, reason }),
  dashboard: (teamId?: string) => request<OperationsDashboard>(
    '/api/operations/dashboard' + (teamId ? '?teamId=' + encodeURIComponent(teamId) : '')),
  cases: (page = 1, filters: OperationsCaseFilters = {}, pageSize = 25) => request<Paged<OperationsCaseRow> & { clientNames?: Record<string, string | null>; people?: Record<string, string> }>(
    '/api/operations/cases?' + caseQuery(page, pageSize, filters)),
  linkQuote: (caseId: string, rateId: string, expectedVersion: number) => request<{ requestId?: string; status: string; duplicate: boolean }>(`/api/operations/cases/${caseId}/quote-links`, 'POST', { rateId, expectedVersion }),
  caseDetail: (id: string) => request<OperationsCaseDetail>('/api/operations/cases/' + id),
  caseContacts: (id: string) => request<OperationsContact[]>(`/api/operations/cases/${id}/operations-contacts`),
  caseQuoteComparison: (id: string) => request<OperationsQuoteComparison>(`/api/operations/cases/${id}/commercial/comparison`),
  requestQuoteReview: (id: string, input: { expectedVersion: number; fingerprint: string; comment: string }) =>
    request<{ reviewId: string; status: string; duplicate: boolean }>(`/api/operations/cases/${id}/commercial/comparison/review`, 'POST', input),
  caseServicesAndReviews: (id: string) =>
    request<OperationsServiceReviewDashboard>(`/api/operations/cases/${id}/services-and-reviews`),
  addCaseService: (id: string, input: { idempotencyKey: string; serviceCode: string;
    serviceName: string; reason: string }) =>
    request<{ serviceId: string; reviewId: string; alertId: string;
      severity: string; reviewStatus: string; duplicate: boolean }>(
        `/api/operations/cases/${id}/services`, 'POST', input),
  caseTabs: (id: string) => request<{ caseId: string; tabs: OperationsCaseTab[] }>(
    `/api/operations/cases/${id}/tabs`),
  caseWorkspace: (id: string) => request<OperationsCaseWorkspace>(
    `/api/operations/cases/${id}/workspace`),
  caseCosts: (id: string) => request<{ caseId: string; items: OperationsCaseCost[]; snapshotItems?: OperationsSnapshotCost[]; conditions?: OperationsCommercialConditions | null }>(
    `/api/operations/cases/${id}/commercial/costs`),
  caseOriginProgress: (id: string) => request<OperationsOriginProgress>(
    `/api/operations/cases/${id}/origin/progress`),
  confirmOriginWeight: (id: string, input: { expectedVersion: number; value: number; unit: string }) =>
    request<{ id: string; version: number; actualWeightKg: number }>(
      `/api/operations/cases/${id}/origin/actual-weight`, 'POST', input),
  updateOriginPlanning: (id: string, input: { expectedVersion: number; etd: string; eta: string; consolidationReference: string; clientPoReference?: string; invoiceReference?: string }) =>
    request<{ id: string; version: number }>(`/api/operations/cases/${id}/origin/planning`, 'POST', input),
  updateOriginStatus: (id: string, statusCode: string, expectedVersion: number) =>
    request<{ statusCode: string; version: number }>(
      `/api/operations/cases/${id}/origin/progress`,
      'POST', { statusCode, expectedVersion }),
  caseInternalNotes: (id: string) => request<OperationsInternalNote[]>(
    `/api/operations/cases/${id}/internal-notes`),
  addCaseInternalNote: (id: string, body: string) =>
    request<{ id: string }>(`/api/operations/cases/${id}/internal-notes`, 'POST', { body }),
  updateCase: (id: string, body: OperationsOpeningEdit) =>
    request<{ id: string; version: number; updatedAtUtc: string }>(
      `/api/operations/cases/${id}`, 'PATCH', body),
  assignmentTeams: (companyId: string) => request<OperationsAssignmentTeam[]>(
    '/api/operations/apertures/assignment-teams?companyId=' + encodeURIComponent(companyId)),
  teams: () => request<OperationsTeam[]>('/api/operations/teams'),
  initializeTeams: () => request<{ created: number; total: number }>('/api/operations/teams/initialize', 'POST'),
  createTeam: (body: { companyId: string; name: string; departmentCode: string }) =>
    request<{ id: string }>('/api/operations/teams', 'POST', body),
  users: async (search = ''): Promise<Paged<OperationsUser>> => {
    // The Auth directory is paginated. Loading only its first page silently
    // hides operators while showing supervisors on larger installations.
    const size = 100
    const items: OperationsUser[] = []
    let page = 1
    let total = 0
    do {
      const response = await request<Paged<OperationsUser>>(
        '/api/auth/users/operations-directory?page=' + page + '&pageSize=' + size +
        '&search=' + encodeURIComponent(search))
      total = response.total
      items.push(...response.items)
      if (response.items.length === 0) break
      page += 1
    } while (items.length < total && page <= 50)
    return { page: 1, pageSize: items.length, total, items }
  },
  addMembers: (teamId: string, body: {
    userIds: string[]; capacityPoints: number; isSupervisor: boolean; isAvailable: boolean; roleCode?: string
  }) => request<{ assigned: number; skippedExisting: number; total: number }>(
    `/api/operations/teams/${teamId}/members/bulk`, 'POST', body),
  saveMember: (teamId: string, body: OperationsMember) =>
    request<{ id: string }>(`/api/operations/teams/${teamId}/members`, 'POST', body),
  removeMember: (teamId: string, userId: string) =>
    request<unknown>(`/api/operations/teams/${teamId}/members/${userId}`, 'DELETE'),
  setTeamActive: (teamId: string, isActive: boolean) =>
    request<unknown>(`/api/operations/teams/${teamId}/active`, 'PATCH', { isActive }),
  teamAudit: (teamId: string) =>
    request<OperationsAudit[]>(`/api/operations/teams/${teamId}/audit`),
  auditActors: (ids: string[]) => ids.length
    ? request<{ items: OperationsUser[] }>('/api/auth/users/operations-audit-actors?ids=' +
        encodeURIComponent([...new Set(ids)].join(',')))
    : Promise.resolve({ items: [] as OperationsUser[] }),
  apertures: (page = 1, filters: OperationsCaseFilters = {}) => request<Paged<ApertureRow>>(
    '/api/operations/apertures/validation-queue?' + caseQuery(page, 50, filters)),
  openingCompleteness: (id: string) => request<OpeningCompleteness>(`/api/operations/cases/${id}/aperture/completeness`),
  previewOpeningCompleteness: (modality: string, accountId: string, openingData: Record<string, unknown>, caseId?: string) =>
    request<OpeningCompleteness>('/api/operations/apertures/drafts/completeness', 'POST', { modality, accountId, openingData, caseId }),
  createContext: () => request<{ companyId: string | null }>('/api/operations/apertures/create-context'),
  getManualOpeningDraft: () =>
    request<OperationsManualDraftSnapshot | Record<string, never>>(
      '/api/operations/apertures/drafts/current'),
  saveManualOpeningDraft: (expectedVersion: number, draft: Record<string, unknown>) =>
    request<Pick<OperationsManualDraftSnapshot, 'id' | 'version' | 'updatedAtUtc'>>(
      '/api/operations/apertures/drafts/current', 'PUT', { expectedVersion, draft }),
  clearManualOpeningDraft: () =>
    request<unknown>('/api/operations/apertures/drafts/current', 'DELETE'),
  crmAccounts: (q: string) => request<Paged<CrmAccountOption>>(
    '/api/crm/accounts?' + new URLSearchParams({ page: '1', pageSize: '50', q: q.trim() }).toString()),
  createAperture: (body: {
    companyId: string; accountId: string; modalityCode: string;
    priority: number; complexityPoints: number; originCountryCode?: string | null;
    destinationCountryCode?: string | null; openingData?: Record<string, unknown>; quoteRateId?: string
  }) => request<{ id: string; idtra: string; status: string }>(
    '/api/operations/cases', 'POST', body),
  validations: (caseId: string) =>
    request<ValidationPair>(`/api/operations/cases/${caseId}/aperture-validations`),
  assign: (caseId: string, teamId?: string) =>
    request<unknown>(`/api/operations/cases/${caseId}/aperture-validations/assign`,
      'POST', { teamId: teamId || null }),
  decide: (caseId: string, validationId: string,
    decision: 'APPROVED' | 'REJECTED', comment?: string) =>
    request<unknown>(
      `/api/operations/cases/${caseId}/aperture-validations/${validationId}/decision`,
      'POST', { decision, comment }),
  caseAudit: (caseId: string) =>
    request<OperationsAudit[]>(`/api/operations/cases/${caseId}/audit`),
}
