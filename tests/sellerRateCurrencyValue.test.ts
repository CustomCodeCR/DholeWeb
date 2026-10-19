import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { sellerRateCurrencyValue } from '../src/modules/pricing/utils/sellerRateCurrency.ts'

const view = readFileSync(new URL('../src/modules/pricing/views/PricingSellerRateDetailView.vue', import.meta.url), 'utf8')

test('seller rate takes the catalog Value over generated Code for total and lines', () => {
  const items = [
    { id: 'usd', code: 'CUR-2026-001', label: 'Dólares', value: 'USD' },
    { id: 'crc', code: 'CUR-2026-002', label: 'Colones', value: 'CRC' },
  ]
  assert.equal(sellerRateCurrencyValue({ currencyId: 'usd', currencyCode: 'CUR-2026-001' }, items), 'USD')
  assert.equal(sellerRateCurrencyValue({ currencyId: 'crc', currencyCode: 'CUR-2026-002' }, items), 'CRC')
})

test('seller rate uses an ISO currency name if the catalog is unavailable', () => {
  assert.equal(sellerRateCurrencyValue({ currencyName: 'USD', currencyCode: 'CUR-2026-001' }, []), 'USD')
  assert.equal(sellerRateCurrencyValue({ currencyName: 'Colón costarricense', currencyCode: 'CUR-2026-002' }, []), 'CRC')
  assert.equal(sellerRateCurrencyValue({ currencyCode: 'EUR' }, []), 'EUR')
})

test('generated catalog codes never show up as currency when not resolvable', () => {
  assert.equal(sellerRateCurrencyValue({ currencyCode: 'CUR-2026-001' }, []), null)
})

test('seller detail uses resolved currency for both header and commercial lines', () => {
  assert.match(view, /sellerRateCurrencyValue\(currency, currencies\.value\)/)
  assert.match(view, /money\(rate\.totalSaleAmount, rate\)/)
  assert.match(view, /money\(line\.saleAmount, line\)/)
  assert.doesNotMatch(view, /money\(rate\.totalSaleAmount, rate\.currencyCode\)/)
  assert.doesNotMatch(view, /money\(line\.saleAmount, line\.currencyCode\)/)
})
