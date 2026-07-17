import { fetchClient, replaceEndpointParams } from '@/core/api/fetchConfig';
function toQueryString(query) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null)
            continue;
        // arrays => repeat param: ?a=1&a=2
        if (Array.isArray(value)) {
            for (const item of value) {
                if (item === undefined || item === null)
                    continue;
                sp.append(key, String(item));
            }
            continue;
        }
        sp.append(key, String(value));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : '';
}
export async function callEndpointWithQuery(endpoint, args) {
    const params = args?.params;
    const query = args?.query;
    const basePath = params ? replaceEndpointParams(endpoint.path, params) : endpoint.path;
    const fullPath = basePath + (query ? toQueryString(query) : '');
    const options = {
        method: endpoint.method,
        headers: endpoint.headers,
        body: args?.body,
        isFormData: args?.isFormData,
    };
    return fetchClient(fullPath, options);
}
