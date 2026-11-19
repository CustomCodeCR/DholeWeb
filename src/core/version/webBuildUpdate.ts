/** Version manifest emitted by the Vite build and served at /version.json. */
export interface WebBuildVersion {
  version: string
  commit?: string | null
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function normalizeWebBuild(value: unknown): WebBuildVersion | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.version !== 'string' || !SEMVER.test(item.version)) return null
  const commit = typeof item.commit === 'string' ? item.commit.trim() : ''
  return { version: item.version, commit: commit || null }
}

export function webBuildKey(build: WebBuildVersion): string {
  return `${build.version}:${build.commit || ''}`
}

export function requiresWebUpdate(current: WebBuildVersion, remote: unknown): boolean {
  const next = normalizeWebBuild(remote)
  if (!next) return false
  if (next.version !== current.version) return true
  // A rebuild can replace hashed chunks while SemVer stays the same.
  return Boolean(current.commit && next.commit && current.commit !== next.commit)
}
