import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canSellerRequestRateModification } from '../src/modules/pricing/utils/sellerRateModificationPolicy.ts'

const base = { status: 'Sent' as const, currentRateStatus: 'Sent' as const,
  revisionPending: false, pendingReapproval: false, sellerReceivedAtUtc: null }

test('accepted quotation never exposes a seller modification action', () => {
  assert.equal(canSellerRequestRateModification({
    ...base, status: 'AcceptedByClient', currentRateStatus: 'AcceptedByClient',
    sellerReceivedAtUtc: '2026-11-18T12:00:00Z',
  }), false)
  assert.equal(canSellerRequestRateModification({
    ...base, status: 'Sent', currentRateStatus: 'AcceptedByClient',
  }), false)
})

test('Pricing-only revisions after acceptance remain locked to sellers', () => {
  assert.equal(canSellerRequestRateModification({
    ...base, status: 'Sent', pendingReapproval: true,
    sellerReceivedAtUtc: '2026-11-18T12:00:00Z',
  }), false)
  assert.equal(canSellerRequestRateModification({
    ...base, status: 'Sent', revisionPending: true,
  }), false)
})

test('seller can still request changes to a non-accepted quotation', () => {
  for (const status of ['Sent', 'RequestedByClient', 'RejectedByClient', 'Expired'] as const) {
    assert.equal(canSellerRequestRateModification({ ...base, status }), true)
  }
  assert.equal(canSellerRequestRateModification({
    ...base, status: 'Open', sellerReceivedAtUtc: '2026-11-18T12:00:00Z',
  }), true)
  assert.equal(canSellerRequestRateModification({ ...base, status: 'Open' }), false)
  assert.equal(canSellerRequestRateModification({ ...base, status: 'Cancelled' }), false)
  assert.equal(canSellerRequestRateModification({ ...base, status: 'Closed' }), false)
})

test('both dashboard and quote detail use the same eligibility policy', () => {
  const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
  const dashboard = read('src/modules/dashboard/components/SellerRoleDashboard.vue')
  const detail = read('src/modules/pricing/views/PricingSellerRateDetailView.vue')
  assert.match(dashboard, /canManageRate\(rate\) && canSellerRequestRateModification\(rate\)/)
  assert.match(detail, /rate\.value && canSellerRequestRateModification\(rate\.value\)/)
  assert.equal((dashboard.match(/v-if="canRequestModification\(rate\)"/g) || []).length, 2)
  assert.match(detail, /v-if="canRequestModification"/)
})
