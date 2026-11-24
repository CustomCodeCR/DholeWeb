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
  assert.match(rates, /function canRequestExpiryApproval.*isSellerUser/s)
  assert.match(rates, /if \(isSellerUser\.value && isExpiredRate\(rate\)\)/)
  assert.doesNotMatch(rates, /canUpdate\.value \|\| isSellerUser\.value/)
})


test('seller dashboard and quote detail open the shared authorization modal for expired quotes', () => {
  for (const file of ['../src/modules/dashboard/components/SellerRoleDashboard.vue', '../src/modules/pricing/views/PricingSellerRateDetailView.vue']) {
    const view = read(file)
    assert.match(view, /isSellerRateExpired\(/)
    assert.match(view, /component: PricingExpiredRateApprovalModal/)
    assert.match(view, /onContinue: continueToWizard/)
    assert.match(view, /pricing\.rate\.expired-update\./)
  }
  assert.match(modal, /Continuar con actualización/)
  const wizard = read('../build/pricingSellerModificationWizard.ts')
  assert.match(wizard, /!source\.expiryRenewal && !sellerModificationPreview\.value\.length/)
})


test('expired renewal always offers the reason field or an explicit pending/approved state', () => {
  assert.match(modal, /<template v-else>\s*<div\s*v-if="submittedReason \|\| current\?\.currentApproval/)
  assert.match(modal, /<DhTextarea[\s\S]*?label="¿Por qué se dejó vencer la tarifa\? \*"/)
  assert.match(modal, /v-if="loadError"/)
  assert.match(modal, /label="Reintentar consulta"/)
  assert.match(modal, /v-if="submitError"/)
  assert.doesNotMatch(modal, /Roy|José Pablo/)
  assert.match(service, /requireApprovalStatus\(response, rateId\)/)
  assert.match(service, /result\.status !== 'Pending'/)
})


test('expiry reasons and decisions are accessible from quotation history even after renewal', () => {
  assert.match(modal, /mode\?: 'request' \| 'review' \| 'history'/)
  assert.match(modal, /mode !== 'review' && current && current.history.length/)
  for (const file of ['../src/modules/pricing/components/PricingRateHistory.vue', '../src/modules/pricing/views/PricingSellerRateDetailView.vue']) {
    const view = read(file)
    assert.match(view, /mode: 'history'/)
    assert.match(view, /@click="openExpiryHistory"/)
  }
})
