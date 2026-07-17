import { Endpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { toQueryString } from '@/core/api/queryString';
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse';
export const CatalogGroupsService = {
    async create(payload) {
        const response = await callEndpoint(Endpoints.createCatalogGroup, { body: payload });
        return unwrapApiResponse(response);
    },
    async browse(query) {
        const response = await this.browsePaged(query);
        return response.items;
    },
    async browsePaged(query) {
        const endpointWithQuery = Endpoints.browseCatalogGroups.path +
            (query ? toQueryString(query) : '');
        const response = await callEndpoint({
            ...Endpoints.browseCatalogGroups,
            path: endpointWithQuery,
        });
        return unwrapPagedResponse(response);
    },
    async select(query) {
        const endpointWithQuery = Endpoints.selectCatalogGroups.path +
            (query ? toQueryString(query) : '');
        const response = await callEndpoint({
            ...Endpoints.selectCatalogGroups,
            path: endpointWithQuery,
        });
        return unwrapListResponse(response);
    },
    async getById(catalogGroupId) {
        const response = await callEndpoint(Endpoints.getCatalogGroupById, {
            params: { catalogGroupId },
        });
        return unwrapApiResponse(response);
    },
    update(catalogGroupId, payload) {
        return callEndpoint(Endpoints.updateCatalogGroup, {
            params: { catalogGroupId },
            body: payload,
        });
    },
    delete(catalogGroupId) {
        return callEndpoint(Endpoints.deleteCatalogGroup, { params: { catalogGroupId } });
    },
    setActive(catalogGroupId, payload) {
        return callEndpoint(Endpoints.setCatalogGroupActive, {
            params: { catalogGroupId },
            body: payload,
        });
    },
    activate(catalogGroupId) {
        return this.setActive(catalogGroupId, { isActive: true });
    },
    inactivate(catalogGroupId) {
        return this.setActive(catalogGroupId, { isActive: false });
    },
};
