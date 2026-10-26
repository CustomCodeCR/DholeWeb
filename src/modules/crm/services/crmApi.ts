import { fetchClient } from '@/core/api/fetchConfig'

export type CrmRow = Record<string, unknown> & { id: string; rowVersion?: number }
export interface CrmPage<T = CrmRow> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export type CrmMethod = 'GET' | 'POST' | 'PATCH' | 'PUT'

export const crmEnabled = () => import.meta.env.VITE_CRM_ENABLED === 'true'
const base = '/api/crm'
export function crmPath(resource: string, id?: string, action?: string) {
  const encoded = id ? '/' + encodeURIComponent(id) : ''
  return base + '/' + resource.replace(/^\/+/, '') + encoded + (action ? '/' + action : '')
}
export async function crmRequest<T>(path: string, method: CrmMethod = 'GET',
  body?: unknown, idempotencyKey?: string): Promise<T> {
  // The shared authenticated client refreshes JWTs and preserves temporary impersonation.
  // Never call CRM's private gRPC endpoint or an internal Docker hostname from the browser.
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  return fetchClient<T>(path, { method, body, headers })
}
export function crmList(resource: string, query: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.size ? '?' + params.toString() : ''
  return crmRequest<CrmPage>(crmPath(resource) + qs)
}
export const crmGet = <T = CrmRow>(resource: string, id: string) =>
  crmRequest<T>(crmPath(resource, id))
export const crmCreate = <T = CrmRow>(resource: string, body: unknown, idempotencyKey?: string) =>
  crmRequest<T>(crmPath(resource), 'POST', body, idempotencyKey)
export const crmPatch = <T = CrmRow>(resource: string, id: string, body: unknown) =>
  crmRequest<T>(crmPath(resource, id), 'PATCH', body)
export const crmAction = <T = CrmRow>(resource: string, id: string,
  action: string, body: unknown, idempotencyKey?: string) =>
  crmRequest<T>(crmPath(resource, id, action), 'POST', body, idempotencyKey)

export function crmUuid() {
  return crypto.randomUUID()
}
export function toUtc(input: string | undefined) {
  return input ? new Date(input).toISOString() : null
}
export function fromUtc(input: unknown): string {
  if (typeof input !== 'string' || !input) return ''
  const date = new Date(input)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
export function crmError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'No se pudo completar la operación'
  const x = error as Record<string, unknown>
  // Preserve meaningful 403/409 results. Never log or expose bearer tokens.
  const status = x.statusCode ?? x.status
  if (status === 403) return 'No tiene permiso para este registro (403)'
  if (status === 404) return 'Registro no encontrado (404)'
  if (status === 409) return 'El registro cambió. Recargue y vuelva a intentarlo (409)'
  return typeof x.message === 'string' ? x.message : 'No se pudo completar la operación'
}
