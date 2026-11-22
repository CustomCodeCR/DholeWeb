/**
 * DH-396. Side-effect-limited reconciliation of two independently priced lines.
 * Running this on every wizard rebuild is intentional: it must be idempotent.
 * Source and persisted/manual prices always take precedence over generated ones.
 */
export interface RequiredPricingLine396 {
  name: string
  key?: string | null
  costDetailType?: string | null
  costAmount?: number | null
  saleAmount?: number | null
  included?: boolean | null
  manual?: boolean | null
  detailId?: string | null
  section?: string | null
}
function normalize396(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/\s+/g, ' ')
}
export function isRealRoadFreight396(line: Pick<RequiredPricingLine396, 'name' | 'costDetailType'>): boolean {
  const rubric = normalize396(line.name)
  return ((/^flete\b/.test(rubric) && /\bterrestre\b/.test(rubric))
    || /^land freight\b/.test(rubric))
    && (line.costDetailType === 'Freight' || line.costDetailType === 'InlandTransport')
}
export function hasActualVgm396(line: Pick<RequiredPricingLine396, 'name'>): boolean {
  return normalize396(line.name) === 'vgm'
}
/**
 * The selected Miami plan owns the commercial sale of VGM. An unpriced
 * matrix placeholder must not hide it. Never overwrite a persisted detail,
 * manual edit, or positive catalog/provider amount.
 */
export function ensureMiamiPlanVgm396<T extends RequiredPricingLine396>(
  lines: T[], planSale: number, create: () => T,
): T[] {
  if (!Number.isFinite(planSale) || planSale <= 0) return lines
  const vgm = lines.find(hasActualVgm396)
  if (vgm) {
    if (!vgm.detailId && !vgm.manual
        && (Number(vgm.saleAmount ?? 0) <= 0 || vgm.included === false)) {
      vgm.saleAmount = planSale
      vgm.included = true
    }
    return lines
  }
  return [...lines, create()]
}
/**
 * An actual road Freight is not Bunker, Gastos, or the ocean Freight.
 * Do not replace a user's saved/manual charge. Rebuilds should never
 * silently exclude a positive automatic road row on a contracted lane.
 */
export function ensureIndependentRoadFreight396<T extends RequiredPricingLine396>(
  lines: T[], roadRequested: boolean, create: () => T | null,
): T[] {
  if (!roadRequested) return lines
  const existing = lines.find(isRealRoadFreight396)
  if (existing) {
    if (!existing.detailId && !existing.manual) {
      const alreadyPriced = Number(existing.costAmount ?? 0) > 0
        || Number(existing.saleAmount ?? 0) > 0
      // A zero-priced automatic placeholder cannot suppress a priced master/rule.
      // Keep its key stable when replacing it so row components retain identity.
      if (!alreadyPriced) {
        const replacement = create()
        if (replacement) Object.assign(existing, { ...replacement, key: existing.key })
      }
      existing.section = 'international_freight'
      if (Number(existing.costAmount ?? 0) > 0 || Number(existing.saleAmount ?? 0) > 0)
        existing.included = true
    }
    return lines
  }
  const added = create()
  return added ? [...lines, added] : lines
}
