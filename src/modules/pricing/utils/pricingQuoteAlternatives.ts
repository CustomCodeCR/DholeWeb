/**
 * Immutable client draft identifiers for the multi-POE quotation wizard.
 * Commercial acceptance and database consistency are enforced by Pricing API,
 * never by this module alone.
 */
export type QuoteHaulageMode = 'Merchant' | 'Carrier'
export type QuoteAlternativeStatus = 'Draft' | 'Ready' | 'Accepted' | 'NotSelected'

export interface QuoteAlternativeCandidate {
  poeId: string
  carrierId: string
  haulageMode: QuoteHaulageMode
  routeKey?: string | null
}

export interface QuoteAlternativeDraft<T> extends QuoteAlternativeCandidate {
  key: string
  suffix: string
  quoteNumber: string
  snapshot: T
  status: QuoteAlternativeStatus
}

const ROOT_QUO_PATTERN = /^QUO-[0-9]{5}-[0-9]{6}$/

function required(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('La alternativa requiere ' + field)
  return normalized
}

export function quoteSuffix(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('El índice de sub-QUO debe ser entero no negativo')
  }
  let result = ''
  let remaining = index
  do {
    result = String.fromCharCode(65 + (remaining % 26)) + result
    remaining = Math.floor(remaining / 26) - 1
  } while (remaining >= 0)
  return result
}

export function quoteSuffixIndex(value: string): number {
  if (!/^[A-Z]+$/.test(value)) throw new Error('Sufijo de sub-QUO inválido')
  let index = 0
  for (const char of value) {
    index = index * 26 + (char.charCodeAt(0) - 64)
    if (!Number.isSafeInteger(index)) throw new RangeError('Sufijo fuera de rango')
  }
  return index - 1
}

export function subQuoteNumber(parentQuoteNumber: string, suffix: string): string {
  if (!ROOT_QUO_PATTERN.test(parentQuoteNumber)) {
    throw new Error('La QUO principal debe seguir QUO-00000-000000')
  }
  if (!/^[A-Z]+$/.test(suffix)) throw new Error('Sufijo inválido')
  return parentQuoteNumber + '-' + suffix
}

/** JSON tuple prevents key collisions if catalogue values contain delimiters. */
export function quoteAlternativeKey(candidate: QuoteAlternativeCandidate): string {
  return JSON.stringify([
    required(candidate.poeId, 'POE'),
    required(candidate.carrierId, 'naviera'),
    candidate.haulageMode === 'Merchant' || candidate.haulageMode === 'Carrier'
      ? candidate.haulageMode
      : required('', 'modalidad Merchant/Carrier'),
    (candidate.routeKey || '').trim(),
  ])
}

/**
 * Adds new options without renumbering, rewriting, or sharing existing drafts.
 * A group begins only after selecting at least two distinct alternatives.
 */
export function appendQuoteAlternatives<T>(
  parentQuoteNumber: string,
  candidates: readonly QuoteAlternativeCandidate[],
  existing: readonly QuoteAlternativeDraft<T>[],
  createSnapshot: (candidate: QuoteAlternativeCandidate) => T,
): QuoteAlternativeDraft<T>[] {
  if (!ROOT_QUO_PATTERN.test(parentQuoteNumber)) throw new Error('QUO principal inválida')
  const result = [...existing]
  const knownKeys = new Set<string>()
  let nextIndex = 0
  for (const option of existing) {
    if (knownKeys.has(option.key)) throw new Error('Alternativa duplicada en el borrador')
    if (option.quoteNumber !== subQuoteNumber(parentQuoteNumber, option.suffix)) {
      throw new Error('La sub-QUO no pertenece al grupo indicado')
    }
    knownKeys.add(option.key)
    nextIndex = Math.max(nextIndex, quoteSuffixIndex(option.suffix) + 1)
  }

  for (const candidate of candidates) {
    const key = quoteAlternativeKey(candidate)
    if (knownKeys.has(key)) continue
    const suffix = quoteSuffix(nextIndex++)
    knownKeys.add(key)
    result.push({
      poeId: candidate.poeId.trim(),
      carrierId: candidate.carrierId.trim(),
      haulageMode: candidate.haulageMode,
      routeKey: candidate.routeKey?.trim() || null,
      key,
      suffix,
      quoteNumber: subQuoteNumber(parentQuoteNumber, suffix),
      snapshot: createSnapshot(candidate),
      status: 'Draft',
    })
  }

  if (result.length < 2) {
    throw new Error('Un grupo de QUO requiere al menos dos alternativas')
  }
  return result
}

/**
 * UI projection of the acceptance transaction; the backend must enforce this
 * atomically under concurrency and must publish only the accepted sub-QUO.
 */
export function selectQuoteAlternative<T>(
  options: readonly QuoteAlternativeDraft<T>[],
  selectedKey: string,
): QuoteAlternativeDraft<T>[] {
  if (!options.some((option) => option.key === selectedKey)) {
    throw new Error('La alternativa elegida no pertenece al grupo')
  }
  if (options.some((option) => option.status === 'Accepted' && option.key !== selectedKey)) {
    throw new Error('El grupo ya tiene una sub-QUO aceptada')
  }
  return options.map((option) => ({
    ...option,
    status: option.key === selectedKey ? 'Accepted' : 'NotSelected',
  }))
}
