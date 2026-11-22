import type { CostSelectDto } from '@/core/interfaces/pricing'
import { resolveCostPricing } from './pricingCostRules.ts'
import { LTL_PANAMA_REQUIRED_KINDS, ltlPanamaCostKind } from './ltlPanamaOwnCosts.ts'

/**
 * DH-391: only use explicitly related Panama → Costa Rica cost masters.
 * The legacy singular POE/POD columns point to the FIRST selected port;
 * the complete many-to-many POE/POD relations are authoritative.
 */
export interface P7CostRoute391 {
  originIds: string[]
  destinationIds: string[]
  /** Commercial POL / POE names. Config keeps separate IDs for POL and POE groups. */
  originNames?: string[]
  destinationNames?: string[]
  incotermId: string | null
  agentId: string | null
  serviceIds: string[]
  weightKg: number
}

function normal(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
export function isPanamaCostaRicaRoute391(origin: unknown, destination: unknown) {
  const a = normal(origin)
  const b = normal(destination)
  return /\b(panama|balboa|colon|cristobal|cfz|zlc|manzanillo|rodman)\b/.test(a)
    && /\b(costa rica|san jose|caldera|moin|limon|cartago|alajuela|heredia|coyol)\b/.test(b)
}
function allowedRelation(cost: CostSelectDto, relation: 'poes' | 'pods', candidates: string[], names: string[] = []) {
  const entries = cost[relation] ?? []
  const selected = candidates.map(String).filter(Boolean)
  const portNames = names.map(normal).filter(Boolean)
  if (!selected.length && !portNames.length) return false
  const ids = entries.length ? entries.map(x => String(x.id)) :
    [relation === 'poes' ? cost.poeId : cost.podId].filter(Boolean).map(String)
  if (!ids.length) return true
  if (ids.some(id => selected.includes(id))) return true
  // A commercial CFZ POL and its corresponding physical POE have distinct
  // Config IDs. The exact normalized port name is a safe cross-group match;
  // never accept an unrelated Panama port just because the country matches.
  const related = entries.length ? entries.map(x => x.name) :
    [relation === 'poes' ? cost.poeName : cost.podName]
  return related.some(name => portNames.includes(normal(name)))
}
function relevant(cost: CostSelectDto, route: P7CostRoute391, mode: 'Ltl' | 'Fcl', landLeg = false) {
  if (cost.isActive === false) return false
  const allowedModes = cost.shipmentModes?.length ? cost.shipmentModes : cost.shipmentMode ? [cost.shipmentMode] : []
  if (allowedModes.length && !allowedModes.some(value => {
    const name = normal(value)
    // Multimodal FCL uses an FTL/Land cost master for its independent
    // Panama -> Costa Rica leg. Do not force that land master to also be FCL.
    return name === normal(mode) || name === 'any'
      || (landLeg && (name === 'ftl' || name === 'land' || name === 'multimodal'))
  })) return false
  if (cost.incoterms?.length && !cost.incoterms.some(i => i.id === route.incotermId)) return false
  if (cost.services?.length && !cost.services.some(i => route.serviceIds.includes(i.id))) return false
  if ((cost.agentId || cost.agents?.length) &&
    !(cost.agents?.some(i => i.id === route.agentId) || cost.agentId === route.agentId)) return false
  if (!allowedRelation(cost, 'poes', route.originIds, route.originNames) ||
      !allowedRelation(cost, 'pods', route.destinationIds, route.destinationNames)) return false
  return true
}

export function selectPanamaLtlCharges391(catalog: CostSelectDto[], route: P7CostRoute391) {
  const found = new Map<string, { cost: CostSelectDto; costAmount: number; saleAmount: number }>()
  const valid = catalog.filter(c => Boolean(ltlPanamaCostKind(c.name)) && relevant(c, route, 'Ltl'))
  for (const kind of LTL_PANAMA_REQUIRED_KINDS) {
    const candidates = valid.filter(c => ltlPanamaCostKind(c.name) === kind)
      .sort((a, b) => {
        // Prefer the exact selected POE + POD relation, then stable ID.
        const score = (c: CostSelectDto) =>
          (c.poes?.some(i => route.originIds.includes(i.id)) ? 2 : 0) +
          (c.pods?.some(i => route.destinationIds.includes(i.id)) ? 2 : 0) +
          (c.incoterms?.length ? 1 : 0)
        return score(b) - score(a) || a.id.localeCompare(b.id)
      })
    const cost = candidates[0]
    if (!cost) continue
    const amount = resolveCostPricing(cost, { weightKg: route.weightKg })
    if (!amount || !Number.isFinite(amount.costAmount) || !Number.isFinite(amount.saleAmount)) continue
    found.set(kind, {
      cost,
      costAmount: Math.max(0, amount.costAmount, Number(cost.minimumCostAmount ?? 0)),
      saleAmount: Math.max(0, amount.saleAmount, Number(cost.minimumSaleAmount ?? 0)),
    })
  }
  return found
}

/** Multimodal land leg is independent of the maritime Freight and its container allocation. */
export function selectMultimodalLandFreight391(catalog: CostSelectDto[], route: P7CostRoute391) {
  const eligible = catalog.filter(c => ['Freight', 'InlandTransport'].includes(String(c.costDetailType))
    && /flete.*terrestre|terrestre.*flete|land freight/.test(normal(c.name))
    && relevant(c, route, 'Fcl', true))
    .sort((a,b) => a.id.localeCompare(b.id))
  return eligible[0] ?? null
}

/** DH-395: Bunker Flete Internacional Terrestre is NOT the land freight itself.
 * Check the commercial rubric and the cost classification, not a substring.
 * Explicitly prevent a bunker/destination charge from suppressing the FCL leg.
 */
export function isTerrestrialFreightRow395(
  name: unknown, costDetailType: unknown,
): boolean {
  const rubric = normal(name).trim()
  const isFreightName =
    (/^flete\b/.test(rubric) && /\bterrestre\b/.test(rubric))
    || /^land freight\b/.test(rubric)
  return isFreightName &&
    (costDetailType === 'Freight' || costDetailType === 'InlandTransport')
}

export function freightModeTitle391(name: string, costDetailType: string | null | undefined,
  modality: string) {
  if (costDetailType !== 'Freight') return name
  const clean = normal(name)
  // Keep independently priced legs, and preserve equipment annotations.
  const suffix = name.match(/(\s*[·-]\s*(?:20|40|45|48|53|hc|hq|std|reefer|contenedor)[^\n]*)$/i)?.[1] ?? ''
  const kind = /terrestre|land freight/.test(clean) ? 'terrestre'
    : /aereo|air freight/.test(clean) ? 'aéreo'
    : /maritimo|ocean|sea freight/.test(clean) ? 'marítimo'
    : modality === 'Land' ? 'terrestre'
    : modality === 'Air' ? 'aéreo'
    : 'marítimo'
  return 'Flete internacional ' + kind + suffix
}
