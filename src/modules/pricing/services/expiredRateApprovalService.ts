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

export const expiredRateApprovalService = {
  async forRate(rateId: string): Promise<ExpiredRateApprovalStatus> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: `${api}/rates/${encodeURIComponent(rateId)}/expired-update-approval`,
    })
    return unwrapApiResponse<ExpiredRateApprovalStatus>(response as never)
  },

  async request(rateId: string, reason: string): Promise<void> {
    await callEndpoint({
      method: 'POST',
      path: `${api}/rates/${encodeURIComponent(rateId)}/expired-update-approval`,
    }, { body: { reason } })
  },

  async pending(): Promise<ExpiredRateApproval[]> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: `${api}/expired-rate-updates/pending`,
    })
    return unwrapApiResponse<ExpiredRateApproval[]>(response as never)
  },

  async decide(approvalId: string, approve: boolean, reason: string): Promise<void> {
    await callEndpoint({
      method: 'POST',
      path: `${api}/expired-rate-updates/${encodeURIComponent(approvalId)}/decision`,
    }, { body: { approve, reason } })
  },
}
