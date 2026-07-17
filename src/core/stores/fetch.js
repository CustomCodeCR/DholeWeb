import { defineStore } from 'pinia';
import { getApiErrorMessage } from '@/core/api/apiErrorHandler';
export const useFetchStore = defineStore('fetch', {
    state: () => ({
        isLoading: false,
        loadError: null,
        pending: {},
    }),
    actions: {
        async getService(serviceFn, ...args) {
            this.isLoading = true;
            this.loadError = null;
            try {
                const data = await serviceFn(...args);
                return data;
            }
            catch (error) {
                this.loadError = getApiErrorMessage(error, 'Request failed');
                return null;
            }
            finally {
                this.isLoading = false;
            }
        },
        async postService(serviceFn, ...args) {
            this.loadError = null;
            try {
                const out = await serviceFn(...args);
                return out;
            }
            catch (error) {
                this.loadError = getApiErrorMessage(error, 'Request failed');
                return null;
            }
        },
        async putService(serviceFn, ...args) {
            this.loadError = null;
            try {
                const out = await serviceFn(...args);
                return out;
            }
            catch (error) {
                this.loadError = getApiErrorMessage(error, 'Request failed');
                return null;
            }
        },
        async deleteService(serviceFn, ...args) {
            this.loadError = null;
            try {
                const out = await serviceFn(...args);
                return out;
            }
            catch (error) {
                this.loadError = getApiErrorMessage(error, 'Request failed');
                return null;
            }
        },
        async withPending(key, serviceFn, ...args) {
            this.pending[key] = true;
            try {
                const out = await serviceFn(...args);
                return out;
            }
            catch (error) {
                this.loadError = getApiErrorMessage(error, 'Request failed');
                return null;
            }
            finally {
                this.pending[key] = false;
            }
        },
    },
});
