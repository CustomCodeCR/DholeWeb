import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { ClientBrandingService } from '@/core/services/clientBrandingService';
import { DEFAULT_CLIENT_BRANDING, } from '@/core/interfaces/branding';
const CACHE_PREFIX = 'dhole.client-branding.';
const DEFAULT_CLIENT_KEY = 'default';
const AUTH_STORAGE_KEYS = {
    clientId: 'auth.clientId',
    clientCode: 'auth.clientCode',
    clientName: 'auth.clientName',
};
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}
function normalizeHexColor(value) {
    return isHexColor(value) ? value.trim().toLowerCase() : DEFAULT_CLIENT_BRANDING.primaryColor;
}
function hexToRgb(hex) {
    const clean = normalizeHexColor(hex).replace('#', '');
    const red = Number.parseInt(clean.substring(0, 2), 16);
    const green = Number.parseInt(clean.substring(2, 4), 16);
    const blue = Number.parseInt(clean.substring(4, 6), 16);
    return `${red} ${green} ${blue}`;
}
function readStorageValue(key) {
    const value = localStorage.getItem(key);
    if (!value || value === 'undefined' || value === 'null') {
        return null;
    }
    return value;
}
function resolveHostnameClientKey() {
    const hostname = window.location.hostname.toLowerCase();
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
        return null;
    }
    const firstSegment = hostname.split('.')[0];
    if (!firstSegment || firstSegment === 'www') {
        return hostname;
    }
    return firstSegment;
}
function getCurrentClientKey() {
    return (readStorageValue(AUTH_STORAGE_KEYS.clientId) ||
        readStorageValue(AUTH_STORAGE_KEYS.clientCode) ||
        resolveHostnameClientKey() ||
        DEFAULT_CLIENT_KEY);
}
function cacheKey(clientKey) {
    return `${CACHE_PREFIX}${clientKey}`;
}
function readCachedSettings(clientKey) {
    const raw = localStorage.getItem(cacheKey(clientKey));
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        return normalizeSettings(parsed, clientKey);
    }
    catch {
        localStorage.removeItem(cacheKey(clientKey));
        return null;
    }
}
function writeCachedSettings(clientKey, value) {
    localStorage.setItem(cacheKey(clientKey), JSON.stringify(value));
}
function sanitizeBackgroundUrl(value) {
    const trimmed = value?.trim();
    if (!trimmed)
        return null;
    if (trimmed.startsWith('/') ||
        trimmed.startsWith('data:image/') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('http://')) {
        return trimmed;
    }
    return null;
}
function toCssUrl(value) {
    return `url("${value.replace(/["\\\n\r]/g, '')}")`;
}
function normalizeSettings(input, clientKey = getCurrentClientKey()) {
    return {
        ...DEFAULT_CLIENT_BRANDING,
        ...input,
        clientId: input?.clientId ?? (readStorageValue(AUTH_STORAGE_KEYS.clientId) || null),
        clientCode: input?.clientCode ?? (readStorageValue(AUTH_STORAGE_KEYS.clientCode) || clientKey),
        clientName: input?.clientName ?? readStorageValue(AUTH_STORAGE_KEYS.clientName),
        primaryColor: normalizeHexColor(input?.primaryColor),
        backgroundImageUrl: sanitizeBackgroundUrl(input?.backgroundImageUrl),
        backgroundOverlayOpacity: clamp(Number(input?.backgroundOverlayOpacity ?? DEFAULT_CLIENT_BRANDING.backgroundOverlayOpacity), 0, 0.95),
    };
}
function applyCssVariables(settings) {
    const root = document.documentElement;
    const color = normalizeHexColor(settings.primaryColor);
    const imageUrl = sanitizeBackgroundUrl(settings.backgroundImageUrl);
    root.style.setProperty('--dh-primary', color);
    root.style.setProperty('--dh-primary-rgb', hexToRgb(color));
    root.style.setProperty('--dh-client-background-image', imageUrl ? toCssUrl(imageUrl) : 'linear-gradient(transparent, transparent)');
    root.style.setProperty('--dh-client-background-overlay-opacity', String(settings.backgroundOverlayOpacity ?? DEFAULT_CLIENT_BRANDING.backgroundOverlayOpacity));
    document.body.classList.toggle('dh-has-client-background', Boolean(imageUrl));
}
export const useBrandingStore = defineStore('branding', () => {
    const settings = ref(normalizeSettings(DEFAULT_CLIENT_BRANDING));
    const loading = ref(false);
    const saving = ref(false);
    const lastLoadFailed = ref(false);
    const lastSaveSynced = ref(null);
    const clientKey = computed(() => getCurrentClientKey());
    const clientLabel = computed(() => settings.value.clientName || settings.value.clientCode || settings.value.clientId || clientKey.value);
    function apply(settingsToApply) {
        const normalized = normalizeSettings(settingsToApply, clientKey.value);
        settings.value = normalized;
        applyCssVariables(normalized);
    }
    function applyCachedOrDefault() {
        const currentKey = clientKey.value;
        const cached = readCachedSettings(currentKey);
        apply(cached ?? normalizeSettings(DEFAULT_CLIENT_BRANDING, currentKey));
    }
    async function initialize() {
        applyCachedOrDefault();
        await loadCurrentClientBranding();
    }
    async function loadCurrentClientBranding() {
        const currentKey = clientKey.value;
        const cached = readCachedSettings(currentKey);
        if (cached) {
            apply(cached);
        }
        loading.value = true;
        lastLoadFailed.value = false;
        try {
            const remote = await ClientBrandingService.getCurrent(currentKey);
            const normalized = normalizeSettings(remote ?? cached ?? DEFAULT_CLIENT_BRANDING, currentKey);
            writeCachedSettings(currentKey, normalized);
            apply(normalized);
            return normalized;
        }
        catch {
            lastLoadFailed.value = true;
            const fallback = cached ?? normalizeSettings(DEFAULT_CLIENT_BRANDING, currentKey);
            apply(fallback);
            return fallback;
        }
        finally {
            loading.value = false;
        }
    }
    function preview(input) {
        apply(normalizeSettings({ ...settings.value, ...input }, clientKey.value));
    }
    function resetPreview() {
        const currentKey = clientKey.value;
        apply(normalizeSettings(DEFAULT_CLIENT_BRANDING, currentKey));
    }
    async function saveForCurrentClient(input) {
        const currentKey = clientKey.value;
        const normalized = normalizeSettings({ ...settings.value, ...input }, currentKey);
        saving.value = true;
        lastSaveSynced.value = null;
        apply(normalized);
        writeCachedSettings(currentKey, normalized);
        try {
            const saved = await ClientBrandingService.update(currentKey, {
                clientId: normalized.clientId,
                clientCode: normalized.clientCode,
                primaryColor: normalized.primaryColor,
                backgroundImageUrl: normalized.backgroundImageUrl,
                backgroundOverlayOpacity: normalized.backgroundOverlayOpacity,
            });
            const synced = normalizeSettings(saved, currentKey);
            writeCachedSettings(currentKey, synced);
            apply(synced);
            lastSaveSynced.value = true;
            return { synced: true, settings: synced };
        }
        catch (error) {
            lastSaveSynced.value = false;
            return { synced: false, settings: normalized, error };
        }
        finally {
            saving.value = false;
        }
    }
    return {
        settings,
        loading,
        saving,
        lastLoadFailed,
        lastSaveSynced,
        clientKey,
        clientLabel,
        apply,
        applyCachedOrDefault,
        initialize,
        loadCurrentClientBranding,
        preview,
        resetPreview,
        saveForCurrentClient,
    };
});
