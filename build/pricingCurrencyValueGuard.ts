import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  let code = source

  // Config.Value is the user-facing currency value. Some compatibility layers may
  // still rewrite these expressions to CatalogItem.code (for example CUR-2026-001),
  // which must remain an internal identifier and never be rendered to the user.
  code = code
    .split(`selectedCurrency?.code || 'USD'`)
    .join(`displayValue(selectedCurrency) || 'USD'`)

  // Pantalla 8 / ALL IN: cada línea debe mostrar Config.Value (USD, CRC, etc.) y no
  // CatalogItem.Code (por ejemplo CUR-2026-001). Se resuelve primero por CurrencyId
  // contra el catálogo y se conservan name/code solamente como compatibilidad.
  code = code
    .split(`line.currencyCode || line.currencyName || 'USD'`)
    .join(`displayValue(findById(catalogs.currencies, line.currencyId)) || line.currencyName || line.currencyCode || 'USD'`)

  // Resolve the ISO currency used for calculations from all catalog fields instead
  // of assuming CatalogItem.code itself is USD/CRC. In Config, Code may be a generated
  // identifier while Value contains the configured business value (USD/CRC).
  code = code.replace(
    `const usdCurrency = computed(() => catalogs.currencies.find((item) => String(item.code || displayValue(item)).trim().toUpperCase() === 'USD') ?? null)`,
    `const usdCurrency = computed(() => catalogs.currencies.find((item) => canonicalCurrencyCode({ currencyId: item.id, currencyCode: item.code, currencyName: displayValue(item) }) === 'USD') ?? null)`,
  )
  code = code.replace(
    `const crcCurrency = computed(() => catalogs.currencies.find((item) => String(item.code || displayValue(item)).trim().toUpperCase() === 'CRC') ?? null)`,
    `const crcCurrency = computed(() => catalogs.currencies.find((item) => canonicalCurrencyCode({ currencyId: item.id, currencyCode: item.code, currencyName: displayValue(item) }) === 'CRC') ?? null)`,
  )
  code = code.replace(
    `.filter((item) => ['USD', 'CRC'].includes(String(item.code || displayValue(item)).trim().toUpperCase()))`,
    `.filter((item) => ['USD', 'CRC'].includes(canonicalCurrencyCode({ currencyId: item.id, currencyCode: item.code, currencyName: displayValue(item) })))`,
  )

  // Header totals must use the canonical USD/CRC meaning, not the generated catalog Code.
  const totalsAnchor = `// Compatibility aliases used by existing visual helpers. Header currency is still preserved in the persisted rate.\nconst totalCost = computed(() => String(selectedCurrency.value?.code ?? '').toUpperCase() === 'CRC' ? totalCostCrc.value : totalCostUsd.value)\nconst totalSale = computed(() => String(selectedCurrency.value?.code ?? '').toUpperCase() === 'CRC' ? totalSaleCrc.value : totalSaleUsd.value)\nconst totalUtility = computed(() => String(selectedCurrency.value?.code ?? '').toUpperCase() === 'CRC' ? totalUtilityCrc.value : totalUtilityUsd.value)`
  const totalsReplacement = `// Compatibility aliases used by existing visual helpers. Header currency is still preserved in the persisted rate.\nconst selectedCurrencyIsoCode = computed(() => {\n  const currency = selectedCurrency.value\n  if (!currency) return 'USD'\n  return canonicalCurrencyCode({ currencyId: currency.id, currencyCode: currency.code, currencyName: displayValue(currency) })\n})\nconst totalCost = computed(() => selectedCurrencyIsoCode.value === 'CRC' ? totalCostCrc.value : totalCostUsd.value)\nconst totalSale = computed(() => selectedCurrencyIsoCode.value === 'CRC' ? totalSaleCrc.value : totalSaleUsd.value)\nconst totalUtility = computed(() => selectedCurrencyIsoCode.value === 'CRC' ? totalUtilityCrc.value : totalUtilityUsd.value)`
  if (code.includes(totalsAnchor)) code = code.replace(totalsAnchor, totalsReplacement)

  // A previous master-only compatibility transform resolves the default USD item by
  // Code first. Prefer Config.Value and only use Code as a legacy fallback.
  const codeFirstUsd = `const usd = currencies.find((item) => String(item.code ?? '').trim().toUpperCase() === 'USD')\n      ?? currencies.find((item) => normalizeCatalogValue(displayValue(item)).includes('dolar'))\n      ?? currencies[0]`
  const valueFirstUsd = `const usd = currencies.find((item) => {\n      const value = normalizeCatalogValue(displayValue(item))\n      return value === 'usd' || value.includes('dolar') || value.includes('dollar')\n    })\n      ?? currencies.find((item) => String(item.code ?? '').trim().toUpperCase() === 'USD')\n      ?? currencies[0]`
  if (code.includes(codeFirstUsd)) code = code.replace(codeFirstUsd, valueFirstUsd)

  // Imported rates normally carry an ISO value such as USD. Match Config.Value first;
  // generated CatalogItem.code remains only a compatibility fallback.
  const codeFirstImport = `  const rateCurrencyCode = String(rate.currency ?? '').trim().toUpperCase()\n  const rateCurrencyValue = normalizeCatalogValue(String(rate.currency ?? ''))\n  const currency = catalogs.currencies.find((item) => String(item.code ?? '').trim().toUpperCase() === rateCurrencyCode)\n    ?? catalogs.currencies.find((item) => normalizeCatalogValue(displayValue(item)).includes(rateCurrencyValue))`
  const valueFirstImport = `  const rateCurrencyCode = String(rate.currency ?? '').trim().toUpperCase()\n  const rateCurrencyValue = normalizeCatalogValue(String(rate.currency ?? ''))\n  const currency = catalogs.currencies.find((item) => normalizeCatalogValue(displayValue(item)).includes(rateCurrencyValue))\n    ?? catalogs.currencies.find((item) => String(item.code ?? '').trim().toUpperCase() === rateCurrencyCode)`
  if (code.includes(codeFirstImport)) code = code.replace(codeFirstImport, valueFirstImport)

  return code
}

export function pricingCurrencyValueGuard(): Plugin {
  return {
    name: 'dhole-pricing-currency-value-guard',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
