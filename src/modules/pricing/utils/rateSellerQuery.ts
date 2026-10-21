/** Add repeated query parameters without changing other Pricing browse filters. */
export function appendExecutiveNameFilters(path: string, executiveNames: readonly string[]): string {
  const parts = executiveNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => `executiveNames=${encodeURIComponent(name)}`)

  return parts.length ? `${path}${path.includes('?') ? '&' : '?'}${parts.join('&')}` : path
}
