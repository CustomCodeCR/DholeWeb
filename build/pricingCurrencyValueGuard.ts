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

  // Pantalla 9 receives persisted totals in both USD and CRC from Pricing. A previous
  // compatibility layer intentionally kept only the native line currency in view mode,
  // which zeroed the CRC column whenever every saved detail was in USD.
  const nativeCurrencyTotals = `function sumLinesInCurrency(amount: (line: RateLine) => number, target: 'USD' | 'CRC') {\n  return includedLines.value.reduce((sum, line) => {\n    const quantity = Math.max(0, number(quantityForChargeBasis(line.chargeBasis)))\n    const lineTotal = number(amount(line)) * quantity\n    const sourceCode = canonicalCurrencyCode(line)\n\n    if (props.viewOnly && step.value === 9) {\n      return sourceCode === target ? sum + lineTotal : sum\n    }\n\n    return sum + convertUsdCrc(lineTotal, sourceCode, target)\n  }, 0)\n}`
  const convertedCurrencyTotals = `function sumLinesInCurrency(amount: (line: RateLine) => number, target: 'USD' | 'CRC') {\n  return includedLines.value.reduce((sum, line) => {\n    const quantity = Math.max(0, number(quantityForChargeBasis(line.chargeBasis)))\n    const lineTotal = number(amount(line)) * quantity\n    return sum + convertUsdCrc(lineTotal, canonicalCurrencyCode(line), target)\n  }, 0)\n}`
  if (code.includes(nativeCurrencyTotals)) code = code.replace(nativeCurrencyTotals, convertedCurrencyTotals)

  // In read-only Pantalla 9 the API snapshot is authoritative. Use the persisted totals
  // directly and keep the line-based calculation only as fallback for draft/edit screens.
  const aggregateTotalsAnchor = `const totalCostUsd = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'USD'))\nconst totalCostCrc = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'CRC'))\nconst totalSaleBeforeTaxUsd = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'USD'))\nconst totalSaleBeforeTaxCrc = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'CRC'))\nconst totalTaxUsd = computed(() => sumLinesInCurrency(lineTaxAmount, 'USD'))\nconst totalTaxCrc = computed(() => sumLinesInCurrency(lineTaxAmount, 'CRC'))\nconst totalSaleUsd = computed(() => totalSaleBeforeTaxUsd.value + totalTaxUsd.value)\nconst totalSaleCrc = computed(() => totalSaleBeforeTaxCrc.value + totalTaxCrc.value)\nconst totalUtilityUsd = computed(() => totalSaleBeforeTaxUsd.value - totalCostUsd.value)\nconst totalUtilityCrc = computed(() => totalSaleBeforeTaxCrc.value - totalCostCrc.value)`
  const aggregateTotalsReplacement = `const screen09PersistedRate = computed(() => props.viewOnly && step.value === 9 ? editingRate.value : null)\nconst totalCostUsd = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalCostUsd) : sumLinesInCurrency((line) => number(line.costAmount), 'USD'))\nconst totalCostCrc = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalCostCrc) : sumLinesInCurrency((line) => number(line.costAmount), 'CRC'))\nconst totalSaleBeforeTaxUsd = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalSaleUsd) : sumLinesInCurrency((line) => number(line.saleAmount), 'USD'))\nconst totalSaleBeforeTaxCrc = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalSaleCrc) : sumLinesInCurrency((line) => number(line.saleAmount), 'CRC'))\nconst totalTaxUsd = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalTaxUsd) : sumLinesInCurrency(lineTaxAmount, 'USD'))\nconst totalTaxCrc = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalTaxCrc) : sumLinesInCurrency(lineTaxAmount, 'CRC'))\nconst totalSaleUsd = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalSaleWithTaxUsd ?? screen09PersistedRate.value.totalSaleUsd) : totalSaleBeforeTaxUsd.value + totalTaxUsd.value)\nconst totalSaleCrc = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalSaleWithTaxCrc ?? screen09PersistedRate.value.totalSaleCrc) : totalSaleBeforeTaxCrc.value + totalTaxCrc.value)\nconst totalUtilityUsd = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalUtilityUsd) : totalSaleBeforeTaxUsd.value - totalCostUsd.value)\nconst totalUtilityCrc = computed(() => screen09PersistedRate.value ? number(screen09PersistedRate.value.totalUtilityCrc) : totalSaleBeforeTaxCrc.value - totalCostCrc.value)`
  if (code.includes(aggregateTotalsAnchor)) {
    code = code.replace(aggregateTotalsAnchor, aggregateTotalsReplacement)
  }

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
