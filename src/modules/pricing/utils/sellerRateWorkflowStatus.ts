import type { RateDto, RateStatus } from '@/core/interfaces/pricing'

type SellerProjection = Pick<RateDto, 'status' | 'revisionPending' | 'currentRateStatus'>

// Only workflow metadata is current. Commercial prices/lines still come from
// the previously published revision until Pricing sends the new revision.
export function currentSellerWorkflowStatus(rate: SellerProjection): RateStatus {
  return rate.revisionPending && rate.currentRateStatus
    ? rate.currentRateStatus
    : rate.status
}

export function unpublishedSellerWorkflowLabel(
  rate: SellerProjection,
  hasOpenPricingModification: boolean,
): string | null {
  if (!rate.revisionPending) return null
  if (hasOpenPricingModification) return 'En modificación por Pricing'

  switch (rate.currentRateStatus) {
    case 'Open': return 'Abierta'
    case 'PendingApproval': return 'Pendiente de aprobación'
    case 'ApprovedByManagement': return 'Aprobada por gerencia'
    case 'RejectedByManagement': return 'Rechazada por gerencia'
    default: return 'Última revisión enviada · Actualización pendiente'
  }
}

/**
 * The workflow may be Open after an edit even though Sales still owns the
 * previously issued revision. Only that issued revision may be decided; never
 * enable direct actions for a draft still being worked on by Pricing.
 */
export function canDecideSellerQuote(
  rate: SellerProjection,
  modificationWorkOpen: boolean,
): boolean {
  if (!rate.revisionPending)
    return ['Open', 'Sent', 'RequestedByClient'].includes(rate.status)

  return currentSellerWorkflowStatus(rate) === 'Open'
    && !modificationWorkOpen
    && ['Sent', 'RequestedByClient'].includes(rate.status)
}
