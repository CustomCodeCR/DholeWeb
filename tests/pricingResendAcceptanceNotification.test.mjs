import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wizard = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', 'utf8')
const modal = readFileSync('src/modules/pricing/components/PricingResendAcceptanceEmailModal.vue', 'utf8')
const service = readFileSync('src/core/services/pricingService.ts', 'utf8')

test('resend button is only for accepted quotations and authorized pricing editors', () => {
  assert.match(wizard, /editingRate\.status === 'AcceptedByClient' && canUpdateRateStatus/)
  assert.match(wizard, /Reenviar notificación/)
  assert.match(wizard, /@click="openAcceptanceNotificationResendModal"/)
  assert.match(wizard, /component: PricingResendAcceptanceEmailModal/)
  assert.match(wizard, /modalStore\.open\(/)
})

test('DhModal lets user select the exact notification to resend', () => {
  assert.match(modal, /DhSelect/)
  assert.match(modal, /v-model="notificationType"/)
  assert.match(modal, /value: 'opening'/)
  assert.match(modal, /value: 'quote'/)
  assert.match(modal, /value: 'notice'/)
  assert.match(modal, /SIN PDF/)
  assert.match(modal, /Confirmar reenvío/)
  assert.doesNotMatch(modal, /window\.confirm|window\.alert/)
})

test('each selection has one idempotency key preserved on retry', () => {
  assert.match(modal, /const requestId = ref\(crypto\.randomUUID\(\)\)/)
  assert.match(modal, /watch\(notificationType, \(\) => \{/)
  assert.match(modal, /requestId\.value = crypto\.randomUUID\(\)/)
  assert.match(modal, /if \(sending\.value\) return/)
  assert.match(modal, /PricingService\.resendAcceptedRateEmail\(props\.rateId, requestId\.value, notificationType\.value\)/)
  assert.match(service, /acceptance-email\/resend/)
  assert.match(service, /body: \{ requestId, notificationType \}/)
  assert.match(service, /idempotencyKey: requestId/)
})
