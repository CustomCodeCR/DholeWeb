import { Endpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { toQueryString } from '@/core/api/queryString';
import { unwrapApiResponse, unwrapListResponse, unwrapPagedResponse } from '@/core/api/apiResponse';
export const UsersService = {
    async create(payload) {
        const response = await callEndpoint(Endpoints.createUser, { body: payload });
        return unwrapApiResponse(response);
    },
    async browse(query) {
        const response = await this.browsePaged(query);
        return response.items;
    },
    async browsePaged(query) {
        const endpointWithQuery = Endpoints.browseUsers.path + (query ? toQueryString(query) : '');
        const response = await callEndpoint({ ...Endpoints.browseUsers, path: endpointWithQuery });
        return unwrapPagedResponse(response);
    },
    update(userId, payload) {
        return callEndpoint(Endpoints.updateUser, { params: { userId }, body: payload });
    },
    delete(userId) {
        return callEndpoint(Endpoints.deleteUser, { params: { userId } });
    },
    changePassword(userId, payload) {
        return callEndpoint(Endpoints.changeUserPassword, { params: { userId }, body: payload });
    },
    setActive(userId, payload) {
        return callEndpoint(Endpoints.setUserActive, { params: { userId }, body: payload });
    },
    activate(userId) {
        return this.setActive(userId, { isActive: true });
    },
    inactivate(userId) {
        return this.setActive(userId, { isActive: false });
    },
    setLocked(userId, payload) {
        return callEndpoint(Endpoints.setUserLocked, { params: { userId }, body: payload });
    },
    block(userId, reason) {
        return this.setLocked(userId, { isLocked: true, reason: reason ?? null });
    },
    unblock(userId) {
        return this.setLocked(userId, { isLocked: false, reason: null });
    },
    async getRoles(userId) {
        const response = await callEndpoint(Endpoints.getUserRoles, { params: { userId } });
        return unwrapListResponse(response);
    },
    assignRoles(userId, payload) {
        return callEndpoint(Endpoints.assignRolesToUser, { params: { userId }, body: payload });
    },
    revokeRoles(userId, payload) {
        return callEndpoint(Endpoints.revokeRolesFromUser, { params: { userId }, body: payload });
    },
    async getScopes(userId) {
        const response = await callEndpoint(Endpoints.getUserScopes, { params: { userId } });
        return unwrapListResponse(response);
    },
    assignScopes(userId, payload) {
        return callEndpoint(Endpoints.assignScopesToUser, { params: { userId }, body: payload });
    },
    revokeScopes(userId, payload) {
        return callEndpoint(Endpoints.revokeScopesFromUser, { params: { userId }, body: payload });
    },
    async getPermissions(userId) {
        const response = await callEndpoint(Endpoints.getUserPermissions, { params: { userId } });
        return unwrapApiResponse(response);
    },
};
