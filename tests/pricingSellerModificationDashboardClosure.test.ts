import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('send verifies the persisted Completed state before reporting success', () => {
  const service = read('src/modules/pricing/services/rateRequestLeaseService.ts')
  assert.match(service, /persisted\.status !== 'Completed'/)
  assert.match(service, /dhole:pricing:rate-request-completed/)
})

test('saving a revision leaves the request Open until a distinct send action', () => {
  const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
  const save = wizard.indexOf('async function saveRate()')
  const update = wizard.indexOf('await PricingService.updateRate(', save)
  const remember = wizard.indexOf('pendingModificationDelivery.value = true', update)
  const prepare = wizard.indexOf('await RateRequestLeaseService.prepareModification(', remember)
  const end = wizard.indexOf('const nextRevision =', prepare)
  const stagedSave = wizard.slice(update, end)
  assert.ok(save >= 0 && update > save && remember > update && prepare > remember && end > prepare)
  assert.doesNotMatch(stagedSave, /RateRequestLeaseService\.completeRate\(/)
  assert.match(stagedSave, /savedRequest\.status !== 'Open'/)
  assert.match(wizard, /Enviar revisión al vendedor/)
  assert.match(wizard, /if \(pendingModificationDelivery\.value\) \{[\s\S]*?await retrySavedModificationDelivery\(\)[\s\S]*?return/)
  assert.match(wizard, /persistedRate\.revisionNumber !== revision/)
})

test('previously saved open modifications can be sent without another updateRate', () => {
  const resume = read('src/modules/pricing/views/PricingRateRequestResumeView.vue')
  const start = resume.indexOf('async function sendAlreadySavedRevision()')
  const end = resume.indexOf('async function begin(', start)
  const recovery = resume.slice(start, end)
  assert.ok(start > 0 && end > start)
  assert.match(recovery, /PricingService\.getRate\(rateId\)/)
  assert.match(recovery, /RateRequestLeaseService\.prepareModification\(id, rateId, revisionNumber\)/)
  assert.match(recovery, /RateRequestLeaseService\.completeRate\(/)
  assert.doesNotMatch(recovery, /PricingService\.updateRate\(/)
})

test('modification cancellation requires an explicitly selected reason and confirmation', () => {
  const panel = read('src/modules/pricing/components/PricingRateRequestsPanel.vue')
  assert.match(panel, /cancellationReason = ref<CancellationReason \| ''>\(''\)/)
  assert.match(panel, /!cancellationReason/)
  assert.match(panel, /CancelSellerModification/)
})

test('seller dashboard refetches open work after a completion event', () => {
  const panel = read('src/modules/pricing/components/PricingRateRequestsPanel.vue')
  assert.match(panel, /dhole:pricing:rate-request-completed/)
  assert.match(panel, /function handleCompletedRequest\(\) \{\s*void load\(\)/)
})
