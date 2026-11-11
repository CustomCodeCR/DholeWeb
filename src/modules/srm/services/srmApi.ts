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

/** Config can return a 200 response carrying an application-level failure. */
export function srmMutationFailure(response: unknown): string | null {
  let current: unknown = response
  for (let depth = 0; depth < 3; depth++) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) break
    const result = current as Record<string, unknown>
    if (result.success === false || result.isSuccess === false) {
      if (typeof result.message === 'string' && result.message.trim()) return result.message
      if (Array.isArray(result.errors) && result.errors.length)
        return result.errors.map(String).join(', ')
      return 'El servicio de proveedores rechazó el guardado.'
    }
    current = result.data ?? result.result
  }
  return null
}
function verifySrmMutation(response: unknown): void {
  const message = srmMutationFailure(response)
  if (message) throw new Error(message)
}

export const SrmApi = {
  // Config-owned classification catalog, read via SRM-only permissions.
  async listTypes(): Promise<CatalogItemDto[]> {
    const response = await fetchClient<unknown>(base + '/supplier-types', { method: 'GET' })
    return unwrapListResponse<CatalogItemDto>(response)
  },
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
    verifySrmMutation(response)
    return unwrapApiResponse<string>(response)
  },
  async updateSupplier(id: string, body: SrmRecordInput): Promise<void> {
    const response = await fetchClient<unknown>(base + '/suppliers/' + encodeURIComponent(id), { method: 'PUT', body })
    verifySrmMutation(response)
  },
}
