import { Endpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { toQueryString } from '@/core/api/queryString';
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse';
export const AuditLogsService = {
    async browse(query) {
        const response = await this.browsePaged(query);
        return response.items;
    },
    async browsePaged(query) {
        const endpointWithQuery = Endpoints.browseAuditEvents.path +
            (query ? toQueryString(query) : '');
        const response = await callEndpoint({
            ...Endpoints.browseAuditEvents,
            path: endpointWithQuery,
        });
        return unwrapPagedResponse(response);
    },
    async getById(auditEventId) {
        const response = await callEndpoint(Endpoints.getAuditEventById, {
            params: { auditEventId },
        });
        return unwrapApiResponse(response);
    },
    async getSummary(query) {
        const endpointWithQuery = Endpoints.getAuditEventSummary.path +
            (query ? toQueryString(query) : '');
        const response = await callEndpoint({
            ...Endpoints.getAuditEventSummary,
            path: endpointWithQuery,
        });
        return unwrapApiResponse(response);
    },
    async getEntityHistory(query) {
        const endpointWithQuery = Endpoints.getEntityHistory.path + toQueryString(query);
        const response = await callEndpoint({
            ...Endpoints.getEntityHistory,
            path: endpointWithQuery,
        });
        return unwrapListResponse(response);
    },
    async getUserHistory(userId) {
        const response = await callEndpoint(Endpoints.getUserHistory, {
            params: { userId },
        });
        return unwrapListResponse(response);
    },
    async getCorrelationHistory(correlationId) {
        const response = await callEndpoint(Endpoints.getCorrelationHistory, {
            params: { correlationId },
        });
        return unwrapListResponse(response);
    },
};
