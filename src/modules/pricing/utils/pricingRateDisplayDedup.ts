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

function sameOrOverlappingValidity(left: Pick<ImportRateSelectDto, 'validFrom' | 'validTo'>, right: Pick<ImportRateSelectDto, 'validFrom' | 'validTo'>): boolean {
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

/**
 * Final display-card representation. Unlike raw ImportFclRate records, a bundle
 * reflects exactly what Screen 5 will render after carrier, equipment and
 * date filtering. Deduplicate here as well: raw records can differ in optional
 * source metadata yet still create identical commercial cards.
 */
export interface FclDisplayBundleLine {
  containerTypeId: string
  quantity: number
  unitCost: number
  unitSale: number
  rate: ImportRateSelectDto
}

export interface FclDisplayBundle {
  key: string
  carrierId: string
  carrier: string
  agentId: string
  agent: string
  currencyId: string
  currency: string
  totalCost: number
  totalSale: number
  freeDays: number
  transitDays: number
  validFrom: string
  validTo: string
  preAuthorized: boolean
  lines: readonly FclDisplayBundleLine[]
}

function sameDisplayIdentity(left: string | null | undefined, right: string | null | undefined) {
  return normalized(left) === normalized(right)
}

function sameOptionalCommercialTerm(left: string | null | undefined, right: string | null | undefined) {
  const one = normalized(left)
  const two = normalized(right)
  // An omitted importer field is not a second commercial offer.
  // Two contradictory non-empty values are genuinely different offers.
  return !one || !two || one === two
}

function sameCatalogOrName(
  leftId: string, leftName: string, rightId: string, rightName: string,
): boolean {
  // Catalog IDs are authoritative: imports can give the same carrier/agent/
  // currency different display labels, including localizations and aliases.
  // Conversely, matching names let equivalent legacy IDs collapse.
  if (normalized(leftId) && sameDisplayIdentity(leftId, rightId)) return true
  if (normalized(leftName) && sameDisplayIdentity(leftName, rightName)) return true
  if (normalized(leftId) && normalized(rightId)) return false
  if (normalized(leftName) && normalized(rightName)) return false
  return !normalized(leftId) || !normalized(rightId)
}

function sameOptionalCatalogTerm(
  leftId: string | null | undefined,
  leftName: string | null | undefined,
  rightId: string | null | undefined,
  rightName: string | null | undefined,
): boolean {
  // Always compare the canonical route identity before an imported label:
  // e.g. POE "Caldera" and "Puerto Caldera, Costa Rica" are one port when
  // the catalog POE ID matches. An absent source label does not create a
  // separate commercial offer, but contradictory known routes remain distinct.
  if (normalized(leftId) && sameDisplayIdentity(leftId, rightId)) return true
  if (normalized(leftName) && sameDisplayIdentity(leftName, rightName)) return true
  if (normalized(leftId) && normalized(rightId)) return false
  return sameOptionalCommercialTerm(leftName || leftId, rightName || rightId)
}

function sameBundleLines(left: FclDisplayBundle, right: FclDisplayBundle): boolean {
  if (left.lines.length !== right.lines.length) return false
  const leftSorted = [...left.lines].sort((a, b) => a.containerTypeId.localeCompare(b.containerTypeId))
  const rightSorted = [...right.lines].sort((a, b) => a.containerTypeId.localeCompare(b.containerTypeId))
  return leftSorted.every((line, index) => {
    const other = rightSorted[index]
    if (!other) return false
    return sameDisplayIdentity(line.containerTypeId, other.containerTypeId)
      && amount(line.quantity) === amount(other.quantity)
      && amount(line.unitCost) === amount(other.unitCost)
      && amount(line.unitSale) === amount(other.unitSale)
      && sameOptionalCatalogTerm(line.rate.polId, line.rate.pol, other.rate.polId, other.rate.pol)
      && sameOptionalCatalogTerm(line.rate.poeId, line.rate.poe, other.rate.poeId, other.rate.poe)
      && sameOptionalCatalogTerm(line.rate.podId, line.rate.pod, other.rate.podId, other.rate.pod)
      && sameOptionalCommercialTerm(line.rate.spaceComment, other.rate.spaceComment)
      && sameOptionalCommercialTerm(line.rate.commodity, other.rate.commodity)
      && amount(line.rate.originCharges) === amount(other.rate.originCharges)
      && amount(line.rate.destinationCharges) === amount(other.rate.destinationCharges)
      && amount(line.rate.surcharges) === amount(other.rate.surcharges)
  })
}

function sameCommercialBundle(left: FclDisplayBundle, right: FclDisplayBundle): boolean {
  return sameCatalogOrName(left.carrierId, left.carrier, right.carrierId, right.carrier)
    && sameCatalogOrName(left.agentId, left.agent, right.agentId, right.agent)
    && sameCatalogOrName(left.currencyId, left.currency, right.currencyId, right.currency)
    && amount(left.totalCost) === amount(right.totalCost)
    && amount(left.totalSale) === amount(right.totalSale)
    && amount(left.freeDays) === amount(right.freeDays)
    && amount(left.transitDays) === amount(right.transitDays)
    && sameBundleLines(left, right)
    && sameOrOverlappingValidity(
      { validFrom: left.validFrom, validTo: left.validTo },
      { validFrom: right.validFrom, validTo: right.validTo },
    )
}

function preferCommercialBundle(candidate: FclDisplayBundle, original: FclDisplayBundle) {
  const ends = day(candidate.validTo).localeCompare(day(original.validTo))
  if (ends !== 0) return ends > 0
  const starts = day(candidate.validFrom).localeCompare(day(original.validFrom))
  if (starts !== 0) return starts < 0
  if (candidate.preAuthorized !== original.preAuthorized) return !candidate.preAuthorized
  // A complete provider description takes priority when dates and prices agree.
  const completeness = (rate: FclDisplayBundle) =>
    Number(Boolean(rate.agent)) + rate.lines.filter((line) => Boolean(line.rate.spaceComment)).length
  return completeness(candidate) > completeness(original)
}

export function uniqueVisibleFclBundles<T extends FclDisplayBundle>(bundles: readonly T[]): T[] {
  const visible: T[] = []
  for (const bundle of bundles) {
    const index = visible.findIndex((existing) => sameCommercialBundle(existing, bundle))
    if (index === -1) {
      visible.push(bundle)
    } else if (preferCommercialBundle(bundle, visible[index]!)) {
      // Preserve the original key/id from the selected source record, not a
      // synthetic combination. The chosen card remains fully selectable.
      visible[index] = bundle
    }
  }
  return visible
}
