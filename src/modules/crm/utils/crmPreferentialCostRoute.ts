import type { ChargeBasis, CostSelectDto } from '@/core/interfaces/pricing'

export type PreferentialShipment = 'FCL' | 'LCL' | 'FTL' | 'LTL'
export interface PreferentialRoute {
  shipment: PreferentialShipment
  polCode: string
  poeCode: string
  podCode: string
}

// Use the same Pricing cost records as screen 7. Scope filtering is a preview;
// no CRUD operation against Pricing costs is performed from CRM.
const normalize = (value: unknown) => String(value ?? '').trim().toUpperCase()

function matchesLocation(
  code: string, relations: Array<{ code: string }> | null | undefined,
  singleCode: unknown,
): boolean {
  const choices = [ ...(relations ?? []).map(x => normalize(x.code)), normalize(singleCode) ]
    .filter(Boolean)
  return choices.length === 0 || choices.includes(normalize(code))
}

export function matchesPreferentialRoute(cost: CostSelectDto, route: PreferentialRoute): boolean {
  if (cost.isActive === false) return false
  const modes = [...(cost.shipmentModes ?? []), ...(cost.shipmentMode ? [cost.shipmentMode] : [])]
    .map(normalize)
  if (modes.length && !modes.includes(route.shipment)) return false
  if (!matchesLocation(route.polCode, cost.pols, cost.polCode)) return false
  if (!matchesLocation(route.poeCode, cost.poes, cost.poeCode)) return false
  if (route.shipment === 'FCL' || route.shipment === 'LCL') {
    if (!matchesLocation(route.podCode, cost.pods, cost.podCode)) return false
  }
  if (cost.portCode && cost.portRole && cost.portRole !== 'Any') {
    const contextCode = cost.portRole === 'Pol' ? route.polCode :
      cost.portRole === 'Poe' ? route.poeCode : route.podCode
    if (normalize(contextCode) !== normalize(cost.portCode)) return false
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
