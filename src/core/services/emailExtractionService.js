import { callEndpoint } from '@/core/api/callEndpoint';
import { unwrapApiResponse, unwrapPagedResponse } from '@/core/api/apiResponse';
import { toQueryString } from '@/core/api/queryString';
import { Endpoints } from '@/core/composables/endpoints';
function withQuery(path, query) {
    return path + (query ? toQueryString(query) : '');
}
export const EmailExtractionService = {
    async browseAccounts(query) {
        const response = await callEndpoint({
            ...Endpoints.browseEmailAccounts,
            path: withQuery(Endpoints.browseEmailAccounts.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async browseMessages(query) {
        const response = await callEndpoint({
            ...Endpoints.browseEmailMessages,
            path: withQuery(Endpoints.browseEmailMessages.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async getMessage(messageId) {
        const response = await callEndpoint(Endpoints.getEmailMessage, {
            params: { messageId },
        });
        return unwrapApiResponse(response);
    },
    async reprocessMessage(messageId) {
        const response = await callEndpoint(Endpoints.reprocessEmailMessage, {
            params: { messageId },
        });
        return unwrapApiResponse(response);
    },
    async browseExtractionJobs(query) {
        const response = await callEndpoint({
            ...Endpoints.browseEmailExtractionJobs,
            path: withQuery(Endpoints.browseEmailExtractionJobs.path, query),
        });
        return unwrapPagedResponse(response);
    },
};
