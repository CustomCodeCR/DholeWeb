/**
 * The quote wizard exposes freight prices on both the provider screen and the
 * editable rate-detail screen. They must update the same included freight row:
 * Pricing persists rateLines, not the auxiliary form fields.
 */
export interface EditableFreightUnitLine {
  costDetailType: string
  included: boolean
  costAmount: number
  saleAmount: number
}

export function singleIncludedFreightLine<T extends EditableFreightUnitLine>(
  lines: readonly T[],
): T | null {
  const freight = lines.filter((line) => line.costDetailType === 'Freight' && line.included)
  return freight.length === 1 ? freight[0]! : null
}

export function applyFreightUnitAmount<T extends EditableFreightUnitLine>(
  lines: readonly T[],
  field: 'costAmount' | 'saleAmount',
  rawAmount: number | string,
): number | null {
  const amount = Number(rawAmount)
  if (!Number.isFinite(amount) || amount < 0) return null

  const freight = singleIncludedFreightLine(lines)
  if (freight) freight[field] = amount
  return amount
}
