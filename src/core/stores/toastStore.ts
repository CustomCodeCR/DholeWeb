import { defineStore } from 'pinia'
import { getApiErrorMessage } from '@/core/api/apiErrorHandler'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  title: string
  message?: string
  type: ToastType
  duration: number
}

export const useToastStore = defineStore('toast', {
  state: () => ({
    items: [] as ToastItem[],
  }),

  actions: {
    show(input: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) {
      const id = crypto.randomUUID()

      this.items.push({
        id,
        title: input.title,
        message: input.message,
        type: input.type,
        duration: input.duration ?? 3500,
      })

      window.setTimeout(() => {
        this.remove(id)
      }, input.duration ?? 3500)
    },

    success(title: string, message?: string) {
      this.show({ title, message, type: 'success' })
    },

    error(title: string, message?: string) {
      this.show({ title, message, type: 'error' })
    },

    backendError(error: unknown, fallbackMessage = 'No se pudo completar la acción.', title = 'Error') {
      this.error(title, getApiErrorMessage(error, fallbackMessage))
    },

    warning(title: string, message?: string) {
      this.show({ title, message, type: 'warning' })
    },

    backendWarning(error: unknown, fallbackMessage = 'Revise los datos e intente de nuevo.', title = 'Advertencia') {
      this.warning(title, getApiErrorMessage(error, fallbackMessage))
    },

    info(title: string, message?: string) {
      this.show({ title, message, type: 'info' })
    },

    remove(id: string) {
      this.items = this.items.filter((x) => x.id !== id)
    },
  },
})
