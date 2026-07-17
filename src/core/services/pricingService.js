import { callEndpoint } from '@/core/api/callEndpoint';
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse';
import { Endpoints } from '@/core/composables/endpoints';
import { toQueryString } from '@/core/api/queryString';
function withQuery(path, query) {
    return path + (query ? toQueryString(query) : '');
}
const IMPORT_STATUSES = new Set(['Pending', 'Approved', 'Rejected', 'Created', 'Expired']);
/**
 * The first release of the new Pricing contract inverted Status and RawDataJson
 * while mapping the browse DTO. Keeping this small normalizer makes Web work
 * with that release and with the corrected contract.
 */
function normalizeImportRate(value) {
    const status = String(value.status ?? '');
    const rawDataJson = String(value.rawDataJson ?? '');
    if (!IMPORT_STATUSES.has(status) &&
        IMPORT_STATUSES.has(rawDataJson)) {
        return { ...value, status: rawDataJson, rawDataJson: status };
    }
    return value;
}
export const PricingService = {
    async browseCosts(query) {
        const response = await callEndpoint({
            ...Endpoints.browseCosts,
            path: withQuery(Endpoints.browseCosts.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async selectCosts(query) {
        const response = await callEndpoint({
            ...Endpoints.selectCosts,
            path: withQuery(Endpoints.selectCosts.path, query),
        });
        return unwrapListResponse(response);
    },
    async getCost(costId) {
        const response = await callEndpoint(Endpoints.getCostById, { params: { costId } });
        return unwrapApiResponse(response);
    },
    async createCost(payload) {
        const response = await callEndpoint(Endpoints.createCost, {
            body: payload,
        });
        return unwrapApiResponse(response);
    },
    updateCost(costId, payload) {
        return callEndpoint(Endpoints.updateCost, {
            params: { costId },
            body: payload,
        });
    },
    setCostActive(costId, payload) {
        return callEndpoint(Endpoints.setCostActive, {
            params: { costId },
            body: payload,
        });
    },
    deleteCost(costId) {
        return callEndpoint(Endpoints.deleteCost, { params: { costId } });
    },
    async getDecisionDashboard(query) {
        const response = await callEndpoint({
            ...Endpoints.getPricingDecisionDashboard,
            path: withQuery(Endpoints.getPricingDecisionDashboard.path, query),
        });
        return unwrapApiResponse(response);
    },
    async browseImportRates(query) {
        const response = await callEndpoint({
            ...Endpoints.browseImportRates,
            path: withQuery(Endpoints.browseImportRates.path, query),
        });
        const result = unwrapPagedResponse(response);
        return { ...result, items: result.items.map(normalizeImportRate) };
    },
    async selectImportRates(query) {
        const response = await callEndpoint({
            ...Endpoints.selectImportRates,
            path: withQuery(Endpoints.selectImportRates.path, query),
        });
        return unwrapListResponse(response).map(normalizeImportRate);
    },
    async getImportRate(importRateId) {
        const response = await callEndpoint(Endpoints.getImportRateById, {
            params: { importRateId },
        });
        return normalizeImportRate(unwrapApiResponse(response));
    },
    async createImportRate(payload) {
        const response = await callEndpoint(Endpoints.createImportRate, {
            body: payload,
        });
        return unwrapApiResponse(response);
    },
    async extractImportRates(file, profileSlug, correlationId) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('profileSlug', profileSlug);
        if (correlationId)
            formData.append('correlationId', correlationId);
        const response = await callEndpoint(Endpoints.extractImportRates, {
            body: formData,
            isFormData: true,
        });
        return unwrapApiResponse(response);
    },
    approveImportRates(ids) {
        return callEndpoint(Endpoints.approveImportRates, {
            body: { ids },
        });
    },
    approveImportRate(importRateId) {
        return callEndpoint(Endpoints.approveImportRate, { params: { importRateId } });
    },
    rejectImportRates(ids, payload) {
        return callEndpoint(Endpoints.rejectImportRates, {
            body: { ids, reason: payload.reason },
        });
    },
    rejectImportRate(importRateId, payload) {
        return callEndpoint(Endpoints.rejectImportRate, {
            params: { importRateId },
            body: payload,
        });
    },
    deleteImportRates(ids) {
        return callEndpoint(Endpoints.deleteImportRates, {
            body: { ids },
        });
    },
    async browseRates(query) {
        const response = await callEndpoint({
            ...Endpoints.browseRates,
            path: withQuery(Endpoints.browseRates.path, query),
        });
        return unwrapPagedResponse(response);
    },
    async getRate(rateId) {
        const response = await callEndpoint(Endpoints.getRateById, { params: { rateId } });
        return unwrapApiResponse(response);
    },
    async createRate(payload) {
        const response = await callEndpoint(Endpoints.createRate, {
            body: payload,
        });
        return unwrapApiResponse(response);
    },
    updateRate(rateId, payload) {
        return callEndpoint(Endpoints.updateRate, {
            params: { rateId },
            body: payload,
        });
    },
    async duplicateRate(rateId, payload) {
        const response = await callEndpoint(Endpoints.duplicateRate, {
            params: { rateId },
            body: payload,
        });
        return unwrapApiResponse(response);
    },
    approveRateMargin(rateId) {
        return callEndpoint(Endpoints.approveRateMargin, { params: { rateId } });
    },
    rejectRateMargin(rateId, payload) {
        return callEndpoint(Endpoints.rejectRateMargin, {
            params: { rateId },
            body: payload,
        });
    },
    setRateStatus(rateId, payload) {
        return callEndpoint(Endpoints.setRateStatus, {
            params: { rateId },
            body: payload,
        });
    },
    deleteRates(ids) {
        return callEndpoint(Endpoints.deleteRates, { body: { ids } });
    },
};
