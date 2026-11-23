/**
 * Vue automatically casts native <input type="number" v-model> values to numbers,
 * even when a reactive form starts with strings. Accept both representations.
 */
export type LtlNumericValue = string | number | null | undefined

export function hasLtlNumericValue(value: LtlNumericValue): boolean {
  return String(value ?? '').trim().length > 0
}

export function ltlNumberOrNull(value: LtlNumericValue): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}
