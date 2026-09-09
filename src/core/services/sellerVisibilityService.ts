import { callEndpoint } from '@/core/api/callEndpoint'
import { unwrapApiResponse } from '@/core/api/apiResponse'

export interface SellerVisibilityDto {
  viewerUserId: string
  sellerUserIds: string[]
  ownVisibilityIsImplicit?: boolean
}

export const SellerVisibilityService = {
  async get(viewerUserId: string): Promise<SellerVisibilityDto> {
    const response = await callEndpoint<unknown>({
      method: 'GET',
      path: `/api/pricing/seller-visibility/${viewerUserId}`,
      headers: { Accept: 'application/json' },
    })
    return unwrapApiResponse<SellerVisibilityDto>(response as never)
  },

  async replace(viewerUserId: string, sellerUserIds: string[]): Promise<SellerVisibilityDto> {
    const response = await callEndpoint<unknown, { sellerUserIds: string[] }>(
      {
        method: 'PUT',
        path: `/api/pricing/seller-visibility/${viewerUserId}`,
        headers: { Accept: 'application/json' },
      },
      { body: { sellerUserIds } },
    )
    return unwrapApiResponse<SellerVisibilityDto>(response as never)
  },
}
