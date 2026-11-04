/**
 * An FCL/FTL quotation can have a purely descriptive cargo line with weightKg=0,
 * while the real aggregate weight is stored in the header and container units.
 * Use that persisted aggregate instead of interpreting a zero cargo line as final.
 */
export function resolvePersistedCargoWeightKg(
  shipmentMode: string,
  totalWeightKg: number | null | undefined,
  cargoLines: ReadonlyArray<{ weightKg?: number | null }> | null | undefined,
): number {
  const headerWeight = Math.max(0, Number(totalWeightKg) || 0)
  const detailedWeight = (cargoLines ?? []).reduce(
    (sum, line) => sum + Math.max(0, Number(line.weightKg) || 0), 0,
  )
  if ((shipmentMode === 'Fcl' || shipmentMode === 'Ftl') && headerWeight > 0) {
    return headerWeight
  }
  return detailedWeight > 0 ? detailedWeight : headerWeight
}
