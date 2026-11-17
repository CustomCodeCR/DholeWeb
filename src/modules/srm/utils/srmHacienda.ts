import type { SrmHaciendaResult } from '../services/srmApi'

export const normalizeSrmTaxId = (value: string): string => value.replace(/[\s-]/g, '')

export function isSrmCostaRicaCountry(value: unknown): boolean {
  return ['cr', 'cri', 'crc', 'costa rica', 'costa-rica']
    .includes(String(value ?? '').trim().toLowerCase())
}

export function isSrmHaciendaMatch(
  result: SrmHaciendaResult,
  currentTaxId: string,
  requestedTaxId: string,
): boolean {
  const identification = normalizeSrmTaxId(result.identification)
  return !!result.name.trim() && identification === normalizeSrmTaxId(currentTaxId) &&
    identification === normalizeSrmTaxId(requestedTaxId)
}

export function srmHaciendaMainActivity(result: SrmHaciendaResult) {
  // Hacienda can omit the activity list, so never invent a code.
  return result.activities.find(activity =>
    String(activity.type || '').toLowerCase().includes('principal')) || result.activities[0] || null
}

export function srmHaciendaFields(result: SrmHaciendaResult) {
  return {
    name: result.name.trim().toLocaleUpperCase('es-CR'),
    economicActivityCode: (srmHaciendaMainActivity(result)?.code || '').trim().toUpperCase(),
    identificationType: (result.identificationType || '').trim().toUpperCase(),
    regime: (result.regime || '').trim().toLocaleUpperCase('es-CR'),
  }
}

/**
 * Only retry a transport failure, once, for this idempotent read.
 * Never repeat 400/401/403/404/429 or an upstream 5xx response: those
 * may represent a real rejection or Hacienda rate limiting.
 */
export async function retrySrmHaciendaNetwork<T>(
  request: () => Promise<T>,
  pause: (milliseconds: number) => Promise<void> =
    milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
): Promise<T> {
  try {
    return await request()
  } catch (cause) {
    if (!(cause instanceof Error) || cause.name !== 'NetworkError') throw cause
    await pause(650)
    return request()
  }
}

/** No API URL or tax identification may be displayed as part of an error. */
export function srmHaciendaErrorMessage(cause: unknown, en = false): string {
  const status = cause && typeof cause === 'object' && 'status' in cause
    ? (cause as { status?: unknown }).status : undefined
  const name = cause instanceof Error ? cause.name : ''
  if (name === 'NetworkError') return en
    ? 'Unable to reach the Dhole API. Check the connection and try again.'
    : 'No fue posible conectar con la API de Dhole. Revisá la conexión y volvé a consultar.'
  switch (status) {
    case 400:
      return en ? 'Check the tax ID and the selected country.'
        : 'Revisá la identificación y el país seleccionado.'
    case 401:
      return en ? 'Your session expired. Sign in again.'
        : 'La sesión venció. Iniciá sesión nuevamente.'
    case 403:
      return en ? 'Your account does not have permission to verify Hacienda.'
        : 'Tu usuario no tiene permiso para consultar Hacienda.'
    case 404:
      return en ? 'The tax ID was not found in Hacienda.'
        : 'La identificación no figura en la consulta de Hacienda.'
    case 429:
      return en ? 'Hacienda is limiting requests. Try again later.'
        : 'Hacienda está limitando las consultas. Intentá nuevamente más tarde.'
    case 502:
    case 503:
    case 504:
      return en ? 'The Hacienda verification service is temporarily unavailable. Try again later.'
        : 'La verificación de Hacienda no está disponible temporalmente. Intentá más tarde.'
    default:
      return en ? 'Hacienda could not be verified. You can enter the details manually.'
        : 'No fue posible verificar los datos con Hacienda. Podés completarlos manualmente.'
  }
}
