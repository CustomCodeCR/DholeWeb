import type {
  AiConnectionStatus,
  AiExecutionStatus,
  AiExecutionType,
  AiModelCapability,
  AiModelStatus,
  AiProviderType,
  AiResponseFormat,
  AiRoutingMode,
} from '@/core/interfaces/ai'

export const providerOptions: { label: string; value: AiProviderType }[] = [
  { label: 'OpenAI', value: 'OpenAI' },
  { label: 'Google Gemini', value: 'Gemini' },
  { label: 'Ollama local', value: 'Ollama' },
  { label: 'Compatible con OpenAI', value: 'OpenAICompatible' },
]

export const capabilityOptions: { label: string; value: AiModelCapability }[] = [
  { label: 'Chat', value: 'Chat' },
  { label: 'Salida estructurada', value: 'StructuredOutput' },
  { label: 'Embeddings', value: 'Embeddings' },
  { label: 'Visión', value: 'Vision' },
  { label: 'Streaming', value: 'Streaming' },
  { label: 'Tool calling', value: 'ToolCalling' },
]

export const routingModeOptions: { label: string; value: AiRoutingMode }[] = [
  { label: 'Modelo fijo', value: 'Fixed' },
  { label: 'Prioridad con fallback', value: 'PriorityFallback' },
  { label: 'Local primero', value: 'LocalFirst' },
  { label: 'Menor costo', value: 'LowestCost' },
]

export const responseFormatOptions: { label: string; value: AiResponseFormat }[] = [
  { label: 'Texto', value: 'Text' },
  { label: 'JSON', value: 'Json' },
  { label: 'JSON Schema', value: 'JsonSchema' },
]

export const executionTypeOptions: { label: string; value: AiExecutionType }[] = [
  { label: 'Chat', value: 'Chat' },
  { label: 'Estructurado', value: 'Structured' },
  { label: 'Embeddings', value: 'Embeddings' },
]

export const executionStatusOptions: { label: string; value: AiExecutionStatus }[] = [
  { label: 'Pendiente', value: 'Pending' },
  { label: 'Ejecutando', value: 'Running' },
  { label: 'Completada', value: 'Completed' },
  { label: 'Fallida', value: 'Failed' },
  { label: 'Cancelada', value: 'Cancelled' },
]

export function providerLabel(value: AiProviderType | null | undefined) {
  return providerOptions.find((option) => option.value === value)?.label ?? value ?? '—'
}

export function routingModeLabel(value: AiRoutingMode) {
  return routingModeOptions.find((option) => option.value === value)?.label ?? value
}

export function responseFormatLabel(value: AiResponseFormat) {
  return responseFormatOptions.find((option) => option.value === value)?.label ?? value
}

export function executionTypeLabel(value: AiExecutionType) {
  return executionTypeOptions.find((option) => option.value === value)?.label ?? value
}

export function connectionStatusLabel(value: AiConnectionStatus) {
  return ({ Unknown: 'Sin verificar', Healthy: 'Saludable', Unhealthy: 'Con errores' } as const)[value]
}

export function modelStatusLabel(value: AiModelStatus) {
  return ({ Unknown: 'Sin verificar', Available: 'Disponible', Unavailable: 'No disponible' } as const)[value]
}

export function executionStatusLabel(value: AiExecutionStatus) {
  return executionStatusOptions.find((option) => option.value === value)?.label ?? value
}

export function formatAiDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
}

export function formatAiCost(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value ?? 0)
}
