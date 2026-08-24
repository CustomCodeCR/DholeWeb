import { ClientBrandingEndpoints } from '@/core/composables/endpoints'
import { callEndpoint } from '@/core/api/callEndpoint'
import { callEndpointWithQuery } from '@/core/api/callEndpointWithQuery'
import { unwrapApiResponse } from '@/core/api/apiResponse'

import type {
  ClientBrandingSettings,
  UpdateClientBrandingRequest,
} from '@/core/interfaces/branding'

const BRANDING_SYNC_ENABLED =
  String(import.meta.env.VITE_CLIENT_BRANDING_SYNC_ENABLED ?? '').trim().toLowerCase() === 'true'

function normalizeBranding(input: ClientBrandingSettings | null | undefined): ClientBrandingSettings | null {
  if (!input) return null

  return {
    clientId: input.clientId ?? null,
    clientCode: input.clientCode ?? null,
    clientName: input.clientName ?? null,
    primaryColor: input.primaryColor,
    backgroundImageUrl: input.backgroundImageUrl ?? null,
    backgroundOverlayOpacity: input.backgroundOverlayOpacity ?? null,
    updatedAt: input.updatedAt ?? null,
  }
}

export const ClientBrandingService = {
  async getCurrent(clientKey?: string | null): Promise<ClientBrandingSettings | null> {
    // Config does not expose client-branding endpoints yet. Keep appearance local until
    // the backend contract exists instead of generating a 404 on every application load.
    if (!BRANDING_SYNC_ENABLED) return null

    const response = await callEndpointWithQuery<ClientBrandingSettings>(
      ClientBrandingEndpoints.getCurrentClientBranding,
      {
        query: clientKey ? { clientKey } : undefined,
      },
    )

    return normalizeBranding(unwrapApiResponse(response))
  },

  async getByClientId(clientId: string): Promise<ClientBrandingSettings | null> {
    if (!BRANDING_SYNC_ENABLED) return null

    const response = await callEndpoint<ClientBrandingSettings>(
      ClientBrandingEndpoints.getClientBranding,
      {
        params: { clientId },
      },
    )

    return normalizeBranding(unwrapApiResponse(response))
  },

  async update(clientId: string, payload: UpdateClientBrandingRequest): Promise<ClientBrandingSettings> {
    if (!BRANDING_SYNC_ENABLED) {
      throw new Error('Client branding synchronization is disabled until Config exposes the endpoint.')
    }

    const response = await callEndpoint<ClientBrandingSettings, UpdateClientBrandingRequest>(
      ClientBrandingEndpoints.updateClientBranding,
      {
        params: { clientId },
        body: payload,
      },
    )

    return unwrapApiResponse(response)
  },
}
