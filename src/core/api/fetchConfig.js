import { ApiError, MissingParameterError, NetworkError, handleApiResponse, safeJsonParse, } from '@/core/api/apiErrorHandler';
const BASE_URL = import.meta.env.VITE_API_URL;
const STORAGE_KEYS = {
    accessToken: 'auth.accessToken',
    refreshToken: 'auth.refreshToken',
    sessionId: 'auth.sessionId',
    accessTokenExpiresAt: 'auth.accessTokenExpiresAt',
    refreshTokenExpiresAt: 'auth.refreshTokenExpiresAt',
    userId: 'auth.userId',
    sessionUserId: 'auth.sessionUserId',
    userType: 'auth.userType',
    username: 'auth.username',
    displayName: 'auth.displayName',
    email: 'auth.email',
    clientId: 'auth.clientId',
    clientCode: 'auth.clientCode',
    clientName: 'auth.clientName',
    roles: 'auth.roles',
    scopes: 'auth.scopes',
};
export function replaceEndpointParams(endpoint, params) {
    return endpoint.replace(/{{(\w+)}}/g, (_fullMatch, paramName) => {
        const value = params[paramName];
        if (value !== undefined) {
            return value;
        }
        throw new MissingParameterError(paramName);
    });
}
function isJsonContentType(contentType) {
    const value = contentType.toLowerCase();
    return value.includes('application/json') || value.includes('+json');
}
function getAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.accessToken);
}
function getRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.refreshToken);
}
function parseJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const payload = parts[1];
        if (!payload)
            return null;
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        return JSON.parse(atob(normalized));
    }
    catch {
        return null;
    }
}
function getJwtExpiration(token) {
    const payload = parseJwtPayload(token);
    const exp = payload?.exp;
    return typeof exp === 'number' ? exp * 1000 : null;
}
function readClaimString(payload, keys) {
    if (!payload)
        return null;
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }
    return null;
}
function persistString(key, value) {
    if (typeof value === 'string' && value.trim().length > 0) {
        localStorage.setItem(key, value.trim());
    }
}
function isTokenExpiredOrClose(token) {
    if (!token)
        return true;
    const expiration = getJwtExpiration(token);
    if (!expiration)
        return false;
    return Date.now() >= expiration - 30_000;
}
function isRefreshExpired() {
    const raw = localStorage.getItem(STORAGE_KEYS.refreshTokenExpiresAt);
    if (!raw)
        return !getRefreshToken();
    const expiresAt = new Date(raw).getTime();
    return Number.isNaN(expiresAt) ? false : Date.now() >= expiresAt;
}
function isAuthEndpoint(endpoint) {
    return endpoint === '/api/auth/login' || endpoint === '/api/auth/refresh';
}
function clearStoredSession() {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}
function emitSessionExpired() {
    window.dispatchEvent(new CustomEvent('dhole:auth:expired'));
}
function isMutationMethod(method) {
    return method !== 'GET';
}
function emitDataChanged(endpoint, method) {
    if (!isMutationMethod(method) || isAuthEndpoint(endpoint))
        return;
    window.dispatchEvent(new CustomEvent('dhole:data:changed', {
        detail: { endpoint, method, occurredAt: new Date().toISOString() },
    }));
}
function unwrapRefreshResponse(data) {
    if ('accessToken' in data && 'refreshToken' in data && 'sessionId' in data) {
        return data;
    }
    return 'data' in data ? (data.data ?? null) : null;
}
function persistRefreshResponse(data) {
    localStorage.setItem(STORAGE_KEYS.accessToken, data.accessToken);
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refreshToken);
    localStorage.setItem(STORAGE_KEYS.sessionId, data.sessionId);
    localStorage.setItem(STORAGE_KEYS.accessTokenExpiresAt, data.accessTokenExpiresAt);
    localStorage.setItem(STORAGE_KEYS.refreshTokenExpiresAt, data.refreshTokenExpiresAt);
    const payload = parseJwtPayload(data.accessToken);
    const tokenUserName = readClaimString(payload, [
        'userName',
        'username',
        'unique_name',
        'preferred_username',
    ]);
    const tokenDisplayName = readClaimString(payload, [
        'displayName',
        'display_name',
        'fullName',
        'full_name',
        'name',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    ]);
    const tokenEmail = readClaimString(payload, [
        'email',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    ]);
    persistString(STORAGE_KEYS.username, data.userName ?? tokenUserName);
    persistString(STORAGE_KEYS.displayName, data.displayName ?? tokenDisplayName);
    persistString(STORAGE_KEYS.email, data.email ?? tokenEmail);
    persistString(STORAGE_KEYS.clientId, data.clientId);
    persistString(STORAGE_KEYS.clientCode, data.clientCode);
    persistString(STORAGE_KEYS.clientName, data.clientName);
    window.dispatchEvent(new CustomEvent('dhole:auth:refreshed', { detail: data }));
}
async function refreshStoredSession() {
    const refreshToken = getRefreshToken();
    if (!refreshToken || isRefreshExpired()) {
        clearStoredSession();
        emitSessionExpired();
        return false;
    }
    try {
        const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) {
            clearStoredSession();
            emitSessionExpired();
            return false;
        }
        const data = (await response.json());
        const session = unwrapRefreshResponse(data);
        if (!session?.accessToken || !session.refreshToken || !session.sessionId) {
            clearStoredSession();
            emitSessionExpired();
            return false;
        }
        persistRefreshResponse(session);
        return true;
    }
    catch {
        clearStoredSession();
        emitSessionExpired();
        return false;
    }
}
async function getUsableAccessToken(endpoint) {
    const token = getAccessToken();
    if (isAuthEndpoint(endpoint))
        return token;
    if (!isTokenExpiredOrClose(token))
        return token;
    const refreshed = await refreshStoredSession();
    return refreshed ? getAccessToken() : null;
}
function buildRequestConfig(options, token) {
    const headers = {
        ...(options.isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
    };
    return {
        method: options.method,
        headers,
        body: options.body === undefined
            ? undefined
            : options.isFormData
                ? options.body
                : JSON.stringify(options.body),
    };
}
export async function fetchClient(endpoint, options) {
    let token = await getUsableAccessToken(endpoint);
    let config = buildRequestConfig(options, token);
    try {
        let response = await fetch(`${BASE_URL}${endpoint}`, config);
        if (response.status === 401 && !isAuthEndpoint(endpoint)) {
            const refreshed = await refreshStoredSession();
            if (refreshed) {
                token = getAccessToken();
                config = buildRequestConfig(options, token);
                response = await fetch(`${BASE_URL}${endpoint}`, config);
            }
        }
        if (response.status === 401 && !isAuthEndpoint(endpoint)) {
            clearStoredSession();
            emitSessionExpired();
        }
        if (response.status === 204) {
            emitDataChanged(endpoint, options.method);
            return {};
        }
        if (!response.ok) {
            await handleApiResponse(response, endpoint, options.method);
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (isJsonContentType(contentType)) {
            const data = await safeJsonParse(response);
            emitDataChanged(endpoint, options.method);
            return (data ?? {});
        }
        const text = await response.text();
        emitDataChanged(endpoint, options.method);
        return text;
    }
    catch (error) {
        if (error instanceof ApiError)
            throw error;
        throw new NetworkError(endpoint, options.method, error);
    }
}
