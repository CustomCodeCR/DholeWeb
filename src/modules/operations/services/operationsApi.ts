import { fetchClient } from '@/core/api/fetchConfig'

export type OperationsDepartment = 'APERTURAS' | 'COORDINACION_ORIGEN'
export interface OperationsMember {
  userId: string
  capacityPoints: number
  isSupervisor: boolean
  isAvailable: boolean
}
export interface OperationsTeam {
  id: string
  companyId: string
  departmentCode: string
  name: string
  isActive: boolean
  members: OperationsMember[]
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
  executiveUserId: string
  originCountryCode?: string | null
  destinationCountryCode?: string | null
  departmentCode?: string | null
  status: string
  priority: number
  createdAtUtc: string
  updatedAtUtc: string
}
export interface OperationsCaseDetail {
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
  }>
}

export type OperationsTabCode = 'RESUMEN' | 'QUO' | 'COORDINACION_ORIGEN' | 'DOCUMENTACION' | 'TRANSITO' | 'PANAMA' | 'COSTA_RICA' | 'FINANZAS'
export type OperationsTabLevel = 'EDITABLE' | 'READ_ONLY' | 'LOCKED' | 'NOT_APPLICABLE'
export interface OperationsCaseTab { code: OperationsTabCode; accessLevel: OperationsTabLevel }
export interface OperationsCaseWorkspace {
  caseId: string
  stages: Array<{
    id: string; departmentCode: string; status: string; teamId: string | null
    teamName: string | null; assignedUserId: string | null
    startedAtUtc: string | null; completedAtUtc: string | null
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
export interface OperationsOpeningEdit {
  expectedVersion: number
  modalityCode: string
  priority: number
  complexityPoints: number
  originCountryCode: string | null
  destinationCountryCode: string | null
}

export interface ApertureEquipmentLine {
  equipmentCode: string
  quantity: number
}
export interface ApertureDraft {
  clientPoReference: string | null
  crmDivisionId: string | null
  shipmentTypeCode: string | null
  transportTypeCode: string | null
  incotermCode: string | null
  polCode: string | null
  poeCode: string | null
  podCode: string | null
  cargoDescription: string | null
  weightValue: number | null
  weightUnit: 'KG' | 'LB'
  weightKg?: number | null
  volumeValue: number | null
  volumeUnit: 'CBM' | 'CFT'
  volumeCbm?: number | null
  packageCount: number | null
  packageTypeCode: string | null
  requiresPickup: boolean
  pickupAddress: string | null
  pickupContact: string | null
  pickupWindow: string | null
  warehouseName: string | null
  consolidationReference: string | null
  isImo: boolean
  imoClass: string | null
  unNumber: string | null
  stackable: boolean | null
  isOverweight: boolean
  overweightNotes: string | null
  carrierCode: string | null
  agentCode: string | null
  merchantCode: string | null
  bookingReference: string | null
  collectionReference: string | null
  estimatedDepartureAtUtc: string | null
  estimatedArrivalAtUtc: string | null
  observations: string | null
  equipment: ApertureEquipmentLine[]
  serviceCodes: string[]
  operationalContactIds?: string[]
}
export interface ApertureCompleteness {
  details: ApertureDraft
  version: number
  status: string
  missingBlocking: string[]
}
export interface OperationsManualCaseRequest {
  companyId: string
  accountId: string
  modalityCode: string
  priority: number
  complexityPoints: number
  originCountryCode?: string | null
  destinationCountryCode?: string | null
  details?: ApertureDraft
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

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
function request<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  return fetchClient<T>(path, { method, ...(body === undefined ? {} : { body }) })
}
export const operationsApi = {
  dashboard: (teamId?: string) => request<OperationsDashboard>(
    '/api/operations/dashboard' + (teamId ? '?teamId=' + encodeURIComponent(teamId) : '')),
  cases: (page = 1, filters: OperationsCaseFilters = {}) => request<Paged<OperationsCaseRow>>(
    '/api/operations/cases?' + caseQuery(page, 25, filters)),
  caseDetail: (id: string) => request<OperationsCaseDetail>('/api/operations/cases/' + id),
  caseTabs: (id: string) => request<{ caseId: string; tabs: OperationsCaseTab[] }>(
    `/api/operations/cases/${id}/tabs`),
  caseWorkspace: (id: string) => request<OperationsCaseWorkspace>(
    `/api/operations/cases/${id}/workspace`),
  caseCosts: (id: string) => request<{ caseId: string; items: OperationsCaseCost[] }>(
    `/api/operations/cases/${id}/commercial/costs`),
  caseOriginProgress: (id: string) => request<OperationsOriginProgress>(
    `/api/operations/cases/${id}/origin/progress`),
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
    userIds: string[]; capacityPoints: number; isSupervisor: boolean; isAvailable: boolean
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
  createContext: () => request<{ companyId: string | null; idtraCounterReady: boolean }>('/api/operations/apertures/create-context'),
  synchronizeIdtraCounter: (lastIssuedIdtra: string, reference: string) =>
    request<{ ready: boolean; nextFormat: string }>(
      '/api/operations/apertures/idtra-counter/synchronize', 'POST',
      { lastIssuedIdtra, reference }),
  apertureDetails: (id: string) => request<ApertureCompleteness>(
    `/api/operations/cases/${id}/aperture-details`),
  updateApertureDetails: (id: string, expectedVersion: number, details: ApertureDraft,
    metadata: {
      modalityCode: string
      originCountryCode: string | null
      destinationCountryCode: string | null
      priority: number
      complexityPoints: number
    }) =>
    request<{ id: string; version: number; missingBlocking: string[] }>(
      `/api/operations/cases/${id}/aperture-details`, 'PUT',
      { expectedVersion, details, ...metadata }),
  submitAperture: (id: string, expectedVersion: number) =>
    request<{ id: string; status: string; version: number }>(
      `/api/operations/cases/${id}/submit-aperture`, 'POST', { expectedVersion }),
  crmAccounts: (q: string) => request<Paged<CrmAccountOption>>(
    '/api/crm/accounts?' + new URLSearchParams({ page: '1', pageSize: '50', q: q.trim() }).toString()),
  createAperture: (body: OperationsManualCaseRequest) =>
    request<{ id: string; idtra: string; status: string }>(
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
