import type { CostSelectDto } from '@/core/interfaces/pricing'
import {
  LTL_PANAMA_REQUIRED_KINDS,
  type LtlPanamaCostContext,
  type LtlPanamaCostKind,
  selectLtlPanamaCosts,
  ltlPanamaCostKind,
} from './ltlPanamaOwnCosts.ts'
import { resolveCostPricing } from './pricingCostRules.ts'

export const PANAMA_MULTIMODAL_MAX_KG_PER_CONTAINER = 19000

export interface PanamaMultimodalOverweightCharge {
  kind: LtlPanamaCostKind
  cost: CostSelectDto
  costAmount: number
  saleAmount: number
}

export interface PanamaMultimodalOverweightQuote {
  excessKg: number
  overweightContainers: number
  charges: PanamaMultimodalOverweightCharge[]
  missing: LtlPanamaCostKind[]
}

/** The weight limit applies to each physical container, not to a summed FCL shipment. */
export function panamaMultimodalWeightExcess(weights: readonly number[]) {
  return weights.reduce((result, rawKg) => {
    const kg = Number.isFinite(rawKg) ? Math.max(0, rawKg) : 0
    if (kg > PANAMA_MULTIMODAL_MAX_KG_PER_CONTAINER) {
      result.excessKg += kg - PANAMA_MULTIMODAL_MAX_KG_PER_CONTAINER
      result.overweightContainers++
    }
    return result
  }, { excessKg: 0, overweightContainers: 0 })
}

/** Only the excess kg are priced as Panama → Costa Rica consolidated land cargo.
 * Incomplete catalog configurations must not silently become zero-price charges. */
export function pricePanamaMultimodalOverweight(
  weights: readonly number[],
  costs: CostSelectDto[],
  context: LtlPanamaCostContext = {},
): PanamaMultimodalOverweightQuote {
  const { excessKg, overweightContainers } = panamaMultimodalWeightExcess(weights)
  if (excessKg <= 0) return { excessKg: 0, overweightContainers: 0, charges: [], missing: [] }
  const selected = selectLtlPanamaCosts(costs, context)
  const charges: PanamaMultimodalOverweightCharge[] = []
  const missing: LtlPanamaCostKind[] = []
  for (const kind of LTL_PANAMA_REQUIRED_KINDS) {
    const cost = selected.get(kind)
    const priced = cost ? resolveCostPricing(cost, { weightKg: excessKg }) : null
    if (!cost || !priced || !Number.isFinite(priced.costAmount) || !Number.isFinite(priced.saleAmount)
      || priced.costAmount < 0 || priced.saleAmount < 0) {
      missing.push(kind)
      continue
    }
    charges.push({
      kind,
      cost,
      costAmount: Math.max(0, priced.costAmount, Number(cost.minimumCostAmount ?? 0)),
      saleAmount: Math.max(0, priced.saleAmount, Number(cost.minimumSaleAmount ?? 0)),
    })
  }
  return { excessKg, overweightContainers, charges, missing }
}

/** Identify generated and legacy saved excess rows, never the main inland freight. */
export function isPanamaOverweightSupplement(line: {
  key?: string | null; name?: string | null; notes?: string | null
}): boolean {
  const name = String(line.name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const notes = String(line.notes ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return Boolean(line.key?.startsWith('panama-overweight:')
    || (ltlPanamaCostKind(name) && (/^excedente panama\b/.test(name)
      || /sobrepeso sobre 19[.,]?000 kg por contenedor; costo maestro calculado unicamente por\s+\d+(?:[.,]\d+)?\s+kg excedentes/.test(notes))))
}

/** Restore only the persisted supplement; keep current edits and explicit deletions. */
export function preservePersistedPanamaOverweightLines<
  T extends { detailId?: string | null; costId?: string | null; included: boolean; key?: string | null; name?: string | null; notes?: string | null },
  D extends { id: string; name: string; notes?: string | null; costId?: string | null },
>(lines: T[], details: readonly D[], restore: (detail: D) => T,
  wasRemoved: (line: T) => boolean): T[] {
  let next = lines
  for (const detail of details) {
    if (!isPanamaOverweightSupplement(detail)) continue
    const index = next.findIndex(line => line.detailId === detail.id)
    const line = index >= 0 ? next[index]! : restore(detail)
    if (wasRemoved(line)) continue
    // Same CostId plus excess provenance is an unlinked generated replacement,
    // never the independent road leg or a different negotiated historical row.
    const aliasIndex = detail.costId && details.filter(d => d.costId === detail.costId).length === 1
      ? next.findIndex(item => !item.detailId && item.costId === detail.costId
          && isPanamaOverweightSupplement(item))
      : -1
    if (index >= 0 && line.included && aliasIndex < 0) continue
    if (next === lines) next = [...lines]
    if (index >= 0) {
      next[index] = { ...line, included: true }
      if (aliasIndex >= 0) next.splice(aliasIndex, 1)
    } else if (aliasIndex >= 0) next[aliasIndex] = line
    else next.push(line)
  }
  return next
}

// The historical CFZ → GAM base land leg is NOT the excess LTL charge.
// It has no CostId: its own RateDetail ID and the original rule marker are authoritative.
interface PanamaSavedLine {
  key?: string | null; name?: string | null; notes?: string | null
  costId?: string | null; costDetailType?: string | null; chargeBasis?: string | null
  manual?: boolean | null
}
/** A route-specific legacy CFZ road detail may have lost its marker or been
 * stored as DestinationCharge. Match the actual lane, not the price or QUO. */
export function isPanamaHistoricalRoad(line: PanamaSavedLine): boolean {
  if (line.costId || isPanamaOverweightSupplement(line)) return false
  const name = String(line.name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/\s+/g, ' ')
  const marked = /\[PANAMA_PRODUCTION_NO_SEARCH\]/i.test(String(line.notes ?? ''))
  const roadType = /^(InlandTransport|Freight)$/.test(String(line.costDetailType ?? ''))
  if (marked && roadType) return true
  const roadName = /^(flete (?:terrestre internacional|internacional terrestre)|land freight)\b/.test(name)
  const cfz = /\b(cfz|zona libre colon|zona libre de colon|colon free zone)\b/.test(name)
  const gam = /\b(san jose|gam|costa rica)\b/.test(name)
  return roadName && cfz && gam && line.chargeBasis === 'PerContainer'
    && /^(InlandTransport|Freight|DestinationCharge)$/.test(String(line.costDetailType ?? ''))
}
export function isGeneratedPanamaRoad(line: PanamaSavedLine): boolean {
  if (isPanamaOverweightSupplement(line)) return false
  const key = String(line.key ?? '')
  if (isPanamaHistoricalRoad(line)
    || key === 'panama-production:cfz-san-jose-2140'
    || key === 'p7-393-panama-gam-fcl-land'
    || key.startsWith('p7-391-multimodal-land:')) return true
  // The applicable catalog and edit delta can materialize the same base leg
  // under a CostId and generic cost:<id> key. Scope this alias to the exact
  // per-container road rubric, never other Inland, Bunker or excess charges.
  const name = String(line.name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/\s+/g, ' ')
  return line.manual !== true && line.chargeBasis === 'PerContainer'
    && /^(Freight|InlandTransport)$/.test(String(line.costDetailType ?? ''))
    && /^(flete internacional terrestre|flete terrestre internacional|land freight)$/.test(name)
}
export function preservePersistedPanamaRoad<
  T extends PanamaSavedLine & { detailId?: string | null; included: boolean; manual?: boolean; section?: string },
  D extends PanamaSavedLine & { id: string },
>(lines: T[], details: readonly D[], restore: (detail: D) => T, wasRemoved: (line: T) => boolean): T[] {
  const historical = details.filter(isPanamaHistoricalRoad)
  // Never collapse distinct, legitimately saved land legs.
  if (historical.length !== 1) return lines
  const detail = historical[0]!
  // A legacy relinker may attach the old ID to a newly generated alias.
  // Prefer the original rule provenance over that alias if both exist.
  const savedIndex = lines.findIndex(line => line.detailId === detail.id && isPanamaHistoricalRoad(line))
  const original = restore(detail)
  const current = savedIndex >= 0 ? lines[savedIndex]! : original
  if (wasRemoved(current)) return lines
  // Generated aliases are the same rule, not an additional billable row.
  const aliases = lines.filter(line => line !== current
    && (!line.detailId || line.detailId === detail.id) && isGeneratedPanamaRoad(line))
  if (savedIndex >= 0 && current.included && !current.manual
      && current.section === 'international_freight' && aliases.length === 0) return lines
  const preserved = { ...current, included: true, manual: false, section: 'international_freight' }
  // A generated alias has no authoritative edited values: restore the historical
  // snapshot (including sale/notes/ID), rather than treating the alias as a new charge.
  const next = lines.filter(line => line.detailId !== detail.id && !aliases.includes(line))
  const insertAt = savedIndex >= 0 ? savedIndex : aliases.length ? lines.indexOf(aliases[0]!) : next.length
  next.splice(Math.min(insertAt, next.length), 0, preserved)
  return next
}
