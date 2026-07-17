import { Endpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { toQueryString } from '@/core/api/queryString';
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse';
export const CatalogItemsService = {
    async create(payload) {
        const response = await callEndpoint(Endpoints.createCatalogItem, { body: payload });
        return unwrapApiResponse(response);
    },
    async createForGroup(catalogGroupId, payload) {
        const response = await callEndpoint(Endpoints.createCatalogItemForGroup, {
            params: { catalogGroupId },
            body: payload,
        });
        return unwrapApiResponse(response);
    },
    async browse(query) {
        const response = await this.browsePaged(query);
        return response.items;
    },
    async browsePaged(query) {
        const endpointWithQuery = Endpoints.browseCatalogItems.path +
            (query ? toQueryString(query) : '');
        const response = await callEndpoint({
            ...Endpoints.browseCatalogItems,
            path: endpointWithQuery,
        });
        return unwrapPagedResponse(response);
    },
    async select(query) {
        const endpointWithQuery = Endpoints.selectCatalogItems.path +
            (query ? toQueryString(query) : '');
        const response = await callEndpoint({
            ...Endpoints.selectCatalogItems,
            path: endpointWithQuery,
        });
        return unwrapListResponse(response);
    },
    async getByGroupSlug(catalogGroupSlug) {
        const response = await callEndpoint(Endpoints.getCatalogItemsByGroupSlug, {
            params: { catalogGroupSlug },
        });
        return unwrapListResponse(response);
    },
    async getById(catalogItemId) {
        const response = await callEndpoint(Endpoints.getCatalogItemById, {
            params: { catalogItemId },
        });
        return unwrapApiResponse(response);
    },
    async validate(query) {
        const endpointWithQuery = Endpoints.validateCatalogItem.path +
            toQueryString(query);
        const response = await callEndpoint({
            ...Endpoints.validateCatalogItem,
            path: endpointWithQuery,
        });
        return unwrapApiResponse(response);
    },
    update(catalogItemId, payload) {
        return callEndpoint(Endpoints.updateCatalogItem, {
            params: { catalogItemId },
            body: payload,
        });
    },
    delete(catalogItemId) {
        return callEndpoint(Endpoints.deleteCatalogItem, { params: { catalogItemId } });
    },
    setActive(catalogItemId, payload) {
        return callEndpoint(Endpoints.setCatalogItemActive, {
            params: { catalogItemId },
            body: payload,
        });
    },
    activate(catalogItemId) {
        return this.setActive(catalogItemId, { isActive: true });
    },
    inactivate(catalogItemId) {
        return this.setActive(catalogItemId, { isActive: false });
    },
    changeSortOrder(catalogItemId, payload) {
        return callEndpoint(Endpoints.changeCatalogItemSortOrder, {
            params: { catalogItemId },
            body: payload,
        });
    },
};
