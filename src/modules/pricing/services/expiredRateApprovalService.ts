import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'

export interface ExpiredRateApproval {
  id: string
  rateId: string
  revisionNumber: number
  reason: string
  requestedByUserId: string
  requestedAtUtc: string
  status: 'Pending' | 'Approved' | 'Rejected'
  decidedByUserId?: string | null
  decidedAtUtc?: string | null
  decisionReason?: string | null
}

export interface ExpiredRateApprovalStatus {
  rateId: string
  revisionNumber: number
  requiresApproval: boolean
  canUpdate: boolean
  currentApproval: ExpiredRateApproval | null
  history: ExpiredRateApproval[]
}

const api = '/api/pricing'
const jsonHeaders = { Accept: 'application/json' }

function requireApprovalStatus(response: unknown, rateId: string): ExpiredRateApprovalStatus {
  const status = unwrapApiResponse<ExpiredRateApprovalStatus>(response as never)
  if (!status || typeof status !== 'object'
    || typeof status.rateId !== 'string' || status.rateId.toLowerCase() !== rateId.toLowerCase()
    || typeof status.canUpdate !== 'boolean' || typeof status.requiresApproval !== 'boolean'
    || !Array.isArray(status.history)) {
    throw new Error('Respuesta de autorización inválida. Intente consultar nuevamente.')
  }
  return status
}

export const expiredRateApprovalService = {
  async forRate(rateId: string): Promise<ExpiredRateApprovalStatus> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      headers: jsonHeaders,
      path: `${api}/rates/${encodeURIComponent(rateId)}/expired-update-approval`,
    })
    return requireApprovalStatus(response, rateId)
  },

  async request(rateId: string, reason: string): Promise<void> {
    const response = await callEndpoint<unknown>({
      method: 'POST',
      headers: jsonHeaders,
      path: `${api}/rates/${encodeURIComponent(rateId)}/expired-update-approval`,
    }, { body: { reason } })
    const result = unwrapApiResponse<{ approvalId?: string; status?: string }>(response as never)
    if (!result || typeof result.approvalId !== 'string' || result.status !== 'Pending') {
      throw new Error('No se pudo confirmar el registro de la solicitud. Consulte su estado antes de reintentar.')
    }
  },

  async pending(): Promise<ExpiredRateApproval[]> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      headers: jsonHeaders,
      path: `${api}/expired-rate-updates/pending`,
    })
    const rows = unwrapApiResponse<ExpiredRateApproval[]>(response as never)
    if (!Array.isArray(rows)) throw new Error('Respuesta de autorizaciones inválida.')
    return rows
  },

  async decide(approvalId: string, approve: boolean, reason: string): Promise<void> {
    await callEndpoint({
      method: 'POST',
      headers: jsonHeaders,
      path: `${api}/expired-rate-updates/${encodeURIComponent(approvalId)}/decision`,
    }, { body: { approve, reason } })
  },
}
