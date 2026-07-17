const gatewayUrl = import.meta.env.VITE_API_URL ?? '';
const authUrl = import.meta.env.VITE_AUTH_URL ?? gatewayUrl;
const configUrl = import.meta.env.VITE_CONFIG_URL ?? gatewayUrl;
const auditLogsUrl = import.meta.env.VITE_AUDITLOGS_URL ?? gatewayUrl;
const pricingUrl = import.meta.env.VITE_PRICING_URL ?? gatewayUrl;
const dataExtractionUrl = import.meta.env.VITE_DATA_EXTRACTION_URL ?? 'http://localhost:5205';
function normalizeBaseUrl(value) {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}
function buildHealthUrl(baseUrl) {
    const normalized = normalizeBaseUrl(baseUrl);
    return normalized ? `${normalized}/health` : '/health';
}
export const serviceMonitors = [
    {
        key: 'gateway',
        name: 'API Gateway',
        description: 'Entrada principal para el frontend y los servicios.',
        url: buildHealthUrl(gatewayUrl),
        critical: true,
    },
    {
        key: 'auth',
        name: 'Auth Service',
        description: 'Usuarios, roles, permisos y sesiones.',
        url: buildHealthUrl(authUrl),
        critical: true,
    },
    {
        key: 'config',
        name: 'Config Service',
        description: 'Catálogos y configuración operacional.',
        url: buildHealthUrl(configUrl),
        critical: true,
    },
    {
        key: 'auditlogs',
        name: 'Audit Logs Service',
        description: 'Auditoría y trazabilidad del ecosistema.',
        url: buildHealthUrl(auditLogsUrl),
        critical: true,
    },
    {
        key: 'pricing',
        name: 'Pricing Service',
        description: 'Tarifas FCL, importaciones y decisiones tarifarias.',
        url: buildHealthUrl(pricingUrl),
        critical: true,
    },
    {
        key: 'dataExtraction',
        name: 'Data Extraction',
        nameKey: 'monitoring.services.dataExtraction.name',
        description: 'Extracción interna de tarifarios.',
        descriptionKey: 'monitoring.services.dataExtraction.description',
        url: buildHealthUrl(dataExtractionUrl),
        critical: true,
    },
];
export const MonitoringService = {
    async checkService(service) {
        const startedAt = performance.now();
        try {
            const response = await fetch(service.url, {
                method: 'GET',
                cache: 'no-store',
            });
            return {
                ...service,
                status: response.ok ? 'online' : 'offline',
                statusCode: response.status,
                latencyMs: Math.round(performance.now() - startedAt),
                checkedAt: new Date().toISOString(),
                errorMessage: response.ok ? null : `HTTP ${response.status}`,
            };
        }
        catch (error) {
            return {
                ...service,
                status: 'offline',
                statusCode: null,
                latencyMs: Math.round(performance.now() - startedAt),
                checkedAt: new Date().toISOString(),
                errorMessage: error instanceof Error ? error.message : 'No se pudo conectar con el servicio.',
            };
        }
    },
    async checkAll() {
        return Promise.all(serviceMonitors.map((service) => this.checkService(service)));
    },
};
