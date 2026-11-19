/**
 * Global origin coverage is an explicit business rule for Grupo Castro Fallas.
 * A metadata flag keeps it future-proof when new countries are added to POL.
 */
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
  for (const country of knownCountries) add(country.name)
  if (names.size) meta.countries = [...names.values()]

  const codes = new Set(
    (Array.isArray(meta.countryCodes) ? meta.countryCodes : [])
      .filter((value): value is string => typeof value === 'string' && /^[A-Z]{2}$/i.test(value))
      .map((value) => value.toUpperCase()),
  )
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
