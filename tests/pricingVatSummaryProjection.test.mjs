import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pricingCurrencyValueGuard } from '../build/pricingCurrencyValueGuard.ts'

test('saved Pricing VAT rows feed the offer summary without altering pre-tax margin', () => {
  const before = [
    "const totalCostUsd = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'USD'))",
    "const totalCostCrc = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'CRC'))",
    "const totalSaleBeforeTaxUsd = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'USD'))",
    "const totalSaleBeforeTaxCrc = computed(() => sumLinesInCurrency((line) => number(line.saleAmount), 'CRC'))",
    "const totalTaxUsd = computed(() => sumLinesInCurrency(lineTaxAmount, 'USD'))",
    "const totalTaxCrc = computed(() => sumLinesInCurrency(lineTaxAmount, 'CRC'))",
    "const totalSaleUsd = computed(() => totalSaleBeforeTaxUsd.value + totalTaxUsd.value)",
    "const totalSaleCrc = computed(() => totalSaleBeforeTaxCrc.value + totalTaxCrc.value)",
    "const totalUtilityUsd = computed(() => totalSaleBeforeTaxUsd.value - totalCostUsd.value)",
    "const totalUtilityCrc = computed(() => totalSaleBeforeTaxCrc.value - totalCostCrc.value)",
  ].join('\n')
  const plugin = pricingCurrencyValueGuard()
  const result = plugin.transform(before, '/root/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  assert.ok(result && typeof result === 'object')
  const code = result.code
  assert.match(code, /function screen09SavedTax\(target: 'USD' \| 'CRC'\)/)
  assert.match(code, /const tax = quoteShownTax\(line\)/)
  assert.match(code, /const source = canonicalCurrencyCode\(line\)/)
  assert.match(code, /const totalTaxUsd = computed\(\(\) => screen09PersistedRate\.value \? \(number\(screen09PersistedRate\.value\.totalTaxUsd\) \|\| screen09SavedTax\('USD'\)\)/)
  assert.match(code, /const totalTaxCrc = computed\(\(\) => screen09PersistedRate\.value \? \(number\(screen09PersistedRate\.value\.totalTaxCrc\) \|\| screen09SavedTax\('CRC'\)\)/)
  assert.match(code, /const totalSaleUsd = computed\(\(\) => totalSaleBeforeTaxUsd\.value \+ totalTaxUsd\.value\)/)
  assert.match(code, /const totalSaleCrc = computed\(\(\) => totalSaleBeforeTaxCrc\.value \+ totalTaxCrc\.value\)/)
  assert.match(code, /totalSaleBeforeTaxUsd\.value - totalCostUsd\.value/)
  assert.doesNotMatch(code, /screen09PersistedRate\.value\.totalSaleWithTaxUsd/)
})
