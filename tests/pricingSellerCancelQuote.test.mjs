import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const dashboard = source('src/modules/dashboard/components/SellerRoleDashboard.vue')
const detail = source('src/modules/pricing/views/PricingSellerRateDetailView.vue')
const modal = source('src/modules/dashboard/components/SellerRateDecisionModal.vue')
const pricingWizard = source('src/modules/pricing/components/PricingRateExistingWizardStable.vue')

test('seller dashboard does not expose quote cancellation on desktop or mobile', () => {
  assert.doesNotMatch(dashboard, /label="Cancelar cotización"/)
  assert.doesNotMatch(dashboard, /function canCancelRate\(/)
  assert.doesNotMatch(dashboard, /function openCancelRate\(/)
  assert.match(dashboard, /label="Ver tarifa"/)
  assert.match(dashboard, /openCustomerDecision\(rate, 'AcceptedByClient'\)/)
  assert.match(dashboard, /openCustomerDecision\(rate, 'RejectedByClient'\)/)
})

test('seller quote detail no longer offers cancellation', () => {
  assert.doesNotMatch(detail, /label="Cancelar cotización"/)
  assert.doesNotMatch(detail, /const canCancelRate = computed\(/)
  assert.doesNotMatch(detail, /function cancelRate\(/)
  assert.match(detail, /label="Descargar cotización PDF"/)
  assert.match(detail, /Solicitar modificación/)
})

test('seller decision modal supports acceptance and rejection only', () => {
  assert.match(modal, /decision: 'AcceptedByClient' \| 'RejectedByClient'/)
  assert.doesNotMatch(modal, /'Cancelled'/)
  assert.doesNotMatch(modal, /Cancelar cotización/)
  assert.match(modal, /status: props\.decision/)
  assert.match(modal, /Motivo del rechazo/)
  assert.match(modal, /quoteOptionRequired/)
})

test('Pricing still owns accepted quote cancellation independently', () => {
  assert.match(pricingWizard, /function startAcceptedRateCancellation\(/)
  assert.match(pricingWizard, /PricingCancelAcceptedRateModal/)
})
