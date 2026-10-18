import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'

const basePath = '/api/pricing/competitor-analyses'

export interface CompetitorAnalysisDocument {
  id: string
  storageId: string
  originalFileName: string
  sizeInBytes: number
  createdAtUtc: string
}

export interface RegisterCompetitorAnalysis {
  id: string
  storageId: string
  originalFileName: string
  sizeInBytes: number
}

/** Reports are independent of competitor tariff extraction and Average. */
export const CompetitorAnalysisService = {
  async browse(): Promise<CompetitorAnalysisDocument[]> {
    const response = await callEndpoint<unknown>({
      method: 'GET', path: basePath, headers: { Accept: 'application/json' },
    })
    return unwrapApiResponse<CompetitorAnalysisDocument[]>(response as never)
  },

  async register(payload: RegisterCompetitorAnalysis): Promise<CompetitorAnalysisDocument> {
    const response = await callEndpoint<unknown, RegisterCompetitorAnalysis>({
      method: 'POST', path: basePath, headers: { 'Content-Type': 'application/json' },
    }, { body: payload })
    return unwrapApiResponse<CompetitorAnalysisDocument>(response as never)
  },
}
