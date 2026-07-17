import { Endpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { unwrapListResponse } from '@/core/api/apiResponse';
export const ScopesService = {
    async select() {
        const response = await callEndpoint(Endpoints.selectScopes);
        return unwrapListResponse(response);
    },
};
