import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sellerDashboard = readFileSync(
  new URL('../src/modules/dashboard/components/SellerRoleDashboard.vue', import.meta.url),
  'utf8',
)
const dashboardView = readFileSync(
  new URL('../src/modules/dashboard/views/DashboardView.vue', import.meta.url),
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

test('supervision allows own seller actions without allowing actions on other sellers quotations', () => {
  assert.match(dashboardView, /:enable-seller-actions="authStore\.hasScope\('pricing\.rate-request\.create'\)"/)
  assert.match(sellerDashboard, /props\.adminPreview && selectedSellerId\.value/)
  assert.match(sellerDashboard, /\/api\/pricing\/seller-rates\/dashboard/)
  assert.match(sellerDashboard, /\/api\/pricing\/seller-rates'/)
  assert.match(sellerDashboard, /ownRatesById\.value\.has\(rate\.id\)/)
  assert.match(sellerDashboard, /ownRequestIds\.value\.has\(request\.id\)/)
  assert.match(sellerDashboard, /v-if="canActOnRate\(rate\) \|\| canEditCreatedPricingRate\(rate\)"/)
  assert.match(sellerDashboard, /if \(!canActOnRate\(rate\)\) return/)
  assert.match(sellerDashboard, /Promise\.allSettled/)
})

test('Pricing + Vendedor roles expose both dashboard views, not only SuperUsuario', () => {
  assert.match(dashboardView, /const hasSellerRole = computed\(/)
  assert.match(dashboardView, /hasSellerRole\.value && canUsePricing\.value/)
  assert.match(dashboardView, /const canSelectDashboard = computed\(/)
  assert.match(dashboardView, /v-if="canSelectDashboard"/)
  assert.match(dashboardView, /<option value="pricing">Pricing<\/option>/)
  assert.match(dashboardView, /<option value="seller">Vendedor<\/option>/)
  assert.match(dashboardView, /canSelectDashboard\.value\s*\? selectedDashboardRole\.value/)
  assert.doesNotMatch(dashboardView, /v-if="isSuperUser\(\)" class="w-full shrink-0 sm:w-56"/)
})

test('dual-role seller dashboard uses personal API, while supervisors retain global overview', () => {
  assert.match(dashboardView, /:admin-preview="isSuperUser\(\) \|\| \(canViewAllCommercialRates && !canSelectDashboard\)"/)
  assert.match(sellerDashboard, /path: props\.adminPreview \? '\/api\/pricing\/rate-requests\/dashboard' : '\/api\/pricing\/rate-requests\/mine'/)
  assert.match(sellerDashboard, /path: props\.adminPreview \? '\/api\/pricing\/seller-rates\/dashboard' : '\/api\/pricing\/seller-rates'/)
  assert.match(dashboardView, /v-else-if="canUsePricing"/)
})
