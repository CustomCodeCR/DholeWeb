// Only an indistinguishable Release charge is a duplicate. Other repeated names
// (for example Manejos for different services) must remain separate.
export type ComparableRateCharge = {
  name: string
  costDetailType?: string | null
  costType?: string | null
  chargeBasis?: string | null
  currencyCode?: string | null
  currencyId?: string | null
  costAmount?: number | null
  saleAmount?: number | null
  notes?: string | null
  billToClient?: string | null
  applyDestinationTax?: boolean | null
  destinationTaxRate?: number | null
}

const normalized = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

export function dedupeEquivalentReleaseLines<T extends ComparableRateCharge>(lines: readonly T[]): T[] {
  const seenReleaseKeys = new Set<string>()
  return lines.filter((line) => {
    if (normalized(line.name) !== 'release') return true
    const currency = normalized(line.currencyCode) || normalized(line.currencyId)
    const key = JSON.stringify([
      normalized(line.costDetailType),
      normalized(line.costType),
      normalized(line.chargeBasis),
      currency,
      Number(line.costAmount ?? 0),
      Number(line.saleAmount ?? 0),
      normalized(line.notes),
      normalized(line.billToClient),
      Boolean(line.applyDestinationTax),
      Boolean(line.applyDestinationTax) ? Number(line.destinationTaxRate ?? 0) : 0,
    ])
    if (seenReleaseKeys.has(key)) return false
    seenReleaseKeys.add(key)
    return true
  })
}
