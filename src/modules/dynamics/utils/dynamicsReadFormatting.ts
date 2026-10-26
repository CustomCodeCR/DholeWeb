/**
 * Prefer Dataverse's localized OData annotation, falling back to the approved
 * Choice metadata already loaded by the Query Builder. Never discard raw IDs.
 */
export const dynamicsFormattedSuffix = '@OData.Community.Display.V1.FormattedValue'

type Choice = { value: number; labels: Record<string, string> }

export function formatDynamicsReadCell(
  record: Record<string, unknown>,
  field: string,
  choices: Choice[] = [],
): { text: string; raw: string | null } {
  const value = record[field]
  if (value === undefined || value === null) return { text: '—', raw: null }
  const plain = typeof value === 'object' ? JSON.stringify(value) : String(value)
  const annotated = record[field + dynamicsFormattedSuffix]
  if (typeof annotated === 'string' && annotated.trim()) {
    return { text: annotated, raw: annotated === plain ? null : plain }
  }

  // Metadata fallback if Dataverse does not return an annotation.
  const numeric = typeof value === 'number' && Number.isInteger(value)
    ? [value]
    : typeof value === 'string' && /^\d+(?:,\s*\d+)+$/.test(value)
      ? value.split(',').map(part => Number(part.trim()))
      : []
  if (numeric.length > 0 && numeric.length <= 50 && choices.length > 0) {
    const labels = numeric.map(code => {
      const choice = choices.find(option => option.value === code)
      return choice?.labels['3082'] || choice?.labels['1033'] ||
        Object.values(choice?.labels ?? {}).find(label => label.trim()) || ''
    })
    if (labels.every(label => label.trim())) return { text: labels.join('; '), raw: plain }
  }
  return { text: plain, raw: null }
}
