import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'

const basePath = '/api/pricing/competitor-analyses'

export interface CompetitorAnalysisDocument {
  id: string
  storageId: string
  originalFileName: string
  sizeInBytes: number
  createdAtUtc: string
  validFromUtc: string | null
  validToUtc: string | null
}

export interface RegisterCompetitorAnalysis {
  id: string
  storageId: string
  originalFileName: string
  sizeInBytes: number
  validFromUtc: string | null
  validToUtc: string | null
}

/** Reports are independent of competitor tariff extraction and Average. */
export const CompetitorAnalysisService = {
  async browse(): Promise<CompetitorAnalysisDocument[]> {
    const response = await callEndpoint<unknown>({
      method: 'GET', path: basePath, headers: { Accept: 'application/json' },
    })
    return unwrapApiResponse<CompetitorAnalysisDocument[]>(response as never)
  },

  async updateValidity(id: string, validFromUtc: string | null, validToUtc: string | null): Promise<CompetitorAnalysisDocument> {
    const response = await callEndpoint<unknown, { validFromUtc: string | null; validToUtc: string | null }>({
      method: 'PATCH', path: `${basePath}/${id}/validity`, headers: { 'Content-Type': 'application/json' },
    }, { body: { validFromUtc, validToUtc } })
    return unwrapApiResponse<CompetitorAnalysisDocument>(response as never)
  },

  async remove(id: string): Promise<void> {
    await callEndpoint<unknown>({ method: 'DELETE', path: `${basePath}/${id}` })
  },

  async register(payload: RegisterCompetitorAnalysis): Promise<CompetitorAnalysisDocument> {
    const response = await callEndpoint<unknown, RegisterCompetitorAnalysis>({
      method: 'POST', path: basePath, headers: { 'Content-Type': 'application/json' },
    }, { body: payload })
    return unwrapApiResponse<CompetitorAnalysisDocument>(response as never)
  },
}
