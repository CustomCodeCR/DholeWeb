/**
 * Global origin coverage is an explicit business rule for Grupo Castro Fallas.
 * A metadata flag keeps it future-proof when new countries are added to POL.
 */
/** ISO-3166-1 alpha-2 countries and territories shared by agents and route catalogs. */
export const ISO_COUNTRIES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN
BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI
GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA
MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG
NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU
RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH
TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE
YT ZA ZM ZW
`.trim().split(/\s+/)

type AgentIdentity = {
  code?: unknown
  slug?: unknown
  name?: unknown
  label?: unknown
  value?: unknown
  metadataJson?: unknown
}

function normalized(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function metadata(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

export function isGlobalCountryAgent(agent: AgentIdentity | null | undefined): boolean {
  if (!agent) return false
  if (metadata(agent.metadataJson).allCountries === true) return true
  // Older GCF catalog records have a finite countries list but are worldwide by policy.
  return [agent.code, agent.slug, agent.name, agent.label, agent.value]
    .some((value) => ['gcf', 'grupo castro fallas'].includes(normalized(value)))
}

export function withGlobalCountryCoverage(
  existingJson: string | null | undefined,
  knownCountries: ReadonlyArray<{ name: string; code?: string }>,
): string {
  const meta = metadata(existingJson)
  const names = new Map<string, string>()
  const add = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return
    const key = normalized(value)
    if (key) names.set(key, value.trim())
  }
  if (Array.isArray(meta.countries)) meta.countries.forEach(add)
  // A worldwide agent includes all ISO territories even if POL is incomplete.
  const localized = new Intl.DisplayNames(['es'], { type: 'region' })
  for (const code of ISO_COUNTRIES) add(localized.of(code) ?? code)
  for (const country of knownCountries) add(country.name)
  if (names.size) meta.countries = [...names.values()]

  const codes = new Set(
    (Array.isArray(meta.countryCodes) ? meta.countryCodes : [])
      .filter((value): value is string => typeof value === 'string' && /^[A-Z]{2}$/i.test(value))
      .map((value) => value.toUpperCase()),
  )
  for (const code of ISO_COUNTRIES) codes.add(code)
  for (const country of knownCountries) {
    if (country.code && /^[A-Z]{2}$/i.test(country.code)) codes.add(country.code.toUpperCase())
  }
  if (codes.size) meta.countryCodes = [...codes]
  // Preserve singular country fields for legacy readers; the wildcard is authoritative.
  if (!meta.country && names.size) meta.country = names.values().next().value
  if (!meta.countryName && names.size) meta.countryName = names.values().next().value
  meta.allCountries = true
  return JSON.stringify(meta)
}
