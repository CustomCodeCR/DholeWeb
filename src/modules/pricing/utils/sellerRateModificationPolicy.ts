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

/** Validity is inclusive through the last day in Costa Rica. */
export function isSellerRateExpired(rate: Pick<RateDto, 'status' | 'validTo'>, now = new Date()): boolean {
  const validUntil = String(rate.validTo ?? '').slice(0, 10)
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  return rate.status === 'Expired' || (validUntil.length === 10 && validUntil < today)
}
