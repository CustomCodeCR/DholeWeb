// Strict MAJOR.MINOR.PATCH for formal Dhole Web releases (SemVer 2.0.0 core).
export const SEMVER_PATTERN = /^(0|[1-9]\d*)\\.(0|[1-9]\d*)\\.(0|[1-9]\d*)$/

export function parseVersion(version) {
  if (typeof version !== 'string') throw new Error('Version must be a string.')
  const match = SEMVER_PATTERN.exec(version)
  if (!match) throw new Error(`Invalid version "${version}". Expected MAJOR.MINOR.PATCH.`)
  const parts = match.slice(1).map(Number)
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    throw new Error('Version components must be safe integers.')
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] }
}

export function bumpVersion(current, level) {
  const { major, minor, patch } = parseVersion(current)
  if (level === 'major') return `${major + 1}.0.0`
  if (level === 'minor') return `${major}.${minor + 1}.0`
  if (level === 'patch') return `${major}.${minor}.${patch + 1}`
  throw new Error('Bump type must be major, minor or patch.')
}
