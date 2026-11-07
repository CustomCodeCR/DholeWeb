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
