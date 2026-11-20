import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import type { RateOperationType } from '@/core/interfaces/pricing'
import { normalizeIsoCountryCode, resolveCatalogCountryCode } from './pricingCountryIso.ts'

/** Account/lead country is an authoritative Config country ID, not a port name. */
export function resolveCrmCountryCode(
  countryId: string | null | undefined,
  countries: CatalogItemSelectDto[],
): string {
  if (!countryId) return ''
  // CRM may return either a Config country UUID or a canonical ISO-2/ISO-3 code.
  const literalIso = normalizeIsoCountryCode(countryId)
  if (literalIso) return literalIso
  const country = countries.find((item) => item.id.toLowerCase() === countryId.trim().toLowerCase())
  return resolveCatalogCountryCode(country)
}

/**
 * Operation reflects the commercial perspective of the CRM client.
 * For a shipment A → B: A's customer exports; B's customer imports;
 * a third-country customer uses hybrid transit/domestic handling.
 * Physical POL/POD remain unchanged for customs, VAT and transit calculations.
 * Missing/ambiguous countries must NOT be silently classified.
 */
export function operationForClientCountry(
  clientCountry: string | null | undefined,
  originCountry: string | null | undefined,
  destinationCountry: string | null | undefined,
): RateOperationType | null {
  const client = String(clientCountry ?? '').trim().toUpperCase()
  const origin = String(originCountry ?? '').trim().toUpperCase()
  const destination = String(destinationCountry ?? '').trim().toUpperCase()
  if (![client, origin, destination].every(code => normalizeIsoCountryCode(code) === code)) return null
  if (origin === destination) return 'TransitDomestic'
  if (client === origin) return 'Export'
  if (client === destination) return 'Import'
  return 'TransitDomestic'
}
