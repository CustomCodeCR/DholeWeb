/**
 * Recover commercial terms saved by older clients as literal "\n", "\r\n",
 * real line breaks, or comma-separated lists.
 *
 * Keep the meaning of each term unchanged. This normalization only affects
 * the user-visible items and what is emitted on the next explicit save.
 */
export function splitPricingCommercialTermLines(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const separators = String(value ?? '').replace(/\\+r\\+n|\\+n|\\+r/g, '\n')
    for (const segment of separators.split(/\r\n|\r|\n|,/g)) {
      const text = segment.trim()
      const key = text.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      result.push(text)
    }
  }

  return result
}

/** Split any malformed legacy/catalog entry into individually draggable items. */
export function expandPricingCommercialCatalogItems<T extends { id: string; text: string }>(
  items: readonly T[],
): T[] {
  const seen = new Set<string>()
  const expanded: T[] = []

  for (const item of items) {
    const terms = splitPricingCommercialTermLines([item.text])
    for (const [index, text] of terms.entries()) {
      const key = text.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      expanded.push({
        ...item,
        id: index === 0 ? item.id : item.id + ':legacy-term:' + index,
        text,
      })
    }
  }
  return expanded
}
