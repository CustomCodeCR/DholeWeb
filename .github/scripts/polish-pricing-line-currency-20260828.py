from pathlib import Path

path = Path('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
text = path.read_text(encoding='utf-8')
old = '''function setLineCurrency(line: RateLine, currencyId: string) {
  const currency = findById(catalogs.currencies, currencyId)
  if (!currency) return
  line.currencyId = currency.id
  line.currencyName = displayValue(currency) || currency.label || currency.code
  line.currencyCode = String(currency.code || displayValue(currency)).trim().toUpperCase()
}

function enforceLineCurrency(line: RateLine) {
  if (isLineCrcForced(line) && crcCurrency.value) setLineCurrency(line, crcCurrency.value.id)
}
'''
new = '''function setLineCurrency(line: RateLine, currencyId: string) {
  const currency = findById(catalogs.currencies, currencyId)
  if (!currency) return

  const previousCode = String(line.currencyCode || '').trim().toUpperCase()
  const nextCode = String(currency.code || displayValue(currency)).trim().toUpperCase()
  const exchangeRate = number(exchangeRateSale.value)

  // Cambiar la divisa no debe reinterpretar USD 100 como CRC 100. Se conserva
  // el valor económico de la línea usando el tipo de cambio visible de Hacienda.
  if (previousCode && previousCode !== nextCode && exchangeRate > 0) {
    if (previousCode === 'USD' && nextCode === 'CRC') {
      line.costAmount = Math.round(number(line.costAmount) * exchangeRate * 100) / 100
      line.saleAmount = Math.round(number(line.saleAmount) * exchangeRate * 100) / 100
    } else if (previousCode === 'CRC' && nextCode === 'USD') {
      line.costAmount = Math.round((number(line.costAmount) / exchangeRate) * 100) / 100
      line.saleAmount = Math.round((number(line.saleAmount) / exchangeRate) * 100) / 100
    }
  }

  line.currencyId = currency.id
  line.currencyName = displayValue(currency) || currency.label || currency.code
  line.currencyCode = nextCode
}

function enforceLineCurrency(line: RateLine) {
  if (isLineCrcForced(line) && crcCurrency.value) setLineCurrency(line, crcCurrency.value.id)
}

watch(
  [crcImportContext, () => form.serviceIds.join('|'), crcCurrency],
  () => rateLines.value.forEach(enforceLineCurrency),
)
'''
if text.count(old) != 1:
    raise SystemExit(f'Expected one line currency setter block, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Line currency conversion and CR rule watcher applied.')
