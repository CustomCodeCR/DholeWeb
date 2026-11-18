import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const dashboard = source('src/modules/dashboard/components/SellerRoleDashboard.vue')
const detail = source('src/modules/pricing/views/PricingSellerRateDetailView.vue')
const modal = source('src/modules/dashboard/components/SellerRateDecisionModal.vue')

test('sales dashboard provides cancellation for eligible own quotes on desktop and mobile', () => {
  assert.match(dashboard, /function canCancelRate\(rate: RateDto\)/)
  assert.match(dashboard, /canActOnRate\(rate\) && !rate\.revisionPending/)
  assert.match(dashboard, /\['Sent', 'RequestedByClient', 'Expired', 'AcceptedByClient'\]\.includes\(rate\.status\)/)
  assert.equal((dashboard.match(/label="Cancelar cotización"/g) || []).length, 2)
  assert.match(dashboard, /function openCancelRate\(rate: RateDto\)/)
  assert.match(dashboard, /decision: 'Cancelled', onSaved: load/)
})

test('sales quote detail exposes cancellation in the header and refreshes on success', () => {
  assert.match(detail, /const canCancelRate = computed\(/)
  assert.match(detail, /label="Cancelar cotización" variant="danger" @click="cancelRate"/)
  assert.match(detail, /decision: 'Cancelled', onSaved: load/)
})

test('cancellation modal requires an auditable reason and uses the status API', () => {
  assert.match(modal, /decision: 'AcceptedByClient' \| 'RejectedByClient' \| 'Cancelled'/)
  assert.match(modal, /const isCancel = computed\(\(\) => props\.decision === 'Cancelled'\)/)
  assert.match(modal, /!reason \|\| reason\.length > 1000/)
  assert.match(modal, /status: props\.decision/)
  assert.match(modal, /Motivo de cancelación/)
  assert.match(modal, /Cotización cancelada/)
  assert.match(modal, /onSaved\?\.\(\)/)
})
