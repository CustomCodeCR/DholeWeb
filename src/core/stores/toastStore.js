import { defineStore } from 'pinia';
import { getApiErrorMessage } from '@/core/api/apiErrorHandler';
export const useToastStore = defineStore('toast', {
    state: () => ({
        items: [],
    }),
    actions: {
        show(input) {
            const id = crypto.randomUUID();
            this.items.push({
                id,
                title: input.title,
                message: input.message,
                type: input.type,
                duration: input.duration ?? 3500,
            });
            window.setTimeout(() => {
                this.remove(id);
            }, input.duration ?? 3500);
        },
        success(title, message) {
            this.show({ title, message, type: 'success' });
        },
        error(title, message) {
            this.show({ title, message, type: 'error' });
        },
        backendError(error, fallbackMessage = 'No se pudo completar la acción.', title = 'Error') {
            this.error(title, getApiErrorMessage(error, fallbackMessage));
        },
        warning(title, message) {
            this.show({ title, message, type: 'warning' });
        },
        backendWarning(error, fallbackMessage = 'Revise los datos e intente de nuevo.', title = 'Advertencia') {
            this.warning(title, getApiErrorMessage(error, fallbackMessage));
        },
        info(title, message) {
            this.show({ title, message, type: 'info' });
        },
        remove(id) {
            this.items = this.items.filter((x) => x.id !== id);
        },
    },
});
