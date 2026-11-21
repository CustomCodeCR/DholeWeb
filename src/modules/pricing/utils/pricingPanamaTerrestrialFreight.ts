import type { CostSelectDto } from '@/core/interfaces/pricing'
import { resolveCostPricing } from './pricingCostRules.ts'

function plain(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function relationNames(cost: CostSelectDto, key: 'poes' | 'pods', legacy: string | null | undefined): string[] {
  const list = cost[key]
  return Array.isArray(list) && list.length
    ? list.map((entry) => plain([entry.name, entry.code].filter(Boolean).join(' ')))
    : legacy ? [plain(legacy)] : []
}

export interface PanamaTerrestrialContext {
  viaPanama: boolean
  destinationName: string
  serviceIds: string[]
  weightKg: number
  packages?: number | null
  containerTypeId?: string | null
  storageDays?: number | null
}

export interface PanamaTerrestrialPrice {
  cost: CostSelectDto
  costAmount: number
  saleAmount: number
}

/** Return ONLY the configured Panama→Costa Rica terrestrial freight, never bunker
 * or a generic ocean freight. Respect source/target locations, supplier,
 * selected transport service, and tier dimensions. Catalog stays immutable. */
export function selectPanamaTerrestrialFreight(
  catalog: readonly CostSelectDto[], ctx: PanamaTerrestrialContext,
): PanamaTerrestrialPrice | null {
  if (!ctx.viaPanama || !/costa rica|caldera|san jose|limon|moin/.test(plain(ctx.destinationName))) return null
  if (!(ctx.weightKg > 0)) return null
  const eligible = catalog.filter((cost) => {
    const name = plain(cost.name)
    if (cost.isActive === false
      || !/flete/.test(name) || !/terrestre/.test(name)
      || !/panama/.test(name) || !/costa rica/.test(name)
      || /bunker|sobrecargo|excedente/.test(name)) return false
    if (cost.carrierId || (cost.carriers?.length ?? 0) > 0) return false
    const agent = plain(cost.agentName)
    if (cost.agentId && agent && !/grupo castro fallas|\bgcf\b/.test(agent)) return false
    const sources = relationNames(cost, 'poes', cost.poeName)
    const destinations = relationNames(cost, 'pods', cost.podName)
    if (sources.length && !sources.some((s) => /panama|balboa|colon|cfz|zlc/.test(s))) return false
    if (destinations.length && !destinations.some((s) => /costa rica|caldera|san jose|limon|moin|cartago/.test(s))) return false
    if (cost.services?.length && !cost.services.some((s) => ctx.serviceIds.includes(s.id))) return false
    const modes = cost.shipmentModes?.length ? cost.shipmentModes : cost.shipmentMode ? [cost.shipmentMode] : []
    return !modes.length || modes.some((mode) => ['ftl', 'ltl', 'fcl', 'any'].includes(plain(mode)))
  })
  const priced = eligible.flatMap((cost) => {
    const amount = resolveCostPricing(cost, {
      weightKg: ctx.weightKg,
      packages: ctx.packages,
      containerTypeId: ctx.containerTypeId,
      storageDays: ctx.storageDays,
    })
    if (!amount || !Number.isFinite(amount.costAmount) || !Number.isFinite(amount.saleAmount)
      || (amount.costAmount === 0 && amount.saleAmount === 0)) return []
    return [{ cost, costAmount: amount.costAmount, saleAmount: amount.saleAmount }]
  })
  // Prefer explicit FTL classification and agent-specific freight rather than
  // accidentally choosing a less-specific master with the same name.
  priced.sort((a, b) => {
    const score = (item: PanamaTerrestrialPrice) =>
      (item.cost.shipmentModes?.includes('Ftl') || item.cost.shipmentMode === 'Ftl' ? 8 : 0)
      + (item.cost.agentId ? 4 : 0)
      + (item.cost.poes?.length ? 2 : 0)
      + (item.cost.pods?.length ? 2 : 0)
    return score(b) - score(a) || a.cost.id.localeCompare(b.cost.id)
  })
  return priced[0] ?? null
}
