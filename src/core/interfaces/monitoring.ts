export interface ServiceMonitorDefinition extends Record<string, unknown> {
  key: string
  name: string
  description: string
  nameKey?: string
  descriptionKey?: string
  url: string
  critical: boolean
}

export interface ServiceMonitorResult extends ServiceMonitorDefinition {
  status: 'online' | 'offline' | 'unknown'
  statusCode?: number | null
  latencyMs?: number | null
  checkedAt: string
  errorMessage?: string | null
}
