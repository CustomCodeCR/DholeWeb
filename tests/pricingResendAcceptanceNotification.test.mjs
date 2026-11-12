import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wizard = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', 'utf8')
const modal = readFileSync('src/modules/pricing/components/PricingResendAcceptanceEmailModal.vue', 'utf8')
const service = readFileSync('src/core/services/pricingService.ts', 'utf8')

test('resend button is present for accepted quotations and requires pricing update scope', () => {
  assert.match(wizard, /editingRate\.status === 'AcceptedByClient' && canUpdateRateStatus/)
  assert.match(wizard, /Reenviar notificación/)
  assert.match(wizard, /@click="openAcceptanceNotificationResendModal"/)
  assert.match(wizard, /component: PricingResendAcceptanceEmailModal/)
  assert.match(wizard, /modalStore\.open\(/)
})

test('confirmation is a Dhole modal with one operation ID reused on retry', () => {
  assert.match(modal, /const requestId = crypto\.randomUUID\(\)/)
  assert.match(modal, /if \(sending\.value\) return/)
  assert.match(modal, /PricingService\.resendAcceptedRateEmail\(props\.rateId, requestId\)/)
  assert.match(modal, /DhButton/)
  assert.match(modal, /Confirmar reenvío/)
  assert.doesNotMatch(modal, /window\.confirm|window\.alert/)
})

test('web client reuses the UUID for backend and HTTP idempotency', () => {
  assert.match(service, /acceptance-email\/resend/)
  assert.match(service, /body: \{ requestId \}/)
  assert.match(service, /idempotencyKey: requestId/)
})
