/**
 * A saved RateDetail ID belongs to one persisted row, not to every matching
 * catalog charge. Keep the persisted row that matches its original CostId;
 * turn other distinct lines into inserts. Never drop separate charge amounts.
 */
export function buildRateUpdateExtraDetails<T extends { costId?: string | null }>(
  details: T[],
  includedLines: Array<{ detailId?: string | null }>,
  persistedDetails: Array<{ id: string; costId?: string | null }>,
): Array<T & { id: string | null }> {
  const persistedById = new Map(persistedDetails.map((detail) => [detail.id, detail]))
  const indicesById = new Map<string, number[]>()

  includedLines.forEach((line, index) => {
    const id = line.detailId
    if (!id || !persistedById.has(id)) return
    const indices = indicesById.get(id) ?? []
    indices.push(index)
    indicesById.set(id, indices)
  })

  const winnerById = new Map<string, number>()
  indicesById.forEach((indices, id) => {
    const persistedCostId = persistedById.get(id)?.costId ?? null
    const matchingIndex = indices.find((index) =>
      (details[index]?.costId ?? null) === persistedCostId,
    )
    winnerById.set(id, matchingIndex ?? indices[0]!)
  })

  return details.flatMap((detail, index) => {
    const candidate = includedLines[index]?.detailId
    const originalId = candidate && persistedById.has(candidate) ? candidate : null
    if (originalId && winnerById.get(originalId) !== index) {
      const winnerIndex = winnerById.get(originalId)!
      // Repeated identical snapshots are a single charge, not two billable rows.
      if (JSON.stringify(detail) === JSON.stringify(details[winnerIndex])) return []
      return [{ ...detail, id: null }]
    }
    return [{ ...detail, id: originalId }]
  })
}
