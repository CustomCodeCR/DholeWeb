/**
 * A duplicated FCL quote cannot reuse the original freight. An imported RateId
 * is enough to establish a fresh selected source. Manual freight must include
 * a valid provider, currency and a priced freight detail from the new wizard.
 */
export interface DuplicatedFclFreightInput {
  sourceRateId?: string | null
  manual: boolean
  agentId?: string | null
  carrierId?: string | null
  currencyId?: string | null
  freightCost: number | string | null | undefined
  freightSale: number | string | null | undefined
  lines: ReadonlyArray<{
    type?: string | null
    included?: boolean
    saleAmount?: number | string | null
  }>
}

export function validateDuplicatedFclFreight(input: DuplicatedFclFreightInput): boolean {
  if (input.sourceRateId?.trim()) return true
  if (!input.manual || !input.agentId || !input.carrierId || !input.currencyId) return false

  const cost = Number(input.freightCost)
  const sale = Number(input.freightSale)
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(sale) || sale <= 0) return false

  return input.lines.some((line) =>
    line.type === 'Freight'
    && line.included === true
    && Number.isFinite(Number(line.saleAmount))
    && Number(line.saleAmount) > 0,
  )
}
