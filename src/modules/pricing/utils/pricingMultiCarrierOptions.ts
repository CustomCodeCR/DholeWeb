/** Stable, collision-free identity for each POE–carrier option. */
export function carrierRouteKey(poeId: string, carrierId: string): string {
  return JSON.stringify([poeId, carrierId])
}

/** Select only configured, distinct navieras; keep the user's selection order. */
export function normalizePoeCarrierIds(values: readonly string[], catalogueIds: readonly string[]): string[] {
  const allowed = new Set(catalogueIds)
  return [...new Set(values.filter((id) => Boolean(id) && allowed.has(id)))]
}

/** Screen 5 must not proceed when a selected POE has no navieras assigned. */
export function poeCarrierSelectionComplete(
  poeIds: readonly string[],
  byPoe: Readonly<Record<string, readonly string[]>>,
): boolean {
  return poeIds.length > 0
    && poeIds.every((id) => new Set(byPoe[id] ?? []).size > 0)
}

/** The selected POEs are an ordered queue: do not jump directly to Screen 6. */
export function nextPoeInSelection(poeIds: readonly string[], currentPoeId: string): string | null {
  const index = poeIds.indexOf(currentPoeId)
  return index < 0 ? null : (poeIds[index + 1] ?? null)
}

export interface SelectedCarrierRoute { poeId: string; carrierId: string }

/** Move to exactly one more alternative, preserving POE and carrier order. */
export function nextCarrierRoute(
  routes: readonly SelectedCarrierRoute[],
  poeId: string,
  carrierId: string,
): SelectedCarrierRoute | null {
  const index = routes.findIndex((route) => route.poeId === poeId && route.carrierId === carrierId)
  return index < 0 ? null : (routes[index + 1] ?? null)
}

/** Keep customer edits and manually added lines when refreshed catalog costs arrive. */
export function mergeOptionCostLines<
  T extends { key: string; costId?: string | null; manual?: boolean; costAmount: number; saleAmount: number; included: boolean }
>(previous: readonly T[], incoming: readonly T[]): T[] {
  const existing = new Map(previous.map(line => [line.key, line]))
  const seen = new Set(incoming.map(line => line.key))
  return [
    ...incoming.map(line => {
      const edited = existing.get(line.key)
      if (!edited) return line
      return {
        ...line,
        costAmount: edited.costAmount,
        saleAmount: edited.saleAmount,
        included: edited.included,
      }
    }),
    ...previous.filter(line => line.manual && !seen.has(line.key)),
  ]
}

/** Re-entering a route at a different cost context must query again. */
export function pricingCostContextKey(params: {
  poeId: string; podId: string; carrierId: string; agentId: string;
  polId: string; incotermId: string; shipmentMode: string; serviceIds: readonly string[];
}): string {
  return JSON.stringify([
    params.poeId, params.podId, params.carrierId, params.agentId, params.polId,
    params.incotermId, params.shipmentMode, [...params.serviceIds].sort(),
  ])
}
