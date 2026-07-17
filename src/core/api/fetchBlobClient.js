import { ApiError, NetworkError, handleApiResponse } from '@/core/api/apiErrorHandler';
const BASE_URL = import.meta.env.VITE_API_URL;
export async function fetchBlobClient(endpoint, options) {
    const token = localStorage.getItem('auth.accessToken');
    const defaultHeaders = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };
    const config = {
        method: options.method,
        headers: defaultHeaders,
    };
    try {
        const fullUrl = `${BASE_URL}${endpoint}`;
        const response = await fetch(fullUrl, config);
        if (!response.ok) {
            await handleApiResponse(response, endpoint, options.method);
        }
        return await response.blob();
    }
    catch (error) {
        if (error instanceof ApiError)
            throw error;
        throw new NetworkError(endpoint, options.method, error);
    }
}
