export type HaulageMode = 'merchant' | 'carrier'

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Inland names are route specific: e.g. 'Inland Caldera a GAM (Naviera)'. */
export function haulageAssociation(name: string): HaulageMode | null {
  const value = normalize(name)
  const inland = /\b(inland|haulage|acarreo|transporte terrestre|transporte interno|gate)\b/.test(value)
  if (!inland) return null
  if (/\b(naviera|carrier)\b/.test(value)) return 'carrier'
  if (/\b(merchant|comerciante)\b/.test(value) || value === 'gate' || value.startsWith('gate ')) return 'merchant'
  return null
}

/**
 * A freshly retrieved configured inland price must not be overwritten by
 * a stale zero-priced draft line after switching POE/carrier or haulage mode.
 */
export function keepFreshInlandPrice(
  name: string,
  previousCost: number,
  previousSale: number,
  incomingCost: number,
  incomingSale: number,
): boolean {
  return haulageAssociation(name) !== null
    && previousCost === 0 && previousSale === 0
    && (incomingCost !== 0 || incomingSale !== 0)
}
