import type { CostSelectDto } from '@/core/interfaces/pricing'
import { readCostPricingRules, type CostPricingRule } from '@/modules/pricing/utils/pricingCostRules'

// The customer agreement stores tier conditions + sale, never a supplier cost.
type TierSale = Pick<CostPricingRule, 'dimension' | 'minValue' | 'maxValue' | 'containerTypeId' | 'saleAmount'> & {
  calculationMode: 'Flat' | 'PerKg' | 'PerExtraDay'
  includedStorageDays: number | null
}
export function costTiers(cost: CostSelectDto): CostPricingRule[] {
  return readCostPricingRules(cost.pricingRulesJson)
}
export function tierSignature(rule: CostPricingRule | TierSale): string {
  return [rule.dimension, rule.minValue ?? '-', rule.maxValue ?? '-', rule.containerTypeId ?? '-',
    rule.calculationMode ?? 'Flat', rule.includedStorageDays ?? '-'].join('|')
}
export function savedTierSales(raw?: string | null): Map<string, number> {
  const prices = new Map<string, number>()
  if (!raw) return prices
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return prices
    for (const value of parsed) {
      if (!value || typeof value !== 'object') return new Map()
      const line = value as TierSale
      if (!Number.isFinite(line.saleAmount) || line.saleAmount < 0 ||
          !['WeightKg', 'Packages', 'ContainerType'].includes(line.dimension)) return new Map()
      prices.set(tierSignature(line), line.saleAmount)
    }
  } catch { return new Map() }
  return prices
}
export function tierSalesMatch(cost: CostSelectDto, raw?: string | null): boolean {
  if (!raw) return true
  const rows = costTiers(cost)
  const saved = savedTierSales(raw)
  return rows.length > 0 && saved.size === rows.length &&
    rows.every(row => saved.has(tierSignature(row)))
}
export function currentTierSale(cost: CostSelectDto, index: number,
  edits?: Record<string, string>, savedRaw?: string | null): string {
  if (edits && Object.prototype.hasOwnProperty.call(edits, String(index)))
    return edits[String(index)] ?? ''
  const row = costTiers(cost)[index]
  if (!row) return ''
  // If source rules change, never silently apply an old sales schedule to new brackets.
  const saved = tierSalesMatch(cost, savedRaw) ? savedTierSales(savedRaw) : new Map<string, number>()
  return String(saved.get(tierSignature(row)) ?? row.saleAmount)
}
export function tierSalesPayload(cost: CostSelectDto, edits?: Record<string, string>,
  savedRaw?: string | null): string {
  const rows: TierSale[] = costTiers(cost).map((row, index) => ({
    dimension: row.dimension,
    minValue: row.minValue ?? null,
    maxValue: row.maxValue ?? null,
    containerTypeId: row.containerTypeId ?? null,
    calculationMode: row.calculationMode ?? 'Flat',
    includedStorageDays: row.includedStorageDays ?? null,
    saleAmount: Number(currentTierSale(cost, index, edits, savedRaw)),
  }))
  return JSON.stringify(rows)
}
export function tierText(row: CostPricingRule, equipmentLabel?: string): string {
  const range = row.dimension === 'ContainerType'
    ? equipmentLabel || 'Equipo específico'
    : row.minValue == null ? 'Hasta ' + row.maxValue :
      row.maxValue == null ? 'Desde ' + row.minValue :
        row.minValue + ' a ' + row.maxValue
  const dimension = row.dimension === 'Packages' ? ' bultos' :
    row.dimension === 'WeightKg' ? ' kg' : ''
  const mode = row.calculationMode === 'PerKg' ? ' · por kg' :
    row.calculationMode === 'PerExtraDay'
      ? ' · por día extra (incluye ' + (row.includedStorageDays ?? 0) + ' días)' : ' · fijo'
  return range + dimension + mode
}
export function discounted(price: number, percent: number): string {
  return String(Math.round(Math.max(0, price * (1 - percent / 100)) * 1000000) / 1000000)
}
