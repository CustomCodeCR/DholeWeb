import { fetchClient } from '@/core/api/fetchConfig'
import { unwrapApiResponse, unwrapListResponse, type ApiResponse } from '@/core/api/apiResponse'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'

// Fixed SRM routes are hosted by Config but authorize only their dedicated srm.* scopes.
// Never expose generic catalog group/item administration to SRM-only users.
export type SrmCollection = 'suppliers' | 'evaluations' | 'contracts'
export interface SrmRecordInput {
  name: string
  description?: string | null
  value?: string | null
  metadataJson: string
  sortOrder: number
}
export interface SrmLegacyPartner {
  sourceGroup: 'carriers' | 'agents'
  id: string
  code: string
  name: string
  imported: boolean
}
const base = '/api/config/srm'

export const SrmApi = {
  async legacyPartners(): Promise<SrmLegacyPartner[]> {
    return fetchClient<SrmLegacyPartner[]>(base + '/legacy-partners', { method: 'GET' })
  },
  async importLegacyPartner(source: 'carriers' | 'agents', id: string): Promise<unknown> {
    return fetchClient<unknown>(base + '/legacy-partners/' + source + '/' + encodeURIComponent(id) + '/import',
      { method: 'POST' })
  },
  async list(collection: SrmCollection): Promise<CatalogItemDto[]> {
    const response = await fetchClient<unknown>(base + '/' + collection, { method: 'GET' })
    return unwrapListResponse<CatalogItemDto>(response)
  },
  async create(collection: SrmCollection, body: SrmRecordInput): Promise<string> {
    const response = await fetchClient<string | ApiResponse<string>>(base + '/' + collection, { method: 'POST', body })
    return unwrapApiResponse<string>(response)
  },
  async updateSupplier(id: string, body: SrmRecordInput): Promise<void> {
    await fetchClient<unknown>(base + '/suppliers/' + encodeURIComponent(id), { method: 'PUT', body })
  },
}
