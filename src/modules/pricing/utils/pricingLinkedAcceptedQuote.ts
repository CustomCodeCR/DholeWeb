import type { RateDto } from '@/core/interfaces/pricing'

/** Show commercial QUO identifiers only; never leak the persistence UUID in UI. */
export function linkedAcceptedQuoteNumber(rate: Pick<RateDto, 'quoNumber' | 'rateCode'> | null | undefined): string {
  const quoNumber = rate?.quoNumber?.trim()
  if (quoNumber && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quoNumber))
    return quoNumber

  const rateCode = rate?.rateCode?.trim()
  if (rateCode && /^QUO[-\s]/i.test(rateCode)) return rateCode
  return 'Número de QUO no disponible'
}
