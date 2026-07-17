import { Endpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { toQueryString } from '@/core/api/queryString';
import { unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse';
export const SessionsService = {
    async getByUser(userId, query) {
        const response = await this.getByUserPaged(userId, query);
        return response.items;
    },
    async getByUserPaged(userId, query) {
        const endpointWithQuery = Endpoints.getUserSessions.path + (query ? toQueryString(query) : '');
        const response = await callEndpoint({ ...Endpoints.getUserSessions, path: endpointWithQuery }, { params: { userId } });
        return unwrapPagedResponse(response);
    },
    async getActiveByUser(userId) {
        const response = await callEndpoint(Endpoints.getActiveUserSessions, { params: { userId } });
        return unwrapListResponse(response);
    },
    revoke(sessionId, payload) {
        return callEndpoint(Endpoints.revokeSession, { params: { sessionId }, body: payload });
    },
    revokeByUser(userId, payload) {
        return callEndpoint(Endpoints.revokeUserSessions, { params: { userId }, body: payload });
    },
};
