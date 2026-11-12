import type { CostSelectDto } from '@/core/interfaces/pricing'
import type { FtlTariffDto } from '@/core/services/ftlTariffService'
import { resolveCostPricing } from './pricingCostRules.ts'
import { isLtlCfzLocation, normalizeLandLocation } from './ltlGamRouting.ts'

/**
 * Country-route operational charges are catalog costs, not additional master
 * tariff rows. Keep this rule restricted to own LTL from CFZ to San José.
 */
export type LtlPanamaCostKind = 'freight' | 'bunker' | 'panama-expenses' | 'custody'

export const LTL_PANAMA_REQUIRED_KINDS: readonly LtlPanamaCostKind[] = [
  'freight', 'bunker', 'panama-expenses', 'custody',
]

export function isCfzToSanJoseOwnLtl(
  origin: unknown,
  destination: unknown,
  shipmentMode: unknown,
  commercialProfile: unknown,
): boolean {
  const dest = normalizeLandLocation(destination)
  return shipmentMode === 'Ltl'
    && commercialProfile === 'FinalClient'
    && isLtlCfzLocation(origin)
    && /\bsan jose\b/.test(dest)
}

export function ltlPanamaCostKind(name: unknown): LtlPanamaCostKind | null {
  const s = normalizeLandLocation(name)
  if (/\bcustodia\b/.test(s) && /\bmarchamo\b/.test(s)) return 'custody'
  if (/\bbunker\b/.test(s)) return 'bunker'
  if (/\bflete\b/.test(s) && /\bterrestre\b/.test(s)
    && /\bpanama\b/.test(s) && /\bcosta rica\b/.test(s)) return 'freight'
  if (/\bgastos\b/.test(s) && /\bpanama\b/.test(s) && /\bcosta rica\b/.test(s)) return 'panama-expenses'
  return null
}

export interface LtlPanamaCostContext {
  incotermId?: string | null
  serviceIds?: string[]
}

function relatedNames(cost: CostSelectDto, relation: 'poes' | 'pods') {
  const records = cost[relation]
  if (Array.isArray(records) && records.length) {
    return records.map((item) => normalizeLandLocation(item.name + ' ' + item.code))
  }
  const name = relation === 'poes' ? cost.poeName : cost.podName
  return name ? [normalizeLandLocation(name)] : []
}

function sourceMatchesRoute(cost: CostSelectDto) {
  const origins = relatedNames(cost, 'poes')
  const destinations = relatedNames(cost, 'pods')
  // Multi-POE selection is authoritative. A cost only for Balboa or another
  // unrelated origin may not leak into CFZ just because its name mentions Panama.
  if (origins.length && !origins.some(isLtlCfzLocation)) return false
  // Panama -> Costa Rica cross-border costs may name a CR port rather than
  // San José itself. Country is enough only after the origin was verified.
  if (destinations.length && !destinations.some((s) =>
    /\bcosta rica\b|\bsan jose\b|\bcaldera\b|\bmoin\b|\blimon\b|\bcartago\b/.test(s))) return false
  return true
}

function activeLtlCost(cost: CostSelectDto, ctx: LtlPanamaCostContext): boolean {
  if (cost.isActive === false || !ltlPanamaCostKind(cost.name)) return false
  const modes = cost.shipmentModes?.length ? cost.shipmentModes : cost.shipmentMode ? [cost.shipmentMode] : []
  if (modes.length && !modes.some((mode) => String(mode).toLowerCase() === 'ltl')) return false
  if (cost.incoterms?.length && !cost.incoterms.some((item) => item.id === ctx.incotermId)) return false
  if (cost.services?.length && !cost.services.some((item) => ctx.serviceIds?.includes(item.id))) return false
  return sourceMatchesRoute(cost)
}

function specificity(cost: CostSelectDto) {
  const origins = relatedNames(cost, 'poes')
  const destinations = relatedNames(cost, 'pods')
  return (origins.some(isLtlCfzLocation) ? 8 : 0)
    + (destinations.some((s) => /\bsan jose\b/.test(s)) ? 4 : 0)
    + (cost.shipmentModes?.includes('Ltl') || cost.shipmentMode === 'Ltl' ? 2 : 0)
    + (cost.incoterms?.length ? 1 : 0)
}

/** A single cost per commercial concept; no duplicated fixed charges. */
export function selectLtlPanamaCosts(costs: CostSelectDto[], ctx: LtlPanamaCostContext = {}) {
  const selected = new Map<LtlPanamaCostKind, CostSelectDto>()
  for (const cost of [...costs].filter((c) => activeLtlCost(c, ctx))
    .sort((a, b) => specificity(b) - specificity(a) || a.id.localeCompare(b.id))) {
    const kind = ltlPanamaCostKind(cost.name)!
    if (!selected.has(kind)) selected.set(kind, cost)
  }
  return selected
}

/** Virtual own-LTL route. Nothing is saved to the land-tariff table: every amount
 * comes from the four active Costos y recargos rows on each quote refresh. */
export const CFZ_SAN_JOSE_CATALOG_TARIFF_ID = 'ltl-catalog:cfz-san-jose'

export interface CfzSanJoseQuoteContext extends LtlPanamaCostContext {
  originId?: string | null
  originName?: string | null
  originCode?: string | null
  destinationId?: string | null
  destinationName?: string | null
  destinationCode?: string | null
  weightKg: number
  billableCbm: number
}

export function buildCfzSanJoseCatalogTariff(
  costs: CostSelectDto[],
  context: CfzSanJoseQuoteContext,
): FtlTariffDto | null {
  if (!isCfzToSanJoseOwnLtl(
    [context.originName, context.originCode].filter(Boolean).join(' '),
    [context.destinationName, context.destinationCode].filter(Boolean).join(' '),
    'Ltl', 'FinalClient',
  )) return null
  const weightKg = Number(context.weightKg)
  const cbm = Number(context.billableCbm)
  // The route remains visible even before the seller enters the weight.
  // Its selection is disabled until the master band can be priced.
  if (!Number.isFinite(cbm) || cbm <= 0) return null
  const hasWeight = Number.isFinite(weightKg) && weightKg > 0
  const selected = selectLtlPanamaCosts(costs, context)
  if (LTL_PANAMA_REQUIRED_KINDS.some((kind) => !selected.has(kind))) return null
  const amounts = hasWeight ? LTL_PANAMA_REQUIRED_KINDS.map((kind) => {
    const cost = selected.get(kind)!
    const price = resolveCostPricing(cost, { weightKg })
    if (!price || !Number.isFinite(price.costAmount) || !Number.isFinite(price.saleAmount)) return null
    return {
      kind,
      cost,
      amount: {
        costAmount: Math.max(0, price.costAmount, Number(cost.minimumCostAmount ?? 0)),
        saleAmount: Math.max(0, price.saleAmount, Number(cost.minimumSaleAmount ?? 0)),
      },
    }
  }) : []
  if (hasWeight && amounts.some((item) => item === null)) return null
  const freight = amounts.find((item) => item?.kind === 'freight')
  const freightCost = selected.get('freight')!
  return {
    id: CFZ_SAN_JOSE_CATALOG_TARIFF_ID,
    originId: context.originId || null,
    originName: context.originName || 'Colón Free Zone, Panamá',
    originCode: context.originCode || 'CFZ',
    destinationId: context.destinationId || null,
    destinationName: context.destinationName || 'San José, Costa Rica',
    destinationCode: context.destinationCode || 'SJO',
    applicableOriginIds: context.originId ? [context.originId] : [],
    applicableDestinationIds: context.destinationId ? [context.destinationId] : [],
    equipmentClass: 'LTL_CBM',
    equipmentLabel: 'LTL propio · Costos y recargos',
    currencyId: freightCost.currencyId,
    currencyName: freightCost.currencyName,
    currencyCode: freightCost.currencyCode,
    priceAmount: freight?.amount.saleAmount ? freight.amount.saleAmount / cbm : 0,
    costPerCbm: freight?.amount.costAmount ? freight.amount.costAmount / cbm : 0,
    minimumAmount: 0,
    panamaCostSurchargePerCbm: 0,
    rateBasis: 'PerCbm',
    shipmentMode: 'Ltl',
    commercialProfile: 'FinalClient',
    transitDays: null,
    source: 'Costos y recargos · Panamá → Costa Rica',
    notes: hasWeight
      ? 'Importes dinámicos por peso; flete, Bunker, Gastos y Custodia + Marchamo'
      : 'Pendiente de ingresar peso total en KG para calcular tramos',
    warehouseName: 'Tarifa LTL propia calculada',
    isActive: true,
    validFrom: null,
    validTo: null,
    applicableEquipmentClasses: ['LTL_CBM'],
    weightKgPerCbm: 333.33,
    duaCost: null,
    ducaTCost: null,
    stuffingCostPerCbm: null,
    stuffingSalePerCbm: null,
    ltlChargeItems: [],
  }
}
