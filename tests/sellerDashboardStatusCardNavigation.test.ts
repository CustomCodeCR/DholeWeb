import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sellerDashboard = readFileSync(
  new URL('../src/modules/dashboard/components/SellerRoleDashboard.vue', import.meta.url),
  'utf8',
)
const pricingDashboard = readFileSync(
  new URL('../src/modules/dashboard/components/PricingRoleDashboard.vue', import.meta.url),
  'utf8',
)
const ratesView = readFileSync(
  new URL('../src/modules/pricing/views/PricingRatesView.vue', import.meta.url),
  'utf8',
)

test('seller KPI cards open the same Pricing rates page as the Pricing dashboard', () => {
  assert.match(pricingDashboard, /router\.push\(\{ path: '\/pricing\/rates', query: \{ status: commercialStatus\(status\) \} \}\)/)
  assert.match(sellerDashboard, /@click="openStatusRates\(card\.filter\)"/)
  assert.match(sellerDashboard, /name: 'pricing-rates'/)
  assert.match(sellerDashboard, /filter === 'All' \? \{\} : \{ query: \{ status: filter \} \}/)
  assert.doesNotMatch(sellerDashboard, /scrollIntoView\(|@click="selectStatus\(card\.filter\)"/)
})

test('seller KPI status mappings match the Pricing rates filter options', () => {
  for (const status of ['Open', 'Sent', 'AcceptedByClient', 'RejectedByClient', 'Cancelled', 'Expired']) {
    assert.match(sellerDashboard, new RegExp("filter: '" + status + "' as SellerStatusFilter"))
    assert.match(ratesView, new RegExp("value: '" + status + "'"))
  }
})

test('Pricing rates page handles status query changes when the view is reused', () => {
  assert.match(ratesView, /\(\) => route\.query\.status/)
  assert.match(ratesView, /const nextStatus = normalizeCommercialStatus\(value\)/)
  assert.match(ratesView, /filters\.status = nextStatus\s+applyFilters\(\)/)
})

test('seller supervision remains read-only and driven by the selected seller', () => {
  assert.match(sellerDashboard, /props\.adminPreview && selectedSellerId\.value/)
  assert.match(sellerDashboard, /v-if="!props\.adminPreview"/)
  assert.match(sellerDashboard, /\/api\/pricing\/seller-rates\/dashboard/)
})
