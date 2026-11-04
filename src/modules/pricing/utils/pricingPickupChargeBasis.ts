import type { ChargeBasis } from '@/core/interfaces/pricing'

// FCL pickup is charged once per container. Existing view-only quotes retain
// their persisted commercial snapshot until Pricing saves a revision.
export function resolvePickupChargeBasis(
  shipmentMode: string,
  isPickupLine: boolean,
  isManual: boolean,
  viewOnly: boolean,
  configuredBasis: ChargeBasis,
): ChargeBasis {
  if (shipmentMode === 'Fcl' && isPickupLine) {
    return viewOnly ? configuredBasis : 'PerContainer'
  }
  return isPickupLine && !isManual ? 'PerShipment' : configuredBasis
}

export function pickupUsesFlatQuantity(shipmentMode: string, isPickupLine: boolean, isManual: boolean) {
  return shipmentMode !== 'Fcl' && isPickupLine && !isManual
}
