import type { ImportRateSelectDto } from '@/core/interfaces/pricing'

const normalized = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase()
const amount = (value: unknown) => Number(value ?? 0)
const day = (value: unknown) => String(value ?? '').slice(0, 10)

/**
 * Represents the commercial terms of the offer, not the imported source.
 * The effective dates deliberately stay OUT of this key: two emails for the
 * same MSC/MAERSK offer may start one day apart while their validity overlaps.
 * Distinct routes, agents, prices, currency, equipment and commercial terms
 * must still remain selectable.
 */
export function pricingRateDisplayKey(rate: ImportRateSelectDto): string {
  return JSON.stringify([
    normalized(rate.polId || rate.pol),
    normalized(rate.poeId || rate.poe),
    normalized(rate.podId || rate.pod),
    normalized(rate.carrierId || rate.carrier),
    normalized(rate.agentId || rate.agent),
    normalized(rate.containerTypeId || rate.containerType),
    normalized(rate.currencyId || rate.currency),
    amount(rate.freight),
    amount(rate.totalSale ?? rate.freight),
    amount(rate.originCharges),
    amount(rate.destinationCharges),
    amount(rate.surcharges),
    amount(rate.freeDays),
    amount(rate.transitDays),
    normalized(rate.spaceComment),
    normalized(rate.commodity),
  ])
}

function sameOrOverlappingValidity(left: ImportRateSelectDto, right: ImportRateSelectDto): boolean {
  const leftFrom = day(left.validFrom)
  const leftTo = day(left.validTo)
  const rightFrom = day(right.validFrom)
  const rightTo = day(right.validTo)

  // Missing/invalid ranges are not proof that two source rows overlap.
  if (!leftFrom || !leftTo || !rightFrom || !rightTo)
    return leftFrom === rightFrom && leftTo === rightTo

  return leftFrom <= rightTo && rightFrom <= leftTo
}

function preferRate(candidate: ImportRateSelectDto, existing: ImportRateSelectDto): boolean {
  // Keep the offer that remains valid longest. For equal expiry dates, keep
  // the earlier start date (the wider available validity window).
  const expiry = day(candidate.validTo).localeCompare(day(existing.validTo))
  if (expiry !== 0) return expiry > 0
  const starts = day(candidate.validFrom).localeCompare(day(existing.validFrom))
  if (starts !== 0) return starts < 0

  // When all commercial terms/dates match, prefer Approved over
  // PreAuthorized, without ever conflating genuinely different prices.
  return candidate.status === 'Approved' && existing.status !== 'Approved'
}

/**
 * Display-only deduplication. Source records and their IDs are left intact.
 * Same commercial terms + overlapping validity => one card in Screen 5.
 * Non-overlapping validity periods (or different commercial terms) remain
 * separate, and the chosen card retains a real source ID for selection.
 */
export function uniqueDisplayRates<T extends ImportRateSelectDto>(rates: readonly T[]): T[] {
  const visible: T[] = []
  const positions = new Map<string, number[]>()

  for (const rate of rates) {
    if (!rate?.id) continue
    const key = pricingRateDisplayKey(rate)
    const indices = positions.get(key) ?? []
    const overlappingIndex = indices.find((index) => {
      const previous = visible[index]
      return previous ? sameOrOverlappingValidity(previous, rate) : false
    })
    if (overlappingIndex === undefined) {
      indices.push(visible.length)
      positions.set(key, indices)
      visible.push(rate)
      continue
    }
    const previous = visible[overlappingIndex]
    if (previous && preferRate(rate, previous)) visible[overlappingIndex] = rate
  }

  return visible
}
