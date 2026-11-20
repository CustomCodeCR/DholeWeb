import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const rates = read('../src/modules/pricing/views/PricingRatesView.vue')
const modal = read('../src/modules/pricing/components/PricingExpiredRateApprovalModal.vue')
const service = read('../src/modules/pricing/services/expiredRateApprovalService.ts')

test('expired rates are checked against Costa Rica business date before editing', () => {
  assert.match(rates, /timeZone: 'America\/Costa_Rica'/)
  assert.match(rates, /expiredRateApprovalService\.forRate\(rate\.id\)/)
  assert.match(rates, /if \(!approval\.canUpdate\)/)
  assert.match(rates, /openExpiryApproval\(rate\)/)
})

test('expired rate request records why it expired and blocks submission without reason', () => {
  assert.match(modal, /reason\.trim\(\)\.length < 15/)
  assert.match(modal, /expiredRateApprovalService\.request\(props\.rate\.id, explanation\)/)
  assert.match(modal, /Historial de vencimientos y autorizaciones/)
})

test('supervisor reviews and realtime refresh use existing Notifications channel', () => {
  assert.match(rates, /rsibaja@castrofallas\.com/)
  assert.match(rates, /jmesen@castrofallas\.com/)
  assert.match(modal, /expiredRateApprovalService\.decide\(item\.id, approve, comment\)/)
  assert.match(modal, /dhole:notification:received/)
  assert.match(service, /\/expired-rate-updates\/pending/)
})

test('Pricing and Superadmin skip seller-only expired rate approval', () => {
  assert.match(rates, /function canRequestExpiryApproval\(rate: RateDto\) \{[\s\S]*?&& isSellerUser\.value/)
  assert.match(rates, /if \(isSellerUser\.value && isExpiredRate\(rate\)\)/)
  assert.doesNotMatch(rates, /canUpdate\.value \|\| isSellerUser\.value/)
})
