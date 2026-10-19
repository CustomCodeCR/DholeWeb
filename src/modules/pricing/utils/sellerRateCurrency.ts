export interface SellerRateCurrency {
  currencyId?: string | null
  currencyName?: string | null
  currencyCode?: string | null
}

export interface SellerRateCatalogCurrency {
  id: string
  value?: string | null
  label?: string | null
  code?: string | null
}

// Catalog Code can be an internal identifier such as CUR-2026-001.
// Only the business Value (or a recognizable ISO/description fallback)
// should reach Intl.NumberFormat.
function isoCurrency(value?: string | null): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null

  const upper = text.toUpperCase()
  if (/^[A-Z]{3}$/.test(upper)) return upper

  const normalized = upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (normalized.includes('DOLAR') || normalized.includes('DOLLAR')) return 'USD'
  if (normalized.includes('COLON')) return 'CRC'
  return null
}

export function sellerRateCurrencyValue(
  currency: SellerRateCurrency,
  catalog: readonly SellerRateCatalogCurrency[],
): string | null {
  const item = catalog.find((candidate) => candidate.id === currency.currencyId)
  return isoCurrency(item?.value)
    ?? isoCurrency(currency.currencyName)
    ?? isoCurrency(item?.label)
    ?? isoCurrency(currency.currencyCode)
}
