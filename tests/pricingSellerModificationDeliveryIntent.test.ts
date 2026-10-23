import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')

test('closing a modification tab only releases the lease, never sends the revision', () => {
  const view = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')
  const stopIndex = view.indexOf('function stop() {')
  const nextFunction = view.indexOf('\nfunction ', stopIndex + 1)
  const stopBody = view.slice(stopIndex, nextFunction > stopIndex ? nextFunction : view.length)
  assert.match(stopBody, /RateRequestLeaseService\.release\(id\)/)
  assert.doesNotMatch(stopBody, /completeRate\(|\.complete\(/)
  assert.match(view, /async function completeModification\(\)/)
  assert.match(view, /RateRequestLeaseService\.completeRate\(requestId\.value, rateId, \{ confirmSellerModification: true \}\)/)
})

test('delivery confirmation is emitted only by explicit send actions', () => {
  const service = read('src/modules/pricing/services/rateRequestLeaseService.ts')
  const panel = read('src/modules/pricing/components/PricingRateRequestsPanel.vue')
  assert.match(service, /confirmSellerModification\?: boolean/)
  assert.match(service, /options\?\.confirmSellerModification === true \? 'SendSellerModification' : null/)
  assert.match(panel, /RateRequestLeaseService\.completeRate\(request\.id, request\.rateId, \{ confirmSellerModification: true \}\)/)
  assert.match(panel, /isModification\(request\) && !canSendModification\(request\)/)
})

test('pricing step grid is optional, so a visual class cannot break production Vite build', () => {
  const transform = read('build/pricingSellerPricingStepGuard.ts')
  assert.doesNotMatch(transform, /'pricing four-step grid',/)
  assert.match(transform, /code = code\.replace\(/)
  assert.match(transform, /pricingSellerScreensLocked/)
})
