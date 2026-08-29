from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')

old = '''function convertUsdCrc(amount: number, sourceCode: string, targetCode: 'USD' | 'CRC') {
  const source = String(sourceCode || 'USD').trim().toUpperCase()
  if (source === targetCode) return number(amount)
  const rate = number(exchangeRateSale.value)
  if (rate <= 0) return 0
  if (source === 'USD' && targetCode === 'CRC') return number(amount) * rate
  if (source === 'CRC' && targetCode === 'USD') return number(amount) / rate
  return 0
}
function sumLinesInCurrency(amount: (line: RateLine) => number, target: 'USD' | 'CRC') {
  return includedLines.value.reduce(
    (sum, line) => sum + convertUsdCrc(amount(line), line.currencyCode, target),
    0,
  )
}
const totalCostUsd = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'USD'))
const totalCostCrc = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'CRC'))
const totalSaleBeforeTaxUsd = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'USD'))
const totalSaleBeforeTaxCrc = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'CRC'))
const totalTaxUsd = computed(() => sumLinesInCurrency(lineTaxAmount, 'USD'))
const totalTaxCrc = computed(() => sumLinesInCurrency(lineTaxAmount, 'CRC'))
'''

new = '''function canonicalCurrencyCode(line: Pick<RateLine, 'currencyId' | 'currencyCode' | 'currencyName'>) {
  const catalogCurrency = findById(catalogs.currencies, line.currencyId)
  const candidates = [
    line.currencyCode,
    line.currencyName,
    catalogCurrency?.code,
    catalogCurrency?.slug,
    catalogCurrency?.label,
    displayValue(catalogCurrency),
  ]

  for (const candidate of candidates) {
    const raw = String(candidate ?? '').trim()
    const normalized = normalizeCatalogValue(raw)
    const upper = raw.toUpperCase()
    if (upper === 'USD' || normalized === 'usd' || normalized.includes('dolar') || normalized.includes('dollar')) {
      return 'USD' as const
    }
    if (
      upper === 'CRC' ||
      normalized === 'crc' ||
      normalized.includes('colon costarricense') ||
      normalized.includes('colones') ||
      normalized === 'colon'
    ) {
      return 'CRC' as const
    }
  }

  return String(line.currencyCode ?? '').trim().toUpperCase()
}

function convertUsdCrc(amount: number, sourceCode: string, targetCode: 'USD' | 'CRC') {
  const source = String(sourceCode || 'USD').trim().toUpperCase()
  if (source === targetCode) return number(amount)
  const rate = number(exchangeRateSale.value)
  if (rate <= 0) return 0
  if (source === 'USD' && targetCode === 'CRC') return number(amount) * rate
  if (source === 'CRC' && targetCode === 'USD') return number(amount) / rate
  return 0
}
function sumLinesInCurrency(amount: (line: RateLine) => number, target: 'USD' | 'CRC') {
  return includedLines.value.reduce((sum, line) => {
    const quantity = Math.max(0, number(quantityForChargeBasis(line.chargeBasis)))
    const lineTotal = number(amount(line)) * quantity
    return sum + convertUsdCrc(lineTotal, canonicalCurrencyCode(line), target)
  }, 0)
}
const totalCostUsd = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'USD'))
const totalCostCrc = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'CRC'))
const totalSaleBeforeTaxUsd = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'USD'))
const totalSaleBeforeTaxCrc = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'CRC'))
const totalTaxUsd = computed(() => sumLinesInCurrency(lineTaxAmount, 'USD'))
const totalTaxCrc = computed(() => sumLinesInCurrency(lineTaxAmount, 'CRC'))
'''

if old not in text:
    raise RuntimeError('Totals block not found')
text = text.replace(old, new, 1)

old_mixed = '''const includedCurrencyCodes = computed(() => new Set(includedLines.value.map((line) => String(line.currencyCode).trim().toUpperCase())))'''
new_mixed = '''const includedCurrencyCodes = computed(() => new Set(includedLines.value.map((line) => canonicalCurrencyCode(line)).filter(Boolean)))'''
if old_mixed not in text:
    raise RuntimeError('Mixed currencies block not found')
text = text.replace(old_mixed, new_mixed, 1)

path.write_text(text, encoding='utf-8')
print('Screen 7 totals fixed.')
