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
