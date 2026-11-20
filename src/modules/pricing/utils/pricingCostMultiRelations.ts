/**
 * Pricing exposes multi-valued cost restrictions next to historical first-value
 * snapshots. The hydrated lists are authoritative whenever configured.
 * Using only the legacy ID would hide charges valid for a second POE/POD/carrier.
 */
export function costRelationMatches(
  relations: ReadonlyArray<{ id: string }> | null | undefined,
  legacyId: string | null | undefined,
  selectedId: string | null | undefined,
): boolean {
  const configuredIds = relations?.map(item => item.id).filter(Boolean) ?? []
  const permitted = configuredIds.length ? configuredIds : legacyId ? [legacyId] : []
  if (permitted.length === 0) return true
  return Boolean(selectedId) && permitted.includes(selectedId!)
}

/** An old single PortId must not override a multi-port selection for its role. */
export function costLegacyPortMatches(context: {
  portId?: string | null
  portRole?: string | null
  pols?: ReadonlyArray<{ id: string }> | null
  poes?: ReadonlyArray<{ id: string }> | null
  pods?: ReadonlyArray<{ id: string }> | null
}, selected: { polId?: string | null; poeId?: string | null; podId?: string | null }): boolean {
  if (!context.portId) return true
  const role = String(context.portRole ?? '').toLowerCase()
  if (role === 'pol') {
    if (context.pols?.length) return true
    return selected.polId === context.portId
  }
  if (role === 'poe') {
    if (context.poes?.length) return true
    return selected.poeId === context.portId
  }
  if (role === 'pod') {
    if (context.pods?.length) return true
    return selected.podId === context.portId
  }
  return [selected.polId, selected.poeId, selected.podId].some(id => Boolean(id) && id === context.portId)
}
