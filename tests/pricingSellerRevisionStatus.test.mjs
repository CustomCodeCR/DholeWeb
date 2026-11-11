import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const dashboard = source('src/modules/dashboard/components/SellerRoleDashboard.vue')
const detail = source('src/modules/pricing/views/PricingSellerRateDetailView.vue')
const contract = source('src/core/interfaces/pricing.ts')
const workflow = source('src/modules/pricing/utils/sellerRateWorkflowStatus.ts')

test('an unpublished revision is not automatically active work in Pricing', () => {
  assert.match(contract, /pricingModificationActive\?: boolean/)
  assert.match(dashboard, /function hasOpenPricingModification\(rate: RateDto\)/)
  assert.match(dashboard, /typeof rate\.pricingModificationActive === 'boolean'/)
  assert.match(dashboard, /request\.kind === 'Modification' && request\.status === 'Open'/)
  assert.match(dashboard, /hasOpenPricingModification\(rate\)/)
  assert.match(workflow, /Última revisión enviada · Actualización pendiente/)
  assert.match(dashboard, /unpublishedSellerWorkflowLabel/)
  assert.doesNotMatch(dashboard, /if \(rate\.revisionPending\) return 'En modificación por Pricing'/)
})

test('seller detail distinguishes active work and blocks unreleased draft actions', () => {
  assert.match(detail, /const revisionWorkActive = computed\(/)
  assert.match(detail, /activePricingModification\.value = modificationRequests\.some\(request => request\.status === 'Open'\)/)
  assert.match(detail, /unpublishedSellerWorkflowLabel/)
  assert.match(workflow, /case 'Open': return 'Abierta'/)
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

test('expired quotes enable seller decisions without unlocking unpublished drafts', () => {
  assert.match(dashboard, /\['Sent', 'RequestedByClient', 'Expired'\][.]includes\(rate[.]status\)/)
  assert.match(detail, /const canRespondToRate = computed/)
  assert.match(detail, /\['Sent', 'RequestedByClient', 'Expired'\][.]includes\(rate[.]value[.]status\)/)
  assert.match(detail, /if \(!rate[.]value \|\| !canRespondToRate[.]value\) return/)
  assert.match(dashboard, /if \(!canRespondToRate\(rate\)\) return/)
  const modal = source('src/modules/dashboard/components/SellerRateDecisionModal.vue')
  assert.match(modal, /props[.]rate[.]status === 'Expired'/)
})
