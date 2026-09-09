import { callEndpoint } from '@/core/api/callEndpoint'
import { fetchBlobClient } from '@/core/api/fetchBlobClient'
import { unwrapListResponse } from '@/core/api/apiResponse'

export interface RequestedRateReportRow {
  id: string
  status: string
  priority: string
  requestedAtUtc: string
  dueAtUtc?: string | null
  completedAtUtc?: string | null
  rateId?: string | null
  sellerUserId: string
  sellerName?: string | null
  sellerEmail?: string | null
  clientName?: string | null
  executiveName?: string | null
  shipmentMode?: string | null
  originName?: string | null
  destinationName?: string | null
  poeId?: string | null
  poeName?: string | null
  podId?: string | null
  podName?: string | null
  payload?: Record<string, unknown> | null
}

const browseEndpoint = {
  method: 'GET' as const,
  path: '/api/pricing/rate-requests/all',
  headers: { Accept: 'application/json' },
}

export const RateRequestReportService = {
  async browse(): Promise<RequestedRateReportRow[]> {
    const response = await callEndpoint<unknown>(browseEndpoint)
    return unwrapListResponse<RequestedRateReportRow>(response)
  },

  async downloadExcel(): Promise<{ blob: Blob; fileName: string }> {
    const blob = await fetchBlobClient('/api/pricing/rate-requests/export.xlsx', {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })

    return {
      blob,
      fileName: 'tarifas-solicitadas.xlsx',
    }
  },
}
