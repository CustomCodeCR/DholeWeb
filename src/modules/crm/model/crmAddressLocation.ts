import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

export interface CrmGeoCountry {
  code: string
  name: string
}
export interface CrmGeoOption {
  code: string
  name: string
}
export interface CrmGeoResponse {
  level: string
  options: CrmGeoOption[]
  source: string
}
export interface CrmAddressLocation {
  countryId: string
  countryCode: string
  admin1Code: string
  admin1Name: string
  admin2Code: string
  admin2Name: string
  admin3Code: string
  admin3Name: string
  postalCode: string
}
export function emptyAddressLocation(): CrmAddressLocation {
  return { countryId: '', countryCode: '', admin1Code: '', admin1Name: '',
    admin2Code: '', admin2Name: '', admin3Code: '', admin3Name: '', postalCode: '' }
}
export function costaRicaPostalCode(location: CrmAddressLocation): string {
  if (location.countryCode !== 'CR') return ''
  const parts = [location.admin1Code, location.admin2Code, location.admin3Code]
  if (!parts.every(part => /^\d{1,2}$/.test(part))) return ''
  const [province, canton, district] = parts.map(Number)
  if (province < 1 || province > 7 || canton < 1 || canton > 99 || district < 1 || district > 99) return ''
  return String(province) + String(canton).padStart(2, '0') + String(district).padStart(2, '0')
}

function normalized(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Keep the Config GUID as the foreign key; resolve its ISO2 code for geographic APIs. */
export function countryIso(item: CatalogItemSelectDto, available: CrmGeoCountry[]): string {
  const known = new Set(available.map(country => country.code.toUpperCase()))
  for (const value of [item.value, item.code, item.slug]) {
    const iso = String(value ?? '').trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(iso) && known.has(iso)) return iso
  }
  const label = normalized(item.label || '')
  const names = [label, normalized(item.code || ''), normalized(item.value || '')]
  const spanish = new Intl.DisplayNames(['es'], { type: 'region' })
  const english = new Intl.DisplayNames(['en'], { type: 'region' })
  for (const country of available) {
    const translations = [country.name, spanish.of(country.code), english.of(country.code)]
      .filter((name): name is string => Boolean(name)).map(normalized)
    if (names.some(name => name && translations.includes(name))) return country.code
  }
  return ''
}
