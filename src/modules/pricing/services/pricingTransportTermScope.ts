/**
 * Terms belonging to an international freight quote must never be silently
 * inherited by a customs-only rate. A carrier can still be selected for cost
 * filtering, but that does not make international transport a contracted service.
 */
function normalizeTerm(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

const INTERNATIONAL_TRANSPORT_TERMS: RegExp[] = [
  /\bflete (?:internacional|maritimo|aereo|terrestre|oceanico|ocean)\b/,
  /\b(?:naviera|linea naviera|linea aerea|shipping line|carrier haulage|merchant haulage)\b/,
  /\b(?:inland|carrusel|transbordo|redestino|muellaje)\b/,
  /\b(?:thc|thcd|hbl|hawb|bill of lading|doc fee|release|gate in|pase vip|bunker)\b/,
  /^manejos(?:\s*\(|\s*$)/,
  /^handling(?:\s*\(|\s*$)/,
  /\b(?:interno puerto|transporte internacional|flete interno)\b/,
  /\b(?:retiro vacio|demoras? (?:de )?(?:chasis|contenedor)|demurrage|detention)\b/,
  /\b(?:marchamo|carta de transbordo|iva (?:de )?los cargos en destino)\b/,
  /\b(?:cargos? en destino (?:de )?la linea|cargos? destino naviera)\b/,
  /\b(?:sob(?:re)?peso usd|patio usd)\b/,
]

export function isInternationalTransportTerm(text: string): boolean {
  const normalized = normalizeTerm(text)
  return INTERNATIONAL_TRANSPORT_TERMS.some((pattern) => pattern.test(normalized))
}

export function filterTransportOnlyTerms(terms: readonly string[], includesInternationalTransport: boolean): string[] {
  if (includesInternationalTransport) return [...terms]
  return terms.filter((term) => !isInternationalTransportTerm(term))
}

export function filterTransportOnlyTermSelection<T extends { includes: string[]; subjectTo: string[]; excludes: string[] }>(
  selection: T,
  includesInternationalTransport: boolean,
): T {
  if (includesInternationalTransport) return selection
  return {
    ...selection,
    includes: filterTransportOnlyTerms(selection.includes, false),
    subjectTo: filterTransportOnlyTerms(selection.subjectTo, false),
    excludes: filterTransportOnlyTerms(selection.excludes, false),
  }
}
