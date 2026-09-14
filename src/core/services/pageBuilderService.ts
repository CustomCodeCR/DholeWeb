import { fetchClient } from '@/core/api/fetchConfig'
import { unwrapApiResponse } from '@/core/api/apiResponse'
import type { PageBuilderDocumentDto, PageBuilderOperationRequest } from '@/core/interfaces/pageBuilder'

export const PageBuilderService = {
  async get(contentId: string): Promise<PageBuilderDocumentDto> {
    return unwrapApiResponse<PageBuilderDocumentDto>(
      await fetchClient<unknown>(`/api/content/page-builder/${contentId}`, { method: 'GET' }) as any,
    )
  },

  async apply(contentId: string, request: PageBuilderOperationRequest): Promise<PageBuilderDocumentDto> {
    return unwrapApiResponse<PageBuilderDocumentDto>(
      await fetchClient<unknown>(`/api/content/page-builder/${contentId}/operations`, {
        method: 'POST',
        body: request,
      }) as any,
    )
  },
}
