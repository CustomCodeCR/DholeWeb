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
