/** Merge route-priced costs by CostId, never by display name. */
export function reconcileActiveCostCatalog<T extends { id: string }>(
  contextual: readonly T[],
  activeCatalog: readonly T[],
  includeCatalogFallback: (cost: T) => boolean = () => true,
): T[] {
  const byId = new Map<string, T>()
  for (const cost of activeCatalog) {
    if (cost?.id && includeCatalogFallback(cost)) byId.set(cost.id, cost)
  }
  for (const cost of contextual) {
    if (cost?.id) byId.set(cost.id, cost)
  }
  return [...byId.values()]
}
