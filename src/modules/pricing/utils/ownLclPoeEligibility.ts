/** La matriz del LCL propio utiliza Balboa como puerto de entrada (POE). */
export function isBalboaOwnLclPoe(code: string | null | undefined, name: string | null | undefined): boolean {
  const normalizedCode = String(code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (normalizedCode === 'PABLB' || normalizedCode === 'BLB') return true

  const normalizedName = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  // Aceptar "Balboa, Panamá", "Puerto de Balboa" y "Port of Balboa".
  // No aceptar otros puertos aunque mencionen Balboa como punto de transbordo.
  return /^(?:(?:puerto(?:\s+de)?|port(?:\s+of)?)\s+)?balboa(?:\b|$)/.test(normalizedName)
}

function normalizedPortName(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function normalizedPortCode(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** La matriz propia Miami opera hacia Moín; no utiliza la regla Balboa de China. */
export function isMiamiOwnLclPol(code: string | null | undefined, name: string | null | undefined): boolean {
  if (['USMIA', 'MIA', 'MIAMI'].includes(normalizedPortCode(code))) return true
  return /^(?:(?:puerto(?:\s+de)?|port(?:\s+of)?)\s+)?miami(?:\b|$)/.test(normalizedPortName(name))
}

/** Acepta el mismo puerto catalogado como Limón/Moín o Puerto Moín. */
export function isMoinOwnLclPoe(code: string | null | undefined, name: string | null | undefined): boolean {
  if (['MOIN', 'PUERTOMOIN', 'LIMONMOIN'].includes(normalizedPortCode(code))) return true
  return /(?:^|[^a-z])moin(?:$|[^a-z])/.test(normalizedPortName(name))
}

/** Mantiene Balboa para China y exige Moín para la matriz Miami. */
export function isOwnLclPoeEligible(
  polCode: string | null | undefined,
  polName: string | null | undefined,
  poeCode: string | null | undefined,
  poeName: string | null | undefined,
): boolean {
  return isMiamiOwnLclPol(polCode, polName)
    ? isMoinOwnLclPoe(poeCode, poeName)
    : isBalboaOwnLclPoe(poeCode, poeName)
}
