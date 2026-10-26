import type { RequestOptions } from '@/core/api/interfaces/requestOptions'
import type { Endpoint } from '@/core/composables/endpoints'
import { fetchClient, replaceEndpointParams } from '@/core/api/fetchConfig'
import { createUuid } from '@/core/utils/id'
import {
  markPricingRateCommentSaved,
  pendingPricingRateComment,
} from '@/modules/pricing/services/pricingRateCommentState'

type PathParams = Record<string, string>

const RATE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const IDEMPOTENCY_REUSE_MS = 30 * 60 * 1000
const recentIdempotencyKeys = new Map<string, { key: string; expiresAt: number }>()

function requestBodyFingerprint(body: unknown, isFormData?: boolean): string | null {
  if (body === undefined) return ''

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const entries: string[] = []
    for (const [name, value] of body.entries()) {
      if (typeof value === 'string') {
        entries.push(`${name}=text:${value}`)
        continue
      }

      entries.push(
        `${name}=file:${value.name}:${value.size}:${value.type}:${value.lastModified}`,
      )
    }
    return entries.join('&')
  }

  if (isFormData) return null

  try {
    return JSON.stringify(body)
  } catch {
    return null
  }
}

function resolveIdempotencyKey(
  endpoint: Endpoint,
  finalPath: string,
  body: unknown,
  isFormData?: boolean,
  explicitKey?: string,
) {
  if (String(endpoint.method).toUpperCase() !== 'POST') return null
  const cleanPath = finalPath.split('?', 1)[0] ?? finalPath
  if (!cleanPath.startsWith('/api/pricing/')) return null

  const supplied = explicitKey?.trim()
  if (supplied) return supplied

  const fingerprintBody = requestBodyFingerprint(body, isFormData)
  if (fingerprintBody == null) return createUuid()

  const now = Date.now()
  for (const [fingerprint, entry] of recentIdempotencyKeys) {
    if (entry.expiresAt <= now) recentIdempotencyKeys.delete(fingerprint)
  }

  const fingerprint = `${finalPath}\n${fingerprintBody}`
  const existing = recentIdempotencyKeys.get(fingerprint)
  if (existing && existing.expiresAt > now) return existing.key

  const key = createUuid()
  recentIdempotencyKeys.set(fingerprint, { key, expiresAt: now + IDEMPOTENCY_REUSE_MS })
  return key
}

function extractRateId(value: unknown): string | null {
  if (typeof value === 'string') {
    const candidate = value.trim()
    return RATE_ID_PATTERN.test(candidate) ? candidate : null
  }

  if (!value || typeof value !== 'object') return null

  const object = value as Record<string, unknown>
  for (const property of ['rateId', 'id', 'data', 'value', 'result']) {
    if (!(property in object)) continue
    const found = extractRateId(object[property])
    if (found) return found
  }

  return null
}

async function persistPendingRateComment(
  endpoint: Endpoint,
  finalPath: string,
  response: unknown,
) {
  const pending = pendingPricingRateComment()
  if (!pending) return

  const method = String(endpoint.method).toUpperCase()
  const cleanPath = finalPath.split('?', 1)[0]?.replace(/\/$/, '') ?? finalPath
  let rateId: string | null = null

  if (method === 'POST' && cleanPath === '/api/pricing/rates') {
    rateId = extractRateId(response)
  } else if (method === 'PUT') {
    const match = cleanPath.match(/^\/api\/pricing\/rates\/([0-9a-f-]{36})$/i)
    if (match?.[1] && RATE_ID_PATTERN.test(match[1])) rateId = match[1]
  }

  if (!rateId) return

  try {
    await fetchClient<unknown>(
      `/api/pricing/rates/${rateId}/comments`,
      { method: 'PUT', body: { comments: pending.value } },
      endpoint.baseUrl,
    )
    markPricingRateCommentSaved()
  } catch (error) {
    // La tarifa ya fue guardada. Mantener el comentario como pendiente permite
    // reintentar en el siguiente guardado sin crear una tarifa duplicada.
    console.error('No fue posible guardar los comentarios de la tarifa.', error)
  }
}

export async function callEndpoint<TResponse, TBody = unknown>(
  endpoint: Endpoint,
  args?: {
    params?: PathParams
    body?: TBody
    isFormData?: boolean
    extraHeaders?: Record<string, string>
    idempotencyKey?: string
    credentials?: RequestCredentials
  },
): Promise<TResponse> {
  const finalPath = args?.params ? replaceEndpointParams(endpoint.path, args.params) : endpoint.path
  // Preserve the commercial validity chosen by Pricing, including historical dates.
  const normalizedBody = args?.body

  const headers: Record<string, string> = {
    ...(endpoint.headers ?? {}),
    ...(args?.extraHeaders ?? {}),
  }
  const hasIdempotencyHeader = Object.keys(headers).some(
    (name) => name.toLowerCase() === 'idempotency-key',
  )
  const idempotencyKey = hasIdempotencyHeader
    ? null
    : resolveIdempotencyKey(
        endpoint,
        finalPath,
        normalizedBody,
        args?.isFormData,
        args?.idempotencyKey,
      )
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const options: RequestOptions = {
    method: endpoint.method,
    headers,
    ...(normalizedBody !== undefined ? { body: normalizedBody } : {}),
    ...(args?.isFormData ? { isFormData: true } : {}),
    ...(args?.credentials ? { credentials: args.credentials } : {}),
  }

  const response = await fetchClient<TResponse>(finalPath, options, endpoint.baseUrl)
  await persistPendingRateComment(endpoint, finalPath, response)
  return response
}
