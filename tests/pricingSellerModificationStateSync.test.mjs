import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

const wizard = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', 'utf8')

test('a completed server amendment is never offered as an unsent revision', () => {
  assert.match(wizard, /savedRequest\.status === 'Completed'/)
  assert.match(wizard, /pendingModificationDelivery\.value = false/)
  assert.match(wizard, /dhole:pricing:rate-request-completed/)
  assert.match(wizard, /await router\.replace\(\{ name: 'pricing-rate-wizard'/)
})

test('retry is idempotent when Pricing already closed the seller request', () => {
  const retry = wizard.slice(
    wizard.indexOf('async function retrySavedModificationDelivery()'),
    wizard.indexOf('async function saveRate()'),
  )
  assert.match(retry, /request\.status === 'Completed'/)
  assert.match(retry, /return/)
  assert.match(retry, /request\.status !== 'Open'/)
})
