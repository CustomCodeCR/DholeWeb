import type { RequestOptions } from '@/core/api/interfaces/requestOptions'
import { fetchClient, replaceEndpointParams } from '@/core/api/fetchConfig'

export interface EndpointDef {
  method: RequestOptions['method']
  path: string
  headers?: HeadersInit
}

export interface CallEndpointWithQueryArgs<TBody = unknown> {
  params?: Record<string, string>
  query?: Record<string, unknown>
  body?: TBody | FormData
  isFormData?: boolean
}

function toQueryString(query: Record<string, unknown>): string {
  const sp = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue

    // arrays => repeat param: ?a=1&a=2
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue
        sp.append(key, String(item))
      }
      continue
    }

    sp.append(key, String(value))
  }

  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export async function callEndpointWithQuery<TResponse, TBody = unknown>(
  endpoint: EndpointDef,
  args?: CallEndpointWithQueryArgs<TBody>,
): Promise<TResponse> {
  const params = args?.params
  const query = args?.query

  const basePath = params ? replaceEndpointParams(endpoint.path, params) : endpoint.path
  const fullPath = basePath + (query ? toQueryString(query) : '')

  const options: RequestOptions = {
    method: endpoint.method,
    headers: endpoint.headers,
    body: args?.body as any,
    isFormData: args?.isFormData,
  }

  return fetchClient<TResponse>(fullPath, options)
}
