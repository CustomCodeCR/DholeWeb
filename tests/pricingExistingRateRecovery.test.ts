import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync(new URL('../src/modules/pricing/components/PricingRateRequestsPanel.vue', import.meta.url), 'utf8')

test('existing-rate recovery explicitly warns when client or route differs', () => {
  assert.match(panel, /const recoveryClientMismatch = computed/)
  assert.match(panel, /const recoveryRouteMismatch = computed/)
  assert.match(panel, /recoveryClientMismatch\.value \|\| recoveryRouteMismatch\.value/)
  assert.match(panel, /El nombre del cliente no coincide/)
  assert.match(panel, /La ruta de la tarifa no coincide/)
  assert.match(panel, /v-model="recoveryMismatchAcknowledged"/)
  assert.match(panel, /recoveryNeedsConfirmation && !recoveryMismatchAcknowledged/)
  assert.doesNotMatch(panel, /toast\.error\('Cliente diferente'/)
})

test('the acknowledgement is reset when the QUO selection changes', () => {
  assert.match(panel, /watch\(recoveryRateId, \(\) => \{ recoveryMismatchAcknowledged\.value = false \}\)/)
  assert.match(panel, /function openRecovery[\s\S]*?recoveryMismatchAcknowledged\.value = false/)
})

test('recovery keeps the lease, completion and persisted-state verification flow', () => {
  const confirmation = panel.slice(panel.indexOf('async function confirmRecovery()'))
  const acknowledgement = confirmation.indexOf('if (recoveryNeedsConfirmation.value && !recoveryMismatchAcknowledged.value)')
  const claim = confirmation.indexOf('await RateRequestLeaseService.claim(request.id')
  const complete = confirmation.indexOf('await RateRequestLeaseService.completeRate(request.id, rate.id)')
  assert.ok(acknowledgement >= 0 && acknowledgement < claim)
  assert.ok(claim < complete)
  const leaseService = readFileSync(new URL('../src/modules/pricing/services/rateRequestLeaseService.ts', import.meta.url), 'utf8')
  assert.match(leaseService, /persisted\.status !== 'Completed'/)
  assert.match(leaseService, /persisted\.rateId\?\.toLowerCase\(\) !== rateId\.toLowerCase\(\)/)
})
