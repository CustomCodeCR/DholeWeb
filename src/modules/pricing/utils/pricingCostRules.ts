import type { CostDto } from '@/core/interfaces/pricing'

export type CostRuleDimension = 'WeightKg' | 'Packages' | 'ContainerType'

export interface CostPricingRule {
  dimension: CostRuleDimension
  minValue: number | null
  maxValue: number | null
  containerTypeId: string | null
  costAmount: number
  saleAmount: number
  calculationMode?: 'Flat' | 'PerKg' | 'PerExtraDay'
  includedStorageDays?: number | null
}

export interface CostCargoContext {
  weightKg?: number | null
  packages?: number | null
  containerTypeId?: string | null
  storageDays?: number | null
}

export function readCostPricingRules(json: string | null | undefined): CostPricingRule[] {
  if (!json) return []
  try {
    const items: unknown = JSON.parse(json)
    if (!Array.isArray(items)) return []
    return items.filter((item): item is CostPricingRule =>
      item !== null && typeof item === 'object'
      && ['WeightKg', 'Packages', 'ContainerType'].includes(String(item.dimension)),
    )
  } catch {
    return []
  }
}

export function validateCostPricingRules(rules: CostPricingRule[]): string | null {
  if (rules.length > 100) return 'Puede configurar hasta 100 reglas.'
  if (!rules.length) return null
  const dimension = rules[0]!.dimension
  for (const rule of rules) {
    if (rule.dimension !== dimension) return 'Todas las filas deben utilizar la misma condición.'
    if (rule.calculationMode && !['Flat', 'PerKg', 'PerExtraDay'].includes(rule.calculationMode)) return 'Modo de cálculo no válido.'
    if (rule.calculationMode === 'PerExtraDay' && (rule.includedStorageDays == null || !Number.isInteger(rule.includedStorageDays) || rule.includedStorageDays < 0)) return 'Indique la cantidad de días de almacenaje incluidos.'
    if (rule.calculationMode !== 'PerExtraDay' && rule.includedStorageDays != null) return 'Los días incluidos solo se permiten en cargos diarios.'
    if (rule.calculationMode === 'PerKg' && dimension !== 'WeightKg') return 'El cálculo por kilogramo solo aplica a los rangos de peso.'
    if (!Number.isFinite(rule.costAmount) || rule.costAmount < 0
      || !Number.isFinite(rule.saleAmount) || rule.saleAmount < 0) {
      return 'Indique montos positivos o cero para costo y venta.'
    }
    if (dimension === 'ContainerType') {
      if (!rule.containerTypeId) return 'Seleccione un tipo de contenedor en cada fila.'
    } else {
      const min = rule.minValue
      const max = rule.maxValue
      if (min == null && max == null) return 'Indique al menos un límite por rango.'
      if ((min != null && (!Number.isFinite(min) || min < (dimension === 'Packages' ? 1 : 0)))
        || (max != null && (!Number.isFinite(max) || max < (dimension === 'Packages' ? 1 : 0)))
        || (min != null && max != null && min > max)) {
        return 'Revise los límites de los rangos.'
      }
      if (dimension === 'Packages' && ((min != null && !Number.isInteger(min))
        || (max != null && !Number.isInteger(max)))) {
        return 'Los límites de bultos deben ser enteros.'
      }
    }
  }
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]!
      const b = rules[j]!
      const overlap = dimension === 'ContainerType'
        ? a.containerTypeId === b.containerTypeId
        : (a.minValue ?? -Infinity) <= (b.maxValue ?? Infinity)
          && (b.minValue ?? -Infinity) <= (a.maxValue ?? Infinity)
      if (overlap) return 'Los rangos no pueden solaparse ni repetir el mismo contenedor.'
    }
  }
  return null
}

export function resolveCostPricing(
  cost: Pick<CostDto, 'costAmount' | 'saleAmount' | 'pricingRulesJson'>,
  cargo: CostCargoContext,
): { costAmount: number; saleAmount: number } | null {
  if (!cost.pricingRulesJson) {
    return { costAmount: Number(cost.costAmount), saleAmount: Number(cost.saleAmount) }
  }
  const rules = readCostPricingRules(cost.pricingRulesJson)
  const matched = rules.find((rule) => {
    if (rule.dimension === 'ContainerType') {
      return !!cargo.containerTypeId && rule.containerTypeId === cargo.containerTypeId
    }
    const value = rule.dimension === 'WeightKg' ? cargo.weightKg : cargo.packages
    return value != null && value > 0
      && value >= (rule.minValue ?? -Infinity)
      && value <= (rule.maxValue ?? Infinity)
  })
  if (!matched) return null
  if (matched.calculationMode === 'PerExtraDay' && cargo.storageDays == null) return null
  const multiplier = matched.calculationMode === 'PerKg' ? Number(cargo.weightKg)
    : matched.calculationMode === 'PerExtraDay'
      ? Math.max(0, Number(cargo.storageDays) - Number(matched.includedStorageDays))
      : 1
  if (matched.calculationMode === 'PerExtraDay' && multiplier <= 0) return null
  return { costAmount: Number(matched.costAmount) * multiplier, saleAmount: Number(matched.saleAmount) * multiplier }
}
