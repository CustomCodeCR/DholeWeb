import { Endpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { toQueryString } from '@/core/api/queryString';
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse';
export const RolesService = {
    async create(payload) {
        const response = await callEndpoint(Endpoints.createRole, { body: payload });
        return unwrapApiResponse(response);
    },
    async browse(query) {
        const response = await this.browsePaged(query);
        return response.items;
    },
    async browsePaged(query) {
        const endpointWithQuery = Endpoints.browseRoles.path + (query ? toQueryString(query) : '');
        const response = await callEndpoint({ ...Endpoints.browseRoles, path: endpointWithQuery });
        return unwrapPagedResponse(response);
    },
    async select() {
        const response = await callEndpoint(Endpoints.selectRoles);
        return unwrapListResponse(response);
    },
    update(roleId, payload) {
        return callEndpoint(Endpoints.updateRole, { params: { roleId }, body: payload });
    },
    delete(roleId) {
        return callEndpoint(Endpoints.deleteRole, { params: { roleId } });
    },
    setActive(roleId, payload) {
        return callEndpoint(Endpoints.setRoleActive, { params: { roleId }, body: payload });
    },
    activate(roleId) {
        return this.setActive(roleId, { isActive: true });
    },
    inactivate(roleId) {
        return this.setActive(roleId, { isActive: false });
    },
    async getScopes(roleId) {
        const response = await callEndpoint(Endpoints.getRoleScopes, { params: { roleId } });
        return unwrapListResponse(response);
    },
    assignScopes(roleId, payload) {
        return callEndpoint(Endpoints.assignScopesToRole, { params: { roleId }, body: payload });
    },
    revokeScopes(roleId, payload) {
        return callEndpoint(Endpoints.revokeScopesFromRole, { params: { roleId }, body: payload });
    },
};
