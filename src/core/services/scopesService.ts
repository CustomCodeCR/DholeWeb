import { Endpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapListResponse } from '@/core/api/apiResponse'
import type { ScopeSelectDto } from '@/core/interfaces/scopes'

export const ScopesService = {
  async select(): Promise<ScopeSelectDto[]> {
    const response = await callEndpoint<unknown>(Endpoints.selectScopes)
    return unwrapListResponse<ScopeSelectDto>(response)
  },
}
