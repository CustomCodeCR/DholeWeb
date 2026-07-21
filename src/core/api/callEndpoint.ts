import type { RequestOptions } from '@/core/api/interfaces/requestOptions'
import type { Endpoint } from '@/core/composables/endpoints'
import { fetchClient, replaceEndpointParams } from '@/core/api/fetchConfig'

type PathParams = Record<string, string>

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

  return fetchClient<TResponse>(finalPath, options, endpoint.baseUrl)
}
