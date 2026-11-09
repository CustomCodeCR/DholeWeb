import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const dashboard = source('src/modules/dashboard/components/SellerRoleDashboard.vue')
const detail = source('src/modules/pricing/views/PricingSellerRateDetailView.vue')
const contract = source('src/core/interfaces/pricing.ts')

test('an unpublished revision is not automatically active work in Pricing', () => {
  assert.match(contract, /pricingModificationActive\?: boolean/)
  assert.match(dashboard, /function hasOpenPricingModification\(rate: RateDto\)/)
  assert.match(dashboard, /typeof rate\.pricingModificationActive === 'boolean'/)
  assert.match(dashboard, /request\.kind === 'Modification' && request\.status === 'Open'/)
  assert.match(dashboard, /hasOpenPricingModification\(rate\)/)
  assert.match(dashboard, /Última revisión enviada · Actualización pendiente/)
  assert.doesNotMatch(dashboard, /if \(rate\.revisionPending\) return 'En modificación por Pricing'/)
})

test('seller detail distinguishes active work and blocks unreleased draft actions', () => {
  assert.match(detail, /const revisionWorkActive = computed\(/)
  assert.match(detail, /activePricingModification\.value = modificationRequests\.some\(request => request\.status === 'Open'\)/)
  assert.match(detail, /Última revisión enviada · Actualización pendiente/)
  assert.match(detail, /const canReceive = computed\(\(\) => isSent\.value && !revisionPending\.value/)
  assert.match(detail, /&& !revisionPending\.value && rate\.value\.status !== 'Closed'/)
  assert.match(detail, /function refreshSellerRateOnFocus\(/)
})

test('seller dashboard reconciles published rates after queue transitions and deferred delivery', () => {
  assert.match(dashboard, /async function refreshSellerRateStatuses\(force = false\)/)
  assert.match(dashboard, /lastSellerRateRefreshAt < 20_000/)
  assert.match(dashboard, /await refreshSellerRateStatuses\(changed\)/)
  assert.match(dashboard, /pricing\.requested-rate\.completed/)
  assert.match(dashboard, /sellerRatesRefreshing = false/)
})
