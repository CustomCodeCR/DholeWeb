export interface DuplicateProspectAlert {
  title: string
  message: string
  existingProspectId?: string
}

/**
 * CRM sends a structured 409 so the prospect's current seller is visible even
 * when the creating user lacks permission to list that seller's prospects.
 */
export function crmDuplicateProspectAlert(error: unknown): DuplicateProspectAlert | null {
  if (!error || typeof error !== 'object') return null
  const response = error as Record<string, unknown>
  const status = response.status ?? response.statusCode
  const data = response.data && typeof response.data === 'object'
    ? response.data as Record<string, unknown> : {}
  const code = response.code ?? data.code
  if (Number(status) !== 409 || code !== 'CRM_LEAD_DUPLICATE') return null

  const name = typeof data.prospectName === 'string' && data.prospectName.trim()
    ? data.prospectName.trim() : 'Este prospecto'
  const seller = typeof data.sellerName === 'string' && data.sellerName.trim()
    ? data.sellerName.trim() : 'Vendedor no disponible'
  return {
    title: 'Prospecto ya registrado',
    message: `${name} ya existe en CRM y está asignado a ${seller}. No se creó otro prospecto.`,
    existingProspectId: typeof data.existingProspectId === 'string'
      ? data.existingProspectId : undefined,
  }
}

// Suppress a second SignalR popup for the exact same rejection in this tab.
// Other sessions still receive the durable Notifications message.
let lastShownId = ''
let lastShownAt = 0
export function rememberLocalDuplicateProspectAlert(id?: string) {
  if (!id) return
  lastShownId = id
  lastShownAt = Date.now()
}
export function shouldShowRealtimeDuplicateProspectAlert(id?: string | null): boolean {
  return !(id && id === lastShownId && Date.now() - lastShownAt < 60_000)
}
