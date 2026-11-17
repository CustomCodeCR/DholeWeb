/**
 * ISO 13616 IBAN lengths by issuing country (SWIFT Registry, release 103, September 2026).
 * A valid IBAN has a fixed length for its country. Non-IBAN countries retain
 * ordinary national account numbers and must never be assigned an invented prefix.
 */
export const IBAN_LENGTH_BY_COUNTRY: Readonly<Record<string, number>> = Object.freeze({
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BY: 28, BE: 16, BA: 20,
  BR: 29, VG: 24, BG: 22, BI: 27, CR: 22, HR: 21, CY: 28, CZ: 24,
  DK: 18, DJ: 27, DO: 28, EG: 29, SV: 28, EE: 20, FK: 18, FO: 18,
  FI: 18, FR: 27, GE: 22, DE: 22, GI: 23, GR: 27, GL: 18, GT: 28,
  VA: 22, HN: 28, HU: 28, IS: 26, IQ: 23, IE: 22, IL: 23, IT: 27,
  JO: 30, KZ: 20, XK: 20, KW: 30, LV: 21, LB: 28, LY: 25, LI: 21,
  LT: 20, LU: 20, MT: 31, MR: 27, MU: 30, MD: 24, MC: 27, MN: 20,
  ME: 22, NL: 18, NI: 28, MK: 19, NO: 15, OM: 23, PK: 24, PS: 29,
  PL: 28, PT: 25, QA: 29, RO: 24, RU: 33, LC: 32, SM: 27, ST: 25,
  SA: 24, RS: 22, SC: 31, SK: 24, SI: 19, SO: 23, ES: 24, SD: 18,
  SE: 24, CH: 21, TL: 23, TN: 24, TR: 26, UA: 29, AE: 23, GB: 22,
  YE: 30,
})
export type SrmIbanFormat = { code: string; length: number }
export type SrmCountry = {
  code?: string | null
  value?: string | null
  slug?: string | null
  label?: string | null
}

const normalizeName = (text: string) => text.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const codeByName = new Map<string, string>()
const spanish = new Intl.DisplayNames(['es'], { type: 'region' })
const english = new Intl.DisplayNames(['en'], { type: 'region' })
for (const code of Object.keys(IBAN_LENGTH_BY_COUNTRY)) {
  codeByName.set(code, code)
  for (const name of [spanish.of(code), english.of(code)]) {
    if (name) codeByName.set(normalizeName(name), code)
  }
}
for (const [name, code] of Object.entries({
  CRI: 'CR', COSTARICA: 'CR', GTM: 'GT', GUATEMALA: 'GT',
  SLV: 'SV', ELSALVADOR: 'SV', HND: 'HN', HONDURAS: 'HN',
  NIC: 'NI', NICARAGUA: 'NI', DOM: 'DO', REPUBLICADOMINICANA: 'DO',
  BRA: 'BR', BRASIL: 'BR', ESP: 'ES', DEU: 'DE', ALEMANIA: 'DE',
  GBR: 'GB', REINOUNIDO: 'GB', NLD: 'NL', PAISESBAJOS: 'NL',
  TURQUIA: 'TR', TURKIYE: 'TR',
})) codeByName.set(name, code)

/** Catalog countries use UUID ids; resolve only their ISO codes or names. */
export function srmCountryIbanFormat(country: SrmCountry | null | undefined): SrmIbanFormat | null {
  if (!country) return null
  for (const field of [country.code, country.value, country.slug, country.label]) {
    const resolved = codeByName.get(normalizeName(String(field ?? '')))
    if (resolved) return { code: resolved, length: IBAN_LENGTH_BY_COUNTRY[resolved]! }
  }
  return null
}

/** Users may paste an IBAN with printable spaces or hyphens. */
export const normalizeSrmIban = (value: string) => value.toUpperCase().replace(/[\s-]/g, '')

/** Keep the country prefix on edits and never accept more than the ISO length. */
export function srmIbanInput(value: string, format: SrmIbanFormat | null): string {
  const cleaned = normalizeSrmIban(value).replace(/[^A-Z0-9]/g, '')
  if (!format) return cleaned.slice(0, 44)
  if (!cleaned || cleaned.length <= 2) return format.code
  if (cleaned.startsWith(format.code)) return cleaned.slice(0, format.length)
  // Do not silently convert a pasted IBAN belonging to another country:
  // validation must reject it so the user can select the correct bank country.
  if (/^[A-Z]{2}\d{2}/.test(cleaned)) return cleaned.slice(0, format.length)
  return (format.code + cleaned.replace(/^[A-Z]{1,2}/, '')).slice(0, format.length)
}

/** ISO 7064 MOD-97-10 check digits, processed incrementally (no overflow). */
export function srmIbanChecksumValid(value: string): boolean {
  const iban = normalizeSrmIban(value)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban) || iban.length > 34) return false
  let remainder = 0
  for (const char of iban.slice(4) + iban.slice(0, 4)) {
    const digit = char.charCodeAt(0)
    const expanded = digit >= 65 && digit <= 90 ? String(digit - 55) : char
    for (const number of expanded) remainder = (remainder * 10 + Number(number)) % 97
  }
  return remainder === 1
}

export function srmIbanValidForCountry(value: string, format: SrmIbanFormat): boolean {
  const normalized = normalizeSrmIban(value)
  return normalized.startsWith(format.code) &&
    normalized.length === format.length && srmIbanChecksumValid(normalized)
}
