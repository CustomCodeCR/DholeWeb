/** Retries one browser transport failure; HTTP 4xx/5xx is never retried. */
export async function retryCrmHaciendaNetwork<T>(
  request: () => Promise<T>,
  isCurrent: () => boolean = () => true,
  pause: (milliseconds: number) => Promise<void> =
    milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
): Promise<T> {
  try {
    return await request()
  } catch (cause) {
    if (!(cause instanceof Error) || cause.name !== 'NetworkError' || !isCurrent())
      throw cause
    await pause(650)
    if (!isCurrent()) throw cause
    return request()
  }
}

/** Do not apply a response with missing fields or a different tax ID. */
export function isMatchingCrmHaciendaResult(
  value: unknown, requestedIdentification: string,
): boolean {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.identification === 'string' &&
    item.identification.replace(/[\s-]/g, '') === requestedIdentification &&
    typeof item.name === 'string' && item.name.trim().length > 0 &&
    Array.isArray(item.activities)
}

/** Tax IDs, bearer credentials and endpoint URLs must never appear in UI errors. */
export function crmHaciendaErrorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.name === 'NetworkError')
    return 'No fue posible conectar con la API de Dhole. Revisá la conexión y volvé a consultar'
  const status = cause && typeof cause === 'object'
    ? (cause as { status?: number; statusCode?: number }).status ??
      (cause as { statusCode?: number }).statusCode : undefined
  switch (status) {
    case 400: return 'Revisá la identificación y el país seleccionado'
    case 401: return 'La sesión venció. Iniciá sesión nuevamente'
    case 403: return 'Tu usuario no tiene permiso para consultar Hacienda'
    case 404: return 'La identificación no figura en la consulta de Hacienda'
    case 429: return 'Hacienda está limitando las consultas. Intentá nuevamente más tarde'
    case 502:
    case 503:
    case 504: return 'La verificación de Hacienda no está disponible temporalmente. Intentá más tarde'
    default: return 'No fue posible verificar los datos con Hacienda'
  }
}
