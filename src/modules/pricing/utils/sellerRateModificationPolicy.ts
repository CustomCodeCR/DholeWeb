import type { RateDto } from '@/core/interfaces/pricing'

type SellerRateModificationState = Pick<RateDto,
  'status' | 'currentRateStatus' | 'revisionPending' | 'pendingReapproval' | 'sellerReceivedAtUtc'>

/**
 * Seller requests stop permanently once the client has accepted a quotation.
 * PendingReapproval covers Pricing's new draft after the original acceptance.
 * The Pricing API independently checks the persisted acceptance timestamp.
 */
export function canSellerRequestRateModification(rate: SellerRateModificationState): boolean {
  if (rate.revisionPending || rate.pendingReapproval
    || rate.status === 'AcceptedByClient'
    || rate.currentRateStatus === 'AcceptedByClient'
    || ['Cancelled', 'Closed'].includes(rate.status)) return false

  return Boolean(rate.sellerReceivedAtUtc)
    || ['Sent', 'RequestedByClient', 'RejectedByClient', 'Expired'].includes(rate.status)
}
