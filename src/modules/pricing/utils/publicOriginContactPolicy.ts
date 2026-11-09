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
  if (source === 'coloader' || source.startsWith('coloader:')) return true
  if (['own', 'propio', 'gcf'].includes(source) || source.startsWith('own:')) return false

  // Legacy QR links have no sourceKind, only LCL+agentCode. Never assume the
  // own RS/WWL/GCF consolidated providers or Costa Rica WHS IDs are coloaders.
  if (queryText(query.shipmentMode).toLowerCase() !== 'lcl') return false
  const providedAgents = [compact(query.agentCode), compact(query.agent)]
    .filter(Boolean)
  if (!providedAgents.length) return false
  const ownCodes = new Set([
    'GCF', 'GRUPOCASTROFALLAS', 'RS', 'RSLOGISTICS',
    'WWL', 'WORLDWIDELOGISTICS', 'A257', 'A287',
  ])
  // If the URL supplies one authoritative own provider, do not switch to a
  // coloader purely because another field contains a descriptive name.
  if (providedAgents.some((agent) => ownCodes.has(agent))) return false
  return true
}
