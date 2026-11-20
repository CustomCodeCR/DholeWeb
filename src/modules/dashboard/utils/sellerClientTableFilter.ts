export interface SellerClientRate {
  clientName?: string | null
}

// El mismo cliente puede venir con mayúsculas o acentos diferentes de Pricing.
export function sellerClientKey(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .trim()
}

export function sellerClientOptions<T extends SellerClientRate>(rates: readonly T[]): Array<{ value: string; label: string }> {
  const options = new Map<string, string>()
  for (const rate of rates) {
    const label = rate.clientName?.trim()
    const key = sellerClientKey(label)
    if (label && key && !options.has(key)) options.set(key, label)
  }
  return [...options].map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }))
}

export function filterSellerRatesByClient<T extends SellerClientRate>(rates: readonly T[], selectedClient: string): T[] {
  const key = sellerClientKey(selectedClient)
  return key ? rates.filter(rate => sellerClientKey(rate.clientName) === key) : [...rates]
}
