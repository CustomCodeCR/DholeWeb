import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const view = readFileSync(new URL('../src/modules/pricing/views/PricingOwnLclView.vue', import.meta.url), 'utf8')
const service = readFileSync(new URL('../src/core/services/ownLclConsolidationService.ts', import.meta.url), 'utf8')
test('draft tariff uses backend endpoint, surfaces failures and guards stale responses', () => {
  assert.match(service, /own-lcl-automation\/pricing-lines-preview/)
  assert.match(view, /OwnLclConsolidationService\.previewPricingLines/)
  assert.doesNotMatch(view, /createDefaultOwnLclPricingLines/)
  assert.match(view, /request !== previewRequest/)
  assert.match(view, /pricingLinesError/)
})

test('own LCL destination costs use the shared wizard bundle and selected IDs', () => {
  assert.match(service, /costs\/wizard-bundle/)
  assert.match(service, /shipmentMode: 'Lcl'/)
  assert.match(service, /ownLclDestinationPreview: true/)
  assert.match(view, /poeId: arrivalPoe\?\.id/)
})
