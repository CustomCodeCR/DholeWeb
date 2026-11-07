/** Return the unique, configured POE IDs and a stable currently visible POE. */
export function normalizePoeSelection(
  values: readonly string[],
  currentActiveId: string,
  availableIds: readonly string[],
): { ids: string[]; activeId: string } {
  const allowed = new Set(availableIds)
  const ids = [...new Set(values.filter((value) => allowed.has(value) && Boolean(value)))]
  return { ids, activeId: ids.includes(currentActiveId) ? currentActiveId : (ids[0] ?? '') }
}
