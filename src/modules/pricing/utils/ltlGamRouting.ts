/**
 * Geographic LTL routing is distinct from sea ports. The San José consolidation
 * can serve GAM pickup origins, but a pickup from Alajuela, Heredia or Coyol
 * needs its own separately priced Recolecta line.
 */
export const GAM_LTL_ORIGINS = [
  { key: 'san-jose', name: 'San José, Costa Rica', pickup: false },
  { key: 'alajuela', name: 'Alajuela, Costa Rica', pickup: true },
  { key: 'heredia', name: 'Heredia, Costa Rica', pickup: true },
  { key: 'coyol', name: 'Coyol, Alajuela, Costa Rica', pickup: true },
] as const

export function normalizeLandLocation(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function gamLtlOrigin(value: unknown): typeof GAM_LTL_ORIGINS[number] | null {
  const normalized = normalizeLandLocation(value)
  if (normalized.includes('coyol')) return GAM_LTL_ORIGINS[3]
  if (normalized.includes('heredia')) return GAM_LTL_ORIGINS[2]
  if (normalized.includes('alajuela')) return GAM_LTL_ORIGINS[1]
  if (normalized.includes('san jose')) return GAM_LTL_ORIGINS[0]
  return null
}

export function isLtlGamPickupLocation(value: unknown): boolean {
  return gamLtlOrigin(value)?.pickup === true
}

/** CFZ and its common Spanish/English names refer to the same LTL origin. */
export function isLtlCfzLocation(value: unknown): boolean {
  const location = normalizeLandLocation(value)
  return /\bcfz\b|\bcolon free zone\b|\b(?:zona libre|zona franca)(?: de)? colon\b|\bcolon zona (?:libre|franca)\b/.test(location)
    || location === 'colon panama'
}

function locationCountry(value: string): string {
  const s = normalizeLandLocation(value)
  if (isLtlCfzLocation(s) || /panama/.test(s)) return 'PA'
  if (/costa rica|san jose|alajuela|heredia|coyol/.test(s)) return 'CR'
  if (/nicaragua|managua/.test(s)) return 'NI'
  if (/honduras|san pedro sula|tegucigalpa/.test(s)) return 'HN'
  if (/guatemala/.test(s)) return 'GT'
  if (/salvador/.test(s)) return 'SV'
  if (/mexico/.test(s)) return 'MX'
  return ''
}

export function matchesLandLtlEndpoint(
  configured: { id?: string | null; ids?: string[] | null; name?: string | null; code?: string | null },
  requested: { id?: string | null; name?: string | null; code?: string | null },
  role: 'origin' | 'destination',
): boolean {
  if (requested.id && [configured.id, ...(configured.ids ?? [])].some(id => id && id === requested.id)) return true
  const rowValues = [configured.name, configured.code].map(normalizeLandLocation).filter(Boolean)
  const requestedValues = [requested.name, requested.code].map(normalizeLandLocation).filter(Boolean)
  if (!rowValues.length || !requestedValues.length) return false

  const canonical = (s: string) => isLtlCfzLocation(s) ? 'cfz panama' : s
  for (const rowValue of rowValues) {
    for (const reqValue of requestedValues) {
      // CFZ represents a specific free-zone origin, not all of Panamá.
      if (role === 'origin' && isLtlCfzLocation(rowValue) !== isLtlCfzLocation(reqValue)) continue
      const row = canonical(rowValue)
      const request = canonical(reqValue)
      if (row === request || (row.length >= 5 && request.includes(row)) || (request.length >= 5 && row.includes(request))) return true

      if (role === 'origin') {
        // A pre-existing San José master serves nearby GAM pickup locations.
        // Never silently use an Alajuela/Coyol tariff for a San José request.
        if (gamLtlOrigin(row)?.key === 'san-jose' && isLtlGamPickupLocation(request)) return true
      } else {
        // Legacy LTL masters may use only "Nicaragua"/"Managua" as destination.
        // Only broaden by country if at least one endpoint is explicitly generic.
        const country = locationCountry(row)
        if (country && country === locationCountry(request)) {
          const generic = (text: string) => /^(nicaragua|costa rica|panama|honduras|guatemala|el salvador|mexico)$/.test(text)
          if (generic(row) || generic(request)) return true
        }
      }
    }
  }
  return false
}
