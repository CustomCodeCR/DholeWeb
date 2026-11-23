import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import { catalogMetadata, resolveCatalogCountryCode, resolveLocationCountryCode } from './pricingCountryIso.ts'

type VatCatalogMetadata = {
  countryCode?: string
  countryId?: string
  country?: string
  countryName?: string
  vatRate?: number | string
  taxRate?: number | string
}

const DEFAULT_POD_VAT_RATES: Record<string, number> = { CR: 13, PA: 7, GT: 15 }

function itemMetadata(item?: CatalogItemSelectDto | null): VatCatalogMetadata {
  return catalogMetadata(item) as VatCatalogMetadata
}

function countryCatalogCode(item: CatalogItemSelectDto) {
  return resolveCatalogCountryCode(item)
}

function configuredVatRate(item?: CatalogItemSelectDto | null) {
  const metadata = itemMetadata(item)
  for (const candidate of [metadata.vatRate, metadata.taxRate]) {
    if (candidate === undefined || candidate === null || candidate === '') continue
    const rate = Number(candidate)
    if (Number.isFinite(rate) && rate >= 0 && rate <= 100) return rate
  }
  return null
}

/**
 * Resolve the country of a destination catalog item, whether POD or POE.
 */
export function resolvePodCountryCode(
  pod: CatalogItemSelectDto | null | undefined,
  countries: CatalogItemSelectDto[],
): string {
  return resolveLocationCountryCode(pod, countries)
}

export function resolvePodVatRate(
  pod: CatalogItemSelectDto | null | undefined,
  countries: CatalogItemSelectDto[],
): number {
  if (!pod) return 0

  const podConfiguredRate = configuredVatRate(pod)
  if (podConfiguredRate !== null) return podConfiguredRate

  const code = resolvePodCountryCode(pod, countries)
  if (!code) return 0
  // Canonical CRM countries precede VAT-only entries. Prefer the entry with
  // explicit VAT metadata rather than dropping its rate on catalog hydration.
  const country = countries.find((item) =>
    countryCatalogCode(item) === code && configuredVatRate(item) !== null)
    ?? countries.find((item) => countryCatalogCode(item) === code)
  const countryRate = configuredVatRate(country)
  if (countryRate !== null) return countryRate

  return DEFAULT_POD_VAT_RATES[code] ?? 0
}

/**
 * Prefer POD when present, including an explicit 0% rate. Only when no POD
 * exists should the POE tax jurisdiction determine the destination VAT.
 */
export function resolveDestinationVatRate(
  pod: CatalogItemSelectDto | null | undefined,
  poe: CatalogItemSelectDto | null | undefined,
  countries: CatalogItemSelectDto[],
): number {
  return resolvePodVatRate(pod ?? poe, countries)
}


export type PricingVatSection =
  | 'pickup_origin'
  | 'origin_charges'
  | 'international_freight'
  | 'destination_charges'
  | 'delivery_destination'

export type PricingVatOperation = 'Import' | 'Export' | 'TransitDomestic'

export interface PricingLineVatContext {
  source: 'POL' | 'POE' | null
  countryCode: string
  rate: number
}

/**
 * A tax-enabled charge uses the jurisdiction of the service, not the POD
 * of the whole quotation. Origin/pickup use POL; destination/delivery use
 * the selected POE. International freight follows the import/export
 * perspective; third-country transit requires an explicit fiscal decision.
 * Rates come from Config, with the existing country fallback, and are never
 * inferred from a location's city name.
 */
export function resolvePricingLineVatContext(
  section: PricingVatSection,
  operation: PricingVatOperation,
  pol: CatalogItemSelectDto | null | undefined,
  poe: CatalogItemSelectDto | null | undefined,
  countries: CatalogItemSelectDto[],
): PricingLineVatContext {
  const source = section === 'pickup_origin' || section === 'origin_charges'
    ? 'POL'
    : section === 'destination_charges' || section === 'delivery_destination'
      ? 'POE'
      : operation === 'Import' ? 'POE' : operation === 'Export' ? 'POL' : null

  const location = source === 'POL' ? pol : source === 'POE' ? poe : null
  return {
    source,
    countryCode: resolvePodCountryCode(location, countries),
    rate: resolvePodVatRate(location, countries),
  }
}

/** Remove generated VAT notes before persisting the current destination tax. */
export function stripGeneratedPodVatNotes(notes?: string | null): string {
  return String(notes ?? '')
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter((part) => part && !/^IVA\s+\d+(?:[.,]\d+)?%:\s*-?[\d.,]+;\s*venta total:\s*-?[\d.,]+$/i.test(part))
    .join(' · ')
}
