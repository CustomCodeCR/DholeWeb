import { ClientBrandingEndpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { callEndpointWithQuery } from '@/core/api/callEndpointWithQuery';
import { unwrapApiResponse } from '@/core/api/apiResponse';
function normalizeBranding(input) {
    if (!input)
        return null;
    return {
        clientId: input.clientId ?? null,
        clientCode: input.clientCode ?? null,
        clientName: input.clientName ?? null,
        primaryColor: input.primaryColor,
        backgroundImageUrl: input.backgroundImageUrl ?? null,
        backgroundOverlayOpacity: input.backgroundOverlayOpacity ?? null,
        updatedAt: input.updatedAt ?? null,
    };
}
export const ClientBrandingService = {
    async getCurrent(clientKey) {
        const response = await callEndpointWithQuery(ClientBrandingEndpoints.getCurrentClientBranding, {
            query: clientKey ? { clientKey } : undefined,
        });
        return normalizeBranding(unwrapApiResponse(response));
    },
    async getByClientId(clientId) {
        const response = await callEndpoint(ClientBrandingEndpoints.getClientBranding, {
            params: { clientId },
        });
        return normalizeBranding(unwrapApiResponse(response));
    },
    async update(clientId, payload) {
        const response = await callEndpoint(ClientBrandingEndpoints.updateClientBranding, {
            params: { clientId },
            body: payload,
        });
        return unwrapApiResponse(response);
    },
};
