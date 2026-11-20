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

const norm = (value?: string | null) => String(value ?? '').trim().toUpperCase()
const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000

/** Prefer source-cost links, then most specific route/service. Never mix customers or currencies. */
export function customerPreferentialRate(
  rates: CustomerPreferentialRate[], selection: CustomerPreferentialContext,
  currencyCode?: string, unitCode?: string,
  at = new Date(),
): CustomerPreferentialRate | undefined {
  const services = selection.serviceCodes.length ? selection.serviceCodes : ['']
  const eligible = rates.filter(rate =>
    (!rate.currencyCode || !currencyCode || norm(rate.currencyCode) === norm(currencyCode)) &&
    (!rate.unitCode || !unitCode || norm(rate.unitCode) === norm(unitCode)) &&
    services.some(serviceCode => matchesPreferentialRule(rate, {
      ...selection, serviceCode: serviceCode || undefined,
    }, at)))
  return eligible.sort((a,b) =>
    preferentialSpecificity(b) - preferentialSpecificity(a) ||
    Number(Boolean(b.sourceCostId)) - Number(Boolean(a.sourceCostId)) ||
    (Date.parse(b.validFrom ?? '') || 0) - (Date.parse(a.validFrom ?? '') || 0) ||
    norm(a.id).localeCompare(norm(b.id)))[0]
}

/** A negotiated sale alters the sell price only. Supplier costs remain in Pricing. */
export function customerPreferentialAmounts(
  cost: CostSelectDto, base: {costAmount:number; saleAmount:number},
  rates: CustomerPreferentialRate[], selection: CustomerPreferentialContext,
  cargo: CostCargoContext,
): {costAmount:number; saleAmount:number; agreement?: CustomerPreferentialRate} {
  const unitCode = saleUnitForBasis(cost.chargeBasis as ChargeBasis)
  const agreement = customerPreferentialRate(rates, {
    ...selection, sourceCostId: cost.id, chargeCode: cost.costDetailType, customChargeName: cost.name,
  }, cost.currencyCode, unitCode)
  if (!agreement) return base
  const value = Number(agreement.value)
  let sale: number | null = null
  if (agreement.rateType === 'WAIVE') sale = 0
  if (Number.isFinite(value) && value >= 0) {
    if (agreement.rateType === 'FIXED_AMOUNT') sale = value
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
  if (agreement.rateType === 'INSURANCE_PERCENT' && cost.costDetailType === 'Insurance'
    && Number.isFinite(agreement.insuranceCostPercent) && Number.isFinite(agreement.insuranceSalePercent)
    && Number.isFinite(cargo.weightKg)) {
    // Insurance percentages require declared cargo value; the wizard handles this separately.
    return base
  }
  if (sale === null || !Number.isFinite(sale) || sale < 0) return base
  return {
    costAmount: base.costAmount,
    saleAmount: round(Math.max(sale, Number(agreement.minimumCharge ?? 0))),
    agreement,
  }
}

/** Standalone manual CRM charges have no Pricing CostId. They must not disappear in screen 7. */
export function customerManualPreferentialRates(
  rates: CustomerPreferentialRate[], selection: CustomerPreferentialContext,
): CustomerPreferentialRate[] {
  const seen = new Set<string>()
  const manual = rates.filter(x => !x.sourceCostId && !!x.customChargeName?.trim()
    && x.rateType === 'FIXED_AMOUNT' && x.value !== null && Number.isFinite(Number(x.value))
    && Number(x.value) >= 0)
  return manual.flatMap(rate => {
    const key = norm(rate.chargeCode) + '|' + norm(rate.customChargeName)
    if (seen.has(key)) return []
    const best = customerPreferentialRate(manual.filter(x =>
      norm(x.chargeCode) === norm(rate.chargeCode) &&
      norm(x.customChargeName) === norm(rate.customChargeName)), {
        ...selection, sourceCostId: undefined,
        chargeCode: rate.chargeCode, customChargeName: rate.customChargeName ?? '',
      })
    if (!best) return []
    seen.add(key)
    return [best]
  })
}
