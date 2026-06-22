import type { HttpMethod } from '@/core/composables/endpoints'

export interface RequestOptions {
  method: HttpMethod
  body?: unknown
  headers?: HeadersInit
  isFormData?: boolean
}
