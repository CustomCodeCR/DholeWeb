// Versions returned by the health response are runtime evidence. A release
// manifest is useful as a fallback but must never be labelled as deployed.
const SEMVER = /^v?(\d+\.\d+\.\d+)(?:[-+][0-9A-Za-z.-]+)?$/

export type VersionSource = 'runtime' | 'registered' | 'unavailable'

export function normalizeServiceVersion(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return SEMVER.exec(value.trim())?.[1] ?? null
}

export function readHealthVersion(
  payload: unknown,
  headers?: { get(name: string): string | null },
): string | null {
  const data = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}
  const build = data.build && typeof data.build === 'object' ? data.build as Record<string, unknown> : {}
  const service = data.service && typeof data.service === 'object' ? data.service as Record<string, unknown> : {}
  const candidates = [
    headers?.get('X-Dhole-Version'),
    headers?.get('X-Service-Version'),
    data.version,
    data.serviceVersion,
    data.applicationVersion,
    build.version,
    service.version,
  ]
  for (const candidate of candidates) {
    const version = normalizeServiceVersion(candidate)
    if (version) return version
  }
  return null
}

export function readReleaseVersions(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  const data = payload as Record<string, unknown>
  if (!Array.isArray(data.services)) return {}
  const versions: Record<string, string> = {}
  for (const item of data.services) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    const key = typeof entry.key === 'string' ? entry.key : ''
    const version = normalizeServiceVersion(entry.version)
    if (key && version && /^[a-zA-Z0-9-]+$/.test(key)) versions[key] = version
  }
  return versions
}
