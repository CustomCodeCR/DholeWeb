import { Endpoints } from '@/core/composables/endpoints';
import { callEndpoint } from '@/core/api/callEndpoint';
import { unwrapApiResponse } from '@/core/api/apiResponse';
export const AuthService = {
    async login(payload) {
        const response = await callEndpoint(Endpoints.login, {
            body: payload,
        });
        return unwrapApiResponse(response);
    },
    async refreshToken(payload) {
        const response = await callEndpoint(Endpoints.refreshToken, {
            body: payload,
        });
        return unwrapApiResponse(response);
    },
};
