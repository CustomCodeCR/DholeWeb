/**
 * CRM account identification type options. Keep the API's existing fiscal
 * codes; only the available selections depend on the selected country.
 */
export const foreignIdentificationOptions = [
  { value: '01', label: 'Persona física' },
  { value: '02', label: 'Persona jurídica' },
]

export const costaRicaIdentificationOptions = [
  ...foreignIdentificationOptions,
  { value: '03', label: 'DIMEX' },
  { value: '04', label: 'NITE' },
]

export function isCostaRicaCountry(countryLabel: string): boolean {
  const normalized = countryLabel.trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, ' ')
  return ['costa rica', 'cr', 'cri', 'crc'].includes(normalized)
}

export function identificationOptionsForCountry(countryLabel: string) {
  return isCostaRicaCountry(countryLabel)
    ? costaRicaIdentificationOptions : foreignIdentificationOptions
}

/** Hacienda and historical CRM data may use aliases for the same code. */
export function normalizeIdentificationType(value: unknown): string {
  const code = String(value ?? '').trim()
  const aliases: Record<string, string> = {
    '1': '01', FISICA: '01', 'FÍSICA': '01', 'PERSONA FISICA': '01',
    'PERSONA FÍSICA': '01',
    '2': '02', JURIDICA: '02', 'JURÍDICA': '02', 'PERSONA JURIDICA': '02',
    'PERSONA JURÍDICA': '02',
    '3': '03', DIMEX: '03', '4': '04', NITE: '04',
  }
  return aliases[code.toUpperCase()] ?? code
}
