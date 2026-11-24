import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const view = readFileSync(new URL('../src/modules/pricing/views/PricingOperationsReviewsView.vue', import.meta.url), 'utf8')
const router = readFileSync(new URL('../src/core/router/index.ts', import.meta.url), 'utf8')
const rates = readFileSync(new URL('../src/modules/pricing/views/PricingRatesView.vue', import.meta.url), 'utf8')

test('Pricing Operations review queue uses shared DH UI and backend permission route', () => {
  assert.match(router, /path: 'pricing\/operations-reviews'/)
  assert.match(router, /name: 'pricing-operations-reviews'/)
  assert.match(router, /requiredScope: 'pricing\.rate\.update'/)
  assert.match(rates, /router\.push\(\{ name: 'pricing-operations-reviews' \}\)/)
  assert.match(view, /<DhDataTable/)
  assert.match(view, /<DhModal :open="Boolean\(selected\)"/)
  assert.match(view, /<DhSelect v-model="decision"/)
  assert.match(view, /<DhTextarea v-model="reason"/)
})

test('Decisions include version, explicit rationale, no automatic price mutation', () => {
  assert.match(view, /expectedVersion: selected\.value\.version/)
  assert.match(view, /reason\.value\.trim\(\)\.length >= 10/)
  assert.match(view, /NO_PRICE_CHANGE_REQUIRED/)
  assert.match(view, /REVISION_REQUIRED/)
  assert.match(view, /REJECTED/)
  assert.match(view, /QUO aceptada conserva sus importes/)
  assert.match(view, /fetchClient\(/)
})
