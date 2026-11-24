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
  T extends { detailId?: string | null; costId?: string | null; included: boolean },
  D extends { id: string; name: string; notes?: string | null },
>(lines: T[], details: readonly D[], restore: (detail: D) => T,
  wasRemoved: (line: T) => boolean): T[] {
  let next = lines
  for (const detail of details) {
    if (!isPanamaOverweightSupplement(detail)) continue
    const index = next.findIndex(line => line.detailId === detail.id)
    const line = index >= 0 ? next[index]! : restore(detail)
    if (wasRemoved(line) || (index >= 0 && line.included)) continue
    if (next === lines) next = [...lines]
    if (index >= 0) next[index] = { ...line, included: true }
    else next.push(line)
  }
  return next
}
