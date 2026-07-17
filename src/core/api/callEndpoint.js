import { fetchClient, replaceEndpointParams } from '@/core/api/fetchConfig';
export async function callEndpoint(endpoint, args) {
    const finalPath = args?.params ? replaceEndpointParams(endpoint.path, args.params) : endpoint.path;
    const options = {
        method: endpoint.method,
        headers: {
            ...(endpoint.headers ?? {}),
            ...(args?.extraHeaders ?? {}),
        },
        ...(args?.body !== undefined ? { body: args.body } : {}),
        ...(args?.isFormData ? { isFormData: true } : {}),
    };
    return fetchClient(finalPath, options);
}
