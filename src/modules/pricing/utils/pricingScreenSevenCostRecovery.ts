/**
 * Pricing can return only part of the applicable catalogue if an AND-filter
 * combines independent carrier and agent associations on /costs/select.
 * The wizard already loads the active catalogue; re-use it as a candidate
 * source and perform the full per-charge contextual checks in applicableCost().
 *
 * A contextual result always wins for a repeated CostId. Never reconcile by
 * display name: different suppliers/POEs can have equally named charges.
 */
export function reconcileActiveCostCatalog<T extends { id: string }>(
  contextual: readonly T[],
  activeCatalog: readonly T[],
): T[] {
  const byId = new Map<string, T>()
  for (const cost of activeCatalog) {
    if (cost?.id) byId.set(cost.id, cost)
  }
  for (const cost of contextual) {
    if (cost?.id) byId.set(cost.id, cost)
  }
  return [...byId.values()]
}
