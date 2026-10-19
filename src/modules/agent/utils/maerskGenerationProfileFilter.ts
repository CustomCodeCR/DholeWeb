/**
 * Provider sessions are owned by a single immutable production generation.
 * A historical (including "maersk-original-") key must not appear as the
 * active generation's session, even if a legacy API returns it.
 */
export function belongsToMaerskGeneration(profileKey: string, generation: string | null): boolean {
  if (!generation || !/^prod(?:[1-9][0-9]*)?$/.test(generation)) return false
  return profileKey.toLowerCase().startsWith(`maersk-${generation}-`)
}

export function isGenerationProfileName(name: string, generation: string | null): boolean {
  if (!generation || !/^prod(?:[1-9][0-9]*)?$/.test(generation)) return false
  return name.toLowerCase().startsWith(`maersk ${generation} -`)
}
