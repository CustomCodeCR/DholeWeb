/** Screen 6/7 Inland values, retained by CostId for one quotation context. */
export interface InlandEditableRow {
  key: string
  costId?: string | null
  costAmount: number
  saleAmount: number
  included: boolean
  currencyId?: string
  currencyName?: string
  currencyCode?: string
  applyDestinationTax?: boolean
  destinationTaxRate?: number | null
  billToClient?: string | null
}

export type InlandRowMemory = InlandEditableRow

export function captureInlandRows<T extends InlandEditableRow>(
  rows: readonly T[],
  belongsToInland: (row: T) => boolean,
  previous: readonly InlandRowMemory[] = [],
): InlandRowMemory[] {
  const relevant = rows.filter(belongsToInland)
  if (!relevant.length) return previous.map(row => ({ ...row }))
  return relevant.map(row => ({
    key: row.key,
    costId: row.costId ?? null,
    costAmount: row.costAmount,
    saleAmount: row.saleAmount,
    included: row.included,
    currencyId: row.currencyId,
    currencyName: row.currencyName,
    currencyCode: row.currencyCode,
    applyDestinationTax: row.applyDestinationTax,
    destinationTaxRate: row.destinationTaxRate,
    billToClient: row.billToClient,
  }))
}

export function restoreInlandRows<T extends InlandEditableRow>(
  rows: readonly T[],
  saved: readonly InlandRowMemory[],
  belongsToInland: (row: T) => boolean,
  isModeSelected: (row: T) => boolean,
): void {
  const byCostId = new Map(saved.filter(row => row.costId).map(row => [row.costId, row]))
  const byKey = new Map(saved.map(row => [row.key, row]))
  for (const row of rows) {
    if (!belongsToInland(row)) continue
    const remembered = (row.costId ? byCostId.get(row.costId) : null) ?? byKey.get(row.key)
    if (!remembered) continue
    row.costAmount = remembered.costAmount
    row.saleAmount = remembered.saleAmount
    row.included = remembered.included && isModeSelected(row)
    if (remembered.currencyId) row.currencyId = remembered.currencyId
    if (remembered.currencyName) row.currencyName = remembered.currencyName
    if (remembered.currencyCode) row.currencyCode = remembered.currencyCode
    row.applyDestinationTax = row.included && Boolean(remembered.applyDestinationTax)
    row.destinationTaxRate = remembered.destinationTaxRate
    row.billToClient = remembered.billToClient
  }
}
