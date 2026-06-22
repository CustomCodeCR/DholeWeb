import { defineStore } from 'pinia'
import { getApiErrorMessage } from '@/core/api/apiErrorHandler'

export const useFetchStore = defineStore('fetch', {
  state: () => ({
    isLoading: false,
    loadError: null as string | null,
    pending: {} as Record<string, boolean>,
  }),

  actions: {
    async getService<T>(
      serviceFn: (...args: any[]) => Promise<T>,
      ...args: any[]
    ): Promise<T | null> {
      this.isLoading = true
      this.loadError = null
      try {
        const data = await serviceFn(...args)
        return data
      } catch (error) {
        this.loadError = getApiErrorMessage(error, 'Request failed')
        return null
      } finally {
        this.isLoading = false
      }
    },

    async postService<T>(
      serviceFn: (...args: any[]) => Promise<T>,
      ...args: any[]
    ): Promise<T | null> {
      this.loadError = null
      try {
        const out = await serviceFn(...args)
        return out
      } catch (error) {
        this.loadError = getApiErrorMessage(error, 'Request failed')
        return null
      }
    },

    async putService<T>(
      serviceFn: (...args: any[]) => Promise<T>,
      ...args: any[]
    ): Promise<T | null> {
      this.loadError = null
      try {
        const out = await serviceFn(...args)
        return out
      } catch (error) {
        this.loadError = getApiErrorMessage(error, 'Request failed')
        return null
      }
    },

    async deleteService<T>(
      serviceFn: (...args: any[]) => Promise<T>,
      ...args: any[]
    ): Promise<T | null> {
      this.loadError = null
      try {
        const out = await serviceFn(...args)
        return out
      } catch (error) {
        this.loadError = getApiErrorMessage(error, 'Request failed')
        return null
      }
    },

    async withPending<T>(
      key: string,
      serviceFn: (...args: any[]) => Promise<T>,
      ...args: any[]
    ): Promise<T | null> {
      this.pending[key] = true
      try {
        const out = await serviceFn(...args)
        return out
      } catch (error) {
        this.loadError = getApiErrorMessage(error, 'Request failed')
        return null
      } finally {
        this.pending[key] = false
      }
    },
  },
})
