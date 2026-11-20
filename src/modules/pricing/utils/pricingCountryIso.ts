import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'

/**
 * Static ISO 3166-1 snapshot (alpha-2 and alpha-3). Keep this independent of
 * browser locale, Config availability, and the currently selected ports.
 * Source: ISO 3166-1 (249 countries/territories); never infer from city names.
 */
const ISO_PAIRS = `
AD:AND AE:ARE AF:AFG AG:ATG AI:AIA AL:ALB AM:ARM AO:AGO AQ:ATA AR:ARG AS:ASM AT:AUT AU:AUS AW:ABW AX:ALA AZ:AZE
BA:BIH BB:BRB BD:BGD BE:BEL BF:BFA BG:BGR BH:BHR BI:BDI BJ:BEN BL:BLM BM:BMU BN:BRN BO:BOL BQ:BES BR:BRA BS:BHS BT:BTN BV:BVT BW:BWA BY:BLR BZ:BLZ
CA:CAN CC:CCK CD:COD CF:CAF CG:COG CH:CHE CI:CIV CK:COK CL:CHL CM:CMR CN:CHN CO:COL CR:CRI CU:CUB CV:CPV CW:CUW CX:CXR CY:CYP CZ:CZE
DE:DEU DJ:DJI DK:DNK DM:DMA DO:DOM DZ:DZA
EC:ECU EE:EST EG:EGY EH:ESH ER:ERI ES:ESP ET:ETH
FI:FIN FJ:FJI FK:FLK FM:FSM FO:FRO FR:FRA
GA:GAB GB:GBR GD:GRD GE:GEO GF:GUF GG:GGY GH:GHA GI:GIB GL:GRL GM:GMB GN:GIN GP:GLP GQ:GNQ GR:GRC GS:SGS GT:GTM GU:GUM GW:GNB GY:GUY
HK:HKG HM:HMD HN:HND HR:HRV HT:HTI HU:HUN
ID:IDN IE:IRL IL:ISR IM:IMN IN:IND IO:IOT IQ:IRQ IR:IRN IS:ISL IT:ITA
JE:JEY JM:JAM JO:JOR JP:JPN
KE:KEN KG:KGZ KH:KHM KI:KIR KM:COM KN:KNA KP:PRK KR:KOR KW:KWT KY:CYM KZ:KAZ
LA:LAO LB:LBN LC:LCA LI:LIE LK:LKA LR:LBR LS:LSO LT:LTU LU:LUX LV:LVA LY:LBY
MA:MAR MC:MCO MD:MDA ME:MNE MF:MAF MG:MDG MH:MHL MK:MKD ML:MLI MM:MMR MN:MNG MO:MAC MP:MNP MQ:MTQ MR:MRT MS:MSR MT:MLT MU:MUS MV:MDV MW:MWI MX:MEX MY:MYS MZ:MOZ
NA:NAM NC:NCL NE:NER NF:NFK NG:NGA NI:NIC NL:NLD NO:NOR NP:NPL NR:NRU NU:NIU NZ:NZL
OM:OMN
PA:PAN PE:PER PF:PYF PG:PNG PH:PHL PK:PAK PL:POL PM:SPM PN:PCN PR:PRI PS:PSE PT:PRT PW:PLW PY:PRY
QA:QAT
RE:REU RO:ROU RS:SRB RU:RUS RW:RWA
SA:SAU SB:SLB SC:SYC SD:SDN SE:SWE SG:SGP SH:SHN SI:SVN SJ:SJM SK:SVK SL:SLE SM:SMR SN:SEN SO:SOM SR:SUR SS:SSD ST:STP SV:SLV SX:SXM SY:SYR SZ:SWZ
TC:TCA TD:TCD TF:ATF TG:TGO TH:THA TJ:TJK TK:TKL TL:TLS TM:TKM TN:TUN TO:TON TR:TUR TT:TTO TV:TUV TW:TWN TZ:TZA
UA:UKR UG:UGA UM:UMI US:USA UY:URY UZ:UZB
VA:VAT VC:VCT VE:VEN VG:VGB VI:VIR VN:VNM VU:VUT
WF:WLF WS:WSM
YE:YEM YT:MYT
ZA:ZAF ZM:ZMB ZW:ZWE
`.trim().split(/\s+/)

const ALPHA2_TO_3 = new Map(ISO_PAIRS.map((entry) => entry.split(':') as [string, string]))
const ALPHA3_TO_2 = new Map<string, string>([...ALPHA2_TO_3.entries()].map(([alpha2, alpha3]) => [alpha3, alpha2] as [string, string]))
const ISO_ALPHA2 = new Set(ALPHA2_TO_3.keys())

export function supportedIsoCountryCodes(): string[] { return [...ISO_ALPHA2] }

export function normalizeCountryText(value: string): string {
  return String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Only authoritative ISO codes are accepted; XX/ZZ and opaque IDs are rejected. */
export function normalizeIsoCountryCode(value: unknown): string {
  const code = String(value ?? '').trim().toUpperCase()
  if (ISO_ALPHA2.has(code)) return code
  return ALPHA3_TO_2.get(code) ?? ''
}

export function catalogMetadata(item?: CatalogItemSelectDto | null): Record<string, unknown> {
  if (!item?.metadataJson) return {}
  try {
    const data: unknown = JSON.parse(item.metadataJson)
    return data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown> : {}
  } catch { return {} }
}

// Region labels from Intl are valid for every ISO country in Spanish, English,
// Portuguese and French, without a manually maintained per-country switch.
const namesByCode = new Map<string, Set<string>>()
function addCountryName(name: unknown, iso2: string, target = namesByCode) {
  const normalized = normalizeCountryText(String(name ?? ''))
  if (normalized.length < 2) return
  const codes = target.get(normalized) ?? new Set<string>()
  codes.add(iso2)
  target.set(normalized, codes)
}
for (const locale of ['es', 'en', 'pt', 'fr']) {
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' })
  for (const code of ISO_ALPHA2) {
    const name = displayNames.of(code)
    if (name && normalizeCountryText(name) !== code.toLowerCase()) addCountryName(name, code)
  }
}
// Widely used variants beyond CLDR short display names. Aliases are only
// country/territory names, not cities or port names.
const countryAliases: Record<string, string[]> = {
  US: ['United States of America', 'Estados Unidos de América', 'USA', 'EEUU', 'EE UU', 'U.S.A.'],
  GB: ['Great Britain', 'Britain', 'UK', 'Reino Unido de Gran Bretaña'],
  VN: ['Viet Nam', 'Socialist Republic of Vietnam'],
  KR: ['South Korea', 'Republic of Korea', 'Korea, Republic of', 'Corea del Sur', 'Corea del Sur (República de Corea)'],
  KP: ['North Korea', 'Democratic People\'s Republic of Korea', 'Corea del Norte'],
  CN: ['Mainland China', 'China Mainland', 'People\'s Republic of China', 'República Popular China'],
  TW: ['Taiwan, Province of China'],
  HK: ['Hong Kong', 'Hong Kong SAR', 'Hong Kong SAR China'],
  MO: ['Macau', 'Macao SAR', 'Macao SAR China'],
  CI: ['Ivory Coast', 'Costa de Marfil', 'Côte d\'Ivoire'],
  CZ: ['Czech Republic', 'República Checa'],
  TR: ['Turkey', 'Türkiye', 'Turquía'],
  RU: ['Russian Federation', 'Federación Rusa'],
  BO: ['Bolivia (Plurinational State of)', 'Estado Plurinacional de Bolivia'],
  VE: ['Venezuela (Bolivarian Republic of)', 'República Bolivariana de Venezuela'],
  SY: ['Syrian Arab Republic'],
  LA: ['Lao PDR', 'Lao People\'s Democratic Republic'],
  MD: ['Republic of Moldova', 'Moldavia'],
  TZ: ['United Republic of Tanzania'],
  PS: ['Palestine', 'State of Palestine', 'Palestina'],
  VA: ['Vatican City', 'Ciudad del Vaticano'],
  AE: ['UAE', 'Emiratos Árabes Unidos'],
  CD: ['DR Congo', 'Democratic Republic of the Congo', 'República Democrática del Congo', 'Congo-Kinshasa'],
  CG: ['Republic of the Congo', 'República del Congo', 'Congo-Brazzaville'],
  SV: ['Republic of El Salvador', 'República de El Salvador'],
}
for (const [code, aliases] of Object.entries(countryAliases)) {
  for (const alias of aliases) addCountryName(alias, code)
}
// A bare "Congo" is not enough to distinguish CG from CD.
addCountryName('Congo', 'CD')
addCountryName('Congo', 'CG')

export function resolveExplicitCountryText(value: unknown, countries: CatalogItemSelectDto[] = []): string {
  const original = String(value ?? '').trim()
  if (!original) return ''
  const literalCode = normalizeIsoCountryCode(original)
  if (literalCode) return literalCode

  const names = new Map<string, Set<string>>([...namesByCode.entries()].map(([name, codes]) => [name, new Set(codes)] as [string, Set<string>]))
  for (const country of countries) {
    const code = resolveCatalogCountryCode(country)
    if (!code) continue
    for (const candidate of [country.value, country.label, country.slug]) {
      addCountryName(candidate, code, names)
    }
  }

  const parts = original.split(/[,;|]/).map(normalizeCountryText).filter(Boolean)
  // Explicit country component (normally last in "City, Country") is preferred.
  for (let i = parts.length - 1; i >= 0; i--) {
    const matches = names.get(parts[i]!)
    if (matches) return matches.size === 1 ? [...matches][0]! : ''
  }

  // A city name alone is not sufficient evidence of country. A country
  // phrase without a comma must be explicit (e.g. "Costa Rica") or appear
  // after a descriptive terminal qualifier ("Puerto Guatemala").
  const normalizedFullText = normalizeCountryText(original)
  const hasTerminalQualifier = /^(?:puerto|terminal|aeropuerto|zona franca|free zone)\s/.test(normalizedFullText)
  const text = ` ${normalizedFullText} `
  let longest = 0
  const matches = new Set<string>()
  for (const [name, codes] of names.entries()) {
    if (name.length < 4 || !text.includes(` ${name} `)) continue
    if (!original.includes(',') && !original.includes(';') && !original.includes('|')
      && !hasTerminalQualifier && !normalizedFullText.endsWith(` ${name}`)) continue
    // A one-word region alias (e.g. 'Salvador') inside a city ('San Salvador')
    // is not proof of country. Only compound names may use the trailing rule.
    if (!hasTerminalQualifier && !original.includes(',') && !original.includes(';')
      && !original.includes('|') && name.split(' ').length < 2) continue
    if (name.length > longest) { longest = name.length; matches.clear() }
    if (name.length === longest) for (const code of codes) matches.add(code)
  }
  return matches.size === 1 ? [...matches][0]! : ''
}

export function resolveCatalogCountryCode(country?: CatalogItemSelectDto | null): string {
  if (!country) return ''
  const meta = catalogMetadata(country)
  for (const value of [
    country.code, meta.countryCode, meta.iso2, meta.iso3, meta.countryIso2,
    meta.countryIso3, meta.alpha2, meta.alpha3, meta.isoCode, country.id,
  ]) {
    const code = normalizeIsoCountryCode(value)
    if (code) return code
  }
  // For a country catalog record only, names are also authoritative.
  for (const value of [country.value, country.label]) {
    const code = exactCountryName(value)
    if (code) return code
  }
  return ''
}

function exactCountryName(value: unknown): string {
  const normalized = normalizeCountryText(String(value ?? ''))
  const matches = namesByCode.get(normalized)
  return matches?.size === 1 ? [...matches][0]! : ''
}

/**
 * Resolve the physical country for any POL, POE or POD.
 * Order: Config countryId -> explicit ISO metadata -> explicit country name ->
 * ISO UN/LOCODE prefix -> unknown. An opaque ID or city alone is not a country.
 */
export function resolveLocationCountryCode(
  location: CatalogItemSelectDto | null | undefined,
  countries: CatalogItemSelectDto[],
): string {
  if (!location) return ''
  const meta = catalogMetadata(location)

  const countryId = String(meta.countryId ?? '').trim()
  if (countryId) {
    const linked = countries.find((c) => c.id.toLowerCase() === countryId.toLowerCase())
    const authoritative = resolveCatalogCountryCode(linked)
      || normalizeIsoCountryCode(countryId)
    if (authoritative) return authoritative
  }

  for (const value of [
    meta.countryCode, meta.countryIso2, meta.countryIso3, meta.iso2, meta.iso3,
    meta.alpha2, meta.alpha3, meta.isoCode,
  ]) {
    const code = normalizeIsoCountryCode(value)
    if (code) return code
  }

  for (const value of [meta.country, meta.countryName]) {
    const named = resolveExplicitCountryText(value, countries)
    if (named) return named
  }

  const explicitLabelCountries = [location.value, location.label, location.slug]
    .map((value) => resolveExplicitCountryText(value, countries))
    .filter(Boolean)
  const uniqueLabelCountries = new Set(explicitLabelCountries)
  const labelCode = uniqueLabelCountries.size === 1 ? [...uniqueLabelCountries][0]! : ''

  // Prefer explicit country labels over an unverified five-character code.
  // Legacy IDs like DEST2 or SDSAL are not reliable evidence of a UN/LOCODE.
  // With no registry/provenance available, only alphabetic prefixes are a safe
  // conservative fallback; numeric LOCODEs require Config country metadata.
  const portCode = String(location.code ?? '').trim().toUpperCase()
  const unlocode = /^[A-Z]{5}$/.test(portCode)
    ? normalizeIsoCountryCode(portCode.slice(0, 2)) : ''
  if (uniqueLabelCountries.size > 1) return '' // conflicting explicit labels
  return labelCode || unlocode
}
