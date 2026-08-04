import type { ServiceMonitorDefinition, ServiceMonitorResult } from '@/core/interfaces/monitoring'

const gatewayUrl = normalizeBaseUrl((import.meta.env.VITE_API_URL as string | undefined) ?? '')

function normalizeBaseUrl(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function buildGatewayHealthUrl(service: string) {
  const path = `/api/health/${encodeURIComponent(service)}`
  return gatewayUrl ? `${gatewayUrl}${path}` : path
}

export const serviceMonitors: ServiceMonitorDefinition[] = [
  {
    key: 'gateway',
    name: 'API Gateway',
    description: 'Entrada principal para el frontend y los servicios.',
    url: buildGatewayHealthUrl('gateway'),
    critical: true,
  },
  {
    key: 'auth',
    name: 'Auth Service',
    description: 'Usuarios, roles, permisos y sesiones.',
    url: buildGatewayHealthUrl('auth'),
    critical: true,
  },
  {
    key: 'config',
    name: 'Config Service',
    description: 'Catálogos y configuración operacional.',
    url: buildGatewayHealthUrl('config'),
    critical: true,
  },
  {
    key: 'auditlogs',
    name: 'Audit Logs Service',
    description: 'Auditoría y trazabilidad del ecosistema.',
    url: buildGatewayHealthUrl('auditlogs'),
    critical: true,
  },
  {
    key: 'pricing',
    name: 'Pricing Service',
    description: 'Tarifas FCL, importaciones y decisiones tarifarias.',
    url: buildGatewayHealthUrl('pricing'),
    critical: true,
  },
  {
    key: 'dataExtraction',
    name: 'Data Extraction',
    nameKey: 'monitoring.services.dataExtraction.name',
    description: 'Extracción interna de tarifarios.',
    descriptionKey: 'monitoring.services.dataExtraction.description',
    url: buildGatewayHealthUrl('data-extraction'),
    critical: true,
  },
  {
    key: 'ai',
    name: 'AI Service',
    nameKey: 'monitoring.services.ai.name',
    description: 'Modelos, perfiles, conexiones y ejecuciones de inteligencia artificial.',
    descriptionKey: 'monitoring.services.ai.description',
    url: buildGatewayHealthUrl('ai'),
    critical: true,
  },
  {
    key: 'reports',
    name: 'Reports Service',
    nameKey: 'monitoring.services.reports.name',
    description: 'Plantillas y generación de reportes PDF, XLSX y CSV.',
    descriptionKey: 'monitoring.services.reports.description',
    url: buildGatewayHealthUrl('reports'),
    critical: true,
  },
  {
    key: 'storage',
    name: 'Storage Service',
    nameKey: 'monitoring.services.storage.name',
    description: 'Archivos importados, correos, adjuntos y versiones.',
    descriptionKey: 'monitoring.services.storage.description',
    url: buildGatewayHealthUrl('storage'),
    critical: true,
  },
]

export const MonitoringService = {
  async checkService(service: ServiceMonitorDefinition): Promise<ServiceMonitorResult> {
    const startedAt = performance.now()

    try {
      const response = await fetch(service.url, {
        method: 'GET',
        cache: 'no-store',
      })

      return {
        ...service,
        status: response.ok ? 'online' : 'offline',
        statusCode: response.status,
        latencyMs: Math.round(performance.now() - startedAt),
        checkedAt: new Date().toISOString(),
        errorMessage: response.ok ? null : `HTTP ${response.status}`,
      }
    } catch (error) {
      return {
        ...service,
        status: 'offline',
        statusCode: null,
        latencyMs: Math.round(performance.now() - startedAt),
        checkedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'No se pudo conectar con el servicio.',
      }
    }
  },

  async checkAll(): Promise<ServiceMonitorResult[]> {
    return Promise.all(serviceMonitors.map((service) => this.checkService(service)))
  },
}
