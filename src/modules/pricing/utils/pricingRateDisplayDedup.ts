import type { ImportRateSelectDto } from '@/core/interfaces/pricing'

/**
 * Deduplicate commercial-equivalent import tariffs for screen 5 without
 * changing the underlying records or collapsing genuinely different offers.
 * Source batch and row ID are deliberately excluded: importing the same
 * offer from several emails must not create several identical visible cards.
 */
export function pricingRateDisplayKey(rate: ImportRateSelectDto): string {
  const normalized = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase()
  const date = (value: unknown) => String(value ?? '').slice(0, 10)
  const value = (amount: unknown) => Number(amount ?? 0)

  return JSON.stringify([
    normalized(rate.polId || rate.pol),
    normalized(rate.poeId || rate.poe),
    normalized(rate.podId || rate.pod),
    normalized(rate.carrierId || rate.carrier),
    normalized(rate.agentId || rate.agent),
    normalized(rate.containerTypeId || rate.containerType),
    normalized(rate.currencyId || rate.currency),
    value(rate.freight),
    value(rate.totalSale ?? rate.freight),
    value(rate.originCharges),
    value(rate.destinationCharges),
    value(rate.surcharges),
    value(rate.freeDays),
    value(rate.transitDays),
    date(rate.validFrom),
    date(rate.validTo),
    normalized(rate.spaceComment),
    normalized(rate.commodity),
  ])
}

export function uniqueDisplayRates<T extends ImportRateSelectDto>(rates: readonly T[]): T[] {
  const seen = new Set<string>()
  return rates.filter((rate) => {
    if (!rate?.id) return false
    const key = pricingRateDisplayKey(rate)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
