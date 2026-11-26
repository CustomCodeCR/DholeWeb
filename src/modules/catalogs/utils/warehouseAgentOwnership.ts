/** Config WHS ownership: explicit UUID first, then the existing agent codes/names. */
type CatalogIdentity = {
  id: string
  code?: string | null
  label?: string | null
  value?: string | null
  slug?: string | null
  metadataJson?: string | null
}
type Ownership = 'linked' | 'unlinked' | 'other'

function metadata(raw?: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return {}
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch { return null }
}
function strings(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === 'string' && !!item.trim()).map(item => item.trim())
}
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function aliases(values: string[]): Set<string> {
  return new Set(values.flatMap(value => {
    const key = normalize(value)
    return [key, key.replace(/^(agent|agente) /, '')]
  }).filter(Boolean))
}
export function warehouseAgentNames(raw?: string | null): string[] {
  const meta = metadata(raw)
  if (!meta) return []
  const names = [...strings(meta.agentName), ...strings(meta.agentNames)]
  return [...new Set(names.length ? names : [...strings(meta.agentCode), ...strings(meta.agentCodes)])]
}
export function warehouseAgentOwnership(raw: string | null | undefined, agent?: CatalogIdentity): Ownership {
  const meta = metadata(raw)
  if (!meta) return 'other'
  const owner = meta.agentId
  if (owner != null && typeof owner !== 'string') return 'other'
  if (typeof owner === 'string' && owner.trim())
    return agent && owner.trim().toLowerCase() === agent.id.toLowerCase() ? 'linked' : 'other'
  const codes = [...strings(meta.agentCode), ...strings(meta.agentCodes)]
  const names = [...strings(meta.agentName), ...strings(meta.agentNames)]
  const fields = [meta.agentCode, meta.agentCodes, meta.agentName, meta.agentNames]
  if (fields.some(field => field != null && typeof field !== 'string' &&
    (!Array.isArray(field) || field.some(item => typeof item !== 'string')))) return 'other'
  if (!codes.length && !names.length) return 'unlinked'
  if (!agent) return 'other'
  const agentMeta = metadata(agent.metadataJson) || {}
  const identities = aliases([agent.code, agent.label, agent.value, agent.slug].flatMap(strings)
    .concat(strings(agentMeta.agentCode), strings(agentMeta.agentCodes), strings(agentMeta.agentName), strings(agentMeta.agentNames)))
  return [...aliases(codes.length ? codes : names)].some(key => identities.has(key)) ? 'linked' : 'other'
}
