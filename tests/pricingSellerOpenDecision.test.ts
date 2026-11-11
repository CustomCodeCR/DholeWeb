import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { canDecideSellerQuote } from '../src/modules/pricing/utils/sellerRateWorkflowStatus.ts'

const quo269 = {
  status: 'Sent' as const, // Previous revision actually delivered to Sales
  currentRateStatus: 'Open' as const,
  revisionPending: true,
}
const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')

test('QUO-00000-000269: seller may accept or reject an Open quote previously issued', () => {
  assert.equal(canDecideSellerQuote(quo269, false), true)
  assert.equal(canDecideSellerQuote(quo269, true), false)
})

test('seller cannot decide on unpublished, unissued or management-pending revisions', () => {
  assert.equal(canDecideSellerQuote({ ...quo269, status: 'Open' }, false), false)
  assert.equal(canDecideSellerQuote({ ...quo269, currentRateStatus: 'PendingApproval' }, false), false)
  assert.equal(canDecideSellerQuote({ ...quo269, currentRateStatus: 'RejectedByManagement' }, false), false)
  assert.equal(canDecideSellerQuote({ ...quo269, status: 'AcceptedByClient' }, false), false)
})

test('existing Sent and RequestedByClient decisions remain supported', () => {
  assert.equal(canDecideSellerQuote({ status: 'Sent', revisionPending: false }, false), true)
  assert.equal(canDecideSellerQuote({ status: 'RequestedByClient', revisionPending: false }, false), true)
  assert.equal(canDecideSellerQuote({ status: 'Open', revisionPending: false }, false), true)
  assert.equal(canDecideSellerQuote({ status: 'RejectedByClient', revisionPending: false }, false), false)
})

test('both seller screens honor the shared eligibility and expose decision buttons', () => {
  const dashboard = read('src/modules/dashboard/components/SellerRoleDashboard.vue')
  const detail = read('src/modules/pricing/views/PricingSellerRateDetailView.vue')
  assert.match(dashboard, /canActOnRate\(rate\) && canDecideSellerQuote\(rate, hasOpenPricingModification\(rate\)\)/)
  assert.match(dashboard, /<template v-if="canRespondToRate\(rate\)">/)
  assert.match(detail, /canDecideSellerQuote\(rate\.value, revisionWorkActive\.value\)/)
  assert.match(detail, /<template v-if="canRespondToRate">/)
  assert.match(detail, /if \(!rate\.value \|\| !canRespondToRate\.value\) return/)
})

test('modal does not promise Apertura a draft pending publication', () => {
  const modal = read('src/modules/dashboard/components/SellerRateDecisionModal.vue')
  assert.match(modal, /openingNotificationDeferred/)
  assert.match(modal, /última revisión enviada/)
  assert.match(modal, /no se enviará el borrador/)
})

test('expired issued quotes allow seller decision but not an unpublished active modification', () => {
  const expired = { status: 'Expired' as const, revisionPending: false }
  assert.equal(canDecideSellerQuote(expired, false), true)
  assert.equal(canDecideSellerQuote({ ...quo269, status: 'Expired' }, false), true)
  assert.equal(canDecideSellerQuote({ ...quo269, status: 'Expired' }, true), false)
  assert.equal(canDecideSellerQuote({ status: 'Closed', revisionPending: false }, false), false)
  const modal = read('src/modules/dashboard/components/SellerRateDecisionModal.vue')
  assert.match(modal, /props[.]rate[.]status === 'Expired'/)
})
