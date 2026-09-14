import type { RequestOptions } from '@/core/api/interfaces/requestOptions'
import type { Endpoint } from '@/core/composables/endpoints'
import { fetchClient, replaceEndpointParams } from '@/core/api/fetchConfig'
import {
  markPricingRateCommentSaved,
  pendingPricingRateComment,
} from '@/modules/pricing/services/pricingRateCommentState'

type PathParams = Record<string, string>

const RATE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
  },
): Promise<TResponse> {
  const finalPath = args?.params ? replaceEndpointParams(endpoint.path, args.params) : endpoint.path

  const options: RequestOptions = {
    method: endpoint.method,
    headers: {
      ...(endpoint.headers ?? {}),
      ...(args?.extraHeaders ?? {}),
    },
    ...(args?.body !== undefined ? { body: args.body } : {}),
    ...(args?.isFormData ? { isFormData: true } : {}),
  }

  const response = await fetchClient<TResponse>(finalPath, options, endpoint.baseUrl)
  await persistPendingRateComment(endpoint, finalPath, response)
  return response
}
