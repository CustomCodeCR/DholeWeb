/** Guard identifiers and parse exact AI translation output. */
export function isTranslatableContentText(input: string): boolean {
  const value = input.trim()
  if (value.length < 10 || value.length > 600 || !/\p{L}/u.test(value)) return false
  if (/https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(value)) return false
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(value)) return false
  if (/^[A-Z0-9\s._/+:#-]+$/.test(value)) return false
  return true
}

export function parseContentTranslationResponse(response: string, expected: number): string[] {
  const cleaned = response.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '')
  const value: unknown = JSON.parse(cleaned)
  const translations: unknown = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'translations' in value
      ? value.translations
      : undefined
  if (!Array.isArray(translations) || translations.length !== expected) {
    throw new Error('Unexpected number of content translations.')
  }
  if (!translations.every((text) => typeof text === 'string' && text.trim().length > 0 && text.length < 3000)) {
    throw new Error('Invalid translated content.')
  }
  return translations as string[]
}
