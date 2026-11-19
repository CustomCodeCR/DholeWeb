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
  status: string
  priority: number
  updatedAtUtc: string
}
export interface OperationsCaseDetail {
  id: string
  idtra: string
  accountId: string
  modalityCode: string
  status: string
  priority: number
  updatedAtUtc: string
  stages: Array<{ id: string; departmentCode: string; status: string; teamId: string | null; version: number }>
}
export interface ApertureRow {
  id: string
  idtra: string
  companyId: string
  accountId: string
  modalityCode: string
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
  stats: { total: number; awaitingAssignment: number; inReview: number; approved: number }
  items: Array<{
    id: string; idtra: string; modalityCode: string; status: string; priority: number
    createdAtUtc: string; teamId: string | null; approvedReviews: number; pendingReviews: number
  }>
}
export interface Paged<T> { page: number; pageSize: number; total: number; items: T[] }

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'
function request<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  return fetchClient<T>(path, { method, ...(body === undefined ? {} : { body }) })
}
export const operationsApi = {
  dashboard: (teamId?: string) => request<OperationsDashboard>(
    '/api/operations/dashboard' + (teamId ? '?teamId=' + encodeURIComponent(teamId) : '')),
  cases: (page = 1) => request<Paged<OperationsCaseRow>>('/api/operations/cases?page=' + page + '&pageSize=25'),
  caseDetail: (id: string) => request<OperationsCaseDetail>('/api/operations/cases/' + id),
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
  apertures: (page = 1) => request<Paged<ApertureRow>>(
    `/api/operations/apertures/validation-queue?page=${page}&pageSize=50`),
  createAperture: (body: {
    companyId: string; accountId: string; seriesCode: string; modalityCode: string;
    executiveUserId: string; priority: number; complexityPoints: number
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
