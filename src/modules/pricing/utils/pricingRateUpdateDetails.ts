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

/**
 * The FCL equipment distribution is authoritative for Freight. A prior
 * equipment's freight must not remain billable after that equipment is removed.
 * Never infer removals of non-freight charges from a transient UI rebuild.
 */
export function stalePersistedFclFreightDetailIds(
  shipmentMode: string,
  persistedDetails: Array<{ id: string; costDetailType: string }>,
  includedLines: Array<{ detailId?: string | null; costDetailType: string }>,
): Set<string> {
  if (shipmentMode.toLowerCase() !== 'fcl') return new Set<string>()

  const retainedFreightIds = new Set(
    includedLines
      .filter((line) => line.costDetailType === 'Freight' && line.detailId)
      .map((line) => line.detailId as string),
  )
  return new Set(
    persistedDetails
      .filter((detail) => detail.costDetailType === 'Freight' && !retainedFreightIds.has(detail.id))
      .map((detail) => detail.id),
  )
}


/**
 * The final update payload must never request an update and deletion of the same
 * persisted detail. The wizard's removal candidates are calculated from the
 * visible lines, while CostId/name hydration can later recover a persisted Id.
 *
 * Resolve identities AFTER building extraDetails, not before it. A legacy CIF
 * freight Id reused by an unrelated destination charge must be inserted as a
 * new row; it must not steal the Id of a freight detail being removed.
 */
export function reconcileRateUpdateDetailChanges<T extends {
  id?: string | null
  costId?: string | null
  costDetailType: string
}>(
  proposedDetails: readonly T[],
  proposedRemovedIds: readonly string[],
  persistedDetails: ReadonlyArray<{
    id: string
    costId?: string | null
    costDetailType: string
  }>,
  excludesQuotedFreight: boolean,
  completeSnapshot = false,
): { extraDetails: Array<T & { id: string | null }>; removedExtraDetailIds: string[] } {
  const persistedById = new Map(persistedDetails.map((detail) => [detail.id, detail]))
  const updatedIds = new Set<string>()
  const extraDetails: Array<T & { id: string | null }> = []

  for (const detail of proposedDetails) {
    if (excludesQuotedFreight && detail.costDetailType === 'Freight') continue

    const existing = detail.id ? persistedById.get(detail.id) : undefined
    let id = existing?.id ?? null
    // Incoterm CIF/CFR-DDP: this persisted freight row is being removed.
    // Never attach another valid charge to that doomed Freight detail ID.
    if (excludesQuotedFreight && existing?.costDetailType === 'Freight') id = null
    if (id && updatedIds.has(id)) id = null
    if (id) updatedIds.add(id)

    extraDetails.push({ ...detail, id })
  }

  const removed = new Set(proposedRemovedIds.filter((id) => persistedById.has(id)))
  // Final save represents exactly the details the user kept on Screen 7.
  // Hydrated/duplicated rows can be marked included yet disappear from the
  // normalized outbound payload; remove those persisted IDs as well.
  // Keep this opt-in: intermediate/transient UI builds are not authoritative.
  if (completeSnapshot) {
    for (const previous of persistedDetails) {
      if (!updatedIds.has(previous.id)) removed.add(previous.id)
    }
  }
  if (excludesQuotedFreight) {
    for (const original of persistedDetails) {
      if (original.costDetailType === 'Freight') removed.add(original.id)
    }
  }

  // Updating a surviving detail wins over an inferred deletion. Explicit
  // exclusion of historical Freight is safe because those IDs were cleared.
  for (const id of updatedIds) removed.delete(id)

  return {
    extraDetails,
    removedExtraDetailIds: [...removed],
  }
}
