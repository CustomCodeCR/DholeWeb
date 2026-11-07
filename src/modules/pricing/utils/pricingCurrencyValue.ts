/**
 * CatalogItem.value is the only source of the displayed currency.
 * Historic snapshots persist that same value in currencyName.
 * CurrencyCode (CUR-2026-001, etc.) is an internal catalog identifier.
 */
export function pricingCurrencyValue(catalogValue?: string | null, persistedValue?: string | null): string {
  for (const candidate of [catalogValue, persistedValue]) {
    const value = String(candidate ?? '').trim()
    if (!value || /^CUR[-_]/i.test(value)) continue
    return value
  }
  return '—'
}
