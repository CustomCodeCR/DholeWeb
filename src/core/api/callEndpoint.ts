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

const IDEMPOTENCY_REUSE_MS = 2 * 60 * 1000
const recentIdempotencyKeys = new Map<string, { key: string; expiresAt: number }>()

function requestBodyFingerprint(body: unknown, isFormData?: boolean): string | null {
  if (body === undefined) return ''
  if (isFormData || (typeof FormData !== 'undefined' && body instanceof FormData)) return null

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

function todayIso(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizePricingRateEditBody<TBody>(
  endpoint: Endpoint,
  finalPath: string,
  body: TBody,
): TBody {
  if (!body || typeof body !== 'object') return body
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body

  const method = String(endpoint.method).toUpperCase()
  if (method !== 'PUT') return body

  const cleanPath = finalPath.split('?', 1)[0]?.replace(/\/$/, '') ?? finalPath
  const match = cleanPath.match(/^\/api\/pricing\/rates\/([0-9a-f-]{36})$/i)
  if (!match?.[1] || !RATE_ID_PATTERN.test(match[1])) return body

  // Al editar una tarifa la vigencia vuelve a iniciar hoy. No reenviamos una
  // fecha histórica aunque el formulario haya sido hidratado con la tarifa anterior.
  return {
    ...(body as Record<string, unknown>),
    validFrom: todayIso(),
  } as TBody
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
  },
): Promise<TResponse> {
  const finalPath = args?.params ? replaceEndpointParams(endpoint.path, args.params) : endpoint.path
  const normalizedBody =
    args?.body === undefined
      ? undefined
      : normalizePricingRateEditBody(endpoint, finalPath, args.body)

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
  }

  const response = await fetchClient<TResponse>(finalPath, options, endpoint.baseUrl)
  await persistPendingRateComment(endpoint, finalPath, response)
  return response
}
