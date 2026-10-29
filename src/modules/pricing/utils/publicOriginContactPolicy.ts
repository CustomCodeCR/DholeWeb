/**
 * Public QR links created before sourceKind existed only include the LCL
 * provider. Treat an external LCL agent as coloader; never do so for own GCF.
 * An explicit sourceKind wins for new QR links.
 */
function queryText(value: unknown): string {
  if (Array.isArray(value)) return queryText(value[0])
  return typeof value === 'string' ? value.trim() : ''
}

function compact(value: unknown): string {
  return queryText(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isPublicColoaderOrigin(query: Record<string, unknown>): boolean {
  const source = queryText(query.sourceKind ?? query.sourceType ?? query.lclSource).toLowerCase()
  if (source === 'coloader') return true
  if (['own', 'propio', 'gcf'].includes(source)) return false

  if (queryText(query.shipmentMode).toLowerCase() !== 'lcl') return false

  const providedAgents = [compact(query.agentCode), compact(query.agent)]
    .filter(Boolean)
  if (!providedAgents.length) return false

  return providedAgents.some((agent) => !['GCF', 'GRUPOCASTROFALLAS'].includes(agent))
}
