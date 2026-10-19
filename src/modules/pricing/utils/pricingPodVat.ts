import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

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
  if (!item?.metadataJson) return {}
  try {
    return JSON.parse(item.metadataJson) as VatCatalogMetadata
  } catch {
    return {}
  }
}

function normalizeCountryText(value: string) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countryCatalogCode(item: CatalogItemSelectDto) {
  return String(item.code || itemMetadata(item).countryCode || '').trim().toUpperCase()
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
 * Resolve the country from the final destination (POD) only.
 * Never use POE as a fallback: a transit port may have a different VAT rate.
 */
export function resolvePodCountryCode(
  pod: CatalogItemSelectDto | null | undefined,
  countries: CatalogItemSelectDto[],
): string {
  if (!pod) return ''

  const podMetadata = itemMetadata(pod)
  const countryId = String(podMetadata.countryId ?? '').trim()
  const countryById = countryId ? countries.find((country) => country.id === countryId) : null
  if (countryById) return countryCatalogCode(countryById)

  const explicitCode = String(podMetadata.countryCode ?? '').trim().toUpperCase()
  if (explicitCode) return explicitCode

  const alternateCode = String(podMetadata.country ?? '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(alternateCode)) return alternateCode

  const portCode = String(pod.code ?? '').trim().toUpperCase()
  // ISO 3166 country prefix in a UN/LOCODE, when the country is in the catalog.
  if (/^[A-Z]{2}[A-Z0-9]{3}$/.test(portCode)) {
    const matchingCountry = countries.find((country) => countryCatalogCode(country) === portCode.slice(0, 2))
    if (matchingCountry) return countryCatalogCode(matchingCountry)
  }

  const description = normalizeCountryText([
    pod.value, pod.label, pod.slug, podMetadata.country, podMetadata.countryName,
  ].filter(Boolean).join(' '))
  const surroundedDescription = ` ${description} `
  for (const country of countries) {
    const name = normalizeCountryText(country.value || country.label || '')
    if (name.length >= 4 && surroundedDescription.includes(` ${name} `)) return countryCatalogCode(country)
  }

  if (surroundedDescription.includes(' costa rica ') || surroundedDescription.includes(' costarica ')) return 'CR'
  if (surroundedDescription.includes(' panama ')) return 'PA'
  if (surroundedDescription.includes(' guatemala ')) return 'GT'
  return ''
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
  const country = countries.find((item) => countryCatalogCode(item) === code)
  const countryRate = configuredVatRate(country)
  if (countryRate !== null) return countryRate

  return DEFAULT_POD_VAT_RATES[code] ?? 0
}
