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
  fallbackCurrency?: SellerRateCurrency | null,
): string | null {
  // Saved details may contain a generated currency Code without an ID.
  // Resolve that Code through the catalog to obtain the business Value.
  const catalogItem = catalog.find((candidate) => candidate.id === currency.currencyId)
    ?? catalog.find((candidate) =>
      Boolean(currency.currencyCode && candidate.code)
      && candidate.code?.trim().toUpperCase() === currency.currencyCode?.trim().toUpperCase(),
    )
  const resolved = isoCurrency(catalogItem?.value)
    ?? isoCurrency(currency.currencyName)
    ?? isoCurrency(catalogItem?.label)
    ?? isoCurrency(currency.currencyCode)

  // Older rate details sometimes lack usable currency fields even though
  // their parent rate has the currency used for the commercial total.
  // A recognized line currency always wins over this fallback.
  return resolved ?? (fallbackCurrency ? sellerRateCurrencyValue(fallbackCurrency, catalog) : null)
}
