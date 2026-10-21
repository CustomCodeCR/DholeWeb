/** Add repeated query parameters without changing other Pricing browse filters. */
export function appendExecutiveNameFilters(path: string, executiveNames: readonly string[]): string {
  const parts = executiveNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => `executiveNames=${encodeURIComponent(name)}`)

  return parts.length ? `${path}${path.includes('?') ? '&' : '?'}${parts.join('&')}` : path
}

/** Keep multi-choice filters as repeated URL parameters, never comma-join them. */
export function appendRateMultiFilters(
  path: string,
  filters: Record<string, readonly string[] | undefined>,
): string {
  let result = path
  for (const [key, values] of Object.entries(filters)) {
    if (!values?.length) continue
    const encodedKey = encodeURIComponent(key)
    const encodedValues = values
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => `${encodedKey}=${encodeURIComponent(value)}`)
    if (encodedValues.length) {
      result += `${result.includes('?') ? '&' : '?'}${encodedValues.join('&')}`
    }
  }
  return result
}
