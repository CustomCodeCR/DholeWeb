import { fetchClient } from '@/core/api/fetchConfig'
import { unwrapApiResponse, unwrapListResponse, type ApiResponse } from '@/core/api/apiResponse'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'
import { srmMutationFailure } from '../utils/srmSupplierSave'
import { retrySrmHaciendaNetwork } from '../utils/srmHacienda'

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
export interface SrmBankAccount {
  id: string
  bankName: string
  accountHolder: string
  registration: 'LOCAL' | 'INTERNACIONAL'
  accountNumber: string
  swiftBic: string
  currency: string
  bankCountryId: string
  intermediaryBank: string
  isPrimary: boolean
}
export interface SrmHaciendaResult {
  identification: string
  name: string
  identificationType: string | null
  regime: string | null
  verifiedAt: string
  activities: { code: string; description: string; type: string }[]
}
const base = '/api/config/srm'

/** Config can return a 200 response carrying an application-level failure. */
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
  async lookupHacienda(identificacion: string, countryId: string): Promise<SrmHaciendaResult> {
    const query = new URLSearchParams({ identificacion, countryId })
    return retrySrmHaciendaNetwork(() =>
      fetchClient<SrmHaciendaResult>(base + '/hacienda/lookup?' + query, { method: 'GET' }))
  },
  async listBankAccounts(supplierId: string): Promise<SrmBankAccount[]> {
    return fetchClient<SrmBankAccount[]>(base + '/suppliers/' +
      encodeURIComponent(supplierId) + '/bank-accounts', { method: 'GET' })
  },
  async saveBankAccounts(supplierId: string, accounts: SrmBankAccount[]): Promise<void> {
    await fetchClient<unknown>(base + '/suppliers/' +
      encodeURIComponent(supplierId) + '/bank-accounts', { method: 'PUT', body: accounts })
  },
  async updateSupplier(id: string, body: SrmRecordInput): Promise<void> {
    const response = await fetchClient<unknown>(base + '/suppliers/' + encodeURIComponent(id), { method: 'PUT', body })
    verifySrmMutation(response)
  },
  async deleteSupplier(id: string): Promise<void> {
    const response = await fetchClient<unknown>(base + '/suppliers/' + encodeURIComponent(id), { method: 'DELETE' })
    verifySrmMutation(response)
  },
}
