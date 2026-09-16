import type { RequestOptions } from '@/core/api/interfaces/requestOptions'
import { ApiError, NetworkError, handleApiResponse } from '@/core/api/apiErrorHandler'

const BASE_URL = import.meta.env.VITE_API_URL as string

interface PricingRateApprovalSnapshot {
  requiredApproval?: boolean
  status?: string
}

function pricingRateIdFromDocumentEndpoint(endpoint: string): string | null {
  const match = endpoint.match(/^\/api\/pricing\/rates\/([^/?]+)\/documents(?:\?|$)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function findPricingRateApprovalSnapshot(
  value: unknown,
  depth = 0,
): PricingRateApprovalSnapshot | null {
  if (!value || typeof value !== 'object' || depth > 4) return null

  const record = value as Record<string, unknown>
  if ('requiredApproval' in record || 'status' in record) {
    return {
      requiredApproval:
        typeof record.requiredApproval === 'boolean' ? record.requiredApproval : undefined,
      status: typeof record.status === 'string' ? record.status : undefined,
    }
  }

  for (const key of ['data', 'value', 'result']) {
    const nested = findPricingRateApprovalSnapshot(record[key], depth + 1)
    if (nested) return nested
  }

  return null
}

async function ensurePricingQuoteApproved(
  endpoint: string,
  baseUrl: string,
  token: string | null,
): Promise<void> {
  const rateId = pricingRateIdFromDocumentEndpoint(endpoint)
  if (!rateId) return

  const response = await fetch(`${baseUrl}/api/pricing/rates/${encodeURIComponent(rateId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  // El backend mantiene la validación autoritativa. Si el preflight no puede
  // resolverse dejamos que la solicitud real responda con el error correspondiente.
  if (!response.ok) return

  const snapshot = findPricingRateApprovalSnapshot(await response.json())
  const isBlockedByMarginApproval =
    snapshot?.requiredApproval === true ||
    snapshot?.status === 'PendingApproval' ||
    snapshot?.status === 'RejectedByManagement'

  if (!isBlockedByMarginApproval) return

  const message =
    'La cotización no puede generarse hasta que un administrador apruebe el margen mínimo del 12%.'

  throw new ApiError(
    message,
    endpoint,
    'POST',
    409,
    'Pricing.RateLowMarginRequiresApproval',
    { code: 'Pricing.RateLowMarginRequiresApproval', message },
  )
}

export async function fetchBlobClient(
  endpoint: string,
  options: RequestOptions,
  baseUrl: string = BASE_URL,
): Promise<Blob> {
  const token = localStorage.getItem('auth.accessToken')

  const defaultHeaders: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const config: RequestInit = {
    method: options.method,
    headers: defaultHeaders,
    body:
      options.body === undefined
        ? undefined
        : options.isFormData
          ? (options.body as BodyInit)
          : JSON.stringify(options.body),
  }

  try {
    await ensurePricingQuoteApproved(endpoint, baseUrl, token)

    const fullUrl = `${baseUrl}${endpoint}`
    const response = await fetch(fullUrl, config)

    if (!response.ok) {
      await handleApiResponse(response, endpoint, options.method)
    }

    return await response.blob()
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new NetworkError(endpoint, options.method, error as Error)
  }
}
