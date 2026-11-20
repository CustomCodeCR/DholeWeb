import type { CostSelectDto, ChargeBasis } from '../../../core/interfaces/pricing'
import { matchesPreferentialRule, preferentialSpecificity,
  type PreferentialRule, type PreferentialSelection } from '../../crm/utils/crmPreferentialMatching'
import { savedTierSales, tierSalesMatch, tierSignature } from '../../crm/utils/crmPreferentialTierSales'
import { readCostPricingRules, type CostCargoContext } from './pricingCostRules'
import { saleUnitForBasis } from '../../crm/utils/crmPreferentialCostRoute'

export type CustomerPreferentialRate = PreferentialRule & {
  currencyCode?: string | null
  unitCode?: string | null
  minimumCharge?: number | null
  insuranceCostPercent?: number | null
  insuranceSalePercent?: number | null
  tierSalesJson?: string | null
  notes?: string | null
}
export interface CustomerPreferentialContext extends PreferentialSelection {
  serviceCodes: string[]
}
export type PreferentialCargo = CostCargoContext & {
  containerQuantity?: number | null
  teuQuantity?: number | null
}

const norm = (value?: string | null) => String(value ?? '').trim().toUpperCase()
const itemName = (value?: string | null) => norm(value)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim()
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000

// The CRM route builder stores CostIds, but a Pricing cost can be recreated.
// Only recover an old link when the old CostId is absent AND exactly one current
// eligible cost has the same canonical name and charge. Never guess by name alone.
function reconciledItem(
  rate: CustomerPreferentialRate, selection: CustomerPreferentialContext,
  costs: readonly CostSelectDto[],
): PreferentialSelection | undefined {
  if (!rate.sourceCostId || norm(rate.sourceCostId) === norm(selection.sourceCostId))
    return selection
  if (!costs.length || !rate.customChargeName?.trim() || !selection.sourceCostId ||
    costs.some(cost => norm(cost.id) === norm(rate.sourceCostId))) return
  const candidates = costs.filter(cost => itemName(cost.name) === itemName(rate.customChargeName) &&
    norm(cost.costDetailType) === norm(rate.chargeCode))
  if (candidates.length !== 1 || norm(candidates[0]?.id) !== norm(selection.sourceCostId)) return
  return { ...selection, sourceCostId: rate.sourceCostId }
}

function matchedSelection(
  rate: CustomerPreferentialRate, selection: CustomerPreferentialContext,
  costs: readonly CostSelectDto[],
): PreferentialSelection | undefined {
  if (rate.sourceCostId) return reconciledItem(rate, selection, costs)
  if (norm(rate.chargeCode) === 'OTHER' && rate.customChargeName && selection.sourceCostId &&
    itemName(rate.customChargeName) === itemName(selection.customChargeName)) {
    const candidates = costs.filter(cost => itemName(cost.name) === itemName(rate.customChargeName))
    if (candidates.length === 1 && norm(candidates[0]?.id) === norm(selection.sourceCostId)) {
      return { ...selection, chargeCode: rate.chargeCode, customChargeName: rate.customChargeName }
    }
  }
  return selection
}

/** Favor the most specific active agreement, including a safely reconciled CostId. */
export function customerPreferentialRate(
  rates: CustomerPreferentialRate[], selection: CustomerPreferentialContext,
  currencyCode?: string, unitCode?: string, at = new Date(),
  availableCosts: readonly CostSelectDto[] = [],
): CustomerPreferentialRate | undefined {
  const services = selection.serviceCodes.length ? selection.serviceCodes : ['']
  const eligible = rates.filter(rate => {
    if ((rate.currencyCode && currencyCode && norm(rate.currencyCode) !== norm(currencyCode)) ||
        (rate.unitCode && unitCode && norm(rate.unitCode) !== norm(unitCode))) return false
    const candidate = matchedSelection(rate, selection, availableCosts)
    return candidate && services.some(serviceCode => matchesPreferentialRule(rate, {
      ...candidate, serviceCode: serviceCode || undefined,
    }, at))
  })
  return eligible.sort((a,b) =>
    preferentialSpecificity(b) - preferentialSpecificity(a) ||
    Number(Boolean(b.sourceCostId)) - Number(Boolean(a.sourceCostId)) ||
    (Date.parse(b.validFrom ?? '') || 0) - (Date.parse(a.validFrom ?? '') || 0) ||
    norm(a.id).localeCompare(norm(b.id)))[0]
}


/** The CRM route editor stores Pricing catalog codes. The quote wizard can
 * receive a different code for that *same catalog ID* from Config. Reconcile
 * only through exact selected relation IDs, never through location names. */
export interface CustomerPreferentialCatalogIds {
  polId?: string | null
  poeId?: string | null
  podId?: string | null
  carrierId?: string | null
}

function catalogCodeForSelectedId(
  selectedId: string | null | undefined, currentCode: string,
  costs: readonly CostSelectDto[],
  relation: (cost: CostSelectDto) => {
    items?: Array<{ id: string; code: string }> | null
    legacyId?: string | null
    legacyCode?: string | null
  },
): string {
  if (!norm(selectedId)) return currentCode
  const candidates = new Map<string, string>()
  for (const cost of costs) {
    const { items, legacyId, legacyCode } = relation(cost)
    const related = items?.length
      ? items.filter(item => norm(item.id) === norm(selectedId)).map(item => item.code)
      : norm(legacyId) === norm(selectedId) ? [legacyCode] : []
    for (const candidate of related) {
      if (norm(candidate)) candidates.set(norm(candidate), String(candidate))
    }
  }
  // A conflicting catalog is not enough evidence to substitute the quote code.
  if (candidates.has(norm(currentCode)) || candidates.size !== 1) return currentCode
  return [...candidates.values()][0] ?? currentCode
}

export function customerPreferentialCatalogContext(
  context: CustomerPreferentialContext,
  costs: readonly CostSelectDto[],
  selected: CustomerPreferentialCatalogIds,
): CustomerPreferentialContext {
  return {
    ...context,
    polCode: catalogCodeForSelectedId(selected.polId, context.polCode ?? '', costs,
      cost => ({ items: cost.pols, legacyId: cost.polId, legacyCode: cost.polCode })),
    poeCode: catalogCodeForSelectedId(selected.poeId, context.poeCode ?? '', costs,
      cost => ({ items: cost.poes, legacyId: cost.poeId, legacyCode: cost.poeCode })),
    podCode: catalogCodeForSelectedId(selected.podId, context.podCode ?? '', costs,
      cost => ({ items: cost.pods, legacyId: cost.podId, legacyCode: cost.podCode })),
    carrierCode: catalogCodeForSelectedId(selected.carrierId, context.carrierCode ?? '', costs,
      cost => ({ items: cost.carriers, legacyId: cost.carrierId, legacyCode: cost.carrierCode })),
  }
}

function unitQuantity(unit: string, cargo: PreferentialCargo): number | null {
  switch (norm(unit)) {
    case 'SHIPMENT': case 'SERVICE': case 'DOCUMENT': case 'BL': case 'PICKUP':
    case 'PACKAGE': return 1
    case 'CONTAINER': return Number(cargo.containerQuantity ?? 0) > 0 ? Number(cargo.containerQuantity) : null
    case 'TEU': return Number(cargo.teuQuantity ?? 0) > 0 ? Number(cargo.teuQuantity) : null
    case 'KG': return Number(cargo.weightKg ?? 0) > 0 ? Number(cargo.weightKg) : null
    case 'PALLET': return Number(cargo.packages ?? 0) > 0 ? Number(cargo.packages) : null
    default: return null
  }
}

/** The customer sale basis may differ from the provider basis. Normalize the
 * sale to the existing RateLine quantity; never change the provider's basis/cost. */
function normalizedSale(
  agreement: CustomerPreferentialRate, cost: CostSelectDto, value: number,
  cargo: PreferentialCargo,
): number | null {
  const desired = norm(agreement.unitCode)
  if (!desired) return value
  const basis = saleUnitForBasis(cost.chargeBasis as ChargeBasis)
  const canonical = (unit: string) => norm(unit) === 'BL' ? 'DOCUMENT' : norm(unit)
  if (canonical(desired) === canonical(basis)) return value
  const desiredQuantity = unitQuantity(desired, cargo)
  const costQuantity = unitQuantity(basis, cargo)
  if (desiredQuantity === null || costQuantity === null || costQuantity <= 0) return null
  return value * desiredQuantity / costQuantity
}

/** Only change the unit sale, leaving supplier costs and saved snapshots untouched. */
export function customerPreferentialAmounts(
  cost: CostSelectDto, base: {costAmount:number; saleAmount:number},
  rates: CustomerPreferentialRate[], selection: CustomerPreferentialContext,
  cargo: PreferentialCargo,
  availableCosts: readonly CostSelectDto[] = [],
): {costAmount:number; saleAmount:number; agreement?: CustomerPreferentialRate} {
  const agreement = customerPreferentialRate(rates, {
    ...selection, sourceCostId: cost.id, chargeCode: cost.costDetailType, customChargeName: cost.name,
  }, cost.currencyCode, undefined, new Date(), availableCosts)
  if (!agreement) return base
  const value = agreement.value === null ? NaN : Number(agreement.value)
  let sale: number | null = null
  if (agreement.rateType === 'WAIVE') sale = 0
  if (Number.isFinite(value) && value >= 0) {
    if (agreement.rateType === 'FIXED_AMOUNT') sale = normalizedSale(agreement, cost, value, cargo)
    if (agreement.rateType === 'DISCOUNT_AMOUNT') sale = Math.max(0, base.saleAmount - value)
    if (agreement.rateType === 'DISCOUNT_PERCENT' && value <= 100)
      sale = base.saleAmount * (1 - value / 100)
  }
  if (agreement.rateType === 'TIERED_SALE' && tierSalesMatch(cost, agreement.tierSalesJson)) {
    const original = readCostPricingRules(cost.pricingRulesJson)
    const match = original.find(rule => {
      if (rule.dimension === 'ContainerType') return !!cargo.containerTypeId && cargo.containerTypeId === rule.containerTypeId
      const current = rule.dimension === 'WeightKg' ? cargo.weightKg : cargo.packages
      return current != null && current > 0 && current >= (rule.minValue ?? -Infinity)
        && current <= (rule.maxValue ?? Infinity)
    })
    if (match) {
      const saved = savedTierSales(agreement.tierSalesJson).get(tierSignature(match))
      if (saved !== undefined) {
        const multiplier = match.calculationMode === 'PerKg' ? Number(cargo.weightKg) :
          match.calculationMode === 'PerExtraDay'
            ? Math.max(0, Number(cargo.storageDays ?? 0) - Number(match.includedStorageDays ?? 0)) : 1
        if (Number.isFinite(multiplier) && multiplier > 0) sale = saved * multiplier
      }
    }
  }
  // Percentage insurance depends on declared cargo value and a separate insurer
  // cost. Without both inputs, never invent an insurance premium.
  if (agreement.rateType === 'INSURANCE_PERCENT') return base
  if (sale === null || !Number.isFinite(sale) || sale < 0) return base
  return {
    costAmount: base.costAmount,
    saleAmount: round(Math.max(sale, Number(agreement.minimumCharge ?? 0))),
    agreement,
  }
}

/** Manual agreements remain billable if no matching master cost exists. */
export function customerManualPreferentialRates(
  rates: CustomerPreferentialRate[], selection: CustomerPreferentialContext,
): CustomerPreferentialRate[] {
  const seen = new Set<string>()
  const manual = rates.filter(x => !x.sourceCostId && !!x.customChargeName?.trim()
    && x.rateType === 'FIXED_AMOUNT' && x.value !== null && Number.isFinite(Number(x.value))
    && Number(x.value) >= 0)
  return manual.flatMap(rate => {
    const key = norm(rate.chargeCode) + '|' + itemName(rate.customChargeName)
    if (seen.has(key)) return []
    const best = customerPreferentialRate(manual.filter(x =>
      norm(x.chargeCode) === norm(rate.chargeCode) &&
      itemName(x.customChargeName) === itemName(rate.customChargeName)), {
        ...selection, sourceCostId: undefined,
        chargeCode: rate.chargeCode, customChargeName: rate.customChargeName ?? '',
      })
    if (!best) return []
    seen.add(key)
    return [best]
  })
}


/** Explain route-level failures without inventing match results or revealing other CRM accounts. */
export function customerPreferentialScopeIssues(
  rate: CustomerPreferentialRate, selection: CustomerPreferentialContext,
  at = new Date(),
): string[] {
  const issues: string[] = []
  if (!rate.isActive) issues.push('Desactivado')
  if (norm(rate.modality) !== norm(selection.modality)) issues.push('Modalidad')
  if (rate.validFrom && Date.parse(rate.validFrom) > at.getTime()) issues.push('Aún no vigente')
  if (rate.validUntil && Date.parse(rate.validUntil) < at.getTime()) issues.push('Vencido')
  const check = (name: string, expected?: string | null, actual?: string | null) => {
    if (expected && norm(expected) !== norm(actual)) issues.push(name)
  }
  const includes = (name: string, list?: string[], legacy?: string | null, actual?: string | null) => {
    const accepted = list?.length ? list : legacy ? [legacy] : []
    if (accepted.length && !accepted.some(code => norm(code) === norm(actual))) issues.push(name)
  }
  check('Servicio LCL/LTL',rate.laneCode,selection.laneCode)
  check('Naviera',rate.carrierCode,selection.carrierCode)
  check('Incoterm',rate.incotermCode,selection.incotermCode)
  includes('Equipo',rate.equipmentCodes,rate.equipmentCode,selection.equipmentCode)
  includes('POL',rate.polCodes,rate.originCode,selection.polCode)
  includes('POE',rate.poeCodes,rate.destinationCode,selection.poeCode)
  includes('POD',rate.podCodes,null,selection.podCode)
  if (rate.serviceCodes?.length && !rate.serviceCodes.some(x =>
    selection.serviceCodes.some(service => norm(service) === norm(x)))) issues.push('Servicios')
  return issues
}
