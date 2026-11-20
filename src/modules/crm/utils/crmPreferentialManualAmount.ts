/**
 * Vue's v-model on <input type="number"> converts its value to a number even
 * when the reactive field started as a string. Never call .trim() on that value.
 */
export function parseManualPreferentialAmount(
  input: string | number | null | undefined,
): number | null {
  const text = String(input ?? '').trim()
  if (!text) return null
  const amount = Number(text)
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999999999) return null
  return amount
}
