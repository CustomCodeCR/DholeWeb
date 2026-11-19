import type { ChargeBasis, CostSelectDto } from '@/core/interfaces/pricing'

export type PreferentialShipment = 'FCL' | 'LCL' | 'FTL' | 'LTL' | 'AIR'
export interface PreferentialRoute {
  shipment: PreferentialShipment
  polCode: string
  poeCode: string
  podCode: string
  carrierCode?: string
  incotermCode?: string
  serviceCodes?: string[]
  /** Allow costs from other modalities, without ever bypassing selected route filters. */
  includeOtherShipmentModes?: boolean
}

export const PREFERENTIAL_INCOTERMS = [
  'EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',
] as const

// Empty qualifiers are explicit unrestricted scopes, preserving existing CRM agreements.
export function matchesPreferentialCommercialScope(
  rate: { carrierCode?: string | null; incotermCode?: string | null },
  selection: { carrierCode?: string; incotermCode?: string },
): boolean {
  return normalize(rate.carrierCode) === normalize(selection.carrierCode) &&
    normalize(rate.incotermCode) === normalize(selection.incotermCode)
}

// Use the same Pricing cost records as screen 7. Scope filtering is a preview;
// no CRUD operation against Pricing costs is performed from CRM.
const normalize = (value: unknown) => String(value ?? '').trim().toUpperCase()

function matchesLocation(
  code: string, relations: Array<{ code: string }> | null | undefined,
  singleCode: unknown,
): boolean {
  if (!normalize(code)) return true // No scope chosen: show every Pricing item.
  const choices = [ ...(relations ?? []).map(x => normalize(x.code)), normalize(singleCode) ]
    .filter(Boolean)
  return choices.length === 0 || choices.includes(normalize(code))
}

export function matchesPreferentialRoute(cost: CostSelectDto, route: PreferentialRoute): boolean {
  if (cost.isActive === false) return false
  if (route.serviceCodes?.length) {
    const services = (cost.services ?? []).map(x => normalize(x.code || x.name)).filter(Boolean)
    if (services.length && !route.serviceCodes.some(code => services.includes(normalize(code)))) return false
  }
  if (route.carrierCode) {
    const carriers = [...(cost.carriers ?? []).map(x => x.code), cost.carrierCode]
      .map(normalize).filter(Boolean)
    if (carriers.length && !carriers.includes(normalize(route.carrierCode))) return false
  }
  if (route.incotermCode) {
    const incoterms = (cost.incoterms ?? []).map(x => normalize(x.code || x.name)).filter(Boolean)
    if (incoterms.length && !incoterms.includes(normalize(route.incotermCode))) return false
  }
  const modes = [...(cost.shipmentModes ?? []), ...(cost.shipmentMode ? [cost.shipmentMode] : [])]
    .map(normalize)
  if (modes.length && !route.includeOtherShipmentModes &&
    !modes.some(x => x === route.shipment ||
    (route.shipment === 'AIR' && ['AIR', 'AIRCONSOL', 'AIRCOLOADER'].includes(x)))) return false
  if (!matchesLocation(route.polCode, cost.pols, cost.polCode)) return false
  if (!matchesLocation(route.poeCode, cost.poes, cost.poeCode)) return false
  if (route.shipment === 'FCL' || route.shipment === 'LCL') {
    if (!matchesLocation(route.podCode, cost.pods, cost.podCode)) return false
  }
  if (cost.portCode) {
    const port = normalize(cost.portCode)
    if (cost.portRole === 'Pol' || cost.portRole === 'Poe' || cost.portRole === 'Pod') {
      const chosen = cost.portRole === 'Pol' ? route.polCode :
        cost.portRole === 'Poe' ? route.poeCode : route.podCode
      if (normalize(chosen) && normalize(chosen) !== port) return false
    } else {
      // "Any" or legacy unset portRole means the cost is tied to a real port,
      // not unrestricted. Match one selected role; a wholly empty route remains broad.
      const chosen = [route.polCode, route.poeCode, route.podCode].map(normalize).filter(Boolean)
      if (chosen.length && !chosen.includes(port)) return false
    }
  }
  return true
}

export function saleUnitForBasis(basis: ChargeBasis): string {
  const units: Partial<Record<ChargeBasis, string>> = {
    PerShipment: 'SHIPMENT', PerService: 'SERVICE', PerContainer: 'CONTAINER',
    PerTruck: 'TRUCK', PerTeu: 'TEU', PerPickup: 'PICKUP',
    PerCbm: 'CBM', PerChargeableCbm: 'CHARGEABLE_CBM',
    PerCft: 'CFT', PerChargeableCft: 'CHARGEABLE_CFT',
    PerKg: 'KG', PerLb: 'LB', Per100Kg: '100KG', PerTon: 'TON',
    PerPallet: 'PALLET', PerPackage: 'PACKAGE', PerDocument: 'DOCUMENT',
  }
  return units[basis] ?? 'SHIPMENT'
}
